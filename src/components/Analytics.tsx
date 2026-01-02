import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Search, 
  MoreHorizontal,
  TrendingUp, 
  Users, 
  MessageSquare,
  Clock,
  CheckCircle,
  Download,
  ChevronDown,
  ChevronRight,
  Target
} from 'lucide-react';

const Analytics: React.FC = () => {
  const [dateRange, setDateRange] = useState('7d');

  const metrics = [
    {
      name: 'Total Percakapan',
      value: '2,847',
      change: '+12.5%',
      status: 'active',
      priority: 'Tinggi',
      dueDate: 'Hari Ini'
    },
    {
      name: 'Pengguna Aktif',
      value: '1,234',
      change: '+8.3%',
      status: 'active',
      priority: 'Tinggi',
      dueDate: 'Hari Ini'
    },
    {
      name: 'Tingkat Respons',
      value: '94.2%',
      change: '+2.1%',
      status: 'active',
      priority: 'Rendah',
      dueDate: 'Hari Ini'
    },
    {
      name: 'Waktu Respons Rata-rata',
      value: '1.8s',
      change: '-0.5s',
      status: 'active',
      priority: 'Rendah',
      dueDate: 'Hari Ini'
    }
  ];

  const goals = [
    {
      name: 'Tingkatkan Tingkat Respons',
      project: 'Dukungan Pelanggan',
      percentage: 94,
      color: 'cyan'
    },
    {
      name: 'Kurangi Waktu Respons',
      project: 'Kinerja',
      percentage: 67,
      color: 'orange'
    },
    {
      name: 'Tingkatkan Kepuasan Pelanggan',
      project: 'Kualitas',
      percentage: 85,
      color: 'cyan'
    }
  ];

  const channelData = [
    { channel: 'WhatsApp', conversations: 1245, percentage: 44 }, 
    { channel: 'Chat Web', conversations: 892, percentage: 31 },
    { channel: 'Instagram', conversations: 456, percentage: 16 },
    { channel: 'Facebook', conversations: 254, percentage: 9 }
  ];

  return (
    <div className="main-content">
      {/* Header */}
      <div className="main-header">
        <div className="date-text">Senin, 7 Juli</div>
        <h1 className="greeting">Dashboard Analitik</h1>
        <div className="help-text">Lacak kinerja layanan pelanggan AI Anda</div>
        
        <div className="action-buttons">
          <button className="action-button primary">Buat Laporan</button>
          <button className="action-button secondary">Ekspor Data</button>
          <button className="action-button secondary">Jadwalkan Laporan</button>
          <button className="action-button secondary">Pengaturan</button>
        </div>
      </div>

      <div className="content-grid">
        {/* Left Column - Metrics */}
        <div>
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <CalendarIcon className="tasks-icon" />
                Metrik Kinerja
              </div>
              <div className="tasks-actions">
                <select 
                  className="text-sm border border-gray-200 rounded px-2 py-1"
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                >
                  <option value="7d">7 hari terakhir</option>
                  <option value="30d">30 hari terakhir</option>
                  <option value="90d">90 hari terakhir</option>
                </select>
                <MoreHorizontal className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* Metrics */}
            <div className="task-group">
              <div className="task-group-header">
                <ChevronDown className="task-group-toggle" />
                <div className="task-group-status">METRIK</div>
                <div className="task-group-count">4 item</div>
              </div>
              
              {metrics.map((metric, index) => (
                <div key={index} className="task-item">
                  <div className="task-checkbox bg-blue-500 border-blue-500">
                    <TrendingUp className="w-3 h-3 text-white" />
                  </div>
                  <div className="task-content">
                    <div className="task-name">{metric.name}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="text-lg font-bold text-gray-900">{metric.value}</div>
                      <div className={`text-xs font-medium ${
                        metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {metric.change}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Channel Performance */}
            <div className="task-group">
              <div className="task-group-header">
                <ChevronDown className="task-group-toggle" />
                <div className="task-group-status bg-purple-500">SALURAN</div>
                <div className="task-group-count">4 saluran</div>
              </div>
              
              {channelData.map((channel, index) => (
                <div key={index} className="task-item">
                  <div className="task-checkbox bg-purple-500 border-purple-500">
                    <MessageSquare className="w-3 h-3 text-white" />
                  </div>
                  <div className="task-content">
                    <div className="task-name">{channel.channel}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="text-sm font-medium text-gray-900">{channel.conversations} percakapan</div>
                      <div className="text-xs text-gray-500">{channel.percentage}%</div>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-purple-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${channel.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Goals Section */}
          <div className="goals-section">
            <div className="goals-header">
              <Target className="goals-icon" />
              <div className="goals-title">Target Kinerja</div>
            </div>
            
            {goals.map((goal, index) => (
              <div key={index} className="goal-item">
                <div className="goal-header">
                  <div className="goal-name">{goal.name}</div>
                  <div className="goal-percentage">{goal.percentage}%</div>
                </div>
                <div className="goal-meta">{goal.project} • Analitik</div>
                <div className="goal-progress">
                  <div 
                    className={`goal-progress-bar ${goal.color}`}
                    style={{ width: `${goal.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="right-sidebar">
          {/* Quick Stats */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Statistik Cepat</div>
              <div className="widget-action">Hari Ini</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pesan Hari Ini</span>
                <span className="font-semibold text-blue-600">342</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Masalah Terselesaikan</span>
                <span className="font-semibold text-green-600">298</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pengguna Aktif</span>
                <span className="font-semibold text-purple-600">156</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Skor Kepuasan</span>
                <span className="font-semibold text-orange-600">4.8/5</span>
              </div>
            </div>
          </div>

          {/* Top Questions */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Pertanyaan Teratas</div>
            </div>
            
            <div className="space-y-3">
              {[
                { question: 'Apa jam operasional bisnis Anda?', count: 89 },
                { question: 'Bagaimana cara melacak pesanan saya?', count: 67 },
                { question: 'Apa kebijakan pengembalian Anda?', count: 54 },
                { question: 'Apakah Anda menyediakan dukungan pelanggan?', count: 43 }
              ].map((item, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                      {index + 1}
                    </div>
                    <span className="text-sm text-gray-900 truncate">{item.question}</span>
                  </div>
                  <span className="text-xs font-medium text-gray-600">{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Response Time Trends */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Waktu Respons</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Rata-rata</span>
                <span className="font-semibold">1.8s</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Tercepat</span>
                <span className="font-semibold text-green-600">0.5s</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Terlambat</span>
                <span className="font-semibold text-red-600">5.2s</span>
              </div>
              
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-800 font-medium">30% lebih cepat dari minggu lalu</span>
                </div>
              </div>
            </div>
          </div>

          {/* Export Options */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Ekspor Data</div>
            </div>
            
            <div className="space-y-2">
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Download className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Unduh CSV</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Download className="w-4 h-4 text-green-500" />
                <span className="text-sm">Ekspor Laporan PDF</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <CalendarIcon className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Jadwalkan Laporan</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;