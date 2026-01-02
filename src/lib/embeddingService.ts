import { supabase } from './supabaseClient';

export interface EmbeddingItem {
  id: string;
  user_id: string;
  content_type: 'faq' | 'knowledge_base' | 'product';
  content_id: string;
  content_text: string;
  embedding: number[];
  metadata: any;
  created_at?: string;
  updated_at?: string;
}

export interface SimilaritySearchResult {
  id: string;
  content_type: string;
  content_id: string;
  content_text: string;
  metadata: any;
  similarity: number;
}

export class EmbeddingService {
  private static readonly GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';

  static async generateEmbedding(text: string, taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY not configured - skipping embedding generation');
      return new Array(768).fill(0); // Return zero vector as fallback
    }

    try {
      const response = await fetch(`${this.GEMINI_API_URL}?key=${apiKey}`, {
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
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding.values;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw error;
    }
  }

  static async storeEmbedding(
    userId: string,
    contentType: 'faq' | 'knowledge_base' | 'product',
    contentId: string,
    contentText: string,
    metadata: any = {}
  ): Promise<EmbeddingItem | null> {
    try {
      // Generate embedding
      const embedding = await this.generateEmbedding(contentText, 'RETRIEVAL_DOCUMENT');

      // Store in database
      const { data, error } = await supabase
        .from('embeddings')
        .insert({
          user_id: userId,
          content_type: contentType,
          content_id: contentId,
          content_text: contentText,
          embedding: `[${embedding.join(',')}]`, // Convert to PostgreSQL array format
          metadata
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error storing embedding:', error);
      throw error;
    }
  }

  static async updateEmbedding(
    userId: string,
    contentId: string,
    contentText: string,
    metadata: any = {}
  ): Promise<EmbeddingItem | null> {
    try {
      // Generate new embedding
      const embedding = await this.generateEmbedding(contentText, 'RETRIEVAL_DOCUMENT');

      // Update in database
      const { data, error } = await supabase
        .from('embeddings')
        .update({
          content_text: contentText,
          embedding: `[${embedding.join(',')}]`,
          metadata
        })
        .eq('user_id', userId)
        .eq('content_id', contentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating embedding:', error);
      throw error;
    }
  }

  static async deleteEmbedding(userId: string, contentId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('embeddings')
        .delete()
        .eq('user_id', userId)
        .eq('content_id', contentId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting embedding:', error);
      return false;
    }
  }

  static async similaritySearch(
    userId: string,
    queryText: string,
    limit: number = 5,
    contentTypes?: string[]
  ): Promise<SimilaritySearchResult[]> {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(queryText, 'RETRIEVAL_QUERY');

      // Build query
      let query = supabase
        .from('embeddings')
        .select('id, content_type, content_id, content_text, metadata')
        .eq('user_id', userId);

      // Add content type filter if specified
      if (contentTypes && contentTypes.length > 0) {
        query = query.in('content_type', contentTypes);
      }

      // Execute similarity search using PostgreSQL vector operations
      const { data, error } = await supabase.rpc('similarity_search', {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_user_id: userId,
        match_content_types: contentTypes || null,
        match_count: limit
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error performing similarity search:', error);
      return [];
    }
  }

  static async batchProcessUserData(userId: string): Promise<void> {
    try {
      console.log('Starting batch processing for user:', userId);

      // Process FAQs
      const { data: faqs } = await supabase
        .from('faqs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (faqs) {
        for (const faq of faqs) {
          const contentText = `Pertanyaan: ${faq.question}\nJawaban: ${faq.answer}`;
          await this.storeEmbedding(
            userId,
            'faq',
            faq.id,
            contentText,
            { category: faq.category }
          );
        }
        console.log(`Processed ${faqs.length} FAQs`);
      }

      // Process Knowledge Base
      const { data: knowledgeItems } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (knowledgeItems) {
        for (const item of knowledgeItems) {
          const contentText = `Pertanyaan: ${item.question}\nJawaban: ${item.answer}`;
          await this.storeEmbedding(
            userId,
            'knowledge_base',
            item.id,
            contentText,
            { category: item.category, type: item.type }
          );
        }
        console.log(`Processed ${knowledgeItems.length} knowledge base items`);
      }

      // Process Products
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (products) {
        for (const product of products) {
          const contentText = `Produk: ${product.name}\nHarga: ${product.price || 'Tidak disebutkan'}\nDeskripsi: ${product.description || 'Tidak ada deskripsi'}`;
          await this.storeEmbedding(
            userId,
            'product',
            product.id,
            contentText,
            { category: product.category }
          );
        }
        console.log(`Processed ${products.length} products`);
      }

      console.log('Batch processing completed for user:', userId);
    } catch (error) {
      console.error('Error in batch processing:', error);
      throw error;
    }
  }

  static async checkEmbeddingStatus(userId: string): Promise<{ 
    isComplete: boolean; 
    missingItemsCount: number;
    totalItemsCount: number;
    embeddedItemsCount: number;
    missingItems: Array<{ type: string; id: string; name: string }>;
  }> {
    try {
      console.log('Checking embedding status for user:', userId);

      // Get all active items that should have embeddings
      const [faqsResult, knowledgeResult, productsResult] = await Promise.all([
        supabase.from('faqs').select('id, question').eq('user_id', userId).eq('is_active', true),
        supabase.from('knowledge_base').select('id, question').eq('user_id', userId).eq('is_active', true),
        supabase.from('products').select('id, name').eq('user_id', userId).eq('is_active', true)
      ]);

      const faqs = faqsResult.data || [];
      const knowledgeItems = knowledgeResult.data || [];
      const products = productsResult.data || [];

      // Get all existing embeddings
      const { data: embeddings } = await supabase
        .from('embeddings')
        .select('content_id, content_type')
        .eq('user_id', userId);

      const embeddedIds = new Set(embeddings?.map(e => e.content_id) || []);

      // Check which items are missing embeddings
      const missingItems: Array<{ type: string; id: string; name: string }> = [];

      faqs.forEach(faq => {
        if (!embeddedIds.has(faq.id)) {
          missingItems.push({ type: 'FAQ', id: faq.id, name: faq.question });
        }
      });

      knowledgeItems.forEach(item => {
        if (!embeddedIds.has(item.id)) {
          missingItems.push({ type: 'Knowledge Base', id: item.id, name: item.question });
        }
      });

      products.forEach(product => {
        if (!embeddedIds.has(product.id)) {
          missingItems.push({ type: 'Product', id: product.id, name: product.name });
        }
      });

      const totalItemsCount = faqs.length + knowledgeItems.length + products.length;
      const embeddedItemsCount = totalItemsCount - missingItems.length;
      const isComplete = missingItems.length === 0;

      console.log(`Embedding status: ${embeddedItemsCount}/${totalItemsCount} items embedded`);

      return {
        isComplete,
        missingItemsCount: missingItems.length,
        totalItemsCount,
        embeddedItemsCount,
        missingItems
      };
    } catch (error) {
      console.error('Error checking embedding status:', error);
      return {
        isComplete: false,
        missingItemsCount: 0,
        totalItemsCount: 0,
        embeddedItemsCount: 0,
        missingItems: []
      };
    }
  }
}