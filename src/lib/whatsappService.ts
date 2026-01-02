import { supabase } from './supabaseClient';

export const WHATSAPP_USER_LIMITS: { [key: string]: number } = {
  starter: 5,
  professional: 25,
  enterprise: -1, // unlimited
};

export interface WhatsAppUser {
  id: string;
  user_id: string;
  whatsapp_number: string;
  customer_name?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  whatsapp_number: string;
  message_type: 'incoming' | 'outgoing';
  message_content: string;
  ai_response?: string;
  processing_time_ms?: number;
  created_at?: string;
}

export class WhatsAppService {
  static async getWhatsAppUsers(userId: string): Promise<WhatsAppUser[]> {
    try {
      const { data, error } = await supabase
        .from('whatsapp_users')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching WhatsApp users:', error);
      return [];
    }
  }

  static async addWhatsAppUser(userId: string, userData: {
    whatsapp_number: string;
    customer_name?: string;
  }): Promise<WhatsAppUser | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Get user's business profile to check plan
      const { data: businessProfile, error: profileError } = await supabase
        .from('user_business_profiles')
        .select('selected_plan')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        throw new Error('Failed to get user business profile');
      }

      const userPlan = businessProfile?.selected_plan || 'starter';
      const whatsappUserLimit = WHATSAPP_USER_LIMITS[userPlan] || WHATSAPP_USER_LIMITS['starter'];

      // Check current WhatsApp users count (only if not unlimited)
      if (whatsappUserLimit !== -1) {
        const { count: currentCount, error: countError } = await supabase
          .from('whatsapp_users')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true);

        if (countError) {
          throw new Error('Failed to check current WhatsApp users count');
        }

        if (currentCount >= whatsappUserLimit) {
          throw new Error(`Batas maksimal ${whatsappUserLimit} nomor WhatsApp untuk paket ${userPlan} telah tercapai. Silakan upgrade paket Anda.`);
        }
      }

      // Check if WhatsApp number already exists for this user
      const { data: existing } = await supabase
        .from('whatsapp_users')
        .select('id')
        .eq('user_id', userId)
        .eq('whatsapp_number', userData.whatsapp_number)
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        throw new Error('WhatsApp number already registered for your business');
      }

      const { data, error } = await supabase
        .from('whatsapp_users')
        .insert({
          user_id: userId,
          ...userData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding WhatsApp user:', error);
      throw error;
    }
  }

  static async updateWhatsAppUser(
    userId: string, 
    whatsappUserId: string, 
    userData: Partial<{
      whatsapp_number: string;
      customer_name: string;
      is_active: boolean;
    }>
  ): Promise<WhatsAppUser | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('whatsapp_users')
        .update(userData)
        .eq('id', whatsappUserId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating WhatsApp user:', error);
      throw error;
    }
  }

  static async deleteWhatsAppUser(userId: string, whatsappUserId: string): Promise<boolean> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('whatsapp_users')
        .update({ is_active: false })
        .eq('id', whatsappUserId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting WhatsApp user:', error);
      return false;
    }
  }

  static async getConversations(userId: string, limit: number = 50): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  static async getConversationsByWhatsApp(
    userId: string, 
    whatsappNumber: string, 
    limit: number = 50
  ): Promise<AIConversation[]> {
    try {
      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .eq('whatsapp_number', whatsappNumber)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching conversations by WhatsApp:', error);
      return [];
    }
  }

  static async testAIResponse(userId: string, message: string): Promise<string> {
    try {
      // Call the AI CS webhook function for testing
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/ai-cs-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: userId,
          message: message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      return data.response || 'No response generated';
    } catch (error) {
      console.error('Error testing AI response:', error);
      throw error;
    }
  }
}