/*
  # Add FonNte Device Token to User Business Profiles

  1. Schema Changes
    - Add `fonnte_device_token` column to `user_business_profiles` table
    - This stores the device-specific token from FonNte API
    - Used for sending WhatsApp messages from the correct authenticated device

  2. Security
    - Column is nullable to handle cases where device is not connected
    - Existing RLS policies will automatically apply to this column

  3. Purpose
    - Enables AI CS webhook to use device-specific tokens for message sending
    - Improves reliability and integration with FonNte WhatsApp Business API
    - Ensures messages are sent from the correct authenticated device
*/

-- Add fonnte_device_token column to user_business_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'fonnte_device_token'
  ) THEN
    ALTER TABLE public.user_business_profiles 
    ADD COLUMN fonnte_device_token text;
    
    -- Add index for performance when querying by device token
    CREATE INDEX IF NOT EXISTS idx_user_business_profiles_fonnte_device_token 
    ON public.user_business_profiles (fonnte_device_token) 
    WHERE fonnte_device_token IS NOT NULL;
  END IF;
END $$;