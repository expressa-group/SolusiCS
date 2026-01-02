import React, { useState } from 'react';
import { useEffect } from 'react';
import { 
  Check, 
  Zap, 
  Star,
  MessageSquare,
  Users,
  BarChart3,
  Shield,
  Headphones,
  Globe,
  Bot,
  Crown,
  Sparkles,
  Smartphone,
  Palette,
  Loader2,
  Clock,
  Gift,
  CheckCircle
} from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { BusinessProfileService } from '../lib/businessProfileService';

// Declare window.snap for TypeScript
declare global {
  interface Window {
    snap: {
      pay: (snapToken: string, callbacks?: {
        onSuccess?: (result: any) => void;
        onPending?: (result: any) => void;
        onError?: (result: any) => void;
        onClose?: () => void;
      }) => void;
    };
  }
}

interface PricingPageProps {
  onSelectPlan: (plan: string) => Promise<void>;
  user: User;
}

const PricingPage: React.FC<PricingPageProps> = ({ onSelectPlan, user }) => {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialRequested, setTrialRequested] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize Midtrans Snap client key
  useEffect(() => {
    const initializeMidtrans = () => {
      if (window.snap) {
        const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
        if (clientKey) {
          // Set the client key for Midtrans Snap
          window.snap.clientKey = clientKey;
          console.log('Midtrans client key initialized successfully');
        } else {
          console.error('VITE_MIDTRANS_CLIENT_KEY not found in environment variables');
        }
      } else {
        // Retry after a short delay if snap.js hasn't loaded yet
        setTimeout(initializeMidtrans, 100);
      }
    };

    initializeMidtrans();
  }, []);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'Cocok untuk bisnis kecil yang baru memulai',
      monthlyPrice: 299000,
      yearlyPrice: 2990000,
      icon: MessageSquare,
      color: 'blue',
      features: [
        'Hingga 1.000 percakapan/bulan',
        '1 saluran komunikasi',
        'Respons AI dasar',
        'Dashboard analitik sederhana',
        'Dukungan email',
        'Template respons standar'
      ],
      limitations: [
        'Tidak ada integrasi WhatsApp',
        'Fitur analitik terbatas'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      description: 'Solusi lengkap untuk bisnis berkembang',
      monthlyPrice: 799000,
      yearlyPrice: 7990000,
      icon: Star,
      color: 'purple',
      popular: true,
      features: [
        'Hingga 10.000 percakapan/bulan',
        'Semua saluran komunikasi',
        'AI respons lanjutan',
        'Analitik mendalam',
        'Dukungan prioritas',
        'Kustomisasi penuh',
        'Integrasi WhatsApp Business',
        'Multi-bahasa',
        'Pelatihan AI khusus'
      ],
      limitations: []
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Untuk perusahaan besar dengan kebutuhan khusus',
      monthlyPrice: 1999000,
      yearlyPrice: 19990000,
      icon: Crown,
      color: 'gold',
      features: [
        'Percakapan tak terbatas',
        'Semua fitur Professional',
        'Dedicated account manager',
        'SLA 99.9% uptime',
        'Custom integrations',
        'Advanced security',
        'White-label solution',
        'API akses penuh',
        'Pelatihan tim on-site',
        'Backup & disaster recovery'
      ],
      limitations: []
    }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(price);
  };

  const getDiscountPercentage = (monthly: number, yearly: number) => {
    const monthlyTotal = monthly * 12;
    const discount = ((monthlyTotal - yearly) / monthlyTotal) * 100;
    return Math.round(discount);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const createMidtransTransaction = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) throw new Error('Plan not found');

    const amount = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/create-midtrans-transaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        user_id: user.id,
        plan_id: planId,
        billing_cycle: billingCycle,
        amount: amount,
        customer_details: {
          first_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
          email: user.email,
          phone: user.phone || '081234567890'
        }
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create transaction');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to create transaction');
    }

    return data;
  };

  const handleSelectPlan = async (planId: string) => {
    if (loading) return;
    
    setSelectedPlan(planId);
    setLoading(true);
    setMessage(null);
    
    try {
      // Check if Midtrans Snap is loaded
      if (!window.snap) {
        throw new Error('Midtrans Snap.js belum dimuat. Silakan refresh halaman.');
      }

      // Create Midtrans transaction
      const transactionData = await createMidtransTransaction(planId);
      const snapToken = transactionData.snap_token;

      // Open Midtrans Snap payment popup
      window.snap.pay(snapToken, {
        onSuccess: async (result: any) => {
          console.log('Payment success:', result);
          
          try {
            // Void any existing trial request before activating paid plan
            await BusinessProfileService.voidTrialRequest(user.id);
            
            // Immediately call onSelectPlan to update the plan
            await onSelectPlan(planId);
            showMessage('success', 'Pembayaran berhasil! Akun Anda telah diaktifkan.');
          } catch (error) {
            console.error('Error after payment success:', error);
            showMessage('success', 'Pembayaran berhasil! Akun Anda akan diaktifkan dalam beberapa saat.');
          } finally {
            setLoading(false);
            setSelectedPlan('');
          }
        },
        onPending: (result: any) => {
          console.log('Payment pending:', result);
          setLoading(false);
          setSelectedPlan('');
          showMessage('success', 'Pembayaran sedang diproses. Kami akan mengonfirmasi setelah pembayaran selesai.');
        },
        onError: (result: any) => {
          console.log('Payment error:', result);
          setLoading(false);
          setSelectedPlan('');
          showMessage('error', 'Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.');
        },
        onClose: () => {
          console.log('Payment popup closed');
          setLoading(false);
          setSelectedPlan('');
        }
      });

    } catch (error) {
      console.error('Error processing payment:', error);
      showMessage('error', error instanceof Error ? error.message : 'Terjadi kesalahan saat memproses pembayaran');
      setLoading(false);
      setSelectedPlan('');
    }
  };

  const handleRequestTrial = async () => {
    if (trialLoading) return;
    
    setTrialLoading(true);
    setMessage(null);
    
    try {
      await BusinessProfileService.requestTrial(user.id);
      setTrialRequested(true);
      showMessage('success', 'Pengajuan trial berhasil dikirim! Kami akan meninjau dalam 1x24 jam.');
    } catch (error) {
      console.error('Error requesting trial:', error);
      showMessage('error', error instanceof Error ? error.message : 'Gagal mengajukan trial');
    } finally {
      setTrialLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 xl:py-16">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 lg:mb-12 xl:mb-16">
          <div className="flex items-center justify-center gap-3 mb-4 sm:mb-6 flex-wrap">
            <img 
              src="https://i.imghippo.com/files/lcA1141GSM.png" 
              alt="Solusics.ai" 
              className="h-8 sm:h-10 lg:h-12 w-auto flex-shrink-0"
            />
            <span className="text-gray-900 font-bold text-lg sm:text-xl lg:text-2xl xl:text-3xl">
              Solusics.<span className="text-purple-600">ai</span>
            </span>
          </div>
          
          <h2 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-4">
            Pilih Paket yang Tepat untuk Bisnis Anda
          </h2>
          <p className="text-sm sm:text-base lg:text-lg xl:text-xl text-gray-600 max-w-4xl mx-auto px-4 leading-relaxed">
            Mulai gratis 14 hari, tidak perlu kartu kredit. Upgrade kapan saja sesuai kebutuhan bisnis Anda.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center mb-6 sm:mb-8 lg:mb-12">
          <div className="bg-gray-100 p-1 rounded-lg flex">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 sm:px-4 lg:px-6 py-2 rounded-md text-xs sm:text-sm font-medium transition-all touch-action-manipulation ${
                billingCycle === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bulanan
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 sm:px-4 lg:px-6 py-2 rounded-md text-xs sm:text-sm font-medium transition-all relative touch-action-manipulation ${
                billingCycle === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Tahunan
              <span className="absolute -top-2 -right-1 sm:-right-2 bg-green-500 text-white text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                Hemat 17%
              </span>
            </button>
          </div>
        </div>

        {/* Trial Option */}
        <div className="max-w-2xl mx-auto mb-6 sm:mb-8 lg:mb-12 px-4">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 sm:p-6 lg:p-8">
            <div className="text-center">
              <div className="w-12 sm:w-16 h-12 sm:h-16 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Gift className="w-6 sm:w-8 h-6 sm:h-8 text-green-600" />
              </div>
              
              <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-2">
                Coba Gratis 14 Hari
              </h3>
              <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed px-2">
                Nikmati semua fitur Professional tanpa biaya selama 14 hari. 
                Tidak perlu kartu kredit, cukup tunggu persetujuan admin.
              </p>
              
              {trialRequested ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm sm:text-base text-yellow-800 font-medium text-center">
                      Pengajuan trial Anda sedang ditinjau
                    </span>
                  </div>
                  <p className="text-yellow-700 text-xs sm:text-sm leading-relaxed text-center px-2">
                    Kami akan meninjau dalam 1x24 jam. Jika tidak ingin menunggu, silakan pilih paket berbayar di bawah.
                  </p>
                </div>
              ) : (
                <button
                  onClick={handleRequestTrial}
                  disabled={trialLoading}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold px-4 sm:px-6 lg:px-8 py-3 sm:py-4 rounded-lg text-sm sm:text-base lg:text-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto min-h-12 touch-action-manipulation"
                >
                  {trialLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Gift className="w-5 h-5" />
                  )}
                  <span>{trialLoading ? 'Mengajukan...' : 'Ajukan Trial Gratis'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
        {/* Pricing Cards */}
        {/* Message Display */}
        {message && (
          <div className={`mb-6 sm:mb-8 p-4 rounded-lg flex items-start gap-3 max-w-2xl mx-auto ${
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-8 sm:mb-12 lg:mb-16 px-4">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const originalPrice = billingCycle === 'yearly' ? plan.monthlyPrice * 12 : null;
            
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl w-full ${
                  plan.popular 
                    ? 'border-purple-500 sm:scale-105' 
                    : selectedPlan === plan.id
                      ? 'border-purple-300'
                      : 'border-gray-200 hover:border-purple-200'
                }`}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1 whitespace-nowrap">
                      <Sparkles className="w-4 h-4" />
                      <span>Paling Populer</span>
                    </div>
                  </div>
                )}

                <div className="p-4 sm:p-6 lg:p-8">
                  {/* Plan Header */}
                  <div className="text-center mb-4 sm:mb-6 lg:mb-8">
                    <div className={`w-12 sm:w-14 lg:w-16 h-12 sm:h-14 lg:h-16 mx-auto mb-3 sm:mb-4 rounded-2xl flex items-center justify-center ${
                      plan.color === 'blue' ? 'bg-blue-100' :
                      plan.color === 'purple' ? 'bg-gradient-to-br from-purple-100 to-pink-100' :
                      'bg-gradient-to-br from-yellow-100 to-orange-100'
                    }`}>
                      <Icon className={`w-5 sm:w-6 lg:w-8 h-5 sm:h-6 lg:h-8 ${
                        plan.color === 'blue' ? 'text-blue-600' :
                        plan.color === 'purple' ? 'text-purple-600' :
                        'text-yellow-600'
                      }`} />
                    </div>
                    
                    <h3 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                    <p className="text-gray-600 text-xs sm:text-sm lg:text-base px-2 leading-relaxed">{plan.description}</p>
                  </div>

                  {/* Pricing */}
                  <div className="text-center mb-4 sm:mb-6 lg:mb-8">
                    <div className="flex items-baseline justify-center gap-1 sm:gap-2 flex-wrap">
                      <span className="text-lg sm:text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900">
                        {formatPrice(price)}
                      </span>
                      <span className="text-gray-600 text-xs sm:text-sm lg:text-base">
                        /{billingCycle === 'monthly' ? 'bulan' : 'tahun'}
                      </span>
                    </div>
                    
                    {billingCycle === 'yearly' && originalPrice && (
                      <div className="mt-1 sm:mt-2">
                        <span className="text-gray-500 line-through text-xs sm:text-sm">
                          {formatPrice(originalPrice)}/tahun
                        </span>
                        <span className="ml-1 sm:ml-2 text-green-600 text-xs sm:text-sm font-semibold">
                          Hemat {getDiscountPercentage(plan.monthlyPrice, plan.yearlyPrice)}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <div className="space-y-2 sm:space-y-3 lg:space-y-4 mb-4 sm:mb-6 lg:mb-8">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2 sm:gap-3">
                        <Check className="w-4 sm:w-5 h-4 sm:h-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700 text-xs sm:text-sm leading-relaxed">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={loading}
                    className={`w-full py-3 lg:py-4 px-4 lg:px-6 rounded-lg font-semibold text-xs sm:text-sm lg:text-base transition-all duration-200 min-h-12 touch-action-manipulation ${
                      plan.popular
                        ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                        : selectedPlan === plan.id
                          ? 'bg-purple-600 hover:bg-purple-700 text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {loading && selectedPlan === plan.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Memproses Pembayaran...</span>
                      </div>
                    ) : (
                      'Bayar Sekarang'
                    )}
                  </button>

                  {/* Trial Info */}
                  <p className="text-center text-gray-500 text-xs lg:text-sm mt-3 sm:mt-4">
                    Pembayaran aman dengan Midtrans
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Features Comparison */}
        <div className="bg-gradient-to-br from-white via-purple-50/30 to-pink-50/30 rounded-2xl lg:rounded-3xl shadow-2xl p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 lg:mb-12 border border-purple-100/50 backdrop-blur-sm mx-4">
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 text-center mb-4 sm:mb-6 lg:mb-8 px-4">
            Perbandingan Fitur Lengkap
          </h3>
          
          <div className="overflow-x-auto">
            <div className="min-w-[32rem] sm:min-w-[40rem] lg:min-w-0">
              {/* Header Row */}
              <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4 lg:mb-6">
                <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-xl p-2 sm:p-3 lg:p-4">
                  <h4 className="font-bold text-gray-900 text-center text-xs sm:text-sm lg:text-base">Fitur Utama</h4>
                </div>
                {plans.map((plan) => (
                  <div key={plan.id} className={`rounded-xl p-2 sm:p-3 lg:p-4 text-center relative overflow-hidden ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg sm:transform sm:scale-105' 
                      : 'bg-gradient-to-r from-gray-50 to-gray-100 text-gray-900'
                  }`}>
                    {plan.popular && (
                      <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-pink-600/20 animate-pulse"></div>
                    )}
                    <div className="relative z-10">
                      <h4 className="font-bold text-xs sm:text-sm lg:text-base xl:text-lg">{plan.name}</h4>
                      {plan.popular && (
                        <div className="flex items-center justify-center mt-0.5 sm:mt-1">
                          <Sparkles className="w-3 lg:w-4 h-3 lg:h-4 mr-1" />
                          <span className="text-xs font-medium hidden sm:inline">Populer</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Feature Rows */}
              {[
                {
                  feature: 'Percakapan AI per bulan',
                  icon: MessageSquare,
                  values: ['1.000', '10.000', 'Tak terbatas']
                },
                {
                  feature: 'Nomor WhatsApp',
                  icon: Smartphone,
                  values: ['50 nomor', '500 nomor', 'Tak terbatas']
                },
                {
                  feature: 'Respons AI',
                  icon: Bot,
                  values: ['Dasar', 'Lanjutan', 'Enterprise']
                },
                {
                  feature: 'Dashboard analitik',
                  icon: BarChart3,
                  values: ['Sederhana', 'Mendalam', 'Mendalam']
                },
                {
                  feature: 'Dukungan pelanggan',
                  icon: Headphones,
                  values: ['Email', 'Prioritas', 'Dedicated']
                },
                {
                  feature: 'Integrasi WhatsApp',
                  icon: Smartphone,
                  values: [false, true, true]
                },
                {
                  feature: 'Multi-bahasa',
                  icon: Globe,
                  values: [false, true, true]
                },
                {
                  feature: 'Custom branding',
                  icon: Palette,
                  values: [false, false, true]
                }
              ].map((row, index) => {
                const Icon = row.icon;
                return (
                  <div key={index} className="grid grid-cols-4 gap-2 lg:gap-3 mb-2 sm:mb-3 lg:mb-4 group hover:bg-white/50 rounded-xl p-1 sm:p-2 lg:p-3 transition-all duration-300">
                    <div className="flex items-center gap-2 sm:gap-3 bg-white/80 rounded-lg p-2 sm:p-3 group-hover:shadow-md transition-all duration-300">
                      <div className="w-4 sm:w-5 lg:w-6 xl:w-8 h-4 sm:h-5 lg:h-6 xl:h-8 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3 sm:w-4 h-3 sm:h-4 text-purple-600" />
                      </div>
                      <span className="font-medium text-gray-800 text-xs lg:text-sm leading-tight">{row.feature}</span>
                    </div>
                    
                    {row.values.map((value, planIndex) => (
                      <div key={planIndex} className={`flex items-center justify-center p-1 sm:p-2 lg:p-3 rounded-lg transition-all duration-300 ${
                        plans[planIndex].popular 
                          ? 'bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200' 
                          : 'bg-white/60 group-hover:bg-white/80'
                      }`}>
                        {typeof value === 'boolean' ? (
                          value ? (
                            <div className="w-4 sm:w-5 lg:w-6 h-4 sm:h-5 lg:h-6 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center shadow-lg">
                              <Check className="w-2 sm:w-3 lg:w-4 h-2 sm:h-3 lg:h-4 text-white" />
                            </div>
                          ) : (
                            <div className="w-4 sm:w-5 lg:w-6 h-4 sm:h-5 lg:h-6 bg-gradient-to-r from-red-400 to-red-500 rounded-full flex items-center justify-center shadow-lg">
                              <span className="text-white text-xs sm:text-sm lg:text-lg font-bold">×</span>
                            </div>
                          )
                        ) : (
                          <div className={`text-center ${
                            plans[planIndex].popular ? 'text-purple-700 font-semibold' : 'text-gray-700'
                          }`}>
                            <span className="text-xs lg:text-sm font-medium leading-tight">{value}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              
              {/* CTA Row */}
              <div className="grid grid-cols-4 gap-2 lg:gap-3 mt-4 sm:mt-6 lg:mt-8 pt-3 sm:pt-4 lg:pt-6 border-t border-purple-100">
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <h5 className="font-bold text-gray-900 mb-1 sm:mb-2 text-xs lg:text-sm">Mulai Sekarang</h5>
                    <p className="text-xs text-gray-600 hidden sm:block">Pilih paket yang tepat</p>
                  </div>
                </div>
                
                {plans.map((plan) => (
                  <div key={plan.id} className="flex items-center justify-center">
                    <button
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={loading}
                      className={`w-full py-2 lg:py-3 px-1 sm:px-2 lg:px-4 rounded-xl font-semibold text-xs lg:text-sm transition-all duration-300 transform hover:scale-105 min-h-10 touch-action-manipulation ${
                        plan.popular
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl'
                          : selectedPlan === plan.id
                            ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 hover:border-purple-300'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {loading && selectedPlan === plan.id ? (
                        <span className="hidden sm:inline">Memproses...</span>
                      ) : (
                        <span className="hidden sm:inline">Bayar Sekarang</span>
                      )}
                      {loading && selectedPlan === plan.id ? (
                        <span className="sm:hidden">...</span>
                      ) : (
                        <span className="sm:hidden">Bayar</span>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="text-center">
          <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 px-4">
            Masih ada pertanyaan?
          </h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-4 leading-relaxed">
            Tim kami siap membantu Anda memilih paket yang tepat
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 max-w-md mx-auto">
            <button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white px-4 lg:px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 min-h-12 touch-action-manipulation">
              <Headphones className="w-5 h-5" />
              <span>Hubungi Sales</span>
            </button>
            <button className="border border-gray-300 hover:border-purple-300 text-gray-700 hover:text-purple-600 px-4 lg:px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 min-h-12 touch-action-manipulation">
              <MessageSquare className="w-5 h-5" />
              <span>Live Chat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;