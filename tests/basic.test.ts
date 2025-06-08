import { fetchTrace } from '../src/fetchTrace';

describe('basic', () => {
  let response: Response;
  let events: Record<string, number>;
  let responseText: string;

  beforeAll(async () => {
    events = {};
    response = await fetchTrace('https://example.com', {}, {
      on: (event, ms) => {
        events[event] = ms;
      }
    });
    responseText = await response.text();
  });

  it('should return successful response', () => {
    expect(response.status).toBe(200);
  });

  it('should have correct content type', () => {
    expect(response.headers.get('content-type')).toContain('text/html');
  });

  it('should contain expected content', () => {
    expect(responseText).toContain('Example Domain');
  });

  it('should emit timing events in correct order', () => {
    expect(events.dns).toBeLessThan(events.connect);
    expect(events.connect).toBeLessThan(events.tls);
    expect(events.tls).toBeLessThan(events.ttfb);
    expect(events.ttfb).toBeLessThan(events.ttlb);
  });

  it('should emit all expected timing events', () => {
    expect(events.dns).toBeGreaterThan(0);
    expect(events.connect).toBeGreaterThan(0);
    expect(events.tls).toBeGreaterThan(0);
    expect(events.ttfb).toBeGreaterThan(0);
    expect(events.ttlb).toBeGreaterThan(0);
  });
});
