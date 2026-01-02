import { supabase } from './supabaseClient';
import { FAQ } from '../types/database';

export class FaqService {
  static async getUserFaqs(userId: string): Promise<FAQ[]> {
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user FAQs:', error);
      return [];
    }
  }

  static async createFaq(userId: string, faqData: {
    question: string;
    answer: string;
    category?: string;
  }): Promise<FAQ | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('faqs')
        .insert({
          user_id: userId,
          ...faqData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating FAQ:', error);
      throw error;
    }
  }

  static async updateFaq(
    userId: string, 
    faqId: string, 
    faqData: Partial<{
      question: string;
      answer: string;
      category: string;
      is_active: boolean;
    }>
  ): Promise<FAQ | null> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      const { data, error } = await supabase
        .from('faqs')
        .update(faqData)
        .eq('id', faqId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating FAQ:', error);
      throw error;
    }
  }

  static async deleteFaq(userId: string, faqId: string): Promise<boolean> {
    try {
      // Ensure user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        throw new Error('User not authenticated or ID mismatch');
      }

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('faqs')
        .update({ is_active: false })
        .eq('id', faqId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      return false;
    }
  }

  static async getFaqsByCategory(userId: string, category: string): Promise<FAQ[]> {
    try {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching FAQs by category:', error);
      return [];
    }
  }
}