/*
  # Create embeddings table for RAG system

  1. New Tables
    - `embeddings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `content_type` (text) - 'faq', 'knowledge_base', 'product'
      - `content_id` (uuid) - reference to original content
      - `content_text` (text) - the text that was embedded
      - `embedding` (vector) - the embedding vector
      - `metadata` (jsonb) - additional metadata
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `embeddings` table
    - Add policy for users to manage their own embeddings

  3. Indexes
    - Add vector similarity search index
    - Add indexes for efficient querying
*/

-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create embeddings table
CREATE TABLE IF NOT EXISTS embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('faq', 'knowledge_base', 'product')),
  content_id uuid NOT NULL,
  content_text text NOT NULL,
  embedding vector(768), -- Gemini embedding dimension
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own embeddings"
  ON embeddings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_embeddings_user_id ON embeddings (user_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_type ON embeddings (content_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_id ON embeddings (content_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_embeddings_updated_at
    BEFORE UPDATE ON embeddings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add foreign key constraints
ALTER TABLE embeddings 
ADD CONSTRAINT embeddings_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;