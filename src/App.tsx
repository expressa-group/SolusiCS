import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { Clock, Shield } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { BusinessProfileService } from './lib/businessProfileService';
import { KnowledgeBaseService } from './lib/knowledgeBaseService';
import { EmbeddingService } from './lib/embeddingService';
import { UserBusinessProfile } from './types/database';

// Components
import AuthPage from './components/AuthPage';
import EmailVerificationPage from './components/EmailVerificationPage';
import PricingPage from './components/PricingPage';
import BusinessSetup from './components/BusinessSetup';
import StartLaunchPage from './components/StartLaunchPage';
import Sidebar from './components/Sidebar';
import Analytics from './components/Analytics';
import Settings from './components/Settings';
import KnowledgeBase from './components/KnowledgeBase';
import RAGManagement from './components/RAGManagement';
import WhatsAppManagement from './components/WhatsAppManagement';
import TrialApprovalPage from './components/Admin/TrialApprovalPage';
import AdminDashboard from './components/Admin/AdminDashboard';
import OrderManagement from './components/OrderManagement';
import PaymentConfirmationPage from './components/PaymentConfirmationPage';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userBusinessProfile, setUserBusinessProfile] = useState<UserBusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [embeddingStatus, setEmbeddingStatus] = useState<{
    isComplete: boolean;
    missingItemsCount: number;
    totalItemsCount: number;
    embeddedItemsCount: number;
  } | null>(null);
  const [isPaymentPage, setIsPaymentPage] = useState(false);

  useEffect(() => {
    // Check if current URL is payment confirmation page
    const currentPath = window.location.pathname;
    const isPaymentConfirmPage = currentPath === '/payment-confirm' || currentPath.includes('payment-confirm');
    setIsPaymentPage(isPaymentConfirmPage);
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserBusinessProfile();
      checkEmbeddingStatus();
      // Check trial expiry for active trials
      if (userBusinessProfile?.trial_status === 'active') {
        BusinessProfileService.checkTrialExpiry(user.id);
      }
    } else {
      setUserBusinessProfile(null);
      setEmbeddingStatus(null);
    }
  }, [user]);

  const fetchUserBusinessProfile = async () => {
    if (!user) return;
    
    try {
      const profile = await BusinessProfileService.getUserBusinessProfile(user.id);
      setUserBusinessProfile(profile);
    } catch (error) {
      console.error('Error fetching user business profile:', error);
    }
  };

  const checkEmbeddingStatus = async () => {
    if (!user) return;
    
    try {
      const status = await EmbeddingService.checkEmbeddingStatus(user.id);
      setEmbeddingStatus(status);
    } catch (error) {
      console.error('Error checking embedding status:', error);
    }
  };

  const handleAuthSuccess = async (phoneNumber?: string) => {
    // Get the current user after successful auth
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (currentUser) {
      setUser(currentUser);
      
      // Store phone number if provided (from signup)
      if (phoneNumber) {
        try {
          await BusinessProfileService.updateBusinessInfo(currentUser.id, {
            business_name: '',
            description: '',
            industry: '',
            operating_hours: '',
            whatsapp_number: '',
            user_phone_number: phoneNumber
          });
        } catch (error) {
          console.error('Error storing phone number:', error);
        }
      }
    }
  };

  const handleSelectPlan = async (plan: string) => {
    if (!user) return;
    
    try {
      const updatedProfile = await BusinessProfileService.updateSelectedPlan(user.id, plan);
      setUserBusinessProfile(updatedProfile);
    } catch (error) {
      console.error('Error selecting plan:', error);
      throw error;
    }
  };

  const handleBusinessSetupComplete = async (businessInfo: {
    business_name: string;
    description: string;
    industry: string;
    operating_hours: string;
    whatsapp_number: string;
  }) => {
    if (!user) return;
    
    try {
      const updatedProfile = await BusinessProfileService.updateBusinessInfo(user.id, businessInfo);
      setUserBusinessProfile(updatedProfile);
      
      // Auto-populate knowledge base from business setup
      await KnowledgeBaseService.autoPopulateFromBusinessSetup(user.id);
      
      // Check embedding status after setup
      await checkEmbeddingStatus();
    } catch (error) {
      console.error('Error completing business setup:', error);
      throw error;
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Show payment confirmation page without authentication
  if (isPaymentPage) {
    return <PaymentConfirmationPage />;
  }

  const renderMainContent = () => {
    switch (activeTab) {
      case 'analytics':
        return <Analytics />;
      case 'settings':
        return (
          <Settings 
            userBusinessProfile={userBusinessProfile}
            onProfileUpdate={setUserBusinessProfile}
          />
        );
      case 'knowledge':
        return (
          <KnowledgeBase 
            userBusinessProfile={userBusinessProfile}
            embeddingStatus={embeddingStatus}
            onEmbeddingStatusChange={checkEmbeddingStatus}
          />
        );
      case 'rag':
        return <RAGManagement embeddingStatus={embeddingStatus} />;
      case 'whatsapp':
        return <WhatsAppManagement userBusinessProfile={userBusinessProfile} />;
      case 'orders':
        return <OrderManagement />;
      case 'trial-approval':
        // Only allow admin access
        if (userBusinessProfile?.role === 'admin') {
          return <TrialApprovalPage />;
        } else {
          return (
            <div className="main-content">
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Akses ditolak - diperlukan role admin</p>
                </div>
              </div>
            </div>
          );
        }
      case 'admin-panel':
        // Only allow admin access
        if (userBusinessProfile?.role === 'admin') {
          return <AdminDashboard />;
        } else {
          return (
            <div className="main-content">
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Shield className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Akses ditolak - diperlukan role admin</p>
                </div>
              </div>
            </div>
          );
        }
      case 'dashboard':
      default:
        return <StartLaunchPage user={user} userBusinessProfile={userBusinessProfile} />;
    }
  };

  // Show loading spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Memuat...</p>
        </div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Show email verification if user is not confirmed
  if (user && !user.email_confirmed_at) {
    return <EmailVerificationPage user={user} onAuthSuccess={() => setUser(user)} />;
  }

  // Show business setup if user hasn't completed setup OR no profile exists
  if (user && (!userBusinessProfile || !userBusinessProfile.setup_completed)) {
    return (
      <BusinessSetup 
        onSetupFinished={handleBusinessSetupComplete}
        userBusinessProfile={userBusinessProfile}
      />
    );
  }

  // Show pricing page if user hasn't completed pricing (after business setup)
  if (user && userBusinessProfile && !userBusinessProfile.pricing_completed) {
    // Check if trial is requested and show waiting message
    if (userBusinessProfile.trial_status === 'requested') {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center px-4">
          <div className="w-full max-w-md text-center">
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Pengajuan Trial Sedang Ditinjau
              </h2>
              <p className="text-gray-600 mb-6">
                Terima kasih telah mengajukan trial 14 hari. Tim kami akan meninjau pengajuan Anda dalam 1x24 jam.
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={() => setUserBusinessProfile(prev => prev ? {...prev, pricing_completed: false} : prev)}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  Tidak Ingin Menunggu? Bayar Sekarang
                </button>
                
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="w-full border border-gray-300 hover:border-gray-400 text-gray-700 hover:text-gray-900 font-semibold py-3 px-4 rounded-lg transition-all duration-200"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return <PricingPage onSelectPlan={handleSelectPlan} user={user} />;
  }

  // Show main dashboard
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Mobile Header */}
      <div className="mobile-header">
        <button
          onClick={toggleSidebar}
          className="mobile-menu-button"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        
        <div className="flex items-center gap-3 min-w-0">
          <img 
            src="https://i.imghippo.com/files/lcA1141GSM.png" 
            alt="Solusics.ai" 
            className="h-6 sm:h-8 w-auto flex-shrink-0"
          />
          <span className="text-gray-900 font-bold text-base sm:text-lg truncate">
            Solusics.<span className="text-purple-600">ai</span>
          </span>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="sidebar-overlay"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSidebarOpen={isSidebarOpen}
        toggleSidebar={toggleSidebar}
        userBusinessProfile={userBusinessProfile}
        embeddingStatus={embeddingStatus}
      />

      {/* Main Content */}
      <div className={`main-content-wrapper ${!isSidebarOpen ? 'no-sidebar-margin' : ''}`}>
        {renderMainContent()}
      </div>
    </div>
  );
}

export default App;