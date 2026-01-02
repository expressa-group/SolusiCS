import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SearchPayload {
  user_id: string
  query: string
  content_types?: string[]
  limit?: number
}

interface SimilaritySearchResult {
  id: string
  content_type: string
  content_id: string
  content_text: string
  metadata: any
  similarity: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Gemini API key
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Parse request payload
    const payload: SearchPayload = await req.json()
    const { user_id: userId, query, content_types, limit = 5 } = payload

    console.log('RAG Search request:', { userId, query, content_types, limit })

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(geminiApiKey, query, 'RETRIEVAL_QUERY')

    // Perform similarity search
    const { data: searchResults, error: searchError } = await supabase.rpc('similarity_search', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_user_id: userId,
      match_content_types: content_types || null,
      match_count: limit
    })

    if (searchError) {
      console.error('Similarity search error:', searchError)
      throw searchError
    }

    // Filter results by similarity threshold for efficiency
    const SIMILARITY_THRESHOLD = 0.65 // 65% minimum similarity
    const filteredResults = (searchResults || []).filter(result => 
      result.similarity >= SIMILARITY_THRESHOLD
    )

    console.log(`RAG Search: Found ${searchResults?.length || 0} results, ${filteredResults.length} above ${SIMILARITY_THRESHOLD * 100}% threshold`)

    return new Response(
      JSON.stringify({
        success: true,
        results: filteredResults,
        query,
        total_results: filteredResults.length,
        total_found: searchResults?.length || 0,
        similarity_threshold: SIMILARITY_THRESHOLD
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in RAG search:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function generateEmbedding(
  apiKey: string, 
  text: string, 
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }]
        },
        taskType,
        outputDimensionality: 768
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    return data.embedding.values
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw error
  }
}