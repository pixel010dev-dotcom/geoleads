-- Migration: Create api_keys table for GeoLeads API
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  last_chars TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON public.api_keys(key);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can insert own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update own api keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete own api keys" ON public.api_keys;

CREATE POLICY "Users can view own api keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own api keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own api keys" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own api keys" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);
