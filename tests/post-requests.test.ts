import { fetchTrace } from '../src/fetchTrace';

describe('post requests', () => {
  it('should handle POST requests with body', async () => {
    const body = JSON.stringify({ test: 'value', timestamp: Date.now() });
    const response = await fetchTrace('https://httpbin.org/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    } as any);

    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.json.test).toBe('value');
  });
});
