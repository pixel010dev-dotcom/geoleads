-- RLS Security Fix Migration
-- Drops overly permissive policies and adds proper DELETE policies

-- Drop overly permissive INSERT policies (service-role bypasses RLS)
DROP POLICY IF EXISTS "payment_history_insert_service" ON public.payment_history;
DROP POLICY IF EXISTS "cnpj_companies_insert_service" ON public.cnpj_companies;
DROP POLICY IF EXISTS "cnpj_companies_update_service" ON public.cnpj_companies;
DROP POLICY IF EXISTS "social_cache_insert_service" ON public.social_enrichment_cache;

-- Fix whatsapp_sessions update policy to restrict to own user_id
DROP POLICY IF EXISTS "Users can update own sessions" ON public.whatsapp_sessions;
CREATE POLICY "Users can update own sessions" ON public.whatsapp_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add DELETE policies for user-owned resources
CREATE POLICY "Users can delete own extraction_jobs" ON public.extraction_jobs
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own extraction_history" ON public.extraction_history
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own enrichment_batches" ON public.enrichment_batches
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own chatbot_conversations" ON public.chatbot_conversations
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own whatsapp_campaigns" ON public.whatsapp_campaigns
  FOR DELETE USING (auth.uid() = user_id);

-- Index on payment_history.user_id if not exists
CREATE INDEX IF NOT EXISTS idx_payment_history_user_id ON public.payment_history (user_id);
