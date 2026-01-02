import { supabase } from './supabaseClient';
import { WhatsAppLabel, WhatsAppUserLabel } from '../types/database';

export class WhatsAppLabelService {
  static async getLabels(userId: string): Promise<WhatsAppLabel[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_labels')
        .select(`
          *,
          whatsapp_blast_categories(name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching labels:', error);
      return [];
    }
  }

  static async createLabel(userId: string, labelData: {
    name: string;
    description?: string;
    category_id?: string;
  }): Promise<WhatsAppLabel | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('whatsapp_labels')
        .insert({
          user_id: userId,
          ...labelData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating label:', error);
      throw error;
    }
  }

  static async updateLabel(
    userId: string, 
    labelId: string, 
    labelData: Partial<{
      name: string;
      description: string;
      category_id: string;
    }>
  ): Promise<WhatsAppLabel | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('whatsapp_labels')
        .update(labelData)
        .eq('id', labelId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating label:', error);
      throw error;
    }
  }

  static async deleteLabel(userId: string, labelId: string): Promise<boolean> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { error } = await supabase
        .from('whatsapp_labels')
        .delete()
        .eq('id', labelId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting label:', error);
      return false;
    }
  }

  static async assignLabelToWhatsAppUser(
    userId: string,
    whatsappUserId: string,
    labelId: string
  ): Promise<boolean> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { error } = await supabase
        .from('whatsapp_user_labels')
        .insert({
          whatsapp_user_id: whatsappUserId,
          label_id: labelId,
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error assigning label to WhatsApp user:', error);
      return false;
    }
  }

  static async removeLabelFromWhatsAppUser(
    userId: string,
    whatsappUserId: string,
    labelId: string
  ): Promise<boolean> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { error } = await supabase
        .from('whatsapp_user_labels')
        .delete()
        .eq('whatsapp_user_id', whatsappUserId)
        .eq('label_id', labelId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing label from WhatsApp user:', error);
      return false;
    }
  }

  static async getLabelsForWhatsAppUser(
    userId: string,
    whatsappUserId: string
  ): Promise<WhatsAppLabel[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_user_labels')
        .select(`
          whatsapp_labels(*)
        `)
        .eq('whatsapp_user_id', whatsappUserId);

      if (error) throw error;
      return data?.map(item => item.whatsapp_labels).filter(Boolean) || [];
    } catch (error) {
      console.error('Error fetching labels for WhatsApp user:', error);
      return [];
    }
  }

  static async getWhatsAppUsersByLabel(
    userId: string,
    labelId: string
  ): Promise<string[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_user_labels')
        .select('whatsapp_user_id')
        .eq('label_id', labelId);

      if (error) throw error;
      return data?.map(item => item.whatsapp_user_id) || [];
    } catch (error) {
      console.error('Error fetching WhatsApp users by label:', error);
      return [];
    }
  }

  static async getDefaultHealthcareLabels(): Promise<Array<{name: string; description: string}>> {
    return [
      {
        name: 'Diabetes',
        description: 'Pasien dengan diabetes yang memerlukan monitoring'
      },
      {
        name: 'Hipertensi',
        description: 'Pasien dengan tekanan darah tinggi'
      },
      {
        name: 'Jantung',
        description: 'Pasien dengan masalah jantung'
      },
      {
        name: 'Lansia',
        description: 'Pasien berusia lanjut yang memerlukan perhatian khusus'
      },
      {
        name: 'Anak-anak',
        description: 'Pasien anak yang memerlukan vaksinasi dan kontrol tumbuh kembang'
      },
      {
        name: 'Ibu Hamil',
        description: 'Pasien ibu hamil yang memerlukan kontrol rutin'
      },
      {
        name: 'Pasca Operasi',
        description: 'Pasien yang baru menjalani operasi dan memerlukan follow up'
      },
      {
        name: 'Asuransi BPJS',
        description: 'Pasien yang menggunakan BPJS'
      },
      {
        name: 'Asuransi Swasta',
        description: 'Pasien yang menggunakan asuransi swasta'
      },
      {
        name: 'Umum',
        description: 'Pasien umum tanpa kondisi khusus'
      }
    ];
  }
}