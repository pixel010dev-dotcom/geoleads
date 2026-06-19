const TOR_ENABLED = process.env.TOR_ENABLED !== 'false';
const TOR_PROXY = process.env.TOR_PROXY_URL || 'socks5://127.0.0.1:9050';

export function isTorEnabled(): boolean {
  return TOR_ENABLED;
}

export function getPlaywrightProxyConfig(): { server: string } | undefined {
  if (!TOR_ENABLED) return undefined;
  return { server: TOR_PROXY };
}
