/*
  # Fix Admin Permissions and RLS Policies

  1. Security Updates
    - Update RLS policies for admin access
    - Add admin role checks
    - Fix function permissions
    
  2. Admin Role Management
    - Ensure admin users can access all data
    - Add proper role-based access control
*/

-- Update user_business_profiles policies for admin access
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_business_profiles;
CREATE POLICY "Admins can view all profiles"
  ON user_business_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update all profiles" ON user_business_profiles;
CREATE POLICY "Admins can update all profiles"
  ON user_business_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Update ai_conversations policies for admin access
DROP POLICY IF EXISTS "Admins can view all conversations" ON ai_conversations;
CREATE POLICY "Admins can view all conversations"
  ON ai_conversations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Update whatsapp_users policies for admin access
DROP POLICY IF EXISTS "Admins can view all whatsapp users" ON whatsapp_users;
CREATE POLICY "Admins can view all whatsapp users"
  ON whatsapp_users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Update embeddings policies for admin access
DROP POLICY IF EXISTS "Admins can view all embeddings" ON embeddings;
CREATE POLICY "Admins can view all embeddings"
  ON embeddings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Update knowledge_base policies for admin access
DROP POLICY IF EXISTS "Admins can view all knowledge base" ON knowledge_base;
CREATE POLICY "Admins can view all knowledge base"
  ON knowledge_base
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Update products policies for admin access
DROP POLICY IF EXISTS "Admins can view all products" ON products;
CREATE POLICY "Admins can view all products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Update faqs policies for admin access
DROP POLICY IF EXISTS "Admins can view all faqs" ON faqs;
CREATE POLICY "Admins can view all faqs"
  ON faqs
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM user_business_profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(check_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM user_business_profiles
  WHERE user_id = check_user_id;

  RETURN user_role = 'admin';
END;
$$;

-- Function to ensure admin access
CREATE OR REPLACE FUNCTION ensure_admin_access()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions - admin role required';
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_admin_access() TO authenticated;