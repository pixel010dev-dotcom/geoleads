// GeoLeads Proxy Worker — deployado na Cloudflare (grátis)
// Para deploy: copie este arquivo para https://dash.cloudflare.com > Workers & Pages > Criar Worker
// Depois configure CF_WORKER_URL=https://seu-worker.nome.workers.dev no Railway

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');

    // Health check
    if (!target || target === 'health') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'GeoLeads Proxy Worker is running',
        usage: 'Add ?url=https://example.com to proxy',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Validate URL
    try {
      new URL(target);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Only allow Google requests (security)
    const targetHost = new URL(target).hostname.toLowerCase();
    const allowedHosts = [
      'google.com', 'www.google.com', 'google.com.br', 'www.google.com.br',
      'googleapis.com', 'maps.googleapis.com', 'customsearch.googleapis.com',
    ];
    const isAllowed = allowedHosts.some(h => targetHost === h || targetHost.endsWith('.' + h));
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Only Google domains allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    try {
      const response = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.google.com/',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Connection': 'keep-alive',
        },
        redirect: 'follow',
      });

      const contentType = response.headers.get('content-type') || 'text/html';
      const body = await response.text();

      // Check if we got blocked
      const isBlocked = body.toLowerCase().includes('captcha') ||
        body.toLowerCase().includes('sorry') ||
        body.toLowerCase().includes('unusual traffic') ||
        body.toLowerCase().includes('tráfego incomum') ||
        body.toLowerCase().includes('please show you\'re not a robot');

      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
          'X-GeoLeads-Proxy': 'cloudflare',
          'X-GeoLeads-Blocked': isBlocked ? 'true' : 'false',
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};
