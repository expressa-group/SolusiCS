import React, { useState } from 'react';
import { useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Plus, 
  Search, 
  MoreHorizontal,
  User, 
  Bell, 
  Shield, 
  Globe,
  Palette,
  Save,
  Key,
  Database,
  ChevronDown,
  CheckCircle,
  LogOut,
  Loader2
} from 'lucide-react';

import { supabase } from '../lib/supabaseClient';
import { BusinessProfileService } from '../lib/businessProfileService';
import { UserBusinessProfile } from '../types/database';
import WhatsAppIntegration from './WhatsAppIntegration';

interface SettingsProps {
  userBusinessProfile?: UserBusinessProfile | null;
  onProfileUpdate?: (profile: UserBusinessProfile) => void;
}

const Settings: React.FC<SettingsProps> = ({ userBusinessProfile, onProfileUpdate }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Business settings state
  const [businessSettings, setBusinessSettings] = useState({
    business_name: '',
    description: '',
    industry: '',
    operating_hours: '',
    whatsapp_number: ''
  });
  
  // AI configuration state (local only for now)
  const [aiSettings, setAiSettings] = useState({
    auto_response: true,
    human_transfer: true,
    response_tone: 'Profesional'
  });

  // Initialize business settings from userBusinessProfile
  useEffect(() => {
    if (userBusinessProfile) {
      setBusinessSettings({
        business_name: userBusinessProfile.business_name || '',
        description: userBusinessProfile.description || '',
        industry: userBusinessProfile.industry || '',
        operating_hours: userBusinessProfile.operating_hours || '',
        whatsapp_number: userBusinessProfile.whatsapp_number || ''
      });
    }
  }, [userBusinessProfile]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleBusinessSettingsChange = (field: string, value: string) => {
    setBusinessSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveChanges = async () => {
    if (saving) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate required fields
      if (!businessSettings.business_name.trim()) {
        throw new Error('Nama bisnis harus diisi');
      }
      
      if (!businessSettings.description.trim()) {
        throw new Error('Deskripsi bisnis harus diisi');
      }
      
      if (!businessSettings.industry) {
        throw new Error('Industri harus dipilih');
      }
      
      if (!businessSettings.operating_hours.trim()) {
        throw new Error('Jam operasional harus diisi');
      }
      
      if (!businessSettings.whatsapp_number.trim()) {
        throw new Error('Nomor WhatsApp bisnis harus diisi');
      }

      // Update business profile
      const updatedProfile = await BusinessProfileService.updateBusinessInfo(user.id, businessSettings);
      
      if (updatedProfile && onProfileUpdate) {
        onProfileUpdate(updatedProfile);
      }
      
      showMessage('success', 'Pengaturan berhasil disimpan');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      showMessage('error', error.message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (userBusinessProfile) {
      setBusinessSettings({
        business_name: userBusinessProfile.business_name || '',
        description: userBusinessProfile.description || '',
        industry: userBusinessProfile.industry || '',
        operating_hours: userBusinessProfile.operating_hours || '',
        whatsapp_number: userBusinessProfile.whatsapp_number || ''
      });
      showMessage('success', 'Pengaturan direset ke nilai awal');
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        // Check if it's a session-related error that we can safely ignore
        const isSessionError = error.name === 'AuthSessionMissingError' || 
                              error.message.includes('session_not_found') ||
                              error.message.includes('Auth session missing') ||
                              error.status === 400 ||
                              error.status === 403;
        
        if (!isSessionError) {
          // Only throw if it's not a session-related error
          throw error;
        }
        
        // For session errors, log them but don't throw - logout should still proceed
        console.log('Session already invalid, logout proceeding normally');
      }
      // The App component will handle the redirect automatically
    } catch (error) {
      console.error('Unexpected error during logout:', error);
      // Even if there's an unexpected error, we should still try to clear the local session
      // The auth state listener in App.tsx will handle the UI update
    } finally {
      setLoading(false);
      // Force a page reload as a fallback to ensure clean logout
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
  };
  const settingsItems = [
    {
      name: 'Informasi Bisnis',
      description: 'Perbarui detail bisnis dan informasi kontak Anda',
      category: 'Umum',
      status: 'active',
      priority: 'Tinggi',
      dueDate: 'Lengkap'
    },
    {
      name: 'Konfigurasi AI',
      description: 'Konfigurasi pengaturan respons dan perilaku AI',
      category: 'AI',
      status: 'active',
      priority: 'Tinggi',
      dueDate: 'Aktif'
    },
    {
      name: 'Preferensi Notifikasi',
      description: 'Kelola pengaturan email dan notifikasi push',
      category: 'Notifikasi',
      status: 'pending',
      priority: 'Rendah',
      dueDate: 'Tinjau'
    },
    {
      name: 'Pengaturan Keamanan',
      description: 'Kata sandi, 2FA, dan konfigurasi keamanan',
      category: 'Keamanan',
      status: 'active',
      priority: 'Tinggi',
      dueDate: 'Aman'
    },
    {
      name: 'Konfigurasi API',
      description: 'Kelola kunci API dan pengaturan webhook',
      category: 'API',
      status: 'inactive',
      priority: 'Rendah',
      dueDate: 'Pengaturan'
    }
  ];

  return (
    <div className="main-content">
      {/* Header */}
      <div className="main-header">
        <div className="date-text">Senin, 7 Juli</div>
        <h1 className="greeting">Pengaturan</h1>
        <div className="help-text">Konfigurasi platform Solusics.ai Anda</div>
        
        <div className="action-buttons">
          <button 
            onClick={handleSaveChanges}
            disabled={saving}
            className="action-button primary flex items-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                <span className="hidden sm:inline">Menyimpan...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Simpan Perubahan</span>
                <span className="sm:hidden">Simpan</span>
              </>
            )}
          </button>
          <button 
            onClick={handleResetToDefault}
            disabled={saving}
            className="action-button secondary hidden sm:inline-flex"
          >
            Reset ke Default
          </button>
          <button className="action-button secondary hidden lg:inline-flex">Impor Pengaturan</button>
          <button className="action-button secondary hidden lg:inline-flex">Ekspor Konfigurasi</button>
        </div>
      </div>

      <div className="content-grid">
        {/* Left Column - Settings */}
        <div>
          {/* Message Display */}
          {message && (
            <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : (
                <Shield className="w-5 h-5 text-red-500 flex-shrink-0" />
              )}
              <p className={`text-sm leading-relaxed ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {message.text}
              </p>
            </div>
          )}

          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <SettingsIcon className="tasks-icon" />
                Konfigurasi
              </div>
              <div className="tasks-actions">
                <Search className="w-4 h-4 cursor-pointer text-gray-400" />
                <MoreHorizontal className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* Active Settings */}
            <div className="task-group">
              <div className="task-group-header">
                <ChevronDown className="task-group-toggle" />
                <div className="task-group-status">AKTIF</div>
                <div className="task-group-count">3 pengaturan</div>
              </div>
              
              {settingsItems.filter(s => s.status === 'active').map((setting, index) => (
                <div key={index} className="task-item">
                  <div className="task-checkbox bg-green-500 border-green-500">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                  <div className="task-content">
                    <div className="task-name">{setting.name}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className={`task-priority ${setting.priority.toLowerCase()}`}>
                        {setting.category}
                      </div>
                      <div className="task-due text-green-600">{setting.dueDate}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {setting.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pending Settings */}
            <div className="task-group">
              <div className="task-group-header">
                <ChevronDown className="task-group-toggle" />
                <div className="task-group-status bg-yellow-500">MENUNGGU</div>
                <div className="task-group-count">1 pengaturan</div>
              </div>
              
              {settingsItems.filter(s => s.status === 'pending').map((setting, index) => (
                <div key={index} className="task-item">
                  <div className="task-checkbox border-yellow-400">
                    <Bell className="w-3 h-3 text-yellow-500" />
                  </div>
                  <div className="task-content">
                    <div className="task-name">{setting.name}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className={`task-priority ${setting.priority.toLowerCase()}`}>
                        {setting.category}
                      </div>
                      <div className="task-due text-yellow-600">{setting.dueDate}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {setting.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Inactive Settings */}
            <div className="task-group">
              <div className="task-group-header">
                <ChevronDown className="task-group-toggle" />
                <div className="task-group-status bg-gray-400">PERLU PENGATURAN</div>
                <div className="task-group-count">1 pengaturan</div>
              </div>
              
              {settingsItems.filter(s => s.status === 'inactive').map((setting, index) => (
                <div key={index} className="task-item">
                  <div className="task-checkbox">
                    <Key className="w-3 h-3 text-gray-400" />
                  </div>
                  <div className="task-content">
                    <div className="task-name text-gray-500">{setting.name}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className={`task-priority ${setting.priority.toLowerCase()}`}>
                        {setting.category}
                      </div>
                      <div className="task-due text-gray-500">{setting.dueDate}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {setting.description}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column - Configuration Panel */}
        <div className="right-sidebar">
          {/* Business Settings */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Pengaturan Bisnis</div>
              <div className="widget-action">Edit</div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Bisnis
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  value={businessSettings.business_name}
                  onChange={(e) => handleBusinessSettingsChange('business_name', e.target.value)}
                  placeholder="Masukkan nama bisnis"
                  disabled={saving}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Industri
                </label>
                <select 
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  value={businessSettings.industry}
                  onChange={(e) => handleBusinessSettingsChange('industry', e.target.value)}
                  disabled={saving}
                >
                  <option value="">Pilih industri</option>
                  <option value="healthcare">Kesehatan</option>
                  <option value="retail">Retail & Restoran</option>
                  <option value="teknologi">Teknologi</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="education">Pendidikan</option>
                  <option value="finance">Keuangan</option>
                  <option value="manufacturing">Manufaktur</option>
                  <option value="services">Jasa</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jam Operasional
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  value={businessSettings.operating_hours}
                  onChange={(e) => handleBusinessSettingsChange('operating_hours', e.target.value)}
                  placeholder="Contoh: Senin - Jumat, 9 Pagi - 6 Sore WIB"
                  disabled={saving}
                />
              </div>
             
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Deskripsi Bisnis
               </label>
               <textarea
                 className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base resize-y"
                 rows={3}
                 value={businessSettings.description}
                 onChange={(e) => handleBusinessSettingsChange('description', e.target.value)}
                 placeholder="Jelaskan tentang bisnis Anda..."
                 disabled={saving}
               />
             </div>
             
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">
                 Nomor WhatsApp Bisnis
               </label>
               <input
                 type="tel"
                 className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                 value={businessSettings.whatsapp_number}
                 onChange={(e) => handleBusinessSettingsChange('whatsapp_number', e.target.value)}
                 placeholder="628123456789"
                 disabled={saving}
               />
               <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                 Format: 628123456789 (tanpa tanda + atau spasi)
               </p>
             </div>
            </div>
          </div>

          {/* AI Configuration */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Integrasi WhatsApp</div>
            </div>
            
            <div className="p-0 overflow-hidden">
              {userBusinessProfile?.whatsapp_number && (
                <WhatsAppIntegration
                  userId={userBusinessProfile.user_id}
                  whatsappNumber={userBusinessProfile.whatsapp_number}
                />
              )}
              
              {!userBusinessProfile?.whatsapp_number && (
                <div className="text-center py-6 sm:py-8 text-gray-500 px-4">
                  <p className="text-sm leading-relaxed">Silakan tambahkan nomor WhatsApp bisnis di pengaturan bisnis terlebih dahulu.</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Configuration */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Konfigurasi AI</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Respons otomatis</label>
                  <p className="text-xs text-gray-500 leading-relaxed">Merespons pesan secara otomatis</p>
                </div>
                <div 
                  className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors flex-shrink-0 touch-action-manipulation ${
                    aiSettings.auto_response ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                  onClick={() => setAiSettings(prev => ({ ...prev, auto_response: !prev.auto_response }))}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    aiSettings.auto_response ? 'translate-x-4' : 'translate-x-0'
                  }`}></div>
                </div>
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Transfer ke manusia</label>
                  <p className="text-xs text-gray-500 leading-relaxed">Transfer pertanyaan kompleks</p>
                </div>
                <div 
                  className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors flex-shrink-0 touch-action-manipulation ${
                    aiSettings.human_transfer ? 'bg-purple-600' : 'bg-gray-300'
                  }`}
                  onClick={() => setAiSettings(prev => ({ ...prev, human_transfer: !prev.human_transfer }))}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                    aiSettings.human_transfer ? 'translate-x-4' : 'translate-x-0'
                  }`}></div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nada respons
                </label>
                <select 
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm sm:text-base"
                  value={aiSettings.response_tone}
                  onChange={(e) => setAiSettings(prev => ({ ...prev, response_tone: e.target.value }))}
                >
                  <option>Profesional</option>
                  <option>Ramah</option>
                  <option>Santai</option>
                  <option>Formal</option>
                </select>
              </div>
            </div>
          </div>

          {/* Security Status */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Status Keamanan</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Shield className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium truncate">Kata Sandi</span>
                </div>
                <span className="text-xs text-green-600 font-medium flex-shrink-0">Kuat</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Key className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium truncate">2FA</span>
                </div>
                <span className="text-xs text-yellow-600 font-medium flex-shrink-0">Perlu Setup</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Database className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium truncate">Enkripsi Data</span>
                </div>
                <span className="text-xs text-green-600 font-medium flex-shrink-0">Aktif</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Tindakan Cepat</div>
            </div>
            
            <div className="space-y-2">
              <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors touch-action-manipulation">
                <Save className="w-4 h-4 text-blue-500" />
                <span className="text-sm truncate" onClick={handleSaveChanges}>
                  {saving ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
                </span>
              </button>
              
              <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors touch-action-manipulation">
                <User className="w-4 h-4 text-green-500" />
                <span className="text-sm truncate">Perbarui Profil</span>
              </button>
              
              <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors touch-action-manipulation">
                <Bell className="w-4 h-4 text-yellow-500" />
                <span className="text-sm truncate">Tes Notifikasi</span>
              </button>
              
              <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors touch-action-manipulation">
                <Palette className="w-4 h-4 text-purple-500" />
                <span className="text-sm truncate">Kustomisasi Tema</span>
              </button>
              
              <button 
                onClick={handleLogout}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-action-manipulation"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span className="text-sm text-red-600 truncate">
                  {loading ? 'Logging out...' : 'Logout'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;