const https = require('https');

function login() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'pixel010dev@gmail.com', password: '04092008we' });
    const opts = {
      hostname: 'mwnpwrzwgwrqqlomqhux.supabase.co',
      path: '/auth/v1/token?grant_type=password',
      method: 'POST',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bnB3cnp3Z3dycXFsb21xaHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMzg4MjQsImV4cCI6MjA5NDgxNDgyNH0.2gQPLPtkHXCItXSO3HEx_SfGckYZZNCC2Xv6vY93vmQ',
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (j.access_token) resolve(j.access_token);
          else reject(new Error('Login failed'));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function extract(token, limit) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ keyword: 'Academia', location: 'Brasil', limit });
    const opts = {
      hostname: 'geoleads-production.up.railway.app',
      path: '/api/extract',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    };
    const req = https.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const token = await login();
  console.log('Token OK. Extraindo com limit=100...');
  console.time('extract');
  const result = await extract(token, 100);
  console.timeEnd('extract');

  console.log('Status:', result.error ? 'ERRO: ' + result.error : 'OK');
  console.log('Stats:', JSON.stringify(result.stats));

  const leads = result.leads || [];
  console.log('Total leads:', leads.length);

  if (leads.length > 0) {
    const cidades = {};
    leads.forEach(l => {
      const e = l.endereco || '';
      const parts = e.split(',');
      const cidade = parts.length >= 2 ? parts[parts.length - 2].trim() : '?';
      cidades[cidade] = (cidades[cidade] || 0) + 1;
    });
    const sorted = Object.entries(cidades).sort((a, b) => b[1] - a[1]);
    console.log('Top 10 cidades:', JSON.stringify(sorted.slice(0, 10)));
    console.log('---');
    leads.slice(0, 5).forEach((l, i) => {
      console.log(`${i + 1}. ${l.nome} | ${l.telefone} | ${(l.endereco || '').slice(0, 60)} | ${l.categoria}`);
    });
  }
}
main().catch(e => console.error('FATAL:', e.message));
