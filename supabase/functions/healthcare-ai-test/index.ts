import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { 
  performHealthcareRAGSearch, 
  buildHealthcareAIContextWithRAG, 
  generateHealthcareGeminiResponse,
  HealthcareBusinessProfile
} from '../utils/healthcare_ai_utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HealthcareTestPayload {
  user_id: string
  message: string
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
    const payload: HealthcareTestPayload = await req.json()
    console.log('Received healthcare test request:', payload)

    const { user_id: userId, message } = payload
    const startTime = Date.now()

    // Get healthcare business profile
    const { data: businessProfile } = await supabase
      .from('user_business_profiles')
      .select('business_name, description, industry, operating_hours, fonnte_device_id, fonnte_device_token')
      .eq('user_id', userId)
      .eq('industry', 'healthcare') // Ensure it's healthcare
      .single()

    if (!businessProfile) {
      throw new Error('Healthcare business profile not found')
    }

    // Perform healthcare-specific RAG search
    console.log('Performing healthcare RAG similarity search...')
    const relevantDocuments = await performHealthcareRAGSearch(geminiApiKey, userId, message)
    console.log(`Found ${relevantDocuments.length} relevant healthcare documents`)

    // Get conversation history for healthcare test context
    console.log('Fetching healthcare conversation history for test...')
    const { data: conversationHistory, error: historyError } = await supabase
      .from('ai_conversations')
      .select('message_type, message_content, ai_response, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5) // Limit to 5 for test

    if (historyError) {
      console.error('Error fetching healthcare conversation history for test:', historyError)
    }

    const recentHistory = (conversationHistory || []).reverse()
    console.log(`Found ${recentHistory.length} previous messages for healthcare test context`)

    // Build healthcare-specific AI context
    console.log('Building healthcare AI context...')
    const aiContext = buildHealthcareAIContextWithRAG(businessProfile, relevantDocuments, null, recentHistory)
    
    // Generate AI response
    console.log('Generating healthcare AI response...')
    const aiResponse = await generateHealthcareGeminiResponse(geminiApiKey, aiContext, message)
    
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
    console.error('Error processing healthcare test request:', error)
    
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