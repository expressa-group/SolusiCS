/*
  # Admin Panel Database Functions

  1. New Tables
    - `admin_audit_logs` - Log aktivitas admin
    
  2. New Functions (RPC)
    - `get_admin_dashboard_data` - Data dashboard admin
    - `admin_search_users` - Pencarian pengguna
    - `get_user_details_for_admin` - Detail pengguna untuk admin
    - `bulk_approve_trials` - Persetujuan trial massal
    - `expire_trials` - Kedaluwarsa trial otomatis
    - `log_admin_action` - Log aktivitas admin
    - `get_trial_statistics` - Statistik trial
    - `similarity_search` - Pencarian similarity untuk RAG
    
  3. Security
    - Enable RLS on all tables
    - Add policies for admin access
*/

-- Create admin audit logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for admin audit logs
CREATE POLICY "Admins can view all audit logs"
  ON admin_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user_id ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user_id ON admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);

-- Function to get trial statistics
CREATE OR REPLACE FUNCTION get_trial_statistics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  pending_requests integer;
  active_trials integer;
  expired_trials integer;
  total_users integer;
  paid_users integer;
  requests_today integer;
  approvals_today integer;
BEGIN
  -- Get pending trial requests
  SELECT COUNT(*) INTO pending_requests
  FROM user_business_profiles
  WHERE trial_status = 'requested';

  -- Get active trials
  SELECT COUNT(*) INTO active_trials
  FROM user_business_profiles
  WHERE trial_status = 'active';

  -- Get expired trials
  SELECT COUNT(*) INTO expired_trials
  FROM user_business_profiles
  WHERE trial_status = 'expired';

  -- Get total users
  SELECT COUNT(*) INTO total_users
  FROM user_business_profiles;

  -- Get paid users
  SELECT COUNT(*) INTO paid_users
  FROM user_business_profiles
  WHERE plan_status = 'active' AND pricing_completed = true;

  -- Get requests today
  SELECT COUNT(*) INTO requests_today
  FROM user_business_profiles
  WHERE trial_status = 'requested' 
    AND trial_requested_at >= CURRENT_DATE;

  -- Get approvals today
  SELECT COUNT(*) INTO approvals_today
  FROM user_business_profiles
  WHERE trial_status = 'active' 
    AND trial_started_at >= CURRENT_DATE;

  -- Build result
  result := jsonb_build_object(
    'pending_requests', pending_requests,
    'active_trials', active_trials,
    'expired_trials', expired_trials,
    'total_users', total_users,
    'paid_users', paid_users,
    'requests_today', requests_today,
    'approvals_today', approvals_today
  );

  RETURN result;
END;
$$;

-- Function to get admin dashboard data
CREATE OR REPLACE FUNCTION get_admin_dashboard_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  total_users integer;
  active_users integer;
  total_conversations_today integer;
  active_whatsapp_connections integer;
  total_embeddings integer;
BEGIN
  -- Get total users
  SELECT COUNT(*) INTO total_users
  FROM user_business_profiles;

  -- Get active users (users with conversations in last 7 days)
  SELECT COUNT(DISTINCT user_id) INTO active_users
  FROM ai_conversations
  WHERE created_at >= NOW() - INTERVAL '7 days';

  -- Get total conversations today
  SELECT COUNT(*) INTO total_conversations_today
  FROM ai_conversations
  WHERE created_at >= CURRENT_DATE;

  -- Get active WhatsApp connections
  SELECT COUNT(*) INTO active_whatsapp_connections
  FROM user_business_profiles
  WHERE fonnte_status = 'connected';

  -- Get total embeddings
  SELECT COUNT(*) INTO total_embeddings
  FROM embeddings;

  -- Build result
  result := jsonb_build_object(
    'total_users', total_users,
    'active_users', active_users,
    'total_conversations_today', total_conversations_today,
    'active_whatsapp_connections', active_whatsapp_connections,
    'total_embeddings', total_embeddings
  );

  RETURN result;
END;
$$;

-- Function to search users for admin
CREATE OR REPLACE FUNCTION admin_search_users(
  p_search_term text DEFAULT '',
  p_trial_status text DEFAULT NULL,
  p_plan_status text DEFAULT NULL,
  p_industry text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  business_name text,
  industry text,
  trial_status text,
  plan_status text,
  selected_plan text,
  created_at timestamptz,
  trial_requested_at timestamptz,
  last_activity timestamptz,
  total_conversations bigint,
  whatsapp_users_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ubp.user_id,
    ubp.business_name,
    ubp.industry,
    ubp.trial_status,
    ubp.plan_status,
    ubp.selected_plan,
    ubp.created_at,
    ubp.trial_requested_at,
    (
      SELECT MAX(ac.created_at)
      FROM ai_conversations ac
      WHERE ac.user_id = ubp.user_id
    ) as last_activity,
    (
      SELECT COUNT(*)
      FROM ai_conversations ac
      WHERE ac.user_id = ubp.user_id
    ) as total_conversations,
    (
      SELECT COUNT(*)
      FROM whatsapp_users wu
      WHERE wu.user_id = ubp.user_id AND wu.is_active = true
    ) as whatsapp_users_count
  FROM user_business_profiles ubp
  WHERE 
    (p_search_term = '' OR 
     ubp.business_name ILIKE '%' || p_search_term || '%' OR
     ubp.user_id::text ILIKE '%' || p_search_term || '%')
    AND (p_trial_status IS NULL OR ubp.trial_status = p_trial_status)
    AND (p_plan_status IS NULL OR ubp.plan_status = p_plan_status)
    AND (p_industry IS NULL OR ubp.industry = p_industry)
  ORDER BY ubp.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Function to get user details for admin
CREATE OR REPLACE FUNCTION get_user_details_for_admin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  profile_data jsonb;
  auth_data jsonb;
  activity_data jsonb;
  conversations_data jsonb;
BEGIN
  -- Get profile data
  SELECT to_jsonb(ubp.*) INTO profile_data
  FROM user_business_profiles ubp
  WHERE ubp.user_id = p_user_id;

  -- Get auth user data
  SELECT jsonb_build_object(
    'id', au.id,
    'email', au.email,
    'email_confirmed_at', au.email_confirmed_at,
    'created_at', au.created_at,
    'last_sign_in_at', au.last_sign_in_at
  ) INTO auth_data
  FROM auth.users au
  WHERE au.id = p_user_id;

  -- Get activity data
  SELECT jsonb_build_object(
    'total_conversations', (
      SELECT COUNT(*) FROM ai_conversations WHERE user_id = p_user_id
    ),
    'conversations_last_7_days', (
      SELECT COUNT(*) FROM ai_conversations 
      WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '7 days'
    ),
    'whatsapp_users_count', (
      SELECT COUNT(*) FROM whatsapp_users 
      WHERE user_id = p_user_id AND is_active = true
    ),
    'knowledge_items_count', (
      SELECT COUNT(*) FROM knowledge_base 
      WHERE user_id = p_user_id AND is_active = true
    ),
    'products_count', (
      SELECT COUNT(*) FROM products 
      WHERE user_id = p_user_id AND is_active = true
    ),
    'faqs_count', (
      SELECT COUNT(*) FROM faqs 
      WHERE user_id = p_user_id AND is_active = true
    ),
    'last_activity', (
      SELECT MAX(created_at) FROM ai_conversations WHERE user_id = p_user_id
    )
  ) INTO activity_data;

  -- Get recent conversations
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ac.id,
      'whatsapp_number', ac.whatsapp_number,
      'message_type', ac.message_type,
      'message_content', ac.message_content,
      'ai_response', ac.ai_response,
      'processing_time_ms', ac.processing_time_ms,
      'created_at', ac.created_at
    )
  ) INTO conversations_data
  FROM (
    SELECT * FROM ai_conversations 
    WHERE user_id = p_user_id 
    ORDER BY created_at DESC 
    LIMIT 10
  ) ac;

  -- Build final result
  result := jsonb_build_object(
    'profile', profile_data,
    'auth_user', auth_data,
    'activity', activity_data,
    'recent_conversations', COALESCE(conversations_data, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

-- Function to bulk approve trials
CREATE OR REPLACE FUNCTION bulk_approve_trials(p_user_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  approved_count integer := 0;
  failed_count integer := 0;
  total_processed integer;
  user_id uuid;
  trial_start_date timestamptz;
  trial_end_date timestamptz;
BEGIN
  total_processed := array_length(p_user_ids, 1);
  trial_start_date := NOW();
  trial_end_date := trial_start_date + INTERVAL '14 days';

  -- Process each user ID
  FOREACH user_id IN ARRAY p_user_ids
  LOOP
    BEGIN
      -- Update user profile to approve trial
      UPDATE user_business_profiles
      SET 
        trial_status = 'active',
        trial_started_at = trial_start_date,
        trial_ends_at = trial_end_date,
        pricing_completed = true,
        plan_status = 'trialing',
        selected_plan = 'professional'
      WHERE user_id = user_id AND trial_status = 'requested';

      IF FOUND THEN
        approved_count := approved_count + 1;
      ELSE
        failed_count := failed_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      failed_count := failed_count + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'approved_count', approved_count,
    'failed_count', failed_count,
    'total_processed', total_processed
  );
END;
$$;

-- Function to expire trials
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count integer;
  processed_at timestamptz;
BEGIN
  processed_at := NOW();

  -- Update expired trials
  UPDATE user_business_profiles
  SET 
    trial_status = 'expired',
    plan_status = 'expired',
    pricing_completed = false
  WHERE 
    trial_status = 'active' 
    AND trial_ends_at < processed_at;

  GET DIAGNOSTICS expired_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'expired_count', expired_count,
    'processed_at', processed_at
  );
END;
$$;

-- Function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_user_id uuid,
  p_target_user_id uuid DEFAULT NULL,
  p_action text DEFAULT '',
  p_details jsonb DEFAULT '{}',
  p_ip_address text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO admin_audit_logs (
    admin_user_id,
    target_user_id,
    action,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_admin_user_id,
    p_target_user_id,
    p_action,
    p_details,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

-- Function for similarity search (RAG)
CREATE OR REPLACE FUNCTION similarity_search(
  query_embedding vector(768),
  match_user_id uuid,
  match_content_types text[] DEFAULT NULL,
  match_count integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  content_type text,
  content_id uuid,
  content_text text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.content_type,
    e.content_id,
    e.content_text,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM embeddings e
  WHERE 
    e.user_id = match_user_id
    AND (match_content_types IS NULL OR e.content_type = ANY(match_content_types))
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get users with trial requests
CREATE OR REPLACE FUNCTION get_trial_requests()
RETURNS TABLE (
  user_id uuid,
  business_name text,
  industry text,
  trial_requested_at timestamptz,
  description text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ubp.user_id,
    ubp.business_name,
    ubp.industry,
    ubp.trial_requested_at,
    ubp.description,
    ubp.created_at
  FROM user_business_profiles ubp
  WHERE ubp.trial_status = 'requested'
  ORDER BY ubp.trial_requested_at ASC;
END;
$$;

-- Function to update user plan status
CREATE OR REPLACE FUNCTION update_user_plan_status(
  p_user_id uuid,
  p_selected_plan text DEFAULT NULL,
  p_plan_status text DEFAULT NULL,
  p_trial_status text DEFAULT NULL,
  p_pricing_completed boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  UPDATE user_business_profiles
  SET 
    selected_plan = COALESCE(p_selected_plan, selected_plan),
    plan_status = COALESCE(p_plan_status, plan_status),
    trial_status = COALESCE(p_trial_status, trial_status),
    pricing_completed = COALESCE(p_pricing_completed, pricing_completed),
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING to_jsonb(user_business_profiles.*) INTO result;

  RETURN result;
END;
$$;

-- Function to get system health metrics
CREATE OR REPLACE FUNCTION get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  total_users integer;
  active_users integer;
  total_conversations_today integer;
  active_whatsapp_connections integer;
  total_embeddings integer;
BEGIN
  -- Get total users
  SELECT COUNT(*) INTO total_users
  FROM user_business_profiles;

  -- Get active users (users with activity in last 7 days)
  SELECT COUNT(DISTINCT user_id) INTO active_users
  FROM ai_conversations
  WHERE created_at >= NOW() - INTERVAL '7 days';

  -- Get total conversations today
  SELECT COUNT(*) INTO total_conversations_today
  FROM ai_conversations
  WHERE created_at >= CURRENT_DATE;

  -- Get active WhatsApp connections
  SELECT COUNT(*) INTO active_whatsapp_connections
  FROM user_business_profiles
  WHERE fonnte_status = 'connected';

  -- Get total embeddings
  SELECT COUNT(*) INTO total_embeddings
  FROM embeddings;

  -- Build result
  result := jsonb_build_object(
    'total_users', total_users,
    'active_users', active_users,
    'total_conversations_today', total_conversations_today,
    'active_whatsapp_connections', active_whatsapp_connections,
    'total_embeddings', total_embeddings,
    'checked_at', NOW()
  );

  RETURN result;
END;
$$;

-- Function to get user activity summary
CREATE OR REPLACE FUNCTION get_user_activity_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_conversations', (
      SELECT COUNT(*) FROM ai_conversations WHERE user_id = p_user_id
    ),
    'conversations_last_30_days', (
      SELECT COUNT(*) FROM ai_conversations 
      WHERE user_id = p_user_id AND created_at >= NOW() - INTERVAL '30 days'
    ),
    'whatsapp_users_count', (
      SELECT COUNT(*) FROM whatsapp_users 
      WHERE user_id = p_user_id AND is_active = true
    ),
    'knowledge_items_count', (
      SELECT COUNT(*) FROM knowledge_base 
      WHERE user_id = p_user_id AND is_active = true
    ),
    'products_count', (
      SELECT COUNT(*) FROM products 
      WHERE user_id = p_user_id AND is_active = true
    ),
    'faqs_count', (
      SELECT COUNT(*) FROM faqs 
      WHERE user_id = p_user_id AND is_active = true
    ),
    'embeddings_count', (
      SELECT COUNT(*) FROM embeddings WHERE user_id = p_user_id
    ),
    'last_activity', (
      SELECT MAX(created_at) FROM ai_conversations WHERE user_id = p_user_id
    ),
    'first_activity', (
      SELECT MIN(created_at) FROM ai_conversations WHERE user_id = p_user_id
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_trial_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_data() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_search_users(text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_details_for_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_approve_trials(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_trials() TO authenticated;
GRANT EXECUTE ON FUNCTION log_admin_action(uuid, uuid, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_trial_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_plan_status(uuid, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_health() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_activity_summary(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION similarity_search(vector(768), uuid, text[], integer) TO authenticated;