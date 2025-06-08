import { fetchTrace } from '../src/fetchTrace';

describe('HTTP vs HTTPS', () => {
  it('should handle HTTP requests and emit timing events (no TLS)', async () => {
    const events: Record<string, number> = {};
    const response = await fetchTrace('http://httpbin.org/get', {}, {
      on: (event, ms) => {
        events[event] = ms;
      }
    });

    expect(response.status).toBe(200);
    expect(events.dns).toBeGreaterThanOrEqual(0);
    expect(events.connect).toBeGreaterThanOrEqual(0);
    expect(events.tls).toBeUndefined(); // No TLS for HTTP
    expect(events.ttfb).toBeGreaterThan(0);
    expect(events.ttlb).toBeGreaterThan(0);
  });

  it('should handle HTTPS requests and emit all timing events including TLS', async () => {
    const events: Record<string, number> = {};
    const response = await fetchTrace('https://httpbin.org/get', {}, {
      on: (event, ms) => {
        events[event] = ms;
      }
    });

    expect(response.status).toBe(200);
    expect(events.dns).toBeGreaterThan(0);
    expect(events.connect).toBeGreaterThan(0);
    expect(events.tls).toBeGreaterThan(0); // TLS should be present for HTTPS
    expect(events.ttfb).toBeGreaterThan(0);
    expect(events.ttlb).toBeGreaterThan(0);
  });
});
