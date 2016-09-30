import { assert } from 'chai';
import gql from 'graphql-tag';

import { normalizeQuery } from './Normalize';


const testQueries = [
  [
    'basic test',
    gql`query Foo {
      user(name: "hello") {
        ... Bar
        tz
        aliased: name
      }
    }
    fragment Baz on User {
      asd
    }
    fragment Bar on User {
      age
      ...Nested
    }
    fragment Nested on User {
      blah
    }`,
    'query Foo{user(name:"") {name tz ...Bar}}fragment Bar on User{age ...Nested}fragment Nested on User{blah}',
  ],
];

describe('normalizeQuery', () => {
  testQueries.map(([testName, inputDocument, outString],i) => {
    it(testName, () => {
      const fragments = {};
      let operation = null;
      inputDocument.definitions.forEach( def => {
        if (def.kind === 'OperationDefinition'){
          operation = def;
        }
        if (def.kind === 'FragmentDefinition'){
          fragments[def.name.value] = def;
        }
      });
      const fakeInfo = {
        operation,
        fragments,
      };
      assert.equal(normalizeQuery(fakeInfo), outString, 'normalize');
    });
  });
});
