import { supabase } from './supabaseClient';

export interface HealthcareWhatsAppUser {
  id: string;
  user_id: string;
  whatsapp_number: string;
  customer_name?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HealthcareAIConversation {
  id: string;
  user_id: string;
  whatsapp_number: string;
  message_type: 'incoming' | 'outgoing';
  message_content: string;
  ai_response?: string;
  processing_time_ms?: number;
  created_at?: string;
}

export class HealthcareWhatsAppService {
  static async getHealthcarePatients(userId: string): Promise<HealthcareWhatsAppUser[]> {
    try {
      // Verify this is a healthcare business
      const { data: businessProfile } = await supabase
        .from('user_business_profiles')
        .select('industry')
        .eq('user_id', userId)
        .single();

      if (!businessProfile || businessProfile.industry !== 'healthcare') {
        throw new Error('This service is only available for healthcare businesses');
      }

      const { data, error } = await supabase
        .from('whatsapp_users')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching healthcare patients:', error);
      return [];
    }
  }

  static async addHealthcarePatient(userId: string, patientData: {
    whatsapp_number: string;
    customer_name?: string;
  }): Promise<HealthcareWhatsAppUser | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Verify this is a healthcare business
      const { data: businessProfile } = await supabase
        .from('user_business_profiles')
        .select('industry, selected_plan')
        .eq('user_id', userId)
        .single();

      if (!businessProfile || businessProfile.industry !== 'healthcare') {
        throw new Error('This service is only available for healthcare businesses');
      }

      // Check patient limits (same as general WhatsApp users)
      const PATIENT_LIMITS: { [key: string]: number } = {
        starter: 50,
        professional: 500,
        enterprise: -1, // unlimited
      };

      const userPlan = businessProfile?.selected_plan || 'starter';
      const patientLimit = PATIENT_LIMITS[userPlan] || PATIENT_LIMITS['starter'];

      if (patientLimit !== -1) {
        const { count: currentCount, error: countError } = await supabase
          .from('whatsapp_users')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_active', true);

        if (countError) {
          throw new Error('Failed to check current patient count');
        }

        if (currentCount >= patientLimit) {
          throw new Error(`Batas maksimal ${patientLimit} pasien untuk paket ${userPlan} telah tercapai. Silakan upgrade paket Anda.`);
        }
      }

      // Check if patient already exists
      const { data: existing } = await supabase
        .from('whatsapp_users')
        .select('id')
        .eq('user_id', userId)
        .eq('whatsapp_number', patientData.whatsapp_number)
        .eq('is_active', true)
        .maybeSingle();

      if (existing) {
        throw new Error('Nomor WhatsApp pasien sudah terdaftar');
      }

      const { data, error } = await supabase
        .from('whatsapp_users')
        .insert({
          user_id: userId,
          ...patientData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding healthcare patient:', error);
      throw error;
    }
  }

  static async getHealthcareConversations(userId: string, limit: number = 50): Promise<HealthcareAIConversation[]> {
    try {
      // Verify this is a healthcare business
      const { data: businessProfile } = await supabase
        .from('user_business_profiles')
        .select('industry')
        .eq('user_id', userId)
        .single();

      if (!businessProfile || businessProfile.industry !== 'healthcare') {
        throw new Error('This service is only available for healthcare businesses');
      }

      const { data, error } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching healthcare conversations:', error);
      return [];
    }
  }

  static async testHealthcareAIResponse(userId: string, message: string): Promise<string> {
    try {
      // Verify this is a healthcare business
      const { data: businessProfile } = await supabase
        .from('user_business_profiles')
        .select('industry')
        .eq('user_id', userId)
        .single();

      if (!businessProfile || businessProfile.industry !== 'healthcare') {
        throw new Error('This service is only available for healthcare businesses');
      }

      // Call the healthcare AI test function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/healthcare-ai-test`, {
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
        throw new Error('Failed to get healthcare AI response');
      }

      const data = await response.json();
      return data.response || 'No response generated';
    } catch (error) {
      console.error('Error testing healthcare AI response:', error);
      throw error;
    }
  }

  static async getHealthcareAnalytics(userId: string): Promise<{
    total_patients: number;
    conversations_today: number;
    emergency_queries: number;
    appointment_requests: number;
    avg_response_time: number;
  }> {
    try {
      // Verify this is a healthcare business
      const { data: businessProfile } = await supabase
        .from('user_business_profiles')
        .select('industry')
        .eq('user_id', userId)
        .single();

      if (!businessProfile || businessProfile.industry !== 'healthcare') {
        throw new Error('This service is only available for healthcare businesses');
      }

      const today = new Date().toISOString().split('T')[0];

      const [patientsResult, conversationsResult] = await Promise.all([
        supabase.from('whatsapp_users').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_active', true),
        supabase.from('ai_conversations').select('*', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', today)
      ]);

      return {
        total_patients: patientsResult.count || 0,
        conversations_today: conversationsResult.count || 0,
        emergency_queries: 0, // Would need additional tracking
        appointment_requests: 0, // Would need additional tracking
        avg_response_time: 1.8 // Would need calculation from processing_time_ms
      };
    } catch (error) {
      console.error('Error fetching healthcare analytics:', error);
      return {
        total_patients: 0,
        conversations_today: 0,
        emergency_queries: 0,
        appointment_requests: 0,
        avg_response_time: 0
      };
    }
  }
}