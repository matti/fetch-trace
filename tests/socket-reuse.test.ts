import { fetchTrace } from '../src/fetchTrace';
import https from 'https';

describe('socket reuse', () => {
  // note: must use different domain than any other test in this file
  it('should reuse socket and not emit dns/connect/tls events for second request', async () => {
    const agent = new https.Agent({ keepAlive: true });
    const events1: Record<string, number> = {};
    const events2: Record<string, number> = {};

    await fetchTrace('https://httpbin.org/get', { agent } as any, {
      on: (event, ms) => {
        events1[event] = ms;
      }
    });

    await fetchTrace('https://httpbin.org/uuid', { agent } as any, {
      on: (event, ms) => {
        events2[event] = ms;
      }
    });

    expect(events1.dns).toBeGreaterThan(0);
    expect(events1.connect).toBeGreaterThan(0);
    expect(events1.tls).toBeGreaterThan(0);

    // Second request should not have dns/connect/tls events at all
    expect(events2.dns).toBeUndefined();
    expect(events2.connect).toBeUndefined();
    expect(events2.tls).toBeUndefined();

    agent.destroy();
  }, 10000);
});
