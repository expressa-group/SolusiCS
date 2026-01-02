import { supabase } from './supabaseClient';
import { CartOrder } from '../types/database';

export class CartOrderService {
  static async getOrCreateCart(userId: string, whatsappUserId: string): Promise<CartOrder> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Try to find existing active cart
      const { data: existingCart, error: findError } = await supabase
        .from('cart_orders')
        .select('*')
        .eq('user_id', userId)
        .eq('whatsapp_user_id', whatsappUserId)
        .neq('step', 'completed')
        .maybeSingle();

      if (findError && findError.code !== 'PGRST116') {
        throw findError;
      }

      if (existingCart) {
        return existingCart;
      }

      // Create new cart if none exists
      const { data: newCart, error: createError } = await supabase
        .from('cart_orders')
        .insert({
          user_id: userId,
          whatsapp_user_id: whatsappUserId,
          step: 'browsing',
          items: [],
          total_amount: 0
        })
        .select()
        .single();

      if (createError) throw createError;
      return newCart;
    } catch (error) {
      console.error('Error getting or creating cart:', error);
      throw error;
    }
  }

  static async updateCart(
    userId: string,
    cartId: string,
    updates: Partial<{
      step: string;
      items: Array<{
        product_id: string;
        product_name: string;
        quantity: number;
        price: number;
      }>;
      total_amount: number;
      customer_name: string;
      phone_number: string;
      outlet_preference: string;
      delivery_method: string;
      special_requests: string;
    }>
  ): Promise<CartOrder | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('cart_orders')
        .update(updates)
        .eq('id', cartId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating cart:', error);
      throw error;
    }
  }

  static async clearCart(userId: string, whatsappUserId: string): Promise<boolean> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { error } = await supabase
        .from('cart_orders')
        .update({
          step: 'completed',
          items: [],
          total_amount: 0
        })
        .eq('user_id', userId)
        .eq('whatsapp_user_id', whatsappUserId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error clearing cart:', error);
      return false;
    }
  }

  static async getCartsByUser(userId: string, limit: number = 50): Promise<CartOrder[]> {
    try {
      const { data, error } = await supabase
        .from('cart_orders')
        .select(`
          *,
          whatsapp_users (
            whatsapp_number,
            customer_name
          )
        `)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching carts by user:', error);
      return [];
    }
  }

  static async getActiveCartsCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('cart_orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .neq('step', 'completed');

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error counting active carts:', error);
      return 0;
    }
  }
}