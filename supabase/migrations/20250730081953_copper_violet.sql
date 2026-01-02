/*
  # Add AI Configuration Settings to Business Profiles

  1. New Columns
    - `auto_response_enabled` (boolean) - Enable/disable automatic AI responses
    - `human_transfer_enabled` (boolean) - Enable/disable transfer to human agents
    - `response_tone` (text) - AI response tone preference
    - `ai_settings` (jsonb) - Additional AI configuration settings

  2. Updates
    - Add default values for existing records
    - Update trigger to handle new columns
*/

-- Add AI configuration columns to user_business_profiles
DO $$
BEGIN
  -- Add auto_response_enabled column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'auto_response_enabled'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN auto_response_enabled boolean DEFAULT true;
  END IF;

  -- Add human_transfer_enabled column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'human_transfer_enabled'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN human_transfer_enabled boolean DEFAULT true;
  END IF;

  -- Add response_tone column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'response_tone'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN response_tone text DEFAULT 'Profesional';
  END IF;

  -- Add ai_settings column for additional configuration
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'ai_settings'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN ai_settings jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add constraint for response_tone values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_business_profiles_response_tone_check'
  ) THEN
    ALTER TABLE user_business_profiles 
    ADD CONSTRAINT user_business_profiles_response_tone_check 
    CHECK (response_tone IN ('Profesional', 'Ramah', 'Santai', 'Formal'));
  END IF;
END $$;

-- Create index for AI settings queries
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_ai_settings 
ON user_business_profiles USING gin (ai_settings);

-- Create index for response tone
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_response_tone 
ON user_business_profiles (response_tone);

-- Update existing records to have default AI settings
UPDATE user_business_profiles 
SET 
  auto_response_enabled = COALESCE(auto_response_enabled, true),
  human_transfer_enabled = COALESCE(human_transfer_enabled, true),
  response_tone = COALESCE(response_tone, 'Profesional'),
  ai_settings = COALESCE(ai_settings, '{}'::jsonb)
WHERE 
  auto_response_enabled IS NULL 
  OR human_transfer_enabled IS NULL 
  OR response_tone IS NULL 
  OR ai_settings IS NULL;