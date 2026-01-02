/*
  # Add UNIQUE constraint to whatsapp_users table

  1. Data Cleanup
    - Remove duplicate entries for same user_id and whatsapp_number combination
    - Keep the most recent entry for each combination

  2. Schema Changes
    - Add UNIQUE constraint on (user_id, whatsapp_number) for active records
    - This prevents duplicate WhatsApp numbers for the same business user

  3. Security
    - Maintains existing RLS policies
    - Ensures data integrity at database level

  Important Notes:
  - This migration will fail if duplicate data exists
  - Run the cleanup query first if needed
  - The constraint only applies to active records (is_active = true)
*/

-- Step 1: Clean up duplicate data
-- Keep only the most recent entry for each (user_id, whatsapp_number) combination
WITH duplicates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, whatsapp_number 
      ORDER BY 
        COALESCE(updated_at, created_at) DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) as rn
  FROM whatsapp_users
  WHERE is_active = TRUE
),
to_delete AS (
  SELECT id 
  FROM duplicates 
  WHERE rn > 1
)
UPDATE whatsapp_users 
SET is_active = FALSE 
WHERE id IN (SELECT id FROM to_delete);

-- Step 2: Add partial UNIQUE index for active records
-- This creates a unique constraint only for records where is_active = TRUE
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_users_unique_active 
ON whatsapp_users (user_id, whatsapp_number) 
WHERE is_active = TRUE;

-- Step 3: Add regular index for performance on the combination
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_user_whatsapp 
ON whatsapp_users (user_id, whatsapp_number);

-- Step 4: Add comment to document the constraint
COMMENT ON INDEX idx_whatsapp_users_unique_active IS 
'Ensures unique WhatsApp numbers per user for active records only';