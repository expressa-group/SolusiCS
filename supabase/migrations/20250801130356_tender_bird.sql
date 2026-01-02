/*
  # Add user_phone_number column to user_business_profiles table

  1. Schema Changes
    - Add `user_phone_number` column to `user_business_profiles` table
    - Column type: TEXT (nullable)
    - Used for storing user's phone number for Midtrans transactions

  2. Notes
    - This column is optional and can be null
    - Will be used as fallback phone number in payment transactions
    - Fixes the missing column error in create-midtrans-transaction function
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'user_phone_number'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN user_phone_number TEXT;
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_user_phone_number 
ON user_business_profiles (user_phone_number) 
WHERE user_phone_number IS NOT NULL;