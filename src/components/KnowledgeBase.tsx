import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Search, 
  FileText, 
  Edit, 
  Trash2,
  CheckSquare,
  MoreHorizontal,
  Building,
  Package,
  MessageCircle,
  Save,
  X
} from 'lucide-react';

import { UserBusinessProfile } from '../types/database';
import { KnowledgeBaseService, KnowledgeBaseItem } from '../lib/knowledgeBaseService';
import { EmbeddingService } from '../lib/embeddingService';
import { supabase } from '../lib/supabaseClient';

interface KnowledgeBaseProps {
  userBusinessProfile?: UserBusinessProfile | null;
  embeddingStatus?: {
    isComplete: boolean;
    missingItemsCount: number;
    totalItemsCount: number;
    embeddedItemsCount: number;
    missingItems: Array<{ type: string; id: string; name: string }>;
  } | null;
  onEmbeddingStatusChange?: () => void;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ userBusinessProfile, embeddingStatus, onEmbeddingStatusChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeBaseItem[]>([]);
  const [knowledgeTree, setKnowledgeTree] = useState<KnowledgeBaseItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [loading, setLoading] = useState(false);
  const [trainingLoading, setTrainingLoading] = useState(false);
  const [retrainLoading, setRetrainLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ question: '', answer: '', category: '' });
  const [addForm, setAddForm] = useState({
    question: '',
    answer: '',
    category: 'general',
    type: 'custom',
    parent_id: ''
  });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Get categories based on industry
  const getIndustryCategories = () => {
    const industry = userBusinessProfile?.industry;
    
    if (industry === 'healthcare') {
      return [
        { value: 'general', label: 'Umum' },
        { value: 'symptoms', label: 'Gejala & Keluhan' },
        { value: 'diagnosis', label: 'Diagnosa' },
        { value: 'treatment', label: 'Pengobatan' },
        { value: 'medication', label: 'Obat-obatan' },
        { value: 'appointment', label: 'Janji Temu' },
        { value: 'insurance', label: 'Asuransi' },
        { value: 'procedure', label: 'Prosedur Medis' },
        { value: 'emergency', label: 'Darurat' },
        { value: 'prevention', label: 'Pencegahan' },
        { value: 'nutrition', label: 'Nutrisi & Diet' },
        { value: 'mental_health', label: 'Kesehatan Mental' }
      ];
    }
    
    // Default categories for other industries
    return [
      { value: 'general', label: 'Umum' },
      { value: 'product', label: 'Produk' },
      { value: 'service', label: 'Layanan' },
      { value: 'policy', label: 'Kebijakan' },
      { value: 'support', label: 'Dukungan' },
      { value: 'billing', label: 'Pembayaran' }
    ];
  };

  const industryCategories = getIndustryCategories();

  useEffect(() => {
    fetchKnowledgeItems();
  }, []);

  const fetchKnowledgeItems = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [items, tree] = await Promise.all([
        KnowledgeBaseService.getKnowledgeItems(user.id),
        KnowledgeBaseService.getKnowledgeTree(user.id)
      ]);
      setKnowledgeItems(items);
      setKnowledgeTree(tree);
    } catch (error) {
      console.error('Error fetching knowledge items:', error);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleAddItem = async () => {
    if (!addForm.question.trim() || !addForm.answer.trim()) {
      showMessage('error', 'Pertanyaan dan jawaban harus diisi');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await KnowledgeBaseService.createKnowledgeItem(user.id, addForm);
      await fetchKnowledgeItems();
      setAddForm({ question: '', answer: '', category: 'general', type: 'custom', parent_id: '' });
      setShowAddForm(false);
      showMessage('success', 'Item pengetahuan berhasil ditambahkan');
      
      // Refresh embedding status
      if (onEmbeddingStatusChange) {
        onEmbeddingStatusChange();
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal menambahkan item');
    } finally {
      setLoading(false);
    }
  };

  const handleEditItem = (item: KnowledgeBaseItem) => {
    setEditingItem(item.id);
    setEditForm({
      question: item.question,
      answer: item.answer,
      category: item.category || 'general'
    });
  };

  const handleSaveEdit = async (itemId: string) => {
    if (!editForm.question.trim() || !editForm.answer.trim()) {
      showMessage('error', 'Pertanyaan dan jawaban harus diisi');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await KnowledgeBaseService.updateKnowledgeItem(user.id, itemId, editForm);
      await fetchKnowledgeItems();
      setEditingItem(null);
      showMessage('success', 'Item berhasil diperbarui');
      
      // Refresh embedding status
      if (onEmbeddingStatusChange) {
        onEmbeddingStatusChange();
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal memperbarui item');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus item ini?')) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await KnowledgeBaseService.deleteKnowledgeItem(user.id, itemId);
      await fetchKnowledgeItems();
      showMessage('success', 'Item berhasil dihapus');
      
      // Refresh embedding status
      if (onEmbeddingStatusChange) {
        onEmbeddingStatusChange();
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal menghapus item');
    } finally {
      setLoading(false);
    }
  };

  const handleRetrainAI = async () => {
    setRetrainLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Call the batch processing function with force refresh to retrain embeddings
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
          force_refresh: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to process embeddings');
      }

      const result = await response.json();
      
      showMessage('success', `AI berhasil dilatih ulang dengan ${result.total_processed} item embedding yang diperbarui`);
      
      // Refresh embedding status
      if (onEmbeddingStatusChange) {
        onEmbeddingStatusChange();
      }
    } catch (error: any) {
      showMessage('error', error.message || 'Gagal melatih ulang AI');
    } finally {
      setRetrainLoading(false);
    }
  };

  // Filter items based on search term
  const filteredItems = knowledgeItems.filter(item =>
    item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getItemIcon = (type?: string) => {
    switch (type) {
      case 'business_info':
        return Building;
      case 'custom':
        return FileText;
      default:
        return FileText;
    }
  };

  const getItemColor = (type?: string) => {
    switch (type) {
      case 'business_info':
        return 'bg-blue-100 text-blue-600';
      case 'custom':
        return 'bg-purple-100 text-purple-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  return (
    <div className="main-content">
      {/* Header */}
      <div className="main-header">
        <div className="date-text">Senin, 7 Juli</div>
        <h1 className="greeting">
          Basis Pengetahuan {userBusinessProfile?.business_name || 'Solusics.ai'}
        </h1>
        <div className="help-text">
          Kelola pengetahuan dan data pelatihan AI untuk {userBusinessProfile?.business_name || 'bisnis Anda'}
        </div>
        
        <div className="action-buttons">
          <button 
            onClick={handleRetrainAI}
            disabled={retrainLoading}
            className="action-button secondary"
          >
            {retrainLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span>Melatih AI...</span>
              </>
            ) : (
              <>
                <span>Latih Ulang AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="content-grid">
        {/* Left Column - Knowledge Items */}
        <div>
          <div className="tasks-section">
            <div className="tasks-header">
              <div className="tasks-title">
                <Zap className="tasks-icon" />
                Basis Pengetahuan
              </div>
              <div className="tasks-actions">
                <Plus className="w-4 h-4 cursor-pointer text-gray-400" onClick={() => setShowAddForm(true)} />
                <Search className="w-4 h-4 cursor-pointer text-gray-400" />
                <MoreHorizontal className="w-4 h-4 cursor-pointer text-gray-400" />
              </div>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari basis pengetahuan..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Knowledge Items */}
            {message && (
              <div className={`mx-4 mb-4 p-3 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {message.text}
              </div>
            )}

            {filteredItems.map((item) => {
              const ItemIcon = getItemIcon(item.type);
              const iconColorClass = getItemColor(item.type);
              const isEditing = editingItem === item.id;
              
              return (
                <div key={item.id} className="task-item">
                  <div className="task-checkbox"></div>
                  <div className="task-content flex-1">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editForm.question}
                          onChange={(e) => setEditForm({...editForm, question: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Pertanyaan"
                        />
                        <textarea
                          value={editForm.answer}
                          onChange={(e) => setEditForm({...editForm, answer: e.target.value})}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                          rows={2}
                          placeholder="Jawaban"
                        />
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({...editForm, category: e.target.value})}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          {industryCategories.map(category => (
                            <option key={category.value} value={category.value}>
                              {category.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="task-name">{item.question}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className={`w-5 h-5 rounded flex items-center justify-center ${iconColorClass}`}>
                            <ItemIcon className="w-3 h-3" />
                          </div>
                          <div className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-medium">
                            {item.type}
                          </div>
                          <div className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded font-medium">
                            {industryCategories.find(cat => cat.value === item.category)?.label || item.category}
                          </div>
                          <div className="task-due">
                            {item.updated_at ? new Date(item.updated_at).toLocaleDateString('id-ID') : 'Baru'}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 mt-2 line-clamp-2">
                          {item.answer}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={loading}
                          className="w-4 h-4 text-green-600 cursor-pointer hover:text-green-800 disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingItem(null)}
                          className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditItem(item)}
                          className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="w-4 h-4 text-gray-400 cursor-pointer hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            
            {knowledgeItems.length < 20 && (
              <div className="task-item">
                <Plus className="w-4 h-4 text-gray-400 mr-3" />
                <span className="text-gray-400 text-sm cursor-pointer" onClick={() => setShowAddForm(true)}>
                  Tambah item pengetahuan ({knowledgeItems.length}/50)
                </span>
              </div>
            )}
            
            {knowledgeItems.length >= 50 && (
              <div className="task-item">
                <div className="text-gray-500 text-sm">
                  Maksimal 50 item pengetahuan telah tercapai
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="right-sidebar">
          {/* Training Status */}
          <div className="projects-widget">
            <div className="widget-header">
              <div className="widget-title">
                Status Pelatihan AI
                {userBusinessProfile?.industry === 'healthcare' && (
                  <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-1 rounded font-medium">
                    Kesehatan
                  </span>
                )}
              </div>
              <div className="widget-action">Aktif</div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Basis Pengetahuan</span>
                </div>
                <span className="text-xs text-green-600 font-medium">Aktif</span>
              </div>
              
              {userBusinessProfile?.industry === 'healthcare' && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">Protokol Medis</span>
                  </div>
                  <span className="text-xs text-blue-600 font-medium">Siap</span>
                </div>
              )}
              
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">Memproses</span>
                </div>
                <span className="text-xs text-blue-600 font-medium">Melatih</span>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span className="text-sm font-medium">Penerapan</span>
                </div>
                <span className="text-xs text-gray-600 font-medium">Menunggu</span>
              </div>
            </div>
            
            <button className="w-full mt-4 bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
              {userBusinessProfile?.industry === 'healthcare' ? 'Latih AI Medis' : 'Latih Ulang AI'} 
            </button>
          </div>
        </div>
      </div>

      {/* Add Knowledge Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Tambah Pengetahuan Baru ({knowledgeItems.length}/50)
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jenis</label>
                  <select 
                    value={addForm.type}
                    onChange={(e) => setAddForm({...addForm, type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="custom">Custom</option>
                    <option value="business_info">Info Bisnis</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select
                    value={addForm.category}
                    onChange={(e) => setAddForm({...addForm, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {industryCategories.map(category => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Topik</label>
                <input
                  type="text"
                  placeholder="Masukkan topik"
                  value={addForm.question}
                  onChange={(e) => setAddForm({...addForm, question: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Isi basis data</label>
                <textarea
                  placeholder="Masukkan isi basis data"
                  value={addForm.answer}
                  onChange={(e) => setAddForm({...addForm, answer: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={4}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleAddItem}
                disabled={loading || !addForm.question.trim() || !addForm.answer.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Menambahkan...' : 'Tambah Pengetahuan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;