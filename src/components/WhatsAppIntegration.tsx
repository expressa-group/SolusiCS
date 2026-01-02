import React, { useState, useEffect } from 'react';
import { 
  Smartphone, 
  QrCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Loader2,
  Wifi,
  WifiOff,
  X,
  ExternalLink
} from 'lucide-react';
import { WhatsAppIntegrationService } from '../lib/whatsappIntegrationService';
import { BusinessProfileService } from '../lib/businessProfileService';

interface WhatsAppIntegrationProps {
  userId: string;
  whatsappNumber: string;
  onStatusChange?: (status: string) => void;
}

const WhatsAppIntegration: React.FC<WhatsAppIntegrationProps> = ({ 
  userId, 
  whatsappNumber, 
  onStatusChange 
}) => {
  const [status, setStatus] = useState<string>('disconnected');
  const [fonnteDeviceState, setFonnteDeviceState] = useState<string>('unknown');
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkingDevice, setCheckingDevice] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrImageLoaded, setQrImageLoaded] = useState(false);
  const [qrImageError, setQrImageError] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (userId && userId.trim()) {
      fetchCurrentStatus();
    }
    
    // Auto-check status every 5 seconds when scanning QR
    const interval = setInterval(() => {
      if (status === 'scanning_qr') {
        checkStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [userId, status]);

  // Check device status on FonNte when whatsappNumber changes
  useEffect(() => {
    if (whatsappNumber && whatsappNumber.trim() && userId && userId.trim()) {
      checkDeviceStatusOnFonnte();
    }
  }, [whatsappNumber, userId]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const checkDeviceStatusOnFonnte = async () => {
    if (!whatsappNumber.trim()) return;

    setCheckingDevice(true);
    try {
      const result = await WhatsAppIntegrationService.getDeviceStatus(userId, whatsappNumber);
      
      if (result.success) {
        setFonnteDeviceState(result.device_state || 'not_found');
        setDeviceInfo(result.device_info || null);
        
        // If device is already connected on FonNte, update our local status
        if (result.device_state === 'registered_connected') {
          setStatus('connected');
          setDeviceId(result.device_info?.device || null);
          setConnectedAt(new Date().toISOString());
          setQrCode(null);
          
          if (onStatusChange) {
            onStatusChange('connected');
          }
        } else if (result.device_state === 'registered_scanning_qr') {
          setStatus('scanning_qr');
          setDeviceId(result.device_info?.device || null);
        }
      } else {
        console.error('Failed to check device status:', result.error);
        setFonnteDeviceState('unknown');
      }
    } catch (error) {
      console.error('Error checking device status:', error);
      setFonnteDeviceState('unknown');
    } finally {
      setCheckingDevice(false);
    }
  };

  const fetchCurrentStatus = async () => {
    try {
      const fonnteStatus = await BusinessProfileService.getFonnteStatus(userId);
      if (fonnteStatus) {
        setStatus(fonnteStatus.fonnte_status || 'disconnected');
        setQrCode(fonnteStatus.fonnte_qr_code_url || null);
        setDeviceId(fonnteStatus.fonnte_device_id || null);
        setConnectedAt(fonnteStatus.fonnte_connected_at || null);
        
        if (onStatusChange) {
          onStatusChange(fonnteStatus.fonnte_status || 'disconnected');
        }
      }
    } catch (error) {
      console.error('Error fetching current status:', error);
    }
  };

  const handleConnect = async () => {
    if (!whatsappNumber.trim()) {
      showMessage('error', 'Nomor WhatsApp harus diisi terlebih dahulu');
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await WhatsAppIntegrationService.startConnection(userId, whatsappNumber);
      
      if (result.success) {
        setStatus(result.status || 'scanning_qr');
        setQrCode(result.qr_code || null);
        setDeviceId(result.device_id || null);
        
        // Update FonNte device state based on result
        if (result.status === 'connected') {
          setFonnteDeviceState('registered_connected');
        } else if (result.qr_code) {
          setFonnteDeviceState('registered_scanning_qr');
        }
        
        if (result.status === 'connected') {
          setConnectedAt(new Date().toISOString());
          showMessage('success', 'WhatsApp berhasil terhubung!');
        } else if (result.qr_code) {
          const actionText = fonnteDeviceState === 'not_found' ? 'Perangkat berhasil didaftarkan.' : 'Koneksi berhasil dimulai ulang.';
          showMessage('success', `${actionText} Silakan pindai QR Code dengan WhatsApp Anda.`);
          setShowQRModal(true);
          setQrImageLoaded(false);
          setQrImageError(false);
        }
        
        // Immediately sync status after successful connection
        await fetchCurrentStatus();
        await checkDeviceStatusOnFonnte();
        
        if (onStatusChange) {
          onStatusChange(result.status || 'scanning_qr');
        }
      } else {
        showMessage('error', result.error || 'Gagal menghubungkan WhatsApp');
        setStatus('error');
        setFonnteDeviceState('registered_error');
      }
    } catch (error) {
      console.error('Error connecting WhatsApp:', error);
      showMessage('error', 'Terjadi kesalahan saat menghubungkan WhatsApp');
      setStatus('error');
      setFonnteDeviceState('registered_error');
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    setChecking(true);
    
    try {
      const result = await WhatsAppIntegrationService.checkStatus(userId);
      
      if (result.success) {
        const newStatus = result.status || 'disconnected';
        setStatus(newStatus);
        
        if (newStatus === 'connected') {
          setQrCode(null); // Clear QR code when connected
          setConnectedAt(result.connected_at || new Date().toISOString());
          setShowQRModal(false); // Close QR modal if open
          showMessage('success', 'WhatsApp berhasil terhubung!');
        }
        
        if (onStatusChange) {
          onStatusChange(newStatus);
        }
      } else {
        showMessage('error', result.error || 'Gagal memeriksa status');
      }
    } catch (error) {
      console.error('Error checking status:', error);
      showMessage('error', 'Terjadi kesalahan saat memeriksa status');
    } finally {
      setChecking(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan koneksi WhatsApp?')) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await WhatsAppIntegrationService.disconnect(userId);
      
      if (result.success) {
        setStatus('disconnected');
        setQrCode(null);
        setDeviceId(null);
        setConnectedAt(null);
        setFonnteDeviceState('not_found');
        setDeviceInfo(null);
        showMessage('success', 'WhatsApp berhasil diputuskan');
        
        // Immediately sync status after successful disconnection
        await fetchCurrentStatus();
        await checkDeviceStatusOnFonnte();
        
        if (onStatusChange) {
          onStatusChange('disconnected');
        }
      } else {
        showMessage('error', result.error || 'Gagal memutuskan koneksi');
      }
    } catch (error) {
      console.error('Error disconnecting WhatsApp:', error);
      showMessage('error', 'Terjadi kesalahan saat memutuskan koneksi');
    } finally {
      setLoading(false);
    }
  };

  const handleQRImageLoad = () => {
    setQrImageLoaded(true);
    setQrImageError(false);
  };

  const handleQRImageError = () => {
    setQrImageLoaded(false);
    setQrImageError(true);
    showMessage('error', 'QR Code gagal dimuat. Silakan coba lagi dengan tombol "QR Baru".');
  };

  const closeQRModal = () => {
    setShowQRModal(false);
    setQrImageLoaded(false);
    setQrImageError(false);
  };

  const handleNewQR = async () => {
    setShowQRModal(false);
    await handleConnect();
  };

  const handleSyncStatus = async () => {
    setChecking(true);
    setCheckingDevice(true);
    setMessage(null);
    
    try {
      // Fetch both database status and FonNte API status
      await Promise.all([
        fetchCurrentStatus(),
        checkDeviceStatusOnFonnte()
      ]);
      
      showMessage('success', 'Status berhasil disinkronkan');
    } catch (error) {
      console.error('Error syncing status:', error);
      showMessage('error', 'Gagal menyinkronkan status');
    } finally {
      setChecking(false);
      setCheckingDevice(false);
    }
  };
  const statusDisplay = WhatsAppIntegrationService.getStatusDisplay(status);
  const deviceStateDisplay = WhatsAppIntegrationService.getDeviceStateDisplay(fonnteDeviceState);

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Integrasi WhatsApp</h3>
          <p className="text-sm text-gray-600">Hubungkan nomor WhatsApp Business Anda</p>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center space-x-3 ${
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

      {/* Status Display */}
      <div className="mb-6">
        {/* FonNte Device Status */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Status Perangkat FonNte:</span>
          <div className="flex items-center space-x-2">
            {checkingDevice ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <>
                <span className="text-sm">{deviceStateDisplay.icon}</span>
                <span className={`text-sm font-medium ${deviceStateDisplay.color}`}>
                  {deviceStateDisplay.text}
                </span>
                <button
                  onClick={checkDeviceStatusOnFonnte}
                  disabled={checkingDevice}
                  className="ml-2 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${checkingDevice ? 'animate-spin' : ''}`} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Device Info */}
        {deviceInfo && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="font-medium text-gray-600">Nama:</span>
                <span className="ml-1 text-gray-800">{deviceInfo.name || 'Tidak ada nama'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Paket:</span>
                <span className="ml-1 text-gray-800">{deviceInfo.package || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Kuota:</span>
                <span className="ml-1 text-gray-800">{deviceInfo.quota || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Kedaluwarsa:</span>
                <span className="ml-1 text-gray-800">
                  {deviceInfo.expired ? new Date(deviceInfo.expired * 1000).toLocaleDateString('id-ID') : 'Unknown'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">Status Koneksi:</span>
          <div className="flex items-center space-x-2">
            <span className="text-sm">{statusDisplay.icon}</span>
            <span className={`text-sm font-medium ${statusDisplay.color}`}>
              {statusDisplay.text}
            </span>
            {status !== 'disconnected' && (
              <button
                onClick={checkStatus}
                disabled={checking}
                className="ml-2 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {connectedAt && status === 'connected' && (
          <p className="text-xs text-gray-500">
            Terhubung pada: {new Date(connectedAt).toLocaleString('id-ID')}
          </p>
        )}

        {deviceId && (
          <p className="text-xs text-gray-500">
            Device ID: {deviceId}
          </p>
        )}
        
        {/* Debug Info for Development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
            <p>Debug Info:</p>
            <p>Status: {status}</p>
            <p>Device State: {fonnteDeviceState}</p>
            <p>Device ID: {deviceId || 'null'}</p>
            <p>QR Available: {!!qrCode}</p>
          </div>
        )}
      </div>

      {/* QR Code Display */}
      {qrCode && status === 'scanning_qr' && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg text-center">
          <div className="flex items-center justify-center mb-3">
            <QrCode className="w-5 h-5 text-gray-600 mr-2" />
            <span className="text-sm font-medium text-gray-700">QR Code Siap</span>
          </div>
          
          <button
            onClick={() => setShowQRModal(true)}
            className="bg-white border-2 border-dashed border-gray-300 hover:border-green-500 p-8 rounded-lg inline-block mb-4 transition-colors group"
          >
            <div className="flex flex-col items-center space-y-2">
              <QrCode className="w-12 h-12 text-gray-400 group-hover:text-green-500 transition-colors" />
              <span className="text-sm font-medium text-gray-600 group-hover:text-green-600 transition-colors">
                Klik untuk Melihat QR Code
              </span>
              <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-green-500 transition-colors" />
            </div>
          </button>
          
          <div className="text-sm text-gray-600 space-y-1">
            <p>Klik tombol di atas untuk melihat QR Code</p>
            <p>Kemudian pindai dengan WhatsApp Anda</p>
          </div>
          
          <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-gray-500">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Menunggu pemindaian...</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        {(deviceStateDisplay.action === 'register' || deviceStateDisplay.action === 'reconnect') ? (
          <button
            onClick={handleConnect}
            disabled={loading || !whatsappNumber.trim() || checkingDevice}
            className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            <span>
              {loading ? 'Memproses...' : 
               deviceStateDisplay.action === 'register' ? 'Daftarkan Perangkat' : 
               'Hubungkan Kembali'}
            </span>
          </button>
        ) : deviceStateDisplay.action === 'disconnect' ? (
          <button
            onClick={handleDisconnect}
            disabled={loading}
            className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
            <span>{loading ? 'Memutuskan...' : 'Putuskan Koneksi'}</span>
          </button>
        ) : (
          <button
            disabled={true}
            className="flex-1 bg-gray-400 text-white py-2 px-4 rounded-lg cursor-not-allowed flex items-center justify-center space-x-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Memeriksa Status...</span>
          </button>
        )}
        
        {/* Sync Status Button */}
        <button
          onClick={handleSyncStatus}
          disabled={loading || checking || checkingDevice}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${(checking || checkingDevice) ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Sinkronkan</span>
        </button>
        
        {status === 'scanning_qr' && (
          <button
            onClick={handleNewQR}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>QR Baru</span>
          </button>
        )}
      </div>

      {/* Help Text */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-800">
          <strong>Catatan:</strong> Pastikan nomor WhatsApp yang Anda masukkan adalah nomor WhatsApp Business yang aktif. 
          Setelah terhubung, pelanggan dapat mengirim pesan ke nomor ini dan akan mendapat balasan otomatis dari AI. 
          Sistem akan otomatis memeriksa apakah nomor sudah terdaftar di FonNte dan menampilkan opsi yang sesuai.
          Gunakan tombol "Sinkronkan\" jika status tidak sesuai dengan kondisi sebenarnya.
        </p>
      </div>
    </div>

      {/* QR Code Modal */}
      {showQRModal && qrCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <QrCode className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Pindai QR Code</h3>
              </div>
              <button
                onClick={closeQRModal}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 text-center">
              {/* QR Code Container */}
              <div className="bg-gray-50 p-4 rounded-lg mb-4 relative">
                {!qrImageLoaded && !qrImageError && (
                  <div className="w-64 h-64 mx-auto flex items-center justify-center bg-white rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Memuat QR Code...</p>
                    </div>
                  </div>
                )}
                
                {qrImageError && (
                  <div className="w-64 h-64 mx-auto flex items-center justify-center bg-white rounded-lg border-2 border-dashed border-red-300">
                    <div className="text-center">
                      <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                      <p className="text-sm text-red-600 mb-2">QR Code gagal dimuat</p>
                      <button
                        onClick={handleNewQR}
                        className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full hover:bg-red-200 transition-colors"
                      >
                        Coba Lagi
                      </button>
                    </div>
                  </div>
                )}

                <img 
                  src={`data:image/png;base64,${qrCode}`}
                  alt="WhatsApp QR Code" 
                  className={`w-64 h-64 mx-auto rounded-lg ${qrImageLoaded ? 'block' : 'hidden'}`}
                  onLoad={handleQRImageLoad}
                  onError={handleQRImageError}
                />
              </div>
              
              {/* Instructions */}
              {qrImageLoaded && (
                <div className="text-sm text-gray-600 space-y-2 mb-4">
                  <p className="font-medium text-gray-800">Cara memindai QR Code:</p>
                  <div className="text-left space-y-1">
                    <p>1. Buka WhatsApp di ponsel Anda</p>
                    <p>2. Pilih Menu → Perangkat Tertaut</p>
                    <p>3. Ketuk "Tautkan Perangkat"</p>
                    <p>4. Pindai QR code di atas</p>
                  </div>
                </div>
              )}
              
              {/* Status Indicator */}
              <div className="flex items-center justify-center space-x-2 text-xs text-gray-500 mb-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Menunggu pemindaian...</span>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button
                  onClick={handleNewQR}
                  disabled={loading}
                  className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>QR Baru</span>
                </button>
                <button
                  onClick={closeQRModal}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
                >
                  <X className="w-4 h-4" />
                  <span>Tutup</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WhatsAppIntegration;