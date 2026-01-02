/*
  # WhatsApp Blast Management Tables

  1. New Tables
    - `whatsapp_blast_categories`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text, unique per user)
      - `description` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `whatsapp_labels`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text, unique per user)
      - `description` (text)
      - `category_id` (uuid, foreign key to whatsapp_blast_categories)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `whatsapp_user_labels`
      - `whatsapp_user_id` (uuid, foreign key to whatsapp_users)
      - `label_id` (uuid, foreign key to whatsapp_labels)
      - `created_at` (timestamp)
      - Primary key: (whatsapp_user_id, label_id)
    - `scheduled_whatsapp_blasts`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `message_content` (text)
      - `scheduled_at` (timestamp)
      - `status` (text with check constraint)
      - `target_type` (text with check constraint)
      - `target_label_id` (uuid, foreign key to whatsapp_labels)
      - `target_category_id` (uuid, foreign key to whatsapp_blast_categories)
      - `specific_numbers` (text array)
      - `reminder_enabled` (boolean)
      - `reminder_time` (timestamp)
      - `sent_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data

  3. Indexes
    - Add indexes for performance optimization on frequently queried columns
*/

-- Create whatsapp_blast_categories table
CREATE TABLE IF NOT EXISTS whatsapp_blast_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create whatsapp_labels table
CREATE TABLE IF NOT EXISTS whatsapp_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES whatsapp_blast_categories(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Create whatsapp_user_labels table (junction table)
CREATE TABLE IF NOT EXISTS whatsapp_user_labels (
  whatsapp_user_id uuid NOT NULL REFERENCES whatsapp_users(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES whatsapp_labels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (whatsapp_user_id, label_id)
);

-- Create scheduled_whatsapp_blasts table
CREATE TABLE IF NOT EXISTS scheduled_whatsapp_blasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_content text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed', 'cancelled')),
  target_type text NOT NULL CHECK (target_type IN ('all_users', 'by_label', 'by_category', 'specific_numbers')),
  target_label_id uuid REFERENCES whatsapp_labels(id) ON DELETE SET NULL,
  target_category_id uuid REFERENCES whatsapp_blast_categories(id) ON DELETE SET NULL,
  specific_numbers text[],
  reminder_enabled boolean DEFAULT false,
  reminder_time timestamptz,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE whatsapp_blast_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_user_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_whatsapp_blasts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for whatsapp_blast_categories
CREATE POLICY "Users can view their own blast categories"
  ON whatsapp_blast_categories
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own blast categories"
  ON whatsapp_blast_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own blast categories"
  ON whatsapp_blast_categories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blast categories"
  ON whatsapp_blast_categories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policies for whatsapp_labels
CREATE POLICY "Users can view their own labels"
  ON whatsapp_labels
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own labels"
  ON whatsapp_labels
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own labels"
  ON whatsapp_labels
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own labels"
  ON whatsapp_labels
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create RLS policies for whatsapp_user_labels
CREATE POLICY "Users can view their own user labels"
  ON whatsapp_user_labels
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_users wu 
      WHERE wu.id = whatsapp_user_id 
      AND wu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own user labels"
  ON whatsapp_user_labels
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_users wu 
      WHERE wu.id = whatsapp_user_id 
      AND wu.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own user labels"
  ON whatsapp_user_labels
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_users wu 
      WHERE wu.id = whatsapp_user_id 
      AND wu.user_id = auth.uid()
    )
  );

-- Create RLS policies for scheduled_whatsapp_blasts
CREATE POLICY "Users can view their own scheduled blasts"
  ON scheduled_whatsapp_blasts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scheduled blasts"
  ON scheduled_whatsapp_blasts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scheduled blasts"
  ON scheduled_whatsapp_blasts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scheduled blasts"
  ON scheduled_whatsapp_blasts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_whatsapp_blast_categories_user_id ON whatsapp_blast_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_blast_categories_name ON whatsapp_blast_categories(name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_labels_user_id ON whatsapp_labels(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_labels_category_id ON whatsapp_labels(category_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_labels_name ON whatsapp_labels(name);

CREATE INDEX IF NOT EXISTS idx_whatsapp_user_labels_whatsapp_user_id ON whatsapp_user_labels(whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_user_labels_label_id ON whatsapp_user_labels(label_id);

CREATE INDEX IF NOT EXISTS idx_scheduled_whatsapp_blasts_user_id ON scheduled_whatsapp_blasts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_whatsapp_blasts_status ON scheduled_whatsapp_blasts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_whatsapp_blasts_scheduled_at ON scheduled_whatsapp_blasts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_whatsapp_blasts_target_type ON scheduled_whatsapp_blasts(target_type);
CREATE INDEX IF NOT EXISTS idx_scheduled_whatsapp_blasts_target_label_id ON scheduled_whatsapp_blasts(target_label_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_whatsapp_blasts_target_category_id ON scheduled_whatsapp_blasts(target_category_id);

-- Create updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_whatsapp_blast_categories_updated_at'
  ) THEN
    CREATE TRIGGER update_whatsapp_blast_categories_updated_at
      BEFORE UPDATE ON whatsapp_blast_categories
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_whatsapp_labels_updated_at'
  ) THEN
    CREATE TRIGGER update_whatsapp_labels_updated_at
      BEFORE UPDATE ON whatsapp_labels
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_scheduled_whatsapp_blasts_updated_at'
  ) THEN
    CREATE TRIGGER update_scheduled_whatsapp_blasts_updated_at
      BEFORE UPDATE ON scheduled_whatsapp_blasts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;