import { supabase } from './supabaseClient';
import { ScheduledWhatsAppBlast } from '../types/database';

export class ScheduledWhatsAppBlastService {
  static async getScheduledBlasts(userId: string): Promise<ScheduledWhatsAppBlast[]> {
    try {
      const { data, error } = await supabase
        .from('scheduled_whatsapp_blasts')
        .select(`
          *,
          whatsapp_labels(name),
          whatsapp_blast_categories(name)
        `)
        .eq('user_id', userId)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching scheduled blasts:', error);
      return [];
    }
  }

  static async createScheduledBlast(userId: string, blastData: {
    message_content: string;
    scheduled_at: string;
    target_type: 'all_users' | 'by_label' | 'by_category' | 'specific_numbers';
    target_label_id?: string;
    target_category_id?: string;
    specific_numbers?: string[];
    reminder_enabled?: boolean;
    reminder_time?: string;
  }): Promise<ScheduledWhatsAppBlast | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('scheduled_whatsapp_blasts')
        .insert({
          user_id: userId,
          status: 'scheduled',
          ...blastData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating scheduled blast:', error);
      throw error;
    }
  }

  static async updateScheduledBlast(
    userId: string, 
    blastId: string, 
    blastData: Partial<{
      message_content: string;
      scheduled_at: string;
      status: 'draft' | 'scheduled' | 'sent' | 'failed' | 'cancelled';
      target_type: 'all_users' | 'by_label' | 'by_category' | 'specific_numbers';
      target_label_id: string;
      target_category_id: string;
      specific_numbers: string[];
      reminder_enabled: boolean;
      reminder_time: string;
    }>
  ): Promise<ScheduledWhatsAppBlast | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('scheduled_whatsapp_blasts')
        .update(blastData)
        .eq('id', blastId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating scheduled blast:', error);
      throw error;
    }
  }

  static async deleteScheduledBlast(userId: string, blastId: string): Promise<boolean> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { error } = await supabase
        .from('scheduled_whatsapp_blasts')
        .delete()
        .eq('id', blastId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting scheduled blast:', error);
      return false;
    }
  }

  static async getBlastsByStatus(
    userId: string, 
    status: 'draft' | 'scheduled' | 'sent' | 'failed' | 'cancelled'
  ): Promise<ScheduledWhatsAppBlast[]> {
    try {
      const { data, error } = await supabase
        .from('scheduled_whatsapp_blasts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', status)
        .order('scheduled_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching blasts by status:', error);
      return [];
    }
  }

  static async getUpcomingBlasts(userId: string): Promise<ScheduledWhatsAppBlast[]> {
    try {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('scheduled_whatsapp_blasts')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching upcoming blasts:', error);
      return [];
    }
  }

  static async getTargetNumbers(
    userId: string,
    targetType: string,
    targetLabelId?: string,
    targetCategoryId?: string,
    specificNumbers?: string[]
  ): Promise<string[]> {
    try {
      let numbers: string[] = [];

      switch (targetType) {
        case 'all_users':
          const { data: allUsers } = await supabase
            .from('whatsapp_users')
            .select('whatsapp_number')
            .eq('user_id', userId)
            .eq('is_active', true);
          numbers = allUsers?.map(u => u.whatsapp_number) || [];
          break;

        case 'by_label':
          if (targetLabelId) {
            const { data: labelUsers } = await supabase
              .from('whatsapp_user_labels')
              .select(`
                whatsapp_users(whatsapp_number)
              `)
              .eq('label_id', targetLabelId);
            numbers = labelUsers?.map(item => item.whatsapp_users?.whatsapp_number).filter(Boolean) || [];
          }
          break;

        case 'by_category':
          if (targetCategoryId) {
            const { data: categoryUsers } = await supabase
              .from('whatsapp_user_labels')
              .select(`
                whatsapp_users(whatsapp_number),
                whatsapp_labels!inner(category_id)
              `)
              .eq('whatsapp_labels.category_id', targetCategoryId);
            numbers = categoryUsers?.map(item => item.whatsapp_users?.whatsapp_number).filter(Boolean) || [];
          }
          break;

        case 'specific_numbers':
          numbers = specificNumbers || [];
          break;
      }

      return [...new Set(numbers)]; // Remove duplicates
    } catch (error) {
      console.error('Error getting target numbers:', error);
      return [];
    }
  }
}