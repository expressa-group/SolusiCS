import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  ShoppingCart,
  CreditCard,
  Package,
  Calendar,
  User
} from 'lucide-react';

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
      clientKey: string;
    };
  }
}

interface OrderItem {
  id: string;
  quantity: number;
  price_at_order: number;
  product_name: string;
}

interface OrderDetails {
  id: string;
  total_amount: number;
  status: string;
  payment_method?: string;
  created_at?: string;
  order_items: OrderItem[];
  business_name?: string;
}

const PaymentConfirmationPage: React.FC = () => {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Parse URL query parameters on component mount
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const id = queryParams.get('orderId');
    const token = queryParams.get('snapToken');

    if (id && token) {
      setOrderId(id);
      setSnapToken(token);
    } else {
      setError('Order ID atau Snap Token tidak ditemukan di URL.');
      setLoading(false);
    }
  }, []);

  // Fetch order details once orderId is available
  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  // Initialize Midtrans Snap client key
  useEffect(() => {
    const initializeMidtrans = () => {
      if (window.snap) {
        const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;
        if (clientKey) {
          window.snap.clientKey = clientKey;
          console.log('Midtrans client key initialized successfully');
        } else {
          console.error('VITE_MIDTRANS_CLIENT_KEY not found in environment variables');
          setError('Konfigurasi Midtrans tidak lengkap. Silakan hubungi admin.');
        }
      } else {
        // Retry after a short delay if snap.js hasn't loaded yet
        setTimeout(initializeMidtrans, 100);
      }
    };

    initializeMidtrans();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchOrderDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/get-public-order-details`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ order_id: orderId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengambil detail pesanan.');
      }

      const data = await response.json();
      if (data.success && data.order) {
        setOrder(data.order);
      } else {
        setError('Pesanan tidak ditemukan.');
      }
    } catch (err: any) {
      console.error('Error fetching order details:', err);
      setError(err.message || 'Terjadi kesalahan saat memuat detail pesanan.');
    } finally {
      setLoading(false);
    }
  };

  const handlePayNow = () => {
    if (!snapToken) {
      showMessage('error', 'Snap Token tidak tersedia.');
      return;
    }
    if (!window.snap || !window.snap.pay) {
      showMessage('error', 'Midtrans Snap.js belum dimuat. Silakan refresh halaman.');
      return;
    }

    setPaymentProcessing(true);
    window.snap.pay(snapToken, {
      onSuccess: async (result: any) => {
        console.log('Payment success:', result);
        showMessage('success', 'Pembayaran berhasil! Pesanan Anda akan segera diproses.');
        await updateOrderStatusPublic(orderId!, 'paid', result.transaction_id);
        setPaymentProcessing(false);
        fetchOrderDetails();
      },
      onPending: async (result: any) => {
        console.log('Payment pending:', result);
        showMessage('success', 'Pembayaran sedang diproses. Kami akan mengonfirmasi setelah pembayaran selesai.');
        await updateOrderStatusPublic(orderId!, 'pending', result.transaction_id);
        setPaymentProcessing(false);
        fetchOrderDetails();
      },
      onError: async (result: any) => {
        console.log('Payment error:', result);
        showMessage('error', 'Terjadi kesalahan saat memproses pembayaran. Silakan coba lagi.');
        await updateOrderStatusPublic(orderId!, 'failed', result.transaction_id);
        setPaymentProcessing(false);
        fetchOrderDetails();
      },
      onClose: () => {
        console.log('Payment popup closed');
        showMessage('error', 'Pembayaran dibatalkan oleh pengguna.');
        setPaymentProcessing(false);
      }
    });
  };

  const updateOrderStatusPublic = async (orderId: string, status: string, midtransTransactionId?: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/update-order-status-public`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          order_id: orderId, 
          status: status, 
          midtrans_transaction_id: midtransTransactionId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal memperbarui status pesanan.');
      }
      console.log('Order status updated successfully via public function.');
    } catch (err) {
      console.error('Error updating order status publicly:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed':
        return 'bg-green-100 text-green-600';
      case 'pending':
        return 'bg-yellow-100 text-yellow-600';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid':
        return 'Diproses';
      case 'pending':
        return 'Menunggu Pembayaran';
      case 'completed':
        return 'Selesai';
      case 'cancelled':
        return 'Dibatalkan';
      case 'failed':
        return 'Gagal';
      default:
        return status.toUpperCase();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Memuat Detail Pesanan</h2>
          <p className="text-gray-600">Mohon tunggu sebentar...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-white flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl border border-red-200 max-w-md w-full">
          <div className="w-16 h-16 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-red-800 mb-4">Terjadi Kesalahan</h2>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl border border-gray-200 max-w-md w-full">
          <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingCart className="w-8 h-8 text-gray-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Pesanan Tidak Ditemukan</h2>
          <p className="text-gray-700">Detail pesanan tidak dapat dimuat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <img 
              src="https://i.imghippo.com/files/lcA1141GSM.png" 
              alt="Solusics.ai" 
              className="h-10 w-auto"
            />
            <span className="text-gray-900 font-bold text-2xl">
              Solusics.<span className="text-purple-600">ai</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            Konfirmasi Pembayaran
          </h1>
          <p className="text-gray-600">
            {order.business_name ? `Pesanan dari ${order.business_name}` : 'Detail pesanan Anda'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="p-6 sm:p-8">
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

            {/* Order Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center">
                  <Package className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Pesanan #{order.id.substring(0, 8)}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'Tanggal tidak tersedia'}
                  </p>
                </div>
              </div>
              <div className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                {getStatusText(order.status)}
              </div>
            </div>

            {/* Order Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-100">
                <div className="flex items-center space-x-3 mb-2">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-700">Total Pembayaran</span>
                </div>
                <p className="text-2xl font-bold text-purple-600">
                  Rp {parseFloat(order.total_amount.toString()).toLocaleString('id-ID')}
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-6 rounded-xl border border-blue-100">
                <div className="flex items-center space-x-3 mb-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-700">Total Item</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  {order.order_items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                </p>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-100">
                <div className="flex items-center space-x-3 mb-2">
                  <User className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">Status</span>
                </div>
                <p className="text-lg font-bold text-green-600">
                  {getStatusText(order.status)}
                </p>
              </div>
            </div>

            {/* Order Items */}
            <div className="mb-8">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Item Pesanan
              </h3>
              <div className="space-y-3">
                {order.order_items && order.order_items.length > 0 ? (
                  order.order_items.map((item, index) => (
                    <div key={item.id || index} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-600">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{item.product_name || 'Produk Tidak Dikenal'}</p>
                          <p className="text-sm text-gray-600">Jumlah: {item.quantity}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-800">
                          Rp {(parseFloat(item.price_at_order.toString()) * item.quantity).toLocaleString('id-ID')}
                        </p>
                        <p className="text-xs text-gray-500">
                          @ Rp {parseFloat(item.price_at_order.toString()).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p>Tidak ada item dalam pesanan ini.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Actions */}
            <div className="border-t border-gray-200 pt-6">
              {order.status === 'pending' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Pembayaran Diperlukan</p>
                        <p className="text-xs text-blue-700">
                          Klik tombol "Bayar Sekarang" untuk melanjutkan pembayaran melalui Midtrans.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handlePayNow}
                    disabled={paymentProcessing}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-4 px-6 rounded-lg transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    {paymentProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Memproses Pembayaran...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        <span>Bayar Sekarang - Rp {parseFloat(order.total_amount.toString()).toLocaleString('id-ID')}</span>
                      </>
                    )}
                  </button>
                  
                  <p className="text-xs text-gray-500 text-center">
                    Pembayaran aman dengan Midtrans. Mendukung berbagai metode pembayaran.
                  </p>
                </div>
              )}
              
              {order.status === 'paid' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-green-800 mb-2">Pembayaran Berhasil!</h3>
                  <p className="text-sm text-green-700">
                    Terima kasih atas pembayaran Anda. Pesanan sedang diproses.
                  </p>
                </div>
              )}
              
              {(order.status === 'cancelled' || order.status === 'failed') && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                  <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-red-800 mb-2">
                    Pembayaran {order.status === 'cancelled' ? 'Dibatalkan' : 'Gagal'}
                  </h3>
                  <p className="text-sm text-red-700 mb-4">
                    {order.status === 'cancelled' 
                      ? 'Pembayaran telah dibatalkan.' 
                      : 'Terjadi kesalahan dalam proses pembayaran.'}
                  </p>
                  {order.status === 'failed' && (
                    <button
                      onClick={handlePayNow}
                      disabled={paymentProcessing}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200"
                    >
                      Coba Bayar Lagi
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Butuh bantuan? Hubungi customer service kami melalui WhatsApp
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmationPage;