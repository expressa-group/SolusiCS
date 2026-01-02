export interface UserBusinessProfile {
  id: string;
  user_id: string;
  role?: 'user' | 'admin';
  business_name?: string;
  description?: string;
  industry?: string;
  operating_hours?: string;
  whatsapp_number?: string;
  selected_plan?: string;
  setup_completed?: boolean;
  pricing_completed?: boolean;
  trial_status?: 'none' | 'requested' | 'active' | 'expired';
  trial_requested_at?: string;
  trial_started_at?: string;
  trial_ends_at?: string;
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
  current_order_data?: any;
  created_at?: string;
  updated_at?: string;
}

export interface CartOrder {
  id: string;
  user_id: string;
  whatsapp_user_id: string;
  step: 'browsing' | 'collecting_items' | 'collecting_details' | 'confirming_order' | 'awaiting_payment' | 'completed';
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
  }>;
  total_amount: number;
  customer_name?: string;
  phone_number?: string;
  outlet_preference?: string;
  delivery_method?: 'pickup' | 'delivery';
  special_requests?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  user_id: string;
  name: string;
  price?: string;
  description?: string;
  category?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FAQ {
  id: string;
  user_id: string;
  question: string;
  answer: string;
  category?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

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

export interface WhatsAppBlastCategory {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppLabel {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  category_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppUserLabel {
  whatsapp_user_id: string;
  label_id: string;
  created_at?: string;
}

export interface ScheduledWhatsAppBlast {
  id: string;
  user_id: string;
  message_content: string;
  scheduled_at: string;
  status: 'draft' | 'scheduled' | 'sent' | 'failed' | 'cancelled';
  target_type: 'all_users' | 'by_label' | 'by_category' | 'specific_numbers';
  target_label_id?: string;
  target_category_id?: string;
  specific_numbers?: string[];
  reminder_enabled?: boolean;
  reminder_time?: string;
  sent_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  user_id: string;
  whatsapp_user_id: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'cancelled' | 'completed' | 'failed';
  payment_method?: string;
  midtrans_transaction_id?: string;
  midtrans_snap_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_order: number;
  created_at?: string;
}

export interface KnowledgeItem {
  id: string;
  type: 'business_info' | 'product' | 'faq' | 'custom';
  question: string;
  answer: string;
  category: string;
  priority: 'Tinggi' | 'Rendah';
  lastUpdated: string;
  source?: string;
  parent_id?: string;
}

export interface AdminAuditLog {
  id: string;
  admin_user_id: string;
  target_user_id?: string;
  action: string;
  details: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      user_business_profiles: {
        Row: UserBusinessProfile;
        Insert: Omit<UserBusinessProfile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserBusinessProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      products: {
        Row: Product;
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Product, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      faqs: {
        Row: FAQ;
        Insert: Omit<FAQ, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<FAQ, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      whatsapp_users: {
        Row: WhatsAppUser;
        Insert: Omit<WhatsAppUser, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<WhatsAppUser, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      ai_conversations: {
        Row: AIConversation;
        Insert: Omit<AIConversation, 'id' | 'created_at'>;
        Update: Partial<Omit<AIConversation, 'id' | 'user_id' | 'created_at'>>;
      };
      whatsapp_blast_categories: {
        Row: WhatsAppBlastCategory;
        Insert: Omit<WhatsAppBlastCategory, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<WhatsAppBlastCategory, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      whatsapp_labels: {
        Row: WhatsAppLabel;
        Insert: Omit<WhatsAppLabel, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<WhatsAppLabel, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      whatsapp_user_labels: {
        Row: WhatsAppUserLabel;
        Insert: Omit<WhatsAppUserLabel, 'created_at'>;
        Update: never;
      };
      scheduled_whatsapp_blasts: {
        Row: ScheduledWhatsAppBlast;
        Insert: Omit<ScheduledWhatsAppBlast, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ScheduledWhatsAppBlast, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Order, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
      };
      cart_orders: {
        Row: CartOrder;
        Insert: Omit<CartOrder, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<CartOrder, 'id' | 'user_id' | 'whatsapp_user_id' | 'created_at' | 'updated_at'>>;
      };
      order_items: {
        Row: OrderItem;
        Insert: Omit<OrderItem, 'id' | 'created_at'>;
        Update: never;
      };
      admin_audit_logs: {
        Row: AdminAuditLog;
        Insert: Omit<AdminAuditLog, 'id' | 'created_at'>;
        Update: never;
      };
    };
  };
}