import { printSchema } from 'graphql/utilities';

import {
  opticsMiddleware,
  instrumentSchema,
  newContext,
} from './Instrument';

import {
  sendReport
} from './Report';

export default class Agent {
  constructor({appKey, reportInterval}) {
    this.appKey = appKey;
    reportInterval = reportInterval || 60*1000;

    this.pendingResults = {};
    this.pendingSchema = null;
    this.reportStartTime = +new Date();
    this.reportTimer = setInterval(() => { this.sendReport() }, reportInterval);

  }

  instrumentSchema(schema) {
    this.schema = instrumentSchema(schema, this);
    this.prettySchema = printSchema(schema);
    return this.schema;
  }

  middleware() {
    return opticsMiddleware;
  }

  context(req) {
    return newContext(req, this);
  }

  sendReport() {
    const reportData = this.pendingResults;
    const oldStartTime = this.reportStartTime;
    this.pendingResults = {};
    this.reportStartTime = +new Date();

    sendReport(this, reportData, oldStartTime, this.reportStartTime);
  }
};
