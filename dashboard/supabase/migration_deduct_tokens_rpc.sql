-- Migration: RPC functions for atomic token operations
-- 1. deduct_tokens: descontar tokens com saldo minimo garantido
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
    RAISE EXCEPTION 'Saldo insuficiente ou usuario nao encontrado';
  END IF;
END;
$$;

-- 2. credit_tokens_with_history: adicionar tokens + atualizar plano + registrar historico (atomico)
CREATE OR REPLACE FUNCTION credit_tokens_with_history(
  p_user_id UUID,
  p_tokens_to_add INT,
  p_new_plan_id TEXT DEFAULT NULL,
  p_mp_payment_id TEXT DEFAULT NULL,
  p_amount NUMERIC DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET tokens = COALESCE(tokens, 0) + p_tokens_to_add,
      plan_id = COALESCE(p_new_plan_id, plan_id),
      updated_at = NOW()
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario nao encontrado';
  END IF;
  INSERT INTO public.payment_history (user_id, mp_payment_id, amount)
  VALUES (p_user_id, p_mp_payment_id, p_amount);
END;
$$;
