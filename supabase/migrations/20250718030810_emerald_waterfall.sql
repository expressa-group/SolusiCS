/*
  # Update user business profiles table for pricing and business setup

  1. Changes
    - Add `selected_plan` column to store user's selected pricing plan
    - Add `setup_completed` column to track business setup completion
    - Add `created_at` and `updated_at` triggers for better tracking

  2. Security
    - Maintain existing RLS policies
    - Ensure users can only access their own data
*/

-- Add new columns to user_business_profiles table
DO $$
BEGIN
  -- Add selected_plan column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'selected_plan'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN selected_plan text;
  END IF;

  -- Add setup_completed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'setup_completed'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN setup_completed boolean DEFAULT false;
  END IF;

  -- Add pricing_completed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'pricing_completed'
  ) THEN
    ALTER TABLE user_business_profiles ADD COLUMN pricing_completed boolean DEFAULT false;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_user_id ON user_business_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_selected_plan ON user_business_profiles(selected_plan);