import { fetchTrace } from './fetchTrace';
import { URL } from 'url';

export const runCli = async () => {
  let url = process.argv[2];
  if (!url) {
    console.error('Usage: fetch-trace <url>');
    process.exit(1);
  }

  // Add http:// if no protocol specified
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

    const response = await fetchTrace(
      currentUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
        },
      },
      {
        on: (event, ms) => {
          if (currentTimer) {
            clearInterval(currentTimer);
            currentTimer = null;
          }
          const wallTime = getWallTime();
          lastWallTime = wallTime;
          process.stdout.write(`\r\x1b[K${wallTime}ms ${event.padStart(7)} ${ms.toFixed(2)} ms\n`);

          if (event === 'dns') {
            showProgress('connect');
          } else if (event === 'connect') {
            showProgress('tls');
          } else if (event === 'tls') {
            showProgress('ttfb');
          } else if (event === 'ttfb') {
            showProgress('ttlb');
          }
        },
      }
    );

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
