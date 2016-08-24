import now from 'performance-now';

import { reportRequest } from './Report';

// internal global state
export const _opticsConfig = {};


export const setupOptics = ({appKey}) => {
  if (_opticsConfig.appKey) {
    console.log("Error: already have an appKey. Did you run setupOptics already?");
    return;
  }
  if (!appKey) {
    console.log("Error: please provide an appKey");
    return;
  }

  _opticsConfig.appKey = appKey;
};


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

export const instrumentSchema = (schema) => {
  console.log("SSS");
  return schema;
};

export const newContext = (req) => {
  return { req };
};
