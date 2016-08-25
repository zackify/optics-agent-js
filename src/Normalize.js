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
