import { graphql } from 'graphql';

import {
  normalizeQuery as defaultNQ, normalizeVersion as defaultNV,
} from './Normalize';

import {
  opticsMiddleware,
  instrumentSchema,
  newContext,
} from './Instrument';

import {
  sendReport
} from './Report';

export default class Agent {
  constructor({
    apiKey, debugFn, normalizeVersion, normalizeQuery,
    endpointUrl, reportIntervalMs, printReports
  }) {
    this.apiKey = apiKey || process.env.OPTICS_API_KEY;
    this.debugFn = debugFn || console.log; // XXX actually use me
    this.normalizeVersion = normalizeVersion || defaultNV;
    this.normalizeQuery = normalizeQuery || defaultNQ;
    this.endpointUrl = (endpointUrl || process.env.OPTICS_ENDPOINT_URL ||
                        'https://nim-test-protobuf.appspot.com/');
    this.reportIntervalMs = reportIntervalMs || 60*1000;
    this.printReports = !!printReports;

    this.pendingResults = {};
    this.pendingSchema = null;
    this.reportStartTime = +new Date();
    this.reportTimer = setInterval(() => { this.sendReport() },
                                   this.reportIntervalMs);

  }

  instrumentSchema(schema) {
    this.schema = instrumentSchema(schema, this);

    // modified introspection query that doesn't return something
    // quite so giant.
    const q = `
  query ShorterIntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
      directives {
        name
        # description
        locations
        args {
          ...InputValue
        }
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    # description
    fields(includeDeprecated: true) {
      name
      # description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      # deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      # description
      isDeprecated
      # deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    # description
    type { ...TypeRef }
    # defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }

`;
    graphql(schema, q).then(
      (res) => {
        if (!res || !res.data || !res.data.__schema) {
          // XXX bad result
          console.log("Bad schema result");
          return;
        }
        const resultSchema = res.data.__schema;
        // remove the schema schema from the schema.
        resultSchema.types = resultSchema.types.filter(
          (x) => x && (x.kind != 'OBJECT' || x.name != "__Schema")
        );

        this.prettySchema = JSON.stringify(resultSchema);
      }
    );
    // ).catch(() => {}); // XXX!
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
