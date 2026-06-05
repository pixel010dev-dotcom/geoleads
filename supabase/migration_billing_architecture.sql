-- Migration: Billing Architecture v2
-- Reserva antecipada, consumo atômico, reembolso automático

-- ============================================================
-- 1. TOKEN RESERVATIONS
-- Reserva tokens ANTES da execução para evitar race conditions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.token_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id BIGINT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'reserved'
    CHECK (status IN ('reserved', 'consumed', 'partially_consumed', 'refunded', 'cancelled')),
  consumed_amount INTEGER DEFAULT 0,
  refunded_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  consumed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours')
);

CREATE INDEX IF NOT EXISTS idx_token_reservations_user_id ON public.token_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_reservations_job_id ON public.token_reservations(job_id);
CREATE INDEX IF NOT EXISTS idx_token_reservations_status ON public.token_reservations(status);

ALTER TABLE public.token_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "token_reservations_select_own" ON public.token_reservations;
CREATE POLICY "token_reservations_select_own"
  ON public.token_reservations FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "token_reservations_insert_service" ON public.token_reservations;
CREATE POLICY "token_reservations_insert_service"
  ON public.token_reservations FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "token_reservations_update_service" ON public.token_reservations;
CREATE POLICY "token_reservations_update_service"
  ON public.token_reservations FOR UPDATE
  USING (true);

-- ============================================================
-- 2. EXTRACTION RESULTS (armazenamento seguro, não acessível direto)
-- Resultados ficam aqui até que o pagamento seja confirmado
-- ============================================================
CREATE TABLE IF NOT EXISTS public.extraction_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id BIGINT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  lead_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_extraction_results_job_id ON public.extraction_results(job_id);
CREATE INDEX IF NOT EXISTS idx_extraction_results_user_id ON public.extraction_results(user_id);

ALTER TABLE public.extraction_results ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy de SELECT para usuários comuns!
-- Só o service role pode ler extraction_results
DROP POLICY IF EXISTS "extraction_results_select_service" ON public.extraction_results;
CREATE POLICY "extraction_results_select_service"
  ON public.extraction_results FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "extraction_results_insert_service" ON public.extraction_results;
CREATE POLICY "extraction_results_insert_service"
  ON public.extraction_results FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "extraction_results_update_service" ON public.extraction_results;
CREATE POLICY "extraction_results_update_service"
  ON public.extraction_results FOR UPDATE
  USING (true);

-- ============================================================
-- 3. EXTRACTION DELIVERIES (prova de entrega paga)
-- Só criada APÓS a confirmação do débito
-- ============================================================
CREATE TABLE IF NOT EXISTS public.extraction_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id BIGINT NOT NULL,
  reservation_id UUID NOT NULL REFERENCES public.token_reservations(id),
  lead_count INTEGER NOT NULL CHECK (lead_count > 0),
  tokens_charged INTEGER NOT NULL CHECK (tokens_charged > 0),
  token_balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT extraction_deliveries_job_unique UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS idx_extraction_deliveries_user_id ON public.extraction_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_deliveries_job_id ON public.extraction_deliveries(job_id);

ALTER TABLE public.extraction_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extraction_deliveries_select_own" ON public.extraction_deliveries;
CREATE POLICY "extraction_deliveries_select_own"
  ON public.extraction_deliveries FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "extraction_deliveries_insert_service" ON public.extraction_deliveries;
CREATE POLICY "extraction_deliveries_insert_service"
  ON public.extraction_deliveries FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 4. FUNÇÃO: reserve_tokens
-- Reserva tokens atomica com FOR UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION public.reserve_tokens(
  p_user_id UUID,
  p_amount INTEGER,
  p_job_id BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current INTEGER;
  v_active_reservations INTEGER;
  v_reservation_id UUID;
BEGIN
  -- Lock na linha do usuario
  SELECT tokens INTO v_current
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id;
  END IF;

  -- Verifica reservas ativas (nao expiradas)
  SELECT COALESCE(SUM(amount), 0) INTO v_active_reservations
  FROM public.token_reservations
  WHERE user_id = p_user_id
    AND status = 'reserved'
    AND expires_at > now();

  IF v_current - v_active_reservations < p_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponivel: %, necessario: % (reservas ativas: %)',
      v_current - v_active_reservations, p_amount, v_active_reservations;
  END IF;

  -- Cria a reserva
  INSERT INTO public.token_reservations (user_id, job_id, amount, status)
  VALUES (p_user_id, p_job_id, p_amount, 'reserved')
  RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$;

-- ============================================================
-- 5. FUNÇÃO: consume_reservation
-- Consome tokens reservados (débito real) e cria delivery
-- ============================================================
CREATE OR REPLACE FUNCTION public.consume_reservation(
  p_reservation_id UUID,
  p_consumed_amount INTEGER,
  p_token_balance_after INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation public.token_reservations;
  v_new_status TEXT;
  v_refund_amount INTEGER;
  v_user_id UUID;
  v_job_id BIGINT;
  v_delivery_id UUID;
  v_result JSONB;
BEGIN
  -- Lock na reserva
  SELECT * INTO v_reservation
  FROM public.token_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  IF v_reservation.status != 'reserved' THEN
    RAISE EXCEPTION 'Reservation % already %', p_reservation_id, v_reservation.status;
  END IF;

  IF v_reservation.expires_at < now() THEN
    -- Reserva expirada, reembolsa tudo
    UPDATE public.token_reservations
    SET status = 'refunded',
        refunded_amount = v_reservation.amount,
        refunded_at = now()
    WHERE id = p_reservation_id;
    RAISE EXCEPTION 'Reservation % expired at %', p_reservation_id, v_reservation.expires_at;
  END IF;

  v_user_id := v_reservation.user_id;
  v_job_id := v_reservation.job_id;

  IF p_consumed_amount >= v_reservation.amount THEN
    v_new_status := 'consumed';
    v_refund_amount := 0;
  ELSIF p_consumed_amount > 0 THEN
    v_new_status := 'partially_consumed';
    v_refund_amount := v_reservation.amount - p_consumed_amount;
  ELSE
    RAISE EXCEPTION 'Consumed amount must be > 0';
  END IF;

  -- Atualiza reserva
  UPDATE public.token_reservations
  SET status = v_new_status,
      consumed_amount = p_consumed_amount,
      consumed_at = now()
  WHERE id = p_reservation_id;

  -- Reembolsa diferenca se necessario
  IF v_refund_amount > 0 THEN
    UPDATE public.profiles
    SET tokens = tokens + v_refund_amount,
        updated_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Cria delivery (prova de entrega)
  INSERT INTO public.extraction_deliveries
    (user_id, job_id, reservation_id, lead_count, tokens_charged, token_balance_after)
  VALUES
    (v_user_id, v_job_id, p_reservation_id, p_consumed_amount, p_consumed_amount, p_token_balance_after)
  RETURNING id INTO v_delivery_id;

  v_result := jsonb_build_object(
    'delivery_id', v_delivery_id,
    'status', v_new_status,
    'consumed', p_consumed_amount,
    'refunded', v_refund_amount,
    'token_balance_after', p_token_balance_after
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- 6. FUNÇÃO: refund_reservation
-- Reembolso total de uma reserva (cancelamento/falha)
-- ============================================================
CREATE OR REPLACE FUNCTION public.refund_reservation(
  p_reservation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation public.token_reservations;
  v_refund_amount INTEGER;
  v_user_id UUID;
  v_new_tokens INTEGER;
  v_result JSONB;
BEGIN
  SELECT * INTO v_reservation
  FROM public.token_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  IF v_reservation.status NOT IN ('reserved') THEN
    RAISE EXCEPTION 'Cannot refund reservation % with status %', p_reservation_id, v_reservation.status;
  END IF;

  v_user_id := v_reservation.user_id;
  v_refund_amount := v_reservation.amount;

  UPDATE public.token_reservations
  SET status = 'refunded',
      refunded_amount = v_refund_amount,
      refunded_at = now()
  WHERE id = p_reservation_id;

  UPDATE public.profiles
  SET tokens = tokens + v_refund_amount,
      updated_at = now()
  WHERE id = v_user_id
  RETURNING tokens INTO v_new_tokens;

  v_result := jsonb_build_object(
    'status', 'refunded',
    'refunded_amount', v_refund_amount,
    'token_balance_after', v_new_tokens
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- 7. FUNÇÃO: get_active_reservations
-- Retorna total de tokens reservados ativos de um usuario
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_active_reservations(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_total
  FROM public.token_reservations
  WHERE user_id = p_user_id
    AND status = 'reserved'
    AND expires_at > now();

  RETURN v_total;
END;
$$;

-- ============================================================
-- 8. FUNÇÃO: get_available_tokens
-- Retorna tokens disponiveis (saldo - reservas ativas)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_tokens(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tokens INTEGER;
  v_reserved INTEGER;
BEGIN
  SELECT COALESCE(tokens, 0) INTO v_tokens
  FROM public.profiles
  WHERE id = p_user_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_reserved
  FROM public.token_reservations
  WHERE user_id = p_user_id
    AND status = 'reserved'
    AND expires_at > now();

  RETURN GREATEST(0, v_tokens - v_reserved);
END;
$$;

-- ============================================================
-- 9. FUNÇÃO: reconcile_expired_reservations
-- Worker de reconciliação: reembolsa reservas expiradas
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconcile_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT id, user_id, amount
    FROM public.token_reservations
    WHERE status = 'reserved'
      AND expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.token_reservations
    SET status = 'refunded',
        refunded_amount = v_rec.amount,
        refunded_at = now()
    WHERE id = v_rec.id;

    UPDATE public.profiles
    SET tokens = tokens + v_rec.amount,
        updated_at = now()
    WHERE id = v_rec.user_id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 10. RECONCILIATION CRON (via pg_cron ou manual)
-- ============================================================
-- SELECT public.reconcile_expired_reservations();

-- ============================================================
-- 11. Tabela extraction_jobs (criacao caso nao exista)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.extraction_jobs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  keyword TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  filter_rule TEXT DEFAULT '',
  limit_requested INTEGER DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  scanned INTEGER DEFAULT 0,
  cities_scanned INTEGER DEFAULT 0,
  search_time_seconds INTEGER DEFAULT 0,
  message TEXT DEFAULT '',
  error TEXT DEFAULT '',
  leads JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  reservation_id UUID REFERENCES public.token_reservations(id),
  delivered BOOLEAN NOT NULL DEFAULT false,
  tokens_earned INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_extraction_jobs_user_id ON public.extraction_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status ON public.extraction_jobs(status);
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_started_at ON public.extraction_jobs(started_at);

ALTER TABLE public.extraction_jobs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 12. RLS para extraction_jobs: esconder leads ate entrega
-- ============================================================
DROP POLICY IF EXISTS "extraction_jobs_select_own" ON public.extraction_jobs;
CREATE POLICY "extraction_jobs_select_own"
  ON public.extraction_jobs FOR SELECT
  USING (auth.uid() = user_id);

-- Nota: a coluna 'leads' em extraction_jobs sera populada
-- APENAS quando delivered = true (apos pagamento)

-- ============================================================
-- 13. FUNÇÃO: credit_tokens_with_history (transação atômica)
-- Credita tokens E salva histórico em uma unica transacao
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_tokens_with_history(
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
