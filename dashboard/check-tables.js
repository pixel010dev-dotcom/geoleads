const https = require('https');
const URL = 'mwnpwrzwgwrqqlomqhux.supabase.co';
const SRV = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTIzODgyNCwiZXhwIjoyMDk0ODE0ODI0fQ.YVZQ3cPMJaPjBnggkEV4SxNeh4Y-PVisP2ST5YF0rl8';

function doRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: URL,
      path,
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json', 'apikey': SRV, 'Authorization': 'Bearer ' + SRV },
      rejectUnauthorized: false
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0, 500) }));
    });
    r.setTimeout(10000, () => { r.destroy(); reject(new Error('Timeout')); });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

(async () => {
  const s = await doRequest('/rest/v1/whatsapp_sessions?limit=1', 'GET');
  console.log('whatsapp_sessions:', s.status, s.body);
  const m = await doRequest('/rest/v1/whatsapp_messages?limit=1', 'GET');
  console.log('whatsapp_messages:', m.status, m.body);
  
  // Try to check the schema of both tables
  const chk = await doRequest('/rest/v1/rpc/', 'POST', {});
  console.log('RPC check:', chk.status, chk.body);
})();
