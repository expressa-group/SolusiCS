import React from 'react';
import { MessageSquare, Clock, User, CheckCircle } from 'lucide-react';

const RecentConversations: React.FC = () => {
  const conversations = [
    {
      id: 1,
      user: 'Sarah Johnson',
      channel: 'WhatsApp',
      lastMessage: 'Terima kasih atas respons cepatnya!',
      time: '2 menit lalu',
      status: 'resolved'
    },
    {
      id: 2,
      user: 'Mike Chen',
      channel: 'Chat Web',
      lastMessage: 'Bisakah Anda membantu saya dengan harga produk?',
      time: '5 menit lalu',
      status: 'active'
    },
    {
      id: 3,
      user: 'Anna Williams',
      channel: 'Instagram',
      lastMessage: 'Apa jam operasional bisnis Anda?',
      time: '12 menit lalu',
      status: 'pending'
    }
  ];

  return (
    <div className="projects-widget">
      <div className="widget-header">
        <div className="widget-title">Percakapan Terbaru</div>
        <div className="widget-action cursor-pointer">Lihat Semua</div>
      </div>
      
      <div className="space-y-3">
        {conversations.map((conv) => (
          <div key={conv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <User className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-gray-900 text-sm">{conv.user}</span>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded font-medium">
                    {conv.channel}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 truncate max-w-48">{conv.lastMessage}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                conv.status === 'resolved' ? 'bg-green-500' :
                conv.status === 'active' ? 'bg-blue-500' : 'bg-yellow-500'
              }`}></div>
              <div className="flex items-center text-gray-500 text-xs">
                <Clock className="h-3 w-3 mr-1" />
                {conv.time}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentConversations;