-- Migration: lead_enrichment_cache
-- Cria a tabela de cache para o motor de enriquecimento

CREATE TABLE IF NOT EXISTS lead_enrichment_cache (
  id BIGSERIAL PRIMARY KEY,
  company_name TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  site TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  instagram TEXT NOT NULL DEFAULT '',
  facebook TEXT NOT NULL DEFAULT '',
  tiktok TEXT NOT NULL DEFAULT '',
  cnpj TEXT NOT NULL DEFAULT '',
  telefone TEXT NOT NULL DEFAULT '',
  enriched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_name, city)
);

CREATE INDEX IF NOT EXISTS idx_enrichment_cache_name ON lead_enrichment_cache (company_name);
CREATE INDEX IF NOT EXISTS idx_enrichment_cache_city ON lead_enrichment_cache (city);
