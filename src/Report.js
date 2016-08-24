import { print } from 'graphql/language';

import { Trace, TracesReport, StatsReport } from './Proto.js';

export const reportRequest = (req) => {
  const context = req._opticsContext;

  // get top level query info
  if (!context.info) {
    // XXX not a graphql query?
    console.log("XXX not a query");
    return;
  }
  const info = context.info;

  console.log("AAA");

  // parse out the fields we need
  const operation = print(info.operation);
  const fragments = Object.keys(info.fragments).map(k => print(info.fragments[k])).join('\n');
  const fullQuery = `${operation}\n${fragments}`;

  console.log("BBB", fullQuery);

  // build report
  try {
    const report = new TracesReport();
    const trace = new Trace();

    trace.signature = fullQuery;
    report.traces = [trace];
    console.log("QQQ", report.encodeJSON());
  } catch (e) {
    console.log("EEE", e);
  }


};
