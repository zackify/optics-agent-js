// This file contains the Agent class which is the public-facing API
// for this package.
//
// The Agent holds the configuration and all the in-memory state for
// the server.


import {
  normalizeQuery as defaultNQ, normalizeVersion as defaultNV,
} from './Normalize';

import {
  instrumentHapiServer,
  instrumentSchema,
  newContext,
  opticsMiddleware,
  koaMiddleware,
} from './Instrument';

import {
  reportSchema,
  sendStatsReport,
} from './Report';

export const MIN_REPORT_INTERVAL_MS = 10 * 1000;
export const DEFAULT_REPORT_INTERVAL_MS = 60 * 1000;

export default class Agent {
  constructor(options) {
    // Public options. See README.md for descriptions.
    const {
      apiKey, debugFn, normalizeVersion, normalizeQuery,
      endpointUrl, proxyUrl, reportIntervalMs, printReports,
      reportTraces, reportVariables,
    } = options || {};
    // XXX We don't actually intend for these fields to be part of a public
    //     stable API. https://github.com/apollostack/optics-agent-js/issues/51
    this.apiKey = apiKey || process.env.OPTICS_API_KEY;
    // XXX actually use debugFn
    this.debugFn = debugFn || console.log; // eslint-disable-line no-console

    // Ensure we have an api key. If not, print and disable the agent.
    if (!this.apiKey) {
      this.debugFn(
        'Optics agent disabled: no API key specified. ' +
        'Set the `apiKey` option to `configureAgent` or `new Agent`, ' +
        'or set the `OPTICS_API_KEY` environment variable.',
      );
      this.disabled = true;
      return;
    }
    this.disabled = false;

    this.normalizeVersion = normalizeVersion || defaultNV;
    this.normalizeQuery = normalizeQuery || defaultNQ;
    this.endpointUrl = (endpointUrl || process.env.OPTICS_ENDPOINT_URL ||
                        'https://optics-report.apollodata.com/');
    this.endpointUrl = this.endpointUrl.replace(/\/$/, '');
    this.proxyUrl = proxyUrl || process.env.HTTPS_PROXY;
    this.printReports = !!printReports;
    this.reportTraces = reportTraces !== false;
    this.reportVariables = reportVariables !== false;

    this.reportIntervalMs = reportIntervalMs || DEFAULT_REPORT_INTERVAL_MS;
    if (this.reportIntervalMs < MIN_REPORT_INTERVAL_MS) {
      this.debugFn(
        `Optics: minimum reportInterval is ${MIN_REPORT_INTERVAL_MS}. Setting reportInterval to minimum.`,
      );
      this.reportIntervalMs = MIN_REPORT_INTERVAL_MS;
    }

    // Internal state.

    // Data we've collected so far this report period.
    this.pendingResults = {};
    // The wall clock time for the beginning of the current report period.
    this.reportStartTime = +new Date();
    // The HR clock time for the beginning of the current report
    // period. We record this so we can get an accurate duration for
    // the report even when the wall clock shifts or drifts.
    this.reportStartHrTime = process.hrtime();

    // Interval to send the reports. Per
    // https://github.com/apollostack/optics-agent-js/issues/4 we may
    // want to make this more complicated than just setInterval.
    // XXX there's no way to stop this interval (eg, for tests)
    this.reportTimer = setInterval(() => { this.sendStatsReport(); },
                                   this.reportIntervalMs);
  }

  instrumentSchema(schema) {
    if (this.disabled) {
      return schema;
    }
    this.schema = instrumentSchema(schema, this);
    reportSchema(this, schema);
    return this.schema;
  }

  koaMiddleware() {
    if (this.disabled) {
      return ((_ctx, next) => next());
    }

    return koaMiddleware;
  }

  middleware() {
    if (this.disabled) {
      return ((_req, _res, next) => { next(); });
    }
    return opticsMiddleware;
  }

  instrumentHapiServer(server) {
    if (this.disabled) {
      return;
    }
    instrumentHapiServer(server);
  }

  context(req) {
    if (this.disabled) {
      return {};
    }
    return newContext(req, this);
  }

  // XXX This is not part of the public API.
  //     https://github.com/apollostack/optics-agent-js/issues/51
  sendStatsReport() {
    if (!this.schema) {
      this.debugFn('Optics agent: schema not instrumented. Make sure to call `instrumentSchema`.');
      return;
    }
    // copy current report state and reset pending state for the next
    // report.
    const reportData = this.pendingResults;
    const oldStartTime = this.reportStartTime;
    const durationHr = process.hrtime(this.reportStartHrTime);
    this.reportStartHrTime = process.hrtime();
    this.reportStartTime = +new Date();
    this.pendingResults = {};
    // actually send
    sendStatsReport(this, reportData, oldStartTime, this.reportStartTime, durationHr);
  }
}
