import { createClient } from 'npm:@supabase/supabase-js@2'

export interface SimilaritySearchResult {
  id: string
  content_type: string
  content_id: string
  content_text: string
  metadata: any
  similarity: number
}

export interface BusinessProfile {
  business_name: string
  description: string
  industry: string
  operating_hours: string
  selected_plan?: string
  ai_responses_count?: number
  ai_responses_last_reset_month?: number
  fonnte_device_id?: string
  fonnte_device_token?: string
  current_order_data?: any
}

export async function performRAGSearch(
  geminiApiKey: string,
  userId: string,
  query: string,
  limit: number = 5
): Promise<SimilaritySearchResult[]> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(geminiApiKey, query, 'RETRIEVAL_QUERY')

    // Initialize Supabase client for RAG search
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Perform similarity search
    const { data: searchResults, error: searchError } = await supabase.rpc('similarity_search', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_user_id: userId,
      match_content_types: null,
      match_count: limit
    })

    if (searchError) {
      console.error('RAG similarity search error:', searchError)
      return []
    }

    // Filter results by similarity threshold
    const SIMILARITY_THRESHOLD = 0.65
    const filteredResults = (searchResults || []).filter(result => 
      result.similarity >= SIMILARITY_THRESHOLD
    )
    
    console.log(`RAG Search: Found ${searchResults?.length || 0} results, ${filteredResults.length} above ${SIMILARITY_THRESHOLD * 100}% threshold`)
    
    return filteredResults
  } catch (error) {
    console.error('Error in RAG search:', error)
    return []
  }
}

export async function generateEmbedding(
  apiKey: string, 
  text: string, 
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
): Promise<number[]> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: {
          parts: [{ text }]
        },
        taskType,
        outputDimensionality: 768
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    return data.embedding.values
  } catch (error) {
    console.error('Error generating embedding:', error)
    throw error
  }
}

export function buildAIContextWithRAG(
  businessProfile: BusinessProfile | null, 
  relevantDocuments: SimilaritySearchResult[], 
  customerName: string | null,
  conversationHistory: Array<{
    message_type: 'incoming' | 'outgoing'
    message_content: string
    ai_response?: string
    created_at: string
  }> = []
): string {
  let context = `Anda adalah asisten virtual yang ramah dan profesional`
  
  if (businessProfile) {
    context += ` untuk ${businessProfile.business_name || 'bisnis ini'}. `
    
    if (businessProfile.description) {
      context += `Deskripsi bisnis: ${businessProfile.description}. `
    }
    
    if (businessProfile.industry) {
      context += `Industri: ${businessProfile.industry}. `
    }
    
    if (businessProfile.operating_hours) {
      context += `Jam operasional: ${businessProfile.operating_hours}. `
    }
  }
  else {
    context += `. `
  }

  if (customerName) {
    context += `Anda sedang berbicara dengan ${customerName}. `
  }

  // Add conversation history for context continuity
  if (conversationHistory.length > 0) {
    context += `\n\nRiwayat percakapan sebelumnya (${conversationHistory.length} pesan terakhir):\n`
    conversationHistory.forEach((msg, index) => {
      if (msg.message_type === 'incoming') {
        context += `User: ${msg.message_content}\n`
      } else if (msg.message_type === 'outgoing') {
        context += `Assistant: ${msg.ai_response || msg.message_content}\n`
      }
    })
    context += `\n`
  }

  context += `\n\nBerikut adalah informasi relevan yang ditemukan dari basis pengetahuan bisnis. Anda HARUS menggunakan informasi ini sebagai sumber utama untuk menjawab pertanyaan pelanggan:\n\n`
  
  if (relevantDocuments.length > 0) {
    relevantDocuments.forEach((doc, index) => {
      context += `--- Dokumen Relevan ${index + 1} (Tipe: ${doc.content_type.toUpperCase()}, Kemiripan: ${(doc.similarity * 100).toFixed(1)}%) ---\n`
      context += `${doc.content_text}\n\n`
    })
  } else {
    context += `--- Tidak ada informasi spesifik yang relevan ditemukan dalam basis pengetahuan untuk pertanyaan ini. ---\n\n`
  }

  context += `Instruksi untuk Anda:\n`
  context += `- Jawab dalam bahasa Indonesia dengan nada yang ramah dan profesional\n`
  context += `- Gunakan emoji yang sesuai untuk membuat percakapan lebih menarik\n`
  context += `- GUNAKAN riwayat percakapan di atas untuk memberikan respons yang konsisten dan personal\n`
  context += `- Jika pelanggan menyebutkan nama mereka di percakapan sebelumnya, gunakan nama tersebut\n`
  context += `- Ingat konteks percakapan sebelumnya untuk memberikan respons yang lebih relevan\n`
  context += `- PRIORITASKAN penggunaan informasi yang disediakan di bagian "Dokumen Relevan" di atas. Ini adalah sumber kebenaran Anda\n`
  context += `- Jika pertanyaan pelanggan dapat dijawab sepenuhnya dengan informasi dari "Dokumen Relevan", berikan jawaban yang ringkas dan langsung berdasarkan itu\n`
  context += `- Jika "Dokumen Relevan" menyatakan "Tidak ada informasi spesifik yang relevan ditemukan", atau jika informasi yang disediakan tidak cukup untuk menjawab pertanyaan, Anda harus menyatakan dengan jujur bahwa Anda tidak memiliki informasi yang cukup dan tawarkan untuk menghubungkan pelanggan dengan tim support manusia\n`
  context += `- Jangan membuat-buat informasi atau berhalusinasi. Hanya gunakan fakta yang diberikan dalam "Dokumen Relevan"\n`
  context += `- Untuk pertanyaan umum tentang lokasi, jam operasional, atau kontak, gunakan informasi dari profil bisnis yang telah disediakan\n`
  context += `- Jaga agar respons tetap relevan dengan konteks bisnis dan pertanyaan pelanggan\n`
  
  // Add industry-specific instructions
  if (businessProfile?.industry) {
    context += `\nInstruksi khusus untuk industri ${businessProfile.industry}:\n`
    
    switch (businessProfile.industry) {
      case 'healthcare':
        context += `- Untuk pertanyaan medis, selalu arahkan ke konsultasi langsung dengan dokter atau tenaga medis\n`
        context += `- Berikan informasi umum tentang layanan, jadwal, dan prosedur berdasarkan basis pengetahuan\n`
        context += `- Untuk keluhan atau gejala, sarankan untuk segera berkonsultasi dengan tenaga medis\n`
        context += `- Ingatkan pentingnya konsultasi langsung untuk diagnosis yang akurat\n`
        break
      case 'retail':
      case 'ecommerce':
        context += `- Untuk pertanyaan produk, gunakan informasi dari basis pengetahuan produk\n`
        context += `- Bantu pelanggan menemukan produk yang sesuai dengan kebutuhan mereka\n`
        context += `- Berikan informasi tentang ketersediaan, harga, dan spesifikasi produk\n`
        break
      case 'education':
        context += `- Untuk pertanyaan tentang kursus atau program, gunakan informasi dari basis pengetahuan\n`
        context += `- Bantu calon siswa memahami persyaratan dan proses pendaftaran\n`
        context += `- Berikan informasi tentang jadwal, biaya, dan fasilitas\n`
        break
      case 'finance':
        context += `- Untuk pertanyaan keuangan, berikan informasi umum berdasarkan basis pengetahuan\n`
        context += `- Selalu sarankan konsultasi langsung untuk nasihat keuangan spesifik\n`
        context += `- Jangan memberikan nasihat investasi atau keuangan yang spesifik\n`
        break
      default:
        context += `- Berikan informasi yang akurat berdasarkan basis pengetahuan bisnis\n`
        context += `- Bantu pelanggan dengan pertanyaan umum tentang produk atau layanan\n`
    }
  }
  
  context += `\n`

  return context
}

export async function generateGeminiResponse(apiKey: string, context: string, userMessage: string): Promise<string> {
  const prompt = `${context}\n\nPertanyaan pelanggan: ${userMessage}\n\nJawaban Anda:`

  console.log('Calling Gemini API...')
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 300,
        }
      })
    })

    if (!response.ok) {
      console.error('Gemini API HTTP error:', response.status, response.statusText)
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('Gemini API response received')
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text
    } else {
      console.error('Invalid Gemini API response format:', JSON.stringify(data))
      throw new Error('Invalid response format from Gemini API')
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error)
    return 'Maaf, sistem sedang mengalami gangguan teknis. Silakan coba lagi dalam beberapa saat atau hubungi tim support kami.'
  }
}