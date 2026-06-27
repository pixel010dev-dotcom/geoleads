-- Fix: extraction_results RLS muito permissivo
-- Antes: USING(true) permitia qualquer usuario autenticado ler todos os resultados
-- Agora: USING(auth.uid() IS NULL) restringe a service-role apenas

-- SELECT: só service role
DROP POLICY IF EXISTS "extraction_results_select_service" ON public.extraction_results;
CREATE POLICY "extraction_results_select_service"
  ON public.extraction_results FOR SELECT
  USING (auth.uid() IS NULL);

-- INSERT: só service role
DROP POLICY IF EXISTS "extraction_results_insert_service" ON public.extraction_results;
CREATE POLICY "extraction_results_insert_service"
  ON public.extraction_results FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- UPDATE: só service role
DROP POLICY IF EXISTS "extraction_results_update_service" ON public.extraction_results;
CREATE POLICY "extraction_results_update_service"
  ON public.extraction_results FOR UPDATE
  USING (auth.uid() IS NULL);

-- extraction_deliveries: mesmo fix
ALTER TABLE public.extraction_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extraction_deliveries_select_service" ON public.extraction_deliveries;
CREATE POLICY "extraction_deliveries_select_service"
  ON public.extraction_deliveries FOR SELECT
  USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "extraction_deliveries_insert_service" ON public.extraction_deliveries;
CREATE POLICY "extraction_deliveries_insert_service"
  ON public.extraction_deliveries FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

-- token_reservations: mesmo fix
ALTER TABLE public.token_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "token_reservations_select_service" ON public.token_reservations;
CREATE POLICY "token_reservations_select_service"
  ON public.token_reservations FOR SELECT
  USING (auth.uid() IS NULL);

DROP POLICY IF EXISTS "token_reservations_insert_service" ON public.token_reservations;
CREATE POLICY "token_reservations_insert_service"
  ON public.token_reservations FOR INSERT
  WITH CHECK (auth.uid() IS NULL);

DROP POLICY IF EXISTS "token_reservations_update_service" ON public.token_reservations;
CREATE POLICY "token_reservations_update_service"
  ON public.token_reservations FOR UPDATE
  USING (auth.uid() IS NULL);
