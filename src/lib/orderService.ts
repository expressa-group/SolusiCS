import { supabase } from './supabaseClient';
import { Order, OrderItem } from '../types/database';

export class OrderService {
  static async createOrder(userId: string, orderData: {
    whatsapp_user_id: string;
    total_amount: number;
    payment_method?: string;
    items: Array<{
      product_id: string;
      quantity: number;
      price_at_order: number;
    }>;
  }): Promise<Order | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          whatsapp_user_id: orderData.whatsapp_user_id,
          total_amount: orderData.total_amount,
          payment_method: orderData.payment_method,
          status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = orderData.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_order: item.price_at_order
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  static async getOrder(userId: string, orderId: string): Promise<Order | null> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name, price)
          )
        `)
        .eq('id', orderId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }

  static async updateOrderStatus(
    userId: string, 
    orderId: string, 
    status: 'pending' | 'paid' | 'cancelled' | 'completed' | 'failed',
    midtransTransactionId?: string
  ): Promise<Order | null> {
    try {
      const updateData: any = { status };
      if (midtransTransactionId) {
        updateData.midtrans_transaction_id = midtransTransactionId;
      }

      const { data, error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  static async getUserOrders(userId: string, limit: number = 50): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name, price)
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user orders:', error);
      return [];
    }
  }

  static async getOrdersByWhatsAppUser(
    userId: string, 
    whatsappUserId: string, 
    limit: number = 20
  ): Promise<Order[]> {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (name, price)
          )
        `)
        .eq('user_id', userId)
        .eq('whatsapp_user_id', whatsappUserId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching orders by WhatsApp user:', error);
      return [];
    }
  }
}