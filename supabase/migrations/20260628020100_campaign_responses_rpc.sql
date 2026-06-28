-- Atomic increment for autovendas_campaigns.total_responses (prevent race conditions)
CREATE OR REPLACE FUNCTION increment_campaign_responses(p_campaign_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE autovendas_campaigns
  SET total_responses = COALESCE(total_responses, 0) + 1
  WHERE id = p_campaign_id;
END;
$$;
