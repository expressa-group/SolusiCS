import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  performRAGSearch,
  generateEmbedding,
  buildAIContextWithRAG,
  generateGeminiResponse,
  BusinessProfile,
  SimilaritySearchResult
} from '../utils/ai_utils.ts'
import { detectOrderingIntent } from '../order-handler/src/order_parser.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WebhookPayload {
  message: string
  sender: string
  to: string
  timestamp: string
  type: string
}

interface OrderState {
  step: 'browsing' | 'collecting_items' | 'confirming_order' | 'awaiting_payment'
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    price: number
  }>
  total_amount: number
  customer_name?: string
}

// AI Response limits per plan
const AI_RESPONSE_LIMITS: { [key: string]: number } = {
  'starter': 1000,
  'professional': 10000,
  'enterprise': -1, // Unlimited
}

// WhatsApp User limits per plan
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

  console.log('=== WEBHOOK REQUEST RECEIVED ===')
  console.log('Webhook received request at:', new Date().toISOString())
  console.log('Request method:', req.method)
  console.log('Request URL:', req.url)
  console.log('Request headers:', Object.fromEntries(req.headers.entries()))

  console.log('=== AI CS Webhook Started ===')
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

    // Read raw request body
    console.log('Step 3: Reading request body...')
    const rawBody = await req.text()
    console.log('=== RAW REQUEST BODY DEBUG ===')
    console.log('Raw body received:', rawBody)
    console.log('Raw body length:', rawBody.length)
    console.log('Raw body type:', typeof rawBody)
    console.log('Raw body first 500 chars:', rawBody.substring(0, 500))

    // Handle empty body (webhook verification)
    if (!rawBody || rawBody.trim() === '') {
      console.log('Empty request body - webhook verification ping')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Webhook endpoint is active',
          timestamp: new Date().toISOString()
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Parse payload
    console.log('Step 4: Parsing payload...')
    let payload: WebhookPayload
    try {
      const contentType = req.headers.get('content-type')
      console.log('=== PAYLOAD PARSING DEBUG ===')
      console.log('Content-Type header:', contentType)

      if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
        console.log('Parsing as form-urlencoded data')
        const formData = new URLSearchParams(rawBody)
        console.log('Form data entries:', Array.from(formData.entries()))
        payload = {
          message: formData.get('message') || '',
          sender: formData.get('sender') || formData.get('from') || '',
          to: formData.get('to') || formData.get('receiver') || formData.get('device') || '',
          timestamp: formData.get('timestamp') || new Date().toISOString(),
          type: formData.get('type') || 'text'
        }
      } else {
        console.log('Parsing as JSON data')
        const parsedPayload = JSON.parse(rawBody)
        console.log('Parsed JSON payload:', parsedPayload)
        payload = {
          message: parsedPayload.message || parsedPayload.pesan || '',
          sender: parsedPayload.sender || parsedPayload.pengirim || parsedPayload.from || '',
          to: parsedPayload.to || parsedPayload.receiver || parsedPayload.device || '',
          timestamp: parsedPayload.timestamp || new Date().toISOString(),
          type: parsedPayload.type || 'text'
        }
      }
      console.log('=== FINAL PARSED PAYLOAD ===')
      console.log('Parsed payload:', JSON.stringify(payload, null, 2))
      console.log('Message:', payload.message)
      console.log('Sender:', payload.sender)
      console.log('To:', payload.to)
      console.log('Type:', payload.type)
    } catch (parseError) {
      console.error('Failed to parse payload:', parseError)
      console.error('Raw body that failed to parse:', rawBody)
      console.error('Content-Type that failed:', req.headers.get('content-type'))
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Invalid payload format ignored',
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
      console.log('Ignoring non-text message type:', payload.type)
      return new Response(
        JSON.stringify({
          success: true,
          message: `Non-text message type ignored: ${payload.type}`
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
      console.log('Incomplete payload - gracefully ignoring')

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Incomplete webhook payload ignored'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Prevent self-loop - ignore if sender equals to number
    if (incomingSenderNumber === incomingToNumber) {
      console.log('Ignoring message where sender equals recipient (potential loop)')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Self-message ignored to prevent loop'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Find business profile by 'to' number (recipient)
    console.log('Step 5: Finding business for to number:', incomingToNumber)
    console.log('=== BUSINESS PROFILE SEARCH DEBUG ===')
    console.log('Searching for business profile with whatsapp_number:', incomingToNumber)
    const { data: businessProfileForToNumber, error: businessProfileError } = await supabase
      .from('user_business_profiles')
      .select('user_id, whatsapp_number, business_name, description, industry, operating_hours, selected_plan, ai_responses_count, ai_responses_last_reset_month, fonnte_device_id, fonnte_device_token')
      .eq('whatsapp_number', incomingToNumber)
      .single()

    console.log('Business profile query result:', businessProfileForToNumber)
    console.log('Business profile query error:', businessProfileError)

    if (businessProfileError || !businessProfileForToNumber) {
      console.log('No business profile found for to number:', incomingToNumber)
      console.log('=== BUSINESS PROFILE NOT FOUND DEBUG ===')
      console.log('Error details:', businessProfileError)
      console.log('Searched whatsapp_number:', incomingToNumber)

      // Let's also check what WhatsApp numbers are actually in the database
      const { data: allBusinessNumbers } = await supabase
        .from('user_business_profiles')
        .select('whatsapp_number, business_name')
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

    const botUserId = businessProfileForToNumber.user_id
    const botWhatsappNumber = businessProfileForToNumber.whatsapp_number
    const businessProfile = businessProfileForToNumber // Use the complete profile from the first query

    // Prevent bot responding to its own messages
    if (incomingSenderNumber === botWhatsappNumber) {
      console.log('Ignoring self-sent message from bot')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Bot self-message ignored to prevent loop'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Step 6: Finding or creating customer mapping
    console.log('Step 6: Finding or creating customer mapping for:', incomingSenderNumber)
    console.log('For user_id (bot):', botUserId)

    let whatsappUser;

    // 1. Try to find an existing whatsapp_user entry specifically for this bot's user_id AND this WhatsApp number
    const { data: existingWhatsappUserForBot, error: searchError } = await supabase
      .from('whatsapp_users')
      .select('id, user_id, customer_name')
      .eq('whatsapp_number', incomingSenderNumber)
      .eq('user_id', botUserId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (searchError) {
      console.error('Error querying whatsapp_users for bot:', searchError);
      throw new Error('Database error during customer mapping lookup.');
    }

    if (existingWhatsappUserForBot) {
      // Found an existing entry for this specific bot (user_id) and this WhatsApp number, use it.
      console.log('Found existing WhatsApp user for this bot:', existingWhatsappUserForBot);
      whatsappUser = existingWhatsappUserForBot;
    } else {
      // No entry found for this specific bot (user_id) and this WhatsApp number.
      // This is correct behavior - the same WhatsApp number can be registered for different businesses.
      // Proceed to create a new entry for this specific bot, after checking limits.
      console.log('No existing WhatsApp user found for this bot. Proceeding to auto-register for this bot.');

      // Check current registered WhatsApp users count for this specific business (user_id)
      const { count: currentCount, error: countError } = await supabase
        .from('whatsapp_users')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', botUserId)
        .eq('is_active', true);

      if (countError) {
        console.error('Error counting WhatsApp users:', countError);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'System error occurred while checking registration limit'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      const userPlan = businessProfile?.selected_plan || 'starter';
      const whatsappUserLimit = WHATSAPP_USER_LIMITS[userPlan] || WHATSAPP_USER_LIMITS['starter'];

      console.log(`Current WhatsApp users: ${currentCount}, Plan: ${userPlan}, Limit: ${whatsappUserLimit === -1 ? 'Unlimited' : whatsappUserLimit}`);

      if (whatsappUserLimit !== -1 && currentCount >= whatsappUserLimit) {
        console.log(`WhatsApp user limit reached for plan ${userPlan}`);
        const limitMessage = `Maaf, paket ${userPlan} Anda telah mencapai batas maksimal ${whatsappUserLimit} nomor WhatsApp terdaftar. Silakan upgrade paket atau hubungi admin untuk informasi lebih lanjut.`;
        await sendWhatsAppMessage(incomingSenderNumber, limitMessage);
        return new Response(
          JSON.stringify({
            success: true,
            message: `WhatsApp user limit reached for plan ${userPlan}`
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }

      // Auto-register new customer for this specific botUserId (allows same WhatsApp number for different businesses)
      try {
        const { data: newWhatsappUser, error: insertError } = await supabase
          .from('whatsapp_users')
          .insert({
            user_id: botUserId,
            whatsapp_number: incomingSenderNumber,
            customer_name: null, // Can be updated later if customer provides name
            is_active: true
          })
          .select('id, user_id, customer_name')
          .single();

        if (insertError) {
          console.error('Error auto-registering customer for this specific bot:', insertError);
          console.error('Insert data that failed:', {
            user_id: botUserId,
            whatsapp_number: incomingSenderNumber,
            is_active: true
          });
          return new Response(
            JSON.stringify({
              success: true,
              message: 'Failed to register new customer automatically for this specific bot'
            }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          );
        }
        console.log('Successfully auto-registered new customer for this specific bot:', {
          whatsapp_number: incomingSenderNumber,
          user_id: botUserId,
          new_whatsapp_user_id: newWhatsappUser.id
        });
        whatsappUser = newWhatsappUser;
      } catch (autoRegisterError) {
        console.error('Unexpected error during auto-registration for this specific bot:', autoRegisterError);
        return new Response(
          JSON.stringify({
            success: true,
            message: 'System error during customer registration for this specific bot'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        );
      }
    }

    // At this point, whatsappUser is guaranteed to be correctly associated with the specific botUserId
    // This ensures that the same WhatsApp number can exist for different businesses (user_ids)

    const userId = whatsappUser.user_id
    const customerName = whatsappUser.customer_name
    const whatsappUserId = whatsappUser.id
    console.log('Processing message for specific business:', {
      userId: userId,
      customerName: customerName || 'Auto-registered',
      whatsappUserId: whatsappUserId,
      whatsappNumber: incomingSenderNumber,
      botWhatsappNumber: botWhatsappNumber
    })

    // Log incoming message
    console.log('Step 7: Logging incoming message...')
    await supabase.from('ai_conversations').insert({
      user_id: userId,
      whatsapp_number: incomingSenderNumber,
      message_type: 'incoming',
      message_content: message,
      processing_time_ms: null
    })

    // Check if this is a healthcare business and redirect to healthcare webhook
    if (businessProfile.industry === 'healthcare') {
      console.log('Healthcare business detected, redirecting to healthcare webhook')

      // Call healthcare webhook directly
      try {
        const healthcareWebhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/healthcare-ai-webhook`
        const healthcareResponse = await fetch(healthcareWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message,
            sender: incomingSenderNumber,
            to: incomingToNumber,
            timestamp: payload.timestamp,
            type: payload.type
          })
        })

        if (healthcareResponse.ok) {
          const healthcareResult = await healthcareResponse.json()
          console.log('Successfully redirected to healthcare webhook')
          return new Response(
            JSON.stringify(healthcareResult),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200
            }
          )
        } else {
          console.error('Healthcare webhook call failed:', healthcareResponse.status)
          throw new Error('Healthcare webhook call failed')
        }
      } catch (redirectError) {
        console.error('Error redirecting to healthcare webhook:', redirectError)
        // Continue with general processing as fallback
      }
    }

    // For non-healthcare businesses, continue with general processing
    if (businessProfile.industry === 'healthcare') {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Healthcare business processed via healthcare webhook'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Get conversation history for context
    console.log('Step 8a: Fetching conversation history...')
    const { data: conversationHistory, error: historyError } = await supabase
      .from('ai_conversations')
      .select('message_type, message_content, ai_response, created_at')
      .eq('user_id', userId)
      .eq('whatsapp_number', incomingSenderNumber)
      .order('created_at', { ascending: false })
      .limit(10)

    if (historyError) {
      console.error('Error fetching conversation history:', historyError)
    }

    const recentHistory = (conversationHistory || []).reverse() // Reverse to get chronological order
    console.log(`Found ${recentHistory.length} previous messages in conversation history`)

    // Check for ordering intent first
    console.log('Step 8b: Detecting ordering intent...')
    const intentResult = detectOrderingIntent(message)
    console.log('Intent detection result:', intentResult)

    // Log device token availability for debugging
    console.log('Business profile fonnte_device_id:', businessProfile.fonnte_device_id)
    console.log('Business profile fonnte_device_token available:', !!businessProfile.fonnte_device_token)
    if (businessProfile.fonnte_device_token) {
      console.log('Device token (first 10 chars):', businessProfile.fonnte_device_token.substring(0, 10) + '...')
    } else {
      console.error('CRITICAL: fonnte_device_token is null or empty in business profile')
      console.error('This will cause WhatsApp message sending to fail')
    }

    // Check and handle monthly reset
    console.log('Step 8: Checking monthly reset...')
    const currentMonth = new Date().getMonth() + 1
    let currentResponsesCount = businessProfile.ai_responses_count || 0

    if (currentMonth !== businessProfile.ai_responses_last_reset_month) {
      console.log('Monthly reset needed')

      const { error: resetError } = await supabase
        .from('user_business_profiles')
        .update({
          ai_responses_count: 0,
          ai_responses_last_reset_month: currentMonth
        })
        .eq('user_id', userId)

      if (resetError) {
        console.error('Error resetting monthly AI responses count:', resetError)
      } else {
        console.log('Successfully reset AI responses count for new month')
        currentResponsesCount = 0
      }
    }

    // Check AI response limits
    console.log('Step 9: Checking AI response limits...')
    const userPlan = businessProfile.selected_plan || 'starter'
    const userLimit = AI_RESPONSE_LIMITS[userPlan] || AI_RESPONSE_LIMITS['starter']

    console.log(`User plan: ${userPlan}, Current usage: ${currentResponsesCount}/${userLimit === -1 ? 'Unlimited' : userLimit}`)

    if (userLimit !== -1 && currentResponsesCount >= userLimit) {
      console.log('AI response limit exceeded for user:', userId)

      const limitMessage = `Maaf, Anda telah mencapai batas ${userLimit} percakapan AI bulanan untuk paket ${userPlan}. Silakan upgrade paket atau hubungi admin untuk informasi lebih lanjut.`

      await sendWhatsAppMessage(incomingSenderNumber, limitMessage)

      return new Response(
        JSON.stringify({
          success: true,
          message: 'AI response limit exceeded'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Process ordering logic for restaurant industry
    let aiResponse: string = ''
    let shouldSendMenuAfterResponse = false

    if (businessProfile.industry === 'retail' || businessProfile.industry === 'ecommerce' || businessProfile.industry === 'services') {
      // Check if this is an ordering intent
      if (intentResult.isOrdering || intentResult.intent === 'menu' || intentResult.intent === 'order') {
        console.log('Step 10a: Ordering intent detected, generating natural response first...')
        
        // First, generate a natural AI response to the user's message
        const relevantDocuments = await performRAGSearch(geminiApiKey, userId, message)
        console.log(`Found ${relevantDocuments.length} relevant documents for natural response`)
        
        const aiContext = buildAIContextWithRAG(businessProfile, relevantDocuments, customerName, recentHistory)
        aiResponse = await generateGeminiResponse(geminiApiKey, aiContext, message)
        
        // Set flag to send menu after the natural response
        shouldSendMenuAfterResponse = true
        console.log('Natural response generated, will send menu after this response')
      } else {
        // Not an ordering intent, use order handler for existing cart management
        console.log('Step 10b: No ordering intent detected, calling order-handler for cart management...')
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const orderHandlerResponse = await fetch(`${supabaseUrl}/functions/v1/order-handler`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            user_id: userId,
            whatsapp_user_id: whatsappUserId,
            message: message,
            customer_whatsapp_number: incomingSenderNumber,
            customer_name: customerName,
            business_profile: businessProfile,
            conversation_history: recentHistory
          }),
        })

        console.log('Order handler response status:', orderHandlerResponse.status)
        
        if (!orderHandlerResponse.ok) {
          let errorMessage = 'Failed to process order through order-handler'
          try {
            const errorData = await orderHandlerResponse.json()
            if (errorData.error) {
              errorMessage = `Order handler error: ${errorData.error}`
            }
            console.error('Order handler detailed error response:', errorData)
          } catch (parseError) {
            console.error('Failed to parse order handler error response:', parseError)
            const errorText = await orderHandlerResponse.text()
            console.error('Order handler raw error response:', errorText)
            errorMessage = `Order handler error (${orderHandlerResponse.status}): ${errorText}`
          }
          
          console.error('Order handler failed, falling back to general AI response')
          console.error('Error message:', errorMessage)
          
          // Fallback to general AI response instead of throwing error
          const relevantDocuments = await performRAGSearch(geminiApiKey, userId, message)
          const aiContext = buildAIContextWithRAG(businessProfile, relevantDocuments, customerName, recentHistory)
          aiResponse = await generateGeminiResponse(geminiApiKey, aiContext, message)
        } else {
          const orderingResult = await orderHandlerResponse.json()

          if (!orderingResult.success) {
            const detailedError = orderingResult.error || 'Order handler returned error'
            console.error('Order handler returned error:', detailedError)
            console.error('Full order handler response:', orderingResult)
            
            // Fallback to general AI response instead of throwing error
            console.log('Order handler returned error, falling back to general AI response')
            const relevantDocuments = await performRAGSearch(geminiApiKey, userId, message)
            const aiContext = buildAIContextWithRAG(businessProfile, relevantDocuments, customerName, recentHistory)
            aiResponse = await generateGeminiResponse(geminiApiKey, aiContext, message)
          } else {
            aiResponse = orderingResult.response
          }
        }
      }
    } else {
      // Regular AI response for non-restaurant businesses
      console.log('Step 10: Performing RAG similarity search...')
      const relevantDocuments = await performRAGSearch(geminiApiKey, userId, message)
      console.log(`Found ${relevantDocuments.length} relevant documents`)

      console.log('Step 11: Building AI context...')
      const aiContext = buildAIContextWithRAG(businessProfile, relevantDocuments, customerName, recentHistory)

      console.log('Step 12: Generating AI response...')
      aiResponse = await generateGeminiResponse(geminiApiKey, aiContext, message)
    }

    const processingTime = Date.now() - startTime

    // Increment AI responses count
    console.log('Step 13: Incrementing AI responses count...')
    const { error: incrementError } = await supabase
      .from('user_business_profiles')
      .update({
        ai_responses_count: currentResponsesCount + 1
      })
      .eq('user_id', userId)

    if (incrementError) {
      console.error('Error incrementing AI responses count:', incrementError)
    }

    // Log AI response
    console.log('Step 14: Logging AI response...')
    await supabase.from('ai_conversations').insert({
      user_id: userId,
      whatsapp_number: incomingSenderNumber,
      message_type: 'outgoing',
      message_content: aiResponse,
      ai_response: aiResponse,
      processing_time_ms: processingTime
    })

    // Send WhatsApp message
    console.log('Step 15: Sending WhatsApp message...')
    // Only send message if there's a response (order handler might send messages directly)
    if (aiResponse && aiResponse.trim() !== '') {
      try {
        await sendWhatsAppMessage(incomingSenderNumber, aiResponse, businessProfile?.fonnte_device_id, businessProfile?.fonnte_device_token)
        console.log('WhatsApp message sent successfully')
        
        // If this was an ordering intent, send the menu as a follow-up message
        if (shouldSendMenuAfterResponse) {
          console.log('Step 15b: Sending menu as follow-up message...')
          
          // Add a small delay to ensure messages arrive in order
          await new Promise(resolve => setTimeout(resolve, 1500))
          
          // Call order handler with original user message to process the order
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!
          const menuHandlerResponse = await fetch(`${supabaseUrl}/functions/v1/order-handler`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              user_id: userId,
              whatsapp_user_id: whatsappUserId,
              message: message, // Use original user message to extract items
              customer_whatsapp_number: incomingSenderNumber,
              customer_name: customerName,
              business_profile: businessProfile,
              conversation_history: recentHistory
            }),
          })
          
          if (menuHandlerResponse.ok) {
            const menuResult = await menuHandlerResponse.json()
            if (menuResult.success && menuResult.response && menuResult.response.trim() !== '') {
              // Send the menu response
              await sendWhatsAppMessage(incomingSenderNumber, menuResult.response, businessProfile?.fonnte_device_id, businessProfile?.fonnte_device_token)
              console.log('Order processing follow-up message sent successfully')
              
              // Log the menu response as an outgoing message
              await supabase.from('ai_conversations').insert({
                user_id: userId,
                whatsapp_number: incomingSenderNumber,
                message_type: 'outgoing',
                message_content: menuResult.response,
                ai_response: menuResult.response,
                processing_time_ms: Date.now() - startTime
              })
            }
          } else {
            console.error('Failed to process order from order handler:', menuHandlerResponse.status)
          }
        }
      } catch (sendError) {
        console.error('Failed to send WhatsApp message:', sendError.message)

        console.log('=== AI CS Webhook Completed with Send Error ===')
        return new Response(
          JSON.stringify({
            success: true,
            response: aiResponse,
            processing_time_ms: processingTime,
            send_error: sendError.message,
            warning: 'AI response generated but WhatsApp message failed to send'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    console.log('=== AI CS Webhook Completed Successfully ===')
    return new Response(
      JSON.stringify({
        success: true,
        response: aiResponse,
        processing_time_ms: processingTime,
        ordering_intent_detected: shouldSendMenuAfterResponse,
        intent_result: intentResult
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('=== WEBHOOK CRITICAL ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Timestamp:', new Date().toISOString())
    console.error('Unexpected error in webhook:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error occurred',
        debug_error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function sendWhatsAppMessage(to: string, message: string, deviceId?: string, deviceToken?: string): Promise<void> {
  if (!deviceToken || deviceToken.trim() === '') {
    console.error('Device token not available - cannot send WhatsApp message')
    throw new Error('Device token not available. WhatsApp device may not be connected or registered properly.')
  }

  console.log('Sending WhatsApp message to:', to)

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
      console.error('Failed to send WhatsApp message:', response.status, response.statusText)
      console.error('FonNte API error response:', errorText)
      throw new Error(`FonNte API error: ${response.status} - ${errorText}`)
    } else {
      const responseData = await response.text()
      console.log('WhatsApp message sent successfully:', responseData)
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    throw error
  }
}