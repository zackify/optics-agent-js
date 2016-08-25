import { normalizeQuery } from './Normalize';
import {
  Timestamp, Trace, ReportHeader, TracesReport, StatsReport
} from './Proto';

var os = require('os');

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

    console.log("AAA", query);

    // build report
    const report = new TracesReport();
    report.header = new ReportHeader({
      auth_token: 'XXX',
      account: 'apollostack',
      service: 'GitHunt-test',
      hostname: os.hostname(),
      agent_version: "optics-agent-js 0.0.2",
      runtime_version: "node " + process.version,
      // XXX not actually uname, but what node has easily.
      uname: `${os.platform()}, ${os.type()}, ${os.release()}, ${os.arch()})`
    });

    const trace = new Trace({
      // XXX client_id
      // XXX server_id
      start_time: new Timestamp({seconds: (context.startWallTime / 1000),
                                 nanos: (context.startWallTime % 1000)*1e6}),
      signature: query,
      details: new Trace.Details({
        raw_query: query // XXX
      }),
    });

    trace.signature = query;
    report.traces = [trace];
    console.log("QQQ", report.encodeJSON());

  } catch (e) {
    console.log("EEE", e);
  }

};
