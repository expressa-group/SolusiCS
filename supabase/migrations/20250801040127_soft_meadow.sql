/*
  # Add Tree Structure to Knowledge Base

  1. Schema Changes
    - Add `parent_id` column to `knowledge_base` table
    - Add foreign key constraint for self-referencing relationship
    - Add index for performance optimization

  2. Security
    - Maintain existing RLS policies
    - Ensure tree operations respect user ownership

  3. Performance
    - Add index on parent_id for efficient tree queries
*/

-- Add parent_id column to knowledge_base table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'knowledge_base' AND column_name = 'parent_id'
  ) THEN
    ALTER TABLE knowledge_base ADD COLUMN parent_id uuid;
  END IF;
END $$;

-- Add foreign key constraint for self-referencing relationship
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'knowledge_base_parent_id_fkey'
  ) THEN
    ALTER TABLE knowledge_base 
    ADD CONSTRAINT knowledge_base_parent_id_fkey 
    FOREIGN KEY (parent_id) REFERENCES knowledge_base(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for parent_id for efficient tree queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_knowledge_base_parent_id'
  ) THEN
    CREATE INDEX idx_knowledge_base_parent_id ON knowledge_base(parent_id) WHERE parent_id IS NOT NULL;
  END IF;
END $$;

-- Add index for tree root queries (items without parent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_knowledge_base_root_items'
  ) THEN
    CREATE INDEX idx_knowledge_base_root_items ON knowledge_base(user_id, is_active) WHERE parent_id IS NULL;
  END IF;
END $$;