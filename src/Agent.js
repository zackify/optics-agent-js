import {
  normalizeQuery as defaultNQ, normalizeVersion as defaultNV,
} from './Normalize';

import {
  opticsMiddleware,
  instrumentSchema,
  newContext,
} from './Instrument';

import {
  reportSchema,
  sendReport
} from './Report';

export default class Agent {
  constructor({
    apiKey, debugFn, normalizeVersion, normalizeQuery,
    endpointUrl, reportIntervalMs, printReports, reportTraces
  }) {
    this.apiKey = apiKey || process.env.OPTICS_API_KEY;
    this.debugFn = debugFn || console.log; // XXX actually use me
    this.normalizeVersion = normalizeVersion || defaultNV;
    this.normalizeQuery = normalizeQuery || defaultNQ;
    this.endpointUrl = (endpointUrl || process.env.OPTICS_ENDPOINT_URL ||
                        'https://nim-test-protobuf.appspot.com/');
    this.reportIntervalMs = reportIntervalMs || 60*1000;
    this.printReports = !!printReports;
    this.reportTraces = reportTraces !== false;

    this.pendingResults = {};
    this.pendingSchema = null;
    this.reportStartTime = +new Date();
    this.reportStartHrTime = process.hrtime();
    this.reportTimer = setInterval(() => { this.sendReport() },
                                   this.reportIntervalMs);

  }

  instrumentSchema(schema) {
    this.schema = instrumentSchema(schema, this);
    // wait 10 seconds to report the schema. this does 2 things:
    // - help apps start up and serve users faster. don't clog startup
    //   time with reporting.
    // - avoid sending a ton of reports from a crash-looping server.
    setTimeout(() => reportSchema(this, schema), 10*1000);
    return this.schema;
  }

  middleware() {
    return opticsMiddleware;
  }

  registerHapiExtensions (server) {
    server.ext([
      {
        type: 'onPreHandler',
        method: (request, reply) => {
          const req = request.raw.req;
          const res = {};
          opticsMiddleware(req, res, () => {});
          req._opticsRes = res;
        }
      }, {
        type: 'onPostHandler',
        method: (request, reply) => {
          const req = request.raw.req;
          const res = req._opticsRes;
          if (res && res.end) {
            res.end();
          }
        }
      }]);
  }

  context(req) {
    return newContext(req, this);
  }

  sendReport() {
    const reportData = this.pendingResults;
    const oldStartTime = this.reportStartTime;
    const durationHr = process.hrtime(this.reportStartHrTime);
    this.reportStartHrTime = process.hrtime();
    this.reportStartTime = +new Date();
    this.pendingResults = {};

    sendReport(this, reportData, oldStartTime, this.reportStartTime, durationHr);
  }
};
