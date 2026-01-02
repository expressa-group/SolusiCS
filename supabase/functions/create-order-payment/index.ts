import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderPaymentPayload {
  user_id: string
  whatsapp_user_id: string
  order_items: Array<{
    product_id: string
    quantity: number
    price_at_order: number
  }>
  total_amount: number
  customer_details: {
    first_name: string
    email: string
    phone?: string
  }
}

serve(async (req) => {
  console.log('=== Create Order Payment Function Started ===')
  console.log('Request method:', req.method)
  console.log('Request headers:', Object.fromEntries(req.headers.entries()))
  
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Step 1: Initializing Supabase client...')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    console.log('Supabase client initialized successfully')

    console.log('Step 2: Checking Midtrans server key...')
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY')
    if (!midtransServerKey) {
      console.error('MIDTRANS_SERVER_KEY environment variable not found')
      throw new Error('MIDTRANS_SERVER_KEY not configured')
    }
    console.log('Midtrans server key found (length:', midtransServerKey.length, ')')

    console.log('Step 3: Parsing request payload...')
    const payload: OrderPaymentPayload = await req.json()
    console.log('Received payload:', JSON.stringify(payload, null, 2))

    const { user_id, whatsapp_user_id, order_items, total_amount, customer_details } = payload
    
    // Validate required fields
    if (!user_id || !whatsapp_user_id || !order_items || !total_amount) {
      console.error('Missing required fields in payload')
      throw new Error('Missing required fields: user_id, whatsapp_user_id, order_items, or total_amount')
    }
    
    if (!Array.isArray(order_items) || order_items.length === 0) {
      console.error('Invalid or empty order_items array')
      throw new Error('order_items must be a non-empty array')
    }
    
    console.log('Payload validation passed')

    console.log('Step 4: Fetching user business profile for user_id:', user_id)
    const { data: userProfile, error: userProfileError } = await supabase
      .from('user_business_profiles')
      .select('business_name, user_phone_number')
      .eq('user_id', user_id)
      .single()

    if (userProfileError || !userProfile) {
      console.error('Error fetching user business profile:', userProfileError)
      console.error('User ID that failed:', user_id)
      throw new Error('User profile not found')
    }
    console.log('User business profile fetched successfully:', userProfile)

    console.log('Step 5: Fetching buyer WhatsApp user details for whatsapp_user_id:', whatsapp_user_id)
    const { data: buyerWhatsappUser, error: buyerError } = await supabase
      .from('whatsapp_users')
      .select('whatsapp_number, customer_name')
      .eq('id', whatsapp_user_id)
      .single()

    if (buyerError || !buyerWhatsappUser) {
      console.error('Error fetching buyer WhatsApp user:', buyerError)
      console.error('WhatsApp user ID that failed:', whatsapp_user_id)
      throw new Error('Buyer WhatsApp user not found')
    }
    console.log('Buyer WhatsApp user fetched successfully:', buyerWhatsappUser)

    console.log('Step 6: Preparing customer details...')
    const buyerPhoneNumber = buyerWhatsappUser.whatsapp_number || '081234567890' // Fallback
    const buyerFirstName = buyerWhatsappUser.customer_name || `Pembeli ${buyerPhoneNumber.slice(-4)}` // Example: Pembeli 7890
    console.log('Customer details prepared - Phone:', buyerPhoneNumber, 'Name:', buyerFirstName)

    console.log('Step 7: Creating order record...')
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user_id,
        whatsapp_user_id: whatsapp_user_id,
        total_amount: total_amount,
        status: 'pending',
        payment_method: 'midtrans_snap'
      })
      .select()
      .single()

    if (orderError || !newOrder) {
      console.error('Error creating order record:', orderError)
      console.error('Order data that failed:', { user_id, whatsapp_user_id, total_amount })
      throw new Error('Failed to create order')
    }
    console.log('Order record created successfully:', newOrder)

    console.log('Step 8: Preparing order items data...')
    console.log('Order items to process:', order_items)
    
    const orderItemsData = order_items.map(item => ({
      order_id: newOrder.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price_at_order: item.price_at_order
    }))

    console.log('Order items data prepared:', orderItemsData)
    console.log('Step 9: Inserting order items...')
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) {
      console.error('Error creating order items:', itemsError)
      console.error('Order items data that failed:', orderItemsData)
      throw new Error('Failed to create order items')
    }
    console.log('Order items created successfully')

    console.log('Step 10: Preparing Midtrans transaction...')
    const orderId = newOrder.id
    const midtransApiUrl = 'https://api.sandbox.midtrans.com/v2/charge'
    const authString = btoa(`${midtransServerKey}:`)
    console.log('Midtrans API URL:', midtransApiUrl)
    console.log('Order ID for Midtrans:', orderId)

    console.log('Step 11: Building transaction data...')
    const transactionData = {
      payment_type: "qris",
      transaction_details: {
        order_id: orderId,
        gross_amount: total_amount,
      },
      qris: {
        acquirer: "gopay"
      },
      item_details: order_items.map((item, index) => ({
        id: item.product_id || `item_${index + 1}`,
        price: item.price_at_order,
        quantity: item.quantity,
        name: `Product ${index + 1}`, // Will be updated with actual product name if available
        category: 'Food & Beverage'
      })),
      customer_details: {
        first_name: buyerFirstName,
        last_name: userProfile.business_name || 'Customer',
        email: 'developer@swadigitalsolusindo.com',
        phone: buyerPhoneNumber,
        billing_address: {
          first_name: buyerFirstName,
          last_name: userProfile.business_name || 'Customer',
          email: 'developer@swadigitalsolusindo.com',
          phone: buyerPhoneNumber,
          address: 'Indonesia',
          city: 'Jakarta',
          postal_code: '12345',
          country_code: 'IDN'
        }
      },
      custom_expiry: {
        expiry_duration: 60,
        unit: "minute"
      }
    }
    
    console.log('Transaction data built:', JSON.stringify(transactionData, null, 2))

    console.log('Step 12: Fetching product names for better item details...')
    try {
      const productIds = order_items.map(item => item.product_id)
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds)
      
      if (products && products.length > 0) {
        transactionData.item_details = transactionData.item_details.map(item => {
          const product = products.find(p => p.id === item.id)
          return { ...item, name: product?.name || item.name }
        })
        console.log('Updated item details with product names:', transactionData.item_details)
      }
    } catch (productError) {
      console.warn('Could not fetch product names, using default names:', productError)
    }

    console.log('Step 13: Sending transaction data to Midtrans...')
    console.log('Midtrans API URL:', midtransApiUrl)
    console.log('Authorization header (first 20 chars):', `Basic ${authString}`.substring(0, 20) + '...')
    console.log('Full transaction data being sent to Midtrans:', JSON.stringify(transactionData, null, 2))
    
    const response = await fetch(midtransApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(transactionData),
    })

    console.log('Step 14: Processing Midtrans API response...')
    console.log('Midtrans API raw response status:', response.status)
    console.log('Midtrans API raw response status text:', response.statusText)
    console.log('Midtrans API response headers:', Object.fromEntries(response.headers.entries()))
    
    // Read response body as text first (can only be read once)
    const rawResponseText = await response.text()
    console.log('Midtrans API raw response body:', rawResponseText)
    console.log('Midtrans API raw response body length:', rawResponseText.length)
    
    if (!response.ok) {
      console.error('Midtrans API error response status:', response.status)
      console.error('Midtrans API error response text:', rawResponseText)
      console.error('Transaction data that was sent:', JSON.stringify(transactionData, null, 2))
      console.error('Server key used (first 10 chars):', midtransServerKey.substring(0, 10) + '...')
      throw new Error(`Midtrans API error: ${response.status} - ${rawResponseText}`)
    }

    // Parse the response text as JSON
    let midtransResponse
    try {
      midtransResponse = JSON.parse(rawResponseText)
      console.log('Successfully parsed Midtrans response as JSON')
    } catch (parseError) {
      console.error('Failed to parse Midtrans response as JSON:', parseError)
      console.error('Raw response that failed to parse:', rawResponseText)
      throw new Error(`Invalid JSON response from Midtrans: ${parseError.message}`)
    }
    
    console.log('Midtrans response received successfully:', JSON.stringify(midtransResponse, null, 2))

    if (midtransResponse.transaction_status === 'pending' && midtransResponse.actions) {
      console.log('Step 15: QRIS transaction created successfully')
      
      // Find the QR code action
      const qrAction = midtransResponse.actions.find((action: any) => action.name === 'generate-qr-code')
      
      if (!qrAction || !qrAction.url) {
        console.error('QR code URL not found in Midtrans response')
        console.error('Available actions:', midtransResponse.actions)
        throw new Error('QR code URL not found in Midtrans response')
      }
      
      const qrCodeUrl = qrAction.url
      console.log('QR Code URL received:', qrCodeUrl)

      console.log('Step 16: Updating order with Snap URL...')
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          midtrans_snap_url: qrCodeUrl,
          midtrans_transaction_id: midtransResponse.transaction_id || orderId,
          status: 'pending'
        })
        .eq('id', orderId)

      if (updateError) {
        console.error('Error updating order with Snap URL:', updateError)
        console.error('Order ID that failed to update:', orderId)
        throw new Error('Failed to update order with QR URL')
      }
      console.log('Order updated successfully with QR URL')

      console.log('=== Create Order Payment Function Completed Successfully ===')
      return new Response(
        JSON.stringify({ 
          success: true, 
          qr_code_url: qrCodeUrl,
          transaction_id: midtransResponse.transaction_id,
          order_id: orderId,
          total_amount: total_amount,
          payment_type: 'qris_gopay'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      console.error('Midtrans QRIS response invalid or missing QR actions')
      console.error('Full Midtrans response:', JSON.stringify(midtransResponse, null, 2))
      console.error('Transaction status:', midtransResponse.transaction_status)
      console.error('Available actions:', midtransResponse.actions)
      console.error('Response type:', typeof midtransResponse)
      throw new Error('Failed to get QR Code URL from Midtrans QRIS')
    }

  } catch (error) {
    console.error('=== Create Order Payment Function Failed ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    console.error('Error occurred at timestamp:', new Date().toISOString())
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        error_type: error.constructor.name,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})