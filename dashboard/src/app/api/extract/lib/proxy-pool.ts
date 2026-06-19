let cachedProxies: string[] = [];
let lastCacheUpdate = 0;

const PROXY_REFRESH_INTERVAL = 5 * 60 * 1000;

function parseProxies(text: string): string[] {
  const proxies: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const ip = parts[0].trim();
      const port = parts[1].trim();
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip) && /^\d+$/.test(port)) {
        const portNum = parseInt(port);
        if (portNum > 0 && portNum < 65536) {
          proxies.push(`http://${ip}:${port}`);
        }
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

async function refreshProxyPool(): Promise<void> {
  try {
    const sources = [
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    ];

    const allLists = await Promise.all(sources.map(fetchProxyList));
    const unique = [...new Set(allLists.flat())];

    const shuffled = unique.sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, 30);

    cachedProxies = sample;
    lastCacheUpdate = Date.now();
  } catch {
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

export function getProxyPoolSize(): number {
  return cachedProxies.length;
}
