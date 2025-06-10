import { fetchTrace } from './fetchTrace';
import { URL } from 'url';
import { parseArgs } from 'util';

export const runCli = async () => {
  const { values, positionals } = parseArgs({
    options: {
      timeout: { type: 'string' }
    },
    allowPositionals: true
  });

  let url = positionals[0];
  if (!url) {
    console.error('Usage: fetch-trace <url> [--timeout <ms>]');
    process.exit(1);
  }

  let timeout: number | undefined;
  if (values.timeout) {
    timeout = parseInt(values.timeout, 10);
    if (isNaN(timeout)) {
      console.error('Error: --timeout must be a number');
      process.exit(1);
    }
  }

  if (!url.includes('://')) {
    url = 'http://' + url;
  }

  const commandStartTime = performance.now();
  const getWallTime = () => (performance.now() - commandStartTime).toFixed(2).padStart(8, ' ');

  const MAX_REDIRECTS = 10;
  let currentUrl = url;
  let redirectCount = 0;

  console.log(`${getWallTime()}ms ${currentUrl.replace(/\/$/, '')}\n`);

  while (redirectCount < MAX_REDIRECTS) {
    let currentTimer: NodeJS.Timeout | null = null;
    let lastWallTime = '';

    const showProgress = (event: string) => {
      if (currentTimer) {
        clearInterval(currentTimer);
      }
      process.stdout.write(`${getWallTime()}ms ${event.padStart(7)} `);
      currentTimer = setInterval(() => {
        process.stdout.write('.');
      }, 50);
    };

    showProgress('dns');

    let response;
    try {
      response = await fetchTrace(
        currentUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
          },
          timeout,
        },
        {
          on: (event, ms, error) => {
            if (currentTimer) {
              clearInterval(currentTimer);
              currentTimer = null;
            }
            const wallTime = getWallTime();
            lastWallTime = wallTime;

            if (event === 'error') {
              process.stdout.write(`\r\x1b[K${wallTime}ms ${event.padStart(7)} ${error?.message || 'Network error'} (at ${ms.toFixed(2)} ms)\n`);
              return;
            }

            if (event === 'timeout') {
              process.stdout.write(`\r\x1b[K${wallTime}ms ${event.padStart(7)} Request timed out (at ${ms.toFixed(2)} ms)\n`);
              return;
            }

            process.stdout.write(`\r\x1b[K${wallTime}ms ${event.padStart(7)} ${ms.toFixed(2)} ms\n`);

            if (event === 'dns') {
              showProgress('connect');
            } else if (event === 'connect') {
              if (currentUrl.startsWith('https:')) {
                showProgress('tls');
              } else {
                showProgress('ttfb');
              }
            } else if (event === 'tls') {
              showProgress('ttfb');
            } else if (event === 'ttfb') {
              showProgress('ttlb');
            }
          },
        }
      );
    } catch (error) {
      if (currentTimer) {
        clearInterval(currentTimer);
        currentTimer = null;
      }
      console.log(`\n${'error'.padStart(7)} ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }

    if (currentTimer) {
      clearInterval(currentTimer);
      currentTimer = null;
    }

    const location = response.headers.get('location');
    const isRedirect = response.status >= 300 && response.status < 400 && location;

    if (isRedirect) {
      const nextUrl = new URL(location, currentUrl).toString();
      console.log(`\n${getWallTime()}ms ${nextUrl.replace(/\/$/, '')}\n`);
      currentUrl = nextUrl;
      redirectCount++;
    } else {
      console.log(`\n${'took'.padStart(7)} ${lastWallTime.trim()} ms`);
      console.log(`${'status'.padStart(7)} ${response.status}`);
      const text = await response.text();
      console.log(`${'length'.padStart(7)} ${text.length} bytes`);
      break;
    }
  }

  if (redirectCount >= MAX_REDIRECTS) {
    console.error(`\n${getWallTime()}ms Error: Exceeded max redirects (${MAX_REDIRECTS}).`);
    process.exit(1);
  }
};
