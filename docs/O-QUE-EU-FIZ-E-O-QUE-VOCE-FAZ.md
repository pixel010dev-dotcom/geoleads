# GeoLeads — o que a IA já fez vs o que só você consegue fazer

## Já feito automaticamente no seu PC

- [x] Código PIX + webhook + correção visual da avaliação
- [x] Corrigido `dashboard/.env.local` (estava com duas chaves na mesma linha — isso quebrava pagamento)
- [x] Adicionado `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- [x] Build de produção passando
- [x] Scripts: `scripts/setup-geoleads.ps1` e `scripts/railway-env-template.txt`
- [x] Guia deploy: `docs/DEPLOY-RAILWAY-GEOLEADS.md`

## Só você consegue (precisa login no navegador)

| Passo | Por quê a IA não faz |
|-------|----------------------|
| `railway login` | Abre o navegador na sua conta Google/GitHub |
| DNS geoleads.com | Está no site onde você comprou o domínio |
| Webhook no painel Mercado Pago | Painel da sua conta MP |
| Auth URLs no Supabase | Painel do seu projeto |

## Seu roteiro mínimo (15–30 min)

### A) Testar no PC (5 min)

```powershell
cd C:\Users\Admin\.gemini\antigravity\scratch\lead_extractor_saas\dashboard
npm run dev
```

Abra http://localhost:3000 → criar conta → Planos → testar checkout.

### B) Railway (10 min)

1. Abra PowerShell na pasta do projeto.
2. Digite: `railway login` → entre com sua conta.
3. Digite: `railway link` → escolha o projeto GeoLeads.
4. No site railway.app → seu serviço → **Variables** → copie as variáveis de `scripts/railway-env-template.txt` (use os valores do seu `.env.local`).
5. Deploy: push no GitHub **ou** `railway up` na pasta do projeto.

### C) Mercado Pago (5 min)

1. developers.mercadopago.com → Webhooks.
2. URL: `https://SUA-URL-RAILWAY/api/mercado-pago/webhook`
3. Depois do domínio: troque para `https://geoleads.com/api/mercado-pago/webhook`

### D) Domínio (quando quiser)

1. Railway → Custom Domain → geoleads.com.
2. Registro.br (ou onde comprou) → CNAME apontando pro Railway.
3. Atualize `NEXT_PUBLIC_APP_URL=https://geoleads.com` no Railway.
