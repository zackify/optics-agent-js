// This file contains helper functions to format or normalize data.

import { GraphQLList, GraphQLNonNull }  from 'graphql/type';
import { separateOperations } from './separateOperations';

import { print } from './normalizedPrinter';



////////// GraphQL //////////

// Take a graphql query object and output the "query shape". See
// https://github.com/apollostack/optics-agent/blob/master/docs/signatures.md
// for details.
export const normalizeQuery = (info) => {
  const doc = {
    kind: 'Document',
    definitions: [
      info.operation,
      ...Object.keys(info.fragments).map(k => info.fragments[k]),
    ]
  };

  const prunedAST = separateOperations(doc)[
    (info.operation.name && info.operation.name.value) || ''];

  return print(prunedAST);
};


// Turn a graphql type into a user-friendly string. eg 'String' or '[Person!]'
export const printType = (type) => {
  if (type instanceof GraphQLList) {
    return '[' + printType(type.ofType) + ']';
  } else if (type instanceof GraphQLNonNull) {
    return printType(type.ofType) + '!';
  }
  return type.name;
};


////////// Client Type //////////

// Takes a Node HTTP Request object (http.IncomingMessage) and returns
// an object with fields `client_name` and `client_version`.
export const normalizeVersion = (req) => {
  // XXX implement
  // https://github.com/apollostack/optics-agent-js/issues/1
  return { client_name: 'none', client_version: 'nope' };
};


////////// Latency Histograms //////////

// Takes a duration in nanoseconds and returns a integer between 0 and
// 255 (inclusive) to be used as an array offset in a list of buckets.
export const latencyBucket = (nanos) => {
  const micros = nanos / 1000;

  const bucket = Math.log(micros) / Math.log(1.1);
  if (bucket <= 0) {
    return 0;
  }
  if (bucket >= 255) {
    return 255;
  }
  return Math.ceil(bucket);
};

// Return 256 zeros. A little ugly, but probably easy for compiler to
// optimize at least.
export const newLatencyBuckets = () => [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
];

// Takes a bucket list returned by `newLatencyBuckets` and a duration
// in nanoseconds and adds 1 to the bucket corresponding to the
// duration.
export const addLatencyToBuckets = (buckets, nanos) => {
  buckets[latencyBucket(nanos)] += 1;
};


// Returns a copy of the latency bucket list suitable for sending to
// the server. Currently this is just trimming trailing zeros but it
// could later be a more compact encoding.
export const trimLatencyBuckets = (buckets) => {
  let max = buckets.length;
  while (max > 0 && buckets[max - 1] == 0) {
    max -= 1;
  }
  return buckets.slice(0, max);
};
