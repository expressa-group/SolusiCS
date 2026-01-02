/*
  # Create cart_orders table for WhatsApp order management

  1. New Tables
    - `cart_orders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `whatsapp_user_id` (uuid, foreign key to whatsapp_users)
      - `step` (text, order flow step)
      - `items` (jsonb, cart items)
      - `total_amount` (numeric, cart total)
      - `customer_name` (text, customer name)
      - `phone_number` (text, customer phone)
      - `outlet_preference` (text, preferred outlet)
      - `delivery_method` (text, pickup/delivery)
      - `special_requests` (text, special requests)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `cart_orders` table
    - Add policies for authenticated users to manage their own carts

  3. Changes
    - Remove current_order_data column from user_business_profiles
    - Add unique constraint for active whatsapp users per business
    - Add indexes for efficient cart querying
*/

-- Create cart_orders table
CREATE TABLE IF NOT EXISTS public.cart_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
  step text NOT NULL DEFAULT 'browsing',
  items jsonb DEFAULT '[]'::jsonb,
  total_amount numeric DEFAULT 0,
  customer_name text,
  phone_number text,
  outlet_preference text,
  delivery_method text,
  special_requests text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for step values
ALTER TABLE public.cart_orders 
ADD CONSTRAINT cart_orders_step_check 
CHECK (step IN ('browsing', 'collecting_items', 'collecting_details', 'confirming_order', 'awaiting_payment', 'completed'));

-- Add check constraint for delivery_method values
ALTER TABLE public.cart_orders 
ADD CONSTRAINT cart_orders_delivery_method_check 
CHECK (delivery_method IS NULL OR delivery_method IN ('pickup', 'delivery'));

-- Enable RLS on cart_orders table
ALTER TABLE public.cart_orders ENABLE ROW LEVEL SECURITY;

-- Create policies for cart_orders
CREATE POLICY "Users can view their own carts"
  ON public.cart_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own carts"
  ON public.cart_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own carts"
  ON public.cart_orders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own carts"
  ON public.cart_orders
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cart_orders_user_id ON public.cart_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_orders_whatsapp_user_id ON public.cart_orders(whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_cart_orders_step ON public.cart_orders(step);
CREATE INDEX IF NOT EXISTS idx_cart_orders_active_carts ON public.cart_orders(user_id, whatsapp_user_id) WHERE step != 'completed';
CREATE INDEX IF NOT EXISTS idx_cart_orders_updated_at ON public.cart_orders(updated_at DESC);

-- Create trigger for updated_at
CREATE TRIGGER update_cart_orders_updated_at
  BEFORE UPDATE ON public.cart_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Remove current_order_data column from user_business_profiles if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'current_order_data'
  ) THEN
    ALTER TABLE public.user_business_profiles DROP COLUMN current_order_data;
  END IF;
END $$;

-- Add unique constraint for active whatsapp users per business
-- This ensures one WhatsApp number can only be registered once per business
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'whatsapp_users_user_id_whatsapp_number_active_key'
  ) THEN
    CREATE UNIQUE INDEX whatsapp_users_user_id_whatsapp_number_active_key 
    ON public.whatsapp_users(user_id, whatsapp_number) 
    WHERE is_active = true;
  END IF;
END $$;