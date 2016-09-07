import request from 'request';
import { visit, visitWithTypeInfo } from 'graphql/language';
import { TypeInfo } from 'graphql/utilities';


import {
  printType, newLatencyBuckets, addLatencyToBuckets
} from './Normalize';

import {
  Timestamp, Trace, ReportHeader, TracesReport, StatsReport,
  StatsPerSignature, StatsPerClientName, FieldStat
} from './Proto';

var os = require('os');

export const reportResolver = (context, info, {typeName, fieldName}, nanos) => {
  const agent = context.agent;
  const query = agent.normalizeQuery(info);
  const res = agent.pendingResults;

  const fObj = res[query] && res[query].perField &&
          res[query].perField[typeName][fieldName];
  if (!fObj) {
    // XXX this can happen when a report is sent out from under us.
    // drop resolver tracing on the floor.
    // console.log("CC1", typeName, fieldName);
    return;
  }
  addLatencyToBuckets(fObj.latencyBuckets, nanos);
};


export const reportRequestStart = (context) => {
  const req = context.req;
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
    const query = agent.normalizeQuery(info);
    const { client_name, client_version } = agent.normalizeVersion(req);

    const res = agent.pendingResults;

    if (!res[query]) {
      res[query] = {
        perClient: {},
        perField: {}
      };
    }

    // fill out per field if we haven't already for this query shape.
    const perField = res[query].perField;
    if (Object.keys(perField).length == 0) {
      const typeInfo = new TypeInfo(agent.schema);
      visit(info.operation, visitWithTypeInfo(typeInfo, {
        Field: () => {
          const parentType = typeInfo.getParentType().name;
          if (!perField[parentType]) {
            perField[parentType] = {};
          }
          const fieldName = typeInfo.getFieldDef().name;
          perField[parentType][fieldName] = {
            returnType: printType(typeInfo.getType()),
            latencyBuckets: newLatencyBuckets()
          };
        }
      }));
    }

    const perClient = res[query].perClient;

    if (!perClient[client_name]) {
      perClient[client_name] = {
        latencyBuckets: newLatencyBuckets(),
        perVersion: {}
      };
    }
  } catch (e) {
    console.log("EEE", e);
  }
};

export const reportRequestEnd = (req) => {
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
    const query = agent.normalizeQuery(info);
    const { client_name, client_version } = agent.normalizeVersion(req);
    const res = agent.pendingResults;

    let clientObj = (
      res[query] && res[query].perClient && res[query].perClient[client_name]);

    // This happens when the report was sent while the query was
    // running. If that happens, just re-init the structure by
    // re-reporting.
    reportRequestStart(context);

    // should be fixed now.
    clientObj = (
      res[query] && res[query].perClient && res[query].perClient[client_name]);

    if (!clientObj) {
      // huh?
      console.log("CC2", query);
      return;
    }

    const nanos = (context.durationHrTime[0]*1e9 +
                   context.durationHrTime[1]);

    // XXX check if first trace for this bucket. if so, send trace.

    addLatencyToBuckets(clientObj.latencyBuckets, nanos);

    const perVersion = clientObj.perVersion;
    if (!perVersion[client_version]) {
      perVersion[client_version] = 0;
    }
    perVersion[client_version] += 1;

    // XXX error counts

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
      auth_token: agent.apiKey || '<not configured>',
      account: 'XXX',
      service: 'XXX',
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
      const c = new StatsPerSignature;

      // add client stats
      c.per_client_name = {};
      const clients = reportData[query].perClient;
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

      // add field stats
      c.stats = [];
      const fields = reportData[query].perField;
      Object.keys(fields).forEach((parentType) => {
        Object.keys(fields[parentType]).forEach((fieldName) => {
          const fs = new FieldStat;
          const fObj = fields[parentType][fieldName];
          fs.type = parentType;
          fs.name = fieldName;
          fs.returnType = fObj.returnType;
          fs.latency_counts = fObj.latencyBuckets;
          c.stats.push(fs);
        });
      });

      report.per_signature[query] = c;
    });

    const options = {
      url: agent.endpointUrl,
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

    if (agent.printReports) {
      console.log("OPTICS", report.encodeJSON());
    }

  } catch (e) {
    console.log("EEE", e);
  }
};
