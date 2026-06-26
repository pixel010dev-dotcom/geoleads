-- Migration: Per-user Facebook access tokens
-- Allows each user to authenticate their own Facebook ad account

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS facebook_access_token TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS facebook_ad_account TEXT DEFAULT '';

-- RLS: user can read/write own token only
DROP POLICY IF EXISTS "profiles_select_own_fb_token" ON public.profiles;
CREATE POLICY "profiles_select_own_fb_token"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own_fb_token" ON public.profiles;
CREATE POLICY "profiles_update_own_fb_token"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
