import { performance } from 'perf_hooks';
import http from 'http';
import https from 'https';
import { URL } from 'url';

interface RequestOptions extends RequestInit {
  timeout?: number;
  agent?: any;
}

type EventType = 'dns' | 'connect' | 'tls' | 'ttfb' | 'ttlb';

interface FetchTraceHooks {
  on?: (event: EventType, ms: number) => void;
  onDns?: (ms: number) => void;
  onConnect?: (ms: number) => void;
  onTls?: (ms: number) => void;
  onTtfb?: (ms: number) => void;
  onTtlb?: (ms: number) => void;
}

const DEFAULT_TIMEOUT_MS = 30000;

const emitTiming = (hooks: FetchTraceHooks | undefined, event: EventType, ms: number) => {
  hooks?.on?.(event, ms);
  switch (event) {
    case 'dns': hooks?.onDns?.(ms); break;
    case 'connect': hooks?.onConnect?.(ms); break;
    case 'tls': hooks?.onTls?.(ms); break;
    case 'ttfb': hooks?.onTtfb?.(ms); break;
    case 'ttlb': hooks?.onTtlb?.(ms); break;
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

  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    let dnsTime = startTime;

    const req = client.request(url, {
      method: init?.method || 'GET',
      timeout: timeoutMs,
      headers: init?.headers as http.OutgoingHttpHeaders,
      agent: init?.agent
    }, (res) => {
      const chunks: Buffer[] = [];
      emitTiming(hooks, 'ttfb', performance.now() - startTime);

      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const endTime = performance.now();
        const response = new Response(Buffer.concat(chunks), {
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers as Record<string, string>,
        });

        emitTiming(hooks, 'ttlb', endTime - startTime);
        resolve(response);
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms`));
    });

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
        emitTiming(hooks, 'dns', dnsTime - startTime);
        emitTiming(hooks, 'connect', performance.now() - startTime);
      });

      socket.on('secureConnect', () => {
        emitTiming(hooks, 'tls', performance.now() - startTime);
      });
    });

    req.on('error', reject);

    if (init?.body) {
      req.write(init.body);
    }
    req.end();
  });
};
