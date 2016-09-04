import { print } from 'graphql/language';


/*
Notes on query signatures:

query Foo {
  user("hello") { n: name }
    ... Baz
}
fragment Bar on User {
  age
}
fragment Baz on User {
  dob
}
=>
query Foo { user("") { name ...Baz } } fragment Baz on User { age }
--- or (config) ---
query Foo { user("hello") { name } } fragment Baz on User { age }

cleanup:
"foo" => ""
1.24  => 0
RED   => RED
*/
export const normalizeQuery = (info) => {
  // XXX implement

  const operation = print(info.operation);
  const fragments = Object.keys(info.fragments).map(k => print(info.fragments[k])).join('\n');
  const fullQuery = `${operation}\n${fragments}`;

  return fullQuery;
};


export const normalizeVersion = (req) => {
  return { client_name: 'none', client_version: 'nope' };
};



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

// XXX ugly. but prob easy for compiler to optimize at least.
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

export const addLatencyToBuckets = (buckets, nanos) => {
  buckets[latencyBucket(nanos)] += 1;
};
