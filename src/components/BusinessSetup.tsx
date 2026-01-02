import React, { useState, useEffect } from 'react';
import { 
  Building, 
  CheckCircle, 
  ArrowRight,
  Package,
  HelpCircle,
  Brain,
  Zap,
  Trash2,
  Edit,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { ProductService } from '../lib/productService';
import { FaqService } from '../lib/faqService';
import { Product, FAQ } from '../types/database';

interface BusinessSetupProps {
  onSetupFinished: (businessInfo: {
    business_name: string;
    description: string;
    industry: string;
    operating_hours: string;
    whatsapp_number: string;
  }) => Promise<void>;
  userBusinessProfile?: any;
}

const BusinessSetup: React.FC<BusinessSetupProps> = ({ onSetupFinished, userBusinessProfile }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    description: '',
    category: 'general'
  });
  const [faqForm, setFaqForm] = useState({
    question: '',
    answer: '',
    category: 'general'
  });
  const [formData, setFormData] = useState({
    businessName: userBusinessProfile?.business_name || '',
    description: userBusinessProfile?.description || '',
    industry: userBusinessProfile?.industry || '',
    operatingHours: userBusinessProfile?.operating_hours || '',
    whatsappNumber: userBusinessProfile?.whatsapp_number || ''
  });

  const steps = [
    { id: 1, title: 'Info Bisnis', icon: Building },
    { id: 2, title: 'Produk', icon: Package },
    { id: 3, title: 'Pengetahuan', icon: HelpCircle },
    { id: 4, title: 'Selesai', icon: CheckCircle }
  ];

  const handleNext = async () => {
    if (loading) return;
    
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === 4) {
      // Complete the entire setup process
      setLoading(true);
      
      try {
        await onSetupFinished({
          business_name: formData.businessName,
          description: formData.description,
          industry: formData.industry,
          operating_hours: formData.operatingHours,
          whatsapp_number: formData.whatsappNumber,
        });
      } catch (error) {
        console.error('Error completing business setup:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return formData.businessName.trim() !== '' && 
             formData.description.trim() !== '' && 
             formData.industry !== '' && 
             formData.operatingHours.trim() !== '';
    }
    return true;
  };

  const handleAddProduct = async () => {
    if (!productForm.name.trim()) return;
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newProduct = await ProductService.createProduct(user.id, {
        name: productForm.name,
        price: productForm.price,
        description: productForm.description,
        category: productForm.category
      });

      if (newProduct) {
        setProducts([...products, newProduct]);
        setProductForm({ name: '', price: '', description: '', category: 'general' });
      }
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const success = await ProductService.deleteProduct(user.id, productId);
      if (success) {
        setProducts(products.filter(p => p.id !== productId));
      }
    } catch (error) {
      console.error('Error deleting product:', error);
    }
  };

  const handleAddFaq = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) return;
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newFaq = await FaqService.createFaq(user.id, {
        question: faqForm.question,
        answer: faqForm.answer,
        category: faqForm.category
      });

      if (newFaq) {
        setFaqs([...faqs, newFaq]);
        setFaqForm({ question: '', answer: '', category: 'general' });
      }
    } catch (error) {
      console.error('Error adding FAQ:', error);
    }
  };

  const handleDeleteFaq = async (faqId: string) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const success = await FaqService.deleteFaq(user.id, faqId);
      if (success) {
        setFaqs(faqs.filter(f => f.id !== faqId));
      }
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Informasi Bisnis</h2>
              <p className="text-gray-600">Ceritakan tentang bisnis Anda</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nama Bisnis
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Masukkan nama bisnis Anda"
                  value={formData.businessName}
                  onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deskripsi
                </label>
                <textarea
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={4}
                  placeholder="Jelaskan apa yang dilakukan bisnis Anda..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Industri
                  </label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    value={formData.industry}
                    onChange={(e) => setFormData({...formData, industry: e.target.value})}
                  >
                    <option value="">Pilih industri</option>
                    <option value="healthcare">Kesehatan</option>
                    <option value="retail">Retail & Restoran</option>
                    <option value="ecommerce">E-commerce</option>
                    <option value="technology">Teknologi</option>
                    <option value="education">Pendidikan</option>
                    <option value="finance">Keuangan</option>
                    <option value="manufacturing">Manufaktur</option>
                    <option value="services">Jasa</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Jam Operasional
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Sen-Jum 9 Pagi-6 Sore"
                    value={formData.operatingHours}
                    onChange={(e) => setFormData({...formData, operatingHours: e.target.value})}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nomor WhatsApp
                  </label>
                  <input
                    type="tel"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="628123456789"
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({...formData, whatsappNumber: e.target.value})}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Format: 628123456789 (tanpa tanda + atau spasi)
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Produk & Layanan</h2>
              <p className="text-gray-600">Tambahkan penawaran Anda</p>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Nama produk"
                  value={productForm.name}
                  onChange={(e) => setProductForm({...productForm, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <input
                  type="text"
                  placeholder="Harga"
                  value={productForm.price}
                  onChange={(e) => setProductForm({...productForm, price: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="mb-4">
                <select
                  value={productForm.category}
                  onChange={(e) => setProductForm({...productForm, category: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="general">Umum</option>
                  <option value="product">Produk</option>
                  <option value="service">Layanan</option>
                  <option value="digital">Digital</option>
                </select>
              </div>
              <textarea
                placeholder="Deskripsi..."
                value={productForm.description}
                onChange={(e) => setProductForm({...productForm, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                rows={3}
              />
              <button 
                onClick={handleAddProduct}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                Tambah Produk
              </button>
            </div>
            
            {/* Products List */}
            {products.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">Produk yang Ditambahkan:</h3>
                {products.map((product) => (
                  <div key={product.id} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-gray-900">{product.name}</h4>
                        {product.price && (
                          <span className="text-sm bg-green-100 text-green-800 px-2 py-1 rounded font-medium">
                            {product.price}
                          </span>
                        )}
                        <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded font-medium">
                          {product.category}
                        </span>
                      </div>
                      {product.description && (
                        <p className="text-sm text-gray-600">{product.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Basis Pengetahuan</h2>
              <p className="text-gray-600">Tambahkan FAQ dan informasi</p>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="space-y-4">
                <div>
                  <select
                    value={faqForm.category}
                    onChange={(e) => setFaqForm({...faqForm, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
                  >
                    <option value="general">Umum</option>
                    <option value="product">Produk</option>
                    <option value="service">Layanan</option>
                    <option value="policy">Kebijakan</option>
                    <option value="support">Dukungan</option>
                  </select>
                </div>
                <input
                  type="text"
                  placeholder="Pertanyaan"
                  value={faqForm.question}
                  onChange={(e) => setFaqForm({...faqForm, question: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <textarea
                  placeholder="Jawaban"
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm({...faqForm, answer: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={3}
                />
                <button 
                  onClick={handleAddFaq}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Tambah FAQ
                </button>
              </div>
            </div>
            
            {/* FAQs List */}
            {faqs.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-gray-900">FAQ yang Ditambahkan:</h3>
                {faqs.map((faq) => (
                  <div key={faq.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded font-medium">
                            {faq.category}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-900 mb-2">{faq.question}</h4>
                        <p className="text-sm text-gray-600">{faq.answer}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteFaq(faq.id)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
          </div>
        );
        
      case 4:
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                Setup Bisnis Selesai!
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Informasi bisnis Anda telah tersimpan. Agen AI akan dilatih secara otomatis berdasarkan data yang Anda berikan.
              </p>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-6 max-w-md mx-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Info Bisnis</span>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Produk ({products.length})</span>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">FAQ ({faqs.length})</span>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="flex items-center justify-center gap-3 mb-4 sm:mb-6 flex-wrap">
            <img 
              src="https://i.imghippo.com/files/lcA1141GSM.png" 
              alt="Solusics.ai" 
              className="h-10 sm:h-12 w-auto flex-shrink-0"
            />
            <span className="text-gray-900 font-bold text-xl sm:text-2xl">
              Solusics.<span className="text-purple-600">ai</span>
            </span>
          </div>
          <p className="text-sm sm:text-base text-gray-600 px-4 leading-relaxed">
            Siapkan layanan pelanggan AI Anda dalam hitungan menit
          </p>
        </div>
        
        {/* Progress */}
        <div className="flex items-center justify-center mb-8 sm:mb-12 overflow-x-auto pb-4">
          <div className="flex items-center min-w-max px-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 sm:w-10 h-8 sm:h-10 rounded-lg flex items-center justify-center transition-all ${
                    isCompleted 
                      ? 'bg-green-500 text-white' 
                      : isActive 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-200 text-gray-500'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="h-4 sm:h-5 w-4 sm:w-5" />
                    ) : (
                      <Icon className="h-4 sm:h-5 w-4 sm:w-5" />
                    )}
                  </div>
                  <span className={`text-xs mt-1 sm:mt-2 font-medium text-center ${isActive ? 'text-purple-600' : 'text-gray-600'}`}>
                    {step.title}
                  </span>
                </div>
                
                {index < steps.length - 1 && (
                  <div className={`w-8 sm:w-12 h-px mx-2 sm:mx-4 transition-all ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
          </div>
        </div>
        
        {/* Content */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
          {renderStepContent()}
          
          {/* Navigation */}
          <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
            <button
              onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
              disabled={currentStep === 1}
              className={`px-4 py-2.5 rounded-lg border transition-colors min-h-11 touch-action-manipulation ${
                currentStep === 1 
                  ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-200' 
                  : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
              }`}
            >
              Sebelumnya
            </button>
            
            <button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className={`bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2.5 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-colors flex items-center justify-center gap-2 min-h-11 touch-action-manipulation ${
                (!canProceed() || loading) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <span>
                {loading 
                  ? 'Memproses...' 
                  : currentStep === 4 
                    ? 'Selesai & Luncurkan' 
                    : 'Lanjutkan'}
              </span>
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessSetup;