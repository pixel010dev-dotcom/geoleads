# GeoLeads

Next.js 16 SaaS for business lead extraction. Deployed on Railway.

## Commands
- `npm run dev` — dev server
- `npm run build` — production build
- `npx tsc --noEmit` — type check

## Key paths
- `src/app/api/extract/` — extraction engine (runner + 5 strategies)
- `src/app/api/` — 40+ API routes
- `src/lib/` — billing, auth, AI, email, plans
- `src/app/app/dashboard/page.tsx` — main dashboard (~1700 lines)
- `supabase/` — schema + migrations

## Rules
- Zero cost — all external APIs must be free
- Portuguese (pt-BR) UI
- Deploy via git push to origin/main
- Always use `createAdminSupabaseClient()` for server-side (never module-level singletons)
- Always `upsert` with `onConflict` on social_enrichment_cache
