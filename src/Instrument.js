import { forEachField, addSchemaLevelResolveFunction } from 'graphql-tools';

import { reportRequestStart, reportRequestEnd, reportResolver, reportSchema } from './Report';

import { addLatencyToBuckets } from './Normalize';


export const opticsMiddleware = (req, res, next) => {
  const context = {
    startWallTime: +new Date(),
    startHrTime: process.hrtime(),
    oldResEnd: res.end
  };
  req._opticsContext = context;

  res.end = function () {
    context.durationHrTime = process.hrtime(context.startHrTime);
    context.oldResEnd && context.oldResEnd.apply(res, arguments);

    // put reporting later in the event loop after I/O, so hopefully we
    // don't impact latency as much.
    setImmediate(() => { reportRequestEnd(req); });
  };

  return next();
};

export const decorateField = (fn, info) => {
  const decoratedResolver = (p, a, ctx, i) => {
    const opticsContext = ctx.opticsContext;
    const resolverReport = {
      startOffset: process.hrtime(opticsContext.startHrTime),
      info
    };
    opticsContext && opticsContext.resolverCalls.push(resolverReport);

    // Call this when the resolver and all the promisises it returns
    // (if any) are complete.
    const finishRun = () => {
      resolverReport.endOffset = process.hrtime(opticsContext.startHrTime);
      const nanos = (resolverReport.endOffset[0]*1e9 +
                     resolverReport.endOffset[1]) - (
                       resolverReport.startOffset[0]*1e9 +
                         resolverReport.startOffset[1]);

      reportResolver(opticsContext, i, info, nanos);
    };

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
      return result;
    }
  };

  // Add .$proxy to support graphql-sequelize.
  // See: https://github.com/mickhansen/graphql-sequelize/blob/edd4266bd55828157240fe5fe4d4381e76f041f8/src/generateIncludes.js#L37-L41
  decoratedResolver.$proxy = fn;

  return decoratedResolver;
};


export const instrumentSchema = (schema) => {
  if (schema._opticsInstrumented) {
    return schema;
  }
  schema._opticsInstrumented = true;

  // add per field instrumentation
  forEachField(schema, (field, typeName, fieldName) => {
    if (field.resolve) {
      field.resolve = decorateField(
        field.resolve,
        { typeName, fieldName }
      );
    }
    // If we want to record counts for fields without resolvers,
    // here's where we'd do it. See
    // https://github.com/apollostack/optics-agent-js/issues/20.
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

export const newContext = (req, agent) => {
  let context = req._opticsContext;
  if (!context) {
    // XXX this should only happen if the middleware isn't installed right.
    context = {};
  };
  context.resolverCalls = [];
  context.agent = agent;
  context.req = req;
  return context;
};
