import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TransactionPayload {
  user_id: string
  plan_id: string
  billing_cycle: 'monthly' | 'yearly'
  amount: number
  customer_details: {
    first_name: string
    email: string
    phone?: string
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
      throw new Error('MIDTRANS_SERVER_KEY not configured. Please set it using: supabase secrets set MIDTRANS_SERVER_KEY=your_key')
    }

    const payload: TransactionPayload = await req.json()
    console.log('Creating Midtrans transaction:', payload)

    const { user_id, plan_id, billing_cycle, amount, customer_details } = payload

    const { data: userProfile, error: userError } = await supabase
      .from('user_business_profiles')

      .select('id, whatsapp_number, fonnte_device_id, fonnte_status, user_phone_number, business_name')
      .eq('user_id', user_id)
      .single()

    if (userError) {
      console.error('Error fetching user profile:', userError)
      throw new Error('User profile not found')
    }

    const timestamp = Date.now()
    const orderId = `${user_id.substring(0, 8)}-${plan_id}-${billing_cycle}-${timestamp.toString().slice(-6)}`

    // Midtrans Snap API URL for Sandbox
    const midtransApiUrl = 'https://app.sandbox.midtrans.com/snap/v1/transactions'
    const authString = btoa(`${midtransServerKey}:`) // Base64 encode server key with colon

    // Use user's phone number from profile, fallback to payload, then to default
    const customerPhone = userProfile.user_phone_number || customer_details.phone || '081234567890'

    const transactionData = {
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      item_details: [
        {
          id: plan_id,
          price: amount,
          quantity: 1,
          name: `Solusics.ai ${plan_id.charAt(0).toUpperCase() + plan_id.slice(1)} Plan (${billing_cycle})`,
          category: 'Software Subscription'
        }
      ],
      customer_details: {
        first_name: customer_details.first_name,
        last_name: userProfile.business_name || 'User',
        email: customer_details.email,
        phone: customerPhone,
        billing_address: {
          first_name: customer_details.first_name,
          last_name: userProfile.business_name || 'User',
          email: customer_details.email,
          phone: customerPhone,
          address: 'Indonesia',
          city: 'Jakarta',
          postal_code: '12345',
          country_code: 'IDN'
        },
        shipping_address: {
          first_name: customer_details.first_name,
          last_name: userProfile.business_name || 'User',
          email: customer_details.email,
          phone: customerPhone,
          address: 'Indonesia',
          city: 'Jakarta',
          postal_code: '12345',
          country_code: 'IDN'
        }
      },
      callbacks: {
        finish: `${supabaseUrl}/functions/v1/midtrans-notification`
      },
      enabled_payments: [
        "credit_card", 
        "gopay", 
        "shopeepay", 
        "other_qris",
        "permata_va", 
        "bca_va", 
        "bni_va", 
        "bri_va",
        "echannel",
        "other_va",
        "indomaret",
        "alfamart"
      ],
      credit_card: {
        secure: true,
        channel: "migs",
        bank: "bca",
        installment: {
          required: false,
          terms: {
            bni: [3, 6, 12],
            mandiri: [3, 6, 12],
            cimb: [3],
            bca: [3, 6, 12],
            offline: [6, 12]
          }
        }
      },
      expiry: {
        start_time: new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }).replace('T', ' ') + ' +0700',
        unit: "minutes",
        duration: 60
      }
    }

    console.log('Sending transaction data to Midtrans:', JSON.stringify(transactionData, null, 2))

    const response = await fetch(midtransApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: JSON.stringify(transactionData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Midtrans API error:', response.status, errorText)
      throw new Error(`Midtrans API error: ${response.status} - ${errorText}`)
    }

    const midtransResponse = await response.json()
    console.log('Midtrans response:', midtransResponse)

    if (midtransResponse.token) {
      // Store transaction info in user profile
      await supabase
        .from('user_business_profiles')
        .update({ 
          midtrans_transaction_id: orderId
        })
        .eq('user_id', user_id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          snap_token: midtransResponse.token,
          order_id: orderId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      throw new Error('Failed to get Snap Token from Midtrans')
    }

  } catch (error) {
    console.error('Error creating Midtrans transaction:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})