import { StatsReport } from './Proto';

// Very minimal test to validate that the protobuf parses.
describe('proto', () => {
  it('can make and encode a StatsReport', () => {
    const report = new StatsReport();
    report.encode();  // does not throw
  });
});
