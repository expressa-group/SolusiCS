import React, { useState, useEffect } from 'react';
import { 
  Brain, 
  Search, 
  RefreshCw, 
  Database,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  Play,
  BarChart3
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

interface RAGManagementProps {
  embeddingStatus?: any;
}

const RAGManagement: React.FC<RAGManagementProps> = ({ embeddingStatus }) => {
  const [loading, setLoading] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [embeddingStats, setEmbeddingStats] = useState({
    total: 0,
    faqs: 0,
    knowledge_base: 0,
    products: 0
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchEmbeddingStats();
  }, []);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const fetchEmbeddingStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get embedding counts by content type
      const { data: stats, error } = await supabase
        .from('embeddings')
        .select('content_type')
        .eq('user_id', user.id);

      if (error) throw error;

      const counts = {
        total: stats?.length || 0,
        faqs: stats?.filter(s => s.content_type === 'faq').length || 0,
        knowledge_base: stats?.filter(s => s.content_type === 'knowledge_base').length || 0,
        products: stats?.filter(s => s.content_type === 'product').length || 0
      };

      setEmbeddingStats(counts);
    } catch (error) {
      console.error('Error fetching embedding stats:', error);
    }
  };

  const handleBatchProcess = async (forceRefresh: boolean = false) => {
    setBatchProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/rag-batch-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          content_types: ['faq', 'knowledge_base', 'product'],
          force_refresh: forceRefresh
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process embeddings');
      }

      const result = await response.json();
      showMessage('success', `Berhasil memproses ${result.total_processed} item embedding`);
      await fetchEmbeddingStats();
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal memproses embedding');
    } finally {
      setBatchProcessing(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/rag-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          query: searchQuery,
          limit: 10
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search');
      }

      const result = await response.json();
      setSearchResults(result.results || []);
      showMessage('success', `Ditemukan ${result.total_results} dokumen relevan`);
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal melakukan pencarian');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div className="main-header">
        <div className="date-text">RAG Management</div>
        <h1 className="greeting">Sistem RAG dengan Gemini Embedding</h1>
        <div className="help-text">Kelola embedding dan pencarian semantik untuk AI yang lebih cerdas</div>
        
        <div className="action-buttons">
          <button 
            onClick={() => handleBatchProcess(false)}
            disabled={batchProcessing}
            className="action-button primary"
          >
            {batchProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
            Proses Embedding
          </button>
          <button 
            onClick={() => handleBatchProcess(true)}
            disabled={batchProcessing}
            className="action-button secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Semua
          </button>
        </div>
      </div>

      <div className="content-grid">
        {/* Left Column - Search & Results */}
        <div>
          {/* Message Display */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {message.text}
            </div>
          )}

          {/* Search Section */}
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <Search className="tasks-icon" />
                Pencarian Semantik
              </div>
            </div>

            <div className="p-4 border-b border-gray-100">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Cari dalam basis pengetahuan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={handleSearch}
                  disabled={searchLoading || !searchQuery.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {searchLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Cari</span>
                </button>
              </div>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="p-4">
                <h3 className="font-medium text-gray-900 mb-4">Hasil Pencarian ({searchResults.length})</h3>
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`text-xs px-2 py-1 rounded font-medium ${
                            result.content_type === 'faq' ? 'bg-blue-100 text-blue-600' :
                            result.content_type === 'knowledge_base' ? 'bg-purple-100 text-purple-600' :
                            'bg-green-100 text-green-600'
                          }`}>
                            {result.content_type.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            Kemiripan: {(result.similarity * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-3">
                        {result.content_text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !searchLoading && (
              <div className="p-4 text-center text-gray-500">
                Tidak ada hasil yang ditemukan untuk "{searchQuery}"
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Stats & Controls */}
        <div className="right-sidebar">
          {/* Embedding Statistics */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Statistik Embedding</div>
              <div className="widget-action">
                <button onClick={fetchEmbeddingStats} className="text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Overall Status */}
              <div className={`flex justify-between items-center p-3 rounded-lg ${
                embeddingStatus?.isComplete ? 'bg-green-50' : 'bg-yellow-50'
              }`}>
                <span className="text-sm text-gray-600">Status Keseluruhan</span>
                <span className={`font-semibold ${
                  embeddingStatus?.isComplete ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {embeddingStatus?.isComplete ? 'Lengkap' : `${embeddingStatus?.missingItemsCount || 0} Missing`}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Embedding</span>
                <span className="font-semibold text-purple-600">{embeddingStats.total}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">FAQ</span>
                <span className="font-semibold text-blue-600">{embeddingStats.faqs}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Knowledge Base</span>
                <span className="font-semibold text-purple-600">{embeddingStats.knowledge_base}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Produk</span>
                <span className="font-semibold text-green-600">{embeddingStats.products}</span>
              </div>
            </div>
          </div>

          {/* RAG Status */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Status RAG</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Gemini Embedding</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Aktif</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Database className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">Vector Database</span>
                </div>
                <span className="text-xs text-blue-600 font-medium">Siap</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Brain className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">Similarity Search</span>
                </div>
                <span className="text-xs text-purple-600 font-medium">Optimal</span>
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
                onClick={() => handleBatchProcess(false)}
                disabled={batchProcessing}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Database className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Proses Data Baru</span>
              </button>
              
              <button 
                onClick={() => handleBatchProcess(true)}
                disabled={batchProcessing}
                className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4 text-green-500" />
                <span className="text-sm">Refresh Semua Embedding</span>
              </button>
              
              <button className="w-full flex items-center space-x-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <span className="text-sm">Lihat Analitik</span>
              </button>
            </div>
          </div>

          {/* RAG Info */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">Tentang RAG</div>
            </div>
            
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                <strong>RAG (Retrieval Augmented Generation)</strong> menggunakan Gemini Embedding untuk mencari informasi yang paling relevan sebelum menghasilkan respons AI.
              </p>
              <p>
                Sistem ini secara otomatis mengubah FAQ, Knowledge Base, dan Produk menjadi vektor embedding untuk pencarian semantik yang lebih akurat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RAGManagement;