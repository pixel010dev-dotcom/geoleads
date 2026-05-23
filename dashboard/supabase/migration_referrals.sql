-- Add referral columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_bonus_paid boolean DEFAULT false;

-- Function to add tokens to a user (used by referral bonus)
CREATE OR REPLACE FUNCTION add_tokens(p_user_id uuid, p_amount integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET tokens = COALESCE(tokens, 0) + p_amount WHERE id = p_user_id;
END;
$$;
