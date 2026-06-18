const TOR_PROXY = process.env.TOR_PROXY_URL || 'socks5://127.0.0.1:9050';
const TOR_ENABLED = process.env.TOR_ENABLED !== 'false';

export function isTorEnabled(): boolean {
  return TOR_ENABLED;
}

export function getTorProxyUrl(): string {
  return TOR_PROXY;
}

export function getPlaywrightProxyConfig(): { server: string } | undefined {
  if (!TOR_ENABLED) return undefined;
  return { server: TOR_PROXY };
}

export async function fetchWithProxy(
  url: string,
  proxyUrl?: string,
  options?: RequestInit
): Promise<Response | null> {
  const proxy = proxyUrl || TOR_PROXY;
  if (!proxy || proxy === 'direct') {
    try {
      return await fetch(url, {
        ...options,
        signal: options?.signal || AbortSignal.timeout(15000),
      });
    } catch {
      return null;
    }
  }

  try {
    const proxyUrl_ = new URL(proxy);
    const isHttpProxy = proxyUrl_.protocol === 'http:' || proxyUrl_.protocol === 'https:';
    const isSocksProxy = proxyUrl_.protocol === 'socks5:' || proxyUrl_.protocol === 'socks5h:';

    if (isSocksProxy || isHttpProxy) {
      return await fetch(url, {
        ...options,
        signal: options?.signal || AbortSignal.timeout(20000),
      });
    }
  } catch {}

  try {
    return await fetch(url, {
      ...options,
      signal: options?.signal || AbortSignal.timeout(15000),
    });
  } catch {
    return null;
  }
}

export async function newTorCircuit(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:9051/control/new-circuit', {
      method: 'POST',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
