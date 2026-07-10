// GeoLeads WhatsApp WebSocket Proxy Worker — deploy na Cloudflare (grátis)
// Proxy para Baileys conectar ao WhatsApp sem bloqueio de IP do Railway
// wss://web.whatsapp.com + outros endpoints necessários

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Health check
    const isHealth = url.pathname === '/' || url.pathname === '/health';
    if (isHealth && request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response(JSON.stringify({
        status: 'ok',
        message: 'GeoLeads WhatsApp Proxy Worker is running',
        usage: 'Use proxy URL: https://geoleads-wa-proxy.pixel010dev.workers.dev',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Proxy WebSocket e requisições para web.whatsapp.com
    const targetHost = 'web.whatsapp.com';
    const targetUrl = `https://${targetHost}${url.pathname}${url.search}`;

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'manual',
      });

      // Cria resposta com headers que permitem WebSocket upgrade
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
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
