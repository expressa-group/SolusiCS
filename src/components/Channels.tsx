import React, { useState } from 'react';
import { 
  Inbox, 
  Plus, 
  Search, 
  MoreHorizontal,
  CheckCircle,
  AlertCircle,
  Globe,
  Instagram,
  Facebook,
  Smartphone,
  MessageSquare,
  Settings
} from 'lucide-react';

const Channels: React.FC = () => {
  const [activeChannels, setActiveChannels] = useState(['webchat', 'whatsapp']);

  const channels = [
    {
      id: 'webchat',
      name: 'Widget Chat Web',
      description: 'Terhubung dan aktif',
      icon: MessageSquare,
      color: 'blue',
      status: 'active',
      priority: 'Tinggi',
      dueDate: 'Aktif'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'Menerima pesan',
      icon: Smartphone,
      color: 'green',
      status: 'active',
      priority: 'Tinggi',
      dueDate: 'Aktif'
    },
    {
      id: 'instagram',
      name: 'Instagram DM',
      description: 'Otorisasi tertunda',
      icon: Instagram,
      color: 'pink',
      status: 'pending',
      priority: 'Rendah',
      dueDate: 'Menunggu'
    },
    {
      id: 'facebook',
      name: 'Facebook Messenger',
      description: 'Tidak terhubung',
      icon: Facebook,
      color: 'blue',
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
        <h1 className="greeting">Manajemen Saluran</h1>
        <div className="help-text">Hubungkan dan kelola saluran layanan pelanggan Anda</div>
        
        <div className="action-buttons">
          <button className="action-button primary">Hubungkan Saluran</button>
          <button className="action-button secondary">Tes Saluran</button>
          <button className="action-button secondary">Lihat Analitik</button>
          <button className="action-button secondary">Pengaturan</button>
        </div>
      </div>

      <div className="content-grid">
        {/* Left Column - Channels */}
        <div>
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <Inbox className="tasks-icon" />
                Saluran Saya
              </div>
              <div className="tasks-actions">
                <Plus className="w-4 h-4 cursor-pointer text-gray-400" />
                <Search className="w-4 h-4 cursor-pointer text-gray-400" />
                <MoreHorizontal className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* Active Channels */}
            <div className="task-group">
              <div className="task-group-header">
                <div className="task-group-status">AKTIF</div>
                <div className="task-group-count">2 saluran</div>
              </div>
              
              {channels.filter(c => c.status === 'active').map((channel) => {
                const Icon = channel.icon;
                return (
                  <div key={channel.id} className="task-item">
                    <div className="task-checkbox bg-green-500 border-green-500">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                    <div className="task-content">
                      <div className="task-name">{channel.name}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className={`task-priority ${channel.priority.toLowerCase()}`}>
                          {channel.priority}
                        </div>
                        <div className="task-due text-green-600">{channel.dueDate}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {channel.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pending Channels */}
            <div className="task-group">
              <div className="task-group-header">
                <div className="task-group-status bg-yellow-400">MENUNGGU</div>
                <div className="task-group-count">1 saluran</div>
              </div>
              
              {channels.filter(c => c.status === 'pending').map((channel) => {
                const Icon = channel.icon;
                return (
                  <div key={channel.id} className="task-item">
                    <div className="task-checkbox border-yellow-400">
                      <AlertCircle className="w-3 h-3 text-yellow-500" />
                    </div>
                    <div className="task-content">
                      <div className="task-name">{channel.name}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className={`task-priority ${channel.priority.toLowerCase()}`}>
                          {channel.priority}
                        </div>
                        <div className="task-due text-yellow-600">{channel.dueDate}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {channel.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inactive Channels */}
            <div className="task-group">
              <div className="task-group-header">
                <div className="task-group-status bg-gray-400">TIDAK AKTIF</div>
                <div className="task-group-count">1 saluran</div>
              </div>
              
              {channels.filter(c => c.status === 'inactive').map((channel) => {
                const Icon = channel.icon;
                return (
                  <div key={channel.id} className="task-item">
                    <div className="task-checkbox"></div>
                    <div className="task-content">
                      <div className="task-name text-gray-500">{channel.name}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className={`task-priority ${channel.priority.toLowerCase()}`}>
                          {channel.priority}
                        </div>
                        <div className="task-due text-gray-500">{channel.dueDate}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {channel.description}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-gray-400 cursor-pointer hover:text-purple-600" />
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="task-item">
              <Plus className="w-4 h-4 text-gray-400 mr-3" />
              <span className="text-gray-400 text-sm cursor-pointer">Tambah saluran baru</span>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="right-sidebar">
          {/* Channel Stats */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Statistik Saluran</div>
              <div className="widget-action">Hari Ini</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Pesan</span>
                <span className="font-semibold">1,234</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tingkat Respons</span>
                <span className="font-semibold text-green-600">94%</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Waktu Respons Rata-rata</span>
                <span className="font-semibold text-blue-600">1.2s</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Saluran Aktif</span>
                <span className="font-semibold text-purple-600">2</span>
              </div>
            </div>
          </div>

          {/* Quick Setup */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Pengaturan Cepat</div>
            </div>
            
            <div className="space-y-2">
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Pasang Widget Web</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Smartphone className="w-4 h-4 text-green-500" />
                <span className="text-sm">Hubungkan WhatsApp</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Instagram className="w-4 h-4 text-pink-500" />
                <span className="text-sm">Atur Instagram</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Facebook className="w-4 h-4 text-blue-600" />
                <span className="text-sm">Tambah Facebook</span>
              </button>
            </div>
          </div>

          {/* Widget Preview */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Pratinjau Widget</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg p-4 text-white">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-6 h-6 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <MessageSquare className="w-3 h-3" />
                </div>
                <span className="text-sm font-medium">Chat dengan Dukungan</span>
              </div>
              
              <div className="bg-white bg-opacity-20 rounded-lg p-3 mb-2">
                <p className="text-xs">Halo! Bagaimana saya bisa membantu Anda hari ini?</p>
              </div>
              
              <div className="bg-white text-gray-800 rounded-lg p-3 text-right">
                <p className="text-xs">Saya butuh bantuan dengan pesanan saya</p>
              </div>
              
              <div className="mt-3 flex items-center space-x-2">
                <input 
                  type="text" 
                  placeholder="Ketik pesan..." 
                  className="flex-1 bg-white bg-opacity-20 border border-white border-opacity-30 rounded-full px-3 py-1 text-xs placeholder-white placeholder-opacity-70"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Channels;