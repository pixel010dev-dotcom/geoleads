-- Migration: Create testimonials/feedback table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS testimonials (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL DEFAULT 'Usuário',
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  role TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (for feedback form)
CREATE POLICY "Anyone can insert testimonials"
  ON testimonials FOR INSERT
  WITH CHECK (true);

-- Only authenticated users can see their own
CREATE POLICY "Users can view own testimonials"
  ON testimonials FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can see all (admin)
CREATE POLICY "Service role full access"
  ON testimonials FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow anon to read approved testimonials only (for landing page)
CREATE POLICY "Public can read approved testimonials"
  ON testimonials FOR SELECT
  USING (approved = true);
