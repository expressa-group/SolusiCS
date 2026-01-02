import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestPayload {
  user_id: string
  message: string
}

interface SimilaritySearchResult {
  id: string
  content_type: string
  content_id: string
  content_text: string
  metadata: any
  similarity: number
}

interface BusinessProfile {
  business_name: string
  description: string
  industry: string
  operating_hours: string
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
      console.error('GEMINI_API_KEY not found in environment variables')
      throw new Error('GEMINI_API_KEY not configured. Please set it using: supabase secrets set GEMINI_API_KEY=your_key')
    }

    // Parse test payload
    const payload: TestPayload = await req.json()
    console.log('Received test request:', payload)

    const { user_id: userId, message } = payload
    const startTime = Date.now()

    // Get user's business profile
    const { data: businessProfile } = await supabase
      .from('user_business_profiles')
      .select('business_name, description, industry, operating_hours, fonnte_device_id, fonnte_device_token')
      .eq('user_id', userId)
      .single()

    // Perform RAG search to find relevant documents
    console.log('Performing RAG similarity search...')
    const relevantDocuments = await performRAGSearch(geminiApiKey, userId, message)
    console.log(`Found ${relevantDocuments.length} relevant documents`)

    // Get conversation history for test context
    console.log('Fetching conversation history for test...')
    const { data: conversationHistory, error: historyError } = await supabase
      .from('ai_conversations')
      .select('message_type, message_content, ai_response, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5) // Limit to 5 for test

    if (historyError) {
      console.error('Error fetching conversation history for test:', historyError)
    }

    const recentHistory = (conversationHistory || []).reverse()
    console.log(`Found ${recentHistory.length} previous messages for test context`)

    // Build context for AI
    const aiContext = buildAIContextWithRAG(businessProfile, relevantDocuments, null, recentHistory)
    
    // Generate AI response using Gemini
    const aiResponse = await generateGeminiResponse(geminiApiKey, aiContext, message)
    
    const processingTime = Date.now() - startTime

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: aiResponse,
        processing_time_ms: processingTime,
        relevant_documents: relevantDocuments.length,
        documents_used: relevantDocuments.map(doc => ({
          type: doc.content_type,
          similarity: doc.similarity,
          preview: doc.content_text.substring(0, 100) + '...'
        })),
        device_id: businessProfile?.fonnte_device_id,
        device_token_available: !!businessProfile?.fonnte_device_token
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing test request:', error)
    
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

async function performRAGSearch(
  geminiApiKey: string,
  userId: string,
  query: string,
  limit: number = 5
): Promise<SimilaritySearchResult[]> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(geminiApiKey, query, 'RETRIEVAL_QUERY')

    // Initialize Supabase client for RAG search
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Perform similarity search
    const { data: searchResults, error: searchError } = await supabase.rpc('similarity_search', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_user_id: userId,
      match_content_types: null, // Search all content types
      match_count: limit
    })

    if (searchError) {
      console.error('RAG similarity search error:', searchError)
      return []
    }

    // Filter results by similarity threshold for efficiency
    const SIMILARITY_THRESHOLD = 0.65 // 65% minimum similarity
    const filteredResults = (searchResults || []).filter(result => 
      result.similarity >= SIMILARITY_THRESHOLD
    )
    
    console.log(`RAG Search: Found ${searchResults?.length || 0} results, ${filteredResults.length} above ${SIMILARITY_THRESHOLD * 100}% threshold`)
    
    return filteredResults
  } catch (error) {
    console.error('Error in RAG search:', error)
    return []
  }
}

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

function buildAIContextWithRAG(
  businessProfile: BusinessProfile | null, 
  relevantDocuments: SimilaritySearchResult[], 
  customerName: string | null
): string {
  let context = `Anda adalah asisten AI customer service yang profesional dan ramah. `
  
  if (businessProfile) {
    context += `Anda bekerja untuk ${businessProfile.business_name || 'perusahaan ini'}. `
    
    if (businessProfile.description) {
      context += `Deskripsi bisnis: ${businessProfile.description}. `
    }
    
    if (businessProfile.industry) {
      context += `Industri: ${businessProfile.industry}. `
    }
    
    if (businessProfile.operating_hours) {
      context += `Jam operasional: ${businessProfile.operating_hours}. `
    }
  }

  if (customerName) {
    context += `Anda sedang berbicara dengan ${customerName}. `
  }

  context += `\n\nInformasi relevan yang ditemukan untuk menjawab pertanyaan:\n`
  
  if (relevantDocuments.length > 0) {
    relevantDocuments.forEach((doc, index) => {
      context += `${index + 1}. [${doc.content_type.toUpperCase()}] ${doc.content_text}\n`
      context += `   Tingkat kemiripan: ${(doc.similarity * 100).toFixed(1)}%\n\n`
    })
  } else {
    context += `Tidak ada informasi spesifik yang ditemukan untuk pertanyaan ini.\n\n`
  }

  context += `Instruksi:\n`
  context += `- Jawab dalam bahasa Indonesia\n`
  context += `- Berikan jawaban yang akurat berdasarkan informasi relevan di atas\n`
  context += `- Jika informasi relevan tersedia, gunakan sebagai dasar jawaban Anda\n`
  context += `- Jika tidak ada informasi yang relevan atau tidak yakin, katakan dengan jujur dan tawarkan untuk menghubungkan dengan tim support\n`
  context += `- Gunakan nada yang ramah dan profesional\n`
  context += `- Prioritaskan informasi dengan tingkat kemiripan yang tinggi\n\n`

  return context
}

function buildAIContext(
  businessProfile: BusinessProfile | null,
  knowledgeItems: any[],
  customerName: string | null
): string {
  let context = `Anda adalah asisten AI customer service yang profesional dan ramah. `
  
  if (businessProfile) {
    context += `Anda bekerja untuk ${businessProfile.business_name || 'perusahaan ini'}. `
    
    if (businessProfile.description) {
      context += `Deskripsi bisnis: ${businessProfile.description}. `
    }
    
    if (businessProfile.industry) {
      context += `Industri: ${businessProfile.industry}. `
    }
    
    if (businessProfile.operating_hours) {
      context += `Jam operasional: ${businessProfile.operating_hours}. `
    }
  }

  if (customerName) {
    context += `Anda sedang berbicara dengan ${customerName}. `
  }

  context += `\n\nInformasi penting yang harus Anda ketahui:\n`
  
  if (knowledgeItems.length > 0) {
    knowledgeItems.forEach((item, index) => {
      context += `${index + 1}. Q: ${item.question}\n`
      context += `   A: ${item.answer}\n`
      context += `   Kategori: ${item.category}\n\n`
    })
  } else {
    context += `Tidak ada informasi khusus yang tersedia saat ini.\n\n`
  }

  context += `Instruksi:\n`
  context += `- Jawab dalam bahasa Indonesia\n`
  context += `- Berikan jawaban yang akurat berdasarkan informasi di atas\n`
  context += `- Jika tidak tahu jawaban, katakan dengan jujur dan tawarkan untuk menghubungkan dengan tim support\n`
  context += `- Gunakan nada yang ramah dan profesional\n`
  context += `- Jangan membuat informasi yang tidak ada dalam basis pengetahuan\n\n`

  return context
}

async function generateGeminiResponse(apiKey: string, context: string, userMessage: string): Promise<string> {
  const prompt = `${context}\n\nPertanyaan pelanggan: ${userMessage}\n\nJawaban Anda:`

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text
    } else {
      throw new Error('Invalid response format from Gemini API')
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error)
    return 'Maaf, sistem sedang mengalami gangguan teknis. Silakan coba lagi dalam beberapa saat atau hubungi tim support kami.'
  }
}