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

interface HealthcareWebhookPayload {
  message: string
  sender: string
  to: string
  timestamp: string
  type: string
}

// AI Response limits per plan (same as general)
const AI_RESPONSE_LIMITS: { [key: string]: number } = {
  'starter': 1000,
  'professional': 10000,
  'enterprise': -1, // Unlimited
}

// WhatsApp User limits per plan (same as general)
const WHATSAPP_USER_LIMITS: { [key: string]: number } = {
  'starter': 50,
  'professional': 500,
  'enterprise': -1, // Unlimited
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('=== HEALTHCARE AI WEBHOOK REQUEST RECEIVED ===')
  console.log('Healthcare webhook received request at:', new Date().toISOString())
  console.log('Request method:', req.method)

  try {
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
      throw new Error('GEMINI_API_KEY not configured. Please set it using: supabase secrets set GEMINI_API_KEY=your_key')
    }

    // Read and parse request body
    console.log('Step 3: Reading request body...')
    const rawBody = await req.text()
    console.log('Healthcare webhook raw body received:', rawBody.substring(0, 500))
    
    // Handle empty body (webhook verification)
    if (!rawBody || rawBody.trim() === '') {
      console.log('Empty request body - healthcare webhook verification ping')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Healthcare webhook endpoint is active',
          timestamp: new Date().toISOString()
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }
    
    // Parse payload
    console.log('Step 4: Parsing healthcare webhook payload...')
    let payload: HealthcareWebhookPayload
    try {
      const contentType = req.headers.get('content-type')
      
      if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
        const formData = new URLSearchParams(rawBody)
        payload = {
          message: formData.get('message') || '',
          sender: formData.get('sender') || formData.get('from') || '',
          to: formData.get('to') || formData.get('receiver') || formData.get('device') || '',
          timestamp: formData.get('timestamp') || new Date().toISOString(),
          type: formData.get('type') || 'text'
        }
      } else {
        const parsedPayload = JSON.parse(rawBody)
        payload = {
          message: parsedPayload.message || parsedPayload.pesan || '',
          sender: parsedPayload.sender || parsedPayload.pengirim || parsedPayload.from || '',
          to: parsedPayload.to || parsedPayload.receiver || parsedPayload.device || '',
          timestamp: parsedPayload.timestamp || new Date().toISOString(),
          type: parsedPayload.type || 'text'
        }
      }
      console.log('Healthcare webhook parsed payload:', JSON.stringify(payload, null, 2))
    } catch (parseError) {
      console.error('Failed to parse healthcare webhook payload:', parseError)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Invalid healthcare webhook payload format ignored',
          error: parseError.message
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Validate message type - only process text messages
    if (payload.type && payload.type !== 'text') {
      console.log('Ignoring non-text message type in healthcare webhook:', payload.type)
      return new Response(
        JSON.stringify({
          success: true,
          message: `Non-text message type ignored in healthcare webhook: ${payload.type}`
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    const { message, sender: incomingSenderNumber, to: incomingToNumber } = payload
    const startTime = Date.now()

    // Validate required fields
    if (!message || !incomingSenderNumber || !incomingToNumber || 
        message.trim() === '' || incomingSenderNumber.trim() === '' || incomingToNumber.trim() === '') {
      console.log('Incomplete healthcare webhook payload - gracefully ignoring')
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Incomplete healthcare webhook payload ignored'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Prevent self-loop
    if (incomingSenderNumber === incomingToNumber) {
      console.log('Ignoring healthcare message where sender equals recipient (potential loop)')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Healthcare self-message ignored to prevent loop'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Find healthcare business profile by 'to' number
    console.log('Step 5: Finding healthcare business for to number:', incomingToNumber)
    const { data: businessProfileForToNumber, error: businessProfileError } = await supabase
      .from('user_business_profiles')
      .select('user_id, whatsapp_number, industry, business_name')
      .eq('whatsapp_number', incomingToNumber)
      .maybeSingle()

    if (businessProfileError || !businessProfileForToNumber) {
      console.log('No healthcare business profile found for to number:', incomingToNumber)
      console.log('=== HEALTHCARE BUSINESS PROFILE NOT FOUND DEBUG ===')
      console.log('Error details:', businessProfileError)
      console.log('Searched whatsapp_number:', incomingToNumber)
      
      // Let's also check what WhatsApp numbers are actually in the database
      const { data: allBusinessNumbers } = await supabase
        .from('user_business_profiles')
        .select('whatsapp_number, business_name, industry')
        .not('whatsapp_number', 'is', null)
      
      console.log('All business WhatsApp numbers in database:', allBusinessNumbers)
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Target WhatsApp number not registered as business'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Check if this is actually a healthcare business
    if (businessProfileForToNumber.industry !== 'healthcare') {
      console.log('Non-healthcare business detected in healthcare webhook, should use general webhook')
      console.log('Business industry:', businessProfileForToNumber.industry)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Non-healthcare business should use general webhook'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    const botUserId = businessProfileForToNumber.user_id
    const botWhatsappNumber = businessProfileForToNumber.whatsapp_number

    // Prevent bot responding to its own messages
    if (incomingSenderNumber === botWhatsappNumber) {
      console.log('Ignoring healthcare self-sent message from bot')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Healthcare bot self-message ignored to prevent loop'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Find or create patient mapping
    console.log('Step 6: Finding or creating patient mapping for:', incomingSenderNumber)
    let whatsappUser;

    const { data: existingWhatsappUserForBot, error: searchError } = await supabase
      .from('whatsapp_users')
      .select('id, user_id, customer_name')
      .eq('whatsapp_number', incomingSenderNumber)
      .eq('user_id', botUserId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (searchError) {
      console.error('Error querying whatsapp_users for healthcare bot:', searchError);
      throw new Error('Database error during patient mapping lookup.');
    }

    if (existingWhatsappUserForBot) {
      console.log('Found existing patient for this healthcare facility:', existingWhatsappUserForBot);
      whatsappUser = existingWhatsappUserForBot;
    } else {
      // Auto-register new patient
      console.log('Auto-registering new patient for healthcare facility');

      // Check patient limits
      const { count: currentCount, error: countError } = await supabase
        .from('whatsapp_users')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', botUserId)
        .eq('is_active', true);

      if (countError) {
        console.error('Error counting patients:', countError);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'System error occurred while checking patient registration limit'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      const { data: businessProfileForLimit } = await supabase
        .from('user_business_profiles')
        .select('selected_plan')
        .eq('user_id', botUserId)
        .single();

      const userPlan = businessProfileForLimit?.selected_plan || 'starter';
      const patientLimit = WHATSAPP_USER_LIMITS[userPlan] || WHATSAPP_USER_LIMITS['starter'];

      if (patientLimit !== -1 && currentCount >= patientLimit) {
        console.log(`Patient limit reached for healthcare plan ${userPlan}`);
        const limitMessage = `🏥 Maaf, fasilitas kesehatan ini telah mencapai batas maksimal ${patientLimit} pasien terdaftar untuk paket ${userPlan}. Silakan hubungi administrasi untuk informasi lebih lanjut. 💙`;
        await sendHealthcareWhatsAppMessage(incomingSenderNumber, limitMessage);
        return new Response(
          JSON.stringify({
            success: true,
            message: `Patient limit reached for healthcare plan ${userPlan}`
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      // Auto-register new patient
      try {
        const { data: newWhatsappUser, error: insertError } = await supabase
          .from('whatsapp_users')
          .insert({
            user_id: botUserId,
            whatsapp_number: incomingSenderNumber,
            customer_name: null,
            is_active: true
          })
          .select('id, user_id, customer_name')
          .single();

        if (insertError) {
          console.error('Error auto-registering patient:', insertError);
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Failed to register new patient automatically'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          );
        }
        
        console.log('Successfully auto-registered new patient:', newWhatsappUser);
        whatsappUser = newWhatsappUser;
      } catch (autoRegisterError) {
        console.error('Unexpected error during patient auto-registration:', autoRegisterError);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'System error during patient registration'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }
    }

    const userId = whatsappUser.user_id
    const patientName = whatsappUser.customer_name
    const whatsappUserId = whatsappUser.id

    console.log('Processing healthcare message for:', {
      userId: userId,
      patientName: patientName || 'Auto-registered patient',
      whatsappUserId: whatsappUserId,
      whatsappNumber: incomingSenderNumber
    })

    // Log incoming message
    console.log('Step 7: Logging incoming healthcare message...')
    await supabase.from('ai_conversations').insert({
      user_id: userId,
      whatsapp_number: incomingSenderNumber,
      message_type: 'incoming',
      message_content: message,
      processing_time_ms: null
    })

    // Get healthcare business profile
    console.log('Step 8: Fetching healthcare business profile...')
    const { data: businessProfile } = await supabase
      .from('user_business_profiles')
      .select('business_name, description, industry, operating_hours, selected_plan, ai_responses_count, ai_responses_last_reset_month, fonnte_device_id, fonnte_device_token')
      .eq('user_id', userId)
      .eq('industry', 'healthcare') // Ensure it's healthcare
      .single()

    if (!businessProfile) {
      console.log('No healthcare business profile found for user:', userId)
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Healthcare business profile not found'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Check and handle monthly reset
    console.log('Step 8a: Checking monthly reset for healthcare...')
    const currentMonth = new Date().getMonth() + 1
    let currentResponsesCount = businessProfile.ai_responses_count || 0
    
    if (currentMonth !== businessProfile.ai_responses_last_reset_month) {
      console.log('Monthly reset needed for healthcare')
      
      const { error: resetError } = await supabase
        .from('user_business_profiles')
        .update({
          ai_responses_count: 0,
          ai_responses_last_reset_month: currentMonth
        })
        .eq('user_id', userId)
      
      if (resetError) {
        console.error('Error resetting monthly AI responses count for healthcare:', resetError)
      } else {
        console.log('Successfully reset AI responses count for healthcare new month')
        currentResponsesCount = 0
      }
    }

    // Check AI response limits
    console.log('Step 8b: Checking AI response limits for healthcare...')
    const userPlan = businessProfile.selected_plan || 'starter'
    const userLimit = AI_RESPONSE_LIMITS[userPlan] || AI_RESPONSE_LIMITS['starter']
    
    console.log(`Healthcare plan: ${userPlan}, Current usage: ${currentResponsesCount}/${userLimit === -1 ? 'Unlimited' : userLimit}`)
    
    if (userLimit !== -1 && currentResponsesCount >= userLimit) {
      console.log('AI response limit exceeded for healthcare user:', userId)
      
      const limitMessage = `🏥 Maaf, fasilitas kesehatan ini telah mencapai batas ${userLimit} respons AI bulanan untuk paket ${userPlan}. Untuk keperluan medis mendesak, silakan datang langsung ke fasilitas atau hubungi 119. 💙`
      
      await sendHealthcareWhatsAppMessage(incomingSenderNumber, limitMessage)
      
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Healthcare AI response limit exceeded'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Get conversation history for healthcare context
    console.log('Step 8c: Fetching healthcare conversation history...')
    const { data: conversationHistory, error: historyError } = await supabase
      .from('ai_conversations')
      .select('message_type, message_content, ai_response, created_at')
      .eq('user_id', userId)
      .eq('whatsapp_number', incomingSenderNumber)
      .order('created_at', { ascending: false })
      .limit(10)

    if (historyError) {
      console.error('Error fetching healthcare conversation history:', historyError)
    }

    const recentHistory = (conversationHistory || []).reverse() // Reverse to get chronological order
    console.log(`Found ${recentHistory.length} previous messages in healthcare conversation history`)

    // Perform healthcare-specific RAG search
    console.log('Step 9: Performing healthcare RAG similarity search...')
    const relevantDocuments = await performHealthcareRAGSearch(geminiApiKey, userId, message)
    console.log(`Found ${relevantDocuments.length} relevant healthcare documents`)

    // Build healthcare-specific AI context
    console.log('Step 10: Building healthcare AI context...')
    const aiContext = buildHealthcareAIContextWithRAG(businessProfile, relevantDocuments, patientName, recentHistory)
    
    // Generate AI response
    console.log('Step 11: Generating healthcare AI response...')
    const aiResponse = await generateHealthcareGeminiResponse(geminiApiKey, aiContext, message)

    const processingTime = Date.now() - startTime

    // Increment AI responses count
    console.log('Step 12: Incrementing healthcare AI responses count...')
    const { error: incrementError } = await supabase
      .from('user_business_profiles')
      .update({
        ai_responses_count: currentResponsesCount + 1
      })
      .eq('user_id', userId)
    
    if (incrementError) {
      console.error('Error incrementing healthcare AI responses count:', incrementError)
    }

    // Log AI response
    console.log('Step 13: Logging healthcare AI response...')
    await supabase.from('ai_conversations').insert({
      user_id: userId,
      whatsapp_number: incomingSenderNumber,
      message_type: 'outgoing',
      message_content: aiResponse,
      ai_response: aiResponse,
      processing_time_ms: processingTime
    })

    // Send WhatsApp message
    console.log('Step 14: Sending healthcare WhatsApp message...')
    try {
      await sendHealthcareWhatsAppMessage(
        incomingSenderNumber, 
        aiResponse, 
        businessProfile?.fonnte_device_id, 
        businessProfile?.fonnte_device_token
      )
      console.log('Healthcare WhatsApp message sent successfully')
    } catch (sendError) {
      console.error('Failed to send healthcare WhatsApp message:', sendError.message)
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          response: aiResponse,
          processing_time_ms: processingTime,
          send_error: sendError.message,
          warning: 'Healthcare AI response generated but WhatsApp message failed to send'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('=== HEALTHCARE AI WEBHOOK COMPLETED SUCCESSFULLY ===')
    return new Response(
      JSON.stringify({ 
        success: true, 
        response: aiResponse,
        processing_time_ms: processingTime
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('=== HEALTHCARE WEBHOOK CRITICAL ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Timestamp:', new Date().toISOString())
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Healthcare system error occurred',
        debug_error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function sendHealthcareWhatsAppMessage(
  to: string, 
  message: string, 
  deviceId?: string, 
  deviceToken?: string
): Promise<void> {
  if (!deviceToken || deviceToken.trim() === '') {
    console.error('Healthcare device token not available - cannot send WhatsApp message')
    throw new Error('Healthcare device token not available. WhatsApp device may not be connected or registered properly.')
  }

  console.log('Sending healthcare WhatsApp message to:', to)
  
  try {
    const requestBody: any = {
      target: to,
      message: message,
      countryCode: '62',
    }
    
    if (deviceId) {
      requestBody.device = deviceId
    }
    
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': deviceToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to send healthcare WhatsApp message:', response.status, response.statusText)
      console.error('FonNte API error response:', errorText)
      throw new Error(`FonNte API error: ${response.status} - ${errorText}`)
    } else {
      const responseData = await response.text()
      console.log('Healthcare WhatsApp message sent successfully:', responseData)
    }
  } catch (error) {
    console.error('Error sending healthcare WhatsApp message:', error)
    throw error
  }
}