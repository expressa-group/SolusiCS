import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight,
  ArrowLeft,
  Shield,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface AuthPageProps {
  onAuthSuccess: (phoneNumber?: string) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
  const [otpSentForRecovery, setOtpSentForRecovery] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!validateEmail(email)) {
      setMessage({ type: 'error', text: 'Format email tidak valid' });
      setLoading(false);
      return;
    }

    if (!validatePassword(password)) {
      setMessage({ type: 'error', text: 'Kata sandi minimal 6 karakter' });
      setLoading(false);
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Konfirmasi kata sandi tidak cocok' });
      setLoading(false);
      return;
    }

    if (!isLogin && !phoneNumber.trim()) {
      setMessage({ type: 'error', text: 'Nomor telepon harus diisi' });
      setLoading(false);
      return;
    }
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setMessage({ type: 'success', text: 'Login berhasil!' });
          setTimeout(() => {
            onAuthSuccess();
          }, 1000);
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setMessage({ 
            type: 'success', 
            text: 'Pendaftaran berhasil! Kode verifikasi telah dikirim ke email Anda.' 
          });
          // Pass phone number to parent for storage after email verification
          setTimeout(() => {
            onAuthSuccess(phoneNumber);
          }, 1000);
        }
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Terjadi kesalahan, silakan coba lagi' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendRecoveryOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!validateEmail(email)) {
      setMessage({ type: 'error', text: 'Format email tidak valid' });
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setOtpSentForRecovery(true);
      setMessage({ 
        type: 'success', 
        text: 'Kode reset kata sandi telah dikirim ke email Anda!' 
      });
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Gagal mengirim kode reset, silakan coba lagi' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRecoveryOtpAndSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (otp.length !== 6) {
      setMessage({ type: 'error', text: 'Kode OTP harus 6 digit' });
      setLoading(false);
      return;
    }

    if (!validatePassword(newPassword)) {
      setMessage({ type: 'error', text: 'Kata sandi baru minimal 6 karakter' });
      setLoading(false);
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMessage({ type: 'error', text: 'Konfirmasi kata sandi baru tidak cocok' });
      setLoading(false);
      return;
    }

    try {
      // Verify OTP and get session
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'recovery',
      });

      if (verifyError) throw verifyError;

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setMessage({ 
        type: 'success', 
        text: 'Kata sandi berhasil diubah! Anda akan diarahkan ke dashboard.' 
      });
      
      setTimeout(() => {
        onAuthSuccess();
      }, 2000);
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Gagal mengubah kata sandi' 
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setNewPassword('');
    setConfirmNewPassword('');
    setMessage(null);
    setOtpSentForRecovery(false);
    setShowForgotPasswordForm(false);
    setLoading(false);
  };

  const switchAuthMode = () => {
    setIsLogin(!isLogin);
    resetForm();
  };

  const handleBackToLogin = () => {
    setShowForgotPasswordForm(false);
    resetForm();
  };

  const renderForgotPasswordForm = () => {
    if (!otpSentForRecovery) {
      // Step 1: Enter email for password reset
      return (
        <form onSubmit={handleSendRecoveryOtp} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Masukkan email Anda"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Kirim Kode Reset</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      );
    } else {
      // Step 2: Enter OTP and new password
      return (
        <form onSubmit={handleVerifyRecoveryOtpAndSetNewPassword} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kode Verifikasi
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-lg font-mono tracking-widest"
              placeholder="000000"
              maxLength={6}
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Masukkan kode 6 digit yang dikirim ke {email}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kata Sandi Baru
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Minimal 6 karakter"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Konfirmasi Kata Sandi Baru
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type={showConfirmNewPassword ? 'text' : 'password'}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ulangi kata sandi baru"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>Reset Kata Sandi</span>
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
            <img 
              src="https://i.imghippo.com/files/lcA1141GSM.png" 
              alt="Solusics.ai" 
              className="h-8 sm:h-10 w-auto flex-shrink-0"
            />
            <span className="text-gray-900 font-bold text-xl sm:text-2xl">
              Solusics.<span className="text-purple-600">ai</span>
            </span>
          </div>
          
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
            {showForgotPasswordForm 
              ? 'Reset Kata Sandi' 
              : isLogin 
                ? 'Masuk ke Akun Anda' 
                : 'Buat Akun Baru'
            }
          </h2>
          <p className="text-sm sm:text-base text-gray-600 px-2">
            {showForgotPasswordForm
              ? otpSentForRecovery
                ? 'Masukkan kode verifikasi dan kata sandi baru Anda'
                : 'Masukkan email Anda untuk menerima kode reset kata sandi'
              : isLogin 
                ? 'Selamat datang kembali! Silakan masuk untuk melanjutkan.' 
                : 'Bergabunglah dengan ribuan bisnis yang menggunakan Solusics.ai'
            }
          </p>
        </div>

        {/* Auth Method Toggle */}

        {/* Auth Form */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
          {/* Back Button for Forgot Password */}
          {showForgotPasswordForm && (
            <button
              onClick={handleBackToLogin}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-6 transition-colors touch-action-manipulation"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Kembali ke Login</span>
            </button>
          )}

          {/* Message Display */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              )}
              <p className={`text-sm leading-relaxed ${
                message.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {message.text}
              </p>
            </div>
          )}

          {showForgotPasswordForm ? (
            renderForgotPasswordForm()
          ) : (
            <form onSubmit={handlePasswordAuth} className="space-y-4 sm:space-y-6">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                    placeholder="nama@email.com"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                    placeholder="Minimal 6 karakter"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-action-manipulation"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password (for signup) */}
              {!isLogin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nomor Telepon
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                        placeholder="08123456789"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Format: 08123456789 (untuk keperluan pembayaran)
                    </p>
                  </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Konfirmasi Kata Sandi
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-base"
                      placeholder="Ulangi kata sandi"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 touch-action-manipulation"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-12 touch-action-manipulation"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{isLogin ? 'Masuk' : 'Daftar'}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Forgot Password Link */}
          {!showForgotPasswordForm && isLogin && (
            <div className="mt-6 text-center">
              <button
                onClick={() => setShowForgotPasswordForm(true)}
                className="text-purple-600 hover:text-purple-700 text-sm font-medium transition-colors"
              >
                Lupa kata sandi?
              </button>
            </div>
          )}

          {/* Switch Auth Mode */}
          {!showForgotPasswordForm && (
            <div className="mt-8 pt-6 border-t border-gray-200 text-center">
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              {isLogin ? 'Belum punya akun?' : 'Sudah punya akun?'}
            </p>
            <button
              onClick={switchAuthMode}
              className="text-purple-600 hover:text-purple-700 font-semibold transition-colors touch-action-manipulation"
            >
              {isLogin ? 'Daftar sekarang' : 'Masuk di sini'}
            </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs sm:text-sm text-gray-500 leading-relaxed px-4">
            Dengan melanjutkan, Anda menyetujui{' '}
            <a href="#" className="text-purple-600 hover:text-purple-700 underline">
              Syarat & Ketentuan
            </a>{' '}
            dan{' '}
            <a href="#" className="text-purple-600 hover:text-purple-700 underline">
              Kebijakan Privasi
            </a>{' '}
            kami.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;