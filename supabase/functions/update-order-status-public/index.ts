import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

// This function should be deployed with --no-verify-jwt flag to allow public access
// Deploy command: supabase functions deploy update-order-status-public --no-verify-jwt

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UpdateOrderStatusPayload {
  order_id: string
  status: 'pending' | 'paid' | 'cancelled' | 'completed' | 'failed'
  midtrans_transaction_id?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Parse request payload
    const payload: UpdateOrderStatusPayload = await req.json()
    const { order_id, status, midtrans_transaction_id } = payload

    console.log('Updating order status publicly:', { order_id, status, midtrans_transaction_id })

    if (!order_id || order_id.trim() === '') {
      throw new Error('order_id is required')
    }

    if (!status || !['pending', 'paid', 'cancelled', 'completed', 'failed'].includes(status)) {
      throw new Error('Valid status is required')
    }

    // Prepare update data
    const updateData: any = {
      status: status,
      updated_at: new Date().toISOString()
    }

    if (midtrans_transaction_id) {
      updateData.midtrans_transaction_id = midtrans_transaction_id
    }

    // Update order status
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', order_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating order status:', updateError)
      if (updateError.code === 'PGRST116') {
        throw new Error('Order not found')
      }
      throw new Error('Failed to update order status')
    }

    console.log('Order status updated successfully:', updatedOrder)

    // If payment is successful, send WhatsApp notification to business owner
    if (status === 'paid') {
      try {
        await sendPaymentNotificationToBusiness(supabase, order_id)
      } catch (notificationError) {
        console.warn('Failed to send payment notification to business:', notificationError)
        // Don't throw error here as the main operation (updating status) was successful
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        order: updatedOrder,
        message: 'Order status updated successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in update-order-status-public:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: error.message === 'Order not found' ? 404 : 500
      }
    )
  }
})

async function sendPaymentNotificationToBusiness(supabase: any, orderId: string): Promise<void> {
  try {
    console.log('Sending payment notification to business for order:', orderId)

    // Get order details with business profile
    const { data: orderWithBusiness, error: fetchError } = await supabase
      .from('orders')
      .select(`
        id,
        total_amount,
        user_business_profiles (
          business_name,
          whatsapp_number,
          fonnte_device_token,
          fonnte_device_id
        ),
        whatsapp_users (
          whatsapp_number,
          customer_name
        ),
        order_items (
          quantity,
          price_at_order,
          products (
            name
          )
        )
      `)
      .eq('id', orderId)
      .single()

    if (fetchError || !orderWithBusiness) {
      console.error('Error fetching order for notification:', fetchError)
      return
    }

    const businessProfile = orderWithBusiness.user_business_profiles
    const customerInfo = orderWithBusiness.whatsapp_users

    if (!businessProfile?.fonnte_device_token || !businessProfile?.whatsapp_number) {
      console.log('Business WhatsApp not configured, skipping notification')
      return
    }

    // Build notification message
    let notificationMessage = `🎉 *PEMBAYARAN BERHASIL!*\n\n`
    notificationMessage += `📋 *Pesanan:* #${orderId.substring(0, 8)}\n`
    notificationMessage += `👤 *Pelanggan:* ${customerInfo?.customer_name || customerInfo?.whatsapp_number || 'Tidak dikenal'}\n`
    notificationMessage += `💰 *Total:* Rp ${parseFloat(orderWithBusiness.total_amount.toString()).toLocaleString('id-ID')}\n\n`
    
    if (orderWithBusiness.order_items && orderWithBusiness.order_items.length > 0) {
      notificationMessage += `📦 *Item Pesanan:*\n`
      orderWithBusiness.order_items.forEach((item: any, index: number) => {
        notificationMessage += `${index + 1}. ${item.products?.name || 'Produk'} x${item.quantity}\n`
      })
      notificationMessage += `\n`
    }
    
    notificationMessage += `✅ Pembayaran telah dikonfirmasi. Silakan proses pesanan pelanggan.`

    // Send WhatsApp message to business
    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': businessProfile.fonnte_device_token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        target: businessProfile.whatsapp_number,
        message: notificationMessage,
        countryCode: '62',
        device: businessProfile.fonnte_device_id
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to send WhatsApp notification:', response.status, errorText)
    } else {
      console.log('Payment notification sent to business successfully')
    }

  } catch (error) {
    console.error('Error sending payment notification to business:', error)
    throw error
  }
}