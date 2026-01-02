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
  Loader2
} from 'lucide-react';

import { UserBusinessProfile } from '../types/database';
import { HealthcareWhatsAppService, HealthcareWhatsAppUser, HealthcareAIConversation } from '../lib/healthcareWhatsappService';
import { supabase } from '../lib/supabaseClient';

interface HealthcareWhatsAppManagementProps {
  userBusinessProfile?: UserBusinessProfile | null;
}

const HealthcareWhatsAppManagement: React.FC<HealthcareWhatsAppManagementProps> = ({ userBusinessProfile }) => {
  const [patients, setPatients] = useState<HealthcareWhatsAppUser[]>([]);
  const [conversations, setConversations] = useState<HealthcareAIConversation[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddPatientForm, setShowAddPatientForm] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [addPatientForm, setAddPatientForm] = useState({
    whatsapp_number: '',
    customer_name: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (userBusinessProfile?.industry === 'healthcare') {
      fetchHealthcareData();
    }
  }, [userBusinessProfile]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchHealthcareData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [patientsData, conversationsData, analyticsData] = await Promise.all([
        HealthcareWhatsAppService.getHealthcarePatients(user.id),
        HealthcareWhatsAppService.getHealthcareConversations(user.id, 20),
        HealthcareWhatsAppService.getHealthcareAnalytics(user.id)
      ]);

      setPatients(patientsData);
      setConversations(conversationsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error fetching healthcare data:', error);
      showMessage('error', 'Gagal memuat data healthcare');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPatient = async () => {
    if (!addPatientForm.whatsapp_number.trim()) {
      showMessage('error', 'Nomor WhatsApp harus diisi');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await HealthcareWhatsAppService.addHealthcarePatient(user.id, addPatientForm);
      await fetchHealthcareData();
      setAddPatientForm({ whatsapp_number: '', customer_name: '' });
      setShowAddPatientForm(false);
      showMessage('success', 'Pasien berhasil ditambahkan');
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal menambahkan pasien');
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

      const response = await HealthcareWhatsAppService.testHealthcareAIResponse(user.id, testMessage);
      setTestResponse(response);
      showMessage('success', 'Test AI berhasil');
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal test AI');
      setTestResponse('');
    } finally {
      setTestLoading(false);
    }
  };

  // Only show for healthcare businesses
  if (userBusinessProfile?.industry !== 'healthcare') {
    return (
      <div className="main-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Stethoscope className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Fitur ini hanya tersedia untuk bisnis kesehatan</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="main-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Memuat data healthcare...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Header */}
      <div className="main-header">
        <div className="date-text">Healthcare AI System</div>
        <h1 className="greeting">
          🏥 WhatsApp AI Medis - {userBusinessProfile?.business_name}
        </h1>
        <div className="help-text">
          Sistem AI khusus untuk layanan kesehatan dengan protokol keamanan medis
        </div>
        
        <div className="action-buttons">
          <button 
            onClick={() => setShowAddPatientForm(true)}
            className="action-button primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Pasien
          </button>
          <button 
            onClick={() => setShowTestForm(true)}
            className="action-button secondary"
          >
            <Stethoscope className="w-4 h-4 mr-2" />
            Test AI Medis
          </button>
          <button 
            onClick={fetchHealthcareData}
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
        {/* Left Column - Patients List */}
        <div>
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <Heart className="tasks-icon" />
                Daftar Pasien ({patients.length})
              </div>
              <div className="tasks-actions">
                <Plus className="w-4 h-4 cursor-pointer text-gray-400" onClick={() => setShowAddPatientForm(true)} />
                <Search className="w-4 h-4 cursor-pointer text-gray-400" />
                <MoreHorizontal className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* Healthcare Safety Notice */}
            <div className="p-4 border-b border-gray-100">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 mb-2">
                  <Shield className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">Protokol Keamanan Medis</span>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  AI ini TIDAK memberikan diagnosis atau resep obat. Selalu arahkan pasien untuk konsultasi langsung dengan dokter untuk keluhan medis.
                </p>
              </div>
            </div>

            {/* Patients List */}
            {patients.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Belum ada pasien terdaftar</p>
                <p className="text-sm">Tambahkan nomor WhatsApp pasien untuk mulai melayani</p>
              </div>
            ) : (
              patients.map((patient) => (
                <div key={patient.id} className="task-item">
                  <div className="task-checkbox bg-blue-500 border-blue-500">
                    <User className="w-3 h-3 text-white" />
                  </div>
                  <div className="task-content flex-1">
                    <div className="task-name">
                      {patient.customer_name || `Pasien ${patient.whatsapp_number.slice(-4)}`}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium">
                        {patient.whatsapp_number}
                      </div>
                      <div className="task-due">
                        {patient.created_at ? new Date(patient.created_at).toLocaleDateString('id-ID') : 'Baru'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                      title="Hubungi Pasien"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Lihat Riwayat"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Recent Healthcare Conversations */}
          <div className="tasks-section mt-6">
            <div className="tasks-header">
              <div className="tasks-title">
                <MessageSquare className="tasks-icon" />
                Percakapan Medis Terbaru
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
                    <Stethoscope className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="task-content flex-1">
                  <div className="task-name">
                    {conv.message_type === 'incoming' ? 'Pasien' : 'AI Medis'}: {conv.whatsapp_number}
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

        {/* Right Column - Healthcare Analytics & Controls */}
        <div className="right-sidebar">
          {/* Healthcare Analytics */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Analitik Medis</div>
              <div className="widget-action">Hari Ini</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Pasien</span>
                <span className="font-semibold text-blue-600">{analytics?.total_patients || 0}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Konsultasi Hari Ini</span>
                <span className="font-semibold text-green-600">{analytics?.conversations_today || 0}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Permintaan Janji Temu</span>
                <span className="font-semibold text-purple-600">{analytics?.appointment_requests || 0}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Waktu Respons Rata-rata</span>
                <span className="font-semibold text-orange-600">{analytics?.avg_response_time || 0}s</span>
              </div>
            </div>
          </div>

          {/* Healthcare AI Status */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Status AI Medis</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Protokol Keamanan</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Aktif</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Stethoscope className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">AI Medis</span>
                </div>
                <span className="text-xs text-blue-600 font-medium">Siap</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Heart className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Basis Pengetahuan Medis</span>
                </div>
                <span className="text-xs text-purple-600 font-medium">Terlatih</span>
              </div>
            </div>
          </div>

          {/* Healthcare Quick Actions */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Tindakan Cepat</div>
            </div>
            
            <div className="space-y-2">
              <button 
                onClick={() => setShowAddPatientForm(true)}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Daftarkan Pasien Baru</span>
              </button>
              
              <button 
                onClick={() => setShowTestForm(true)}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Stethoscope className="w-4 h-4 text-green-500" />
                <span className="text-sm">Test AI Medis</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Calendar className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Jadwal Dokter</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Activity className="w-4 h-4 text-orange-500" />
                <span className="text-sm">Laporan Medis</span>
              </button>
            </div>
          </div>

          {/* Healthcare Guidelines */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Panduan AI Medis</div>
            </div>
            
            <div className="text-sm text-gray-600 space-y-2">
              <div className="flex items-start space-x-2">
                <Shield className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p>AI tidak memberikan diagnosis atau resep obat</p>
              </div>
              
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <p>Memberikan informasi umum dan jadwal praktek</p>
              </div>
              
              <div className="flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p>Mendeteksi kondisi darurat dan mengarahkan ke IGD</p>
              </div>
              
              <div className="flex items-start space-x-2">
                <Calendar className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p>Membantu membuat janji temu dengan dokter</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Patient Modal */}
      {showAddPatientForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Tambah Pasien Baru</h3>
              <button
                onClick={() => setShowAddPatientForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nomor WhatsApp Pasien *
                </label>
                <input
                  type="tel"
                  value={addPatientForm.whatsapp_number}
                  onChange={(e) => setAddPatientForm({...addPatientForm, whatsapp_number: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="628123456789"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Pasien (Opsional)
                </label>
                <input
                  type="text"
                  value={addPatientForm.customer_name}
                  onChange={(e) => setAddPatientForm({...addPatientForm, customer_name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nama lengkap pasien"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  <strong>Catatan:</strong> Pastikan pasien memberikan persetujuan untuk komunikasi melalui WhatsApp sesuai dengan kebijakan privasi medis.
                </p>
              </div>
            </div>

            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => setShowAddPatientForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleAddPatient}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tambah Pasien
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
              <h3 className="text-lg font-semibold text-gray-900">Test AI Medis</h3>
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
                  Pesan Test (Simulasi Pasien)
                </label>
                <textarea
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Contoh: Saya merasa pusing dan mual, apakah perlu ke dokter?"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  <strong>Contoh pesan test:</strong><br/>
                  • "Bagaimana cara membuat janji temu dengan dokter?"<br/>
                  • "Apakah menerima BPJS Kesehatan?"<br/>
                  • "Saya merasa pusing, apa yang harus saya lakukan?"<br/>
                  • "Jam praktek dokter hari ini?"
                </p>
              </div>

              <button 
                onClick={handleTestAI}
                disabled={testLoading || !testMessage.trim()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                {testLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{testLoading ? 'Memproses...' : 'Test AI Medis'}</span>
              </button>

              {testResponse && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Respons AI Medis:
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

export default HealthcareWhatsAppManagement;