/*
  # Add AI Response Limits to User Business Profiles

  1. New Columns
    - `ai_responses_count` (integer, default 0)
      - Tracks the number of AI responses used in the current month
    - `ai_responses_last_reset_month` (integer, default current month)
      - Tracks the last month when the counter was reset

  2. Security
    - No additional RLS policies needed as existing policies cover these columns

  3. Changes
    - Add tracking columns for AI response usage limits
    - Enable monthly reset functionality
*/

-- Add AI response tracking columns to user_business_profiles
ALTER TABLE user_business_profiles 
ADD COLUMN IF NOT EXISTS ai_responses_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ai_responses_last_reset_month integer DEFAULT EXTRACT(MONTH FROM NOW());

-- Add index for better performance on ai_responses_count queries
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_ai_responses_count 
ON user_business_profiles (ai_responses_count);

-- Add index for better performance on ai_responses_last_reset_month queries
CREATE INDEX IF NOT EXISTS idx_user_business_profiles_ai_responses_last_reset_month 
ON user_business_profiles (ai_responses_last_reset_month);