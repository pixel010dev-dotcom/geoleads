const PROXY_SOURCES = [
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
  'https://raw.githubusercontent.com/mertguvencli/http-proxy-list/main/proxy-list/data.txt',
  'https://raw.githubusercontent.com/saschazesiger/Free-Proxies/master/proxies.txt',
  'https://raw.githubusercontent.com/romitou/free-proxy-list/main/proxies/all.txt',
];

const PROXY_TEST_URLS = [
  'https://www.google.com',
  'https://www.bing.com',
];

const PROXY_REFRESH_INTERVAL = 5 * 60 * 1000;
const PROXY_TEST_TIMEOUT = 5000;

let cachedProxies: string[] = [];
let lastCacheUpdate = 0;
let currentlyTesting = false;

function parseProxies(text: string): string[] {
  const proxies: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const ip = parts[0].trim();
      const port = parts[1].trim();
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) && /^\d+$/.test(port)) {
        proxies.push(`http://${ip}:${port}`);
      }
    }
  }
  return proxies;
}

async function fetchProxyList(url: string): Promise<string[]> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const text = await res.text();
    return parseProxies(text);
  } catch {
    return [];
  }
}

async function testProxy(proxyUrl: string): Promise<boolean> {
  for (const testUrl of PROXY_TEST_URLS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PROXY_TEST_TIMEOUT);

      const res = await fetch(testUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      clearTimeout(timeout);
      if (res.ok) return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function refreshProxyPool(): Promise<void> {
  if (currentlyTesting) return;
  currentlyTesting = true;

  try {
    const allProxyLists = await Promise.all(PROXY_SOURCES.map(fetchProxyList));
    const uniqueProxies = [...new Set(allProxyLists.flat())];

    const testBatch = uniqueProxies.slice(0, 100);
    const results = await Promise.allSettled(
      testBatch.map(proxy => testProxy(proxy).then(ok => ok ? proxy : null))
    );

    const working: string[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        working.push(result.value);
        if (working.length >= 20) break;
      }
    }

    if (working.length > 0) {
      cachedProxies = working;
    }

    lastCacheUpdate = Date.now();
  } catch {
  } finally {
    currentlyTesting = false;
  }
}

async function ensureProxiesLoaded(): Promise<void> {
  if (cachedProxies.length === 0 || Date.now() - lastCacheUpdate > PROXY_REFRESH_INTERVAL) {
    await refreshProxyPool();
  }
}

export async function getWorkingProxy(): Promise<string | null> {
  await ensureProxiesLoaded();
  if (cachedProxies.length === 0) return null;
  return cachedProxies[Math.floor(Math.random() * cachedProxies.length)];
}

export async function getWorkingProxies(count: number): Promise<string[]> {
  await ensureProxiesLoaded();
  if (cachedProxies.length === 0) return [];
  const shuffled = [...cachedProxies].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

export function getProxyPoolSize(): number {
  return cachedProxies.length;
}

export function clearProxyPool(): void {
  cachedProxies = [];
  lastCacheUpdate = 0;
}
