# 🚀 CONTINUAR DESENVOLVIMENTO - Motor de Re-Enriquecimento GeoLeads

## Status: Batch Enrichment Implementado ✅
> Data: 25/06/2026
> Chat salvo para continuar em nova sessão.

### Última sessão (25/06): Implementação do Motor de Re-Enriquecimento Rápido
- Criado endpoint `/api/lead-enrich/batch` com pool de concorrência
- Adicionada barra de progresso com % no EnrichSection
- Otimizado `route.ts` original com cache checking
- Integrado EnrichSection no dashboard (aba CRM)

---

## 📋 RESUMO DO QUE PRECISA SER FEITO

### 1. Motor de Re-Enriquecimento mais Rápido
**Problema atual:** O `lead-enrich/route.ts` processa leads **um por vez** (sequencial). O frontend faz um `for...of` com `await` em cada lead, levando até **10s por lead**. Pra 50 leads, são **~500s**.

**O que fazer:**
- Criar endpoint batch: `POST /api/lead-enrich/batch`
- Processar em paralelo com limite de concorrência (5-10 leads simultâneos)
- Usar `Promise.allSettled` com pool de concorrência
- Reduzir timeout de 10s para 8s por lead

### 2. Barra de Progresso (%) 
**O que fazer:**
- Adicionar progress tracking na UI do `EnrichSection.tsx`
- Barra animada com % e contador (ex: "12/50 leads enriquecidos - 24%")
- Status em tempo real de cada lead (buscando, concluído, erro)

### 3. Otimizações do Motor
- Cache mais agressivo (já existe `lead_enrichment_cache` no Supabase)
- Pular campos já preenchidos (se já tem email, não buscar de novo)
- Merge de website + CNPJ + social em uma única passada assíncrona

### 4. Obsidian - Documentação
- Depois de implementar, jogar tudo no Obsidian e dar uma repaginada

---

## 🧠 CÓDIGO LEVANTADO (ARQUIVOS RELEVANTES)

### 📁 `dashboard/src/app/api/extract/runner.ts` (321 linhas)
**Motor principal de extração** - já está MUITO FORTE.
- Estratégias paralelas com abort inteligente
- Smart fetch: `Promise.race` entre estratégias
- Timeout adaptativo (300ms/lead + 30s base, max 5min)
- Cache em memória com TTL de 24h
- Progress callback: `onProgress`, `onDone`, `shouldCancel`

### 📁 `dashboard/src/app/api/lead-enrich/route.ts` (220 linhas)
**Motor de re-enriquecimento** - precisa ser otimizado!
- Faz 3 coisas em paralelo POR lead:
  1. Website scraping (email + social)
  2. CNPJ via BrasilAPI
  3. Social search (Instagram, Facebook, TikTok via DuckDuckGo)
- Timeout global de 10s
- Cache no Supabase (`lead_enrichment_cache`)
- **Problema:** frontend chama isso 1 lead por vez!

### 📁 `dashboard/src/app/api/extract/enrichment/website.ts` (93 linhas)
**Enriquecimento via scraping de site**
- `fetchHtml()` com timeout 5s
- `enrichLead()` - extrai email, CNPJ, redes sociais do HTML
- Cache em memória (`enrichCache` no `cache.ts`)

### 📁 `dashboard/src/components/dashboard/EnrichSection.tsx` (177 linhas)
**Frontend do re-enriquecimento**
- Tabela com leads que precisam de enrichment
- `enrichAll()` - loop `for...of` sequencial (LENTO!)
- Status por lead (buscando, concluído, erro)
- **Precisa de:** barra de progresso com %

### 📁 `dashboard/src/app/api/extract/lib/types.ts` (100 linhas)
- `SearchLead` interface
- `scoreLeadQuality()` - scoring de qualidade
- `EnrichmentData` - email, cnpj, instagram, facebook, tiktok

### 📁 `dashboard/src/app/api/extract/lib/cache.ts` (50 linhas)
- Cache em memória com Map
- TTL de 24h para query cache
- TTL de 24h para enrich cache

### 📁 `dashboard/src/app/api/extract/lib/validation.ts` (260 linhas)
- `pickEmail()` - extrai email do HTML
- `pickCnpj()` - extrai CNPJ do HTML
- `pickSocialLinks()` - extrai Instagram, Facebook, TikTok
- `applySignalsToLead()` - aplica dados extraídos ao lead
- `normalizePhone()` - normaliza telefone BR

### 📁 `dashboard/src/app/app/dashboard/page.tsx` (~700 linhas)
**Dashboard principal** - contém:
- `handleAddAllToCRM()` (linha ~555) - enriquecimento SEQUENCIAL
- `handleExtract()` - extração principal
- Todo o state management do dashboard

### 📁 `dashboard/src/components/dashboard/ExtractorSection.tsx` (~500 linhas)
- UI de extração (formulário + resultados)
- HackerRadar durante extração
- Tabela de resultados

### 📁 `dashboard/src/app/api/extract/job/[jobId]/route.ts`
- Polling de jobs (GET) e cancelamento (PATCH)

---

## 🎯 PLANO DE IMPLEMENTAÇÃO DETALHADO

### PASSO 1: Batch Enrichment API
**Criar:** `dashboard/src/app/api/lead-enrich/batch/route.ts`

```typescript
// Estrutura sugerida:
POST /api/lead-enrich/batch
Body: { leads: [{ nome, site, cidade, cnpj, email?, instagram?, facebook?, tiktok? }] }
Response: { 
  batchId: string,
  total: number,
  completed: number,
  failed: number,
  percentage: number,
  results: [{ nome, enriched, error? }],
  status: 'running' | 'completed' | 'failed'
}
```

**Lógica:**
1. Recebe array de leads
2. Processa com pool de concorrência (5 simultâneos)
3. Usa `p-limit` ou implementa pool manual
4. Pula campos já preenchidos (se lead já tem email, não busca)
5. Cache checking no Supabase ANTES de fazer requisições
6. Retorna progresso real-time (pode ser polling)

### PASSO 2: Progress Tracking
**Criar tabela Supabase** (opcional - pode ser em memória):
```sql
-- enrichment_batches
id uuid default gen_random_uuid()
user_id uuid
total_leads int
completed_leads int
failed_leads int
status text -- 'running', 'completed', 'failed'
created_at timestamp
completed_at timestamp
```

**Ou**: Usar cache em memória com Map (similar ao `queryCache` em `cache.ts`)

### PASSO 3: Progress Bar UI em EnrichSection.tsx
Adicionar componente de progresso:
```tsx
<div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-full h-3 transition-all duration-500"
  style={{ width: `${percentage}%` }} />
<div className="text-xs text-gray-400 mt-1">
  {completed}/{total} leads enriquecidos ({percentage}%)
</div>
```

### PASSO 4: Atualizar Dashboard Page
No `page.tsx`:
1. Substituir `handleAddAllToCRM` para usar batch enrichment
2. Adicionar estado de progresso
3. Chamar `/api/lead-enrich/batch` e fazer polling do progresso

### PASSO 5: Otimizações Adicionais
- [ ] Adicionar `p-limit` para concorrência controlada
- [ ] Cache de CNPJ no Supabase (`cnpj_companies` já existe)
- [ ] Skip social search se lead já tem Instagram/Facebook/TikTok
- [ ] Reduzir timeout de 10s para 8s

---

## 🔗 DEPENDÊNCIAS DO PROJETO

```
package.json (raiz):
- Next.js (dashboard/)
- Supabase
- Baileys (WhatsApp)
- Recharts (gráficos)
- Papaparse (CSV)
- xlsx (Excel)

Supabase Tables relevantes:
- extraction_jobs
- lead_enrichment_cache
- cnpj_companies
- social_enrichment_cache
- crm_leads
- profiles
```

---

## 📝 NOTAS IMPORTANTES

1. **Já existe** `lead_enrichment_cache` no Supabase - usar antes de chamar APIs
2. **Já existe** `social_enrichment_cache` no Supabase - usar antes de buscar redes sociais
3. **Já existe** `cnpj_companies` no Supabase - usar antes de chamar BrasilAPI
4. O motor de extração (`runner.ts`) está **MUITO OTIMIZADO** - usar como referência
5. O `enrichLead` em `website.ts` já tem cache em memória (`getEnrichCache`/`setEnrichCache`)
6. Arquivo `CODIGO-PARA-IA-DEBUG.md` tem documentação extra do motor

---

## 🚨 BUGS CONHECIDOS

1. Enriquecimento sequencial no dashboard (linha ~581 de page.tsx)
2. `handleAddAllToCRM` faz `for...of` com await - EXTREMAMENTE LENTO
3. `handleReEnrichSingle` e `handleReEnrichSelected` não são usados ativamente
4. OnDone da extração também faz enriquecimento sequencial

---

## ✅ O QUE JÁ FOI FEITO

- [x] Analisado código completo do motor de extração (runner.ts)
- [x] Analisado código do frontend (ExtractorSection, EnrichSection)
- [x] Analisado código de lead-enrich (route.ts)
- [x] Analisado código de website enrichment (website.ts)
- [x] Analisado código de validação e normalização
- [x] Analisado dashboard page (page.tsx)
- [x] Mapeado bugs de performance no re-enriquecimento
- [x] Criado plano de implementação detalhado
- [x] Identificado todas as dependências e tabelas Supabase
- [x] **Criado endpoint batch:** `POST /api/lead-enrich/batch` — processamento paralelo com pool de concorrência (5 simultâneos), verificação de cache no Supabase, timeout 8s por lead, suporte a polling via GET
- [x] **Barra de progresso** no EnrichSection.tsx — porcentagem animada, contador concluídos/falhas/pendentes, polling em tempo real
- [x] **Integrado EnrichSection** no CRM tab do dashboard (renderizado abaixo do CRMSection)
- [x] **Otimizado route.ts original** — cache checking no Supabase ANTES de chamar APIs, condicionais pra pular campos já preenchidos, early return com cache hit
- [x] **Adicionados handlers** `handleReEnrichSingle` e `handleReEnrichSelected` no page.tsx com suporte a batch

---

## 📂 LOCALIZAÇÃO DOS ARQUIVOS

```
C:\Users\Admin\geoleads\
├── dashboard\
│   └── src\
│       ├── app\
│       │   ├── api\
│       │   │   ├── lead-enrich\
│       │   │   │   ├── route.ts              ← Motor de re-enriquecimento
│       │   │   │   └── batch\                ← PASTA CRIADA (precisa do route.ts)
│       │   │   ├── cnpj-enrich\
│       │   │   ├── social-enrich\
│       │   │   └── extract\
│       │   │       ├── route.ts
│       │   │       ├── runner.ts        
