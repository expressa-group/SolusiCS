import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Download,
  RefreshCw,
  Search,
  Filter,
  Eye,
  UserX,
  UserCheck,
  Shield,
  Database,
  Activity
} from 'lucide-react';
import { AdminService, TrialStatistics, UserSearchResult } from '../../lib/adminService';
import { AdminAuditLog } from '../../types/database';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<TrialStatistics | null>(null);
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm, filterStatus]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchDashboardData = async () => {
    try {
      const [statisticsData, dashboardData] = await Promise.all([
        AdminService.getTrialStatistics(),
        AdminService.getDashboardData()
      ]);
      
      setStats(statisticsData);
      console.log('Dashboard data:', dashboardData);
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal memuat data dashboard');
    }
  };

  const searchUsers = async () => {
    try {
      const results = await AdminService.searchUsers({
        searchTerm,
        trialStatus: filterStatus || undefined,
        limit: 100
      });
      setUsers(results);
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal mencari pengguna');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedUsers.size === 0) {
      showMessage('error', 'Pilih minimal satu pengguna');
      return;
    }

    setBulkActionLoading(true);
    try {
      const result = await AdminService.bulkApproveTrial(Array.from(selectedUsers));
      showMessage('success', `${result.approved_count} trial berhasil disetujui`);
      setSelectedUsers(new Set());
      await searchUsers();
      await fetchDashboardData();
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal menyetujui trial');
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleExportData = async () => {
    try {
      const csvData = await AdminService.exportUserData('csv');
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solusics-users-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showMessage('success', 'Data berhasil diekspor');
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal mengekspor data');
    }
  };

  const toggleUserSelection = (userId: string) => {
    const newSelection = new Set(selectedUsers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedUsers(newSelection);
  };

  const selectAllVisible = () => {
    const visibleUserIds = users.map(user => user.user_id);
    setSelectedUsers(new Set(visibleUserIds));
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
  };

  if (loading && !stats) {
    return (
      <div className="main-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Memuat dashboard admin...</p>
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
        <h1 className="greeting">Dashboard Admin</h1>
        <div className="help-text">Kelola pengguna, trial, dan sistem Solusics.ai</div>
        
        <div className="action-buttons">
          <button 
            onClick={fetchDashboardData}
            className="action-button secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button 
            onClick={handleExportData}
            className="action-button secondary"
          >
            <Download className="w-4 h-4 mr-2" />
            Ekspor Data
          </button>
          {selectedUsers.size > 0 && (
            <button 
              onClick={handleBulkApprove}
              disabled={bulkActionLoading}
              className="action-button primary"
            >
              {bulkActionLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              Setujui {selectedUsers.size} Trial
            </button>
          )}
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

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pengajuan Trial</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending_requests}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {stats.requests_today} pengajuan hari ini
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Trial Aktif</p>
                <p className="text-2xl font-bold text-blue-600">{stats.active_trials}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {stats.approvals_today} disetujui hari ini
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pengguna Berbayar</p>
                <p className="text-2xl font-bold text-green-600">{stats.paid_users}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {((stats.paid_users / stats.total_users) * 100).toFixed(1)}% konversi
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pengguna</p>
                <p className="text-2xl font-bold text-purple-600">{stats.total_users}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {stats.expired_trials} trial kedaluwarsa
            </p>
          </div>
        </div>
      )}

      <div className="content-grid">
        {/* Left Column - User Management */}
        <div>
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <Users className="tasks-icon" />
                Manajemen Pengguna
              </div>
              <div className="tasks-actions">
                <Search className="w-4 h-4 cursor-pointer text-gray-400" />
                <Filter className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* Search and Filters */}
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="flex space-x-2">
                <div className="flex-1 relative">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari nama bisnis atau user ID..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                >
                  <option value="">Semua Status</option>
                  <option value="requested">Trial Diminta</option>
                  <option value="active">Trial Aktif</option>
                  <option value="expired">Trial Kedaluwarsa</option>
                  <option value="none">Belum Trial</option>
                </select>
              </div>

              {/* Bulk Actions */}
              {selectedUsers.size > 0 && (
                <div className="flex items-center justify-between bg-purple-50 p-3 rounded-lg">
                  <span className="text-sm text-purple-700">
                    {selectedUsers.size} pengguna dipilih
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
              )}
            </div>

            {/* Users List */}
            <div className="max-h-96 overflow-y-auto">
              {users.map((user) => (
                <div key={user.user_id} className="task-item">
                  <div className="flex items-center mr-3">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.user_id)}
                      onChange={() => toggleUserSelection(user.user_id)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                  </div>
                  <div className="task-content flex-1">
                    <div className="task-name">
                      {user.business_name || 'Bisnis Belum Diatur'}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className={`text-xs px-2 py-1 rounded font-medium ${
                        user.trial_status === 'requested' ? 'bg-yellow-100 text-yellow-600' :
                        user.trial_status === 'active' ? 'bg-blue-100 text-blue-600' :
                        user.trial_status === 'expired' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {user.trial_status || 'none'}
                      </div>
                      <div className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded font-medium">
                        {user.selected_plan || 'no plan'}
                      </div>
                      <div className="task-due">
                        {user.total_conversations} percakapan
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      ID: {user.user_id.substring(0, 8)}... | 
                      Industri: {user.industry || 'Tidak diatur'} |
                      WhatsApp: {user.whatsapp_users_count}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {/* TODO: Open user details modal */}}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Lihat Detail"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {users.length === 0 && !loading && (
              <div className="p-8 text-center text-gray-500">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Tidak ada pengguna ditemukan</p>
                <p className="text-sm">Coba ubah filter atau kata kunci pencarian</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Quick Stats & Actions */}
        <div className="right-sidebar">
          {/* System Health */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Kesehatan Sistem</div>
              <div className="widget-action">
                <button onClick={fetchDashboardData} className="text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Database className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Database</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Sehat</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">API Services</span>
                </div>
                <span className="text-xs text-blue-600 font-medium">Aktif</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Activity className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">AI Processing</span>
                </div>
                <span className="text-xs text-purple-600 font-medium">Normal</span>
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
                onClick={() => setFilterStatus('requested')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">Lihat Pengajuan Trial</span>
              </button>
              
              <button 
                onClick={() => setFilterStatus('active')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Trial Aktif</span>
              </button>
              
              <button 
                onClick={handleExportData}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4 text-green-500" />
                <span className="text-sm">Ekspor Data Pengguna</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Lihat Analitik</span>
              </button>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Aktivitas Terbaru</div>
            </div>
            
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Trial disetujui untuk Bisnis ABC</span>
                </div>
                <div className="text-xs text-gray-500">2 menit lalu</div>
              </div>
              
              <div className="text-sm text-gray-600">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Pengguna baru mendaftar</span>
                </div>
                <div className="text-xs text-gray-500">5 menit lalu</div>
              </div>
              
              <div className="text-sm text-gray-600">
                <div className="flex items-center space-x-2 mb-2">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Pengajuan trial baru</span>
                </div>
                <div className="text-xs text-gray-500">10 menit lalu</div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Metrik Performa</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Konversi Trial</span>
                <span className="font-semibold text-green-600">
                  {stats ? ((stats.paid_users / Math.max(stats.active_trials + stats.expired_trials, 1)) * 100).toFixed(1) : 0}%
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Rata-rata Approval</span>
                <span className="font-semibold text-blue-600">2.3 hari</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tingkat Retensi</span>
                <span className="font-semibold text-purple-600">87%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;