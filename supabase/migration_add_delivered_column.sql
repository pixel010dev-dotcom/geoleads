-- GeoLeads: Adiciona coluna 'delivered' na tabela extraction_jobs
-- A coluna é usada pelo backend para controlar quando os leads podem ser entregues ao frontend.
-- Migration gerada após diagnóstico: o código tentava setar delivered=true mas a coluna não existia,
-- causando falha silenciosa em todas as tentativas de updateJob e leads nunca sendo entregues.

ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS delivered BOOLEAN DEFAULT FALSE;

-- Refresh schema cache (opcional, dependendo do provedor)
-- No Supabase, va em Database → "Refresh schema cache" ou reinicie o projeto
