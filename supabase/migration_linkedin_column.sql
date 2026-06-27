-- Adiciona coluna linkedin na tabela crm_leads
ALTER TABLE public.crm_leads ADD COLUMN IF NOT EXISTS linkedin text;
