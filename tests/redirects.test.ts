import { fetchTrace } from '../src/fetchTrace';

describe('redirects', () => {
  it('should handle redirects (3xx responses)', async () => {
    const response = await fetchTrace('https://httpbin.org/redirect/1');
    // httpbin redirects don't auto-follow, so we get the redirect response
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBeTruthy();
  });
});
