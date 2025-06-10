import { performance } from 'perf_hooks';
import http from 'http';
import https from 'https';
import { URL } from 'url';

interface RequestOptions extends RequestInit {
  timeout?: number;
  agent?: any;
}

type EventType = 'dns' | 'connect' | 'tls' | 'ttfb' | 'ttlb' | 'timeout' | 'error';

interface FetchTraceHooks {
  on?: (event: EventType, ms: number, error?: Error) => void;
  onDns?: (ms: number) => void;
  onConnect?: (ms: number) => void;
  onTls?: (ms: number) => void;
  onTtfb?: (ms: number) => void;
  onTtlb?: (ms: number) => void;
  onTimeout?: (ms: number) => void;
  onError?: (error: Error) => void;
}

const DEFAULT_TIMEOUT_MS = 30000;

const emitEvent = (hooks: FetchTraceHooks | undefined, event: EventType, ms: number, error?: Error) => {
  hooks?.on?.(event, ms, error);
  switch (event) {
    case 'dns': hooks?.onDns?.(ms); break;
    case 'connect': hooks?.onConnect?.(ms); break;
    case 'tls': hooks?.onTls?.(ms); break;
    case 'ttfb': hooks?.onTtfb?.(ms); break;
    case 'ttlb': hooks?.onTtlb?.(ms); break;
    case 'timeout': hooks?.onTimeout?.(ms); break;
    case 'error': hooks?.onError?.(error!); break;
  }
};

export const fetchTrace = async (
  input: string | URL,
  init?: RequestOptions,
  hooks?: FetchTraceHooks
): Promise<Response> => {
  const url = new URL(input);
  const startTime = performance.now();
  const timeoutMs = init?.timeout ?? DEFAULT_TIMEOUT_MS;
  const signal = init?.signal;

  if (signal?.aborted) {
    throw new DOMException('This operation was aborted', 'AbortError');
  }

  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    let dnsTime = startTime;
    let timeoutId: NodeJS.Timeout | null = null;
    let abortListener: (() => void) | null = null;

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (abortListener && signal) {
        signal.removeEventListener('abort', abortListener);
        abortListener = null;
      }
    };

    const req = client.request(url, {
      method: init?.method || 'GET',
      headers: init?.headers as http.OutgoingHttpHeaders,
      agent: init?.agent
    }, (res) => {
      const chunks: Buffer[] = [];
      emitEvent(hooks, 'ttfb', performance.now() - startTime);

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        cleanup();
        const endTime = performance.now();
        const response = new Response(Buffer.concat(chunks), {
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers as Record<string, string>,
        });

        emitEvent(hooks, 'ttlb', endTime - startTime);
        resolve(response);
      });
    });

    timeoutId = setTimeout(() => {
      cleanup();
      req.destroy();
      emitEvent(hooks, 'timeout', performance.now() - startTime);
      reject(new DOMException('The operation was aborted due to timeout', 'TimeoutError'));
    }, timeoutMs);
    if (signal) {
      abortListener = () => {
        cleanup();
        req.destroy();
        reject(new DOMException('This operation was aborted', 'AbortError'));
      };
      signal.addEventListener('abort', abortListener);
    }

    req.on('socket', (socket) => {
      if (!socket.connecting) {
        // Socket is reused - don't emit dns/connect/tls events at all
        return;
      }

      socket.on('lookup', () => {
        // Update DNS time on each lookup event (captures the last one and flushes in connect)
        dnsTime = performance.now();
      });

      socket.on('connect', () => {
        emitEvent(hooks, 'dns', dnsTime - startTime);
        emitEvent(hooks, 'connect', performance.now() - startTime);
      });

      socket.on('secureConnect', () => {
        emitEvent(hooks, 'tls', performance.now() - startTime);
      });
    });

    req.on('error', (err) => {
      cleanup();
      emitEvent(hooks, 'error', performance.now() - startTime, err);
      reject(err);
    });

    if (init?.body) {
      req.write(init.body);
    }
    req.end();
  });
};
