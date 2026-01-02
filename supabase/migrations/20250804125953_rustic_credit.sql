/*
  # Sistem Pemesanan Restoran

  1. New Tables
    - `orders`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key ke auth.users)
      - `whatsapp_user_id` (uuid, foreign key ke whatsapp_users)
      - `total_amount` (numeric)
      - `status` (text: pending, paid, cancelled, completed, failed)
      - `payment_method` (text)
      - `midtrans_transaction_id` (text)
      - `midtrans_snap_url` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `order_items`
      - `id` (uuid, primary key)
      - `order_id` (uuid, foreign key ke orders)
      - `product_id` (uuid, foreign key ke products)
      - `quantity` (integer)
      - `price_at_order` (numeric)
      - `created_at` (timestamp)

  2. Schema Updates
    - Add `current_order_data` column to `user_business_profiles`

  3. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own data
*/

-- Add current_order_data column to user_business_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_business_profiles' AND column_name = 'current_order_data'
  ) THEN
    ALTER TABLE public.user_business_profiles 
    ADD COLUMN current_order_data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    whatsapp_user_id uuid NOT NULL REFERENCES public.whatsapp_users(id) ON DELETE CASCADE,
    total_amount numeric NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'completed', 'failed')),
    payment_method text,
    midtrans_transaction_id text,
    midtrans_snap_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity integer NOT NULL,
    price_at_order numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Indexes for orders table
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_whatsapp_user_id ON public.orders (whatsapp_user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_midtrans_transaction_id ON public.orders (midtrans_transaction_id) WHERE midtrans_transaction_id IS NOT NULL;

-- Indexes for order_items table
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items (product_id);

-- Enable RLS for orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Policies for orders table
CREATE POLICY "Users can view their own orders"
ON public.orders FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own orders"
ON public.orders FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own orders"
ON public.orders FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Enable RLS for order_items table
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Policies for order_items table
CREATE POLICY "Users can view their own order items"
ON public.order_items FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

CREATE POLICY "Users can insert their own order items"
ON public.order_items FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

-- Trigger for updated_at column on orders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'update_orders_updated_at'
  ) THEN
    CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;