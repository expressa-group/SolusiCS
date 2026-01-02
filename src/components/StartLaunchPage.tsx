import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Mail, 
  Globe, 
  Settings, 
  CheckCircle,
  Bot,
  Hand
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { UserBusinessProfile } from '../types/database';

interface StartLaunchPageProps {
  user: User;
  userBusinessProfile?: UserBusinessProfile | null;
}

const StartLaunchPage: React.FC<StartLaunchPageProps> = ({ user, userBusinessProfile }) => {
  const [visibleMessages, setVisibleMessages] = useState(0);

  const chatMessages = [
    {
      id: 1,
      type: 'user',
      text: 'Halo, bisakah saya bayar dengan PayPal?',
      delay: 1000
    },
    {
      id: 2,
      type: 'ai',
      text: '👋 Halo! Tentu, kami mendukung pembayaran PayPal.',
      delay: 2500
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (visibleMessages < chatMessages.length) {
        setVisibleMessages(prev => prev + 1);
      }
    }, chatMessages[visibleMessages]?.delay || 1000);

    return () => clearTimeout(timer);
  }, [visibleMessages, chatMessages]);

  // Reset animation every 6 seconds
  useEffect(() => {
    const resetTimer = setInterval(() => {
      setVisibleMessages(0);
    }, 6000);

    return () => clearInterval(resetTimer);
  }, []);

  return (
    <div className="main-content">
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white -mx-4 sm:-mx-6 -my-6 px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto">
          {/* Logo Header */}
          <div className="flex items-center justify-center gap-3 mb-8 sm:mb-12 flex-wrap">
            <img 
              src="https://i.imghippo.com/files/lcA1141GSM.png" 
              alt="Solusics.ai" 
              className="h-10 sm:h-12 w-auto flex-shrink-0"
            />
            <span className="text-gray-900 font-bold text-2xl sm:text-3xl">
              Solusics.<span className="text-purple-600">ai</span>
            </span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-16 items-center">
            {/* Left Column - Content */}
            <div className="space-y-6 sm:space-y-8 order-2 lg:order-1">
              <div className="space-y-4 sm:space-y-6">
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Selamat datang di SolusiCS.AI!
                </h1>
                
                <p className="text-base sm:text-lg lg:text-xl text-gray-600 leading-relaxed">
                  Revolusionalisasi layanan pelanggan Anda dengan teknologi AI terdepan. Siapkan agen AI Solusics yang cerdas dan responsif untuk memberikan pengalaman pelanggan yang luar biasa, 24/7 tanpa henti.
                </p>
              </div>

            {/* Features List */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed">
                    Merespons langsung dengan percakapan yang natural dan seperti manusia.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                  <Mail className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed">Membalas email otomatis.</p>
                  <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap">
                    BARU!
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                  <Globe className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed">Percakapan multibahasa.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                  <Settings className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed">
                    Didukung berbagai sumber: website, set tanya jawab.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center mt-1 flex-shrink-0">
                  <CheckCircle className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm sm:text-base text-gray-800 font-medium leading-relaxed">
                    Menangani kasus penggunaan yang lebih kompleks dan spesifik.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <div className="pt-4 sm:pt-6">
              <button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 w-full sm:w-auto touch-action-manipulation">
                Siapkan Agen AI Solusics
              </button>
            </div>

            {/* Disclaimer */}
            <div className="pt-6 sm:pt-8">
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
                Menggunakan AI berarti Anda setuju untuk tidak menggunakannya untuk kesehatan, militer, konten dewasa, politik, perjudian, berita, atau nasihat keuangan/hukum.{' '}
                <a href="#" className="text-purple-600 hover:text-purple-700 underline">
                  Pembatasan AI Solusics
                </a>
              </p>
            </div>
          </div>

          {/* Right Column - Chat Interface */}
          <div className="relative order-1 lg:order-2">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-sm sm:max-w-md mx-auto">
              {/* Chat Header */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4">
                {/* Header content removed */}
              </div>

              {/* Chat Messages */}
              <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 min-h-[12rem] sm:min-h-[200px]">
                {chatMessages.slice(0, visibleMessages).map((message, index) => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
                  >
                    <div
                      className={`max-w-xs px-3 sm:px-4 py-2 sm:py-3 rounded-2xl ${
                        message.type === 'user'
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-br-md'
                          : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}
                    >
                      <p className="text-xs sm:text-sm leading-relaxed">{message.text}</p>
                    </div>
                  </div>
                ))}

                {/* Typing indicator when showing AI response */}
                {visibleMessages === 1 && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl rounded-bl-md">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="flex items-center gap-3 bg-gray-50 rounded-full px-3 sm:px-4 py-2 sm:py-3">
                  <input
                    type="text"
                    placeholder="Ketik pesan..."
                    className="flex-1 bg-transparent text-xs sm:text-sm text-gray-600 placeholder-gray-400 focus:outline-none min-w-0"
                    disabled
                  />
                  <button className="text-gray-400 flex-shrink-0 touch-action-manipulation">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Decorative gradient background */}
            <div className="absolute -top-4 -right-4 w-24 sm:w-32 h-24 sm:h-32 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-50 -z-10"></div>
            <div className="absolute -bottom-8 -left-8 w-16 sm:w-24 h-16 sm:h-24 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-50 -z-10"></div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default StartLaunchPage;