import { assert } from 'chai';

import { normalizeQuery } from './Normalize';


const testQueries = [
  // XXX construct info operations
  // [
    
  // ]
];

describe('normalizeQuery', () => {
  testQueries.map(([info, outString],i) => {
    it(''+i, () =>
       assert.equal(outString, normalizeQuery(info), 'normalize'));
  });
});
