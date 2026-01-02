/*
  # Add WhatsApp mapping and conversation logging

  1. New Tables
    - `whatsapp_users`
      - Maps WhatsApp numbers to user_id for multi-tenant support
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users)
      - `whatsapp_number` (text, the customer's WhatsApp number)
      - `customer_name` (text, optional customer name)
      - `is_active` (boolean, default true)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `ai_conversations`
      - Logs all AI conversations for monitoring and improvement
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to users - the business owner)
      - `whatsapp_number` (text, customer's WhatsApp number)
      - `message_type` (text, 'incoming' or 'outgoing')
      - `message_content` (text, the actual message)
      - `ai_response` (text, AI generated response if applicable)
      - `processing_time_ms` (integer, time taken to process)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data

  3. Indexes
    - Add indexes for efficient querying by user_id and whatsapp_number
*/

-- Create whatsapp_users table
CREATE TABLE IF NOT EXISTS whatsapp_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number text NOT NULL,
  customer_name text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ai_conversations table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_number text NOT NULL,
  message_type text NOT NULL CHECK (message_type IN ('incoming', 'outgoing')),
  message_content text NOT NULL,
  ai_response text,
  processing_time_ms integer,
  created_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_user_id ON whatsapp_users(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_whatsapp_number ON whatsapp_users(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_users_active ON whatsapp_users(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_whatsapp_number ON ai_conversations(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at ON ai_conversations(created_at DESC);

-- Enable RLS
ALTER TABLE whatsapp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whatsapp_users
CREATE POLICY "Users can view their own WhatsApp mappings"
  ON whatsapp_users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own WhatsApp mappings"
  ON whatsapp_users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WhatsApp mappings"
  ON whatsapp_users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own WhatsApp mappings"
  ON whatsapp_users
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for ai_conversations
CREATE POLICY "Users can view their own AI conversations"
  ON ai_conversations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI conversations"
  ON ai_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger for whatsapp_users
CREATE TRIGGER update_whatsapp_users_updated_at
  BEFORE UPDATE ON whatsapp_users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();