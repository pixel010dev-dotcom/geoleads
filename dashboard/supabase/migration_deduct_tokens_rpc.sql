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
  p_tokens_to_add INTEGER,
  p_new_plan_id TEXT,
  p_mp_payment_id TEXT,
  p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_tokens INTEGER;
  v_result JSONB;
BEGIN
  -- Lock na linha do usuario
  SELECT tokens INTO v_new_tokens
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  v_new_tokens := COALESCE(v_new_tokens, 0) + p_tokens_to_add;

  -- Atualiza tokens e plano
  UPDATE public.profiles
  SET tokens = v_new_tokens,
      plan_id = p_new_plan_id,
      updated_at = now()
  WHERE id = p_user_id;

  -- Insere historico (mesma transacao)
  INSERT INTO public.payment_history
    (user_id, mp_payment_id, plan_id, tokens_added, amount, status)
  VALUES
    (p_user_id, p_mp_payment_id, p_new_plan_id, p_tokens_to_add, p_amount, 'approved');

  v_result := jsonb_build_object(
    'success', true,
    'new_tokens', v_new_tokens,
    'added_tokens', p_tokens_to_add
  );

  RETURN v_result;
END;
$$;
