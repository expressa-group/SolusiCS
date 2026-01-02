import React, { useState } from 'react';
import { 
  CheckSquare, 
  Plus, 
  Search, 
  MoreHorizontal,
  Clock, 
  User,
  Phone,
  CheckCircle,
  AlertCircle,
  Send,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

const Conversations: React.FC = () => {
  const [selectedConversation, setSelectedConversation] = useState(1);

  const conversations = [
    {
      id: 1,
      user: 'Sarah Johnson - WhatsApp', 
      lastMessage: 'Terima kasih atas respons cepatnya!',
      time: '2 menit lalu',
      status: 'resolved',
      priority: 'Tinggi',
      dueDate: 'Selesai'
    },
    {
      id: 2,
      user: 'Mike Chen - Chat Web',
      lastMessage: 'Bisakah Anda membantu saya dengan harga produk?',
      time: '5 menit lalu',
      status: 'active',
      priority: 'Tinggi',
      dueDate: 'Aktif'
    },
    {
      id: 3,
      user: 'Anna Williams - Instagram',
      lastMessage: 'Apa jam operasional bisnis Anda?',
      time: '12 menit lalu',
      status: 'pending',
      priority: 'Rendah',
      dueDate: 'Menunggu'
    }
  ];

  const currentConversation = conversations.find(c => c.id === selectedConversation);

  const messages = [
    { id: 1, sender: 'user', text: 'Hai, saya butuh bantuan dengan pesanan saya', time: '10:30' },
    { id: 2, sender: 'ai', text: 'Halo! Saya dengan senang hati akan membantu Anda dengan pesanan Anda. Bisakah Anda memberikan nomor pesanan?', time: '10:31' },
    { id: 3, sender: 'user', text: 'Tentu, nomor pesanannya #12345', time: '10:32' },
    { id: 4, sender: 'ai', text: 'Terima kasih! Saya menemukan pesanan Anda. Pesanan dikirim kemarin dan akan tiba besok. Ini nomor pelacakannya: TR123456789', time: '10:33' },
    { id: 5, sender: 'user', text: 'Terima kasih atas respons cepatnya!', time: '10:34' }
  ];

  return (
    <div className="main-content">
      {/* Header */}
      <div className="main-header">
        <div className="date-text">Senin, 7 Juli</div>
        <h1 className="greeting">Percakapan Saya</h1>
        <div className="help-text">Kelola percakapan pelanggan dan tiket dukungan</div>
        
        <div className="action-buttons">
          <button className="action-button primary">Percakapan Baru</button>
          <button className="action-button secondary">Filter</button>
          <button className="action-button secondary">Ekspor</button>
          <button className="action-button secondary">Pengaturan</button>
        </div>
      </div>

      <div className="content-grid">
        {/* Left Column - Conversations List */}
        <div>
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <CheckSquare className="tasks-icon" />
                Percakapan
              </div>
              <div className="tasks-actions">
                <Search className="w-4 h-4 cursor-pointer text-gray-400" />
                <MoreHorizontal className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* Active Conversations */}
            <div className="task-group">
              <div className="task-group-header">
                <ChevronDown className="task-group-toggle" />
                <div className="task-group-status">AKTIF</div>
                <div className="task-group-count">1 percakapan</div>
              </div>
              
              {conversations.filter(c => c.status === 'active').map((conv) => (
                <div 
                  key={conv.id} 
                  className={`task-item cursor-pointer ${selectedConversation === conv.id ? 'bg-purple-50' : ''}`}
                  onClick={() => setSelectedConversation(conv.id)}
                >
                  <div className="task-checkbox bg-blue-500 border-blue-500">
                    <div className="w-2 h-2 bg-white rounded-full"></div>
                  </div>
                  <div className="task-content">
                    <div className="task-name">{conv.user}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className={`task-priority ${conv.priority.toLowerCase()}`}>
                        {conv.priority}
                      </div>
                      <div className="task-due text-blue-600">{conv.dueDate}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {conv.lastMessage}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">{conv.time}</div>
                </div>
              ))}
            </div>

            {/* Resolved Conversations */}
            <div className="task-group">
              <div className="task-group-header">
                <ChevronDown className="task-group-toggle" />
                <div className="task-group-status bg-green-500">SELESAI</div>
                <div className="task-group-count">1 percakapan</div>
              </div>
              
              {conversations.filter(c => c.status === 'resolved').map((conv) => (
                <div 
                  key={conv.id} 
                  className={`task-item cursor-pointer ${selectedConversation === conv.id ? 'bg-purple-50' : ''}`}
                  onClick={() => setSelectedConversation(conv.id)}
                >
                  <div className="task-checkbox bg-green-500 border-green-500">
                    <CheckCircle className="w-3 h-3 text-white" />
                  </div>
                  <div className="task-content">
                    <div className="task-name">{conv.user}</div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className={`task-priority ${conv.priority.toLowerCase()}`}>
                        {conv.priority}
                      </div>
                      <div className="task-due text-green-600">{conv.dueDate}</div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {conv.lastMessage}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">{conv.time}</div>
                </div>
              ))}
            </div>

            {/* Pending Conversations */}
            <div className="task-group">
              <div className="task-group-header">
                <ChevronRight className="task-group-toggle" />
                <div className="task-group-status bg-yellow-500">MENUNGGU</div>
                <div className="task-group-count">1 percakapan</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Chat View */}
        <div className="right-sidebar">
          {currentConversation ? (
            <>
              {/* Chat Header */}
              <div className="projects-widget">
                <div className="widget-header">
                  <div className="widget-title">{currentConversation.user}</div>
                  <div className={`widget-action ${
                    currentConversation.status === 'active' ? 'text-blue-600' : 
                    currentConversation.status === 'resolved' ? 'text-green-600' : 
                    'text-yellow-600'
                  }`}>
                    {currentConversation.status === 'active' ? 'aktif' : 
                     currentConversation.status === 'resolved' ? 'selesai' : 'menunggu'}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>Aktivitas terakhir: {currentConversation.time}</span>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 cursor-pointer hover:text-gray-700" />
                    <MoreHorizontal className="w-4 h-4 cursor-pointer hover:text-gray-700" />
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="projects-widget flex-1">
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                          message.sender === 'user'
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p>{message.text}</p>
                        <div className={`text-xs mt-1 ${
                          message.sender === 'user' ? 'text-purple-200' : 'text-gray-500'
                        }`}>
                          {message.time}
                          {message.sender === 'ai' && (
                            <span className="ml-2 bg-green-100 text-green-800 px-1 py-0.5 rounded text-xs font-medium">
                              AI
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Message Input */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Ketik pesan..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                    <button className="bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 transition-colors">
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="projects-widget flex items-center justify-center h-64">
              <div className="text-center">
                <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Pilih percakapan untuk melihat pesan</p>
              </div>
            </div>
          )}

          {/* Conversation Actions */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Tindakan</div>
            </div>
            
            <div className="space-y-2">
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Tandai Sebagai Selesai</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <User className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Tugaskan ke Agen</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">Atur Prioritas</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <Clock className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Jadwalkan Tindak Lanjut</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Conversations;