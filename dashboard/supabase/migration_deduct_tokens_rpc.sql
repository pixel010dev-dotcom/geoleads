-- Migration: RPC functions for atomic token operations
-- 1. deduct_tokens: descontar tokens com saldo mínimo garantido
CREATE OR REPLACE FUNCTION deduct_tokens(p_user_id UUID, p_amount INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET tokens = GREATEST(0, tokens - p_amount)
  WHERE id = p_user_id AND tokens >= p_amount;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saldo insuficiente ou usuário não encontrado';
  END IF;
END;
$$;

-- 2. credit_tokens_with_history: adicionar tokens + registrar histórico (atômico)
CREATE OR REPLACE FUNCTION credit_tokens_with_history(
  p_user_id UUID,
  p_amount INT,
  p_payment_id TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'mercadopago',
  p_description TEXT DEFAULT 'Compra de tokens'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET tokens = tokens + p_amount
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
  INSERT INTO public.payment_history (user_id, amount, payment_id, payment_method, description)
  VALUES (p_user_id, p_amount, p_payment_id, p_payment_method, p_description);
END;
$$;
