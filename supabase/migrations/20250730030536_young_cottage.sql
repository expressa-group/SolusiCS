/*
  # Create similarity search function for RAG

  This function performs vector similarity search using cosine similarity
  and returns the most relevant documents for a given query embedding.
*/

CREATE OR REPLACE FUNCTION similarity_search(
  query_embedding vector(768),
  match_user_id uuid,
  match_content_types text[] DEFAULT NULL,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content_type text,
  content_id uuid,
  content_text text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.content_type,
    e.content_id,
    e.content_text,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE e.user_id = match_user_id
    AND (match_content_types IS NULL OR e.content_type = ANY(match_content_types))
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;