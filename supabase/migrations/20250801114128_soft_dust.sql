/*
  # Enable Vector Extension for RAG

  1. Extensions
    - Enable pgvector extension for similarity search
    
  2. Vector Operations
    - Support for embedding storage and similarity search
*/

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure embeddings table has proper vector column
DO $$
BEGIN
  -- Check if embedding column exists and has correct type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'embeddings' 
    AND column_name = 'embedding' 
    AND data_type = 'USER-DEFINED'
  ) THEN
    -- Add or modify embedding column
    ALTER TABLE embeddings 
    ALTER COLUMN embedding TYPE vector(768) USING embedding::vector(768);
  END IF;
END $$;

-- Create or update the vector index for better performance
DROP INDEX IF EXISTS idx_embeddings_vector;
CREATE INDEX idx_embeddings_vector 
ON embeddings 
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);