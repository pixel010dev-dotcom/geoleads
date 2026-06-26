-- ============================================================
-- Migration: Performance + Security
-- 1. Missing indexes for query performance
-- 2. DELETE policies for tables missing them
-- 3. Extraction history policy fix
-- ============================================================

-- ============================================================
-- 1. PERFORMANCE INDEXES
-- ============================================================

-- crm_leads: user queries plus search/deletion
CREATE INDEX IF NOT EXISTS idx_crm_leads_user_id ON public.crm_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_lead_key ON public.crm_leads(lead_key);
CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads(stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_nome_trgm ON public.crm_leads USING GIN (nome gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_crm_leads_telefone ON public.crm_leads(telefone);

-- extraction_history: common queries
CREATE INDEX IF NOT EXISTS idx_extraction_history_user_id ON public.extraction_history(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_history_status ON public.extraction_history(status);
CREATE INDEX IF NOT EXISTS idx_extraction_history_created_at ON public.extraction_history(created_at DESC);

-- enrichment_batches: lookup by user and status
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_user_id ON public.enrichment_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_status ON public.enrichment_batches(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_batches_started_at ON public.enrichment_batches(started_at DESC);

-- lead_enrichment_cache: lookup by company + city
CREATE INDEX IF NOT EXISTS idx_lead_enrichment_cache_name_city ON public.lead_enrichment_cache(company_name, city);
CREATE INDEX IF NOT EXISTS idx_lead_enrichment_cache_enriched_at ON public.lead_enrichment_cache(enriched_at DESC);

-- chatbot_configs: user lookup
CREATE INDEX IF NOT EXISTS idx_chatbot_configs_user_id ON public.chatbot_configs(user_id);

-- payment_history: user queries
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created_at ON public.payment_history(created_at DESC);

-- whatsapp_sessions: user_id is already PK

-- ============================================================
-- 2. MISSING RLS DELETE POLICIES
-- ============================================================

-- extraction_history
DROP POLICY IF EXISTS "Users can delete own extraction_history" ON public.extraction_history;
CREATE POLICY "Users can delete own extraction_history"
  ON public.extraction_history FOR DELETE
  USING (auth.uid() = user_id);

-- enrichment_batches
DROP POLICY IF EXISTS "Users can delete own enrichment_batches" ON public.enrichment_batches;
CREATE POLICY "Users can delete own enrichment_batches"
  ON public.enrichment_batches FOR DELETE
  USING (auth.uid() = user_id);

-- extraction_jobs
DROP POLICY IF EXISTS "Users can delete own extraction_jobs" ON public.extraction_jobs;
CREATE POLICY "Users can delete own extraction_jobs"
  ON public.extraction_jobs FOR DELETE
  USING (auth.uid() = user_id);

-- extraction_results
DROP POLICY IF EXISTS "extraction_results_delete_own" ON public.extraction_results;
CREATE POLICY "extraction_results_delete_own"
  ON public.extraction_results FOR DELETE
  USING (auth.uid() = user_id);

-- extraction_deliveries
DROP POLICY IF EXISTS "extraction_deliveries_delete_own" ON public.extraction_deliveries;
CREATE POLICY "extraction_deliveries_delete_own"
  ON public.extraction_deliveries FOR DELETE
  USING (auth.uid() = user_id);

-- token_reservations
DROP POLICY IF EXISTS "token_reservations_delete_own" ON public.token_reservations;
CREATE POLICY "token_reservations_delete_own"
  ON public.token_reservations FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- 3. FIX: payment_history INSERT policy (remove permissive)
-- ============================================================
DROP POLICY IF EXISTS "payment_history_insert_service" ON public.payment_history;
CREATE POLICY "payment_history_insert_service"
  ON public.payment_history FOR INSERT
  WITH CHECK ((SELECT auth.role() = 'service_role'));

-- ============================================================
-- 4. FIX: whatsapp_sessions UPDATE policy (was permissive)
-- ============================================================
DROP POLICY IF EXISTS "whatsapp_sessions_update_service" ON public.whatsapp_sessions;
CREATE POLICY "whatsapp_sessions_update_service"
  ON public.whatsapp_sessions FOR UPDATE
  USING ((SELECT auth.role() = 'service_role'));

-- ============================================================
-- 5. FIX: cnpj_companies INSERT/UPDATE policies
-- ============================================================
DROP POLICY IF EXISTS "cnpj_companies_insert_service" ON public.cnpj_companies;
CREATE POLICY "cnpj_companies_insert_service"
  ON public.cnpj_companies FOR INSERT
  WITH CHECK ((SELECT auth.role() = 'service_role'));

DROP POLICY IF EXISTS "cnpj_companies_update_service" ON public.cnpj_companies;
CREATE POLICY "cnpj_companies_update_service"
  ON public.cnpj_companies FOR UPDATE
  USING ((SELECT auth.role() = 'service_role'));

-- ============================================================
-- 6. FIX: social_enrichment_cache INSERT/UPDATE policies
-- ============================================================
DROP POLICY IF EXISTS "social_cache_insert_service" ON public.social_enrichment_cache;
CREATE POLICY "social_cache_insert_service"
  ON public.social_enrichment_cache FOR INSERT
  WITH CHECK ((SELECT auth.role() = 'service_role'));
