/*
  # Add FonNte Integration Support

  1. Database Changes
    - Add FonNte integration columns to user_business_profiles table
    - Add indexes for better performance
    - Update RLS policies if needed

  2. New Columns
    - `fonnte_device_id` (text): Store unique device ID from FonNte
    - `fonnte_status` (text): Store connection status
    - `fonnte_qr_code_url` (text): Store temporary QR code URL
    - `fonnte_connected_at` (timestamp): Track when device was connected
*/

-- Add FonNte integration columns to user_business_profiles
DO $$
BEGIN
  -- Add fonnte_device_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'fonnte_device_id'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN fonnte_device_id text;
  END IF;

  -- Add fonnte_status column with check constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'fonnte_status'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN fonnte_status text DEFAULT 'disconnected';
    ALTER TABLE user_business_profiles ADD CONSTRAINT fonnte_status_check 
      CHECK (fonnte_status IN ('disconnected', 'scanning_qr', 'connected', 'error', 'expired'));
  END IF;

  -- Add fonnte_qr_code_url column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'fonnte_qr_code_url'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN fonnte_qr_code_url text;
  END IF;

  -- Add fonnte_connected_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'fonnte_connected_at'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN fonnte_connected_at timestamptz;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_fonnte_device_id 
  ON user_business_profiles (fonnte_device_id) WHERE fonnte_device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_business_profiles_fonnte_status 
  ON user_business_profiles (fonnte_status);

-- Update existing records to have default status
UPDATE user_business_profiles 
SET fonnte_status = 'disconnected' 
WHERE fonnte_status IS NULL;