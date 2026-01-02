import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduledBlast {
  id: string
  user_id: string
  message_content: string
  scheduled_at: string
  target_type: 'all_users' | 'by_label' | 'by_category' | 'specific_numbers'
  target_label_id?: string
  target_category_id?: string
  specific_numbers?: string[]
}

interface BusinessProfile {
  fonnte_device_id?: string
  fonnte_device_token?: string
  business_name?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== WhatsApp Blast Sender Started ===')
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get current timestamp
    const now = new Date().toISOString()
    console.log('Current time:', now)

    // Fetch due blasts
    console.log('Step 1: Fetching due blasts...')
    const { data: dueBlasts, error: blastsError } = await supabase
      .from('scheduled_whatsapp_blasts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)

    if (blastsError) {
      console.error('Error fetching due blasts:', blastsError)
      throw blastsError
    }

    console.log(`Found ${dueBlasts?.length || 0} due blasts`)

    if (!dueBlasts || dueBlasts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No due blasts found',
          processed_count: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    let processedCount = 0
    let failedCount = 0

    // Process each blast
    for (const blast of dueBlasts) {
      try {
        console.log(`Processing blast ${blast.id} for user ${blast.user_id}`)

        // Get user's business profile and FonNte credentials
        const { data: businessProfile, error: profileError } = await supabase
          .from('user_business_profiles')
          .select('fonnte_device_id, fonnte_device_token, business_name')
          .eq('user_id', blast.user_id)
          .single()

        if (profileError || !businessProfile) {
          console.error(`No business profile found for user ${blast.user_id}`)
          await markBlastAsFailed(supabase, blast.id, 'Business profile not found')
          failedCount++
          continue
        }

        if (!businessProfile.fonnte_device_token) {
          console.error(`No FonNte device token for user ${blast.user_id}`)
          await markBlastAsFailed(supabase, blast.id, 'FonNte device not connected')
          failedCount++
          continue
        }

        // Get target numbers based on target type
        const targetNumbers = await getTargetNumbers(supabase, blast)
        console.log(`Found ${targetNumbers.length} target numbers for blast ${blast.id}`)

        if (targetNumbers.length === 0) {
          console.log(`No target numbers found for blast ${blast.id}`)
          await markBlastAsFailed(supabase, blast.id, 'No target numbers found')
          failedCount++
          continue
        }

        // Send messages to all target numbers
        let sentCount = 0
        let sendFailedCount = 0

        for (const targetNumber of targetNumbers) {
          try {
            await sendWhatsAppMessage(
              targetNumber,
              blast.message_content,
              businessProfile.fonnte_device_token,
              businessProfile.fonnte_device_id
            )
            sentCount++
            console.log(`Message sent to ${targetNumber}`)
            
            // Add small delay between messages to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000))
          } catch (sendError) {
            console.error(`Failed to send message to ${targetNumber}:`, sendError)
            sendFailedCount++
          }
        }

        // Update blast status
        if (sentCount > 0) {
          await supabase
            .from('scheduled_whatsapp_blasts')
            .update({
              status: sendFailedCount === 0 ? 'sent' : 'sent', // Mark as sent even if some failed
              sent_at: new Date().toISOString()
            })
            .eq('id', blast.id)
          
          console.log(`Blast ${blast.id} completed: ${sentCount} sent, ${sendFailedCount} failed`)
          processedCount++
        } else {
          await markBlastAsFailed(supabase, blast.id, 'All message sends failed')
          failedCount++
        }

      } catch (error) {
        console.error(`Error processing blast ${blast.id}:`, error)
        await markBlastAsFailed(supabase, blast.id, error.message)
        failedCount++
      }
    }

    console.log(`=== WhatsApp Blast Sender Completed ===`)
    console.log(`Processed: ${processedCount}, Failed: ${failedCount}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Blast processing completed',
        processed_count: processedCount,
        failed_count: failedCount,
        total_blasts: dueBlasts.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in whatsapp-blast-sender:', error)
    
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

async function getTargetNumbers(supabase: any, blast: ScheduledBlast): Promise<string[]> {
  try {
    let numbers: string[] = []

    switch (blast.target_type) {
      case 'all_users':
        const { data: allUsers } = await supabase
          .from('whatsapp_users')
          .select('whatsapp_number')
          .eq('user_id', blast.user_id)
          .eq('is_active', true)
        numbers = allUsers?.map((u: any) => u.whatsapp_number) || []
        break

      case 'by_label':
        if (blast.target_label_id) {
          const { data: labelUsers } = await supabase
            .from('whatsapp_user_labels')
            .select(`
              whatsapp_users!inner(whatsapp_number)
            `)
            .eq('label_id', blast.target_label_id)
            .eq('whatsapp_users.user_id', blast.user_id)
            .eq('whatsapp_users.is_active', true)
          
          numbers = labelUsers?.map((item: any) => item.whatsapp_users.whatsapp_number).filter(Boolean) || []
        }
        break

      case 'by_category':
        if (blast.target_category_id) {
          const { data: categoryUsers } = await supabase
            .from('whatsapp_user_labels')
            .select(`
              whatsapp_users!inner(whatsapp_number),
              whatsapp_labels!inner(category_id)
            `)
            .eq('whatsapp_labels.category_id', blast.target_category_id)
            .eq('whatsapp_users.user_id', blast.user_id)
            .eq('whatsapp_users.is_active', true)
          
          numbers = categoryUsers?.map((item: any) => item.whatsapp_users.whatsapp_number).filter(Boolean) || []
        }
        break

      case 'specific_numbers':
        numbers = blast.specific_numbers || []
        break
    }

    // Remove duplicates and filter out empty numbers
    return [...new Set(numbers.filter(num => num && num.trim() !== ''))]
  } catch (error) {
    console.error('Error getting target numbers:', error)
    return []
  }
}

async function sendWhatsAppMessage(
  to: string,
  message: string,
  deviceToken: string,
  deviceId?: string
): Promise<void> {
  console.log('Sending WhatsApp blast message to:', to)
  
  try {
    const requestBody: any = {
      target: to,
      message: message,
      countryCode: '62',
    }
    
    // Add device ID if available
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
      console.error('Failed to send WhatsApp blast message:', response.status, response.statusText)
      console.error('FonNte API error response:', errorText)
      throw new Error(`FonNte API error: ${response.status} - ${errorText}`)
    }

    const responseData = await response.text()
    console.log('WhatsApp blast message sent successfully:', responseData)
  } catch (error) {
    console.error('Error sending WhatsApp blast message:', error)
    throw error
  }
}

async function markBlastAsFailed(supabase: any, blastId: string, reason: string): Promise<void> {
  try {
    await supabase
      .from('scheduled_whatsapp_blasts')
      .update({
        status: 'failed',
        sent_at: new Date().toISOString()
      })
      .eq('id', blastId)
    
    console.log(`Marked blast ${blastId} as failed: ${reason}`)
  } catch (error) {
    console.error(`Error marking blast ${blastId} as failed:`, error)
  }
}