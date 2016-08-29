import { printSchema } from 'graphql';
import request from 'request';

import { normalizeQuery, normalizeVersion } from './Normalize';
import {
  Timestamp, Trace, ReportHeader, TracesReport, StatsReport,
  StatsPerSignature, StatsPerClientName
} from './Proto';

var os = require('os');

// XXX where to send reports
const OPTICS_INGRESS_URL = process.env.OPTICS_INGRESS_URL ||
        'https://nim-test-protobuf.appspot.com/';

// buffer to hold reports while we aggregate them.
let pendingResults = {};
let pendingSchema = null;
let reportStartTime = +new Date();
let reportTimer = setInterval(() => sendReport(), 10*1000);

export const reportRequest = (req) => {
  const context = req._opticsContext;
  if (!context || !context.info) {
    // XXX not a graphql query?
    console.log("XXX not a query");
    return;
  }
  const info = context.info;

  // exceptions from here are caught and ignored somewhere.
  // catch manually for debugging.
  try {
    const query = normalizeQuery(info);
    const { client_name, client_version } = normalizeVersion(req);

    let res = pendingResults;
    if (!res[query]) {
      res[query] = {};
    }
    res = res[query];
    if (!res[client_name]) {
      res[client_name] = {};
    }
    res = res[client_name];
    if (!res[client_version]) {
      res[client_version] = {count: 0};
    }
    res[client_version].count += 1;

    // XXX latency and error counts

    // XXX report trace

  } catch (e) {
    console.log("EEE", e);
  }

};

export const reportSchema = (schema) => {
  if (pendingSchema) {
    console.log("XXX reportSchema called more than once.");
  }
  pendingSchema = printSchema(schema);
};

const sendReport = () => {
  // exceptions from here are caught and ignored somewhere.
  // catch manually for debugging.
  try {
    // take the data and reset.
    const reportData = pendingResults;
    const oldStartTime = reportStartTime;
    pendingResults = {};
    reportStartTime = +new Date();

    // build report
    const report = new StatsReport();
    report.header = new ReportHeader({
      auth_token: 'XXX',
      account: 'apollostack',
      service: 'GitHunt-test',
      hostname: os.hostname(),
      agent_version: "optics-agent-js 0.0.2 xxx",
      runtime_version: "node " + process.version,
      // XXX not actually uname, but what node has easily.
      uname: `${os.platform()}, ${os.type()}, ${os.release()}, ${os.arch()})`
    });

    report.start_time = new Timestamp(
      { seconds: (oldStartTime / 1000), nanos: (oldStartTime % 1000)*1e6 });
    report.end_time = new Timestamp(
      { seconds: (reportStartTime / 1000), nanos: (reportStartTime % 1000)*1e6 });

    // XXX what if the have different schemas for different requests?!
    // XXX also, should we send the whole schema each time
    report.schema = pendingSchema;

    report.per_signature = {};
    Object.keys(reportData).forEach((query) => {
      const clients = reportData[query];
      const c = new StatsPerSignature;
      c.per_client_name = {};
      Object.keys(clients).forEach((client) => {
        const versions = clients[client];
        const v = new StatsPerClientName;
        // XXX typo in name field?
        v.count_per_version_version = {};
        Object.keys(versions).forEach((version) => {
          const r = versions[version];
          // XXX latency_counts, error_counts
          v.count_per_version_version[version] = r.count;
        });
        c.per_client_name[client] = v;
      });
      report.per_signature[query] = c;
    });

    const options = {
      url: OPTICS_INGRESS_URL,
      method: 'PUT',
      headers: {
        'user-agent': "optics-agent-js 0.0.2 xxx",
      },
      body: report.encode().toBuffer()
    };
    request(options, (err, res) => {
      if (err) {
        console.error('Error trying to report to optics backend:', err.message);
      }
    });

    // console.log("QQQ", report.encodeJSON());

  } catch (e) {
    console.log("EEE", e);
  }
};
