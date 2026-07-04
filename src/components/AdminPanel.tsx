/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Player, 
  Match, 
  BracketNode, 
  ServerState 
} from '../types.js';
import { 
  UserPlus, 
  Shuffle, 
  Play, 
  Plus, 
  Minus, 
  Terminal, 
  RefreshCw, 
  Users, 
  CheckCircle, 
  Send,
  Trophy,
  AlertTriangle,
  Code,
  Calendar,
  Edit,
  Trash2,
  Zap,
  Tv,
  Video
} from 'lucide-react';

interface AdminPanelProps {
  serverState: ServerState;
  onRefresh: () => void;
  setError: (msg: string | null) => void;
  setSuccess: (msg: string | null) => void;
}

export default function AdminPanel({ serverState, onRefresh, setError, setSuccess }: AdminPanelProps) {
  // Manual Player Input State
  const [playerName, setPlayerName] = useState('');
  const [playerClub, setPlayerClub] = useState('');
  const [playerSeed, setPlayerSeed] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);

  // Player Edit State
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState('');
  const [editingPlayerClub, setEditingPlayerClub] = useState('');
  const [editingPlayerSeed, setEditingPlayerSeed] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [confirmDeletePlayerId, setConfirmDeletePlayerId] = useState<string | null>(null);

  // Tournament Edit/Delete State
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [editingTournamentName, setEditingTournamentName] = useState('');
  const [editingTournamentDate, setEditingTournamentDate] = useState('');
  const [isSavingTournamentEdit, setIsSavingTournamentEdit] = useState(false);
  const [confirmDeleteTournamentId, setConfirmDeleteTournamentId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Tournament Draw State
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [drawSize, setDrawSize] = useState<number>(8);
  const [isDrawing, setIsDrawing] = useState(false);

  // API Simulation Sandbox State
  const [apiPlayer, setApiPlayer] = useState<1 | 2>(1);
  const [apiAction, setApiAction] = useState<'increment' | 'set-score'>('increment');
  const [apiPoints, setApiPoints] = useState<number>(21);
  const [apiLogs, setApiLogs] = useState<Array<{ type: 'req' | 'res'; data: any; time: string }>>([]);
  const [selectedMatchIdForApi, setSelectedMatchIdForApi] = useState<string>('');

  // New Tournament Creation State
  const [newTourneyName, setNewTourneyName] = useState('');
  const [newTourneySize, setNewTourneySize] = useState<number>(8);
  const [newTourneyPlayers, setNewTourneyPlayers] = useState<string[]>([]);
  const [newTourneyDate, setNewTourneyDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isCreatingTourney, setIsCreatingTourney] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Running Text Custom State
  const [customRunningText, setCustomRunningText] = useState(serverState.runningText || '');
  // YouTube Embed Url Custom State
  const [customYoutubeUrl, setCustomYoutubeUrl] = useState(serverState.youtubeUrl || '');

  useEffect(() => {
    if (serverState.runningText !== undefined) {
      setCustomRunningText(serverState.runningText);
    }
  }, [serverState.runningText]);

  useEffect(() => {
    if (serverState.youtubeUrl !== undefined) {
      setCustomYoutubeUrl(serverState.youtubeUrl);
    }
  }, [serverState.youtubeUrl]);

  useEffect(() => {
    if (serverState.activeTournamentId && serverState.tournaments) {
      const activeT = serverState.tournaments.find(t => t.id === serverState.activeTournamentId);
      if (activeT) {
        setDrawSize(activeT.drawSize);
      }
    }
  }, [serverState.activeTournamentId, serverState.tournaments]);

  const handleSwitchTournament = async (id: string) => {
    try {
      const res = await fetch('/api/tournaments/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId: id }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengubah turnamen aktif.");
      }
      setSuccess("Turnamen aktif berhasil diubah!");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTourneyName.trim()) {
      setError("Nama turnamen wajib diisi.");
      return;
    }
    if (newTourneyPlayers.length > 0 && newTourneyPlayers.length !== newTourneySize) {
      setError(`Harap pilih tepat ${newTourneySize} atlet untuk langsung mengundi, atau kosongkan (jangan pilih atlet) jika ingin menyusun pemain belakangan.`);
      return;
    }

    setIsCreatingTourney(true);
    try {
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTourneyName,
          drawSize: newTourneySize,
          playerIds: newTourneyPlayers,
          customDate: newTourneyDate
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal membuat turnamen.");
      }

      setNewTourneyName('');
      setNewTourneyPlayers([]);
      setShowCreateForm(false);
      setSuccess("🏆 Turnamen baru berhasil dibuat dan langsung diaktifkan!");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreatingTourney(false);
    }
  };

  const handleQuickSelectForNewTourney = (size: number) => {
    const ids = [...serverState.players]
      .sort(() => Math.random() - 0.5)
      .slice(0, size)
      .map(p => p.id);
    setNewTourneyPlayers(ids);
  };

  const toggleNewTourneyPlayer = (id: string) => {
    if (newTourneyPlayers.includes(id)) {
      setNewTourneyPlayers(prev => prev.filter(pId => pId !== id));
    } else {
      if (newTourneyPlayers.length >= newTourneySize) {
        setError(`Maksimum ${newTourneySize} atlet untuk turnamen ini.`);
        return;
      }
      setNewTourneyPlayers(prev => [...prev, id]);
    }
  };

  const liveMatch = serverState.matches.find(m => m.status === 'live');

  // Handle manual player registration
  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || !playerClub.trim()) {
      setError("Nama dan Klub pemain wajib diisi.");
      return;
    }

    setIsAddingPlayer(true);
    try {
      const res = await fetch('/api/state');
      const seedVal = playerSeed ? Number(playerSeed) : undefined;
      const resAdd = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName, club: playerClub, seed: seedVal }),
      });

      if (!resAdd.ok) {
        const err = await resAdd.json();
        throw new Error(err.error || "Gagal menambahkan pemain.");
      }

      setPlayerName('');
      setPlayerClub('');
      setPlayerSeed('');
      setSuccess("Pemain berhasil ditambahkan secara manual!");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsAddingPlayer(false);
    }
  };

  // Handle player edit submission
  const handleUpdatePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayerId) return;
    if (!editingPlayerName.trim() || !editingPlayerClub.trim()) {
      setError("Nama dan Klub pemain tidak boleh kosong.");
      return;
    }

    setIsSavingEdit(true);
    try {
      const seedVal = editingPlayerSeed ? Number(editingPlayerSeed) : null;
      const res = await fetch(`/api/players/${editingPlayerId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingPlayerName, club: editingPlayerClub, seed: seedVal }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui informasi pemain.");
      }

      setEditingPlayerId(null);
      setEditingPlayerName('');
      setEditingPlayerClub('');
      setEditingPlayerSeed('');
      setSuccess("Informasi atlet berhasil diperbarui!");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Handle player deletion
  const executeDeletePlayer = async (playerId: string, name: string) => {
    try {
      const res = await fetch(`/api/players/${playerId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus pemain.");
      }

      setSuccess(`Atlet "${name}" berhasil dihapus dari sistem.`);
      
      // Clear selection if deleted player was selected
      if (selectedPlayerIds.includes(playerId)) {
        setSelectedPlayerIds(prev => prev.filter(id => id !== playerId));
      }
      if (newTourneyPlayers.includes(playerId)) {
        setNewTourneyPlayers(prev => prev.filter(id => id !== playerId));
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Handle tournament edit submission
  const handleUpdateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTournamentId) return;
    if (!editingTournamentName.trim()) {
      setError("Nama turnamen tidak boleh kosong.");
      return;
    }

    setIsSavingTournamentEdit(true);
    try {
      const res = await fetch(`/api/tournaments/${editingTournamentId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTournamentName, customDate: editingTournamentDate }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui informasi turnamen.");
      }

      setEditingTournamentId(null);
      setEditingTournamentName('');
      setEditingTournamentDate('');
      setSuccess("Informasi turnamen berhasil diperbarui!");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingTournamentEdit(false);
    }
  };

  // Handle tournament deletion
  const executeDeleteTournament = async (tournamentId: string, name: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal menghapus turnamen.");
      }

      setSuccess(`Turnamen "${name}" berhasil dihapus dari sistem.`);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Reset Server System
  const executeResetSystem = async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        setSuccess("Sistem berhasil direset ke setelan awal pabrik.");
        setApiLogs([]);
        onRefresh();
      } else {
        throw new Error("Gagal mereset server.");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Select random players for quick draw setup
  const handleQuickSelect = (size: number) => {
    const ids = [...serverState.players]
      .sort(() => Math.random() - 0.5)
      .slice(0, size)
      .map(p => p.id);
    setSelectedPlayerIds(ids);
    setDrawSize(size);
    setSuccess(`Dipilih ${size} pemain acak untuk pengundian!`);
  };

  const togglePlayerSelection = (playerId: string) => {
    if (selectedPlayerIds.includes(playerId)) {
      setSelectedPlayerIds(prev => prev.filter(id => id !== playerId));
    } else {
      if (selectedPlayerIds.length >= drawSize) {
        setError(`Batas pengundian adalah ${drawSize} pemain. Hapus pemain lain terlebih dahulu atau ubah ukuran braket.`);
        return;
      }
      setSelectedPlayerIds(prev => [...prev, playerId]);
    }
  };

  // Perform Random Tournament Draw
  const handleDrawTournament = async () => {
    if (selectedPlayerIds.length !== drawSize) {
      setError(`Harap pilih tepat ${drawSize} pemain untuk melakukan pengundian.`);
      return;
    }

    setIsDrawing(true);
    try {
      const res = await fetch('/api/tournament/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIds: selectedPlayerIds }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengundi turnamen.");
      }

      setSuccess(`🎉 Turnamen berhasil diundi dengan ${drawSize} pemain! Papan braket telah dibuat.`);
      setSelectedPlayerIds([]);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsDrawing(false);
    }
  };

  // Start a match
  const handleStartMatch = async (matchId: string) => {
    try {
      const res = await fetch(`/api/matches/${matchId}/start`, {
        method: 'POST',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memulai pertandingan.");
      }

      setSuccess("Pertandingan dimulai! Silakan kelola skor di panel kendali di bawah.");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Update match custom date
  const handleUpdateMatchDate = async (matchId: string, dateStr: string) => {
    try {
      const res = await fetch(`/api/matches/${matchId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customDate: dateStr })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengubah tanggal pertandingan.");
      }
      setSuccess("Tanggal pertandingan berhasil diperbarui!");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Update match custom time
  const handleUpdateMatchTime = async (matchId: string, timeStr: string) => {
    try {
      const res = await fetch(`/api/matches/${matchId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customTime: timeStr })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal mengubah jam pertandingan.");
      }
      setSuccess("Jam pertandingan berhasil diperbarui!");
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Referee: Update Score
  const handleUpdateScore = async (matchId: string, playerIndex: 1 | 2, action: 'increment' | 'decrement' | 'finish-set' | 'finish-match') => {
    try {
      const res = await fetch(`/api/matches/${matchId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerIndex, action }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Gagal memperbarui skor.");
      }

      onRefresh();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Simulate External API integration
  const handleSimulateApi = async () => {
    const targetMatchId = selectedMatchIdForApi || (liveMatch ? liveMatch.id : '');
    if (!targetMatchId) {
      setError("Silakan pilih pertandingan aktif untuk melakukan simulasi integrasi API.");
      return;
    }

    const payload = {
      apiKey: "BADMINTON_SECRET_2026",
      matchId: targetMatchId,
      player: apiPlayer,
      points: apiAction === 'set-score' ? apiPoints : 1,
      action: apiAction,
    };

    const timeStr = new Date().toLocaleTimeString('id-ID');
    setApiLogs(prev => [{ type: 'req', data: payload, time: timeStr }, ...prev]);

    try {
      const res = await fetch('/api/external/update-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      setApiLogs(prev => [{ type: 'res', data: resData, time: timeStr }, ...prev]);

      if (!res.ok) {
        throw new Error(resData.error || "API mengembalikan respon error.");
      }

      setSuccess("API update berhasil dikirim dan diaplikasikan ke server!");
      onRefresh();
    } catch (err: any) {
      setError(`API Error: ${err.message}`);
    }
  };

  // Reset Server System
  const handleResetSystem = () => {
    setShowResetConfirm(true);
  };

  // Code snippets for documentation
  const curlCode = `curl -X POST \\
  \${window.location.origin || "http://localhost:3000"}/api/external/update-score \\
  -H "Content-Type: application/json" \\
  -d '{
    "apiKey": "BADMINTON_SECRET_2026",
    "matchId": "${liveMatch ? liveMatch.id : 'm-q1'}",
    "player": ${apiPlayer},
    "points": ${apiAction === 'set-score' ? apiPoints : 1},
    "action": "${apiAction}"
  }'`;

  return (
    <div className="space-y-6 animate-fadeIn" id="admin-panel-container">
      
      {/* TOURNAMENT CONTROL HUB */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
              <Trophy className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-800 text-lg tracking-wide">PENGELOLA HUB TURNAMEN</h3>
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Pilih, buat, dan aktifkan beberapa turnamen secara terpisah</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm border-none self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" /> {showCreateForm ? 'BATALKAN' : 'BUAT TURNAMEN BARU'}
          </button>
        </div>

        {/* Create Tournament Form Accordion */}
        {showCreateForm && (
          <form onSubmit={handleCreateTournament} className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 animate-fadeIn">
            <h4 className="font-display font-bold text-sm text-slate-800 uppercase tracking-wider">FORMULIR TURNAMEN BARU</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest mb-1.5">Nama Turnamen</label>
                <input
                  type="text"
                  value={newTourneyName}
                  onChange={e => setNewTourneyName(e.target.value)}
                  placeholder="Contoh: Badminton Cup Antar Klub 2026"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 placeholder-slate-400 font-medium font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest mb-1.5">Tanggal Turnamen</label>
                <input
                  type="date"
                  value={newTourneyDate}
                  onChange={e => setNewTourneyDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 font-medium font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest mb-1.5">Ukuran Bagan (Jumlah Atlet)</label>
                <div className="flex flex-wrap gap-2">
                  {[4, 8, 16, 32, 64].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => { setNewTourneySize(size); setNewTourneyPlayers([]); }}
                      className={`flex-1 min-w-[70px] py-2 text-xs font-mono font-bold rounded-lg border transition-all ${
                        newTourneySize === size
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {size} Atlet {size === 4 ? '(SF)' : size === 8 ? '(QF)' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Select Players for New Tournament */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest">
                  PILIH ATLET ({newTourneyPlayers.length} / {newTourneySize} TERPILIH)
                </label>
                <button
                  type="button"
                  onClick={() => handleQuickSelectForNewTourney(newTourneySize)}
                  className="text-[10px] font-mono font-bold text-emerald-600 hover:text-emerald-500 transition-colors uppercase"
                >
                  [ Pilih Atlet Acak Secara Cepat ]
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-lg">
                {serverState.players.map((p) => {
                  const isSelected = newTourneyPlayers.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleNewTourneyPlayer(p.id)}
                      className={`p-2 rounded text-[10px] font-mono font-bold border transition-all text-left truncate flex flex-col gap-0.5 justify-center items-start min-h-[44px] ${
                        isSelected
                          ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                          : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full gap-1">
                        <span className="truncate">{p.name}</span>
                        {isSelected && <span className="text-[8px] bg-emerald-600 text-white px-1 rounded shrink-0">✓</span>}
                      </div>
                      {p.seed && (
                        <span className="text-[7.5px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded border border-amber-200 font-bold shrink-0">
                          ★ Seed {p.seed}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isCreatingTourney || (newTourneyPlayers.length > 0 && newTourneyPlayers.length !== newTourneySize)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-display font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              <Trophy className="w-4 h-4" /> {isCreatingTourney ? 'MEMPROSES...' : 'BUAT & AKTIFKAN TURNAMEN BARU'}
            </button>
          </form>
        )}

        {/* Active Tournament List / Switcher */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">Turnamen Aktif Saat Ini:</span>
            <span className="text-xs font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
              {(serverState.tournaments?.find(t => t.id === serverState.activeTournamentId) || { name: 'Turnamen Utama Court 01' }).name}
            </span>
            {serverState.tournaments?.find(t => t.id === serverState.activeTournamentId)?.customDate && (
              <span className="text-xs font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
                📅 {serverState.tournaments.find(t => t.id === serverState.activeTournamentId)?.customDate}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase shrink-0">Beralih Kendali:</label>
            <select
              value={serverState.activeTournamentId || ""}
              onChange={(e) => handleSwitchTournament(e.target.value)}
              className="w-full sm:w-64 text-xs font-mono font-bold p-2 border border-slate-200 bg-white rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {(serverState.tournaments || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.drawSize} Atlet) {t.customDate ? `[${t.customDate}]` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* List & Controls for All Tournaments */}
        <div className="mt-4 border-t border-slate-100 pt-4" id="tournament-list-section">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-3">
            DAFTAR & MODIFIKASI TURNAMEN ({serverState.tournaments?.length || 0})
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
            {(serverState.tournaments || []).map((t) => {
              const isActive = t.id === serverState.activeTournamentId;
              const isEditing = editingTournamentId === t.id;
              const isConfirmingDelete = confirmDeleteTournamentId === t.id;

              return (
                <div 
                  key={t.id} 
                  className={`p-3 rounded-xl border transition-all ${
                    isActive 
                      ? 'bg-emerald-50/40 border-emerald-200 shadow-sm' 
                      : 'bg-slate-50 border-slate-150'
                  }`}
                >
                  {isEditing ? (
                    <form onSubmit={handleUpdateTournament} className="space-y-2.5 font-mono text-[10px]">
                      <div className="space-y-1">
                        <label className="font-bold text-slate-400 uppercase">Nama Turnamen</label>
                        <input
                          type="text"
                          value={editingTournamentName}
                          onChange={(e) => setEditingTournamentName(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-slate-400 uppercase">Tanggal Turnamen</label>
                        <input
                          type="date"
                          value={editingTournamentDate}
                          onChange={(e) => setEditingTournamentDate(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          required
                        />
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <button
                          type="submit"
                          disabled={isSavingTournamentEdit}
                          className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded uppercase text-[9px] border-none cursor-pointer"
                        >
                          {isSavingTournamentEdit ? 'Menyimpan...' : 'Simpan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTournamentId(null)}
                          className="flex-1 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded uppercase text-[9px] border-none cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : isConfirmingDelete ? (
                    <div className="space-y-2 font-mono text-[10px]">
                      <p className="text-rose-800 font-bold">Hapus turnamen "{t.name}"? Ini juga menghapus seluruh riwayat laga di dalamnya.</p>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteTournamentId(null);
                            executeDeleteTournament(t.id, t.name);
                          }}
                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded uppercase text-[9px] border-none cursor-pointer"
                        >
                          Ya, Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTournamentId(null)}
                          className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded uppercase text-[9px] border-none cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-between h-full gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border border-slate-200">
                            {t.drawSize} Atlet
                          </span>
                          {t.customDate && (
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase border border-indigo-100">
                              📅 {t.customDate}
                            </span>
                          )}
                          {isActive && (
                            <span className="bg-emerald-650 text-emerald-800 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase">
                              AKTIF
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-800 leading-snug line-clamp-2">{t.name}</h4>
                      </div>

                      <div className="flex items-center justify-between gap-1.5 border-t border-slate-100/80 pt-2 mt-1">
                        {!isActive ? (
                          <button
                            onClick={() => handleSwitchTournament(t.id)}
                            className="py-1 px-2 text-[9px] font-mono font-bold bg-white text-emerald-600 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded transition-all cursor-pointer"
                          >
                            JADIKAN AKTIF
                          </button>
                        ) : (
                          <span className="text-[9px] font-mono font-bold text-emerald-600 flex items-center gap-1">
                            ● SEDANG DIKENDALIKAN
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingTournamentId(t.id);
                              setEditingTournamentName(t.name);
                              setEditingTournamentDate(t.customDate || '');
                            }}
                            className="p-1 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded text-slate-400 transition-all cursor-pointer"
                            title="Edit Turnamen"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteTournamentId(t.id)}
                            className="p-1 bg-white hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded text-slate-400 transition-all cursor-pointer"
                            title="Hapus Turnamen"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="admin-panel-grid">
      {/* LEFT COLUMN: Input Players and Tournament Draw */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* MANUAL INPUT FORM */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" id="manual-input-card">
          <div className="flex items-center gap-3 mb-5 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-800 tracking-wide">REGISTRASI ATLET MANUAL</h3>
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Tambahkan atlet tunggal baru ke sistem database</p>
            </div>
          </div>

          <form onSubmit={handleAddPlayer} className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest mb-1.5">Nama Lengkap Atlet</label>
              <input
                type="text"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="Contoh: Taufik Hidayat"
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 placeholder-slate-400 font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest mb-1.5">Klub / Daerah Asal</label>
              <input
                type="text"
                value={playerClub}
                onChange={e => setPlayerClub(e.target.value)}
                placeholder="Contoh: PB SGS Bandung"
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 placeholder-slate-400 font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest mb-1.5">Unggulan / Seed (Opsional)</label>
              <input
                type="number"
                min="1"
                max="8"
                value={playerSeed}
                onChange={e => setPlayerSeed(e.target.value)}
                placeholder="Contoh: 1 (Kosongkan jika bukan unggulan)"
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-800 placeholder-slate-400 font-medium font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isAddingPlayer}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-100 disabled:text-slate-400 text-white font-display font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-lg shadow-[0_2px_8px_rgba(16,185,129,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              <Plus className="w-4 h-4" />
              {isAddingPlayer ? 'MENDAFTARKAN...' : 'DAFTARKAN ATLET'}
            </button>
          </form>
        </div>

        {/* PLAYER MANAGEMENT & DATABASE CONTROL */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" id="player-database-card">
          <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-800 tracking-wide">DAFTAR & KENDALI ATLET</h3>
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Kelola, edit, atau hapus atlet dari sistem</p>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
              TOTAL: {serverState.players.length}
            </span>
          </div>

          {/* Quick random player generator section */}
          <div className="bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 p-3.5 rounded-xl border border-indigo-100/40 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 font-sans">
            <div>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" /> Generasi Atlet Acak Cepat
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">Membantu pengujian bracket besar (16, 32, 64 pemain) dengan nama realistik.</p>
            </div>
            <div className="flex gap-1.5 w-full sm:w-auto">
              {[16, 32, 64].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/players/generate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ count })
                      });
                      if (res.ok) {
                        setSuccess(`Berhasil menambahkan ${count} atlet acak baru!`);
                        onRefresh();
                      } else {
                        throw new Error("Gagal menggenerasi atlet.");
                      }
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                  className="flex-1 sm:flex-initial text-[10px] font-mono font-bold bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 py-1.5 px-2.5 rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  +{count} Atlet
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
            {serverState.players.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6 font-mono">Belum ada atlet yang terdaftar.</p>
            ) : (
              serverState.players.map((player) => (
                <div 
                  key={player.id} 
                  className="p-3 bg-slate-50 border border-slate-150 rounded-xl hover:bg-slate-100/50 transition-all"
                >
                  {editingPlayerId === player.id ? (
                    <form onSubmit={handleUpdatePlayer} className="space-y-3 font-mono text-xs">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Nama Atlet</label>
                        <input
                          type="text"
                          value={editingPlayerName}
                          onChange={(e) => setEditingPlayerName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Klub / Daerah</label>
                        <input
                          type="text"
                          value={editingPlayerClub}
                          onChange={(e) => setEditingPlayerClub(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Unggulan / Seed (Opsional)</label>
                        <input
                          type="number"
                          min="1"
                          max="8"
                          value={editingPlayerSeed}
                          onChange={(e) => setEditingPlayerSeed(e.target.value)}
                          placeholder="Kosongkan jika bukan unggulan"
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="submit"
                          disabled={isSavingEdit}
                          className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded uppercase transition-colors border-none cursor-pointer"
                        >
                          {isSavingEdit ? 'Menyimpan...' : 'Simpan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingPlayerId(null)}
                          className="flex-1 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded uppercase transition-colors border-none cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </form>
                  ) : confirmDeletePlayerId === player.id ? (
                    <div className="space-y-2 font-mono text-xs p-1">
                      <p className="text-rose-800 font-bold">Hapus atlet "{player.name}"? Tindakan ini tidak dapat dibatalkan.</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeletePlayerId(null);
                            executeDeletePlayer(player.id, player.name);
                          }}
                          className="flex-1 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] rounded uppercase transition-colors border-none cursor-pointer"
                        >
                          Ya, Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePlayerId(null)}
                          className="flex-1 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[10px] rounded uppercase transition-colors border-none cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <h4 className="text-xs font-bold text-slate-800 truncate">{player.name}</h4>
                          {player.seed && (
                            <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                              ⭐ SEED {player.seed}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-indigo-600 font-medium truncate font-mono">{player.club}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-400 font-mono">
                          <span>Main: <strong className="text-slate-600">{player.matchesPlayed}</strong></span>
                          <span>•</span>
                          <span>Menang: <strong className="text-emerald-600">{player.matchesWon}</strong></span>
                          <span>•</span>
                          <span>Set: <strong className="text-slate-600">{player.setsWon}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setEditingPlayerId(player.id);
                            setEditingPlayerName(player.name);
                            setEditingPlayerClub(player.club);
                            setEditingPlayerSeed(player.seed ? String(player.seed) : '');
                          }}
                          className="p-1.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 hover:border-indigo-200 rounded text-slate-400 transition-all cursor-pointer"
                          title="Edit Atlet"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDeletePlayerId(player.id)}
                          className="p-1.5 bg-white hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded text-slate-400 transition-all cursor-pointer"
                          title="Hapus Atlet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* TOURNAMENT RANDOM DRAW MANAGER */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" id="tournament-draw-card">
          <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
                <Shuffle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-800 tracking-wide">UNDIAN BAGAN ACAK</h3>
                <p className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Acak pemain ke dalam struktur eliminasi</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono font-bold text-slate-450 uppercase tracking-widest mb-2.5">Ukuran Turnamen (Braket)</label>
              <div className="flex flex-wrap gap-2">
                {[4, 8, 16, 32, 64].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      setDrawSize(size);
                      setSelectedPlayerIds([]);
                    }}
                    className={`flex-1 min-w-[70px] py-2.5 px-3 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      drawSize === size
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-[0_2px_8px_rgba(99,102,241,0.25)]'
                        : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100/60'
                    }`}
                  >
                    {size === 4 ? 'SEMIFINAL (4)' : size === 8 ? 'PEREMPAT (8)' : `${size} ATLET`}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-between border border-slate-200 font-mono">
              <span className="text-[11px] text-slate-500 font-medium">
                Pemain Terpilih: <span className="text-emerald-600 font-bold">{selectedPlayerIds.length} / {drawSize}</span>
              </span>
              <button
                type="button"
                onClick={() => handleQuickSelect(drawSize)}
                className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer bg-transparent border-none"
              >
                <Users className="w-3.5 h-3.5" /> Ambil {drawSize} Acak
              </button>
            </div>

            {/* List of registered players for selection */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1 border border-slate-200 rounded-lg p-2 bg-slate-50/40">
              {serverState.players.map((player) => {
                const isSelected = selectedPlayerIds.includes(player.id);
                return (
                  <div
                    key={player.id}
                    onClick={() => togglePlayerSelection(player.id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all ${
                      isSelected 
                        ? 'bg-indigo-50/60 border-indigo-200 text-indigo-900 shadow-sm' 
                        : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-xs font-bold text-slate-700">{player.name}</p>
                        {player.seed && (
                          <span className="bg-amber-100 text-amber-800 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-200">
                            ★ Seed {player.seed}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400 font-mono">{player.club}</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      isSelected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-200 bg-white'
                    }`}>
                      {isSelected && <span className="text-[9px] font-bold">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleDrawTournament}
              disabled={isDrawing || selectedPlayerIds.length !== drawSize}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-display font-bold text-xs uppercase tracking-wider py-3 px-4 rounded-lg shadow-[0_2px_8px_rgba(99,102,241,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
            >
              <Shuffle className="w-4 h-4" />
              {isDrawing ? "MENGUNDI BRAKET..." : "UNDI TURNAMEN SEKARANG"}
            </button>
          </div>
        </div>

        {/* RUNNING TEXT EDITOR CARD */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 animate-fadeIn" id="running-text-editor-card">
          <div className="flex items-center gap-2">
            <Tv className="w-5 h-5 text-emerald-600 animate-pulse" />
            <div>
              <h4 className="text-xs font-sans font-bold text-slate-800 uppercase tracking-wider">Atur Running Text Ticker</h4>
              <p className="text-[10px] text-slate-400 font-mono">Diedit real-time dan tampil langsung di layar penonton</p>
            </div>
          </div>
          <div className="space-y-3">
            <textarea
              value={customRunningText}
              onChange={(e) => setCustomRunningText(e.target.value)}
              placeholder="Ketik teks pengumuman di sini..."
              rows={2}
              className="w-full text-xs font-sans p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-slate-800 outline-none"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/running-text', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ text: customRunningText })
                    });
                    if (res.ok) {
                      setSuccess("Running text berhasil diperbarui!");
                      onRefresh();
                    } else {
                      throw new Error("Gagal memperbarui running text.");
                    }
                  } catch (err: any) {
                    setError(err.message);
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] py-1.5 px-4 rounded-lg transition-colors border-none cursor-pointer shadow-sm uppercase tracking-wide"
              >
                Simpan Teks
              </button>
            </div>
          </div>
        </div>

        {/* YOUTUBE EMBED EDITOR CARD */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3 animate-fadeIn" id="youtube-embed-editor-card">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-rose-600 animate-pulse" />
            <div>
              <h4 className="text-xs font-sans font-bold text-slate-800 uppercase tracking-wider">Atur Video / Embed YouTube</h4>
              <p className="text-[10px] text-slate-400 font-mono">Diedit real-time dan tampil langsung di bawah skor penonton</p>
            </div>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={customYoutubeUrl}
              onChange={(e) => setCustomYoutubeUrl(e.target.value)}
              placeholder="Masukkan Link YouTube (Contoh: https://www.youtube.com/watch?v=...) atau Kode Iframe..."
              className="w-full text-xs font-sans p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono text-slate-800 outline-none"
            />
            <p className="text-[10px] text-slate-450 font-mono leading-relaxed">
              Mendukung link share (youtu.be), url nonton biasa (watch?v=), url embed (youtube.com/embed/), id video 11-karakter, atau kode embed HTML lengkap <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono">&lt;iframe&gt;</code>.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/youtube-url', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ url: customYoutubeUrl })
                    });
                    if (res.ok) {
                      setSuccess("Link Video YouTube berhasil diperbarui!");
                      onRefresh();
                    } else {
                      throw new Error("Gagal memperbarui video YouTube.");
                    }
                  } catch (err: any) {
                    setError(err.message);
                  }
                }}
                className="bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-[10px] py-1.5 px-4 rounded-lg transition-colors border-none cursor-pointer shadow-sm uppercase tracking-wide"
              >
                Simpan Video
              </button>
            </div>
          </div>
        </div>

        {/* UTILITY RESET & ZONE */}
        <div className="bg-rose-50 p-4 rounded-xl border border-rose-150" id="danger-zone-card">
          {showResetConfirm ? (
            <div className="space-y-2 text-xs font-mono text-rose-700">
              <p className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-rose-500" /> APAKAH ANDA YAKIN?
              </p>
              <p className="text-[10px] text-rose-600">Semua data turnamen, statistik atlet, dan riwayat pertandingan akan dikembalikan ke setelan awal pabrik.</p>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetConfirm(false);
                    executeResetSystem();
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded uppercase text-[10px] border-none cursor-pointer"
                >
                  Ya, Reset Semua Data
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded uppercase text-[10px] border-none cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div>
                <h4 className="text-xs font-mono font-bold text-rose-700 flex items-center gap-1 uppercase tracking-wider">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Zone Bahaya
                </h4>
                <p className="text-[10px] text-rose-600/80 font-mono">Reset seluruh data real-time, statistik, & log</p>
              </div>
              <button
                type="button"
                onClick={handleResetSystem}
                className="bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-700 text-[10px] font-mono font-bold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> RESET SISTEM
              </button>
            </div>
          )}
        </div>

      </div>

      {/* RIGHT COLUMN: Live Referee Scoreboard & API Integration */}
      <div className="lg:col-span-7 space-y-6">

        {/* LIVE MATCH CONTROLLER / SCOREBOARD REFEREE */}
        <div className="bg-white text-slate-850 p-6 rounded-xl border border-slate-200 shadow-sm" id="live-controller-card">
          <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping" />
              <div>
                <h3 className="font-display font-bold text-slate-800 tracking-wide uppercase">Panel Wasit Kendali</h3>
                <p className="text-[10px] font-mono text-slate-450 uppercase tracking-wider">Simulasikan penambahan skor manual per set</p>
              </div>
            </div>
            <span className="bg-slate-50 text-emerald-700 font-mono text-[10px] px-3 py-1 rounded-full border border-slate-200 tracking-wider">
              OFFLINE_WASIT_V1
            </span>
          </div>

          {liveMatch ? (
            <div className="space-y-6">
              {/* Active match header */}
              <div className="text-center bg-slate-50 p-4 rounded-lg border border-slate-150">
                <span className="text-xs font-mono bg-indigo-600 text-white px-3 py-1 rounded font-bold uppercase tracking-wider">
                  {liveMatch.round} - Set {liveMatch.currentSet} (LIVE)
                </span>
                <p className="text-[10px] font-mono text-slate-500 mt-2">MATCH_ID: <span className="text-slate-700">{liveMatch.id}</span></p>
              </div>

              {/* Huge Score adjusters */}
              <div className="grid grid-cols-2 gap-4">
                {/* Player 1 Side */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-black text-emerald-600 truncate text-base">{liveMatch.player1Name}</h4>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mt-1">ATLET 1 (KIRI)</span>
                  </div>

                  <div className="my-6">
                    <span className="text-6xl font-black font-mono block text-slate-800">
                      {liveMatch.scores[liveMatch.currentSet - 1]?.p1 ?? 0}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateScore(liveMatch.id, 1, 'decrement')}
                      className="flex-1 bg-white hover:bg-slate-50 py-2.5 rounded-lg font-bold flex justify-center items-center gap-1 text-slate-400 border border-slate-200 transition-colors cursor-pointer"
                      title="Kurangi 1 Poin"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleUpdateScore(liveMatch.id, 1, 'increment')}
                      className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg font-display font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-1 shadow-[0_2px_6px_rgba(16,185,129,0.2)] transition-colors cursor-pointer border-none"
                      title="Tambah 1 Poin"
                    >
                      <Plus className="w-4 h-4" /> POIN
                    </button>
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5 pt-3 border-t border-slate-150">
                    <button
                      onClick={() => handleUpdateScore(liveMatch.id, 1, 'finish-set')}
                      className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer"
                      title="Menangkan set ini untuk atlet ini"
                    >
                      Selesaikan Set (Menang)
                    </button>
                    <button
                      onClick={() => handleUpdateScore(liveMatch.id, 1, 'finish-match')}
                      className="w-full bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer"
                      title="Akhiri seluruh laga & menangkan atlet ini"
                    >
                      Selesaikan Laga (Menang)
                    </button>
                  </div>
                </div>

                {/* Player 2 Side */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center flex flex-col justify-between">
                  <div>
                    <h4 className="font-display font-black text-indigo-600 truncate text-base">{liveMatch.player2Name}</h4>
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mt-1">ATLET 2 (KANAN)</span>
                  </div>

                  <div className="my-6">
                    <span className="text-6xl font-black font-mono block text-slate-800">
                      {liveMatch.scores[liveMatch.currentSet - 1]?.p2 ?? 0}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdateScore(liveMatch.id, 2, 'decrement')}
                      className="flex-1 bg-white hover:bg-slate-50 py-2.5 rounded-lg font-bold flex justify-center items-center gap-1 text-slate-400 border border-slate-200 transition-colors cursor-pointer"
                      title="Kurangi 1 Poin"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleUpdateScore(liveMatch.id, 2, 'increment')}
                      className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg font-display font-bold text-xs uppercase tracking-wider flex justify-center items-center gap-1 shadow-[0_2px_6px_rgba(16,185,129,0.2)] transition-colors cursor-pointer border-none"
                      title="Tambah 1 Poin"
                    >
                      <Plus className="w-4 h-4" /> POIN
                    </button>
                  </div>

                  <div className="mt-3 flex flex-col gap-1.5 pt-3 border-t border-slate-150">
                    <button
                      onClick={() => handleUpdateScore(liveMatch.id, 2, 'finish-set')}
                      className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer"
                      title="Menangkan set ini untuk atlet ini"
                    >
                      Selesaikan Set (Menang)
                    </button>
                    <button
                      onClick={() => handleUpdateScore(liveMatch.id, 2, 'finish-match')}
                      className="w-full bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 py-1.5 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer"
                      title="Akhiri seluruh laga & menangkan atlet ini"
                    >
                      Selesaikan Laga (Menang)
                    </button>
                  </div>
                </div>
              </div>

              {/* Historical sets summary */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs flex justify-between items-center text-slate-600 font-mono">
                <span className="font-semibold text-slate-400 uppercase text-[10px]">RIWAYAT SET:</span>
                <div className="flex gap-2">
                  {liveMatch.scores.map((set, idx) => (
                    <span 
                      key={idx} 
                      className={`px-2.5 py-1 rounded border ${
                        idx === liveMatch.currentSet - 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-white text-slate-500 border-slate-200'
                      }`}
                    >
                      Set {idx + 1}: {set.p1}-{set.p2}
                    </span>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-12 space-y-4 font-sans text-slate-600">
              <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Trophy className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-display font-bold text-slate-800 tracking-wide text-sm">TIDAK ADA PERTANDINGAN LIVE SEDANG BERJALAN</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
                  Lakukan undian turnamen terlebih dahulu di panel kiri, kemudian luncurkan/mulai salah satu pertandingan terjadwal di bawah.
                </p>
              </div>

              {/* Direct launcher list from brackets */}
              {serverState.matches.length > 0 ? (
                <div className="max-w-md mx-auto text-left border border-slate-200 rounded-lg overflow-hidden bg-white divide-y divide-slate-100 mt-6 shadow-sm">
                  <div className="bg-slate-50 p-2.5 text-xs font-mono font-bold text-slate-500 text-center uppercase tracking-widest border-b border-slate-200">
                    PERTANDINGAN TERJADWAL
                  </div>
                  {serverState.matches
                    .filter(m => m.status === 'scheduled')
                    .map((m) => {
                      const isReady = m.player1Id && m.player2Id;
                      const p1 = serverState.players.find(p => p.id === m.player1Id);
                      const p2 = serverState.players.find(p => p.id === m.player2Id);
                      return (
                        <div key={m.id} className="p-3.5 flex items-center justify-between text-xs">
                          <div className="space-y-1.5">
                            <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest border border-slate-200">
                              {m.round}
                            </span>
                            <p className="font-bold text-slate-700 text-sm flex items-center gap-1 flex-wrap">
                              {p1?.seed && (
                                <span className="bg-amber-100 text-amber-850 text-[9px] font-mono font-black px-1 rounded border border-amber-200" title={`Seed ${p1.seed}`}>
                                  S{p1.seed}
                                </span>
                              )}
                              <span>{m.player1Name}</span>
                              <span className="text-emerald-600 font-normal mx-0.5">vs</span>
                              {p2?.seed && (
                                <span className="bg-amber-100 text-amber-850 text-[9px] font-mono font-black px-1 rounded border border-amber-200" title={`Seed ${p2.seed}`}>
                                  S{p2.seed}
                                </span>
                              )}
                              <span>{m.player2Name}</span>
                            </p>
                          </div>
                          {isReady ? (
                            <button
                              onClick={() => handleStartMatch(m.id)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] py-1.5 px-3 rounded flex items-center gap-1 transition-all cursor-pointer shadow-sm border-none"
                            >
                              <Play className="w-3 h-3 fill-white stroke-none" /> MULAI
                            </button>
                          ) : (
                            <span className="text-slate-400 font-mono text-[10px] uppercase">
                              Menunggu lawan
                            </span>
                          )}
                        </div>
                      );
                    })}
                  {serverState.matches.filter(m => m.status === 'scheduled').length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-450 font-mono italic">
                      Semua pertandingan terjadwal telah selesai dijalankan!
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* MATCH SCHEDULES & CUSTOM DATES */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4" id="match-schedule-dates-card">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-100">
              <Calendar className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-800 tracking-wide uppercase">JADWAL, TANGGAL & JAM PERTANDINGAN CUSTOM</h3>
              <p className="text-[10px] font-mono text-slate-450 uppercase tracking-wider">Sesuaikan tanggal dan jam pelaksanaan untuk masing-masing pertandingan</p>
            </div>
          </div>

          <div className="divide-y divide-slate-150 border border-slate-150 rounded-xl overflow-hidden bg-white shadow-sm">
            {serverState.matches.length > 0 ? (
              serverState.matches.map((m) => (
                <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs hover:bg-slate-50/50 transition-colors">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border border-indigo-100">
                        {m.round}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider border ${
                        m.status === 'live' 
                          ? 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'
                          : m.status === 'completed'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {m.status === 'live' ? 'LIVE' : m.status === 'completed' ? 'SELESAI' : 'TERJADWAL'}
                      </span>
                    </div>
                    <p className="font-display font-bold text-slate-800 text-sm truncate">
                      {m.player1Name || 'Menunggu'} <span className="text-slate-400 font-normal text-xs">vs</span> {m.player2Name || 'Menunggu'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 shrink-0 self-start sm:self-auto">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest shrink-0">Tanggal:</label>
                      <input 
                        type="date"
                        value={m.customDate || ""}
                        onChange={(e) => handleUpdateMatchDate(m.id, e.target.value)}
                        className="text-xs font-mono font-bold p-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest shrink-0">Jam:</label>
                      <input 
                        type="time"
                        value={m.customTime || ""}
                        onChange={(e) => handleUpdateMatchTime(m.id, e.target.value)}
                        className="text-xs font-mono font-bold p-1.5 border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-slate-450 font-mono italic">
                Belum ada pertandingan dibuat. Buat atau undi turnamen terlebih dahulu.
              </div>
            )}
          </div>
        </div>

        {/* API INTEGRATION PLAYGROUND */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm" id="api-integration-card">
          <div className="flex items-center justify-between mb-5 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-slate-800 tracking-wide">INTEGRASI API REAL-TIME (LANGSUNG)</h3>
                <p className="text-[10px] font-mono text-slate-450 uppercase tracking-wider">Simulasikan pembaruan skor otomatis oleh sistem IOT eksternal</p>
              </div>
            </div>
            <span className="text-[9px] font-mono font-bold text-emerald-600 flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <Code className="w-3.5 h-3.5 text-emerald-600" /> API: AKTIF
            </span>
          </div>

          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Gunakan endpoint ini untuk mengintegrasikan papan skor secara langsung dengan IoT, wasit pintar, atau script python untuk integrasi real-time instan:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* Interactive controls */}
            <div className="md:col-span-5 space-y-3.5 bg-slate-50 p-4 rounded-lg border border-slate-200">
              <span className="text-[10px] font-mono font-bold text-slate-500 block mb-1 uppercase tracking-wider">Simulasi Kirim:</span>
              
              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 mb-1 uppercase">Target Pertandingan</label>
                <select 
                  value={selectedMatchIdForApi}
                  onChange={e => setSelectedMatchIdForApi(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">{liveMatch ? `Live: ${liveMatch.player1Name} vs ${liveMatch.player2Name}` : '-- Pilih Laga --'}</option>
                  {serverState.matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.round}: {m.player1Name} vs {m.player2Name} ({m.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 mb-1 uppercase">Pilih Atlet</label>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-1.5 p-2 border border-slate-200 rounded bg-white text-xs text-slate-600 cursor-pointer">
                    <input 
                      type="radio" 
                      name="apiPlayer" 
                      checked={apiPlayer === 1} 
                      onChange={() => setApiPlayer(1)} 
                    />
                    Pemain 1
                  </label>
                  <label className="flex-1 flex items-center gap-1.5 p-2 border border-slate-200 rounded bg-white text-xs text-slate-600 cursor-pointer">
                    <input 
                      type="radio" 
                      name="apiPlayer" 
                      checked={apiPlayer === 2} 
                      onChange={() => setApiPlayer(2)} 
                    />
                    Pemain 2
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-mono font-bold text-slate-400 mb-1 uppercase">Aksi API</label>
                <select
                  value={apiAction}
                  onChange={e => setApiAction(e.target.value as any)}
                  className="w-full text-xs p-2 border border-slate-200 rounded bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="increment">Increment (+1 Poin)</option>
                  <option value="set-score">Set Score (Atur Skor)</option>
                </select>
              </div>

              {apiAction === 'set-score' && (
                <div>
                  <label className="block text-[9px] font-mono font-bold text-slate-400 mb-1 uppercase">Nilai Skor</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={apiPoints}
                    onChange={e => setApiPoints(Number(e.target.value))}
                    className="w-full text-xs p-1.5 border border-slate-200 rounded bg-white text-slate-800 font-mono"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={handleSimulateApi}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-[10px] py-2.5 px-3 rounded flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-none"
              >
                <Send className="w-3.5 h-3.5" /> REQUEST_API
              </button>
            </div>

            {/* Curl documentation & visual code view */}
            <div className="md:col-span-7 space-y-3.5">
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-450 block mb-1 uppercase tracking-wider">Format Integrasi cURL:</span>
                <pre className="text-[10px] p-2.5 bg-slate-50 text-emerald-800 rounded-lg overflow-x-auto font-mono leading-relaxed border border-slate-200 max-h-48 whitespace-pre-wrap">
                  {curlCode}
                </pre>
              </div>

              {/* Simulated Console Logger */}
              <div>
                <span className="text-[10px] font-mono font-bold text-slate-450 block mb-1 uppercase tracking-wider">LOG KONSOL TRANSMISI WASIT PINTAR:</span>
                <div className="border border-slate-200 rounded-lg bg-slate-50 p-3 max-h-36 overflow-y-auto font-mono text-[9px] text-slate-600 space-y-2">
                  {apiLogs.length > 0 ? (
                    apiLogs.map((log, idx) => (
                      <div key={idx} className={`p-2 rounded border ${log.type === 'req' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-indigo-50 border-indigo-250 text-indigo-800'}`}>
                        <span className="text-[8px] text-slate-400">[{log.time}]</span> <b>{log.type === 'req' ? 'POST /api/external/update-score' : 'RESPONSE 200 OK'}</b>
                        <pre className="mt-1 whitespace-pre-wrap text-[8px] text-slate-500">{JSON.stringify(log.data, null, 1)}</pre>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-slate-400 py-6 italic text-[9px]">
                      [Menunggu sinyal transmisi wasit pintar...]
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  </div>
  );
}
