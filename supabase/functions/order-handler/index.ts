import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleOrderingLogic } from './src/order_logic.ts'
import { BusinessProfile } from '../utils/ai_utils.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderHandlerPayload {
  user_id: string
  whatsapp_user_id: string
  message: string
  customer_whatsapp_number: string
  customer_name: string | null
  business_profile: BusinessProfile
  conversation_history?: Array<{
    message_type: 'incoming' | 'outgoing'
    message_content: string
    ai_response?: string
    created_at: string
  }>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== Order Handler Function Started ===')
    console.log('Request method:', req.method)
    console.log('Request headers:', Object.fromEntries(req.headers.entries()))
    
    // Initialize Supabase client
    console.log('Step 1: Initializing Supabase client...')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Gemini API key
    console.log('Step 2: Checking Gemini API key...')
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not found in environment variables')
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Parse request payload
    console.log('Step 3: Parsing request payload...')
    const payload: OrderHandlerPayload = await req.json()
    console.log('Order handler request:', payload)

    // Validate payload
    if (!payload.user_id || !payload.whatsapp_user_id || !payload.message) {
      console.error('Missing required fields in payload:', payload)
      throw new Error('Missing required fields: user_id, whatsapp_user_id, or message')
    }

    const {
      user_id: userId,
      whatsapp_user_id: whatsappUserId,
      message,
      customer_whatsapp_number: customerWhatsappNumber,
      customer_name: customerName,
      business_profile: businessProfile,
      conversation_history: conversationHistory
    } = payload

    console.log('Step 4: Validated payload data:', {
      userId,
      whatsappUserId,
      messageLength: message.length,
      customerWhatsappNumber,
      customerName,
      businessProfileAvailable: !!businessProfile,
      conversationHistoryLength: conversationHistory?.length || 0
    })

    // Process the order message using the modular order logic
    console.log('Step 5: Calling handleOrderingLogic...')
    const result = await handleOrderingLogic(
      supabase,
      geminiApiKey,
      userId,
      whatsappUserId,
      message,
      customerWhatsappNumber,
      customerName,
      businessProfile,
      conversationHistory || []
    )

    console.log('Step 6: Order logic completed successfully')
    console.log('Result response length:', result.response.length)
    
    console.log('=== Order Handler Function Completed Successfully ===')
    return new Response(
      JSON.stringify({
        success: true,
        response: result.response
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('=== Order Handler Function Failed ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Timestamp:', new Date().toISOString())
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        error_type: error.constructor.name,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})