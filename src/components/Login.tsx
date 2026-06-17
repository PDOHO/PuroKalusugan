import React, { useState } from 'react';
import { HeartPulse, Lock, User, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { MUNICIPALITIES, USER_CREDENTIALS } from '../constants';
import { User as UserType } from '../types';

interface LoginProps {
  onLogin: (user: UserType) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter both username and password');
      return;
    }

    const correctPassword = USER_CREDENTIALS[username];

    if (correctPassword === password) {
      let role: UserType['role'] = 'MUNICIPALITY';
      if (username === 'PDOHO Admin') role = 'ADMIN';
      if (username === 'Provincial Viewer') role = 'VIEWER';

      const user: UserType = {
        id: username,
        username,
        role,
        municipality: role === 'MUNICIPALITY' ? username : undefined
      };
      
      try {
        await fetch('/api/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            _user: user,
            action: 'LOGIN',
            entity_type: 'system',
            entity_id: null,
            details: { message: 'User logged in' }
          })
        });
      } catch (err) {
        console.error("Failed to log login event:", err);
      }

      onLogin(user);
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-charcoal-gray/10 p-8 md:p-12"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-28 h-28 bg-white rounded-[1.5rem] flex items-center justify-center mb-4 shadow-lg shadow-deep-navy/10 overflow-hidden border border-charcoal-gray/10">
            <img src="/purokalusugan-logo.png" alt="PuroKalusugan Logo" className="w-full h-full object-contain scale-110" referrerPolicy="no-referrer" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight"><span className="text-[#FDB913]">Puro</span><span className="text-[#ED1C24]">Kalusugan</span></h1>
          <p className="text-blue-slate text-sm mt-2 font-medium uppercase tracking-widest">Ilocos Sur Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-charcoal-gray uppercase tracking-wider">Username / Municipality</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-slate">
                <User size={18} />
              </div>
              <select
                className="w-full pl-12 pr-4 py-3.5 bg-mint-cream border border-charcoal-gray/10 rounded-2xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none transition-all appearance-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              >
                <option value="">Select Municipality, Admin, or Viewer</option>
                <option value="PDOHO Admin">PDOHO Admin</option>
                <option value="Provincial Viewer">Provincial Viewer</option>
                {MUNICIPALITIES.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-charcoal-gray uppercase tracking-wider">Password</label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-slate">
                <Lock size={18} />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-3.5 bg-mint-cream border border-charcoal-gray/10 rounded-2xl focus:ring-2 focus:ring-health-blue/20 focus:border-health-blue outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-4 rounded-2xl border border-red-100"
            >
              <AlertCircle size={18} />
              <span className="font-medium">{error}</span>
            </motion.div>
          )}

          <button
            type="submit"
            className="w-full bg-deep-navy text-white py-4 rounded-2xl font-bold shadow-lg shadow-deep-navy/20 hover:bg-soft-navy-blue transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Sign In
          </button>
        </form>

        <div className="mt-10 text-center">
          <p className="text-xs text-blue-slate font-medium leading-relaxed">
            Provincial Department of Health Office<br />
            Ilocos Sur Health Information System
          </p>
        </div>
      </motion.div>
    </div>
  );
}
