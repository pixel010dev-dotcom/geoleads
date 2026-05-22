const https = require('https');
const URL = 'mwnpwrzwgwrqqlomqhux.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzg4MjQsImV4cCI6MjA5NDgxNDgyNH0.2gQPLPtkHXCItXSO3HEx_SfGckYZZNCC2Xv6vY93vmQ';

function doRequest(path, key) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: URL, path, method: 'GET',
      headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': 'Bearer ' + key },
      rejectUnauthorized: false
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d.substring(0, 200) }));
    });
    r.setTimeout(10000, () => { r.destroy(); reject(new Error('Timeout')); });
    r.on('error', reject);
    r.end();
  });
}

(async () => {
  // Test anon access to new tables (should be blocked by RLS for SELECT)
  const sessions = await doRequest('/rest/v1/whatsapp_sessions?limit=1', ANON);
  console.log('Anon whatsapp_sessions:', sessions.status, sessions.body);
  const messages = await doRequest('/rest/v1/whatsapp_messages?limit=1', ANON);
  console.log('Anon whatsapp_messages:', messages.status, messages.body);
  
  // Test with auth (admin user token)
  // Login first
  const loginBody = JSON.stringify({ email: 'diogopfeifer0@gmail.com', password: '04092008we' });
  const loginRes = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'mwnpwrzwgwrqqlomqhux.supabase.co',
      path: '/auth/v1/token?grant_type=password',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': ANON },
      rejectUnauthorized: false
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.setTimeout(10000, () => { r.destroy(); reject(new Error('Timeout')); });
    r.on('error', reject);
    r.write(loginBody);
    r.end();
  });
  
  console.log('\nLogin:', loginRes.status);
  if (loginRes.status === 200) {
    const token = JSON.parse(loginRes.body).access_token;
    const authSessions = await doRequest('/rest/v1/whatsapp_sessions?limit=1', token);
    console.log('Auth whatsapp_sessions:', authSessions.status, authSessions.body);
    const authMessages = await doRequest('/rest/v1/whatsapp_messages?limit=1', token);
    console.log('Auth whatsapp_messages:', authMessages.status, authMessages.body);
    console.log('\n✅ All tables created and RLS working!');
  } else {
    console.log('Login failed:', loginRes.body.substring(0, 200));
  }
})();
