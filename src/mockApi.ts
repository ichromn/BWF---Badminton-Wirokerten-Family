import { 
  Player, 
  Match, 
  BracketNode, 
  MatchNotification, 
  ServerState,
  MatchScore,
  Tournament,
  SpectatorComment
} from './types';

// Helper for generating unique IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Initial list of Indonesian Badminton Players for realistic data
const DEFAULT_PLAYERS: Player[] = [
  { id: "p1", name: "Anthony Sinisuka Ginting", club: "SGS Bandung", matchesPlayed: 14, matchesWon: 10, setsWon: 22, pointsWon: 540, seed: 1 },
  { id: "p2", name: "Jonatan Christie", club: "PB Tangkas", matchesPlayed: 12, matchesWon: 9, setsWon: 19, pointsWon: 480, seed: 2 },
  { id: "p3", name: "Shesar Hiren Rhustavito", club: "PB Djarum", matchesPlayed: 8, matchesWon: 4, setsWon: 10, pointsWon: 320, seed: 3 },
  { id: "p4", name: "Chico Aura Dwi Wardoyo", club: "PB Exist", matchesPlayed: 10, matchesWon: 6, setsWon: 14, pointsWon: 390, seed: 4 },
  { id: "p5", name: "Alwi Farhan", club: "PB Mansion", matchesPlayed: 6, matchesWon: 4, setsWon: 9, pointsWon: 240 },
  { id: "p6", name: "Christian Adinata", club: "PB Tangkas", matchesPlayed: 5, matchesWon: 3, setsWon: 7, pointsWon: 195 },
  { id: "p7", name: "Tegar Sulistio", club: "PB Exist", matchesPlayed: 4, matchesWon: 1, setsWon: 3, pointsWon: 120 },
  { id: "p8", name: "Yohanes Saut Marcellyno", club: "PB Jaya Raya", matchesPlayed: 5, matchesWon: 2, setsWon: 5, pointsWon: 170 },
];

const DEFAULT_NOTIFICATIONS: MatchNotification[] = [
  {
    id: "notif-init",
    message: "Sistem Pengelola Turnamen Bulutangkis diaktifkan (Mode Penyelamat Vercel / Offline).",
    type: "system",
    timestamp: new Date().toLocaleTimeString('id-ID'),
  }
];

const DEFAULT_TOURNAMENT_ID = "t-utama";

// Helper to perform a proper seeded draw (avoiding early top seed match-ups)
function performSeededDraw(selectedPlayers: Player[], size: number): Player[] {
  const seeded = selectedPlayers.filter(p => p.seed !== undefined && p.seed !== null && p.seed > 0);
  const unseeded = selectedPlayers.filter(p => p.seed === undefined || p.seed === null || p.seed <= 0);

  seeded.sort((a, b) => (a.seed || 0) - (b.seed || 0));
  const shuffledUnseeded = [...unseeded].sort(() => Math.random() - 0.5);
  const orderedPlayers = [...seeded, ...shuffledUnseeded];

  let seedPattern = [1];
  while (seedPattern.length < size) {
    const nextPattern: number[] = [];
    const targetSum = seedPattern.length * 2 + 1;
    for (const x of seedPattern) {
      nextPattern.push(x);
      nextPattern.push(targetSum - x);
    }
    seedPattern = nextPattern;
  }

  const result: Player[] = new Array(size);
  for (let i = 0; i < size; i++) {
    const playerIndex = seedPattern[i] - 1;
    if (playerIndex < orderedPlayers.length) {
      result[i] = orderedPlayers[playerIndex];
    } else {
      result[i] = orderedPlayers[i % orderedPlayers.length] || selectedPlayers[0];
    }
  }

  return result;
}

// Helper to dynamically build bracket nodes and scheduled matches for any tournament size (4, 8, 16, 32, 64)
function buildBracketAndMatches(tournamentId: string, drawSize: number, shuffled: Player[], customDate: string) {
  const matches: Match[] = [];
  const brackets: BracketNode[] = [];
  const nowStr = new Date().toISOString();

  const ROUND_CONFIGS = [
    { roundIndex: 0, prefix: 'f', name: 'Final' },
    { roundIndex: 1, prefix: 's', name: 'Semifinal' },
    { roundIndex: 2, prefix: 'q', name: 'Perempat Final' },
    { roundIndex: 3, prefix: 'r', name: 'Babak 16 Besar' },
    { roundIndex: 4, prefix: 't', name: 'Babak 32 Besar' },
    { roundIndex: 5, prefix: 'x', name: 'Babak 64 Besar' }
  ];

  const totalRounds = Math.log2(drawSize);

  for (let r = totalRounds - 1; r >= 0; r--) {
    const numMatches = Math.pow(2, r);
    const config = ROUND_CONFIGS[r] || { roundIndex: r, prefix: `b${r}`, name: `Babak ${Math.pow(2, r + 1)} Besar` };

    for (let i = 0; i < numMatches; i++) {
      const matchId = `m-${tournamentId}-${config.prefix}${i + 1}`;
      let p1Id = "";
      let p2Id = "";
      let p1Name = "";
      let p2Name = "";

      if (r === totalRounds - 1) {
        const p1 = shuffled[i * 2];
        const p2 = shuffled[i * 2 + 1];
        p1Id = p1?.id || "";
        p2Id = p2?.id || "";
        p1Name = p1?.name || "Belum ada pemain";
        p2Name = p2?.name || "Belum ada pemain";
      } else {
        const prevConfig = ROUND_CONFIGS[r + 1] || { prefix: `b${r + 1}` };
        const prevPrefix = prevConfig.prefix.toUpperCase();
        p1Name = `Pemenang ${prevPrefix}${i * 2 + 1}`;
        p2Name = `Pemenang ${prevPrefix}${i * 2 + 2}`;
      }

      const match: Match = {
        id: matchId,
        player1Id: p1Id,
        player2Id: p2Id,
        player1Name: p1Name,
        player2Name: p2Name,
        status: 'scheduled',
        scores: [{ p1: 0, p2: 0 }],
        currentSet: 1,
        round: config.name,
        createdAt: nowStr,
        updatedAt: nowStr,
        customDate: customDate
      };

      const bracketNode: BracketNode = {
        id: `${config.prefix}${i + 1}`,
        roundIndex: r,
        roundName: config.name,
        matchId: matchId,
        player1Id: p1Id,
        player1Name: p1Name,
        player2Id: p2Id,
        player2Name: p2Name
      };

      if (r > 0) {
        const nextConfig = ROUND_CONFIGS[r - 1] || { prefix: `b${r - 1}` };
        bracketNode.nextMatchId = `${nextConfig.prefix}${Math.floor(i / 2) + 1}`;
      }

      matches.push(match);
      brackets.push(bracketNode);
    }
  }

  return { matches, brackets };
}

function generateDefaultTournament(players: Player[]): Tournament {
  const defaultDateStr = new Date().toISOString().split('T')[0];
  const t: Tournament = {
    id: DEFAULT_TOURNAMENT_ID,
    name: "Turnamen Utama Court 01",
    drawSize: 8,
    playerIds: players.slice(0, 8).map(p => p.id),
    matches: [],
    brackets: [],
    createdAt: new Date().toISOString(),
    customDate: defaultDateStr
  };
  
  const shuffled = [...players.slice(0, 8)];
  const { matches, brackets } = buildBracketAndMatches(DEFAULT_TOURNAMENT_ID, 8, shuffled, defaultDateStr);
  t.matches = matches;
  t.brackets = brackets;
  return t;
}

interface LocalState {
  players: Player[];
  tournaments: Tournament[];
  activeTournamentId: string;
  notifications: MatchNotification[];
  runningText: string;
  comments: SpectatorComment[];
  youtubeUrl: string;
}

function getLocalState(): LocalState {
  const stored = localStorage.getItem('bwf_tournament_state');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Gagal parse BWF local state, membuat baru", e);
    }
  }
  
  const defaultState: LocalState = {
    players: JSON.parse(JSON.stringify(DEFAULT_PLAYERS)),
    tournaments: [],
    activeTournamentId: DEFAULT_TOURNAMENT_ID,
    notifications: JSON.parse(JSON.stringify(DEFAULT_NOTIFICATIONS)),
    runningText: "Selamat Datang di Turnamen Bulutangkis Resmi BWF by Ichromn! Saksikan siaran langsung pertandingan real-time dan sampaikan komentar Anda di sini.",
    comments: [
      { id: "c-1", author: "Coach Herry IP", text: "Ginting bermain sangat agresif hari ini. Smes menyilangnya mematikan!", timestamp: new Date(Date.now() - 300000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), avatarColor: "from-emerald-500 to-teal-500" },
      { id: "c-2", author: "Budi_Lover88", text: "Wah seru sekali pertandingannya! Ayo Jojo kejar poinnya!", timestamp: new Date(Date.now() - 150000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), avatarColor: "from-indigo-500 to-purple-500" }
    ],
    youtubeUrl: "https://www.youtube.com/embed/Y-Ony4RveD4"
  };
  
  defaultState.tournaments = [generateDefaultTournament(defaultState.players)];
  saveLocalState(defaultState);
  return defaultState;
}

function saveLocalState(state: LocalState) {
  localStorage.setItem('bwf_tournament_state', JSON.stringify(state));
}

function addNotification(state: LocalState, message: string, type: MatchNotification['type'] = 'info', matchId?: string) {
  const newNotification: MatchNotification = {
    id: `notif-${generateId()}`,
    matchId,
    message,
    type,
    timestamp: new Date().toLocaleTimeString('id-ID'),
  };
  state.notifications.unshift(newNotification);
  if (state.notifications.length > 100) {
    state.notifications.pop();
  }
}

function advanceWinnerInBracket(state: LocalState, completedMatch: Match, activeTournament: Tournament) {
  const winnerId = completedMatch.winnerId;
  if (!winnerId) return;

  const winnerName = winnerId === completedMatch.player1Id ? completedMatch.player1Name : completedMatch.player2Name;
  const currentNode = activeTournament.brackets.find(node => node.matchId === completedMatch.id);
  if (!currentNode) return;

  currentNode.winnerId = winnerId;

  if (currentNode.nextMatchId) {
    const nextNode = activeTournament.brackets.find(node => node.id === currentNode.nextMatchId);
    if (nextNode) {
      const isTopBranch = ['q1', 'q3', 's1'].includes(currentNode.id);
      const nextMatchIndex = activeTournament.matches.findIndex(m => m.id === nextNode.matchId);
      
      if (nextMatchIndex !== -1) {
        if (isTopBranch) {
          activeTournament.matches[nextMatchIndex].player1Id = winnerId;
          activeTournament.matches[nextMatchIndex].player1Name = winnerName;
          nextNode.player1Id = winnerId;
          nextNode.player1Name = winnerName;
          addNotification(
            state,
            `${winnerName} lolos ke babak berikutnya dan menempati slot atas di pertandingan ${nextNode.roundName}`,
            'info',
            nextNode.matchId
          );
        } else {
          activeTournament.matches[nextMatchIndex].player2Id = winnerId;
          activeTournament.matches[nextMatchIndex].player2Name = winnerName;
          nextNode.player2Id = winnerId;
          nextNode.player2Name = winnerName;
          addNotification(
            state,
            `${winnerName} lolos ke babak berikutnya dan menempati slot bawah di pertandingan ${nextNode.roundName}`,
            'info',
            nextNode.matchId
          );
        }
        
        const updatedNextMatch = activeTournament.matches[nextMatchIndex];
        if (updatedNextMatch.player1Id && updatedNextMatch.player2Id) {
          addNotification(
            state,
            `Pertandingan ${updatedNextMatch.round}: ${updatedNextMatch.player1Name} vs ${updatedNextMatch.player2Name} siap dimulai!`,
            'system',
            updatedNextMatch.id
          );
        }
      }
    }
  } else {
    addNotification(
      state,
      `🏆 TURNAMEN SELESAI! ${winnerName} adalah Juara Turnamen Bulutangkis! 🏆`,
      'system',
      completedMatch.id
    );
  }
}

function updatePlayerStats(state: LocalState, match: Match) {
  if (match.status !== 'completed' || !match.winnerId) return;

  const p1Id = match.player1Id;
  const p2Id = match.player2Id;
  const winnerId = match.winnerId;

  const p1 = state.players.find(p => p.id === p1Id);
  const p2 = state.players.find(p => p.id === p2Id);

  if (!p1 || !p2) return;

  p1.matchesPlayed += 1;
  p2.matchesPlayed += 1;

  if (winnerId === p1Id) {
    p1.matchesWon += 1;
  } else {
    p2.matchesWon += 1;
  }

  let p1Sets = 0;
  let p2Sets = 0;
  let p1Points = 0;
  let p2Points = 0;

  match.scores.forEach(set => {
    p1Points += set.p1;
    p2Points += set.p2;

    if (set.p1 > set.p2) p1Sets += 1;
    else if (set.p2 > set.p1) p2Sets += 1;
  });

  p1.setsWon += p1Sets;
  p2.setsWon += p2Sets;
  p1.pointsWon += p1Points;
  p2.pointsWon += p2Points;
}

// Global fetch override implementation
export function initMockApi() {
  const originalFetch = window.fetch;
  let checkedServer = false;
  let useMock = false;

  const createJsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  // Perform quick initial check
  originalFetch('/api/state')
    .then(res => {
      if (res.ok) {
        useMock = false;
        (window as any).isBwfMockActive = false;
      } else {
        useMock = true;
        (window as any).isBwfMockActive = true;
      }
      checkedServer = true;
    })
    .catch(() => {
      useMock = true;
      (window as any).isBwfMockActive = true;
      checkedServer = true;
    });

  const customFetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);

    // Only intercept requests destined for '/api/'
    if (url.includes('/api/')) {
      if (!checkedServer) {
        try {
          const res = await originalFetch('/api/state');
          useMock = !res.ok;
          (window as any).isBwfMockActive = useMock;
        } catch {
          useMock = true;
          (window as any).isBwfMockActive = true;
        }
        checkedServer = true;
      }

      if (useMock) {
        try {
          return handleMockRequest(url, init);
        } catch (err: any) {
          console.error("[Mock API Error]", err);
          return createJsonResponse({ error: err.message || "Unknown mock error" }, 500);
        }
      }
    }

    // Otherwise, delegate to native fetch (or if mock is turned off)
    try {
      const response = await originalFetch(input, init);
      if (response.status === 404 && url.includes('/api/')) {
        useMock = true;
        (window as any).isBwfMockActive = true;
        return handleMockRequest(url, init);
      }
      return response;
    } catch (err) {
      if (url.includes('/api/')) {
        useMock = true;
        (window as any).isBwfMockActive = true;
        return handleMockRequest(url, init);
      }
      throw err;
    }
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: customFetch,
      writable: true,
      configurable: true,
      enumerable: true
    });
  } catch (e) {
    console.warn("Could not redefine window.fetch with Object.defineProperty, trying default assignment", e);
    try {
      (window as any).fetch = customFetch;
    } catch (err) {
      console.error("Critical: Cannot override window.fetch", err);
    }
  }

  function handleMockRequest(urlStr: string, init?: RequestInit): Response {
    const state = getLocalState();
    const activeTournament = state.tournaments.find(t => t.id === state.activeTournamentId) || state.tournaments[0];
    
    const parsedUrl = new URL(urlStr, window.location.origin);
    const path = parsedUrl.pathname;
    const method = init?.method?.toUpperCase() || 'GET';
    const bodyData = init?.body ? JSON.parse(init.body as string) : {};

    // 1. GET /api/state
    if (path === '/api/state' && method === 'GET') {
      return createJsonResponse({
        players: state.players,
        tournaments: state.tournaments,
        activeTournamentId: state.activeTournamentId,
        matches: activeTournament ? activeTournament.matches : [],
        brackets: activeTournament ? activeTournament.brackets : [],
        notifications: state.notifications,
        runningText: state.runningText,
        comments: state.comments,
        youtubeUrl: state.youtubeUrl
      });
    }

    // 2. GET /api/players
    if (path === '/api/players' && method === 'GET') {
      return createJsonResponse(state.players);
    }

    // 3. POST /api/players/generate
    if (path === '/api/players/generate' && method === 'POST') {
      const count = Number(bodyData.count) || 16;
      const firstNames = ["Marcus", "Kevin", "Hendra", "Mohammad", "Fajar", "Muhammad", "Rian", "Leo", "Daniel", "Bagas", "Shohibul", "Pramudya", "Yeremia", "Jonatan", "Anthony", "Shesar", "Chico", "Alwi", "Christian", "Tegar", "Bobby", "Yohanes", "Alvi", "Iqbal", "Jason", "Tommy", "Simon", "Taufik", "Sony", "Ardy", "Alan", "Hariyanto", "Joko", "Rudy", "Icuk", "Hastomo", "Eddy", "Hermawan", "Rexy", "Ricky", "Candra", "Sigit", "Tri", "Nova", "Liem", "King"];
      const lastNames = ["Fernaldi", "Sanjaya", "Setiawan", "Ahsan", "Alfian", "Ardianto", "Carnando", "Marthin", "Maulana", "Fikri", "Kusumawardana", "Rambitan", "Christie", "Ginting", "Rhustavito", "Wardoyo", "Farhan", "Adinata", "Sulistio", "Setiabudi", "Marcellyno", "Wijaya", "Antoni", "Christoper", "Sugiarto", "Hidayat", "Kuncoro", "Hartono", "Budiarto", "Mainaky", "Subagja", "Karono", "Gunawan", "Widianto", "Sukamuljo", "Prasetya"];
      const clubs = ["PB Djarum", "PB Tangkas", "PB Exist", "PB Jaya Raya", "SGS Bandung", "PB Mansion", "PB Mutiara Cardinal", "PB Suryanaga", "PB Champion", "PB United", "PB Raya", "PB Angkasa"];

      const generated: Player[] = [];
      const existingNames = new Set(state.players.map(p => p.name));

      for (let i = 0; i < count; i++) {
        let fullName = "";
        let attempts = 0;
        do {
          const f = firstNames[Math.floor(Math.random() * firstNames.length)];
          const l = lastNames[Math.floor(Math.random() * lastNames.length)];
          fullName = `${f} ${l}`;
          attempts++;
        } while (existingNames.has(fullName) && attempts < 100);

        existingNames.add(fullName);
        const club = clubs[Math.floor(Math.random() * clubs.length)];
        
        let seed: number | undefined = undefined;
        if (i < 8) seed = i + 1;

        const newP: Player = {
          id: `p-gen-${generateId()}`,
          name: fullName,
          club,
          matchesPlayed: Math.floor(Math.random() * 12) + 1,
          matchesWon: 0,
          setsWon: 0,
          pointsWon: 0,
          seed,
        };
        
        newP.matchesWon = Math.floor(Math.random() * newP.matchesPlayed);
        newP.setsWon = newP.matchesWon * 2 + Math.floor(Math.random() * 2);
        newP.pointsWon = newP.matchesPlayed * 80 + Math.floor(Math.random() * 120);

        generated.push(newP);
        state.players.push(newP);
      }

      addNotification(state, `⚡ Berhasil menggenerasi ${count} atlet acak!`, 'system');
      saveLocalState(state);
      return createJsonResponse({ success: true, players: generated }, 21).clone(); // Return custom 201 response clone
    }

    // 4. POST /api/players
    if (path === '/api/players' && method === 'POST') {
      const { name, club, seed } = bodyData;
      if (!name || !club) {
        return createJsonResponse({ error: "Nama dan Klub wajib diisi." }, 400);
      }

      const newPlayer: Player = {
        id: `p-${generateId()}`,
        name,
        club,
        matchesPlayed: 0,
        matchesWon: 0,
        setsWon: 0,
        pointsWon: 0,
        seed: seed ? Number(seed) : undefined,
      };

      state.players.push(newPlayer);
      addNotification(state, `Pemain baru ditambahkan: ${name} (${club})${newPlayer.seed ? ` [Seed ${newPlayer.seed}]` : ''}`, 'system');
      saveLocalState(state);
      return createJsonResponse(newPlayer, 201);
    }

    // 5. POST /api/players/:id/update
    const playerUpdateMatch = path.match(/^\/api\/players\/([^\/]+)\/update$/);
    if (playerUpdateMatch && method === 'POST') {
      const id = playerUpdateMatch[1];
      const { name, club, matchesPlayed, matchesWon, setsWon, pointsWon, seed } = bodyData;
      const player = state.players.find(p => p.id === id);
      if (!player) {
        return createJsonResponse({ error: "Pemain tidak ditemukan." }, 404);
      }

      if (name !== undefined) player.name = name;
      if (club !== undefined) player.club = club;
      if (matchesPlayed !== undefined) player.matchesPlayed = Number(matchesPlayed);
      if (matchesWon !== undefined) player.matchesWon = Number(matchesWon);
      if (setsWon !== undefined) player.setsWon = Number(setsWon);
      if (pointsWon !== undefined) player.pointsWon = Number(pointsWon);
      if (seed !== undefined) player.seed = seed ? Number(seed) : undefined;

      addNotification(state, `Informasi pemain diperbarui: ${player.name} (${player.club})${player.seed ? ` [Seed ${player.seed}]` : ''}`, 'system');
      saveLocalState(state);
      return createJsonResponse(player);
    }

    // 6. POST /api/players/:id/delete
    const playerDeleteMatch = path.match(/^\/api\/players\/([^\/]+)\/delete$/);
    if (playerDeleteMatch && method === 'POST') {
      const id = playerDeleteMatch[1];
      const index = state.players.findIndex(p => p.id === id);
      if (index === -1) {
        return createJsonResponse({ error: "Pemain tidak ditemukan." }, 404);
      }
      const deletedPlayer = state.players[index];
      state.players.splice(index, 1);
      addNotification(state, `Pemain dihapus: ${deletedPlayer.name}`, 'system');
      saveLocalState(state);
      return createJsonResponse({ success: true, deletedPlayer });
    }

    // 7. POST /api/tournament/draw
    if (path === '/api/tournament/draw' && method === 'POST') {
      const { playerIds } = bodyData;
      const size = playerIds ? playerIds.length : 0;
      
      if (!playerIds || ![4, 8, 16, 32, 64].includes(size)) {
        return createJsonResponse({ error: "Harap pilih tepat 4, 8, 16, 32, atau 64 pemain untuk diundi." }, 400);
      }

      const selectedPlayers = state.players.filter(p => playerIds.includes(p.id));
      if (selectedPlayers.length !== playerIds.length) {
        return createJsonResponse({ error: "Beberapa pemain terpilih tidak ditemukan." }, 400);
      }

      const shuffled = performSeededDraw(selectedPlayers, size);
      
      if (activeTournament) {
        activeTournament.playerIds = playerIds;
        activeTournament.matches = [];
        activeTournament.brackets = [];
        
        const nowStr = new Date().toISOString();
        const defaultDateStr = nowStr.split('T')[0];

        addNotification(state, `Pengundian turnamen acak dimulai dengan ${shuffled.length} pemain!`, 'system');

        const { matches, brackets } = buildBracketAndMatches("random", size, shuffled, defaultDateStr);
        activeTournament.matches = matches;
        activeTournament.brackets = brackets;
        saveLocalState(state);

        return createJsonResponse({
          matches: activeTournament.matches,
          brackets: activeTournament.brackets,
        });
      }
    }

    // 8. GET /api/tournaments
    if (path === '/api/tournaments' && method === 'GET') {
      return createJsonResponse(state.tournaments);
    }

    // 9. POST /api/tournaments
    if (path === '/api/tournaments' && method === 'POST') {
      const { name, drawSize, playerIds, customDate } = bodyData;
      const size = Number(drawSize);
      if (!name || name.trim() === "") {
        return createJsonResponse({ error: "Nama turnamen wajib diisi." }, 400);
      }
      if (![4, 8, 16, 32, 64].includes(size)) {
        return createJsonResponse({ error: "Ukuran turnamen harus 4, 8, 16, 32, atau 64 atlet." }, 400);
      }

      const pIds = playerIds || [];
      if (pIds.length > 0 && pIds.length !== size) {
        return createJsonResponse({ error: `Harap pilih tepat ${size} atlet untuk langsung mengundi, atau kosongkan jika ingin menyusun pemain belakangan.` }, 400);
      }

      const tDate = customDate || new Date().toISOString().split('T')[0];
      const newTournamentId = `t-${generateId()}`;
      const hasPlayers = pIds.length === size;
      
      const newTournament: Tournament = {
        id: newTournamentId,
        name,
        drawSize: size,
        playerIds: pIds,
        matches: [],
        brackets: [],
        createdAt: new Date().toISOString(),
        customDate: tDate
      };

      state.tournaments.push(newTournament);
      state.activeTournamentId = newTournamentId;

      if (hasPlayers) {
        const selectedPlayers = state.players.filter(p => pIds.includes(p.id));
        const shuffled = performSeededDraw(selectedPlayers, size);

        const { matches, brackets } = buildBracketAndMatches(newTournamentId, size, shuffled, tDate);
        newTournament.matches = matches;
        newTournament.brackets = brackets;

        addNotification(state, `🏆 Turnamen baru dibuat: ${name} (${size} Atlet) dan langsung diaktifkan!`, 'system');
      } else {
        addNotification(state, `🏆 Turnamen baru dibuat: ${name} (Braket Kosong, susun pemain belakangan)`, 'system');
      }

      saveLocalState(state);
      return createJsonResponse(newTournament, 201);
    }

    // 10. POST /api/tournaments/active
    if (path === '/api/tournaments/active' && method === 'POST') {
      const { tournamentId } = bodyData;
      const tournament = state.tournaments.find(t => t.id === tournamentId);
      if (!tournament) {
        return createJsonResponse({ error: "Turnamen tidak ditemukan." }, 404);
      }
      state.activeTournamentId = tournamentId;
      addNotification(state, `Turnamen aktif beralih ke: ${tournament.name}`, 'system');
      saveLocalState(state);
      return createJsonResponse({ success: true, activeTournamentId: tournamentId });
    }

    // 11. POST /api/tournaments/:id/update
    const tournamentUpdateMatch = path.match(/^\/api\/tournaments\/([^\/]+)\/update$/);
    if (tournamentUpdateMatch && method === 'POST') {
      const id = tournamentUpdateMatch[1];
      const { name, customDate } = bodyData;
      const tournament = state.tournaments.find(t => t.id === id);
      if (!tournament) {
        return createJsonResponse({ error: "Turnamen tidak ditemukan." }, 404);
      }
      if (name !== undefined && name.trim() !== "") {
        tournament.name = name;
      }
      if (customDate !== undefined) {
        tournament.customDate = customDate;
      }
      addNotification(state, `Turnamen diperbarui: ${tournament.name}`, 'system');
      saveLocalState(state);
      return createJsonResponse(tournament);
    }

    // 12. POST /api/tournaments/:id/delete
    const tournamentDeleteMatch = path.match(/^\/api\/tournaments\/([^\/]+)\/delete$/);
    if (tournamentDeleteMatch && method === 'POST') {
      const id = tournamentDeleteMatch[1];
      const index = state.tournaments.findIndex(t => t.id === id);
      if (index === -1) {
        return createJsonResponse({ error: "Turnamen tidak ditemukan." }, 404);
      }
      const deletedTournament = state.tournaments[index];
      state.tournaments.splice(index, 1);
      
      if (state.activeTournamentId === id) {
        if (state.tournaments.length > 0) {
          state.activeTournamentId = state.tournaments[0].id;
        } else {
          const defaultT = generateDefaultTournament(state.players);
          state.tournaments.push(defaultT);
          state.activeTournamentId = defaultT.id;
        }
      }
      
      addNotification(state, `Turnamen dihapus: ${deletedTournament.name}`, 'system');
      saveLocalState(state);
      return createJsonResponse({ success: true, activeTournamentId: state.activeTournamentId });
    }

    // 13. GET /api/matches
    if (path === '/api/matches' && method === 'GET') {
      return createJsonResponse(activeTournament ? activeTournament.matches : []);
    }

    // 14. POST /api/matches/:id/update
    const matchUpdateMatch = path.match(/^\/api\/matches\/([^\/]+)\/update$/);
    if (matchUpdateMatch && method === 'POST') {
      const id = matchUpdateMatch[1];
      const { customDate, customTime, player1Name, player2Name } = bodyData;
      const matches = activeTournament ? activeTournament.matches : [];
      const match = matches.find(m => m.id === id);
      if (!match) {
        return createJsonResponse({ error: "Pertandingan tidak ditemukan." }, 404);
      }

      if (customDate !== undefined) match.customDate = customDate;
      if (customTime !== undefined) match.customTime = customTime;
      if (player1Name !== undefined) match.player1Name = player1Name;
      if (player2Name !== undefined) match.player2Name = player2Name;

      match.updatedAt = new Date().toISOString();
      saveLocalState(state);
      return createJsonResponse(match);
    }

    // 15. GET /api/notifications
    if (path === '/api/notifications' && method === 'GET') {
      return createJsonResponse(state.notifications);
    }

    // 16. POST /api/matches/:id/start
    const matchStartMatch = path.match(/^\/api\/matches\/([^\/]+)\/start$/);
    if (matchStartMatch && method === 'POST') {
      const id = matchStartMatch[1];
      const matches = activeTournament ? activeTournament.matches : [];
      const match = matches.find(m => m.id === id);

      if (!match) {
        return createJsonResponse({ error: "Pertandingan tidak ditemukan." }, 404);
      }
      if (!match.player1Id || !match.player2Id) {
        return createJsonResponse({ error: "Pemain belum lengkap untuk memulai pertandingan ini." }, 400);
      }

      const liveMatch = matches.find(m => m.status === 'live');
      if (liveMatch && liveMatch.id !== id) {
        return createJsonResponse({ error: `Silakan selesaikan pertandingan live saat ini (${liveMatch.player1Name} vs ${liveMatch.player2Name}) terlebih dahulu.` }, 400);
      }

      match.status = 'live';
      match.scores = [{ p1: 0, p2: 0 }];
      match.currentSet = 1;
      match.updatedAt = new Date().toISOString();

      addNotification(state, `▶️ PERTANDINGAN MULAI! ${match.player1Name} vs ${match.player2Name} (${match.round})`, 'system', match.id);
      saveLocalState(state);
      return createJsonResponse(match);
    }

    // 17. POST /api/matches/:id/score
    const matchScoreMatch = path.match(/^\/api\/matches\/([^\/]+)\/score$/);
    if (matchScoreMatch && method === 'POST') {
      const id = matchScoreMatch[1];
      const { playerIndex, action } = bodyData;
      const matches = activeTournament ? activeTournament.matches : [];
      const match = matches.find(m => m.id === id);

      if (!match) {
        return createJsonResponse({ error: "Pertandingan tidak ditemukan." }, 404);
      }
      if (match.status !== 'live') {
        return createJsonResponse({ error: "Hanya pertandingan aktif (LIVE) yang dapat diubah skornya." }, 400);
      }

      const setIdx = match.currentSet - 1;
      if (!match.scores[setIdx]) {
        match.scores[setIdx] = { p1: 0, p2: 0 };
      }

      const currentScore = match.scores[setIdx];

      if (action === 'finish-set') {
        const setWinner = Number(playerIndex) || 1;
        const s1 = currentScore.p1;
        const s2 = currentScore.p2;
        if (setWinner === 1) {
          currentScore.p1 = s1 >= 21 ? s1 : 21;
        } else {
          currentScore.p2 = s2 >= 21 ? s2 : 21;
        }
        
        const winnerName = setWinner === 1 ? match.player1Name : match.player2Name;
        addNotification(
          state,
          `🎾 Set ${match.currentSet} Selesai Awal! Dimenangkan oleh ${winnerName} dengan skor ${currentScore.p1}-${currentScore.p2}`,
          'set_complete',
          match.id
        );

        let setsWonP1 = 0;
        let setsWonP2 = 0;

        match.scores.forEach((score) => {
          if (score.p1 > score.p2) setsWonP1 += 1;
          else if (score.p2 > score.p1) setsWonP2 += 1;
        });

        if (setsWonP1 === 2) {
          match.status = 'completed';
          match.winnerId = match.player1Id;
          addNotification(
            state,
            `🎉 PERTANDINGAN SELESAI AWAL! ${match.player1Name} mengalahkan ${match.player2Name} dengan set ${setsWonP1}-${setsWonP2}!`,
            'match_complete',
            match.id
          );
          updatePlayerStats(state, match);
          if (activeTournament) advanceWinnerInBracket(state, match, activeTournament);
        } else if (setsWonP2 === 2) {
          match.status = 'completed';
          match.winnerId = match.player2Id;
          addNotification(
            state,
            `🎉 PERTANDINGAN SELESAI AWAL! ${match.player2Name} mengalahkan ${match.player1Name} dengan set ${setsWonP2}-${setsWonP1}!`,
            'match_complete',
            match.id
          );
          updatePlayerStats(state, match);
          if (activeTournament) advanceWinnerInBracket(state, match, activeTournament);
        } else {
          match.currentSet += 1;
          match.scores.push({ p1: 0, p2: 0 });
          addNotification(state, `Memulai Set ${match.currentSet}!`, 'system', match.id);
        }
        
        match.updatedAt = new Date().toISOString();
        saveLocalState(state);
        return createJsonResponse(match);
      }

      if (action === 'finish-match') {
        const matchWinner = Number(playerIndex) || 1;
        
        if (matchWinner === 1) {
          currentScore.p1 = currentScore.p1 >= 21 ? currentScore.p1 : 21;
          match.status = 'completed';
          match.winnerId = match.player1Id;
          
          addNotification(
            state,
            `🎉 PERTANDINGAN SELESAI CEPAT! ${match.player1Name} dinyatakan menang atas ${match.player2Name}!`,
            'match_complete',
            match.id
          );
        } else {
          currentScore.p2 = currentScore.p2 >= 21 ? currentScore.p2 : 21;
          match.status = 'completed';
          match.winnerId = match.player2Id;
          
          addNotification(
            state,
            `🎉 PERTANDINGAN SELESAI CEPAT! ${match.player2Name} dinyatakan menang atas ${match.player1Name}!`,
            'match_complete',
            match.id
          );
        }
        
        updatePlayerStats(state, match);
        if (activeTournament) advanceWinnerInBracket(state, match, activeTournament);
        match.updatedAt = new Date().toISOString();
        saveLocalState(state);
        return createJsonResponse(match);
      }

      if (playerIndex === 1) {
        if (action === 'increment') {
          currentScore.p1 += 1;
        } else if (action === 'decrement' && currentScore.p1 > 0) {
          currentScore.p1 -= 1;
        }
      } else if (playerIndex === 2) {
        if (action === 'increment') {
          currentScore.p2 += 1;
        } else if (action === 'decrement' && currentScore.p2 > 0) {
          currentScore.p2 -= 1;
        }
      } else {
        return createJsonResponse({ error: "Pemain tidak valid. Gunakan playerIndex 1 atau 2." }, 400);
      }

      match.updatedAt = new Date().toISOString();

      addNotification(
        state,
        `Poin: ${match.player1Name} [${currentScore.p1}] - [${currentScore.p2}] ${match.player2Name} (Set ${match.currentSet})`,
        'score',
        match.id
      );

      const p1Score = currentScore.p1;
      const p2Score = currentScore.p2;

      const isSetWon = (p1: number, p2: number) => {
        if (p1 >= 30) return true;
        return false;
      };

      let setCompleted = false;
      let setWinner = 0;

      if (isSetWon(p1Score, p2Score)) {
        setCompleted = true;
        setWinner = 1;
      } else if (isSetWon(p2Score, p1Score)) {
        setCompleted = true;
        setWinner = 2;
      }

      if (setCompleted) {
        const winnerName = setWinner === 1 ? match.player1Name : match.player2Name;
        addNotification(
          state,
          `🎾 Set ${match.currentSet} Selesai! Dimenangkan oleh ${winnerName} dengan skor ${p1Score}-${p2Score}`,
          'set_complete',
          match.id
        );

        let setsWonP1 = 0;
        let setsWonP2 = 0;

        match.scores.forEach((score) => {
          if (score.p1 > score.p2) setsWonP1 += 1;
          else if (score.p2 > score.p1) setsWonP2 += 1;
        });

        if (setsWonP1 === 2) {
          match.status = 'completed';
          match.winnerId = match.player1Id;
          addNotification(
            state,
            `🎉 PERTANDINGAN SELESAI! ${match.player1Name} mengalahkan ${match.player2Name} dengan set ${setsWonP1}-${setsWonP2}!`,
            'match_complete',
            match.id
          );
          updatePlayerStats(state, match);
          if (activeTournament) advanceWinnerInBracket(state, match, activeTournament);
        } else if (setsWonP2 === 2) {
          match.status = 'completed';
          match.winnerId = match.player2Id;
          addNotification(
            state,
            `🎉 PERTANDINGAN SELESAI! ${match.player2Name} mengalahkan ${match.player1Name} dengan set ${setsWonP2}-${setsWonP1}!`,
            'match_complete',
            match.id
          );
          updatePlayerStats(state, match);
          if (activeTournament) advanceWinnerInBracket(state, match, activeTournament);
        } else {
          match.currentSet += 1;
          match.scores.push({ p1: 0, p2: 0 });
          addNotification(state, `Memulai Set ${match.currentSet}!`, 'system', match.id);
        }
      }

      saveLocalState(state);
      return createJsonResponse(match);
    }

    // 18. POST /api/external/update-score
    if (path === '/api/external/update-score' && method === 'POST') {
      const { apiKey, matchId, player, points, action } = bodyData;
      if (apiKey !== "BADMINTON_SECRET_2026") {
        return createJsonResponse({ error: "Kunci API (apiKey) tidak sah. Gunakan 'BADMINTON_SECRET_2026'." }, 401);
      }

      const matches = activeTournament ? activeTournament.matches : [];
      const match = matches.find(m => m.id === matchId);
      if (!match) {
        return createJsonResponse({ error: "ID Pertandingan tidak ditemukan." }, 404);
      }
      if (match.status !== 'live') {
        return createJsonResponse({ error: "Hanya pertandingan aktif (LIVE) yang dapat menerima input API." }, 400);
      }
      if (player !== 1 && player !== 2) {
        return createJsonResponse({ error: "Pemain tidak valid. Gunakan angka 1 atau 2." }, 400);
      }

      const setIdx = match.currentSet - 1;
      if (!match.scores[setIdx]) {
        match.scores[setIdx] = { p1: 0, p2: 0 };
      }

      const currentScore = match.scores[setIdx];
      addNotification(state, `🔌 [API Update] Menerima sinyal pembaruan eksternal`, 'system', match.id);

      if (action === "set-score") {
        const pNum = Number(points);
        if (isNaN(pNum) || pNum < 0) {
          return createJsonResponse({ error: "Format points harus angka positif saat menggunakan action 'set-score'." }, 400);
        }
        if (player === 1) currentScore.p1 = pNum;
        else currentScore.p2 = pNum;
      } else {
        if (player === 1) currentScore.p1 += 1;
        else currentScore.p2 += 1;
      }

      match.updatedAt = new Date().toISOString();

      addNotification(
        state,
        `Poin: ${match.player1Name} [${currentScore.p1}] - [${currentScore.p2}] ${match.player2Name} (Set ${match.currentSet})`,
        'score',
        match.id
      );

      const p1Score = currentScore.p1;
      const p2Score = currentScore.p2;

      const isSetWon = (p1: number, p2: number) => {
        if (p1 >= 30) return true;
        return false;
      };

      let setCompleted = false;
      let setWinner = 0;

      if (isSetWon(p1Score, p2Score)) {
        setCompleted = true;
        setWinner = 1;
      } else if (isSetWon(p2Score, p1Score)) {
        setCompleted = true;
        setWinner = 2;
      }

      if (setCompleted) {
        const winnerName = setWinner === 1 ? match.player1Name : match.player2Name;
        addNotification(
          state,
          `🎾 Set ${match.currentSet} Selesai! Dimenangkan oleh ${winnerName} dengan skor ${p1Score}-${p2Score}`,
          'set_complete',
          match.id
        );

        let setsWonP1 = 0;
        let setsWonP2 = 0;

        match.scores.forEach((score) => {
          if (score.p1 > score.p2) setsWonP1 += 1;
          else if (score.p2 > score.p1) setsWonP2 += 1;
        });

        if (setsWonP1 === 2) {
          match.status = 'completed';
          match.winnerId = match.player1Id;
          addNotification(
            state,
            `🎉 PERTANDINGAN SELESAI! ${match.player1Name} mengalahkan ${match.player2Name} dengan set ${setsWonP1}-${setsWonP2}!`,
            'match_complete',
            match.id
          );
          updatePlayerStats(state, match);
          if (activeTournament) advanceWinnerInBracket(state, match, activeTournament);
        } else if (setsWonP2 === 2) {
          match.status = 'completed';
          match.winnerId = match.player2Id;
          addNotification(
            state,
            `🎉 PERTANDINGAN SELESAI! ${match.player2Name} mengalahkan ${match.player1Name} dengan set ${setsWonP2}-${setsWonP1}!`,
            'match_complete',
            match.id
          );
          updatePlayerStats(state, match);
          if (activeTournament) advanceWinnerInBracket(state, match, activeTournament);
        } else {
          match.currentSet += 1;
          match.scores.push({ p1: 0, p2: 0 });
          addNotification(state, `Memulai Set ${match.currentSet}!`, 'system', match.id);
        }
      }

      saveLocalState(state);
      return createJsonResponse(match);
    }

    // 19. POST /api/running-text
    if (path === '/api/running-text' && method === 'POST') {
      const { text } = bodyData;
      state.runningText = text !== undefined ? text : "";
      addNotification(state, `📢 Running Text diperbarui`, 'system');
      saveLocalState(state);
      return createJsonResponse({ success: true, runningText: state.runningText });
    }

    // 20. POST /api/youtube-url
    if (path === '/api/youtube-url' && method === 'POST') {
      const { url } = bodyData;
      state.youtubeUrl = url !== undefined ? url : "https://www.youtube.com/embed/Y-Ony4RveD4";
      addNotification(state, `🎥 Link Video Pertandingan YouTube diperbarui`, 'system');
      saveLocalState(state);
      return createJsonResponse({ success: true, youtubeUrl: state.youtubeUrl });
    }

    // 21. POST /api/comments
    if (path === '/api/comments' && method === 'POST') {
      const { author, text } = bodyData;
      if (!text || text.trim() === "") {
        return createJsonResponse({ error: "Komentar tidak boleh kosong." }, 400);
      }
      const nickname = author && author.trim() !== "" ? author.trim() : "Penonton Anonim";
      
      const colors = [
        "from-emerald-500 to-teal-500",
        "from-indigo-500 to-purple-500",
        "from-rose-500 to-pink-500",
        "from-amber-500 to-orange-500",
        "from-sky-500 to-blue-500",
        "from-violet-500 to-fuchsia-500"
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newComment: SpectatorComment = {
        id: `c-${generateId()}`,
        author: nickname,
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        avatarColor: randomColor
      };

      state.comments.unshift(newComment);
      if (state.comments.length > 50) {
        state.comments.pop();
      }

      addNotification(state, `💬 Komentar baru dari ${nickname}: "${text.substring(0, 30)}"`, 'info');
      saveLocalState(state);
      return createJsonResponse(newComment, 201);
    }

    // 22. POST /api/reset
    if (path === '/api/reset' && method === 'POST') {
      localStorage.removeItem('bwf_tournament_state');
      const freshState = getLocalState();
      addNotification(freshState, "Sistem berhasil direset ke pengaturan awal.", 'system');
      saveLocalState(freshState);
      return createJsonResponse({ success: true, message: "Sistem berhasil direset." });
    }

    // Default 404 fallback
    return createJsonResponse({ error: "Endpoint tidak ditemukan" }, 404);
  }
}
