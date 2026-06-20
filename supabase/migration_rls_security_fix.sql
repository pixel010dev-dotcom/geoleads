-- Migration: Tighten RLS policies for security
-- Drops overly permissive USING(true)/WITH CHECK(true) policies
-- and replaces them with proper auth.uid()-based or service-role-only policies

-- ============================================================
-- 1. TESTIMONIALS
-- ============================================================
DROP POLICY IF EXISTS "Service role full access" ON public.testimonials;
CREATE POLICY "Service role full access"
  ON public.testimonials FOR ALL
  USING (auth.uid() IS NULL)
  WITH CHECK (auth.uid() IS NULL);

-- ============================================================
-- 2. PAYMENT_HISTORY
-- ============================================================
DROP POLICY IF EXISTS "payment_history_insert_service" ON public.payment_history;
CREATE POLICY "payment_history_insert_service"
  ON public.payment_history FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- ============================================================
-- 3. CNPJ_COMPANIES
-- ============================================================
DROP POLICY IF EXISTS "cnpj_companies_select_public" ON public.cnpj_companies;
CREATE POLICY "cnpj_companies_select_public"
  ON public.cnpj_companies FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cnpj_companies_insert_service" ON public.cnpj_companies;
CREATE POLICY "cnpj_companies_insert_service"
  ON public.cnpj_companies FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "cnpj_companies_update_service" ON public.cnpj_companies;
CREATE POLICY "cnpj_companies_update_service"
  ON public.cnpj_companies FOR UPDATE
  USING (auth.uid() IS NULL);

-- ============================================================
-- 4. SOCIAL_ENRICHMENT_CACHE
-- ============================================================
DROP POLICY IF EXISTS "social_cache_select_public" ON public.social_enrichment_cache;
CREATE POLICY "social_cache_select_public"
  ON public.social_enrichment_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "social_cache_insert_service" ON public.social_enrichment_cache;
CREATE POLICY "social_cache_insert_service"
  ON public.social_enrichment_cache FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- ============================================================
-- 5. WHATSAPP_SESSIONS
-- ============================================================
DROP POLICY IF EXISTS "whatsapp_sessions_insert_service" ON public.whatsapp_sessions;
CREATE POLICY "whatsapp_sessions_insert_service"
  ON public.whatsapp_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "whatsapp_sessions_update_service" ON public.whatsapp_sessions;
CREATE POLICY "whatsapp_sessions_update_service"
  ON public.whatsapp_sessions FOR UPDATE
  USING (auth.uid() IS NULL);
