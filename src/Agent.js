// This file contains the Agent class which is the public-facing API
// for this package.
//
// The Agent holds the configuration and all the in-memory state for
// the server.


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
  constructor(options) {
    // Public options. See README.md for descriptions.
    const {
      apiKey, debugFn, normalizeVersion, normalizeQuery,
      endpointUrl, reportIntervalMs, printReports, reportTraces
    } = options || {};
    this.apiKey = apiKey || process.env.OPTICS_API_KEY;
    this.debugFn = debugFn || console.log; // XXX actually use me
    this.normalizeVersion = normalizeVersion || defaultNV;
    this.normalizeQuery = normalizeQuery || defaultNQ;
    this.endpointUrl = (endpointUrl || process.env.OPTICS_ENDPOINT_URL ||
                        'https://optics-report.apollodata.com/');
    this.endpointUrl = this.endpointUrl.replace(/\/$/, "");
    this.reportIntervalMs = reportIntervalMs || 60*1000;
    this.printReports = !!printReports;
    this.reportTraces = reportTraces !== false;


    // Internal state.

    // Data we've collected so far this report period.
    this.pendingResults = {};
    // XXX unused?!
    this.pendingSchema = null;
    // The wall clock time for the begining of the current report period.
    this.reportStartTime = +new Date();
    // The HR clock time for the begining of the current report
    // period. We record this so we can get an accurate duration for
    // the report even when the wall clock shifts or drifts.
    this.reportStartHrTime = process.hrtime();

    // Interval to send the reports. Per
    // https://github.com/apollostack/optics-agent-js/issues/4 we may
    // want to make this more complicated than just setInterval.
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
    // this code should probably move to Instrument.js
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
  }

  context(req) {
    return newContext(req, this);
  }

  sendReport() {
    // copy current report state and reset pending state for the next
    // report.
    const reportData = this.pendingResults;
    const oldStartTime = this.reportStartTime;
    const durationHr = process.hrtime(this.reportStartHrTime);
    this.reportStartHrTime = process.hrtime();
    this.reportStartTime = +new Date();
    this.pendingResults = {};
    // actually send
    sendReport(this, reportData, oldStartTime, this.reportStartTime, durationHr);
  }
};
