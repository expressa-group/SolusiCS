import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Mail,
  Building,
  Calendar,
  Loader2,
  AlertCircle,
  Gift,
  Search,
  Filter
} from 'lucide-react';
import { BusinessProfileService } from '../../lib/businessProfileService';
import { AdminService } from '../../lib/adminService';
import { UserBusinessProfile } from '../../types/database';
import { supabase } from '../../lib/supabaseClient';

const TrialApprovalPage: React.FC = () => {
  const [trialRequests, setTrialRequests] = useState<UserBusinessProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<any>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTrialRequests();
    fetchStats();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchTrialRequests = async () => {
    try {
      const requests = await BusinessProfileService.getAllTrialRequests();
      setTrialRequests(requests);
    } catch (error) {
      console.error('Error fetching trial requests:', error);
      showMessage('error', 'Gagal memuat pengajuan trial');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const statistics = await AdminService.getTrialStatistics();
      setStats(statistics);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequests.size === 0) {
      showMessage('error', 'Pilih minimal satu pengajuan');
      return;
    }

    setBulkProcessing(true);
    try {
      const result = await AdminService.bulkApproveTrial(Array.from(selectedRequests));
      showMessage('success', `${result.approved_count} trial berhasil disetujui`);
      setSelectedRequests(new Set());
      await fetchTrialRequests();
      await fetchStats();
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal menyetujui trial secara bulk');
    } finally {
      setBulkProcessing(false);
    }
  };

  const toggleRequestSelection = (userId: string) => {
    const newSelection = new Set(selectedRequests);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedRequests(newSelection);
  };

  const selectAllVisible = () => {
    const visibleIds = filteredRequests.map(req => req.user_id);
    setSelectedRequests(new Set(visibleIds));
  };

  const clearSelection = () => {
    setSelectedRequests(new Set());
  };

  const handleApproveTrial = async (userId: string) => {
    setProcessingId(userId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Admin not authenticated');

      await BusinessProfileService.approveTrial(userId, user.id);
      await fetchTrialRequests();
      await fetchStats();
      showMessage('success', 'Trial berhasil disetujui');
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal menyetujui trial');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectTrial = async (userId: string) => {
    if (!confirm('Apakah Anda yakin ingin menolak pengajuan trial ini?')) return;

    setProcessingId(userId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Admin not authenticated');

      await BusinessProfileService.rejectTrial(userId, user.id);
      await fetchTrialRequests();
      await fetchStats();
      showMessage('success', 'Trial berhasil ditolak');
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal menolak trial');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredRequests = trialRequests.filter(request =>
    (request.business_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.user_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="main-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Memuat pengajuan trial...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Header */}
      <div className="main-header">
        <div className="date-text">Admin Panel</div>
        <h1 className="greeting">Persetujuan Trial</h1>
        <div className="help-text">Kelola pengajuan trial 14 hari dari pengguna</div>
        
        <div className="action-buttons">
          {selectedRequests.size > 0 && (
            <button 
              onClick={handleBulkApprove}
              disabled={bulkProcessing}
              className="action-button primary"
            >
              {bulkProcessing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Setujui {selectedRequests.size} Trial
            </button>
          )}
          <button 
            onClick={fetchTrialRequests}
            className="action-button secondary"
          >
            <Clock className="w-4 h-4 mr-2" />
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
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          )}
          <p className={`text-sm ${
            message.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {message.text}
          </p>
        </div>
      )}

      <div className="content-grid">
        {/* Left Column - Trial Requests */}
        <div>
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <Gift className="tasks-icon" />
                Pengajuan Trial ({filteredRequests.length})
              </div>
              <div className="tasks-actions">
                <Search className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama bisnis atau user ID..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedRequests.size > 0 && (
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between bg-purple-50 p-3 rounded-lg">
                  <span className="text-sm text-purple-700">
                    {selectedRequests.size} pengajuan dipilih
                  </span>
                  <div className="flex space-x-2">
                    <button
                      onClick={clearSelection}
                      className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded hover:bg-gray-200"
                    >
                      Batal
                    </button>
                    <button
                      onClick={selectAllVisible}
                      className="text-xs bg-purple-100 text-purple-600 px-3 py-1 rounded hover:bg-purple-200"
                    >
                      Pilih Semua
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Trial Requests List */}
            {filteredRequests.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Gift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Tidak ada pengajuan trial</p>
                <p className="text-sm">Semua pengajuan trial telah diproses</p>
              </div>
            ) : (
              filteredRequests.map((request) => (
                <div key={request.id} className="task-item">
                  <div className="flex items-center mr-3">
                    <input
                      type="checkbox"
                      checked={selectedRequests.has(request.user_id)}
                      onChange={() => toggleRequestSelection(request.user_id)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="task-checkbox bg-yellow-500 border-yellow-500">
                    <Clock className="w-3 h-3 text-white" />
                  </div>
                  <div className="task-content flex-1">
                    <div className="task-name">
                      {request.business_name || 'Bisnis Belum Diatur'}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium">
                        {request.industry || 'Industri belum dipilih'}
                      </div>
                      <div className="task-due">
                        {request.trial_requested_at 
                          ? new Date(request.trial_requested_at).toLocaleDateString('id-ID')
                          : 'Tanggal tidak tersedia'
                        }
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-2">
                      User ID: {request.user_id}
                    </div>
                    {request.description && (
                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {request.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveTrial(request.user_id)}
                      disabled={processingId === request.user_id}
                      className="p-2 text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Setujui Trial"
                    >
                      {processingId === request.user_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRejectTrial(request.user_id)}
                      disabled={processingId === request.user_id}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Tolak Trial"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column - Stats & Info */}
        <div className="right-sidebar">
          {/* Trial Statistics */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Statistik Trial</div>
            </div>
            
            <div className="space-y-4">
              {stats && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Pengajuan Hari Ini</span>
                    <span className="font-semibold text-yellow-600">{stats.requests_today}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Disetujui Hari Ini</span>
                    <span className="font-semibold text-green-600">{stats.approvals_today}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total Trial Aktif</span>
                    <span className="font-semibold text-blue-600">{stats.active_trials}</span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Konversi ke Berbayar</span>
                    <span className="font-semibold text-purple-600">
                      {stats.total_users > 0 ? ((stats.paid_users / stats.total_users) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pengajuan Pending</span>
                <span className="font-semibold text-yellow-600">{trialRequests.length}</span>
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
                onClick={fetchTrialRequests}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Refresh Pengajuan</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Users className="w-4 h-4 text-green-500" />
                <span className="text-sm">Lihat Semua User</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Building className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Kelola Bisnis</span>
              </button>
            </div>
          </div>

          {/* Trial Guidelines */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Panduan Persetujuan</div>
            </div>
            
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>Kriteria Persetujuan:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>Informasi bisnis lengkap</li>
                <li>Email terverifikasi</li>
                <li>Industri yang jelas</li>
                <li>Tidak ada riwayat penyalahgunaan</li>
              </ul>
              
              <p className="mt-4">
                <strong>Durasi Trial:</strong> 14 hari dengan akses penuh ke fitur Professional
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialApprovalPage;