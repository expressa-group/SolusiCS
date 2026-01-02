import { performRAGSearch, generateGeminiResponse, buildAIContextWithRAG, BusinessProfile } from '../../utils/ai_utils.ts'
import { 
  parseOrderItemsFromMessage, 
  parseCustomerDetails, 
  detectOrderingIntent,
  generateMenuDisplay,
  validateOrderCompleteness,
  ParsedOrderItem 
} from './order_parser.ts'
import { 
  createOrderPayment, 
  sendWhatsAppMessage, 
  sendWhatsAppMessageWithImage,
  storeMidtransQrCodeAsPng,
  sendInternalOrderNotification
} from './order_external_services.ts'

export interface CartOrder {
  id: string
  user_id: string
  whatsapp_user_id: string
  step: 'browsing' | 'collecting_items' | 'collecting_details' | 'confirming_order' | 'awaiting_payment' | 'completed'
  items: Array<{
    product_id: string
    product_name: string
    quantity: number
    price: number
  }>
  total_amount: number
  customer_name?: string
  phone_number?: string
  outlet_preference?: string
  delivery_method?: 'pickup' | 'delivery'
  special_requests?: string
  created_at?: string
  updated_at?: string
}

export async function handleOrderingLogic(
  supabase: any,
  geminiApiKey: string,
  userId: string,
  whatsappUserId: string,
  message: string,
  customerWhatsappNumber: string,
  customerName: string | null,
  businessProfile: BusinessProfile | null,
  conversationHistory: Array<{
    message_type: 'incoming' | 'outgoing'
    message_content: string
    ai_response?: string
    created_at: string
  }> = []
): Promise<{ response: string }> {
  
  console.log('=== Order Logic Started ===')
  console.log('Input parameters:', {
    userId,
    whatsappUserId,
    message: message.substring(0, 100),
    customerName,
    businessName: businessProfile?.business_name,
    conversationHistoryLength: conversationHistory.length
  })
  
  const lowerMessage = message.toLowerCase().trim()
  
  // Handle cancellation/reset at any step
  if (lowerMessage.includes('batal') || lowerMessage.includes('cancel') || lowerMessage.includes('ulang')) {
    console.log('Cancellation detected, clearing cart')
    await clearCart(supabase, userId, whatsappUserId)
    return {
      response: "Pesanan dibatalkan. Silakan ketik 'menu' untuk melihat daftar menu kami atau ada yang bisa saya bantu? 🍣"
    }
  }

  // Get or create cart for this customer
  let cart: CartOrder
  try {
    cart = await getOrCreateCart(supabase, userId, whatsappUserId)
    console.log('Current cart state:', cart)
    
    // Validate cart object
    if (!cart || typeof cart !== 'object') {
      console.error('Invalid cart object received:', cart)
      throw new Error('Failed to get valid cart object')
    }
    
    // Ensure cart has required properties
    if (!cart.step) {
      console.warn('Cart missing step property, setting to browsing')
      cart.step = 'browsing'
      cart = await updateCart(supabase, cart.id, { step: 'browsing' })
    }
    
    if (!cart.items) {
      console.warn('Cart missing items array, initializing')
      cart.items = []
    }
    
    if (typeof cart.total_amount !== 'number') {
      console.warn('Cart missing total_amount, setting to 0')
      cart.total_amount = 0
    }
    
  } catch (cartError) {
    console.error('Error getting or creating cart:', cartError)
    // Fallback: create a minimal cart object and try to save it
    try {
      const fallbackCart = {
        user_id: userId,
        whatsapp_user_id: whatsappUserId,
        step: 'browsing' as const,
        items: [],
        total_amount: 0
      }
      
      const { data: newCart, error: createError } = await supabase
        .from('cart_orders')
        .insert(fallbackCart)
        .select()
        .single()
      
      if (createError) {
        console.error('Failed to create fallback cart:', createError)
        // Return general AI response as final fallback
        const relevantDocuments = await performRAGSearch(geminiApiKey, userId, message)
        const aiContext = buildAIContextWithRAG(businessProfile, relevantDocuments, customerName)
        const response = await generateGeminiResponse(geminiApiKey, aiContext, message)
        return { response }
      }
      
      cart = newCart
      console.log('Created fallback cart successfully:', cart)
    } catch (fallbackError) {
      console.error('Fallback cart creation also failed:', fallbackError)
      // Final fallback: return general AI response
      const relevantDocuments = await performRAGSearch(geminiApiKey, userId, message)
      const aiContext = buildAIContextWithRAG(businessProfile, relevantDocuments, customerName)
      const response = await generateGeminiResponse(geminiApiKey, aiContext, message)
      return { response }
    }
  }
  
  // Detect intent first
  const intentResult = detectOrderingIntent(message)
  console.log('Detected intent:', intentResult)
  
  console.log('Processing cart step:', cart.step)
  
  // Handle different order steps
  switch (cart.step) {
    case 'browsing':
      console.log('Handling browsing state')
      return await handleBrowsingState(
        supabase, geminiApiKey, userId, whatsappUserId, message, intentResult, businessProfile, customerName, cart, conversationHistory
      )

    case 'collecting_items':
      console.log('Handling collecting items state')
      return await handleCollectingItemsState(
        supabase, userId, whatsappUserId, message, cart
      )

    case 'collecting_details':
      console.log('Handling collecting details state')
      return await handleCollectingDetailsState(
        supabase, userId, whatsappUserId, message, cart
      )

    case 'confirming_order':
      console.log('Handling confirming order state')
      return await handleConfirmingOrderState(
        supabase, userId, whatsappUserId, message, cart, 
        customerWhatsappNumber, businessProfile
      )

    case 'awaiting_payment':
      console.log('Handling awaiting payment state')
      return await handleAwaitingPaymentState(supabase, userId, whatsappUserId, cart)

    default:
      console.log('Unknown cart step, resetting to browsing:', cart.step)
      await clearCart(supabase, userId, whatsappUserId)
      return {
        response: "Halo! Selamat datang! Saya asisten virtual Anda. Ada yang bisa saya bantu hari ini? 🍣"
      }
  }
}

async function getOrCreateCart(supabase: any, userId: string, whatsappUserId: string): Promise<CartOrder> {
  try {
    console.log('Getting or creating cart for:', { userId, whatsappUserId })
    
    // Try to find existing active cart
    const { data: existingCart, error: findError } = await supabase
      .from('cart_orders')
      .select('*')
      .eq('user_id', userId)
      .eq('whatsapp_user_id', whatsappUserId)
      .neq('step', 'completed')
      .maybeSingle()

    if (findError && findError.code !== 'PGRST116') {
      console.error('Error finding existing cart:', findError)
      throw findError
    }

    if (existingCart) {
      console.log('Found existing cart:', existingCart)
      
      // Validate existing cart structure
      if (!existingCart.step) {
        console.warn('Existing cart missing step, updating to browsing')
        const { data: updatedCart, error: updateError } = await supabase
          .from('cart_orders')
          .update({ step: 'browsing' })
          .eq('id', existingCart.id)
          .select()
          .single()
        
        if (updateError) {
          console.error('Error updating cart step:', updateError)
          throw updateError
        }
        
        return updatedCart
      }
      
      return existingCart
    }

    console.log('No existing cart found, creating new one')
    // Create new cart if none exists
    const { data: newCart, error: createError } = await supabase
      .from('cart_orders')
      .insert({
        user_id: userId,
        whatsapp_user_id: whatsappUserId,
        step: 'browsing',
        items: [],
        total_amount: 0
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating new cart:', createError)
      throw createError
    }
    
    console.log('Created new cart successfully:', newCart)
    return newCart
  } catch (error) {
    console.error('Error getting or creating cart:', error)
    throw error
  }
}

async function updateCart(supabase: any, cartId: string, updates: Partial<CartOrder>): Promise<CartOrder> {
  try {
    console.log('Updating cart:', cartId, 'with updates:', updates)
    
    const { data, error } = await supabase
      .from('cart_orders')
      .update(updates)
      .eq('id', cartId)
      .select()
      .single()

    if (error) {
      console.error('Error updating cart:', error)
      throw error
    }
    
    console.log('Cart updated successfully:', data)
    return data
  } catch (error) {
    console.error('Error updating cart:', error)
    throw error
  }
}

async function clearCart(supabase: any, userId: string, whatsappUserId: string): Promise<void> {
  try {
    console.log('Clearing cart for:', { userId, whatsappUserId })
    
    await supabase
      .from('cart_orders')
      .update({
        step: 'completed',
        items: [],
        total_amount: 0
      })
      .eq('user_id', userId)
      .eq('whatsapp_user_id', whatsappUserId)
    
    console.log('Cart cleared successfully')
  } catch (error) {
    console.error('Error clearing cart:', error)
    // Don't throw error here as it's not critical
  }
}

async function handleBrowsingState(
  supabase: any,
  geminiApiKey: string,
  userId: string,
  whatsappUserId: string,
  message: string,
  intentResult: any,
  businessProfile: BusinessProfile | null,
  customerName: string | null,
  cart: CartOrder,
  conversationHistory: Array<{
    message_type: 'incoming' | 'outgoing'
    message_content: string
    ai_response?: string
    created_at: string
  }> = []
): Promise<{ response: string }> {
  
  console.log('Handling browsing state with message:', message.substring(0, 100))
  
  // First priority: Try to parse order items from the user's message
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('name')

  const foundItems = parseOrderItemsFromMessage(message, products || [])
  console.log('Found items in browsing state:', foundItems)
  
  if (foundItems.length > 0) {
    // Items found in message - add them to cart and move to collecting_items step
    const updatedItems = [...cart.items, ...foundItems]
    const totalAmount = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    // Update cart with new items and move to collecting_items step
    await updateCart(supabase, cart.id, {
      items: updatedItems,
      total_amount: totalAmount,
      step: 'collecting_items'
    })

    let responseText = "✅ Item berhasil ditambahkan ke keranjang!\n\n"
    responseText += "*KERANJANG ANDA:*\n"
    updatedItems.forEach((item, index) => {
      responseText += `${index + 1}. ${item.product_name} x${item.quantity} = Rp ${(item.price * item.quantity).toLocaleString('id-ID')}\n`
    })
    responseText += `\n💰 *Total: Rp ${totalAmount.toLocaleString('id-ID')}*\n\n`
    responseText += "📝 Sekarang saya butuh data berikut:\n"
    responseText += "👤 Nama lengkap\n"
    responseText += "📱 Nomor telepon\n"
    responseText += "📍 Outlet pilihan\n"
    responseText += "🚗 Metode: 'ambil sendiri' atau 'delivery'\n\n"
    responseText += "💬 Contoh: 'Nama saya Ria, HP 0812345678, outlet Palagan, ambil sendiri'"

    return {
      response: responseText
    }
  }
  
  // Second priority: Check if user wants to see menu
  if (intentResult.isOrdering || intentResult.intent === 'menu') {
    // Show menu
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('name')

    const menuText = generateMenuDisplay(products || [])

    // Update cart to collecting_items step
    await updateCart(supabase, cart.id, {
      step: 'collecting_items'
    })

    return {
      response: menuText
    }
  } else {
    // No items found and not a menu request - return empty response
    // The AI general response has already been sent by ai-cs-webhook
    console.log('No items found and not a menu request - returning empty response')
    return {
      response: ""
    }
  }
}

async function handleCollectingItemsState(
  supabase: any,
  userId: string,
  whatsappUserId: string,
  message: string,
  cart: CartOrder
): Promise<{ response: string }> {
  
  const lowerMessage = message.toLowerCase().trim()
  
  // Get available products
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (!products || products.length === 0) {
    return {
      response: "Maaf, menu tidak tersedia. Ketik 'batal' untuk membatalkan pesanan."
    }
  }

  // Check if user wants to proceed to details collection
  if (lowerMessage.includes('selesai') || lowerMessage.includes('lanjut') || lowerMessage.includes('checkout')) {
    if (cart.items.length === 0) {
      return {
        response: "Keranjang Anda masih kosong. Silakan ketik nama menu yang tersedia atau ketik 'menu' untuk melihat daftar lengkap. 🍣"
      }
    }

    const responseText = buildOrderSummaryForDetails(cart)
    
    // Update cart to collecting_details step
    await updateCart(supabase, cart.id, {
      step: 'collecting_details'
    })

    return {
      response: responseText
    }
  }

  // Parse items from message
  const foundItems = parseOrderItemsFromMessage(message, products)
  
  if (foundItems.length > 0) {
    // Add items to current cart
    const updatedItems = [...cart.items, ...foundItems]
    const totalAmount = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    // Update cart with new items
    await updateCart(supabase, cart.id, {
      items: updatedItems,
      total_amount: totalAmount
    })

    let responseText = "✅ Item berhasil ditambahkan ke keranjang!\n\n"
    responseText += "*KERANJANG ANDA:*\n"
    updatedItems.forEach((item, index) => {
      responseText += `${index + 1}. ${item.product_name} x${item.quantity} = Rp ${(item.price * item.quantity).toLocaleString('id-ID')}\n`
    })
    responseText += `\n💰 *Total: Rp ${totalAmount.toLocaleString('id-ID')}*\n\n`
    responseText += "🛒 Mau tambah menu lain? Ketik nama menunya.\n"
    responseText += "✅ Atau ketik 'lanjut' untuk isi data pengambilan."

    return {
      response: responseText
    }
  } else {
    return {
      response: "Menu tidak ditemukan. Silakan ketik nama menu yang tersedia atau ketik 'menu' untuk melihat daftar lengkap. 🍣"
    }
  }
}

async function handleCollectingDetailsState(
  supabase: any,
  userId: string,
  whatsappUserId: string,
  message: string,
  cart: CartOrder
): Promise<{ response: string }> {
  
  // Parse customer details from message
  const parsedDetails = parseCustomerDetails(message)
  
  console.log('Parsing customer details from message:', message)
  console.log('Parsed details:', parsedDetails)
  console.log('Current cart before update:', cart)
  
  // Update cart with parsed details
  const updatedCartData = {
    customer_name: parsedDetails.customer_name || cart.customer_name,
    phone_number: parsedDetails.phone_number || cart.phone_number,
    outlet_preference: parsedDetails.outlet_preference || cart.outlet_preference,
    delivery_method: parsedDetails.delivery_method || cart.delivery_method
  }
  
  const updatedCart = await updateCart(supabase, cart.id, updatedCartData)
  console.log('Updated cart after parsing:', updatedCart)
  
  // Check if we have all required details
  const validation = validateOrderCompleteness(updatedCart)
  console.log('Validation result:', validation)
  
  if (validation.isComplete) {
    // All details collected, move to confirmation
    const confirmationText = buildOrderConfirmation(updatedCart)
    
    await updateCart(supabase, cart.id, {
      step: 'confirming_order'
    })

    return {
      response: confirmationText
    }
  } else {
    // Still missing some details
    const responseText = buildMissingDetailsPrompt(validation.missingFields)
    
    return {
      response: responseText
    }
  }
}

async function handleConfirmingOrderState(
  supabase: any,
  userId: string,
  whatsappUserId: string,
  message: string,
  cart: CartOrder,
  customerWhatsappNumber: string,
  businessProfile: BusinessProfile | null
): Promise<{ response: string }> {
  
  const lowerMessage = message.toLowerCase().trim()
  
  if (lowerMessage.includes('ya') || lowerMessage.includes('benar') || lowerMessage.includes('lanjut') || lowerMessage.includes('bayar')) {
    // Create payment link
    try {
      const paymentResult = await createOrderPayment(
        userId,
        whatsappUserId,
        cart.items,
        cart.total_amount,
        cart.customer_name || 'Customer'
      )

      if (paymentResult.success) {
        // Update cart to awaiting_payment
        await updateCart(supabase, cart.id, {
          step: 'awaiting_payment'
        })

        // Send internal notification to business
        await sendInternalOrderNotification(
          supabase,
          paymentResult.order_id!,
          cart,
          businessProfile
        )

        let responseText = "🎉 *PESANAN DIKONFIRMASI!*\n\n"
        responseText += `📋 ID Pesanan: #${paymentResult.order_id?.substring(0, 8)}\n`
        responseText += `💰 Total pembayaran: *Rp ${cart.total_amount.toLocaleString('id-ID')}*\n\n`
        responseText += "💳 *PEMBAYARAN GOPAY*\n\n"
        responseText += "Silakan scan QR code GoPay yang akan dikirim setelah pesan ini.\n\n"
        responseText += "⏰ QR code berlaku selama 60 menit.\n"
        responseText += "✅ Setelah pembayaran berhasil, pesanan Anda akan diproses.\n\n"
        responseText += `🙏 Terima kasih telah memilih ${businessProfile?.business_name || 'kami'}!`

        // Send the confirmation message first
        await sendWhatsAppMessage(customerWhatsappNumber, responseText, businessProfile?.fonnte_device_id, businessProfile?.fonnte_device_token)

        // Then send the QR code as an image attachment
        if (paymentResult.qr_code_url) {
          console.log('Storing Midtrans QR code PNG to Supabase Storage...')
          const pngStorageResult = await storeMidtransQrCodeAsPng(
            supabase,
            paymentResult.qr_code_url,
            paymentResult.order_id!
          )
          
          if (pngStorageResult.success && pngStorageResult.png_url) {
            console.log('QR code stored as PNG successfully:', pngStorageResult.png_url)
            
            const qrMessageWithLink = `📱 *QR CODE GOPAY*\n\n🔍 Scan QR code di bawah ini dengan aplikasi GoPay Anda:\n\n🌐 Atau buka link ini di browser: ${paymentResult.qr_code_url}`
            await sendWhatsAppMessageWithImage(
              customerWhatsappNumber, 
              qrMessageWithLink,
              pngStorageResult.png_url,
              businessProfile?.fonnte_device_id,
              businessProfile?.fonnte_device_token
            )
          } else {
            console.error('Failed to store QR code as PNG:', pngStorageResult.error)
            // Fallback: send QR code URL as text
            const fallbackMessage = `📱 *LINK PEMBAYARAN GOPAY*\n\n🌐 Buka link berikut untuk pembayaran:\n${paymentResult.qr_code_url}\n\n📱 Atau scan QR code melalui browser.`
            await sendWhatsAppMessage(customerWhatsappNumber, fallbackMessage, businessProfile?.fonnte_device_id, businessProfile?.fonnte_device_token)
          }
        }

        return {
          response: "" // Empty response since we already sent the messages
        }
      } else {
        // Reset cart on payment failure
        await clearCart(supabase, userId, whatsappUserId)
        return {
          response: "Maaf, terjadi kesalahan saat membuat link pembayaran. Silakan coba lagi atau hubungi customer service kami. 😔"
        }
      }
    } catch (error) {
      console.error('Error creating payment:', error)
      await clearCart(supabase, userId, whatsappUserId)
      return {
        response: "Maaf, terjadi kesalahan saat membuat link pembayaran. Silakan coba lagi atau hubungi customer service kami. 😔"
      }
    }
  } else {
    // Cancel order
    await clearCart(supabase, userId, whatsappUserId)
    return {
      response: "Pesanan dibatalkan. Ketik 'menu' untuk mulai memesan lagi. 🍣"
    }
  }
}

async function handleAwaitingPaymentState(
  supabase: any,
  userId: string,
  whatsappUserId: string,
  cart: CartOrder
): Promise<{ response: string }> {
  return {
    response: "Pesanan Anda sedang menunggu pembayaran. Silakan selesaikan pembayaran melalui link yang telah dikirimkan. 💳\n\nJika ingin memesan lagi, ketik 'menu'. 🍣"
  }
}

function buildOrderSummaryForDetails(cart: CartOrder): string {
  let responseText = "📋 *RINGKASAN KERANJANG*\n\n"
  
  cart.items.forEach((item, index) => {
    responseText += `${index + 1}. ${item.product_name} x${item.quantity} = Rp ${(item.price * item.quantity).toLocaleString('id-ID')}\n`
  })
  
  responseText += `\n💰 *Total: Rp ${cart.total_amount.toLocaleString('id-ID')}*\n\n`
  responseText += "📝 Sekarang saya butuh data berikut:\n"
  responseText += "👤 Nama lengkap\n"
  responseText += "📱 Nomor telepon\n"
  responseText += "📍 Outlet pilihan\n"
  responseText += "🚗 Metode: 'ambil sendiri' atau 'delivery'\n\n"
  responseText += "💬 Contoh: 'Nama saya Ria, HP 0812345678, outlet Palagan, ambil sendiri'\n\n"
  responseText += "📍 *Outlet yang tersedia:*\n"
  responseText += "• Outlet Utama\n"
  responseText += "• Outlet Cabang 1\n"
  responseText += "• Outlet Cabang 2"
  
  return responseText
}

function buildOrderConfirmation(cart: CartOrder): string {
  let responseText = "📋 *KONFIRMASI PESANAN FINAL*\n\n"
  
  responseText += "🍣 *Menu:*\n"
  cart.items.forEach((item, index) => {
    responseText += `${index + 1}. ${item.product_name} x${item.quantity} = Rp ${(item.price * item.quantity).toLocaleString('id-ID')}\n`
  })
  
  responseText += `\n👤 *Nama:* ${cart.customer_name}\n`
  responseText += `📱 *HP:* ${cart.phone_number}\n`
  responseText += `📍 *Outlet:* ${cart.outlet_preference}\n`
  responseText += `🚗 *Pengambilan:* ${cart.delivery_method === 'pickup' ? 'Ambil sendiri' : 'Delivery'}\n`
  
  responseText += `\n💰 *Total: Rp ${cart.total_amount.toLocaleString('id-ID')}*\n\n`
  responseText += "✅ Apakah semua data sudah benar?\n"
  responseText += "💬 Ketik 'ya' untuk lanjut pembayaran atau 'batal' untuk membatalkan.\n\n"
  responseText += "🍣"

  return responseText
}

function buildMissingDetailsPrompt(missingFields: string[]): string {
  let responseText = "📝 Saya masih butuh info berikut:\n\n"
  
  missingFields.forEach((field, index) => {
    let fieldName = field
    switch (field) {
      case 'nama pelanggan':
        fieldName = '👤 Nama lengkap'
        break
      case 'nomor telepon':
        fieldName = '📱 Nomor HP/WhatsApp'
        break
      case 'outlet pilihan':
        fieldName = '📍 Outlet pilihan'
        break
      case 'metode pengambilan (ambil/antar)':
        fieldName = '🚗 Metode pengambilan (ambil sendiri/delivery)'
        break
      default:
        fieldName = field
    }
    responseText += `${index + 1}. ${fieldName}\n`
  })
  
  responseText += "\n💬 Bisa kirim sekaligus ya!\n"
  responseText += "📝 Contoh: 'Nama saya Ria, HP 0812345678, outlet utama, ambil sendiri'"
  
  return responseText
}

export function buildOrderSummaryAndValidation(cart: CartOrder): {
  summary: string
  isValid: boolean
  missingInfo: string[]
} {
  const validation = validateOrderCompleteness(cart)
  
  let summary = "📋 *RINGKASAN KERANJANG*\n\n"
  
  if (cart.items.length > 0) {
    cart.items.forEach((item, index) => {
      summary += `${index + 1}. ${item.product_name} x${item.quantity} = Rp ${(item.price * item.quantity).toLocaleString('id-ID')}\n`
    })
    summary += `\n💰 *Total: Rp ${cart.total_amount.toLocaleString('id-ID')}*\n\n`
  }
  
  if (cart.customer_name) {
    summary += `👤 *Nama:* ${cart.customer_name}\n`
  }
  
  if (cart.phone_number) {
    summary += `📱 *HP:* ${cart.phone_number}\n`
  }
  
  if (cart.outlet_preference) {
    summary += `📍 *Outlet:* ${cart.outlet_preference}\n`
  }
  
  if (cart.delivery_method) {
    summary += `🚗 *Pengambilan:* ${cart.delivery_method === 'pickup' ? 'Ambil sendiri' : 'Delivery'}\n`
  }
  
  return {
    summary,
    isValid: validation.isComplete,
    missingInfo: validation.missingFields
  }
}