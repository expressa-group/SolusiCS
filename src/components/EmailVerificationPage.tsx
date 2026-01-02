import React, { useState } from 'react';
import { 
  Mail, 
  CheckCircle, 
  RefreshCw, 
  ArrowLeft,
  AlertCircle,
  Loader2,
  Shield
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

interface EmailVerificationPageProps {
  user: User;
  onAuthSuccess: () => void;
}

const EmailVerificationPage: React.FC<EmailVerificationPageProps> = ({ user, onAuthSuccess }) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyLoading(true);
    setMessage(null);

    if (otp.length !== 6) {
      setMessage({ type: 'error', text: 'Kode verifikasi harus 6 digit' });
      setVerifyLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: user.email!,
        token: otp,
        type: 'signup',
      });

      if (error) throw error;

      if (data.user) {
        setMessage({ 
          type: 'success', 
          text: 'Verifikasi berhasil! Anda akan diarahkan ke dashboard.' 
        });
        
        setTimeout(() => {
          onAuthSuccess();
        }, 1500);
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Kode verifikasi tidak valid atau sudah kedaluwarsa' 
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.signUp({
        email: user.email!,
        password: '', // Empty password for resend
      });

      if (error) throw error;

      setMessage({ 
        type: 'success', 
        text: 'Kode verifikasi baru telah dikirim ke email Anda!' 
      });
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Gagal mengirim ulang kode verifikasi' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <img 
              src="https://i.imghippo.com/files/lcA1141GSM.png" 
              alt="Solusics.ai" 
              className="h-10 w-auto"
            />
            <span className="text-gray-900 font-bold text-2xl">
              Solusics.<span className="text-purple-600">ai</span>
            </span>
          </div>
          
          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="h-8 w-8 text-purple-600" />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Verifikasi Kode OTP
          </h2>
          <p className="text-gray-600">
            Kami telah mengirimkan kode verifikasi 6 digit ke email Anda
          </p>
        </div>

        {/* Verification Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
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

          {/* Email Display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Mail className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Kode dikirim ke:</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            </div>
          </div>

          {/* OTP Input Form */}
          <form onSubmit={handleVerifyOtp} className="mb-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Kode Verifikasi
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl font-mono tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
              <p className="text-sm text-gray-500 mt-1 text-center">
                Masukkan kode 6 digit yang dikirim ke email Anda
              </p>
            </div>

            <button
              type="submit"
              disabled={verifyLoading || otp.length !== 6}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mb-4"
            >
              {verifyLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  <span>Verifikasi Kode</span>
                </>
              )}
            </button>
          </form>

          {/* Instructions */}
          <div className="space-y-4 mb-8">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                <span className="text-xs font-semibold text-blue-600">1</span>
              </div>
              <p className="text-sm text-gray-700">
                Buka kotak masuk email Anda dan cari email berisi kode verifikasi dari Solusics.ai
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                <span className="text-xs font-semibold text-blue-600">2</span>
              </div>
              <p className="text-sm text-gray-700">
                Salin kode verifikasi 6 digit dari email tersebut
              </p>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                <span className="text-xs font-semibold text-blue-600">3</span>
              </div>
              <p className="text-sm text-gray-700">
                Masukkan kode di form di atas dan klik "Verifikasi Kode"
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <button
              onClick={handleResendVerification}
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-5 h-5" />
                  <span>Kirim Ulang Kode</span>
                </>
              )}
            </button>
            
            <button
              onClick={handleSignOut}
              className="w-full border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Kembali ke Login</span>
            </button>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Tidak menerima kode? Periksa folder spam atau{' '}
            <button 
              onClick={handleResendVerification}
              className="text-purple-600 hover:text-purple-700 underline"
            >
              kirim ulang
            </button>
            <br />
            <span className="text-xs">Kode akan kedaluwarsa dalam 6 menit</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationPage;