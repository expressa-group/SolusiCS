import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Eye,
  Search,
  Filter,
  Package,
  CreditCard,
  User
} from 'lucide-react';
import { OrderService } from '../lib/orderService';
import { Order } from '../types/database';
import { supabase } from '../lib/supabaseClient';

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userOrders = await OrderService.getUserOrders(user.id);
      setOrders(userOrders);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-600';
      case 'pending':
        return 'bg-yellow-100 text-yellow-600';
      case 'failed':
      case 'cancelled':
        return 'bg-red-100 text-red-600';
      case 'completed':
        return 'bg-blue-100 text-blue-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed':
        return CheckCircle;
      case 'pending':
        return Clock;
      case 'failed':
      case 'cancelled':
        return XCircle;
      default:
        return Package;
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

  const filteredOrders = orders.filter(order => {
    const matchesSearch = !searchTerm || 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.midtrans_transaction_id && order.midtrans_transaction_id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = !statusFilter || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewOrder = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  if (loading) {
    return (
      <div className="main-content">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Memuat pesanan...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Header */}
      <div className="main-header">
        <div className="date-text">Manajemen Pesanan</div>
        <h1 className="greeting">Pesanan Pelanggan</h1>
        <div className="help-text">Kelola pesanan yang masuk melalui WhatsApp AI</div>
        
        <div className="action-buttons">
          <button 
            onClick={fetchOrders}
            className="action-button secondary"
          >
            <Clock className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      <div className="content-grid">
        {/* Left Column - Orders List */}
        <div>
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <ShoppingCart className="tasks-icon" />
                Daftar Pesanan ({filteredOrders.length})
              </div>
              <div className="tasks-actions">
                <Search className="w-4 h-4 cursor-pointer text-gray-400" />
                <Filter className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* Search and Filter */}
            <div className="p-4 border-b border-gray-100 space-y-3">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari berdasarkan ID pesanan..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
              >
                <option value="">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Dibayar</option>
                <option value="completed">Selesai</option>
                <option value="cancelled">Dibatalkan</option>
                <option value="failed">Gagal</option>
              </select>
            </div>

            {/* Orders List */}
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Belum ada pesanan</p>
                <p className="text-sm">Pesanan dari WhatsApp AI akan muncul di sini</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const StatusIcon = getStatusIcon(order.status);
                
                return (
                  <div key={order.id} className="task-item">
                    <div className={`task-checkbox ${getStatusColor(order.status)} border-0`}>
                      <StatusIcon className="w-3 h-3" />
                    </div>
                    <div className="task-content flex-1">
                      <div className="task-name">
                        Pesanan #{order.id.substring(0, 8)}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className={`text-xs px-2 py-1 rounded font-medium ${getStatusColor(order.status)}`}>
                          {order.status.toUpperCase()}
                        </div>
                        <div className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded font-medium">
                          Rp {parseFloat(order.total_amount.toString()).toLocaleString('id-ID')}
                        </div>
                        <div className="task-due">
                          {order.created_at ? new Date(order.created_at).toLocaleDateString('id-ID') : 'Baru'}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {order.payment_method || 'Metode pembayaran belum dipilih'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewOrder(order)}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column - Order Statistics */}
        <div className="right-sidebar">
          {/* Order Statistics */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Statistik Pesanan</div>
              <div className="widget-action">Hari Ini</div>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Pesanan</span>
                <span className="font-semibold text-purple-600">{orders.length}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pesanan Dibayar</span>
                <span className="font-semibold text-green-600">
                  {orders.filter(o => o.status === 'paid' || o.status === 'completed').length}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Pending</span>
                <span className="font-semibold text-yellow-600">
                  {orders.filter(o => o.status === 'pending').length}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Pendapatan</span>
                <span className="font-semibold text-blue-600">
                  Rp {orders
                    .filter(o => o.status === 'paid' || o.status === 'completed')
                    .reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0)
                    .toLocaleString('id-ID')}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Tindakan Cepat</div>
            </div>
            
            <div className="space-y-2">
              <button 
                onClick={() => setStatusFilter('pending')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">Lihat Pesanan Pending</span>
              </button>
              
              <button 
                onClick={() => setStatusFilter('paid')}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Pesanan Dibayar</span>
              </button>
              
              <button 
                onClick={fetchOrders}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Package className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Refresh Pesanan</span>
              </button>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Metode Pembayaran</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">QRIS</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Aktif</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Virtual Account</span>
                </div>
                <span className="text-xs text-blue-600 font-medium">Aktif</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">E-Wallet</span>
                </div>
                <span className="text-xs text-purple-600 font-medium">Aktif</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Detail Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Detail Pesanan #{selectedOrder.id.substring(0, 8)}
              </h3>
              <button
                onClick={() => setShowOrderModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status.toUpperCase()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total</label>
                  <p className="text-lg font-bold text-gray-900">
                    Rp {parseFloat(selectedOrder.total_amount.toString()).toLocaleString('id-ID')}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Pesanan</label>
                  <p className="text-sm text-gray-600">
                    {selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('id-ID') : 'Tidak tersedia'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                  <p className="text-sm text-gray-600">
                    {selectedOrder.payment_method || 'Belum dipilih'}
                  </p>
                </div>
              </div>

              {/* Payment Link */}
              {selectedOrder.midtrans_snap_url && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Link Pembayaran</label>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <a 
                      href={selectedOrder.midtrans_snap_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm break-all"
                    >
                      {selectedOrder.midtrans_snap_url}
                    </a>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item Pesanan</label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    Detail item pesanan akan ditampilkan di sini setelah implementasi lengkap.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderManagement;