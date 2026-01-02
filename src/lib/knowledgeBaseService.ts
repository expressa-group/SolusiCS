import { supabase } from './supabaseClient';
import { EmbeddingService } from './embeddingService';

export interface KnowledgeBaseItem {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  category?: string;
  type?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  parent_id?: string;
}

export class KnowledgeBaseService {
  static async getKnowledgeItems(userId: string): Promise<KnowledgeBaseItem[]> {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching knowledge items:', error);
      return [];
    }
  }

  static async getKnowledgeTree(userId: string): Promise<KnowledgeBaseItem[]> {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('parent_id', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching knowledge tree:', error);
      return [];
    }
  }

  static async getRootKnowledgeItems(userId: string): Promise<KnowledgeBaseItem[]> {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .is('parent_id', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching root knowledge items:', error);
      return [];
    }
  }

  static async getChildKnowledgeItems(userId: string, parentId: string): Promise<KnowledgeBaseItem[]> {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .eq('user_id', userId)
        .eq('parent_id', parentId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching child knowledge items:', error);
      return [];
    }
  }

  static async createKnowledgeItem(userId: string, itemData: {
    question: string;
    answer: string;
    category?: string;
    type?: string;
    parent_id?: string;
  }): Promise<KnowledgeBaseItem | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Check if user has reached the 5-item limit
      const existingItems = await this.getKnowledgeItems(userId);
      if (existingItems.length >= 50) {
        throw new Error('Maximum 50 knowledge items allowed per user');
      }

      const { data, error } = await supabase
        .from('knowledge_base')
        .insert({
          user_id: userId,
          question: itemData.question,
          answer: itemData.answer,
          category: itemData.category || 'general',
          type: itemData.type || 'custom',
          parent_id: itemData.parent_id || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Automatically create embedding for the new knowledge item
      try {
        const contentText = `Pertanyaan: ${data.question}\nJawaban: ${data.answer}`;
        await EmbeddingService.storeEmbedding(
          userId,
          'knowledge_base',
          data.id,
          contentText,
          { category: data.category, type: data.type }
        );
        console.log('Embedding created for knowledge item:', data.id);
      } catch (embeddingError) {
        console.error('Error creating embedding for knowledge item:', embeddingError);
        // Don't throw error here - the knowledge item was created successfully
      }

      return data;
    } catch (error) {
      console.error('Error creating knowledge item:', error);
      throw error;
    }
  }

  static async updateKnowledgeItem(
    userId: string, 
    itemId: string, 
    itemData: Partial<{
      question: string;
      answer: string;
      category: string;
      type: string;
      is_active: boolean;
      parent_id: string;
    }>
  ): Promise<KnowledgeBaseItem | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('knowledge_base')
        .update(itemData)
        .eq('id', itemId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      // Automatically update embedding for the updated knowledge item
      try {
        const contentText = `Pertanyaan: ${data.question}\nJawaban: ${data.answer}`;
        await EmbeddingService.updateEmbedding(
          userId,
          data.id,
          contentText,
          { category: data.category, type: data.type }
        );
        console.log('Embedding updated for knowledge item:', data.id);
      } catch (embeddingError) {
        console.error('Error updating embedding for knowledge item:', embeddingError);
        // Don't throw error here - the knowledge item was updated successfully
      }

      return data;
    } catch (error) {
      console.error('Error updating knowledge item:', error);
      throw error;
    }
  }

  static async deleteKnowledgeItem(userId: string, itemId: string): Promise<boolean> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('knowledge_base')
        .update({ is_active: false })
        .eq('id', itemId)
        .eq('user_id', userId);

      if (error) throw error;

      // Delete the corresponding embedding
      try {
        await EmbeddingService.deleteEmbedding(userId, itemId);
        console.log('Embedding deleted for knowledge item:', itemId);
      } catch (embeddingError) {
        console.error('Error deleting embedding for knowledge item:', embeddingError);
        // Don't throw error here - the knowledge item was deleted successfully
      }

      return true;
    } catch (error) {
      console.error('Error deleting knowledge item:', error);
      return false;
    }
  }

  static async moveKnowledgeItem(
    userId: string, 
    itemId: string, 
    newParentId: string | null
  ): Promise<KnowledgeBaseItem | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Prevent circular references
      if (newParentId) {
        const isCircular = await this.checkCircularReference(userId, itemId, newParentId);
        if (isCircular) {
          throw new Error('Cannot move item: would create circular reference');
        }
      }

      const { data, error } = await supabase
        .from('knowledge_base')
        .update({ parent_id: newParentId })
        .eq('id', itemId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error moving knowledge item:', error);
      throw error;
    }
  }

  private static async checkCircularReference(
    userId: string, 
    itemId: string, 
    potentialParentId: string
  ): Promise<boolean> {
    try {
      // Check if potentialParentId is a descendant of itemId
      let currentId = potentialParentId;
      const visited = new Set<string>();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        
        if (currentId === itemId) {
          return true; // Circular reference detected
        }

        const { data } = await supabase
          .from('knowledge_base')
          .select('parent_id')
          .eq('id', currentId)
          .eq('user_id', userId)
          .single();

        currentId = data?.parent_id || null;
      }

      return false;
    } catch (error) {
      console.error('Error checking circular reference:', error);
      return true; // Err on the side of caution
    }
  }

  static async autoPopulateFromBusinessSetup(userId: string): Promise<void> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Get user business profile
      const { data: profile, error: profileError } = await supabase
        .from('user_business_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        console.error('Error fetching business profile:', profileError);
        return;
      }

      // Delete existing business_info type entries to ensure freshness
      await supabase
        .from('knowledge_base')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('type', 'business_info');

      // Prepare business knowledge items
      const businessKnowledgeItems = [];

      if (profile.business_name) {
        businessKnowledgeItems.push({
          user_id: userId,
          question: `Apa nama bisnis Anda?`,
          answer: profile.business_name,
          category: profile.industry === 'healthcare' ? 'general' : 'general',
          type: 'business_info'
        });
      }

      if (profile.description) {
        businessKnowledgeItems.push({
          user_id: userId,
          question: `Ceritakan tentang bisnis ${profile.business_name || 'Anda'}`,
          answer: profile.description,
          category: profile.industry === 'healthcare' ? 'general' : 'general',
          type: 'business_info'
        });
      }

      if (profile.operating_hours) {
        businessKnowledgeItems.push({
          user_id: userId,
          question: `Apa jam operasional bisnis Anda?`,
          answer: profile.operating_hours,
          category: profile.industry === 'healthcare' ? 'appointment' : 'general',
          type: 'business_info'
        });
      }

      if (profile.industry) {
        businessKnowledgeItems.push({
          user_id: userId,
          question: `Di bidang apa bisnis Anda bergerak?`,
          answer: profile.industry === 'healthcare' 
            ? `Kami adalah penyedia layanan kesehatan yang berkomitmen memberikan pelayanan medis terbaik untuk pasien.`
            : `Kami bergerak di bidang ${profile.industry}`,
          category: profile.industry === 'healthcare' ? 'general' : 'general',
          type: 'business_info'
        });
      }

      // Add healthcare-specific knowledge items
      if (profile.industry === 'healthcare') {
        businessKnowledgeItems.push(
          {
            user_id: userId,
            question: 'Bagaimana cara membuat janji temu?',
            answer: 'Untuk membuat janji temu, Anda dapat menghubungi kami melalui WhatsApp atau datang langsung ke klinik pada jam operasional. Kami akan membantu mengatur jadwal yang sesuai dengan kebutuhan Anda.',
            category: 'appointment',
            type: 'business_info'
          },
          {
            user_id: userId,
            question: 'Apakah menerima BPJS?',
            answer: 'Ya, kami menerima BPJS Kesehatan. Pastikan Anda membawa kartu BPJS yang masih aktif dan kartu identitas saat berkunjung.',
            category: 'insurance',
            type: 'business_info'
          },
          {
            user_id: userId,
            question: 'Apa yang harus dibawa saat konsultasi?',
            answer: 'Silakan membawa kartu identitas (KTP/SIM), kartu asuransi (jika ada), hasil pemeriksaan sebelumnya (jika ada), dan daftar obat yang sedang dikonsumsi.',
            category: 'procedure',
            type: 'business_info'
          }
        );
      }
      // Insert business knowledge items (limit to ensure we don't exceed 5 total)
      if (businessKnowledgeItems.length > 0) {
        // Get current active items count
        const existingItems = await this.getKnowledgeItems(userId);
        const availableSlots = 5 - existingItems.length;
        
        // Only insert items that fit within the limit
        const itemsToInsert = businessKnowledgeItems.slice(0, Math.min(availableSlots, 20 - existingItems.length));
        
        if (itemsToInsert.length > 0) {
          const { error } = await supabase
            .from('knowledge_base')
            .insert(itemsToInsert);

          if (error) {
            console.error('Error inserting business knowledge items:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error auto-populating knowledge base:', error);
    }
  }

  static async getKnowledgeForAI(userId: string): Promise<string> {
    try {
      const items = await this.getKnowledgeItems(userId);
      
      if (items.length === 0) {
        return "Tidak ada informasi khusus tersedia untuk bisnis ini.";
      }

      let aiContext = "Informasi tentang bisnis ini:\n\n";
      
      items.forEach((item, index) => {
        aiContext += `${index + 1}. Q: ${item.question}\n`;
        aiContext += `   A: ${item.answer}\n`;
        aiContext += `   Kategori: ${item.category}\n\n`;
      });

      aiContext += "Gunakan informasi di atas untuk menjawab pertanyaan pelanggan dengan akurat dan sesuai konteks bisnis.";
      
      return aiContext;
    } catch (error) {
      console.error('Error getting knowledge for AI:', error);
      return "Terjadi kesalahan dalam mengambil informasi bisnis.";
    }
  }
}