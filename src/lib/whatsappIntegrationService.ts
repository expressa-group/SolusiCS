import { supabase } from './supabaseClient';

export interface WhatsAppIntegrationStatus {
  fonnte_device_id?: string | null;
  fonnte_status?: string;
  fonnte_qr_code_url?: string | null;
  fonnte_connected_at?: string | null;
}

export interface WhatsAppConnectionResult {
  success: boolean;
  device_id?: string;
  qr_code?: string;
  status?: string;
  device_state?: string
  device_info?: any
  clean_number?: string
  total_devices?: number
  connected_devices?: number
  device_token_stored?: boolean;
  message?: string;
  error?: string;
}

export class WhatsAppIntegrationService {
  static async startConnection(userId: string, whatsappNumber: string): Promise<WhatsAppConnectionResult> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/fonnte-device-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'start-connection',
          user_id: userId,
          whatsapp_number: whatsappNumber
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error starting WhatsApp connection:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static async getDeviceStatus(userId: string, whatsappNumber: string): Promise<WhatsAppConnectionResult> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/fonnte-device-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'get-device-status',
          user_id: userId,
          whatsapp_number: whatsappNumber
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error getting device status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static async checkStatus(userId: string): Promise<WhatsAppConnectionResult> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/fonnte-device-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'check-status',
          user_id: userId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static async disconnect(userId: string): Promise<WhatsAppConnectionResult> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/fonnte-device-manager`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: 'disconnect',
          user_id: userId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static getStatusDisplay(status?: string): { text: string; color: string; icon: string } {
    switch (status) {
      case 'connected':
        return { text: 'Terhubung', color: 'text-green-600', icon: '🟢' };
      case 'scanning_qr':
        return { text: 'Menunggu Pindai QR', color: 'text-yellow-600', icon: '🟡' };
      case 'error':
        return { text: 'Error', color: 'text-red-600', icon: '🔴' };
      case 'expired':
        return { text: 'QR Kedaluwarsa', color: 'text-orange-600', icon: '🟠' };
      case 'disconnected':
      default:
        return { text: 'Terputus', color: 'text-gray-600', icon: '⚪' };
    }
  }

  static getDeviceStateDisplay(deviceState?: string): { text: string; color: string; icon: string; action: string } {
    switch (deviceState) {
      case 'registered_connected':
        return { text: 'Perangkat Terdaftar & Terhubung', color: 'text-green-600', icon: '🟢', action: 'disconnect' };
      case 'registered_disconnected':
        return { text: 'Perangkat Terdaftar (Terputus)', color: 'text-orange-600', icon: '🟠', action: 'reconnect' };
      case 'registered_scanning_qr':
        return { text: 'Perangkat Terdaftar (Menunggu QR)', color: 'text-yellow-600', icon: '🟡', action: 'disconnect' };
      case 'registered_error':
        return { text: 'Perangkat Terdaftar (Error)', color: 'text-red-600', icon: '🔴', action: 'reconnect' };
      case 'not_found':
        return { text: 'Perangkat Belum Terdaftar', color: 'text-gray-600', icon: '⚪', action: 'register' };
      default:
        return { text: 'Status Tidak Diketahui', color: 'text-gray-600', icon: '❓', action: 'register' };
    }
  }
}