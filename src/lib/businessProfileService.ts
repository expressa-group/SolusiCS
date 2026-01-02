import { supabase } from './supabaseClient';
import { UserBusinessProfile } from '../types/database';
import { EmbeddingService } from './embeddingService';

export class BusinessProfileService {
  static async getUserBusinessProfile(userId: string): Promise<UserBusinessProfile | null> {
    try {
      const { data, error } = await supabase
        .from('user_business_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user business profile:', error);
      return null;
    }
  }

  static async updateSelectedPlan(userId: string, selectedPlan: string): Promise<UserBusinessProfile | null> {
    try {
      // First ensure the user exists in auth.users by checking current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .upsert({
          user_id: userId,
          selected_plan: selectedPlan,
          pricing_completed: true,
          plan_status: 'active',
        }, {
          onConflict: 'user_id'
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating selected plan:', error);
      throw error;
    }
  }

  static async requestTrial(userId: string): Promise<UserBusinessProfile | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .upsert({
          user_id: userId,
          trial_status: 'requested',
          trial_requested_at: new Date().toISOString(),
          pricing_completed: false,
          plan_status: 'inactive',
        }, {
          onConflict: 'user_id'
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error requesting trial:', error);
      throw error;
    }
  }

  static async approveTrial(userId: string, adminUserId: string): Promise<UserBusinessProfile | null> {
    try {
      // Ensure admin is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== adminUserId) {
        throw new Error('Admin not authenticated');
      }

      // Check if current user is admin
      const { data: adminProfile } = await supabase
        .from('user_business_profiles')
        .select('role')
        .eq('user_id', adminUserId)
        .single();

      if (!adminProfile || adminProfile.role !== 'admin') {
        throw new Error('Insufficient permissions - admin role required');
      }

      const trialStartDate = new Date();
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14); // 14 days trial

      const { data, error } = await supabase
        .from('user_business_profiles')
        .update({
          trial_status: 'active',
          trial_started_at: trialStartDate.toISOString(),
          trial_ends_at: trialEndDate.toISOString(),
          pricing_completed: true,
          plan_status: 'trialing',
          selected_plan: 'professional', // Give professional features during trial
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error approving trial:', error);
      throw error;
    }
  }

  static async rejectTrial(userId: string, adminUserId: string): Promise<UserBusinessProfile | null> {
    try {
      // Ensure admin is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== adminUserId) {
        throw new Error('Admin not authenticated');
      }

      // Check if current user is admin
      const { data: adminProfile } = await supabase
        .from('user_business_profiles')
        .select('role')
        .eq('user_id', adminUserId)
        .single();

      if (!adminProfile || adminProfile.role !== 'admin') {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .update({
          trial_status: 'none',
          trial_requested_at: null,
          pricing_completed: false,
          plan_status: 'inactive',
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error rejecting trial:', error);
      throw error;
    }
  }

  static async getAllTrialRequests(): Promise<UserBusinessProfile[]> {
    try {
      // Ensure admin is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Admin not authenticated');
      }

      // Check if current user is admin
      const { data: adminProfile } = await supabase
        .from('user_business_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!adminProfile || adminProfile.role !== 'admin') {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .select('*')
        .eq('trial_status', 'requested')
        .order('trial_requested_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all trial requests:', error);
      throw error;
    }
  }

  static async getAllUsers(params?: {
    limit?: number;
    offset?: number;
    searchTerm?: string;
    trialStatus?: string;
    planStatus?: string;
  }): Promise<UserBusinessProfile[]> {
    try {
      // Ensure admin is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Admin not authenticated');
      }

      // Check if current user is admin
      const { data: adminProfile } = await supabase
        .from('user_business_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (!adminProfile || adminProfile.role !== 'admin') {
        throw new Error('Insufficient permissions - admin role required');
      }

      let query = supabase
        .from('user_business_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (params?.searchTerm) {
        query = query.or(`business_name.ilike.%${params.searchTerm}%,user_id.ilike.%${params.searchTerm}%`);
      }

      if (params?.trialStatus) {
        query = query.eq('trial_status', params.trialStatus);
      }

      if (params?.planStatus) {
        query = query.eq('plan_status', params.planStatus);
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      if (params?.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all users:', error);
      throw error;
    }
  }

  static async updateUserStatus(
    userId: string,
    adminUserId: string,
    updates: {
      trial_status?: string;
      plan_status?: string;
      selected_plan?: string;
      pricing_completed?: boolean;
      trial_started_at?: string;
      trial_ends_at?: string;
    }
  ): Promise<UserBusinessProfile | null> {
    try {
      // Ensure admin is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== adminUserId) {
        throw new Error('Admin not authenticated');
      }

      // Check if current user is admin
      const { data: adminProfile } = await supabase
        .from('user_business_profiles')
        .select('role')
        .eq('user_id', adminUserId)
        .single();

      if (!adminProfile || adminProfile.role !== 'admin') {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }

  static async getTrialRequests(): Promise<UserBusinessProfile[]> {
    try {
      const { data, error } = await supabase
        .from('user_business_profiles')
        .select('*')
        .eq('trial_status', 'requested')
        .order('trial_requested_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching trial requests:', error);
      return [];
    }
  }

  static async checkTrialExpiry(userId: string): Promise<boolean> {
    try {
      const { data: profile } = await supabase
        .from('user_business_profiles')
        .select('trial_status, trial_ends_at, plan_status')
        .eq('user_id', userId)
        .single();

      if (!profile || profile.trial_status !== 'active') {
        return false;
      }

      const now = new Date();
      const trialEndDate = new Date(profile.trial_ends_at);

      if (now > trialEndDate) {
        // Trial has expired, update status
        await supabase
          .from('user_business_profiles')
          .update({
            trial_status: 'expired',
            plan_status: 'expired',
            pricing_completed: false,
          })
          .eq('user_id', userId);

        return true; // Trial expired
      }

      return false; // Trial still active
    } catch (error) {
      console.error('Error checking trial expiry:', error);
      return false;
    }
  }

  static async voidTrialRequest(userId: string): Promise<UserBusinessProfile | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .update({
          trial_status: 'none',
          trial_requested_at: null,
        })
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error) throw error;
      console.log('Trial request voided for user:', userId);
      return data;
    } catch (error) {
      console.error('Error voiding trial request:', error);
      throw error;
    }
  }

  static async updateBusinessInfo(
    userId: string, 
    businessInfo: {
      business_name: string;
      description: string;
      industry: string;
      operating_hours: string;
      whatsapp_number: string;
      auto_response_enabled?: boolean;
      human_transfer_enabled?: boolean;
      response_tone?: string;
      ai_settings?: any;
      fonnte_device_id?: string;
      fonnte_status?: string;
      fonnte_qr_code_url?: string;
      fonnte_connected_at?: string;
      fonnte_device_token?: string;
      midtrans_transaction_id?: string;
      user_phone_number?: string;
    }
  ): Promise<UserBusinessProfile | null> {
    try {
      // First ensure the user exists in auth.users by checking current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .upsert({
          user_id: userId,
          ...businessInfo,
          setup_completed: true,
        }, {
          onConflict: 'user_id'
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      // Automatically create/update embedding for business profile
      if (data) {
        try {
          const contentText = `Nama Bisnis: ${data.business_name}\nDeskripsi: ${data.description}\nIndustri: ${data.industry}\nJam Operasional: ${data.operating_hours}\nNomor WhatsApp: ${data.whatsapp_number}`;
          
          // Check if embedding already exists
          const { data: existingEmbedding } = await supabase
            .from('embeddings')
            .select('id')
            .eq('user_id', userId)
            .eq('content_type', 'knowledge_base')
            .eq('content_id', data.id)
            .maybeSingle();

          if (existingEmbedding) {
            // Update existing embedding
            await EmbeddingService.updateEmbedding(
              userId,
              data.id,
              contentText,
              { type: 'business_info', category: 'business' }
            );
            console.log('Business profile embedding updated:', data.id);
          } else {
            // Create new embedding
            await EmbeddingService.storeEmbedding(
              userId,
              'knowledge_base',
              data.id,
              contentText,
              { type: 'business_info', category: 'business' }
            );
            console.log('Business profile embedding created:', data.id);
          }
        } catch (embeddingError) {
          console.warn('Error creating/updating business profile embedding:', embeddingError);
          // Don't throw error here - the business profile was updated successfully
        }
      }

      return data;
    } catch (error) {
      console.error('Error updating business info:', error);
      throw error;
    }
  }

  static async createInitialProfile(userId: string): Promise<UserBusinessProfile | null> {
    try {
      // First ensure the user exists in auth.users by checking current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .insert({
          user_id: userId,
          pricing_completed: false,
          setup_completed: false,
        })
        .select()
        .maybeSingle();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating initial profile:', error);
      throw error;
    }
  }

  static async updateFonnteStatus(
    userId: string,
    fonnteData: {
      fonnte_device_id?: string | null;
      fonnte_status?: string;
      fonnte_qr_code_url?: string | null;
      fonnte_connected_at?: string | null;
      fonnte_device_token?: string | null;
    }
  ): Promise<UserBusinessProfile | null> {
    try {
      // First ensure the user exists in auth.users by checking current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .update(fonnteData)
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating FonNte status:', error);
      throw error;
    }
  }

  static async getFonnteStatus(userId: string): Promise<{
    fonnte_device_id?: string | null;
    fonnte_status?: string;
    fonnte_qr_code_url?: string | null;
    fonnte_connected_at?: string | null;
    fonnte_device_token?: string | null;
  } | null> {
    try {
      // Validate userId before making the query
      if (!userId || !userId.trim()) {
        console.warn('Invalid userId provided to getFonnteStatus');
        return null;
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .select('fonnte_device_id, fonnte_status, fonnte_qr_code_url, fonnte_connected_at, fonnte_device_token')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching FonNte status:', error);
      return null;
    }
  }

  static async updateMidtransTransactionId(
    userId: string, 
    transactionId: string
  ): Promise<UserBusinessProfile | null> {
    try {
      // First ensure the user exists in auth.users by checking current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .update({
          midtrans_transaction_id: transactionId
        })
        .eq('user_id', userId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating Midtrans transaction ID:', error);
      throw error;
    }
  }
}