-- Adiciona coluna api_keys (JSONB) na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS api_keys JSONB DEFAULT '[]'::jsonb;

-- Cria índice para buscar por chave (performance)
CREATE INDEX IF NOT EXISTS idx_profiles_api_keys ON profiles USING gin (api_keys);
