const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 12; M2101K6G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.6422.72 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 OPR/111.0.0.0',
];

const VIEWPORT_PRESETS = [
  { width: 1920, height: 1080 }, { width: 1366, height: 768 },
  { width: 1536, height: 864 }, { width: 1440, height: 900 },
  { width: 1680, height: 1050 }, { width: 1600, height: 900 },
  { width: 1280, height: 720 }, { width: 1920, height: 1200 },
];

const TIMEZONE_PRESETS = [
  'America/Sao_Paulo', 'America/New_York', 'America/Chicago',
  'America/Los_Angeles', 'America/Denver', 'Europe/London',
  'Europe/Lisbon', 'Europe/Madrid', 'America/Mexico_City',
  'America/Argentina/Buenos_Aires', 'America/Santiago',
];

const LOCALE_PRESETS = ['pt-BR', 'pt-PT', 'en-US', 'es-ES', 'es-AR'];

const GEOLOCATION_PRESETS = [
  { lat: -23.5505, lng: -46.6333 },
  { lat: -22.9068, lng: -43.1729 },
  { lat: -19.9167, lng: -43.9345 },
  { lat: -15.7939, lng: -47.8828 },
  { lat: -12.9714, lng: -38.5014 },
  { lat: -3.7172, lng: -38.5433 },
  { lat: -25.4284, lng: -49.2733 },
  { lat: -30.0346, lng: -51.2177 },
  { lat: 40.7128, lng: -74.0060 },
  { lat: 51.5074, lng: -0.1278 },
  { lat: 48.8566, lng: 2.3522 },
  { lat: -34.6037, lng: -58.3816 },
];

export function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

export function getRandomViewport(): { width: number; height: number } {
  return VIEWPORT_PRESETS[Math.floor(Math.random() * VIEWPORT_PRESETS.length)];
}

export function getRandomTimezone(): string {
  return TIMEZONE_PRESETS[Math.floor(Math.random() * TIMEZONE_PRESETS.length)];
}

export function getRandomLocale(): string {
  return LOCALE_PRESETS[Math.floor(Math.random() * LOCALE_PRESETS.length)];
}

export function getRandomGeolocation(): { latitude: number; longitude: number } {
  const preset = GEOLOCATION_PRESETS[Math.floor(Math.random() * GEOLOCATION_PRESETS.length)];
  return {
    latitude: preset.lat + (Math.random() - 0.5) * 0.02,
    longitude: preset.lng + (Math.random() - 0.5) * 0.02,
  };
}

export function getRandomHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'https://www.google.com/',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Sec-CH-UA': '"Google Chrome";v="125", "Chromium";v="125", "Not=A?Brand";v="24"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
  };
  return headers;
}

export function getHumanDelay(): number {
  return 800 + Math.random() * 2200;
}

export function getGaussianDelay(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return Math.max(100, mean + z * stdDev);
}

export function getBrowserFingerprint() {
  return {
    viewport: getRandomViewport(),
    timezone: getRandomTimezone(),
    locale: getRandomLocale(),
    geolocation: getRandomGeolocation(),
    userAgent: getRandomUserAgent(),
  };
}

export async function simulateHumanScroll(page: any) {
  await page.evaluate(() => {
    const feed = document.querySelector('div[role="feed"]') as HTMLElement | null;
    if (!feed) return;
    const start = Date.now();
    const duration = 1000 + Math.random() * 1000;
    const startScroll = feed.scrollTop;
    const targetScroll = startScroll + 600 + Math.random() * 800;
    function easeInOutQuad(t: number): number {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    function step() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutQuad(progress);
      if (feed) (feed as HTMLElement).scrollTop = startScroll + (targetScroll - startScroll) * easedProgress;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

export function withMapsLocale(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    if (url.hostname.includes('google.')) {
      url.searchParams.set('hl', 'pt-BR');
      url.searchParams.set('gl', 'br');
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export const GOOGLE_CONSENT_COOKIE = {
  name: 'CONSENT',
  value: 'YES+cb.20250522-13-p0.en+FX+937',
  domain: '.google.com',
  path: '/',
};

export const GOOGLE_SOCS_COOKIE = {
  name: 'SOCS',
  value: 'CAISHAgENhB0Dcm9sZQ==',
  domain: '.google.com',
  path: '/',
};
