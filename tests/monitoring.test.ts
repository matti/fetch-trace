import { fetchTrace } from '../src/fetchTrace';
import http from 'http';
import https from 'https';

describe('monitoring', () => {
  let events1: Record<string, number>;
  let events2: Record<string, number>;

  beforeAll(async () => {
    const agents = {
      http: new http.Agent({ keepAlive: false }),
      https: new https.Agent({ keepAlive: false })
    };

    const getAgent = (url: string) => {
      return new URL(url).protocol === 'https:' ? agents.https : agents.http;
    };

    events1 = {};
    events2 = {};

    await fetchTrace('https://jsonplaceholder.typicode.com/posts/1', {
      agent: getAgent('https://jsonplaceholder.typicode.com/posts/1')
    } as any, {
      on: (event, ms) => {
        events1[event] = ms;
      }
    });

    await fetchTrace('https://jsonplaceholder.typicode.com/posts/2', {
      agent: getAgent('https://jsonplaceholder.typicode.com/posts/2')
    } as any, {
      on: (event, ms) => {
        events2[event] = ms;
      }
    });
  }, 15000);

  it('should emit fresh connection timings for first request', () => {
    expect(events1.dns).toBeGreaterThan(0);
    expect(events1.connect).toBeGreaterThan(0);
    expect(events1.tls).toBeGreaterThan(0);
  });

  it('should emit fresh connection timings for second request', () => {
    expect(events2.dns).toBeGreaterThan(0);
    expect(events2.connect).toBeGreaterThan(0);
    expect(events2.tls).toBeGreaterThan(0);
  });

  it('should have correct timing order for first request', () => {
    expect(events1.dns).toBeLessThan(events1.connect);
    expect(events1.connect).toBeLessThan(events1.tls);
    expect(events1.tls).toBeLessThan(events1.ttfb);
  });

  it('should have correct timing order for second request', () => {
    expect(events2.dns).toBeLessThan(events2.connect);
    expect(events2.connect).toBeLessThan(events2.tls);
    expect(events2.tls).toBeLessThan(events2.ttfb);
  });
});
