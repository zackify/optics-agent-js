// This file contains the functions that interact with graphql-js to
// get the data for us to report.


import { forEachField, addSchemaLevelResolveFunction } from 'graphql-tools';

import { reportRequestStart, reportRequestEnd, reportResolver, reportSchema } from './Report';

import { addLatencyToBuckets } from './Normalize';


////////// Request Wrapping //////////

// Here we wrap HTTP requests coming in to the web server.

// On request start:
// 1) note the request start time
// 2) create a per-request place to put state

// On request end:
// 3) note the request stop time
// 4) send the collected data off to Report.js for processing

// This should be the only code that interacts with the web
// server. Supporting new web servers besides Express and HAPI should
// be contained here.


export const opticsMiddleware = (req, res, next) => {
  const context = {
    startWallTime: +new Date(),
    startHrTime: process.hrtime(),
    oldResEnd: res.end
  };
  req._opticsContext = context;

  res.end = function () {
    context.durationHrTime = process.hrtime(context.startHrTime);
    context.endWallTime = +new Date();
    context.oldResEnd && context.oldResEnd.apply(res, arguments);

    // put reporting later in the event loop after I/O, so hopefully we
    // don't impact latency as much.
    setImmediate(() => { reportRequestEnd(req); });
  };

  return next();
};

export const instrumentHapiServer = (server) => {
  server.ext([
    {
      type: 'onPreHandler',
      method: (request, reply) => {
        const req = request.raw.req;
        const res = {};
        opticsMiddleware(req, res, () => {});
        req._opticsRes = res;
        return reply.continue();
      }
    }, {
      type: 'onPostHandler',
      method: (request, reply) => {
        const req = request.raw.req;
        const res = req._opticsRes;
        if (res && res.end) {
          res.end();
        }
        return reply.continue();
      }
    }]);
};


////////// Resolver Wrapping //////////

// Here we wrap resolver functions. The wrapped resolver notes start
// and end times, resolvers that return null/undefined, and
// errors. Note that a resolver is not considered finished until all
// promises it returns (if any) have completed.

// This is applied to each resolver in the schema by instrumentSchema
// below.

export const decorateField = (fn, info) => {
  const decoratedResolver = (p, a, ctx, i) => {
    // setup context and note start time.
    const opticsContext = ctx.opticsContext;
    const resolverReport = {
      startOffset: process.hrtime(opticsContext.startHrTime),
      info
    };
    // save the report object for when we want to sent query traces.
    opticsContext && opticsContext.resolverCalls.push(resolverReport);

    // Call this when the resolver and all the promisises it returns
    // (if any) are complete.
    const finishRun = () => {
      // note end time.
      resolverReport.endOffset = process.hrtime(opticsContext.startHrTime);
      const nanos = (resolverReport.endOffset[0]*1e9 +
                     resolverReport.endOffset[1]) - (
                       resolverReport.startOffset[0]*1e9 +
                         resolverReport.startOffset[1]);

      // report our results over to Report.js for field stats.
      reportResolver(opticsContext, i, info, nanos);
    };

    // Actually run the resolver.
    let result;
    try {
      result = fn(p, a, ctx, i);
    } catch (e) {
      // Resolver function threw during execution. Note the error and
      // re-throw.
      resolverReport.error = true;
      finishRun();
      throw e;
    }

    // Now process the results of the resolver.
    //
    // Resolver can return any of: null, undefined, string, number,
    // array[thing], or promise[thing].
    // For primatives and arrays of primatives, fire the report immediately.
    // For promises, fire when the promise returns.
    // For arrays containing promises, fire when the last promise returns.
    //
    // Wrap in try-catch so bugs in optics-agent are less like to break an app.
    try {
      if (result === null) {
        resolverReport.resultNull = true;
      }
      else if (typeof result === 'undefined') {
        resolverReport.resultUndefined = true;
      }
      // single promise
      else if (typeof result.then === 'function') {
        result.then((res) => {
          finishRun();
          return res;
        }).catch((err) => {
          resolverReport.error = true;
          finishRun();
          throw err;
        });
        // exit early so we do not hit the default return.
        return result;
      }
      // array
      else if (Array.isArray(result)) {
        // collect the promises in the array, if any.
        let promises = [];
        result.forEach((value) => {
          if (value && typeof value.then === 'function') {
            promises.push(value);
          }
        });
        // if there are promises in the array, fire when the are all done.
        if (promises.length > 0) {
          Promise.all(promises).then(() => {
            finishRun();
          }).catch((err) => {
            resolverReport.error = true;
            finishRun();
            throw err;
          });
          // exit early so we do not hit the default return.
          return result;
        }
      } else {
        // primitive type. do nothing special, just default return.
      }

      // default return for non-promise answers
      finishRun();
      return result;
    } catch (e) {
      // safety belt.
      // XXX log here!
      return result;
    }
  };

  // Add .$proxy to support graphql-sequelize.
  // See: https://github.com/mickhansen/graphql-sequelize/blob/edd4266bd55828157240fe5fe4d4381e76f041f8/src/generateIncludes.js#L37-L41
  decoratedResolver.$proxy = fn;

  return decoratedResolver;
};


////////// Schema Wrapping //////////

// Here we take the executable schema object that graphql-js will
// execute against and add wrappings. We add both a per-schema
// wrapping that runs once per query and a per-resolver wrapping that
// runs around every resolver invocation.

export const instrumentSchema = (schema) => {
  if (schema._opticsInstrumented) {
    return schema;
  }
  schema._opticsInstrumented = true;

  // add per field instrumentation
  forEachField(schema, (field, typeName, fieldName) => {
    // If there is no resolver for a field, add the default resolve
    // function (which matches the behavior of graphql-js when there
    // is no explicit resolve function). This way we can instrument
    // it.
    if (!field.resolve) {
      field.resolve = defaultResolveFn;
    }

    field.resolve = decorateField(
      field.resolve,
      { typeName, fieldName }
    );
  });

  // add per query instrumentation
  addSchemaLevelResolveFunction(schema, (root, args, ctx, info) => {
    const opticsContext = ctx.opticsContext;
    if (opticsContext) {
      opticsContext.info = info;
      reportRequestStart(opticsContext);
    }
    return root;
  });

  return schema;
};


////////// Glue //////////


// The graphql `context` object is how we get state into the resolver
// wrappers. For resolver level information gathering to work, the
// user must call `newContext` once per query and place the return
// value in the `opticsContext` field of the graphql-js `context`
// argument.
export const newContext = (req, agent) => {
  let context = req._opticsContext;
  if (!context) {
    // This shouldn't happen. The middleware is supposed to have
    // already added the _opticsContext field.
    context = {};
  };
  context.resolverCalls = [];
  context.agent = agent;
  context.req = req;
  return context;
};


////////// Helpers //////////


// Copied from https://github.com/graphql/graphql-js/blob/v0.7.1/src/execution/execute.js#L1004
function defaultResolveFn(source, args, context, { fieldName }) {
  // ensure source is a value for which property access is acceptable.
  if (typeof source === 'object' || typeof source === 'function') {
    const property = source[fieldName];
    if (typeof property === 'function') {
      return source[fieldName](args, context);
    }
    return property;
  }
}
