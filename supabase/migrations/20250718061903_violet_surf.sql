/*
  # Add WhatsApp number to business profiles

  1. Changes
    - Add `whatsapp_number` column to `user_business_profiles` table
    - Column is optional (nullable) to maintain backward compatibility
    - Add index for efficient lookups by WhatsApp number

  2. Security
    - No changes to RLS policies needed as this is just adding a column
*/

-- Add WhatsApp number column to user_business_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN whatsapp_number text;
  END IF;
END $$;

-- Add index for efficient lookups by WhatsApp number
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_whatsapp_number 
ON user_business_profiles (whatsapp_number) 
WHERE whatsapp_number IS NOT NULL;