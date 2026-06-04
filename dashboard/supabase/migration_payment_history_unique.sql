-- Adiciona UNIQUE constraint em payment_history(mp_payment_id)
-- Previne duplicatas de webhook (Mercado Pago envia at-least-once)
ALTER TABLE payment_history ADD CONSTRAINT payment_history_mp_payment_id_key UNIQUE (mp_payment_id);
