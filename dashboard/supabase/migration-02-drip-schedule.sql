-- Migration: Criar tabela drip_schedule para nurture automático
-- Executar no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS drip_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  day INT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_drip_schedule_due ON drip_schedule (sent, scheduled_at);
