# GeoLeads — Deploy no Railway com geoleads.com

## Variáveis no Railway (serviço `dashboard`)

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=https://geoleads.com
MERCADO_PAGO_ACCESS_TOKEN=
GEMINI_API_KEY=
```

`NEXT_PUBLIC_APP_URL` precisa ser a URL pública final (com HTTPS). O checkout e o webhook do Mercado Pago usam esse valor.

## Mercado Pago

1. Painel Mercado Pago → **Suas integrações** → Webhooks / Notificações.
2. URL de notificação: `https://geoleads.com/api/mercado-pago/webhook`
3. Eventos: pagamentos (`payment.created`, `payment.updated`).
4. Confirme que **PIX** está habilitado na conta do vendedor (Brasil).

No checkout (Checkout Pro), o cliente escolhe **PIX** e vê QR Code + copia e cola na página do Mercado Pago.

## DNS — geoleads.com → Railway

No painel do registrador do domínio (Registro.br, Cloudflare, etc.):

| Tipo  | Nome | Valor |
|-------|------|-------|
| CNAME | `@` ou `www` | URL fornecida pelo Railway (ex.: `xxxx.up.railway.app`) |

No Railway:

1. Abra o serviço → **Settings** → **Networking** → **Custom Domain**.
2. Adicione `geoleads.com` e, se quiser, `www.geoleads.com`.
3. Copie o alvo CNAME que o Railway mostrar e cole no DNS do registrador.
4. Aguarde propagação (minutos a algumas horas).

## SSL

O Railway emite HTTPS automaticamente após o domínio validar.

## Checklist pós-deploy

- [ ] Login Supabase funciona em produção
- [ ] Compra de plano abre Mercado Pago com PIX visível
- [ ] Webhook credita tokens após pagamento aprovado
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configurada (obrigatória para webhook)
