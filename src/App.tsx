/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ServerState } from './types.js';
import AdminPanel from './components/AdminPanel.jsx';
import SpectatorPanel from './components/SpectatorPanel.jsx';
import { 
  Trophy, 
  Settings, 
  Tv, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  User,
  LogIn
} from 'lucide-react';

export default function App() {
  const [role, setRole] = useState<'spectator' | 'admin'>('spectator');
  const [state, setState] = useState<ServerState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Administrator Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('isAdminAuthenticated') === 'true';
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const isLocalDb = typeof window !== 'undefined' && !!(window as any).isBwfMockActive;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginUsername.trim() === 'ichromn' && loginPassword === 'PerumPemdaP55#') {
      setIsAdminAuthenticated(true);
      localStorage.setItem('isAdminAuthenticated', 'true');
      setLoginError('');
      setSuccessMsg("Selamat datang, pengelola Ichromn! Berhasil masuk.");
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError("Username atau password salah!");
    }
  };

  // Poll the backend to get the latest state every 1500ms
  const fetchState = async (showLoading = false) => {
    if (showLoading) setIsRefreshing(true);
    try {
      const res = await fetch('/api/state');
      if (!res.ok) {
        throw new Error("Gagal mengambil data dari server.");
      }
      const data = await res.json();
      setState(data);
      setIsLoading(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Koneksi ke server terputus. Mencoba menghubungkan kembali...");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(() => {
      fetchState();
    }, 1500); // Poll fast for high real-time responsiveness

    return () => clearInterval(interval);
  }, []);

  // Auto-clear success/error messages after 6 seconds
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  if (isLoading || !state) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-800 p-6" id="app-loading">
        <div className="space-y-4 text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-emerald-600 mx-auto" />
          <h2 className="font-extrabold text-lg tracking-tight">Memuat Sistem Bulutangkis...</h2>
          <p className="text-xs text-slate-500">Menghubungkan ke server pengelola turnamen real-time</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mesh text-slate-800 flex flex-col font-sans" id="app-root">
      
      {/* GLOBAL NAVBAR / HEADER */}
      <header className="bg-white/80 backdrop-blur-md text-slate-900 border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo brand - SmashControl theme */}
          <div className="flex items-center gap-3 font-display">
            <div className="p-2 bg-emerald-500 rounded-lg text-white shadow-[0_2px_10px_rgba(16,185,129,0.3)] flex items-center justify-center">
              <Trophy className="w-5 h-5 fill-white stroke-none" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter uppercase italic text-slate-900 leading-none">
                BWF<span className="text-emerald-500 underline decoration-2 underline-offset-4"> TOURNAMENT</span>
              </h1>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest font-mono font-bold block mt-1">by Ichromn</span>
            </div>
          </div>

          {/* Quick status controls */}
          <div className="flex items-center gap-3">
            {/* Active tournament indicator */}
            <span className={`hidden sm:inline-flex items-center gap-2 text-[10px] font-mono px-3.5 py-1.5 rounded-full shadow-sm ${
              isLocalDb 
                ? 'text-amber-700 bg-amber-50 border border-amber-200' 
                : 'text-emerald-600 bg-emerald-50 border border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${isLocalDb ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isLocalDb ? 'API: LOCAL DATABASE' : 'API: CONNECTED'}
            </span>

            {/* Manual refresh state button */}
            <button
              onClick={() => fetchState(true)}
              className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
              title="Refresh Data"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
            </button>

            {/* PERSISTENT VIEW SELECTOR ROLE */}
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 border border-slate-200 rounded-lg">
                <button
                  onClick={() => setRole('spectator')}
                  className={`py-1.5 px-3 text-xs font-mono font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${
                    role === 'spectator'
                      ? 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Tv className="w-3.5 h-3.5" /> PENONTON
                </button>
                <button
                  onClick={() => setRole('admin')}
                  className={`py-1.5 px-3 text-xs font-mono font-bold rounded transition-all flex items-center gap-1 cursor-pointer ${
                    role === 'admin'
                      ? 'bg-indigo-600 text-white shadow-[0_2px_8px_rgba(99,102,241,0.25)]'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" /> PENGELOLA
                </button>
              </div>

              {isAdminAuthenticated && (
                <button
                  onClick={() => {
                    setIsAdminAuthenticated(false);
                    localStorage.removeItem('isAdminAuthenticated');
                    setRole('spectator');
                    setSuccessMsg("Berhasil keluar dari mode pengelola.");
                  }}
                  className="py-1.5 px-3 text-xs font-mono font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all cursor-pointer"
                  title="Keluar dari Akun Pengelola"
                >
                  KELUAR
                </button>
              )}
            </div>

          </div>

        </div>
      </header>

      {/* DYNAMIC GLOBAL NOTIFICATION TOAST BOX */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 mt-4">
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg shadow-sm flex items-center justify-between text-xs font-mono font-medium animate-fadeIn">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-850 p-3 rounded-lg shadow-sm flex items-center justify-between text-xs font-mono font-medium animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* MAIN LAYOUT CANVAS */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {role === 'spectator' ? (
          <SpectatorPanel serverState={state} />
        ) : !isAdminAuthenticated ? (
          <div className="max-w-md mx-auto my-12 animate-fadeIn" id="admin-login-view">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xl space-y-6">
              
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mx-auto border border-indigo-150 shadow-sm">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="font-display font-bold text-slate-800 text-lg uppercase tracking-wide">LOGIN PENGELOLA BWF</h2>
                <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">Silakan masuk untuk mengelola skor dan bagan turnamen</p>
              </div>

              {loginError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-lg text-xs font-mono font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs font-mono">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Username</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="text" 
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      placeholder="Masukkan username pengelola"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="password" 
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Masukkan password"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-display font-bold text-xs tracking-wider uppercase rounded-xl transition-all shadow-md hover:shadow-indigo-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" /> MASUK KE PANEL
                </button>
              </form>

              <div className="border-t border-slate-100 pt-4 text-center">
                <p className="text-[10px] text-slate-400 leading-relaxed font-mono">
                  Sistem Autentikasi Pengelola Terenkripsi. <br />
                  Hubungi penanggung jawab jika Anda lupa kredensial login.
                </p>
              </div>

            </div>
          </div>
        ) : (
          <AdminPanel 
            serverState={state} 
            onRefresh={fetchState} 
            setError={setErrorMsg} 
            setSuccess={setSuccessMsg} 
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white/40 py-6 mt-12 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-xs tracking-wide">
            Copyright © 2026  by Ichrom - 081238888644 - <a href="https://www.instagram.com/ariichroman" target="_blank" rel="noopener noreferrer" className="hover:text-emerald-600 hover:underline transition-colors underline-offset-2">IG: ariichroman</a>
          </p>
          <div className="flex gap-2">
            <div className="w-8 h-1.5 bg-emerald-500 rounded-full"></div>
            <div className="w-8 h-1.5 bg-indigo-500 rounded-full"></div>
            <div className="w-8 h-1.5 bg-slate-200 rounded-full"></div>
          </div>
        </div>
      </footer>

    </div>
  );
}
