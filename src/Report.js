import request from 'request';

import {
  normalizeQuery, normalizeVersion,
  newLatencyBuckets, addLatencyToBuckets
} from './Normalize';

import {
  Timestamp, Trace, ReportHeader, TracesReport, StatsReport,
  StatsPerSignature, StatsPerClientName
} from './Proto';

var os = require('os');

// XXX where to send reports
const OPTICS_INGRESS_URL = process.env.OPTICS_INGRESS_URL ||
        'https://nim-test-protobuf.appspot.com/';


export const reportRequest = (req) => {
  const context = req._opticsContext;
  if (!context || !context.info || !context.agent) {
    // XXX not a graphql query?
    console.log("XXX not a query");
    return;
  }
  const info = context.info;
  const agent = context.agent;

  // exceptions from here are caught and ignored somewhere.
  // catch manually for debugging.
  try {
    const query = normalizeQuery(info);
    const { client_name, client_version } = normalizeVersion(req);

    const res = agent.pendingResults;

    if (!res[query]) {
      res[query] = {
        perClient: {},
        perField: {}
      };
    }
    const perClient = res[query].perClient;
    const perField = res[query].perClient;

    if (!perClient[client_name]) {
      perClient[client_name] = {
        latencyBuckets: newLatencyBuckets(),
        perVersion: {}
      };
    }
    const nanos = (context.durationHrTime[0]*1e9 +
                   context.durationHrTime[1]);
    addLatencyToBuckets(perClient[client_name].latencyBuckets,
                        nanos);

    const perVersion = perClient[client_name].perVersion;
    if (!perVersion[client_version]) {
      perVersion[client_version] = 0;
    }
    perVersion[client_version] += 1;

    // XXX error counts

    // XXX field stats

    // XXX record for traces

  } catch (e) {
    console.log("EEE", e);
  }

};

export const sendReport = (agent, reportData, startTime, endTime) => {
  // exceptions from here are caught and ignored somewhere.
  // catch manually for debugging.
  try {

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
      { seconds: (endTime / 1000), nanos: (endTime % 1000)*1e6 });
    report.end_time = new Timestamp(
      { seconds: (startTime / 1000), nanos: (startTime % 1000)*1e6 });
    // XXX report hr duration??

    report.schema = agent.prettySchema;

    report.per_signature = {};
    Object.keys(reportData).forEach((query) => {
      const clients = reportData[query].perClient;
      const c = new StatsPerSignature;
      c.per_client_name = {};
      Object.keys(clients).forEach((client) => {
        const versions = clients[client].perVersion;
        const v = new StatsPerClientName;
        v.latency_counts = clients[client].latencyBuckets;
        v.count_per_version = {};
        Object.keys(versions).forEach((version) => {
          const r = versions[version];
          // XXX latency_counts, error_counts
          v.count_per_version[version] = r;
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

    console.log("QQQ", report.encodeJSON());

  } catch (e) {
    console.log("EEE", e);
  }
};
