export interface PaymentResult {
  success: boolean
  qr_code_url?: string
  order_id?: string
  transaction_id?: string
  error?: string
}

export interface StorageResult {
  success: boolean
  png_url?: string
  storage_path?: string
  file_size?: number
  error?: string
}

/**
 * Create order payment through Midtrans
 */
export async function createOrderPayment(
  userId: string,
  whatsappUserId: string,
  orderItems: Array<{
    product_id: string
    product_name: string
    quantity: number
    price: number
  }>,
  totalAmount: number,
  customerName: string
): Promise<PaymentResult> {
  try {
    console.log('Creating order payment via create-order-payment function...')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const response = await fetch(`${supabaseUrl}/functions/v1/create-order-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        user_id: userId,
        whatsapp_user_id: whatsappUserId,
        order_items: orderItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          price_at_order: item.price
        })),
        total_amount: totalAmount,
        customer_details: {
          first_name: customerName,
          email: `customer_${userId.substring(0, 8)}@temp.com`,
          phone: '081234567890'
        }
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Failed to create payment:', response.status, errorText)
      throw new Error(`Payment creation failed: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    console.log('Payment creation result:', result)
    
    return result
  } catch (error) {
    console.error('Error creating order payment:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Store Midtrans QR code as PNG in Supabase Storage
 */
export async function storeMidtransQrCodeAsPng(
  supabase: any,
  midtransQrCodeUrl: string,
  orderId: string
): Promise<StorageResult> {
  try {
    console.log('Fetching QR code PNG from Midtrans URL:', midtransQrCodeUrl)
    
    const response = await fetch(midtransQrCodeUrl)
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch QR code from Midtrans: ${response.status} - ${errorText}`)
    }

    const contentType = response.headers.get('content-type')
    console.log('Midtrans QR code content type:', contentType)
    
    if (!contentType || !contentType.includes('image/png')) {
      console.warn('Midtrans QR code URL did not return PNG, got:', contentType)
      // Continue anyway, might still work
    }

    const pngBuffer = new Uint8Array(await response.arrayBuffer())
    console.log('QR code PNG fetched from Midtrans, size:', pngBuffer.length, 'bytes')

    // Upload to Supabase Storage
    const timestamp = Date.now()
    const storagePath = `qr-codes/order-${orderId}-${timestamp}.png`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('public-files')
      .upload(storagePath, pngBuffer, {
        contentType: 'image/png',
        cacheControl: '3600', // Cache for 1 hour
        upsert: true
      })

    if (uploadError) {
      console.error('Error uploading QR code to Supabase Storage:', uploadError)
      throw new Error(`Failed to upload QR code to storage: ${uploadError.message}`)
    }

    console.log('QR code uploaded to Supabase Storage successfully:', uploadData)

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('public-files')
      .getPublicUrl(storagePath)

    const publicUrl = publicUrlData.publicUrl
    console.log('QR code PNG public URL generated:', publicUrl)

    return { 
      success: true, 
      png_url: publicUrl,
      storage_path: storagePath,
      file_size: pngBuffer.length
    }

  } catch (error) {
    console.error('Error in storeMidtransQrCodeAsPng:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Send internal order notification to business team
 */
export async function sendInternalOrderNotification(
  supabase: any,
  orderId: string,
  cartData: any,
  businessProfile: any
): Promise<void> {
  try {
    if (!businessProfile?.fonnte_device_token || !businessProfile?.whatsapp_number) {
      console.log('Business WhatsApp not configured, skipping internal notification')
      return
    }

    let notificationMessage = `🔔 *PESANAN BARU MASUK!*\n\n`
    notificationMessage += `📋 *ID Pesanan:* #${orderId.substring(0, 8)}\n`
    notificationMessage += `👤 *Pelanggan:* ${cartData.customer_name || 'Tidak dikenal'}\n`
    notificationMessage += `📱 *HP:* ${cartData.phone_number || 'Tidak tersedia'}\n`
    notificationMessage += `📍 *Outlet:* ${cartData.outlet_preference || 'Tidak disebutkan'}\n`
    notificationMessage += `🚗 *Metode:* ${cartData.delivery_method === 'pickup' ? 'Ambil sendiri' : 'Delivery'}\n`
    notificationMessage += `💰 *Total:* Rp ${cartData.total_amount.toLocaleString('id-ID')}\n\n`
    
    if (cartData.items && cartData.items.length > 0) {
      notificationMessage += `🍣 *Menu:*\n`
      cartData.items.forEach((item: any, index: number) => {
        notificationMessage += `${index + 1}. ${item.product_name} x${item.quantity}\n`
      })
      notificationMessage += `\n`
    }
    
    notificationMessage += `⏰ Pesanan menunggu pembayaran. Akan dikonfirmasi otomatis setelah customer bayar.`

    // Send notification to business WhatsApp
    await sendWhatsAppMessage(
      businessProfile.whatsapp_number,
      notificationMessage,
      businessProfile.fonnte_device_id,
      businessProfile.fonnte_device_token
    )

    console.log('Internal order notification sent to business successfully')
  } catch (error) {
    console.error('Error sending internal order notification:', error)
    // Don't throw error here as it's not critical to the main flow
  }
}

/**
 * Send WhatsApp message
 */
export async function sendWhatsAppMessage(
  to: string, 
  message: string, 
  deviceId?: string, 
  deviceToken?: string
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

/**
 * Send WhatsApp message with image attachment
 */
export async function sendWhatsAppMessageWithImage(
  to: string, 
  message: string, 
  imageUrl: string, 
  deviceId?: string, 
  deviceToken?: string
): Promise<void> {
  if (!deviceToken || deviceToken.trim() === '') {
    console.error('Device token not available - cannot send WhatsApp message with image')
    throw new Error('Device token not available. WhatsApp device may not be connected or registered properly.')
  }

  console.log('Sending WhatsApp message with image to:', to)
  console.log('Image URL:', imageUrl)
  
  try {
    const requestBody: any = {
      target: to,
      message: message,
      url: imageUrl,
      filename: 'qr-gopay.png',
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
      console.error('Failed to send WhatsApp message with image:', response.status, response.statusText)
      console.error('FonNte API error response:', errorText)
      throw new Error(`FonNte API error: ${response.status} - ${errorText}`)
    } else {
      const responseData = await response.text()
      console.log('WhatsApp message with image sent successfully:', responseData)
    }
  } catch (error) {
    console.error('Error sending WhatsApp message with image:', error)
    throw error
  }
}

/**
 * Send internal order notification to business team
 */
export async function sendInternalOrderNotification(
  supabase: any,
  orderId: string,
  orderData: any,
  businessProfile: any
): Promise<void> {
  try {
    if (!businessProfile?.fonnte_device_token || !businessProfile?.whatsapp_number) {
      console.log('Business WhatsApp not configured, skipping internal notification')
      return
    }

    let notificationMessage = `🔔 *PESANAN BARU MASUK!*\n\n`
    notificationMessage += `📋 *ID Pesanan:* #${orderId.substring(0, 8)}\n`
    notificationMessage += `👤 *Pelanggan:* ${orderData.customer_name || 'Tidak dikenal'}\n`
    notificationMessage += `📱 *HP:* ${orderData.phone_number || 'Tidak tersedia'}\n`
    notificationMessage += `📍 *Outlet:* ${orderData.outlet_preference || 'Tidak disebutkan'}\n`
    notificationMessage += `🚗 *Metode:* ${orderData.delivery_method === 'pickup' ? 'Ambil sendiri' : 'Delivery'}\n`
    notificationMessage += `💰 *Total:* Rp ${orderData.total_amount.toLocaleString('id-ID')}\n\n`
    
    if (orderData.items && orderData.items.length > 0) {
      notificationMessage += `🍣 *Menu:*\n`
      orderData.items.forEach((item: any, index: number) => {
        notificationMessage += `${index + 1}. ${item.product_name} x${item.quantity}\n`
      })
      notificationMessage += `\n`
    }
    
    notificationMessage += `⏰ Pesanan menunggu pembayaran. Akan dikonfirmasi otomatis setelah customer bayar.`

    // Send notification to business WhatsApp
    await sendWhatsAppMessage(
      businessProfile.whatsapp_number,
      notificationMessage,
      businessProfile.fonnte_device_id,
      businessProfile.fonnte_device_token
    )

    console.log('Internal order notification sent to business successfully')
  } catch (error) {
    console.error('Error sending internal order notification:', error)
    // Don't throw error here as it's not critical to the main flow
  }
}