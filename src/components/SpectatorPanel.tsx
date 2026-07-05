/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { 
  ServerState, 
  Match, 
  BracketNode, 
  Player, 
  MatchNotification 
} from '../types.js';
import { apiFetch as fetch } from '../mockApi';
import { 
  Trophy, 
  Activity, 
  Tv, 
  Award, 
  TrendingUp, 
  Calendar, 
  Volume2, 
  Bell, 
  History, 
  ChevronRight,
  ShieldAlert,
  MessageSquare,
  Send,
  MessageCircle,
  Sparkles,
  Users,
  Clock,
  X,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SpectatorPanelProps {
  serverState: ServerState;
}

export default function SpectatorPanel({ serverState }: SpectatorPanelProps) {
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'schedule' | 'bracket' | 'history' | 'stats'>('scoreboard');
  const [toastNotif, setToastNotif] = useState<MatchNotification | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);

  // Match Schedule Filters State
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'all' | 'scheduled' | 'live' | 'completed'>('all');
  const [scheduleRoundFilter, setScheduleRoundFilter] = useState<string>('all');

  // Sidebar Tabs & Commentary State
  const [sidebarTab, setSidebarTab] = useState<'logs' | 'comments'>('logs');
  const [commentNickname, setCommentNickname] = useState('');
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState('');

  // Monitor latest notification to show spectacular popup toast alerts
  useEffect(() => {
    if (serverState.notifications.length > 0) {
      const latest = serverState.notifications[0];
      // Only trigger beautiful popups for significant events: set completes, match completes, or system alerts
      if (latest.type === 'set_complete' || latest.type === 'match_complete' || latest.type === 'system') {
        setToastNotif(latest);
        const timer = setTimeout(() => {
          setToastNotif(null);
        }, 5000); // clear toast after 5s
        return () => clearTimeout(timer);
      }
    }
  }, [serverState.notifications]);

  const tournaments = serverState.tournaments || [];
  const activeTournamentIdFromServer = serverState.activeTournamentId;

  // Default to active tournament if local state is not set or not in list
  const currentViewingTournamentId = selectedTournamentId && tournaments.some(t => t.id === selectedTournamentId)
    ? selectedTournamentId
    : activeTournamentIdFromServer;

  const currentTournament = tournaments.find(t => t.id === currentViewingTournamentId) || tournaments[0] || {
    id: activeTournamentIdFromServer,
    name: "Turnamen Utama Court 01",
    drawSize: 8,
    playerIds: serverState.players.map(p => p.id),
    matches: serverState.matches,
    brackets: serverState.brackets,
    customDate: undefined
  };

  const matchesToRender = currentTournament.matches || [];
  const bracketsToRender = currentTournament.brackets || [];

  // Find the first scheduled match id to highlight it as "Next Up"
  const firstScheduledMatchId = (matchesToRender.find(m => m.status === 'scheduled'))?.id || null;

  // Filter matches based on schedule filters
  const filteredMatches = matchesToRender.filter(match => {
    const matchesStatus = scheduleStatusFilter === 'all' || match.status === scheduleStatusFilter;
    const matchesRound = scheduleRoundFilter === 'all' || match.round === scheduleRoundFilter;
    return matchesStatus && matchesRound;
  });

  const liveMatch = matchesToRender.find(m => m.status === 'live');
  const completedMatches = matchesToRender.filter(m => m.status === 'completed');

  // Sort players for stats leaderboard
  // Only use players participating in the selected tournament
  const tournamentPlayers = serverState.players.filter(p => 
    currentTournament.playerIds ? currentTournament.playerIds.includes(p.id) : true
  );

  const sortedPlayers = [...tournamentPlayers].sort((a, b) => {
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
    return b.pointsWon - a.pointsWon;
  });

  // Organize bracket nodes into rounds
  const roundsMap = bracketsToRender.reduce((acc, node) => {
    const roundIdx = node.roundIndex;
    if (!acc[roundIdx]) acc[roundIdx] = [];
    acc[roundIdx].push(node);
    return acc;
  }, {} as Record<number, BracketNode[]>);

  // Order rounds from highest roundIndex (first round) to lowest 0 (finals)
  const orderedRoundIndexes = Object.keys(roundsMap)
    .map(Number)
    .sort((a, b) => b - a);

  // Function to render score banner
  const renderLiveScoreCard = () => {
    if (!liveMatch) {
      // Find latest completed match to show as hero
      const latestCompleted = completedMatches.length > 0 ? completedMatches[completedMatches.length - 1] : null;

      return (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-md text-center relative overflow-hidden" id="scoreboard-hero">
          {/* Decorative court lines background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none border-[12px] border-emerald-500 m-4 animate-pulse" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-emerald-500/10 pointer-events-none" />

          {latestCompleted ? (
            <div className="relative z-10 space-y-5">
              <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono font-bold px-4 py-1.5 rounded-full uppercase tracking-wider">
                <Trophy className="w-3.5 h-3.5 text-emerald-600" /> PERTANDINGAN TERAKHIR SELESAI
              </div>
              <h3 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest">{latestCompleted.round}</h3>
              
              <div className="flex justify-center items-center gap-10 py-6">
                <div className="text-right">
                  <p className="text-2xl font-display font-black text-slate-900 tracking-tight">{latestCompleted.player1Name}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase">SGS Bandung</p>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-mono font-bold text-slate-600 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded mb-2 shadow-inner">VS</span>
                  <div className="flex gap-2 font-mono text-lg font-extrabold text-emerald-600">
                    {latestCompleted.scores.map((set, idx) => (
                      <span key={idx} className="bg-white px-3 py-1.5 rounded border border-slate-200 shadow-sm text-slate-800">
                        {set.p1}-{set.p2}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-left">
                  <p className="text-2xl font-display font-black text-slate-900 tracking-tight">{latestCompleted.player2Name}</p>
                  <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase">PB Tangkas</p>
                </div>
              </div>

              <div className="text-sm text-slate-600 font-mono font-semibold">
                PEMENANG: <span className="text-amber-600 font-black">🏆 {latestCompleted.winnerId === latestCompleted.player1Id ? latestCompleted.player1Name : latestCompleted.player2Name}</span>
              </div>
            </div>
          ) : (
            <div className="relative z-10 py-12 space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400 border border-slate-200 shadow-inner">
                <Tv className="w-8 h-8 animate-pulse text-emerald-500" />
              </div>
              <h3 className="text-lg font-display font-black tracking-wider text-slate-900 uppercase">MENUNGGU PERTANDINGAN LIVE</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Silakan hubungi administrator di panel <b className="text-emerald-600">Layar Pengelola</b> untuk melakukan pengundian bagan turnamen secara acak dan memulai pertandingan aktif.
              </p>
            </div>
          )}
        </div>
      );
    }

    // A live match is running - Draw active Scoreboard with real-time updates!
    const activeSetIdx = liveMatch.currentSet - 1;
    const currentScore = liveMatch.scores[activeSetIdx] || { p1: 0, p2: 0 };

    return (
      <div className="bg-white rounded-2xl border-2 border-emerald-500 shadow-xl relative overflow-hidden" id="live-scoreboard-screen">
        {/* Dynamic Glowing Court Top Bar */}
        <div className="bg-gradient-to-r from-emerald-600 via-emerald-500 to-indigo-600 px-6 py-3 text-white flex justify-between items-center relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
            <span className="font-bold text-xs uppercase tracking-widest font-sans">Papan Skor Utama (Real-Time)</span>
          </div>
          <div className="bg-slate-950/40 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-white/10">
            {liveMatch.round} • SET {liveMatch.currentSet}
          </div>
        </div>

        {/* Court Canvas Area with Net in Middle (Compact Layout) */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-11 gap-3 bg-gradient-to-b from-slate-50 via-white to-slate-50 relative min-h-[200px]">
          
          {/* Decorative Court Grid lines */}
          <div className="absolute inset-0 pointer-events-none border-[8px] border-emerald-100 m-4 opacity-70" />
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-emerald-500/10 pointer-events-none" />

          {/* LEFT PLAYER: Player 1 */}
          <div className="md:col-span-5 flex flex-col justify-between items-center text-center p-3 relative z-10 bg-slate-100/40 rounded-lg border border-slate-200">
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Men's Double 1</span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5 truncate max-w-[220px]" title={liveMatch.player1Name}>{liveMatch.player1Name}</h2>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mt-1 inline-block">SGS Bandung</span>
            </div>

            {/* Shrunk Score Display with animation */}
            <div className="my-2">
              <motion.div 
                key={currentScore.p1}
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="text-6xl font-black font-mono text-slate-900 tracking-tighter filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
              >
                {currentScore.p1}
              </motion.div>
            </div>

            {/* Historical game markers */}
            <div className="flex gap-1 mt-1">
              {liveMatch.scores.map((set, idx) => (
                <span 
                  key={idx} 
                  className={`text-[10px] px-2 py-0.5 font-mono font-bold rounded ${
                    set.p1 > set.p2 
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                      : 'bg-slate-200 text-slate-450'
                  }`}
                >
                  G{idx + 1}: {set.p1}
                </span>
              ))}
            </div>
          </div>

          {/* MIDDLE: Court Net & Status Indicator */}
          <div className="md:col-span-1 flex flex-col justify-center items-center text-center relative z-10 min-h-[50px] md:min-h-0">
            <div className="h-full w-1 bg-gradient-to-b from-emerald-500/20 via-emerald-200 to-emerald-500/20 rounded hidden md:block relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border border-emerald-200 px-2 py-0.5 rounded text-[8px] font-bold text-emerald-500 rotate-90 uppercase tracking-wider shadow-sm">
                NET
              </div>
            </div>
            <div className="bg-white border border-slate-150 px-2.5 py-1 rounded flex md:hidden items-center justify-center gap-1 text-[9px] text-slate-500 font-bold shadow-sm">
              <span>NET</span>
            </div>
          </div>

          {/* RIGHT PLAYER: Player 2 */}
          <div className="md:col-span-5 flex flex-col justify-between items-center text-center p-3 relative z-10 bg-slate-100/40 rounded-lg border border-slate-200">
            <div>
              <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Men's Double 2</span>
              <h2 className="text-lg font-black text-slate-900 mt-0.5 truncate max-w-[220px]" title={liveMatch.player2Name}>{liveMatch.player2Name}</h2>
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full mt-1 inline-block">PB Tangkas</span>
            </div>

            {/* Shrunk Score Display with animation */}
            <div className="my-2">
              <motion.div 
                key={currentScore.p2}
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="text-6xl font-black font-mono text-slate-900 tracking-tighter filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.05)]"
              >
                {currentScore.p2}
              </motion.div>
            </div>

            {/* Historical game markers */}
            <div className="flex gap-1 mt-1">
              {liveMatch.scores.map((set, idx) => (
                <span 
                  key={idx} 
                  className={`text-[10px] px-2 py-0.5 font-mono font-bold rounded ${
                    set.p2 > set.p1 
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' 
                      : 'bg-slate-200 text-slate-450'
                  }`}
                >
                  G{idx + 1}: {set.p2}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom scoreboard bar */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2 relative z-10">
          <div className="flex items-center gap-1">
            <Volume2 className="w-4 h-4 text-emerald-600" />
            <span>Update status secara berkala via API disalurkan langsung.</span>
          </div>
          <div className="flex gap-2">
            <span className="px-2.5 py-1 bg-white rounded border border-slate-200 font-bold text-slate-700">Set 1: {liveMatch.scores[0]?.p1 ?? 0}-{liveMatch.scores[0]?.p2 ?? 0}</span>
            {liveMatch.currentSet >= 2 && <span className="px-2.5 py-1 bg-white rounded border border-slate-200 font-bold text-slate-700">Set 2: {liveMatch.scores[1]?.p1 ?? 0}-{liveMatch.scores[1]?.p2 ?? 0}</span>}
            {liveMatch.currentSet >= 3 && <span className="px-2.5 py-1 bg-white rounded border border-slate-200 font-bold text-slate-700">Set 3: {liveMatch.scores[2]?.p1 ?? 0}-{liveMatch.scores[2]?.p2 ?? 0}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" id="spectator-panel-container">
      
      {/* 1. SCROLLING MARQUEE OF LIVE MATCH RESULTS */}
      <div className="bg-emerald-50/60 text-emerald-800 border-y border-emerald-100 py-3 overflow-hidden relative" id="ticker-marquee">
        <div className="absolute left-0 inset-y-0 bg-gradient-to-r from-slate-50 to-transparent w-16 z-10 pointer-events-none" />
        <div className="absolute right-0 inset-y-0 bg-gradient-to-l from-slate-50 to-transparent w-16 z-10 pointer-events-none" />
        
        <div className="flex whitespace-nowrap animate-marquee items-center gap-8 font-mono text-xs tracking-wider">
          <span className="flex items-center gap-1.5 text-emerald-700 font-bold"><Tv className="w-4 h-4 text-emerald-600" /> TICKER:</span>
          {serverState.runningText ? (
            <span className="text-emerald-950 font-bold px-2">{serverState.runningText}</span>
          ) : serverState.notifications.length > 0 ? (
            serverState.notifications.slice(0, 5).map((notif, index) => (
              <span key={index} className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {notif.message}
              </span>
            ))
          ) : (
            <span className="italic text-emerald-600/70">Belum ada aktivitas pertandingan baru. Menunggu sistem pengundian.</span>
          )}
          {/* Duplicate to ensure seamless scroll */}
          <span className="text-emerald-600 font-bold">||</span>
          {serverState.runningText ? (
            <span className="text-emerald-950 font-bold px-2">{serverState.runningText}</span>
          ) : serverState.notifications.length > 0 && 
            serverState.notifications.slice(0, 5).map((notif, index) => (
              <span key={`dup-${index}`} className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {notif.message}
              </span>
            ))
          }
        </div>
      </div>

      {/* TOURNAMENT SELECTOR & PREMIUM REGISTRATION HUB */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-white relative overflow-hidden flex flex-col lg:flex-row items-stretch justify-between gap-6" id="spectator-tournament-hub">
        
        {/* Glow ambient effects */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Left Side: Tournament Header & Info */}
        <div className="flex flex-col justify-between space-y-4 flex-1 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                Turnamen Aktif
              </span>
              
              {currentViewingTournamentId === activeTournamentIdFromServer && (
                <span className="px-2.5 py-1 bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase animate-pulse">
                  ⚡ LIVE REFEREE
                </span>
              )}
            </div>

            <h2 className="font-display font-black text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300 tracking-tight leading-tight mt-3">
              {currentTournament.name}
            </h2>
            
            <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-xl">
              Turnamen resmi bulutangkis dengan sistem perolehan skor real-time dan braket otomatis.
            </p>
          </div>

          {/* Quick tournament statistics / metadata */}
          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-800/60 text-slate-300">
            <div className="flex items-center gap-2 text-xs font-medium bg-slate-850/60 px-3 py-1.5 rounded-lg border border-slate-800/40">
              <Calendar className="w-4 h-4 text-emerald-400" />
              <span>{currentTournament.customDate || "Hari Ini"}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium bg-slate-850/60 px-3 py-1.5 rounded-lg border border-slate-800/40">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>{currentTournament.drawSize} Atlet Berlaga</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium bg-slate-850/60 px-3 py-1.5 rounded-lg border border-slate-800/40">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Sistem BWF</span>
            </div>
          </div>

          {/* Tournament Dropdown styled cleanly with glassmorphism */}
          <div className="flex items-center gap-3 pt-2">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Lihat Turnamen Lain:</span>
            <div className="relative">
              <select
                value={currentViewingTournamentId || ""}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="appearance-none bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-white font-mono font-bold py-2 px-4 pr-8 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-md"
              >
                {tournaments.map((t) => (
                  <option key={t.id} value={t.id} className="bg-slate-950 text-white">
                    {t.name} ({t.drawSize} Atlet) {t.id === activeTournamentIdFromServer ? " [LIVE]" : ""}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Beautiful Ticket/Registration Banner */}
        {serverState.registrationClosed ? (
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-rose-500/20 hover:border-rose-500/30 p-5 md:p-6 rounded-2xl flex flex-col justify-center items-center lg:items-end text-center lg:text-right gap-3 lg:w-80 relative z-10 shrink-0 shadow-xl transition-all duration-300">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase">
              <Lock className="w-3 h-3 text-rose-500 animate-pulse" />
              Pendaftaran Ditutup
            </div>
            
            <div className="space-y-1">
              <h4 className="font-display font-black text-base text-white tracking-wide">
                Registrasi Ditutup
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-[240px]">
                Pendaftaran peserta untuk turnamen saat ini telah resmi ditutup oleh pengelola. Nantikan turnamen berikutnya!
              </p>
            </div>

            {/* Disabled Closed Button */}
            <div
              className="w-full bg-slate-800 text-slate-400 font-display font-black text-xs py-3 px-5 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest border border-slate-700 select-none"
              id="registration-closed-banner-button"
            >
              <Lock className="w-4 h-4" />
              REGISTRASI TUTUP
            </div>

            <div className="text-[9px] text-slate-500 font-mono mt-1">
              Hubungi pengelola untuk info lebih lanjut
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-emerald-500/20 hover:border-emerald-500/30 p-5 md:p-6 rounded-2xl flex flex-col justify-center items-center lg:items-end text-center lg:text-right gap-3 lg:w-80 relative z-10 shrink-0 shadow-xl transition-all duration-300">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[9px] font-mono font-bold tracking-wider uppercase">
              <Sparkles className="w-3 h-3 animate-pulse" />
              Pendaftaran Dibuka
            </div>
            
            <div className="space-y-1">
              <h4 className="font-display font-black text-base text-white tracking-wide">
                Ingin Ikut Bertanding?
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-[240px]">
                Daftarkan diri Anda atau tim ganda Anda sekarang untuk mengamankan slot rilis berikutnya!
              </p>
            </div>

            {/* Golden/Emerald WhatsApp Button with Glowing Animation */}
            <a
              href="https://wa.me/6281238888644?text=Halo%20Admin%20BWF%20Sistem%2C%20saya%20ingin%20mendaftar%20turnamen%20bulutangkis%20terbaru"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-500 hover:from-emerald-400 hover:via-emerald-500 hover:to-green-400 text-white font-display font-black text-xs py-3 px-5 rounded-xl flex items-center justify-center gap-2 uppercase tracking-widest transition-all duration-300 shadow-[0_4px_15px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_25px_rgba(16,185,129,0.45)] hover:-translate-y-0.5 active:translate-y-0 cursor-pointer border border-emerald-400/20"
              id="whatsapp-registration-button"
              title="Daftar Turnamen Lewat WhatsApp"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              DAFTAR SEKARANG
            </a>

            <div className="text-[9px] text-slate-500 font-mono mt-1">
              Melalui WA: 0812-3888-8644
            </div>
          </div>
        )}

      </div>

      {/* 2. TABBED NAVIGATION */}
      <div className="flex bg-white p-1.5 rounded-xl border border-slate-200 gap-1.5 shadow-sm overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('scoreboard')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-display font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'scoreboard'
              ? 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Tv className="w-4 h-4" /> PAPAN SKOR LIVE
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-display font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'schedule'
              ? 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Calendar className="w-4 h-4" /> JADWAL LAGA
        </button>
        <button
          onClick={() => setActiveTab('bracket')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-display font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'bracket'
              ? 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Trophy className="w-4 h-4" /> BRAKET BAGAN
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-display font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <History className="w-4 h-4" /> RIWAYAT LAGA
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-display font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'stats'
              ? 'bg-emerald-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)]'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> STATISTIK ATLET
        </button>
      </div>

      {/* 3. DYNAMIC CONTENT VIEWER */}
      <div className="min-h-[400px]">
        {/* TAB 1: SCOREBOARD */}
        {activeTab === 'scoreboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
            {/* Main digital scoreboard display */}
            <div className="lg:col-span-8 space-y-6">
              {/* YouTube Live Stream Embed Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md space-y-4" id="youtube-embed-card">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 bg-rose-600 rounded-full animate-pulse" />
                    <h3 className="font-display font-bold text-slate-800 text-sm uppercase tracking-wide">
                      Siaran Langsung & Sorotan Video
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded font-bold">
                    YOUTUBE BWF
                  </span>
                </div>
                
                <div className="aspect-video w-full rounded-xl overflow-hidden shadow-lg border border-slate-200 bg-slate-950 relative">
                  <iframe
                    src={(() => {
                      const rawUrl = serverState.youtubeUrl || "https://www.youtube.com/embed/Y-Ony4RveD4";
                      if (!rawUrl) return "";
                      const trimmed = rawUrl.trim();
                      if (trimmed.toLowerCase().includes('<iframe')) {
                        const srcMatch = trimmed.match(/src="([^"]+)"/i);
                        if (srcMatch && srcMatch[1]) return srcMatch[1];
                      }
                      if (trimmed.includes('youtube.com/watch')) {
                        try {
                          const url = new URL(trimmed);
                          const v = url.searchParams.get('v');
                          if (v) return `https://www.youtube.com/embed/${v}`;
                        } catch (e) {}
                      }
                      if (trimmed.includes('youtu.be/')) {
                        const parts = trimmed.split('youtu.be/');
                        const idAndQuery = parts[1]?.split('?');
                        const id = idAndQuery ? idAndQuery[0] : null;
                        if (id) return `https://www.youtube.com/embed/${id}`;
                      }
                      if (trimmed.includes('youtube.com/embed/')) {
                        return trimmed;
                      }
                      if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
                        return `https://www.youtube.com/embed/${trimmed}`;
                      }
                      return trimmed;
                    })()}
                    title="YouTube Live Match Stream"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full"
                  />
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <p>Menampilkan tayangan langsung atau highlight pertandingan resmi.</p>
                  <span className="text-[10px] font-mono text-slate-400">Powered by BWF TV</span>
                </div>
              </div>

              {renderLiveScoreCard()}

              {/* Tournament status helper */}
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                <h4 className="font-display font-bold text-slate-800 text-sm tracking-wide mb-4 flex items-center gap-2">
                  <Activity className="w-4.5 h-4.5 text-emerald-600" /> RINGKASAN PROGRES TURNAMEN
                </h4>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <span className="text-3xl font-display font-black text-slate-900 block">
                      {tournamentPlayers.length}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Total Atlet</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <span className="text-3xl font-display font-black text-emerald-600 block">
                      {matchesToRender.filter(m => m.status === 'completed').length}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Laga Selesai</span>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <span className="text-3xl font-display font-black text-indigo-600 block">
                      {matchesToRender.filter(m => m.status === 'live').length}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">Laga Live</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notification logs center */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[500px] flex flex-col justify-between">
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Dual Sub-Tabs */}
                  <div className="flex border-b border-slate-100 pb-2 mb-3 items-center justify-between">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSidebarTab('logs')}
                        className={`text-xs font-display font-bold py-1 px-2.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                          sidebarTab === 'logs'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            : 'text-slate-500 hover:text-slate-800 border border-transparent'
                        }`}
                      >
                        <Bell className="w-3.5 h-3.5" /> Log Laga
                      </button>
                      <button
                        type="button"
                        onClick={() => setSidebarTab('comments')}
                        className={`text-xs font-display font-bold py-1 px-2.5 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                          sidebarTab === 'comments'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            : 'text-slate-500 hover:text-slate-800 border border-transparent'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" /> Komentar ({serverState.comments?.length || 0})
                      </button>
                    </div>
                    <span className="bg-indigo-50/50 text-indigo-700 text-[8px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider animate-pulse">LIVE</span>
                  </div>

                  {sidebarTab === 'logs' ? (
                    /* Scroller for latest events */
                    <div className="space-y-2.5 overflow-y-auto flex-1 pr-1" id="notifications-scroller" style={{ maxHeight: '380px' }}>
                      {serverState.notifications.map((notif) => {
                        let typeColor = 'bg-slate-50 text-slate-600 border-slate-200';
                        if (notif.type === 'score') typeColor = 'bg-emerald-50/60 text-emerald-800 border-emerald-100';
                        if (notif.type === 'set_complete') typeColor = 'bg-indigo-50/60 text-indigo-800 border-indigo-100';
                        if (notif.type === 'match_complete') typeColor = 'bg-amber-50/60 text-amber-800 border-amber-100';
                        if (notif.type === 'system') typeColor = 'bg-rose-50/60 text-rose-850 border-rose-100';

                        return (
                          <div key={notif.id} className={`p-3 rounded-lg border text-xs leading-relaxed transition-all ${typeColor}`}>
                            <div className="flex justify-between items-center gap-1 mb-1.5">
                              <span className="font-mono font-bold uppercase text-[9px] tracking-widest opacity-80">{notif.type.replace('_', ' ')}</span>
                              <span className="text-[9px] text-slate-400 font-mono">{notif.timestamp}</span>
                            </div>
                            <p className="font-medium text-slate-700">{notif.message}</p>
                          </div>
                        );
                      })}
                      {serverState.notifications.length === 0 && (
                        <p className="text-xs text-slate-400 text-center py-16 font-mono italic">
                          Belum ada riwayat log.
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Comments Panel */
                    <div className="flex flex-col h-full justify-between overflow-hidden">
                      {/* Comments Scrollable List */}
                      <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 mb-3" style={{ maxHeight: '250px' }}>
                        {serverState.comments && serverState.comments.length > 0 ? (
                          serverState.comments.map((comment) => (
                            <div key={comment.id} className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg text-xs space-y-1 animate-fadeIn">
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${comment.avatarColor || 'from-indigo-500 to-purple-500'} flex items-center justify-center text-[8px] text-white font-mono font-bold shrink-0`}>
                                    {comment.author.substring(0, 1).toUpperCase()}
                                  </div>
                                  <span className="font-bold text-slate-800 truncate max-w-[120px]">{comment.author}</span>
                                </div>
                                <span className="text-[8px] text-slate-400 font-mono">{comment.timestamp}</span>
                              </div>
                              <p className="text-slate-650 leading-relaxed pl-5 font-sans break-words">{comment.text}</p>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 text-slate-400 font-mono italic">
                            <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                            Belum ada komentar. Jadilah yang pertama memberikan semangat!
                          </div>
                        )}
                      </div>

                      {/* Comment Input Form */}
                      <div className="border-t border-slate-100 pt-2.5 space-y-1.5 shrink-0">
                        {commentError && (
                          <p className="text-[9px] text-rose-500 font-mono">{commentError}</p>
                        )}
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            placeholder="Nama/Nickname..."
                            value={commentNickname}
                            onChange={(e) => setCommentNickname(e.target.value)}
                            disabled={isSubmittingComment}
                            maxLength={20}
                            className="w-1/3 text-[10px] p-1.5 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-sans"
                          />
                          <div className="relative flex-1">
                            <input
                              type="text"
                              placeholder="Komentar Anda..."
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              disabled={isSubmittingComment}
                              maxLength={100}
                              onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (!commentText.trim()) return;
                                  setIsSubmittingComment(true);
                                  setCommentError('');
                                  try {
                                    const res = await fetch('/api/comments', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({
                                        author: commentNickname,
                                        text: commentText
                                      })
                                    });
                                    if (res.ok) {
                                      setCommentText('');
                                    } else {
                                      const err = await res.json();
                                      setCommentError(err.error || 'Gagal mengirim komentar.');
                                    }
                                  } catch (err) {
                                    setCommentError('Error koneksi.');
                                  } finally {
                                    setIsSubmittingComment(false);
                                  }
                                }
                              }}
                              className="w-full text-[10px] p-1.5 pr-8 border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-sans"
                            />
                            <button
                              type="button"
                              disabled={isSubmittingComment || !commentText.trim()}
                              onClick={async () => {
                                if (!commentText.trim()) return;
                                setIsSubmittingComment(true);
                                setCommentError('');
                                try {
                                  const res = await fetch('/api/comments', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      author: commentNickname,
                                      text: commentText
                                    })
                                  });
                                  if (res.ok) {
                                    setCommentText('');
                                  } else {
                                    const err = await res.json();
                                    setCommentError(err.error || 'Gagal mengirim komentar.');
                                  }
                                } catch (err) {
                                  setCommentError('Error koneksi.');
                                } finally {
                                  setIsSubmittingComment(false);
                                }
                              }}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-emerald-600 hover:text-emerald-500 disabled:text-slate-300 transition-colors bg-transparent border-none cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: MATCH SCHEDULE / JADWAL PERTANDINGAN */}
        {activeTab === 'schedule' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn" id="match-schedule-tab">
            <div className="border-b border-slate-200 pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-lg tracking-wide flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" /> JADWAL PERTANDINGAN
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5 uppercase">DAFTAR PERTANDINGAN DAN ESTIMASI WAKTU MULAI</p>
              </div>
              
              {/* Filter controls */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={scheduleStatusFilter}
                  onChange={(e) => setScheduleStatusFilter(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 text-xs font-mono font-bold py-1.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">Semua Status</option>
                  <option value="scheduled">Mendatang</option>
                  <option value="live">Live</option>
                  <option value="completed">Selesai</option>
                </select>
                
                <select
                  value={scheduleRoundFilter}
                  onChange={(e) => setScheduleRoundFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-xs font-mono font-bold py-1.5 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="all">Semua Babak</option>
                  {Array.from(new Set(matchesToRender.map(m => m.round))).map(round => (
                    <option key={round} value={round}>{round}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Schedule Cards/Timeline */}
            {filteredMatches.length > 0 ? (
              <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6">
                {filteredMatches.map((match) => {
                  const isLive = match.status === 'live';
                  const isCompleted = match.status === 'completed';
                  const isScheduled = match.status === 'scheduled';
                  
                  // Next up match identification
                  const isNextUp = isScheduled && match.id === firstScheduledMatchId;

                  return (
                    <div key={match.id} className="relative group">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                        isLive 
                          ? 'border-emerald-500 scale-125 ring-4 ring-emerald-500/20' 
                          : isNextUp 
                            ? 'border-amber-500 scale-110 ring-4 ring-amber-500/20' 
                            : isCompleted 
                              ? 'border-slate-300 bg-slate-100' 
                              : 'border-indigo-400'
                      }`}>
                        {isLive && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />}
                        {isNextUp && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                      </div>

                      {/* Schedule card */}
                      <div className={`p-5 rounded-2xl border transition-all ${
                        isLive 
                          ? 'bg-gradient-to-br from-white to-emerald-50/10 border-emerald-500 shadow-md ring-1 ring-emerald-500/10' 
                          : isNextUp 
                            ? 'bg-gradient-to-br from-white to-amber-50/10 border-amber-300 shadow-sm' 
                            : isCompleted 
                              ? 'bg-slate-50/60 border-slate-200 opacity-75' 
                              : 'bg-white border-slate-200 hover:border-indigo-300 shadow-sm hover:shadow-md'
                      }`}>
                        
                        {/* Card Header Info */}
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                              ID: {match.id.toUpperCase()}
                            </span>
                            <span className="font-sans text-xs font-bold text-slate-600">
                              {match.round}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {isLive && (
                              <span className="inline-flex items-center gap-1 bg-rose-500 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                <span className="w-1.5 h-1.5 bg-white rounded-full" /> LIVE SEKARANG
                              </span>
                            )}
                            {isNextUp && (
                              <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                ⚡ BERIKUTNYA
                              </span>
                            )}
                            {isScheduled && !isNextUp && (
                              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                MENDATANG
                              </span>
                            )}
                            {isCompleted && (
                              <span className="bg-slate-200 text-slate-600 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                SELESAI
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Match content row */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          {/* Player 1 details */}
                          <div className="md:col-span-4 flex items-center justify-between md:justify-end gap-3">
                            <div className="text-left md:text-right">
                              <p className={`font-display font-black text-sm tracking-tight ${
                                isCompleted && match.winnerId === match.player1Id ? 'text-amber-600' : 'text-slate-800'
                              }`}>
                                {match.player1Name || "Belum ditentukan"}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">SGS Bandung</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-700 font-display font-bold text-xs flex items-center justify-center shrink-0">
                              P1
                            </div>
                          </div>

                          {/* VS center badge */}
                          <div className="md:col-span-4 flex flex-col items-center justify-center py-2 bg-slate-50 rounded-xl border border-slate-100">
                            {isLive ? (
                              <div className="text-center">
                                <span className="text-[9px] font-mono font-extrabold text-rose-500 tracking-wider uppercase animate-pulse block mb-1">SKOR REAL-TIME</span>
                                <div className="flex gap-1.5 justify-center font-mono font-black text-xs text-emerald-600">
                                  {match.scores.map((set, sIdx) => (
                                    <span key={sIdx} className="bg-white px-2 py-0.5 rounded border border-slate-250 shadow-sm">
                                      {set.p1}-{set.p2}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : isCompleted ? (
                              <div className="text-center">
                                <span className="text-[9px] font-mono font-extrabold text-slate-500 uppercase tracking-widest block mb-1">SKOR AKHIR</span>
                                <div className="flex gap-1.5 justify-center font-mono font-bold text-xs text-slate-700">
                                  {match.scores.map((set, sIdx) => (
                                    <span key={sIdx} className="bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                                      {set.p1}-{set.p2}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs font-mono font-black text-slate-400 bg-white border border-slate-200 px-2.5 py-1 rounded shadow-inner">
                                VS
                              </span>
                            )}
                          </div>

                          {/* Player 2 details */}
                          <div className="md:col-span-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-700 font-display font-bold text-xs flex items-center justify-center shrink-0">
                              P2
                            </div>
                            <div className="text-left">
                              <p className={`font-display font-black text-sm tracking-tight ${
                                isCompleted && match.winnerId === match.player2Id ? 'text-amber-600' : 'text-slate-800'
                              }`}>
                                {match.player2Name || "Belum ditentukan"}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400 mt-0.5">PB Tangkas</p>
                            </div>
                          </div>
                        </div>

                        {/* Match estimated time / court details */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                          {/* Court location */}
                          <div className="flex items-center gap-1.5 text-slate-500 font-mono">
                            <Tv className="w-3.5 h-3.5 text-slate-400" />
                            <span>Lapangan: <span className="text-slate-700 font-bold">{currentTournament.name.replace("Turnamen Utama", "")}</span></span>
                          </div>

                          {/* Date and time */}
                          <div className="flex items-center gap-3">
                            {match.customDate && (
                              <div className="flex items-center gap-1 text-slate-500 font-mono bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{match.customDate}</span>
                              </div>
                            )}

                            <div className={`flex items-center gap-1.5 font-mono px-2.5 py-1 rounded border ${
                              isLive 
                                ? 'bg-rose-50 text-rose-700 border-rose-200 font-black' 
                                : isNextUp 
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 font-black animate-pulse' 
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {isLive 
                                  ? 'Berlangsung' 
                                  : match.customTime 
                                    ? `Perkiraan Mulai: ${match.customTime} WIB` 
                                    : 'Perkiraan Mulai: TBA'
                                }
                              </span>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 space-y-4">
                <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Calendar className="w-8 h-8 text-slate-350" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-800 text-sm tracking-wide">TIDAK ADA JADWAL PERTANDINGAN</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Tidak ditemukan pertandingan mendatang yang sesuai dengan filter saat ini.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TOURNAMENT BRACKET VISUALIZER */}
        {activeTab === 'bracket' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn" id="bracket-explorer">
            <div className="border-b border-slate-200 pb-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h3 className="font-display font-bold text-slate-800 text-lg tracking-wide">BAGAN ELIMINASI TURNAMEN</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">SISTEM GUGUR TUNGGAL DIKONDISIKAN SECARA OTOMATIS</p>
              </div>
              <span className="bg-emerald-50 text-emerald-700 font-mono text-xs px-3.5 py-1.5 rounded-full border border-emerald-200">
                SINGLE ELIMINATION
              </span>
            </div>

            {bracketsToRender.length > 0 ? (() => {
              const numRounds = orderedRoundIndexes.length;
              const maxMatchesInRound = Math.max(...Object.values(roundsMap).map((nodes: any) => nodes.length), 1);
              const bracketHeight = Math.max(385, maxMatchesInRound * 115);
              const bracketMinWidth = numRounds * 240;

              return (
                <div className="overflow-x-auto pb-4">
                  {/* Horizontal flow of columns */}
                  <div 
                    className="flex items-stretch justify-between gap-8 py-4"
                    style={{ minWidth: `${bracketMinWidth}px` }}
                  >
                    {orderedRoundIndexes.map((roundIdx, idx) => {
                      const roundNodes = roundsMap[roundIdx];
                      const roundName = roundNodes[0]?.roundName || `Babak ${roundIdx}`;

                      return (
                        <div 
                          key={roundIdx} 
                          className="flex-1 flex flex-col justify-around space-y-4"
                          style={{ height: `${bracketHeight}px` }}
                        >
                          {/* Round Title */}
                          <div className="text-center border-b border-slate-100 pb-2 mb-2 font-mono">
                            <span className="text-[11px] font-extrabold text-emerald-600 uppercase tracking-widest">{roundName}</span>
                            <span className="block text-[9px] text-slate-400 mt-0.5">{roundNodes.length} PERTANDINGAN</span>
                          </div>

                          {/* Nodes lists */}
                          <div className="flex-1 flex flex-col justify-around">
                            {roundNodes.map((node) => {
                              const matchObj = matchesToRender.find(m => m.id === node.matchId);
                              const isLive = matchObj?.status === 'live';
                              const isCompleted = matchObj?.status === 'completed';
                              const p1Obj = serverState.players?.find(p => p.id === node.player1Id);
                              const p2Obj = serverState.players?.find(p => p.id === node.player2Id);

                              return (
                                <div 
                                  key={node.id} 
                                  className={`p-3 rounded-xl border shadow-sm transition-all relative ${
                                    isLive 
                                      ? 'bg-white text-slate-800 border-emerald-500 ring-2 ring-emerald-500/20' 
                                      : isCompleted
                                        ? 'bg-slate-50 text-slate-700 border-slate-200'
                                        : 'bg-slate-50/40 text-slate-400 border-slate-100/80'
                                  }`}
                                >
                                  {/* Match badge */}
                                  <div className="flex justify-between items-center mb-2 font-mono">
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                                      isLive 
                                        ? 'bg-emerald-600 text-white' 
                                        : isCompleted 
                                          ? 'bg-slate-200 text-slate-500' 
                                          : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                                    }`}>
                                      {isLive ? 'LIVE' : isCompleted ? 'SELESAI' : 'SCHEDULED'}
                                    </span>
                                    <span className="text-[9px] font-semibold text-slate-400">ID: {node.id.toUpperCase()}</span>
                                  </div>

                                  {matchObj && (matchObj.customDate || matchObj.customTime) && (
                                    <div className="flex gap-1 mb-2 font-mono flex-wrap">
                                      {matchObj.customDate && (
                                        <span className="text-[8px] text-slate-500 bg-slate-100 border border-slate-200/60 px-1 py-0.5 rounded">
                                          📅 {matchObj.customDate}
                                        </span>
                                      )}
                                      {matchObj.customTime && (
                                        <span className="text-[8px] text-indigo-600 bg-indigo-50 border border-indigo-100/60 px-1 py-0.5 rounded">
                                          ⏰ {matchObj.customTime}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Player slots inside match */}
                                  <div className="space-y-1.5 font-sans">
                                    {/* Player 1 Slot */}
                                    <div className="flex justify-between items-center p-1.5 rounded bg-white border border-slate-100">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {p1Obj?.seed && (
                                          <span className="bg-amber-100 text-amber-800 text-[9px] font-mono font-black px-1 py-0.5 rounded border border-amber-200 shrink-0" title={`Seed ${p1Obj.seed}`}>
                                            S{p1Obj.seed}
                                          </span>
                                        )}
                                        <span className={`text-xs truncate font-bold ${
                                          node.winnerId === node.player1Id && node.player1Id
                                            ? 'text-amber-600' 
                                            : 'text-slate-700'
                                        }`}>
                                          {node.player1Name || "Belum ada pemain"}
                                        </span>
                                      </div>
                                      {node.winnerId === node.player1Id && node.player1Id && (
                                        <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-1.5 rounded font-mono">WIN</span>
                                      )}
                                    </div>

                                    <div className="text-center font-mono font-bold text-[9px] text-slate-400">VS</div>

                                    {/* Player 2 Slot */}
                                    <div className="flex justify-between items-center p-1.5 rounded bg-white border border-slate-100">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {p2Obj?.seed && (
                                          <span className="bg-amber-100 text-amber-800 text-[9px] font-mono font-black px-1 py-0.5 rounded border border-amber-200 shrink-0" title={`Seed ${p2Obj.seed}`}>
                                            S{p2Obj.seed}
                                          </span>
                                        )}
                                        <span className={`text-xs truncate font-bold ${
                                          node.winnerId === node.player2Id && node.player2Id
                                            ? 'text-amber-600' 
                                            : 'text-slate-700'
                                        }`}>
                                          {node.player2Name || "Belum ada pemain"}
                                        </span>
                                      </div>
                                      {node.winnerId === node.player2Id && node.player2Id && (
                                        <span className="text-[8px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-1.5 rounded font-mono">WIN</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })() : (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-800 text-sm tracking-wide">BAGAN TURNAMEN BELUM DIUNDI</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                    Masuk ke bagian **Layar Pengelola** untuk mengisi daftar pemain secara manual lalu acak bagan turnamen untuk menyimulasikan pertandingan.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MATCH RECORDS / HISTORY */}
        {activeTab === 'history' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn" id="match-records-explorer">
            <div className="border-b border-slate-200 pb-4 mb-6">
              <h3 className="font-display font-bold text-slate-800 text-lg tracking-wide">RIWAYAT PERTANDINGAN</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">ARSIP LENGKAP CATATAN SKOR DARI SETIAP SET YANG SELESAI</p>
            </div>

            {matchesToRender.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {matchesToRender.map((match) => {
                  const isCompleted = match.status === 'completed';
                  const isLive = match.status === 'live';

                  return (
                    <div 
                      key={match.id}
                      className={`p-5 rounded-xl border transition-all ${
                        isLive 
                          ? 'bg-emerald-50 border-emerald-300 shadow-sm' 
                          : isCompleted 
                            ? 'bg-slate-50 border-slate-200' 
                            : 'bg-slate-50/40 border-slate-100'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isLive 
                            ? 'bg-emerald-600 text-white animate-pulse' 
                            : isCompleted 
                              ? 'bg-slate-200 text-slate-600' 
                              : 'bg-slate-100 text-slate-400'
                        }`}>
                          {match.status.toUpperCase()}
                        </span>
                        <div className="flex items-center gap-2">
                          {match.customDate && (
                            <span className="text-[9px] text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono">
                              📅 {match.customDate}
                            </span>
                          )}
                          {match.customTime && (
                            <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-mono">
                              ⏰ {match.customTime}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono uppercase">{match.round}</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* Player 1 Line */}
                        <div className="flex justify-between items-center">
                          <span className={`text-sm font-bold ${
                            match.winnerId === match.player1Id ? 'text-emerald-600' : 'text-slate-700'
                          }`}>
                            {match.player1Name}
                            {match.winnerId === match.player1Id && ' 🏆'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">SGS Bandung</span>
                        </div>

                        {/* Versus Divider */}
                        <div className="h-px bg-slate-100 w-full my-1 flex justify-center items-center">
                          <span className="bg-slate-50 px-2 text-[9px] font-mono font-bold text-slate-400 uppercase">VS</span>
                        </div>

                        {/* Player 2 Line */}
                        <div className="flex justify-between items-center">
                          <span className={`text-sm font-bold ${
                            match.winnerId === match.player2Id ? 'text-emerald-600' : 'text-slate-700'
                          }`}>
                            {match.player2Name}
                            {match.winnerId === match.player2Id && ' 🏆'}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">PB Tangkas</span>
                        </div>
                      </div>

                      {/* Score break-down per set */}
                      <div className="bg-white border border-slate-200/65 p-3 rounded-lg mt-4 flex justify-between items-center text-xs">
                        <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest">SET SCORES</span>
                        <div className="flex gap-2 font-mono font-bold">
                          {match.scores.map((set, idx) => (
                            <span 
                              key={idx} 
                              className={`px-2.5 py-0.5 rounded border ${
                                set.p1 > set.p2 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                              }`}
                            >
                              S{idx+1}: {set.p1}-{set.p2}
                            </span>
                          ))}
                          {match.scores.length === 0 && <span className="text-slate-400 italic">Belum dimulai</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto text-slate-400">
                  <Calendar className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-800 text-sm tracking-wide">BELUM ADA RIWAYAT PERTANDINGAN</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Seluruh riwayat pertandingan yang dijalankan oleh pengelola akan otomatis tersimpan di sini.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PLAYER STATISTICS */}
        {activeTab === 'stats' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn" id="player-leaderboard">
            <div className="border-b border-slate-200 pb-4 mb-6">
              <h3 className="font-display font-bold text-slate-800 text-lg tracking-wide">PERINGKAT & STATISTIK ATLET</h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">ANALISIS DATA PERFORMA PEMAIN DALAM TURNAMEN AKTIF</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase tracking-widest font-mono text-[9px] border-b border-slate-200">
                    <th className="py-3.5 px-4">Peringkat</th>
                    <th className="py-3.5 px-4">Nama Atlet</th>
                    <th className="py-3.5 px-4">Klub / Daerah</th>
                    <th className="py-3.5 px-4 text-center">Main</th>
                    <th className="py-3.5 px-4 text-center">Menang</th>
                    <th className="py-3.5 px-4 text-center">Set Menang</th>
                    <th className="py-3.5 px-4 text-center">Total Poin</th>
                    <th className="py-3.5 px-4 text-center">Rasio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {sortedPlayers.map((player, idx) => {
                    const winRatio = player.matchesPlayed > 0 
                      ? `${Math.round((player.matchesWon / player.matchesPlayed) * 100)}%` 
                      : '0%';

                    return (
                      <tr key={player.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                          {idx === 0 ? '🥇 01' : idx === 1 ? '🥈 02' : idx === 2 ? '🥉 03' : `${idx < 9 ? '0' : ''}${idx + 1}`}
                        </td>
                        <td className="py-3.5 px-4 font-display font-black text-slate-800 text-sm">
                          {player.name}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-500 font-mono">
                          {player.club}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                          {player.matchesPlayed}
                        </td>
                        <td className="py-3.5 px-4 text-center text-emerald-600 font-bold">
                          {player.matchesWon}
                        </td>
                        <td className="py-3.5 px-4 text-center text-indigo-600 font-bold">
                          {player.setsWon}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                          {player.pointsWon}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full font-bold text-[9px] font-mono">
                            {winRatio}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
