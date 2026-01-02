import React from 'react';
import { 
  Home, 
  Zap, 
  CheckSquare, 
  Inbox, 
  Calendar, 
  BarChart3, 
  Settings,
  Plus,
  ChevronDown,
  X,
  Smartphone,
  Brain,
  Users,
  Shield
} from 'lucide-react';
import { UserBusinessProfile } from '../types/database';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  userBusinessProfile?: UserBusinessProfile | null;
  embeddingStatus?: {
    isComplete: boolean;
    missingItemsCount: number;
    totalItemsCount: number;
    embeddedItemsCount: number;
  } | null;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isSidebarOpen, toggleSidebar, userBusinessProfile, embeddingStatus }) => {
  const baseMenuItems = [
    { id: 'dashboard', label: 'Beranda', icon: Home },
    { id: 'knowledge', label: 'Latih AI', icon: Zap },
    { id: 'whatsapp', label: 'WhatsApp AI', icon: Smartphone },
    { id: 'orders', label: 'Pesanan', icon: CheckSquare },
    { id: 'analytics', label: 'Analitik', icon: BarChart3 },
    { id: 'settings', label: 'Pengaturan', icon: Settings },
  ];

  // Add admin-only menu items
  const adminMenuItems = [
    { id: 'rag', label: 'RAG Management', icon: Brain },
    { id: 'trial-approval', label: 'Persetujuan Trial', icon: Users },
    { id: 'admin-panel', label: 'Panel Admin', icon: Shield },
  ];

  // Combine menu items based on user role
  const menuItems = userBusinessProfile?.role === 'admin' 
    ? [...baseMenuItems, ...adminMenuItems]
    : baseMenuItems;
  const projects = [
    { name: 'Dukungan Pelanggan', color: '#c084fc' },
    { name: 'Brainstorming Tim', color: '#06b6d4' },
    { name: 'Pelatihan AI', color: '#10b981' }
  ];

  const handleMenuItemClick = (itemId: string) => {
    setActiveTab(itemId);
    // Close sidebar on mobile/tablet after selection
    if (window.innerWidth <= 1024) {
      toggleSidebar();
    }
  };

  // Generate initials from business name
  const getBusinessInitials = (businessName?: string) => {
    if (!businessName) return 'SL'; // Default to Solusics initials
    
    const words = businessName.trim().split(' ');
    if (words.length === 1) {
      return words[0].substring(0, 2).toUpperCase();
    } else {
      return words.slice(0, 2).map(word => word.charAt(0)).join('').toUpperCase();
    }
  };

  // Get display name for business
  const getDisplayName = () => {
    return userBusinessProfile?.business_name || 'Bisnis Anda';
  };

  // Get business status
  const getBusinessStatus = () => {
    if (!userBusinessProfile) return 'Setup';
    if (userBusinessProfile.trial_status === 'requested') return 'Menunggu Persetujuan';
    if (userBusinessProfile.trial_status === 'active') return 'Trial Aktif';
    if (userBusinessProfile.trial_status === 'expired') return 'Trial Berakhir';
    if (!userBusinessProfile.setup_completed) return 'Setup';
    if (!userBusinessProfile.pricing_completed) return 'Konfigurasi';
    return 'Aktif';
  };
  return (
    <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`} role="navigation" aria-label="Main navigation">
      {/* Mobile Close Button */}
      <button
        onClick={toggleSidebar}
        className="sidebar-close-button"
        aria-label="Close sidebar"
      >
        <X className="w-6 h-6" />
      </button>
      
      {/* User Profile */}
      <div className="user-profile" role="banner">
        <div className="user-avatar">{getBusinessInitials(userBusinessProfile?.business_name)}</div>
        <div className="user-info flex-1">
          <h3>{getDisplayName()}</h3>
          <p>{getBusinessStatus()}</p>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
      
      {/* Navigation */}
      <nav className="nav-section" role="menu">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => handleMenuItemClick(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              role="menuitem"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleMenuItemClick(item.id);
                }
              }}
            >
              <Icon className="flex-shrink-0" />
              <div className="flex items-center justify-between flex-1">
                <span className="truncate">{item.label}</span>
                {(item.id === 'knowledge' || item.id === 'rag') && embeddingStatus && !embeddingStatus.isComplete && (
                  <div 
                    className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse flex-shrink-0 ml-2" 
                    title={`${embeddingStatus.missingItemsCount} item belum di-embed`}
                    aria-label={`${embeddingStatus.missingItemsCount} item belum di-embed`}
                  ></div>
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Solusics Section */}
      <div className="prodify-section">
        <div className="flex items-center gap-3 mb-2">
          <img 
            src="https://i.imghippo.com/files/lcA1141GSM.png" 
            alt="Solusics.ai" 
            className="h-8 w-auto flex-shrink-0"
          />
          <span className="text-white font-semibold text-lg truncate">
            Solusics.<span className="text-purple-300">ai</span>
          </span>
        </div>
        <div className="prodify-description">
          Platform layanan pelanggan bertenaga AI untuk {userBusinessProfile?.business_name || 'bisnis Anda'}
        </div>
        <button className="invite-button w-full">+ Undang Tim</button>
      </div>
    </div>
  );
};

export default Sidebar;