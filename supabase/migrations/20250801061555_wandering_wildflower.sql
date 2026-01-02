/*
  # Add Midtrans Transaction ID to User Business Profiles

  1. Changes
    - Add `midtrans_transaction_id` column to `user_business_profiles` table
    - This will store the transaction ID from Midtrans for payment tracking

  2. Security
    - No changes to RLS policies needed as this is just adding a column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'midtrans_transaction_id'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN midtrans_transaction_id text;
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_midtrans_transaction_id 
ON user_business_profiles (midtrans_transaction_id) 
WHERE midtrans_transaction_id IS NOT NULL;