-- Migration: Adicionar UNIQUE constraint em payment_history.mp_payment_id
-- Executar no SQL Editor do Supabase

ALTER TABLE payment_history DROP CONSTRAINT IF EXISTS payment_history_mp_payment_id_key;
ALTER TABLE payment_history ADD CONSTRAINT payment_history_mp_payment_id_key UNIQUE (mp_payment_id);
