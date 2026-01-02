import { supabase } from './supabaseClient';
import { WhatsAppBlastCategory } from '../types/database';

export class WhatsAppBlastCategoryService {
  static async getCategories(userId: string): Promise<WhatsAppBlastCategory[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_blast_categories')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching blast categories:', error);
      return [];
    }
  }

  static async createCategory(userId: string, categoryData: {
    name: string;
    description?: string;
  }): Promise<WhatsAppBlastCategory | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('whatsapp_blast_categories')
        .insert({
          user_id: userId,
          ...categoryData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating blast category:', error);
      throw error;
    }
  }

  static async updateCategory(
    userId: string, 
    categoryId: string, 
    categoryData: Partial<{
      name: string;
      description: string;
    }>
  ): Promise<WhatsAppBlastCategory | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('whatsapp_blast_categories')
        .update(categoryData)
        .eq('id', categoryId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating blast category:', error);
      throw error;
    }
  }

  static async deleteCategory(userId: string, categoryId: string): Promise<boolean> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { error } = await supabase
        .from('whatsapp_blast_categories')
        .delete()
        .eq('id', categoryId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting blast category:', error);
      return false;
    }
  }

  static async getDefaultHealthcareCategories(): Promise<Array<{name: string; description: string}>> {
    return [
      {
        name: 'Pasien Baru',
        description: 'Kategori untuk pasien yang baru mendaftar'
      },
      {
        name: 'Kontrol Rutin',
        description: 'Pasien yang memerlukan kontrol berkala'
      },
      {
        name: 'Pengingat Obat',
        description: 'Pasien yang perlu diingatkan minum obat'
      },
      {
        name: 'Jadwal Vaksinasi',
        description: 'Pasien yang memerlukan vaksinasi'
      },
      {
        name: 'Follow Up',
        description: 'Pasien yang memerlukan tindak lanjut'
      }
    ];
  }
}