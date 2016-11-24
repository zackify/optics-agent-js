// This file contains the Agent class which is the public-facing API
// for this package.
//
// The Agent holds the configuration and all the in-memory state for
// the server.

import {
    normalizeQuery as defaultNQ, normalizeVersion as defaultNV,
} from './Normalize';

import {instrumentHapiServer, instrumentSchema, newContext, opticsMiddleware,} from './Instrument';

import {
    reportSchema,
    sendStatsReport,
} from './Report';

import {ClientRequest} from 'http';
import {GraphQLSchema} from "graphql/type/schema";
import {ExecutionContext} from "graphql/execution/execute";

export const MIN_REPORT_INTERVAL_MS = 10 * 1000;
export const DEFAULT_REPORT_INTERVAL_MS = 60 * 1000;

export interface ClientVersion {
    client_name: string,
    client_version: string
}

export interface AgentConfig {
    apiKey: string,
    debugFn?: (message: string) => null,
    normalizeVersion?: (ClientRequest) => ClientVersion,
    normalizeQuery?,
    endpointUrl?: string,
    proxyUrl?: string,
    reportIntervalMs?: number,
    printReports?: boolean,
    reportTraces?: boolean,
    reportVariables?: boolean
}

export default class Agent {
    private disabled: boolean;
    private schema: GraphQLSchema;
    private debugFn: (msg: string) => void;
    private apiKey: string;
    private normalizeVersion: (req: ClientRequest) => ClientVersion;
    private normalizeQuery: (query: ExecutionContext) => string;
    private endpointUrl: string;
    private proxyUrl: string;
    private printReports: boolean;
    private reportTraces: boolean;
    private reportVariables: boolean;
    private reportIntervalMs: number;
    private reportStartTime: number;
    private reportStartHrTime: [number, number];
    private pendingResults;
    private reportTimer;

    constructor(config?: AgentConfig) {
        // XXX We don't actually intend for these fields to be part of a public
        //     stable API. https://github.com/apollostack/optics-agent-js/issues/51
        this.apiKey = config.apiKey || process.env.OPTICS_API_KEY;
        this.debugFn = config.debugFn || console.log;

        // Ensure we have an api key. If not, print and disable the agent.
        if (!this.apiKey) {
            this.debugFn(
                'Optics agent disabled: no API key specified. ' +
                'Set the `apiKey` option to `configureAgent` or `new Agent`, ' +
                'or set the `OPTICS_API_KEY` environment variable.'
            );
            this.disabled = true;
            return;
        }
        this.disabled = false;

        this.normalizeVersion = config.normalizeVersion || defaultNV;
        this.normalizeQuery = config.normalizeQuery || defaultNQ;
        this.endpointUrl = (config.endpointUrl || process.env.OPTICS_ENDPOINT_URL || 'https://optics-report.apollodata.com')
            .replace(/\/$/, '');
        this.proxyUrl = config.proxyUrl || process.env.HTTPS_PROXY;
        this.printReports = config.printReports !== false;
        this.reportTraces = config.reportTraces !== false;
        this.reportVariables = config.reportVariables !== false;

        this.reportIntervalMs = config.reportIntervalMs || DEFAULT_REPORT_INTERVAL_MS;
        if (this.reportIntervalMs < MIN_REPORT_INTERVAL_MS) {
            this.debugFn(
                `Optics: minimum reportInterval is ${MIN_REPORT_INTERVAL_MS}. Setting reportInterval to minimum.`
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
        this.reportTimer = setInterval(() => {
                this.sendStatsReport();
            },
            this.reportIntervalMs);
    }

    instrumentSchema(schema) {
        if (this.disabled) {
            return schema;
        }
        this.schema = instrumentSchema(schema);
        reportSchema(this, schema);
        return this.schema;
    }

    middleware() {
        if (this.disabled) {
            return ((_req, _res, next) => {
                next();
            });
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

    private sendStatsReport() {
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
