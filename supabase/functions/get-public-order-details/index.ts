import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

// This function should be deployed with --no-verify-jwt flag to allow public access
// Deploy command: supabase functions deploy get-public-order-details --no-verify-jwt

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GetOrderPayload {
  order_id: string
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
    const payload: GetOrderPayload = await req.json()
    const { order_id } = payload

    console.log('Fetching public order details for order_id:', order_id)

    if (!order_id || order_id.trim() === '') {
      throw new Error('order_id is required')
    }

    // Fetch order details with order items and product information
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        total_amount,
        status,
        payment_method,
        midtrans_transaction_id,
        created_at,
        updated_at,
        order_items (
          id,
          quantity,
          price_at_order,
          products (
            name,
            price
          )
        ),
        user_business_profiles (
          business_name
        )
      `)
      .eq('id', order_id)
      .single()

    if (orderError) {
      console.error('Error fetching order:', orderError)
      if (orderError.code === 'PGRST116') {
        throw new Error('Order not found')
      }
      throw new Error('Failed to fetch order details')
    }

    if (!order) {
      throw new Error('Order not found')
    }

    if (orderError) {
  console.error('Error fetching order:', orderError); // Baris ini yang diperbaiki
  if (orderError.code === 'PGRST116') {
    throw new Error('Order not found');
  }
  throw new Error('Failed to fetch order details');
}

    // Transform the data for frontend consumption
    
    const orderDetails = {
      id: order.id,
      total_amount: order.total_amount,
      status: order.status,
      payment_method: order.payment_method,
      created_at: order.created_at,
      business_name: order.user_business_profiles?.business_name,
      order_items: order.order_items?.map(item => ({
        id: item.id,
        quantity: item.quantity,
        price_at_order: item.price_at_order,
        product_name: item.products?.name || 'Produk Tidak Dikenal'
      })) || []
    }

    console.log('Order details fetched successfully:', orderDetails)

    return new Response(
      JSON.stringify({
        success: true,
        order: orderDetails
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in get-public-order-details:', error)
    
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