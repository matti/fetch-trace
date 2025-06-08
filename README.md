# fetch-trace

HTTP client with detailed timing metrics for Node.js.

## Features

- 🔍 **Detailed timing metrics**: DNS, connect, TLS, TTFB, TTLB
- 📊 **Real-time hooks**: Get timing events as they happen
- 🚀 **Socket reuse detection**: Events not emitted for reused connections
- 🎯 **Fetch-compatible API**: (mostly) drop-in replacement for node-fetch
- 🔧 **TypeScript support**: Full type definitions included
- 🖥️ **CLI tool**: Global command available after installation

## Installation

```bash
# As a library
$ npm install fetch-trace

# As a global CLI tool
$ npm install -g fetch-trace
```

## CLI Usage

```bash
$ fetch-trace http://google.com

    0.51ms http://google.com/

   31.25ms dns    : 30.74 ms
   50.15ms connect: 18.90 ms
   72.45ms ttfb   : 22.30 ms
   73.22ms ttlb   : 0.77 ms

   74.88ms http://www.google.com/

   75.41ms dns    : 0.53 ms
   92.77ms connect: 17.36 ms
  166.66ms ttfb   : 73.89 ms
  182.07ms ttlb   : 15.41 ms

took: 182.07 ms

status: 200
length: 18623 bytes
```

## Quick Start

```typescript
import { fetchTrace } from 'fetch-trace';

const response = await fetchTrace('https://jsonplaceholder.typicode.com/posts/1', {}, {
  on: (event, ms) => console.log(`${event}: ${ms.toFixed(2)} ms`)
});

// Output:
// dns: 23.45 ms
// connect: 89.12 ms
// tls: 156.78 ms
// ttfb: 234.56 ms
// ttlb: 267.89 ms
```

## API

### `fetchTrace(input, init?, hooks?)`

- **input**: `string | URL` - The URL to fetch
- **init**: `RequestOptions` - Standard fetch options (method, headers, body, etc.).
  - **`timeout`**: `number` (optional) - Request timeout in milliseconds. Defaults to 30000 (30 seconds).
  - **`agent`**: `any` (optional) - HTTP agent for connection management.
- **hooks**: `FetchTraceHooks` - Timing event callbacks

#### Timing Events

| Event | Description |
|-------|-------------|
| `dns` | DNS resolution completed (not emitted if socket reused) |
| `connect` | TCP connection established (not emitted if socket reused) |
| `tls` | TLS handshake completed (not emitted if socket reused or HTTP) |
| `ttfb` | Time to first byte of response |
| `ttlb` | Time to last byte of response |

#### Hook Options

```typescript
interface FetchTraceHooks {
  on?: (event: EventType, ms: number) => void;   // Generic handler
  onDns?: (ms: number) => void;                  // DNS-specific (not called if reused)
  onConnect?: (ms: number) => void;              // Connect-specific (not called if reused)
  onTls?: (ms: number) => void;                  // TLS-specific (not called if reused/HTTP)
  onTtfb?: (ms: number) => void;                 // TTFB-specific
  onTtlb?: (ms: number) => void;                 // TTLB-specific
}
```

## Examples

### POST Request

```typescript
const response = await fetchTrace('https://httpbin.org/post', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' })
}, {
  on: (event, ms) => console.log(`${event}: ${ms}ms`)
});
```

### Specific Event Hooks

```typescript
await fetchTrace('https://api.github.com/users/octocat', {}, {
  onDns: (ms) => console.log(`DNS resolved in ${ms}ms`),
  onConnect: (ms) => console.log(`Connected in ${ms}ms`),
  onTls: (ms) => console.log(`TLS handshake in ${ms}ms`),
  onTtfb: (ms) => console.log(`First byte received in ${ms}ms`),
  onTtlb: (ms) => console.log(`Response complete in ${ms}ms`)
});
```

### Collect All Timings

```typescript
const timings: Record<string, number> = {};

await fetchTrace('https://httpbin.org/delay/1', {}, {
  on: (event, ms) => timings[event] = ms
});

console.log('Total time:', timings.ttlb);
console.log('Server processing:', timings.ttfb - timings.tls);
console.log('Download time:', timings.ttlb - timings.ttfb);
```

### Socket Reuse

```typescript
await fetchTrace('https://httpbin.org/get', {}, {
  on: (event, ms) => console.log(`Request 1 - ${event}: ${ms}ms`)
});

await fetchTrace('https://httpbin.org/uuid', {}, {
  on: (event, ms) => console.log(`Request 2 - ${event}: ${ms}ms`)
});
```

## Monitoring Use Cases

For monitoring scenarios where you need **real network timings** on every request (not cached/reused connections), you can force fresh connections by disabling keep-alive:

```typescript
import http from 'http';
import https from 'https';

const agents = {
  http: new http.Agent({ keepAlive: false }),
  https: new https.Agent({ keepAlive: false })
};

const getAgent = (url: string) => {
  return new URL(url).protocol === 'https:' ? agents.https : agents.http;
};

const monitorEndpoint = async (url: string) => {
  await fetchTrace(url, { agent: getAgent(url) }, {
    on: (event, ms) => console.log(`${event}: ${ms}ms`)
  });
};

// Each request will show real DNS/connect times
await monitorEndpoint('https://httpbin.org/status/200');
await monitorEndpoint('https://httpbin.org/status/200'); // Fresh connection again
```

## Requirements

- Node.js >= 18.0.0

## License

MIT
