import { createClient } from 'npm:@supabase/supabase-js@2'

export interface HealthcareSimilaritySearchResult {
  id: string
  content_type: string
  content_id: string
  content_text: string
  metadata: any
  similarity: number
}

export interface HealthcareBusinessProfile {
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

export async function performHealthcareRAGSearch(
  geminiApiKey: string,
  userId: string,
  query: string,
  limit: number = 5
): Promise<HealthcareSimilaritySearchResult[]> {
  try {
    // Generate query embedding
    const queryEmbedding = await generateHealthcareEmbedding(geminiApiKey, query, 'RETRIEVAL_QUERY')

    // Initialize Supabase client for RAG search
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Perform similarity search with healthcare-specific filtering
    const { data: searchResults, error: searchError } = await supabase.rpc('similarity_search', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_user_id: userId,
      match_content_types: ['faq', 'knowledge_base', 'product'], // Include all types for healthcare
      match_count: limit
    })

    if (searchError) {
      console.error('Healthcare RAG similarity search error:', searchError)
      return []
    }

    // Higher similarity threshold for healthcare to ensure accuracy
    const HEALTHCARE_SIMILARITY_THRESHOLD = 0.75
    const filteredResults = (searchResults || []).filter(result => 
      result.similarity >= HEALTHCARE_SIMILARITY_THRESHOLD
    )
    
    console.log(`Healthcare RAG Search: Found ${searchResults?.length || 0} results, ${filteredResults.length} above ${HEALTHCARE_SIMILARITY_THRESHOLD * 100}% threshold`)
    
    return filteredResults
  } catch (error) {
    console.error('Error in healthcare RAG search:', error)
    return []
  }
}

export async function generateHealthcareEmbedding(
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
    console.error('Error generating healthcare embedding:', error)
    throw error
  }
}

export function buildHealthcareAIContextWithRAG(
  businessProfile: HealthcareBusinessProfile | null, 
  relevantDocuments: HealthcareSimilaritySearchResult[], 
  customerName: string | null,
  conversationHistory: Array<{
    message_type: 'incoming' | 'outgoing'
    message_content: string
    ai_response?: string
    created_at: string
  }> = []
): string {
  let context = `Anda adalah asisten virtual yang profesional dan ramah untuk ${businessProfile?.business_name || 'fasilitas kesehatan ini'}. `
  
  if (businessProfile) {
    if (businessProfile.description) {
      context += `Deskripsi fasilitas: ${businessProfile.description}. `
    }
    
    if (businessProfile.operating_hours) {
      context += `Jam pelayanan: ${businessProfile.operating_hours}. `
    }
  }

  if (customerName) {
    context += `Anda sedang melayani ${customerName}. `
  }

  // Add conversation history for healthcare context continuity
  if (conversationHistory.length > 0) {
    context += `\n\nRiwayat percakapan medis sebelumnya (${conversationHistory.length} pesan terakhir):\n`
    conversationHistory.forEach((msg, index) => {
      if (msg.message_type === 'incoming') {
        context += `Pasien: ${msg.message_content}\n`
      } else if (msg.message_type === 'outgoing') {
        context += `Asisten Medis: ${msg.ai_response || msg.message_content}\n`
      }
    })
    context += `\n`
  }

  context += `\n\nInformasi relevan dari basis pengetahuan:\n\n`
  
  if (relevantDocuments.length > 0) {
    relevantDocuments.forEach((doc, index) => {
      context += `--- Dokumen ${index + 1} (Tipe: ${doc.content_type.toUpperCase()}, Kemiripan: ${(doc.similarity * 100).toFixed(1)}%) ---\n`
      context += `${doc.content_text}\n\n`
    })
  } else {
    context += `--- Tidak ada informasi spesifik yang relevan ditemukan dalam basis pengetahuan untuk pertanyaan ini. ---\n\n`
  }

  context += `INSTRUKSI PENTING:\n\n`
  
  context += `KEAMANAN MEDIS (PRIORITAS UTAMA):\n`
  context += `   - TIDAK PERNAH memberikan diagnosis medis\n`
  context += `   - TIDAK PERNAH meresepkan obat atau dosis\n`
  context += `   - SELALU arahkan ke konsultasi langsung dengan dokter untuk keluhan medis\n\n`
  
  context += `GAYA KOMUNIKASI:\n`
  context += `   - Gunakan bahasa Indonesia yang sopan dan empati\n`
  context += `   - Berikan informasi berdasarkan dokumen relevan di atas\n`
  context += `   - GUNAKAN riwayat percakapan medis di atas untuk memberikan respons yang konsisten dan personal\n`
  context += `   - Jika pasien menyebutkan nama mereka di percakapan sebelumnya, gunakan nama tersebut\n`
  context += `   - Ingat konteks percakapan medis sebelumnya untuk memberikan respons yang lebih relevan\n`
  context += `   - Untuk keluhan medis, selalu sarankan konsultasi dengan dokter\n`
  context += `   - Gunakan emoji yang sesuai: 🏥 👩‍⚕️ 💙\n\n`

  return context
}

export async function generateHealthcareGeminiResponse(
  apiKey: string, 
  context: string, 
  userMessage: string
): Promise<string> {
  const prompt = `${context}\n\nPertanyaan/Keluhan Pasien: ${userMessage}\n\nRespons Asisten Medis Anda:`

  console.log('Healthcare AI prompt being sent to Gemini:', prompt)
  console.log('Calling Gemini API for healthcare response...')
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
          temperature: 0.3, // Lower temperature for more consistent healthcare responses
          topK: 20,
          topP: 0.8,
          maxOutputTokens: 400, // Slightly longer for healthcare explanations
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    })

    if (!response.ok) {
      console.error('Gemini API HTTP error:', response.status, response.statusText)
      console.error('Gemini API raw error response:', await response.text())
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('Gemini API healthcare response received')
    
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const aiResponse = data.candidates[0].content.parts[0].text
      
      // Post-process response to ensure healthcare safety
      return postProcessHealthcareResponse(aiResponse)
    } else {
      console.error('Invalid Gemini API response format:', JSON.stringify(data))
      throw new Error('Invalid response format from Gemini API')
    }
  } catch (error) {
    console.error('Error calling Gemini API for healthcare:', error)
    return 'Maaf, sistem sedang mengalami gangguan teknis. Untuk keperluan medis yang mendesak, silakan langsung datang ke fasilitas kesehatan atau hubungi 119. Untuk pertanyaan non-darurat, silakan hubungi customer service kami. 🏥'
  }
}

function postProcessHealthcareResponse(response: string): string {
  // Check for potentially dangerous medical advice patterns
  const dangerousPatterns = [
    /diagnosis.*adalah/i,
    /kemungkinan.*penyakit/i,
    /minum.*obat.*mg/i,
    /dosis.*tablet/i,
    /tidak perlu.*dokter/i,
    /cukup.*istirahat/i,
    /pasti.*sakit/i
  ]
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(response)) {
      console.warn('Potentially dangerous medical advice detected, providing safe fallback')
      return `🏥 Terima kasih atas pertanyaan Anda. Untuk keluhan atau gejala medis yang Anda alami, saya sangat menyarankan untuk berkonsultasi langsung dengan dokter kami.\n\n👩‍⚕️ Kami siap melayani Anda dengan jadwal praktek yang tersedia. Apakah Anda ingin saya bantu buatkan janji temu?\n\n📞 Untuk kondisi darurat, segera datang ke IGD atau hubungi 119.\n\nSalam sehat! 💙`
    }
  }
  
  // Ensure response ends with appropriate healthcare closing
  if (!response.includes('🏥') && !response.includes('👩‍⚕️') && !response.includes('💙')) {
    response += '\n\nSalam sehat! 🏥💙'
  }
  
  return response
}