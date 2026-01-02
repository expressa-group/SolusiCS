export interface ParsedOrderItem {
  product_id: string
  product_name: string
  quantity: number
  price: number
}

export interface ParsedOrderDetails {
  items: ParsedOrderItem[]
  customer_name?: string
  outlet_preference?: string
  delivery_method?: 'pickup' | 'delivery'
  phone_number?: string
  special_requests?: string
}

export interface Product {
  id: string
  name: string
  price: string
  description?: string
  category?: string
}

/**
 * Parse order items from user message
 */
export function parseOrderItemsFromMessage(
  message: string, 
  availableProducts: Product[]
): ParsedOrderItem[] {
  const lowerMessage = message.toLowerCase().trim()
  const foundItems: ParsedOrderItem[] = []

  console.log('Parsing order items from message:', message)
  console.log('Available products:', availableProducts.length)

  // Enhanced parsing patterns for Indonesian language
  const orderingPhrases = [
    /(?:saya\s+(?:ingin|mau|ingin)\s+pesan|pesan)\s+(.+)/i,
    /(?:oke\s+saya\s+ingin\s+pesan|saya\s+pesan)\s+(.+)/i,
    /(?:mau\s+pesan|ingin\s+pesan|pesan)\s+(.+)/i
  ]
  
  // First, try to extract the ordering part from common Indonesian phrases
  let orderingText = message
  for (const phrase of orderingPhrases) {
    const match = message.match(phrase)
    if (match && match[1]) {
      orderingText = match[1].trim()
      console.log('Extracted ordering text:', orderingText)
      break
    }
  }
  
  const lowerOrderingText = orderingText.toLowerCase()

  for (const product of availableProducts) {
    const productNameLower = product.name.toLowerCase()
    
    // Enhanced product name matching
    const productNameVariations = [
      productNameLower,
      productNameLower.replace(/\s+/g, ''), // Remove spaces
      productNameLower.replace(/\s+/g, '_'), // Replace spaces with underscore
      productNameLower.split(' ')[0] // First word only
    ]
    
    let productFound = false
    for (const variation of productNameVariations) {
      if (lowerOrderingText.includes(variation) || lowerMessage.includes(variation)) {
        productFound = true
        break
      }
    }
    
    if (productFound) {
      // Extract quantity (default to 1)
      let quantity = 1
      
      // Enhanced quantity patterns for Indonesian language
      const quantityPatterns = [
        // Pattern: "salmon 2" or "salmon 2 porsi"
        new RegExp(`${productNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\d+)\\s*(?:porsi|pcs|buah|gelas|roll)?`, 'i'),
        // Pattern: "2 salmon" or "2 porsi salmon"
        new RegExp(`(\\d+)\\s*(?:porsi|pcs|buah|gelas|roll)?\\s*${productNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
        // Pattern: "salmon 2 dan" (for multiple items)
        new RegExp(`${productNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(\\d+)\\s*(?:dan|,|$)`, 'i'),
        // Pattern: just numbers near product name
        new RegExp(`(\\d+)\\s*${productNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
        // Pattern: product name followed by number anywhere in message
        new RegExp(`${productNameLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?(\\d+)`, 'i')
      ]
      
      for (const pattern of quantityPatterns) {
        const quantityMatch = orderingText.match(pattern) || message.match(pattern)
        if (quantityMatch) {
          const parsedQuantity = parseInt(quantityMatch[1])
          if (parsedQuantity > 0 && parsedQuantity <= 50) { // Reasonable limits
            quantity = parsedQuantity
            console.log(`Found quantity ${quantity} for product ${product.name}`)
            break
          }
        }
      }

      const price = parseFloat(product.price || '0')
      foundItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: quantity,
        price: price
      })
      
      console.log(`Found item: ${product.name} x${quantity}`)
    }
  }

  console.log('Total items found:', foundItems.length)
  return foundItems
}

/**
 * Parse customer details from message
 */
export function parseCustomerDetails(message: string): Partial<ParsedOrderDetails> {
  const details: Partial<ParsedOrderDetails> = {}
  
  // Extract phone number
  const phonePattern = /(?:0|\+62|62)[\s-]?8[\d\s-]{8,13}/g
  const phoneMatch = message.match(phonePattern)
  if (phoneMatch) {
    details.phone_number = phoneMatch[0].replace(/[\s-]/g, '')
  }
  
  // Extract name (simple pattern - words that start with capital letter)
  const namePattern = /(?:nama|saya|aku)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i
  const nameMatch = message.match(namePattern)
  if (nameMatch) {
    details.customer_name = nameMatch[1]
  }
  
  // Extract outlet preference
  const outletPatterns = [
    /(?:outlet|cabang)\s+([a-zA-Z0-9\s]+?)(?:\s*,|\s*$|\s+(?:ambil|delivery|antar))/i,
    /(?:outlet|cabang)\s+([a-zA-Z0-9\s]+)/i,
    /(?:street\s+sushi\s+)?([a-zA-Z]+)(?:\s*,|\s*$|\s+(?:ambil|delivery|antar))/i
  ]
  
  for (const pattern of outletPatterns) {
    const outletMatch = message.match(pattern)
    if (outletMatch && outletMatch[1]) {
      const outlet = outletMatch[1].trim()
      // Filter out common words that aren't outlet names
      if (!['nama', 'saya', 'aku', 'hp', 'nomor', 'telepon', 'ambil', 'sendiri', 'delivery', 'antar'].includes(outlet.toLowerCase())) {
        details.outlet_preference = outlet
        break
      }
    }
  }
  
  // Extract delivery method
  if (message.toLowerCase().includes('antar') || message.toLowerCase().includes('delivery')) {
    details.delivery_method = 'delivery'
  } else if (message.toLowerCase().includes('ambil') || message.toLowerCase().includes('pickup')) {
    details.delivery_method = 'pickup'
  }
  
  return details
}

/**
 * Detect ordering intent from message
 */
export function detectOrderingIntent(message: string): {
  isOrdering: boolean
  intent: 'menu' | 'order' | 'location' | 'reservation' | 'birthday' | 'event' | 'promo' | 'workshop' | 'general'
  confidence: number
} {
  const lowerMessage = message.toLowerCase().trim()
  
  // Define intent patterns with keywords
  const intentPatterns = {
    menu: [
      'menu', 'daftar makanan', 'ada apa aja', 'makanan', 'minuman', 'sushi', 'ramen', 'harga',
      'mau pesan', 'ingin pesan', 'mau beli', 'ingin beli', 'mau order', 'ingin order',
      'tolong carikan', 'carikan pilihan', 'rekomendasi', 'recommended', 'suggest',
      'apa yang enak', 'menu favorit', 'best seller', 'paling laris', 'signature',
      'lihat menu', 'tampilkan menu', 'show menu', 'katalog', 'produk'
    ],
    order: [
      'pesan', 'order', 'beli', 'mau', 'delivery', 'antar', 'ambil',
      'checkout', 'bayar', 'lanjut', 'proses', 'konfirmasi'
    ],
    location: ['outlet', 'lokasi', 'cabang', 'alamat', 'dimana', 'dekat'],
    reservation: ['reservasi', 'booking', 'tempat duduk', 'meja', 'book'],
    birthday: ['ulang tahun', 'birthday', 'hampers', 'kado', 'hadiah', 'ultah'],
    event: ['event', 'wedding', 'pernikahan', 'catering', 'acara'],
    promo: ['promo', 'diskon', 'penawaran', 'murah', 'hemat', 'cashback'],
    workshop: ['workshop', 'kelas', 'belajar', 'anak', 'cooking class', 'kursus']
  }
  
  // Additional ordering phrases that indicate menu interest
  const orderingPhrases = [
    'mau pesan menu',
    'ingin pesan menu',
    'tolong carikan pilihan',
    'carikan pilihan paling recommended',
    'apa yang enak',
    'menu apa aja',
    'ada menu apa',
    'lihat daftar menu'
  ]
  
  // Check for exact phrase matches first (higher confidence)
  for (const phrase of orderingPhrases) {
    if (lowerMessage.includes(phrase)) {
      return {
        isOrdering: true,
        intent: 'menu',
        confidence: 0.9
      }
    }
  }
  
  let bestIntent = 'general'
  let maxScore = 0
  
  for (const [intent, keywords] of Object.entries(intentPatterns)) {
    let score = 0
    for (const keyword of keywords) {
      if (lowerMessage.includes(keyword)) {
        // Give higher weight to menu-related keywords
        if (intent === 'menu') {
          score += 1.5
        } else {
          score += 1
        }
      }
    }
    
    if (score > maxScore) {
      maxScore = score
      bestIntent = intent
    }
  }
  
  const confidence = maxScore / Math.max(1, intentPatterns[bestIntent as keyof typeof intentPatterns]?.length || 1)
  const isOrdering = ['menu', 'order'].includes(bestIntent) && confidence > 0.2
  
  console.log('Intent detection details:', {
    message: message.substring(0, 50),
    bestIntent,
    maxScore,
    confidence,
    isOrdering
  })
  
  return {
    isOrdering,
    intent: bestIntent as any,
    confidence
  }
}

/**
 * Generate menu display text
 */
export function generateMenuDisplay(products: Product[], category?: string): string {
  if (!products || products.length === 0) {
    return "🍣 *MENU STREET SUSHI* 🍣\n\n" +
           "1. *Salmon Roll* - Rp 50.000\n" +
           "   📝 Fresh salmon dengan nori dan sushi rice\n\n" +
           "2. *Tuna Nigiri* - Rp 30.000\n" +
           "   📝 Tuna segar di atas sushi rice\n\n" +
           "3. *Ramen Shoyu* - Rp 45.000\n" +
           "   📝 Ramen dengan kuah shoyu yang gurih\n\n" +
           "4. *Gyoza* - Rp 25.000\n" +
           "   📝 Dumpling isi daging dan sayuran\n\n" +
           "5. *Ocha* - Rp 10.000\n" +
           "   📝 Teh hijau Jepang yang menyegarkan\n\n" +
           "6. *Miso Soup* - Rp 15.000\n" +
           "   📝 Sup miso hangat dengan tahu dan rumput laut\n\n" +
           "🛒 Untuk memesan, ketik nama menu yang ingin Anda pesan.\n" +
           "📝 Contoh: 'Salmon Roll 2 porsi' atau 'Saya mau pesan Ramen Shoyu'\n\n" +
           "📍 Jangan lupa sebutkan outlet dan cara pengambilan ya!"
  }

  let menuText = "🍣 *MENU STREET SUSHI* 🍣\n\n"
  
  // Group products by category if not filtered
  const groupedProducts = category 
    ? products.filter(p => p.category === category)
    : products
  
  if (groupedProducts.length === 0) {
    return `Maaf, menu untuk kategori "${category}" belum tersedia. Silakan lihat menu lengkap kami! 🍣`
  }
  
  groupedProducts.forEach((product, index) => {
    const price = product.price ? `Rp ${parseInt(product.price).toLocaleString('id-ID')}` : 'Harga belum tersedia'
    menuText += `${index + 1}. *${product.name}*\n`
    menuText += `   💰 ${price}\n`
    if (product.description) {
      menuText += `   📝 ${product.description}\n`
    }
    menuText += `\n`
  })

  menuText += "🛒 Untuk memesan, ketik nama menu yang ingin Anda pesan.\n"
  menuText += "📝 Contoh: 'Salmon Roll 2 porsi' atau 'Saya mau pesan Ramen Shoyu'\n\n"
  menuText += "📍 Jangan lupa sebutkan outlet dan cara pengambilan ya!"

  return menuText
}

/**
 * Validate order completeness
 */
export function validateOrderCompleteness(orderData: any): {
  isComplete: boolean
  missingFields: string[]
  nextStep: string
} {
  const missingFields: string[] = []
  
  if (!orderData.items || orderData.items.length === 0) {
    missingFields.push('menu items')
  }
  
  if (!orderData.customer_name || orderData.customer_name.trim() === '') {
    missingFields.push('nama pelanggan')
  }
  
  if (!orderData.phone_number || orderData.phone_number.trim() === '') {
    missingFields.push('nomor telepon')
  }
  
  if (!orderData.outlet_preference || orderData.outlet_preference.trim() === '') {
    missingFields.push('outlet pilihan')
  }
  
  if (!orderData.delivery_method) {
    missingFields.push('metode pengambilan (ambil/antar)')
  }
  
  const isComplete = missingFields.length === 0
  
  let nextStep = 'collect_missing_info'
  if (isComplete) {
    nextStep = 'confirm_order'
  } else if (orderData.items && orderData.items.length > 0) {
    nextStep = 'collect_customer_details'
  } else {
    nextStep = 'collect_menu_items'
  }
  
  console.log('Order validation result:', {
    isComplete,
    missingFields,
    nextStep,
    orderData: {
      items_count: orderData.items?.length || 0,
      customer_name: orderData.customer_name,
      phone_number: orderData.phone_number,
      outlet_preference: orderData.outlet_preference,
      delivery_method: orderData.delivery_method
    }
  })
  
  return {
    isComplete,
    missingFields,
    nextStep
  }
}

/**
 * Extract customer information from natural language
 */
export function extractCustomerInfo(message: string): {
  name?: string
  phone?: string
  outlet?: string
  delivery_method?: 'pickup' | 'delivery'
  special_requests?: string
} {
  const result: any = {}
  
  // Extract name patterns
  const namePatterns = [
    /(?:nama\s+(?:saya|aku)\s+)([A-Za-z\s]+?)(?:\s*,|\s*hp|\s*nomor|\s*telepon|\s*outlet|\s*$)/i,
    /(?:saya\s+)([A-Za-z\s]+?)(?:\s*,|\s*hp|\s*nomor|\s*telepon|\s*outlet|\s*$)/i,
    /(?:aku\s+)([A-Za-z\s]+?)(?:\s*,|\s*hp|\s*nomor|\s*telepon|\s*outlet|\s*$)/i
  ]
  
  for (const pattern of namePatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      result.name = match[1].trim()
      break
    }
  }
  
  // Extract phone number
  const phonePattern = /(?:hp|nomor|telepon|wa)?\s*:?\s*((?:0|\+62|62)[\s-]?8[\d\s-]{8,13})/gi
  const phoneMatch = message.match(phonePattern)
  if (phoneMatch) {
    result.phone = phoneMatch[0].replace(/[\s-]/g, '').replace(/^(hp|nomor|telepon|wa):?/i, '')
  }
  
  // Extract outlet
  const outletPatterns = [
    // Pattern untuk "outlet Palagan", "outlet Street Sushi Palagan", dll
    /(?:outlet|cabang)\s+(?:street\s+sushi\s+)?([a-zA-Z\s]+?)(?:\s*,|\s*ambil|\s*delivery|\s*antar|\s*$)/i,
    // Pattern untuk "Street Sushi Palagan"
    /street\s+sushi\s+([a-zA-Z\s]+?)(?:\s*,|\s*ambil|\s*delivery|\s*antar|\s*$)/i,
    // Pattern untuk nama outlet langsung seperti "Palagan", "Malioboro", dll
    /(?:^|\s|,)\s*(palagan|malioboro|jogja\s*city\s*mall|jcm)(?:\s*,|\s*ambil|\s*delivery|\s*antar|\s*$)/i
  ]
  
  for (const pattern of outletPatterns) {
    const match = message.match(pattern)
    if (match && match[1]) {
      let outlet = match[1].trim()
      
      // Normalize outlet names
      outlet = outlet.toLowerCase()
      if (outlet.includes('palagan')) {
        result.outlet = 'Street Sushi Palagan'
      } else if (outlet.includes('malioboro')) {
        result.outlet = 'Street Sushi Malioboro'
      } else if (outlet.includes('jogja') || outlet.includes('jcm') || outlet.includes('city mall')) {
        result.outlet = 'Street Sushi Jogja City Mall'
      } else {
        // Use the raw outlet name if it doesn't match known outlets
        result.outlet = `Street Sushi ${outlet.charAt(0).toUpperCase() + outlet.slice(1)}`
      }
        break
    }
  }
  
  // Extract delivery method
  if (message.toLowerCase().includes('antar') || message.toLowerCase().includes('delivery')) {
    result.delivery_method = 'delivery'
  } else if (message.toLowerCase().includes('ambil') || message.toLowerCase().includes('pickup') || message.toLowerCase().includes('sendiri')) {
    result.delivery_method = 'pickup'
  }
  
  return result
}

/**
 * Format price for display
 */
export function formatPrice(price: number | string): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price
  return `Rp ${numPrice.toLocaleString('id-ID')}`
}

/**
 * Clean phone number format
 */
export function cleanPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '')
  
  // Convert to Indonesian format (62xxx)
  if (cleaned.startsWith('0')) {
    return '62' + cleaned.substring(1)
  } else if (cleaned.startsWith('62')) {
    return cleaned
  } else if (cleaned.startsWith('8')) {
    return '62' + cleaned
  }
  
  return cleaned
}

/**
 * Validate Indonesian phone number
 */
export function isValidIndonesianPhone(phone: string): boolean {
  const cleaned = cleanPhoneNumber(phone)
  // Indonesian mobile numbers: 628xxxxxxxxx (10-13 digits after 62)
  return /^628\d{8,11}$/.test(cleaned)
}