import { supabase } from './supabaseClient';
import { UserBusinessProfile } from '../types/database';

export interface TrialStatistics {
  pending_requests: number;
  active_trials: number;
  expired_trials: number;
  total_users: number;
  paid_users: number;
  requests_today: number;
  approvals_today: number;
}

export interface UserSearchResult {
  user_id: string;
  business_name?: string;
  industry?: string;
  trial_status?: string;
  plan_status?: string;
  selected_plan?: string;
  created_at: string;
  trial_requested_at?: string;
  last_activity?: string;
  total_conversations: number;
  whatsapp_users_count: number;
}

export interface UserDetails {
  profile: UserBusinessProfile;
  auth_user: {
    id: string;
    email: string;
    email_confirmed_at?: string;
    created_at: string;
    last_sign_in_at?: string;
  };
  activity: {
    total_conversations: number;
    conversations_last_7_days: number;
    whatsapp_users_count: number;
    knowledge_items_count: number;
    products_count: number;
    faqs_count: number;
    last_activity?: string;
  };
  recent_conversations: Array<{
    id: string;
    whatsapp_number: string;
    message_type: string;
    message_content: string;
    ai_response?: string;
    processing_time_ms?: number;
    created_at: string;
  }>;
}

export class AdminService {
  static async verifyAdminRole(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data: profile } = await supabase
        .from('user_business_profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      return profile?.role === 'admin';
    } catch (error) {
      console.error('Error verifying admin role:', error);
      return false;
    }
  }

  static async getTrialStatistics(): Promise<TrialStatistics | null> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase.rpc('get_trial_statistics');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching trial statistics:', error);
      throw error;
    }
  }

  static async getDashboardData(): Promise<any> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase.rpc('get_admin_dashboard_data');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

  static async searchUsers(params: {
    searchTerm?: string;
    trialStatus?: string;
    planStatus?: string;
    industry?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserSearchResult[]> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase.rpc('admin_search_users', {
        p_search_term: params.searchTerm || '',
        p_trial_status: params.trialStatus || null,
        p_plan_status: params.planStatus || null,
        p_industry: params.industry || null,
        p_limit: params.limit || 50,
        p_offset: params.offset || 0
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  static async getUserDetails(userId: string): Promise<UserDetails | null> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase.rpc('get_user_details_for_admin', {
        p_user_id: userId
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user details:', error);
      throw error;
    }
  }

  static async bulkApproveTrial(userIds: string[]): Promise<{
    approved_count: number;
    failed_count: number;
    total_processed: number;
  }> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase.rpc('bulk_approve_trials', {
        p_user_ids: userIds
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error bulk approving trials:', error);
      throw error;
    }
  }

  static async logAdminAction(
    targetUserId: string | null,
    action: string,
    details: any = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<string | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Admin not authenticated');

      const { data, error } = await supabase.rpc('log_admin_action', {
        p_admin_user_id: user.id,
        p_target_user_id: targetUserId,
        p_action: action,
        p_details: details,
        p_ip_address: ipAddress || null,
        p_user_agent: userAgent || null
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error logging admin action:', error);
      return null;
    }
  }

  static async getAuditLogs(params: {
    adminUserId?: string;
    targetUserId?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminAuditLog[]> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      let query = supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (params.adminUserId) {
        query = query.eq('admin_user_id', params.adminUserId);
      }

      if (params.targetUserId) {
        query = query.eq('target_user_id', params.targetUserId);
      }

      if (params.action) {
        query = query.eq('action', params.action);
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }

      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 50) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  }

  static async expireTrials(): Promise<{ expired_count: number; processed_at: string }> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase.rpc('expire_trials');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error expiring trials:', error);
      throw error;
    }
  }

  static async updateUserPlan(
    userId: string,
    planData: {
      selected_plan?: string;
      plan_status?: string;
      trial_status?: string;
      pricing_completed?: boolean;
    }
  ): Promise<UserBusinessProfile | null> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data, error } = await supabase
        .from('user_business_profiles')
        .update(planData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      // Log admin action
      await this.logAdminAction(
        userId,
        'update_user_plan',
        { changes: planData }
      );

      return data;
    } catch (error) {
      console.error('Error updating user plan:', error);
      throw error;
    }
  }

  static async suspendUser(userId: string, reason: string): Promise<boolean> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { error } = await supabase
        .from('user_business_profiles')
        .update({
          plan_status: 'suspended',
          trial_status: 'expired'
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Log admin action
      await this.logAdminAction(
        userId,
        'suspend_user',
        { reason }
      );

      return true;
    } catch (error) {
      console.error('Error suspending user:', error);
      throw error;
    }
  }

  static async reactivateUser(userId: string): Promise<boolean> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { error } = await supabase
        .from('user_business_profiles')
        .update({
          plan_status: 'active'
        })
        .eq('user_id', userId);

      if (error) throw error;

      // Log admin action
      await this.logAdminAction(
        userId,
        'reactivate_user',
        {}
      );

      return true;
    } catch (error) {
      console.error('Error reactivating user:', error);
      throw error;
    }
  }

  static async getSystemHealth(): Promise<{
    total_users: number;
    active_users: number;
    total_conversations_today: number;
    active_whatsapp_connections: number;
    total_embeddings: number;
    database_size?: string;
  }> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      // Get basic stats
      const [usersResult, conversationsResult, connectionsResult, embeddingsResult] = await Promise.all([
        supabase.from('user_business_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('ai_conversations').select('*', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]),
        supabase.from('user_business_profiles').select('*', { count: 'exact', head: true }).eq('fonnte_status', 'connected'),
        supabase.from('embeddings').select('*', { count: 'exact', head: true })
      ]);

      const activeUsersResult = await supabase
        .from('ai_conversations')
        .select('user_id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      return {
        total_users: usersResult.count || 0,
        active_users: activeUsersResult.count || 0,
        total_conversations_today: conversationsResult.count || 0,
        active_whatsapp_connections: connectionsResult.count || 0,
        total_embeddings: embeddingsResult.count || 0
      };
    } catch (error) {
      console.error('Error fetching system health:', error);
      throw error;
    }
  }

  static async exportUserData(format: 'csv' | 'json' = 'csv'): Promise<string> {
    try {
      const isAdmin = await this.verifyAdminRole();
      if (!isAdmin) {
        throw new Error('Insufficient permissions - admin role required');
      }

      const { data: users, error } = await supabase
        .from('user_business_profiles')
        .select(`
          user_id,
          business_name,
          industry,
          trial_status,
          plan_status,
          selected_plan,
          created_at,
          trial_requested_at,
          trial_started_at,
          trial_ends_at
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (format === 'json') {
        return JSON.stringify(users, null, 2);
      }

      // CSV format
      if (!users || users.length === 0) {
        return 'No data available';
      }

      const headers = Object.keys(users[0]).join(',');
      const rows = users.map(user => 
        Object.values(user).map(value => 
          typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
        ).join(',')
      );

      return [headers, ...rows].join('\n');
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw error;
    }
  }
}