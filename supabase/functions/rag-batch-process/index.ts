import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BatchProcessPayload {
  user_id: string
  content_types?: string[]
  force_refresh?: boolean
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Gemini API key
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    // Parse request payload
    const payload: BatchProcessPayload = await req.json()
    const { user_id: userId, content_types = ['faq', 'knowledge_base', 'product'], force_refresh = false } = payload

    console.log('Batch processing request:', { userId, content_types, force_refresh })

    let totalProcessed = 0

    // Clear existing embeddings if force refresh
    if (force_refresh) {
      const { error: deleteError } = await supabase
        .from('embeddings')
        .delete()
        .eq('user_id', userId)
        .in('content_type', content_types)

      if (deleteError) {
        console.error('Error clearing existing embeddings:', deleteError)
      } else {
        console.log('Cleared existing embeddings for refresh')
      }
    }

    // Process FAQs
    if (content_types.includes('faq')) {
      const { data: faqs } = await supabase
        .from('faqs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (faqs) {
        for (const faq of faqs) {
          try {
            // Check if embedding already exists (unless force refresh)
            if (!force_refresh) {
              const { data: existing } = await supabase
                .from('embeddings')
                .select('id')
                .eq('user_id', userId)
                .eq('content_id', faq.id)
                .single()

              if (existing) {
                console.log(`Skipping existing FAQ embedding: ${faq.id}`)
                continue
              }
            }

            const contentText = `Pertanyaan: ${faq.question}\nJawaban: ${faq.answer}`
            const embedding = await generateEmbedding(geminiApiKey, contentText, 'RETRIEVAL_DOCUMENT')

            const { error: insertError } = await supabase
              .from('embeddings')
              .insert({
                user_id: userId,
                content_type: 'faq',
                content_id: faq.id,
                content_text: contentText,
                embedding: `[${embedding.join(',')}]`,
                metadata: { category: faq.category }
              })

            if (insertError) {
              console.error(`Error inserting FAQ embedding ${faq.id}:`, insertError)
            } else {
              totalProcessed++
              console.log(`Processed FAQ: ${faq.id}`)
            }
          } catch (error) {
            console.error(`Error processing FAQ ${faq.id}:`, error)
          }
        }
      }
    }

    // Process Knowledge Base
    if (content_types.includes('knowledge_base')) {
      const { data: knowledgeItems } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (knowledgeItems) {
        for (const item of knowledgeItems) {
          try {
            // Check if embedding already exists (unless force refresh)
            if (!force_refresh) {
              const { data: existing } = await supabase
                .from('embeddings')
                .select('id')
                .eq('user_id', userId)
                .eq('content_id', item.id)
                .single()

              if (existing) {
                console.log(`Skipping existing knowledge base embedding: ${item.id}`)
                continue
              }
            }

            const contentText = `Pertanyaan: ${item.question}\nJawaban: ${item.answer}`
            const embedding = await generateEmbedding(geminiApiKey, contentText, 'RETRIEVAL_DOCUMENT')

            const { error: insertError } = await supabase
              .from('embeddings')
              .insert({
                user_id: userId,
                content_type: 'knowledge_base',
                content_id: item.id,
                content_text: contentText,
                embedding: `[${embedding.join(',')}]`,
                metadata: { category: item.category, type: item.type }
              })

            if (insertError) {
              console.error(`Error inserting knowledge base embedding ${item.id}:`, insertError)
            } else {
              totalProcessed++
              console.log(`Processed knowledge base item: ${item.id}`)
            }
          } catch (error) {
            console.error(`Error processing knowledge base item ${item.id}:`, error)
          }
        }
      }
    }

    // Process Products
    if (content_types.includes('product')) {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)

      if (products) {
        for (const product of products) {
          try {
            // Check if embedding already exists (unless force refresh)
            if (!force_refresh) {
              const { data: existing } = await supabase
                .from('embeddings')
                .select('id')
                .eq('user_id', userId)
                .eq('content_id', product.id)
                .single()

              if (existing) {
                console.log(`Skipping existing product embedding: ${product.id}`)
                continue
              }
            }

            const contentText = `Produk: ${product.name}\nHarga: ${product.price || 'Tidak disebutkan'}\nDeskripsi: ${product.description || 'Tidak ada deskripsi'}`
            const embedding = await generateEmbedding(geminiApiKey, contentText, 'RETRIEVAL_DOCUMENT')

            const { error: insertError } = await supabase
              .from('embeddings')
              .insert({
                user_id: userId,
                content_type: 'product',
                content_id: product.id,
                content_text: contentText,
                embedding: `[${embedding.join(',')}]`,
                metadata: { category: product.category }
              })

            if (insertError) {
              console.error(`Error inserting product embedding ${product.id}:`, insertError)
            } else {
              totalProcessed++
              console.log(`Processed product: ${product.id}`)
            }
          } catch (error) {
            console.error(`Error processing product ${product.id}:`, error)
          }
        }
      }
    }

    console.log(`Batch processing completed. Total processed: ${totalProcessed}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Batch processing completed',
        total_processed: totalProcessed,
        content_types_processed: content_types
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in batch processing:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

async function generateEmbedding(
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