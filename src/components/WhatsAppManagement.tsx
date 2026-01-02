import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  Plus, 
  Search, 
  MoreHorizontal,
  User,
  MessageSquare,
  Clock,
  AlertTriangle,
  Activity,
  Heart,
  Stethoscope,
  Calendar,
  Shield,
  Phone,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  Loader2,
  Filter,
  Settings
} from 'lucide-react';

import HealthcareWhatsAppManagement from './HealthcareWhatsAppManagement';
import { WhatsAppService, WhatsAppUser, AIConversation, WHATSAPP_USER_LIMITS } from '../lib/whatsappService';
import { UserBusinessProfile } from '../types/database';
import { supabase } from '../lib/supabaseClient';

interface WhatsAppManagementProps {
  userBusinessProfile?: UserBusinessProfile | null;
}

const WhatsAppManagement: React.FC<WhatsAppManagementProps> = ({ userBusinessProfile }) => {
  const [whatsappUsers, setWhatsappUsers] = useState<WhatsAppUser[]>([]);
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [addUserForm, setAddUserForm] = useState({
    whatsapp_number: '',
    customer_name: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Check if this is a healthcare business
  const isHealthcareBusiness = userBusinessProfile?.industry === 'healthcare';

  // If healthcare business, render the healthcare-specific component
  if (isHealthcareBusiness) {
    return <HealthcareWhatsAppManagement userBusinessProfile={userBusinessProfile} />;
  }

  useEffect(() => {
    fetchWhatsAppData();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchWhatsAppData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [usersData, conversationsData] = await Promise.all([
        WhatsAppService.getWhatsAppUsers(user.id),
        WhatsAppService.getConversations(user.id, 20)
      ]);

      setWhatsappUsers(usersData);
      setConversations(conversationsData);
    } catch (error) {
      console.error('Error fetching WhatsApp data:', error);
      showMessage('error', 'Gagal memuat data WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!addUserForm.whatsapp_number.trim()) {
      showMessage('error', 'Nomor WhatsApp harus diisi');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await WhatsAppService.addWhatsAppUser(user.id, addUserForm);
      await fetchWhatsAppData();
      setAddUserForm({ whatsapp_number: '', customer_name: '' });
      setShowAddUserForm(false);
      showMessage('success', 'Pengguna WhatsApp berhasil ditambahkan');
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal menambahkan pengguna WhatsApp');
    }
  };

  const handleDeleteUser = async (whatsappUserId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus pengguna WhatsApp ini?')) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await WhatsAppService.deleteWhatsAppUser(user.id, whatsappUserId);
      await fetchWhatsAppData();
      showMessage('success', 'Pengguna WhatsApp berhasil dihapus');
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal menghapus pengguna WhatsApp');
    }
  };

  const handleTestAI = async () => {
    if (!testMessage.trim()) {
      showMessage('error', 'Pesan test harus diisi');
      return;
    }

    setTestLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await WhatsAppService.testAIResponse(user.id, testMessage);
      setTestResponse(response);
      showMessage('success', 'Test AI berhasil');
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal test AI');
      setTestResponse('');
    } finally {
      setTestLoading(false);
    }
  };

  // Get user limit based on plan
  const getUserLimit = () => {
    const plan = userBusinessProfile?.selected_plan || 'starter';
    const limit = WHATSAPP_USER_LIMITS[plan];
    return limit === -1 ? 'Unlimited' : limit.toString();
  };

  if (loading) {
    return (
      <div className="main-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Memuat data WhatsApp...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Header */}
      <div className="main-header">
        <div className="date-text">WhatsApp AI System</div>
        <h1 className="greeting">
          WhatsApp AI - {userBusinessProfile?.business_name}
        </h1>
        <div className="help-text">
          Kelola nomor WhatsApp dan percakapan AI untuk {userBusinessProfile?.business_name || 'bisnis Anda'}
        </div>
        
        <div className="action-buttons">
          <button 
            onClick={() => setShowAddUserForm(true)}
            className="action-button primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Nomor
          </button>
          <button 
            onClick={() => setShowTestForm(true)}
            className="action-button secondary"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Test AI
          </button>
          <button 
            onClick={fetchWhatsAppData}
            className="action-button secondary"
          >
            <Activity className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-3 ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          )}
          <p className={`text-sm ${
            message.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="content-grid">
        {/* Left Column - WhatsApp Users */}
        <div>
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <Smartphone className="tasks-icon" />
                Nomor WhatsApp Terdaftar ({whatsappUsers.length}/{getUserLimit()})
              </div>
              <div className="tasks-actions">
                <Plus className="w-4 h-4 cursor-pointer text-gray-400" onClick={() => setShowAddUserForm(true)} />
                <Search className="w-4 h-4 cursor-pointer text-gray-400" />
                <MoreHorizontal className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* WhatsApp Users List */}
            {whatsappUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Smartphone className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Belum ada nomor WhatsApp terdaftar</p>
                <p className="text-sm">Tambahkan nomor WhatsApp pelanggan untuk mulai melayani</p>
              </div>
            ) : (
              whatsappUsers.map((whatsappUser) => (
                <div key={whatsappUser.id} className="task-item">
                  <div className="task-checkbox bg-green-500 border-green-500">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <div className="task-content flex-1">
                    <div className="task-name">
                      {whatsappUser.customer_name || `User ${whatsappUser.whatsapp_number.slice(-4)}`}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded font-medium">
                        {whatsappUser.whatsapp_number}
                      </div>
                      <div className="task-due">
                        {whatsappUser.created_at ? new Date(whatsappUser.created_at).toLocaleDateString('id-ID') : 'Baru'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Lihat Percakapan"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(whatsappUser.id)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent Conversations */}
          <div className="tasks-section mt-6">
            <div className="tasks-header">
              <div className="tasks-title">
                <MessageSquare className="tasks-icon" />
                Percakapan Terbaru
              </div>
            </div>

            {conversations.slice(0, 5).map((conv) => (
              <div key={conv.id} className="task-item">
                <div className={`task-checkbox ${
                  conv.message_type === 'incoming' ? 'bg-blue-500 border-blue-500' : 'bg-green-500 border-green-500'
                }`}>
                  {conv.message_type === 'incoming' ? (
                    <User className="w-3 h-3 text-white" />
                  ) : (
                    <MessageSquare className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="task-content flex-1">
                  <div className="task-name">
                    {conv.message_type === 'incoming' ? 'Pelanggan' : 'AI'}: {conv.whatsapp_number}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {conv.message_content}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="task-due">
                      {conv.created_at ? new Date(conv.created_at).toLocaleString('id-ID') : 'Baru'}
                    </div>
                    {conv.processing_time_ms && (
                      <div className="text-xs text-purple-600">
                        {conv.processing_time_ms}ms
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Analytics & Controls */}
        <div className="right-sidebar">
          {/* WhatsApp Analytics */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Analitik WhatsApp</div>
              <div className="widget-action">Hari Ini</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Nomor</span>
                <span className="font-semibold text-green-600">{whatsappUsers.length}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Percakapan Hari Ini</span>
                <span className="font-semibold text-blue-600">
                  {conversations.filter(c => {
                    const today = new Date().toDateString();
                    const convDate = c.created_at ? new Date(c.created_at).toDateString() : '';
                    return convDate === today;
                  }).length}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Respons AI</span>
                <span className="font-semibold text-purple-600">
                  {conversations.filter(c => c.message_type === 'outgoing').length}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Waktu Respons Rata-rata</span>
                <span className="font-semibold text-orange-600">
                  {conversations.length > 0 
                    ? Math.round(conversations.reduce((sum, c) => sum + (c.processing_time_ms || 0), 0) / conversations.length)
                    : 0}ms
                </span>
              </div>
            </div>
          </div>

          {/* AI Status */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Status AI</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">AI Customer Service</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Aktif</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <MessageSquare className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">WhatsApp Integration</span>
                </div>
                <span className="text-xs text-blue-600 font-medium">Terhubung</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Activity className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Basis Pengetahuan</span>
                </div>
                <span className="text-xs text-purple-600 font-medium">Terlatih</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Tindakan Cepat</div>
            </div>
            
            <div className="space-y-2">
              <button 
                onClick={() => setShowAddUserForm(true)}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 text-green-500" />
                <span className="text-sm">Tambah Nomor WhatsApp</span>
              </button>
              
              <button 
                onClick={() => setShowTestForm(true)}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Test AI Response</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Settings className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Pengaturan AI</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Activity className="w-4 h-4 text-orange-500" />
                <span className="text-sm">Lihat Analitik</span>
              </button>
            </div>
          </div>

          {/* Plan Limits */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Batas Paket</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Paket Saat Ini</span>
                <span className="font-semibold text-purple-600 capitalize">
                  {userBusinessProfile?.selected_plan || 'starter'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Nomor WhatsApp</span>
                <span className="font-semibold text-blue-600">
                  {whatsappUsers.length}/{getUserLimit()}
                </span>
              </div>
              
              {/* Progress bar for usage */}
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${Math.min(100, (whatsappUsers.length / (WHATSAPP_USER_LIMITS[userBusinessProfile?.selected_plan || 'starter'] || 1)) * 100)}%` 
                  }}
                />
              </div>
              
              <p className="text-xs text-gray-500">
                {WHATSAPP_USER_LIMITS[userBusinessProfile?.selected_plan || 'starter'] === -1 
                  ? 'Unlimited nomor WhatsApp'
                  : `${WHATSAPP_USER_LIMITS[userBusinessProfile?.selected_plan || 'starter'] - whatsappUsers.length} slot tersisa`
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUserForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Tambah Nomor WhatsApp</h3>
              <button
                onClick={() => setShowAddUserForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor WhatsApp *
                </label>
                <input
                  type="tel"
                  value={addUserForm.whatsapp_number}
                  onChange={(e) => setAddUserForm({...addUserForm, whatsapp_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="628123456789"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Pelanggan (Opsional)
                </label>
                <input
                  type="text"
                  value={addUserForm.customer_name}
                  onChange={(e) => setAddUserForm({...addUserForm, customer_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Nama lengkap pelanggan"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Catatan:</strong> Nomor WhatsApp yang ditambahkan akan dapat mengirim pesan ke nomor bisnis Anda dan mendapat balasan otomatis dari AI.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAddUserForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleAddUser}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Tambah Nomor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test AI Modal */}
      {showTestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Test AI Response</h3>
              <button
                onClick={() => setShowTestForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pesan Test (Simulasi Pelanggan)
                </label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                  placeholder="Contoh: Apa jam operasional bisnis Anda?"
                />
              </div>

              <button 
                onClick={handleTestAI}
                disabled={testLoading || !testMessage.trim()}
                className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {testLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{testLoading ? 'Memproses...' : 'Test AI'}</span>
              </button>

              {testResponse && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Respons AI:
                  </label>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{testResponse}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  setShowTestForm(false);
                  setTestMessage('');
                  setTestResponse('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppManagement;