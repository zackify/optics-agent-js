import now from 'performance-now';
import { forEachField, addSchemaLevelResolveFunction } from 'graphql-tools';

import { reportRequest } from './Report';


export const opticsMiddleware = (req, res, next) => {
  const context = {
    startTime: now(),
    oldResEnd: res.end
  };
  req._opticsContext = context;

  res.end = function () {
    context.endTime = now();
    context.oldResEnd.apply(res, arguments);

    // put reporting later in the event loop after I/O, so hopefully we
    // don't impact latency as much.
    setImmediate(reportRequest(req));
  };

  return next();
};



export const decorateField = (fn, info) => {
  const decoratedResolver = (p, a, ctx, i) => {
    const resolverReport = {
      startTime: now(),
      info
    };
    const opticsContext = ctx.opticsContext;
    opticsContext && opticsContext.resolverCalls.push(resolverReport);

    let result;

    try {
      result = fn(p, a, ctx, i);
      resolverReport.endTime = now();
    } catch (e) {
      // console.log('yeah, it errored directly');
      resolverReport.endTime = now();
      resolverReport.error = true;
      throw e;
    }

    try {
      if (result === null) {
        resolverReport.resultNull = true;
        return result;
      }
      if (typeof result === 'undefined') {
        resolverReport.resultUndefined = true;
        return result;
      }
      if (typeof result.then === 'function') {
        result.then((res) => {
          resolverReport.endTime = now();
          return res;
        })
          .catch((err) => {
            // console.log('whoa, it threw an error!');
            resolverReport.endTime = now();
            resolverReport.error = true;
            throw err;
          });
      } else {
        // console.log('did not return a promise. logging now');
      }
      return result;
    } catch (e) {
      // XXX this should basically never happen
      // if it does happen, we want to be able to collect these events.
      resolverReport.opticsError = true;
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
  });

  // add per query instrumentation
  addSchemaLevelResolveFunction(schema, (root, args, ctx, info) => {
    const opticsContext = ctx.opticsContext;
    if (opticsContext) { opticsContext.info = info; }
    return root;
  });

  return schema;
};

export const newContext = (req) => {
  let context = req._opticsContext;
  if (!context) {
    // XXX this should only happen if the middleware isn't installed right.
    context = {};
  };
  context.resolverCalls = [];
  return context;
};
