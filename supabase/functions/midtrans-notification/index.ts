import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendWhatsAppMessage(
  to: string, 
  message: string, 
  deviceToken: string, 
  deviceId?: string
): Promise<void> {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY')
    if (!midtransServerKey) {
      throw new Error('MIDTRANS_SERVER_KEY not configured')
    }

    const notification = await req.json()
    console.log('Midtrans Notification Received:', notification)

    const {
      order_id,
      transaction_status,
      gross_amount,
      signature_key,
      status_code,
      fraud_status,
      payment_type,
      transaction_id,
    } = notification

    // Verify signature key
    const encoder = new TextEncoder()
    const encodedData = encoder.encode(order_id + status_code + gross_amount + midtransServerKey)
    const hashBuffer = await crypto.subtle.digest('SHA-512', encodedData)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const hashedSignature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

    if (hashedSignature !== signature_key) {
      console.warn('Invalid Midtrans signature key')
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid signature key' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Check if order_id is a UUID (product order) or composite string (plan subscription)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    const isProductOrder = uuidRegex.test(order_id)

    if (isProductOrder) {
      // Handle product order payment
      console.log('Processing product order payment for order_id:', order_id)
      
      // Fetch order details
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          user_id,
          whatsapp_user_id,
          total_amount,
          status,
          whatsapp_users!inner (
            whatsapp_number,
            customer_name
          )
        `)
        .eq('id', order_id)
        .single()

      if (orderError || !order) {
        console.error('Order not found for order_id:', order_id, orderError)
        return new Response(
          JSON.stringify({ success: false, message: 'Order not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      // Fetch business profile separately using user_id from order
      const { data: businessProfile, error: businessProfileError } = await supabase
        .from('user_business_profiles')
        .select('business_name, fonnte_device_id, fonnte_device_token, whatsapp_number')
        .eq('user_id', order.user_id)
        .single()

      if (businessProfileError || !businessProfile) {
        console.error('Business profile not found for user_id:', order.user_id, businessProfileError)
        return new Response(
          JSON.stringify({ success: false, message: 'Business profile not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        )
      }

      // Determine new order status based on transaction status
      let newOrderStatus = 'pending'
      let shouldSendThankYouMessage = false

      switch (transaction_status) {
        case 'capture':
        case 'settlement':
          if (fraud_status === 'accept' || !fraud_status) {
            newOrderStatus = 'paid'
            shouldSendThankYouMessage = true
            console.log(`Product order payment successful for order ${order_id}`)
          } else if (fraud_status === 'challenge') {
            newOrderStatus = 'pending'
            console.warn(`Product order payment challenged for order ${order_id}`)
          } else {
            newOrderStatus = 'failed'
            console.error(`Product order payment fraud detected for order ${order_id}`)
          }
          break
        case 'pending':
          newOrderStatus = 'pending'
          console.log(`Product order payment pending for order ${order_id}`)
          break
        case 'deny':
        case 'cancel':
        case 'expire':
        case 'failure':
          newOrderStatus = 'failed'
          console.warn(`Product order payment failed for order ${order_id}. Status: ${transaction_status}`)
          break
        default:
          console.warn(`Unhandled transaction status for product order: ${transaction_status}`)
          break
      }

      // Update order status
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update({
          status: newOrderStatus,
          midtrans_transaction_id: transaction_id || order_id
        })
        .eq('id', order_id)

      if (updateOrderError) {
        console.error('Error updating order status:', updateOrderError)
        throw updateOrderError
      }

      console.log(`Updated order ${order_id} status to: ${newOrderStatus}`)

      // Reset current_order_data in user_business_profiles after successful payment
      if (shouldSendThankYouMessage) {
        console.log('Clearing cart for whatsapp_user after successful payment:', order.whatsapp_user_id)
        const { error: resetCartError } = await supabase
          .from('cart_orders')
          .update({
            step: 'completed',
            items: [],
            total_amount: 0
          })
          .eq('user_id', order.user_id)
          .eq('whatsapp_user_id', order.whatsapp_user_id)

        if (resetCartError) {
          console.error('Error clearing cart after payment:', resetCartError)
          // Don't throw error here as the main payment processing was successful
        } else {
          console.log('Successfully cleared cart for whatsapp_user:', order.whatsapp_user_id)
        }
      }

      // Send thank you message to customer if payment successful
      if (shouldSendThankYouMessage && businessProfile && order.whatsapp_users) {
        const customerInfo = order.whatsapp_users

        if (businessProfile.fonnte_device_token && customerInfo.whatsapp_number) {
          try {
            const customerName = customerInfo.customer_name || 'Pelanggan'
            const businessName = businessProfile.business_name || 'Kami'
            const orderIdShort = order_id.substring(0, 8)
            const totalAmount = parseFloat(order.total_amount.toString()).toLocaleString('id-ID')

            const thankYouMessage = `🎉 *PEMBAYARAN BERHASIL!*\n\n` +
              `Terima kasih ${customerName}! Pembayaran Anda telah kami terima.\n\n` +
              `📋 *Detail Pesanan:*\n` +
              `• ID Pesanan: #${orderIdShort}\n` +
              `• Total: Rp ${totalAmount}\n` +
              `• Status: Sedang Diproses\n\n` +
              `⏳ Pesanan Anda sedang kami proses dan akan segera disiapkan.\n\n` +
              `📞 Jika ada pertanyaan, jangan ragu untuk menghubungi kami.\n\n` +
              `Terima kasih telah mempercayai ${businessName}! 🙏`

            await sendWhatsAppMessage(
              customerInfo.whatsapp_number,
              thankYouMessage,
              businessProfile.fonnte_device_token,
              businessProfile.fonnte_device_id
            )

            console.log('Thank you message sent to customer successfully')
          } catch (messageError) {
            console.error('Failed to send thank you message to customer:', messageError)
            // Don't throw error here as the main payment processing was successful
          }
        } else {
          console.warn('Cannot send thank you message: missing device token or customer WhatsApp number')
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Product order payment processed successfully',
          order_id: order_id,
          transaction_status: transaction_status,
          new_order_status: newOrderStatus,
          thank_you_sent: shouldSendThankYouMessage
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )

    } else {
      // Handle plan subscription payment (existing logic)
      console.log('Processing plan subscription payment for order_id:', order_id)
      
      // Parse order_id to get user_id and plan_id
      const orderIdParts = order_id.split('-')
      if (orderIdParts.length < 4) {
        console.error('Invalid order_id format:', order_id)
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid order_id format' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }

      const userId = orderIdParts[0]
      const planId = orderIdParts[1]
      const billingCycle = orderIdParts[2]

      // Validate userId is a valid UUID
      if (!uuidRegex.test(userId)) {
        console.warn('Invalid UUID format for userId:', userId, 'from order_id:', order_id)
        console.log('This appears to be a test notification from Midtrans - ignoring gracefully')
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Test notification ignored - invalid UUID format',
            order_id: order_id,
            extracted_user_id: userId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )
      }

      let pricingCompleted = false
      let message = 'Payment status updated'

      // Handle different transaction statuses
      switch (transaction_status) {
        case 'capture':
        case 'settlement':
          if (fraud_status === 'accept' || !fraud_status) {
            pricingCompleted = true
            message = 'Payment successful and settled'
            console.log(`Payment successful for order ${order_id}`)
          } else if (fraud_status === 'challenge') {
            message = 'Payment challenged, manual review needed'
            console.warn(`Payment challenged for order ${order_id}`)
          } else {
            message = 'Payment fraud detected'
            console.error(`Payment fraud detected for order ${order_id}`)
          }
          break
        case 'pending':
          message = 'Payment pending'
          console.log(`Payment pending for order ${order_id}`)
          break
        case 'deny':
        case 'cancel':
        case 'expire':
        case 'failure':
          message = 'Payment failed or cancelled'
          console.warn(`Payment failed for order ${order_id}. Status: ${transaction_status}`)
          break
        default:
          message = `Unhandled transaction status: ${transaction_status}`
          console.warn(message)
          break
      }

      // Update user business profile
      const updateData: any = {
        midtrans_transaction_id: transaction_id || order_id
      }

      if (pricingCompleted) {
        updateData.pricing_completed = true
        updateData.selected_plan = planId
        updateData.plan_status = 'active'
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        console.error('Error updating user business profile:', error)
        throw error
      }

      console.log(`Updated user ${userId} profile:`, data)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: message,
          order_id: order_id,
          transaction_status: transaction_status,
          pricing_completed: pricingCompleted
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

  } catch (error) {
    console.error('Error processing Midtrans notification:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})