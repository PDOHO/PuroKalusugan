/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { LayoutDashboard, MapPin, Users, Plus, Upload, Menu, X, ChevronRight, Activity, ClipboardList, HeartPulse, UserPlus, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Dashboard from './components/Dashboard';
import BarangayProfile from './components/BarangayProfile';
import PatientProfile from './components/PatientProfile';
import DataAudit from './components/DataAudit';
import Login from './components/Login';
import { User as UserType } from './types';

type Page = 'dashboard' | 'barangay' | 'patients' | 'audit';

export default function App() {
  const isEmbedded = new URLSearchParams(window.location.search).get('embed') === 'true' || 
                    new URLSearchParams(window.location.search).get('public') === 'true' ||
                    window.location.pathname.startsWith('/embed') ||
                    window.location.pathname.startsWith('/public');

  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Desktop state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile state
  const [user, setUser] = useState<UserType | null>(() => {
    const saved = localStorage.getItem('purokalusugan_user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to parse user from localStorage:", e);
      return null;
    }
  });

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
        setIsSidebarOpen(true);
      } else {
        setIsSidebarOpen(false);
      }
    };
    
    // Initial check
    handleResize();
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = (userData: UserType) => {
    setUser(userData);
    localStorage.setItem('purokalusugan_user', JSON.stringify(userData));
  };

  const handleLogout = async () => {
    if (user) {
      try {
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _user: user,
            action: 'LOGOUT',
            entity_type: 'system',
            entity_id: null,
            details: { message: 'User logged out' }
          })
        });
      } catch (err) {
        console.error("Failed to log logout event:", err);
      }
    }
    setUser(null);
    localStorage.removeItem('purokalusugan_user');
    localStorage.removeItem('dashboard_municipality');
    localStorage.removeItem('dashboard_barangay');
    localStorage.removeItem('dashboard_year');
    localStorage.removeItem('dashboard_quarter');
    localStorage.removeItem('dashboard_month');
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'barangay', label: 'Barangay Profile', icon: MapPin },
    { id: 'patients', label: 'Patients Served', icon: Users },
    { id: 'audit', label: 'Data Audit', icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-charcoal-gray">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      {!isEmbedded && (
      <aside 
        className={`fixed inset-y-0 left-0 z-50 bg-deep-navy text-white border-r border-charcoal-gray/20 transition-all duration-300 flex flex-col
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:relative md:translate-x-0 
          w-64
        `}
      >
        <div className="p-4 flex items-center gap-3 border-b border-white/10">
          <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-deep-navy shrink-0 overflow-hidden">
            <img src="/purokalusugan-logo.png" alt="PuroKalusugan Logo" className="w-full h-full object-contain scale-110" referrerPolicy="no-referrer" />
          </div>
          <div className="font-bold text-lg tracking-tight leading-tight transition-opacity duration-300">
            <span className="text-[#FDB913]">Puro</span><span className="text-[#ED1C24]">Kalusugan</span>
            <div className="text-[10px] font-medium text-white/70 uppercase tracking-widest">Ilocos Sur</div>
          </div>
          
          {/* Mobile Close Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="ml-auto md:hidden text-white/70 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActivePage(item.id as Page);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activePage === item.id 
                  ? 'bg-white text-deep-navy shadow-lg shadow-black/10' 
                  : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <item.icon size={20} className={`shrink-0 ${activePage === item.id ? 'text-deep-navy' : 'text-white/60 group-hover:text-white'}`} />
              <span className="font-medium transition-opacity duration-200">
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-300 hover:bg-red-500/20 transition-all duration-200"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="font-medium transition-opacity duration-200">
              Logout
            </span>
          </button>
        </div>
      </aside>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {!isEmbedded && (
        <header className="h-16 bg-white border-b border-charcoal-gray/10 flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-blue-slate hover:bg-mint-cream rounded-lg"
            >
              <Menu size={24} />
            </button>
            
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold text-health-blue">
                {navItems.find(i => i.id === activePage)?.label}
              </h1>
              {user.role === 'MUNICIPALITY' && (
                <span className="text-[10px] font-bold text-deep-navy uppercase tracking-wider">
                  {user.municipality} Portal
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-bold text-charcoal-gray">{user.username}</div>
              <div className="text-[10px] text-blue-slate font-medium uppercase tracking-wider">
                {user.role === 'ADMIN' ? 'Provincial Administrator' : user.role === 'VIEWER' ? 'Provincial Viewer' : 'Municipality Officer'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-mint-cream border border-charcoal-gray/10 flex items-center justify-center overflow-hidden">
              <span className="text-lg font-bold text-health-blue">
                {user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
        </header>
        )}

        <div className={`flex-1 overflow-y-auto ${isEmbedded ? 'p-0 md:p-2' : 'p-8'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activePage === 'dashboard' && <Dashboard currentUser={user} />}
              {activePage === 'barangay' && <BarangayProfile currentUser={user} />}
              {activePage === 'patients' && <PatientProfile currentUser={user} />}
              {activePage === 'audit' && <DataAudit currentUser={user} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

