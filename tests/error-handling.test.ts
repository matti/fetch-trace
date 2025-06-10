import { fetchTrace } from '../src/fetchTrace';

describe('error handling', () => {
  it('should reject on DNS lookup failure', async () => {
    const url = 'http://this-domain-absolutely-does-not-exist-12345.invalid';
    await expect(fetchTrace(url)).rejects.toThrow();
  });

  it('should handle timeouts', async () => {
    const start = Date.now();

    try {
      await fetchTrace('https://httpbin.org/delay/10', { timeout: 100 });
    } catch (error) {
      const elapsed = Date.now() - start;
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('TimeoutError');
      expect((error as DOMException).message).toBe('The operation was aborted due to timeout');
      expect(elapsed).toBeLessThan(200);
    }
  });

  it('should throw AbortError when signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    try {
      await fetchTrace('https://example.com', { signal: controller.signal });
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('AbortError');
      expect((error as DOMException).message).toBe('This operation was aborted');
    }
  });

  it('should abort request when signal is aborted during request', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    try {
      await fetchTrace('https://httpbin.org/delay/2', { signal: controller.signal });
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('AbortError');
      expect((error as DOMException).message).toBe('This operation was aborted');
    }
  });

  it('should emit timeout and error events correctly', async () => {
    let timeoutEventEmitted = false;
    let errorEventEmitted = false;

    try {
      await fetchTrace('https://httpbin.org/delay/10', { timeout: 100 }, {
        onTimeout: () => {
          timeoutEventEmitted = true;
        },
        onError: () => {
          errorEventEmitted = true;
        }
      });
    } catch (error) {
      expect(error).toBeInstanceOf(DOMException);
      expect((error as DOMException).name).toBe('TimeoutError');
      expect(timeoutEventEmitted).toBe(true);
      expect(errorEventEmitted).toBe(false);
    }
  });
});
