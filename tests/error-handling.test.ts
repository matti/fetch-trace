import { fetchTrace } from '../src/fetchTrace';

describe('error handling', () => {
  it('should reject on DNS lookup failure', async () => {
    const url = 'http://this-domain-absolutely-does-not-exist-12345.invalid';
    await expect(fetchTrace(url)).rejects.toThrow();
  });

  it('should handle timeouts', async () => {
    const start = Date.now();
    await expect(
      fetchTrace('https://httpbin.org/delay/10', { timeout: 1 } as any)
    ).rejects.toThrow(/timed out/);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(9000); // Should timeout quickly (allowing for CI/emulation overhead)
  });
});
