/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import fs from "fs";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, setLogLevel } from "firebase/firestore";
import { createServer as createViteServer } from "vite";
import { 
  Player, 
  Match, 
  BracketNode, 
  MatchNotification, 
  ServerState,
  MatchScore,
  Tournament,
  SpectatorComment
} from "./src/types.js";

// Helper for generating unique IDs
const generateId = () => Math.random().toString(36).substring(2, 11);

// Helper to perform a proper seeded draw (avoiding early top seed match-ups)
function performSeededDraw(selectedPlayers: Player[], size: number): Player[] {
  // 1. Separate seeded players (seed > 0) and unseeded players
  const seeded = selectedPlayers.filter(p => p.seed !== undefined && p.seed !== null && p.seed > 0);
  const unseeded = selectedPlayers.filter(p => p.seed === undefined || p.seed === null || p.seed <= 0);

  // 2. Sort seeded players by seed ascending (1, 2, 3, etc.)
  seeded.sort((a, b) => (a.seed || 0) - (b.seed || 0));

  // 3. Shuffle unseeded players randomly
  const shuffledUnseeded = [...unseeded].sort(() => Math.random() - 0.5);

  // 4. Combine them into an ordered list: seeded first (sorted), then unseeded (shuffled)
  const orderedPlayers = [...seeded, ...shuffledUnseeded];

  // 5. Generate standard seeding pattern of 1-based positions for any power of 2
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

  // 6. Map pattern to players
  const result: Player[] = new Array(size);
  for (let i = 0; i < size; i++) {
    const playerIndex = seedPattern[i] - 1;
    if (playerIndex < orderedPlayers.length) {
      result[i] = orderedPlayers[playerIndex];
    }
  }

  return result;
}

// Helper to dynamically build bracket nodes and scheduled matches for any tournament size, supporting arbitrary player counts
function buildBracketAndMatches(tournamentId: string, drawSize: number, shuffled: Player[], customDate: string) {
  const matches: Match[] = [];
  const brackets: BracketNode[] = [];
  const nowStr = new Date().toISOString();

  // Determine the next power of 2 of shuffled.length (min 4)
  let actualDrawSize = 4;
  const pCount = shuffled.length;
  if (pCount > 32) actualDrawSize = 64;
  else if (pCount > 16) actualDrawSize = 32;
  else if (pCount > 8) actualDrawSize = 16;
  else if (pCount > 4) actualDrawSize = 8;
  else actualDrawSize = 4;

  // Pad players with "BYE (Free Pass)"
  const paddedPlayers = [...shuffled];
  while (paddedPlayers.length < actualDrawSize) {
    paddedPlayers.push({
      id: `bye-${Math.random().toString(36).substring(2, 7)}`,
      name: "BYE (Free Pass)",
      club: "BWF",
      matchesPlayed: 0,
      matchesWon: 0,
      setsWon: 0,
      pointsWon: 0
    });
  }

  const ROUND_CONFIGS = [
    { roundIndex: 0, prefix: 'f', name: 'Final' },
    { roundIndex: 1, prefix: 's', name: 'Semifinal' },
    { roundIndex: 2, prefix: 'q', name: 'Perempat Final' },
    { roundIndex: 3, prefix: 'r', name: 'Babak 16 Besar' },
    { roundIndex: 4, prefix: 't', name: 'Babak 32 Besar' },
    { roundIndex: 5, prefix: 'x', name: 'Babak 64 Besar' }
  ];

  const totalRounds = Math.log2(actualDrawSize); // e.g. 3 for size 8

  // We build rounds from the first round (totalRounds - 1) down to 0 (Final)
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
        // First round has actual players
        const p1 = paddedPlayers[i * 2];
        const p2 = paddedPlayers[i * 2 + 1];
        p1Id = p1?.id || "";
        p2Id = p2?.id || "";
        p1Name = p1?.name || "Belum ada pemain";
        p2Name = p2?.name || "Belum ada pemain";
      } else {
        // Subsequent rounds have "Pemenang [Previous Round Prefix][Index]"
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

  // Local propagation of BYE matches: if a match contains a BYE player, auto-complete and advance the winner
  for (let r = totalRounds - 1; r >= 0; r--) {
    const config = ROUND_CONFIGS[r] || { prefix: `b${r}` };
    const roundMatches = matches.filter(m => m.id.includes(`-${config.prefix}`));

    for (const match of roundMatches) {
      const hasP1Bye = match.player1Name === "BYE (Free Pass)";
      const hasP2Bye = match.player2Name === "BYE (Free Pass)";

      if ((hasP1Bye || hasP2Bye) && match.status === 'scheduled') {
        match.status = 'completed';
        if (hasP1Bye && hasP2Bye) {
          match.winnerId = match.player1Id;
          match.scores = [{ p1: 0, p2: 0 }];
        } else if (hasP1Bye) {
          match.winnerId = match.player2Id;
          match.scores = [{ p1: 0, p2: 21 }, { p1: 0, p2: 21 }];
        } else {
          match.winnerId = match.player1Id;
          match.scores = [{ p1: 21, p2: 0 }, { p1: 21, p2: 0 }];
        }

        const winnerId = match.winnerId;
        const winnerName = winnerId === match.player1Id ? match.player1Name : match.player2Name;

        const currentNode = brackets.find(node => node.matchId === match.id);
        if (currentNode) {
          currentNode.winnerId = winnerId;
          if (currentNode.nextMatchId) {
            const nextNode = brackets.find(node => node.id === currentNode.nextMatchId);
            if (nextNode) {
              const matchIndexStr = currentNode.id.replace(/^\D+/g, '');
              const matchIndexVal = parseInt(matchIndexStr, 10) || 1;
              const isTopBranch = matchIndexVal % 2 === 1;

              const nextMatch = matches.find(m => m.id === nextNode.matchId);
              if (nextMatch) {
                if (isTopBranch) {
                  nextMatch.player1Id = winnerId;
                  nextMatch.player1Name = winnerName;
                  nextNode.player1Id = winnerId;
                  nextNode.player1Name = winnerName;
                } else {
                  nextMatch.player2Id = winnerId;
                  nextMatch.player2Name = winnerName;
                  nextNode.player2Id = winnerId;
                  nextNode.player2Name = winnerName;
                }
              }
            }
          }
        }
      }
    }
  }

  return { matches, brackets };
}

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
    message: "Sistem Pengelola Turnamen Bulutangkis diaktifkan. Siap untuk pertandingan!",
    type: "system",
    timestamp: new Date().toLocaleTimeString('id-ID'),
  }
];

const DEFAULT_TOURNAMENT_ID = "t-utama";
const generateDefaultTournament = () => {
  const defaultDateStr = new Date().toISOString().split('T')[0];
  const t: Tournament = {
    id: DEFAULT_TOURNAMENT_ID,
    name: "Turnamen Utama Court 01",
    drawSize: 8,
    playerIds: DEFAULT_PLAYERS.map(p => p.id),
    matches: [],
    brackets: [],
    createdAt: new Date().toISOString(),
    customDate: defaultDateStr
  };
  
  const shuffled = [...DEFAULT_PLAYERS];
  const { matches, brackets } = buildBracketAndMatches(DEFAULT_TOURNAMENT_ID, 8, shuffled, defaultDateStr);
  t.matches = matches;
  t.brackets = brackets;
  return t;
};

// In-Memory Database State
let state = {
  players: JSON.parse(JSON.stringify(DEFAULT_PLAYERS)),
  tournaments: [generateDefaultTournament()],
  activeTournamentId: DEFAULT_TOURNAMENT_ID,
  notifications: JSON.parse(JSON.stringify(DEFAULT_NOTIFICATIONS)),
  runningText: "Selamat Datang di Turnamen Bulutangkis Resmi BWF by Ichromn! Saksikan siaran langsung pertandingan real-time dan sampaikan komentar Anda di sini.",
  comments: [
    { id: "c-1", author: "Coach Herry IP", text: "Ginting bermain sangat agresif hari ini. Smes menyilangnya mematikan!", timestamp: new Date(Date.now() - 300000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), avatarColor: "from-emerald-500 to-teal-500" },
    { id: "c-2", author: "Budi_Lover88", text: "Wah seru sekali pertandingannya! Ayo Jojo kejar poinnya!", timestamp: new Date(Date.now() - 150000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), avatarColor: "from-indigo-500 to-purple-500" }
  ] as SpectatorComment[],
  youtubeUrl: "https://www.youtube.com/embed/Y-Ony4RveD4",
  registrationClosed: false,
  appTitle: "BWF TOURNAMENT",
  appLogo: "🏆",

  // Getter/setter for backward compatibility with existing server.ts match-managing code
  get matches() {
    const activeT = this.tournaments.find(t => t.id === this.activeTournamentId);
    return activeT ? activeT.matches : [];
  },
  set matches(val: Match[]) {
    const activeT = this.tournaments.find(t => t.id === this.activeTournamentId);
    if (activeT) {
      activeT.matches = val;
    }
  },

  get brackets() {
    const activeT = this.tournaments.find(t => t.id === this.activeTournamentId);
    return activeT ? activeT.brackets : [];
  },
  set brackets(val: BracketNode[]) {
    const activeT = this.tournaments.find(t => t.id === this.activeTournamentId);
    if (activeT) {
      activeT.brackets = val;
    }
  }
};

// Lazy-initialized Firestore connection
let firestoreDb: any = null;
let firestoreDbId: string | null = null;
let lastSyncTime: string | null = null;

function getDb() {
  if (firestoreDb) return firestoreDb;
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const firebaseApp = initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
      });
      setLogLevel("error");
      firestoreDb = getFirestore(firebaseApp, config.firestoreDatabaseId || "(default)");
      firestoreDbId = config.firestoreDatabaseId || "(default)";
      console.log("🔥 Firebase Firestore connected successfully. Database ID:", firestoreDbId);
    } else {
      console.warn("⚠️ No firebase-applet-config.json file found. Running in-memory database only.");
    }
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Firestore:", err);
  }
  return firestoreDb;
}

// Save current system state to Firestore
async function saveStateToOnlineDb() {
  const dbInstance = getDb();
  if (!dbInstance) return;
  try {
    const stateDocRef = doc(dbInstance, "bwf_system", "state");
    const nowStr = new Date().toISOString();
    const stateToSave = {
      players: state.players,
      tournaments: state.tournaments,
      activeTournamentId: state.activeTournamentId,
      notifications: state.notifications,
      runningText: state.runningText,
      comments: state.comments,
      youtubeUrl: state.youtubeUrl,
      registrationClosed: !!state.registrationClosed,
      appTitle: state.appTitle || "BWF TOURNAMENT",
      appLogo: state.appLogo || "🏆",
      updatedAt: nowStr
    };
    const cleanedState = JSON.parse(JSON.stringify(stateToSave));
    await setDoc(stateDocRef, cleanedState);
    lastSyncTime = nowStr;
    console.log("💾 State successfully synchronized with Firestore online database!");
  } catch (err) {
    console.error("❌ Error writing state to Firestore:", err);
  }
}

// Load system state from Firestore
async function loadStateFromOnlineDb() {
  const dbInstance = getDb();
  if (!dbInstance) return;
  try {
    const stateDocRef = doc(dbInstance, "bwf_system", "state");
    const docSnap = await getDoc(stateDocRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.players) state.players = data.players;
      if (data.tournaments) state.tournaments = data.tournaments;
      if (data.activeTournamentId) state.activeTournamentId = data.activeTournamentId;
      if (data.notifications) state.notifications = data.notifications;
      if (data.runningText !== undefined) state.runningText = data.runningText;
      if (data.comments) state.comments = data.comments;
      if (data.youtubeUrl) state.youtubeUrl = data.youtubeUrl;
      if (data.registrationClosed !== undefined) state.registrationClosed = !!data.registrationClosed;
      if (data.appTitle !== undefined) state.appTitle = data.appTitle;
      if (data.appLogo !== undefined) state.appLogo = data.appLogo;
      lastSyncTime = data.updatedAt || new Date().toISOString();
      console.log("📥 State loaded successfully from Firestore online database!");
    } else {
      console.log("ℹ️ No state found in Firestore. Initializing first-time setup online...");
      await saveStateToOnlineDb();
    }
  } catch (err) {
    console.error("❌ Error reading state from Firestore:", err);
  }
}

// Log a notification to the system
function addNotification(message: string, type: MatchNotification['type'] = 'info', matchId?: string) {
  const newNotification: MatchNotification = {
    id: `notif-${generateId()}`,
    matchId,
    message,
    type,
    timestamp: new Date().toLocaleTimeString('id-ID'),
  };
  state.notifications.unshift(newNotification);
  // Keep only the last 100 notifications
  if (state.notifications.length > 100) {
    state.notifications.pop();
  }
  return newNotification;
}

// Function to advance winner in brackets
function advanceWinnerInBracket(completedMatch: Match) {
  const winnerId = completedMatch.winnerId;
  if (!winnerId) return;

  const winnerName = winnerId === completedMatch.player1Id ? completedMatch.player1Name : completedMatch.player2Name;

  // Find the bracket node corresponding to this completed match
  const currentNode = state.brackets.find(node => node.matchId === completedMatch.id);
  if (!currentNode) return;

  currentNode.winnerId = winnerId;

  // Find if there is a next match in the tournament bracket
  if (currentNode.nextMatchId) {
    const nextNode = state.brackets.find(node => node.id === currentNode.nextMatchId);
    if (nextNode) {
      // Determine which slot in the next match this winner fills
      // Let's check if this current node is the "top" or "bottom" feed.
      // We can check this by comparing bracket IDs, or simply assigning it.
      // A robust way: If player1 is not filled in the next match, or if this match's index in relation to parent
      // dictates the slot.
      // Let's do it based on node ID matching:
      // If our current node ID is 'q1' or 'q3' or 's1' -> it feeds player 1 of the next match.
      // If our current node ID is 'q2' or 'q4' or 's2' -> it feeds player 2 of the next match.
      const matchIndexStr = currentNode.id.replace(/^\D+/g, '');
      const matchIndexVal = parseInt(matchIndexStr, 10) || 1;
      const isTopBranch = matchIndexVal % 2 === 1;
      
      // Find the actual next match object
      const nextMatchIndex = state.matches.findIndex(m => m.id === nextNode.matchId);
      
      if (nextMatchIndex !== -1) {
        if (isTopBranch) {
          state.matches[nextMatchIndex].player1Id = winnerId;
          state.matches[nextMatchIndex].player1Name = winnerName;
          nextNode.player1Id = winnerId;
          nextNode.player1Name = winnerName;
          addNotification(
            `${winnerName} lolos ke babak berikutnya dan menempati slot atas di pertandingan ${nextNode.roundName}`,
            'info',
            nextNode.matchId
          );
        } else {
          state.matches[nextMatchIndex].player2Id = winnerId;
          state.matches[nextMatchIndex].player2Name = winnerName;
          nextNode.player2Id = winnerId;
          nextNode.player2Name = winnerName;
          addNotification(
            `${winnerName} lolos ke babak berikutnya dan menempati slot bawah di pertandingan ${nextNode.roundName}`,
            'info',
            nextNode.matchId
          );
        }
        
        // If both players are now present in the next match, mark it as ready
        const updatedNextMatch = state.matches[nextMatchIndex];
        if (updatedNextMatch.player1Id && updatedNextMatch.player2Id) {
          addNotification(
            `Pertandingan ${updatedNextMatch.round}: ${updatedNextMatch.player1Name} vs ${updatedNextMatch.player2Name} siap dimulai!`,
            'system',
            updatedNextMatch.id
          );
        }
      }
    }
  } else {
    // This was the final match! Champion crowned!
    addNotification(
      `🏆 TURNAMEN SELESAI! ${winnerName} adalah Juara Turnamen Bulutangkis! 🏆`,
      'system',
      completedMatch.id
    );
  }
}

// Update player statistics in memory
function updatePlayerStats(match: Match) {
  if (match.status !== 'completed' || !match.winnerId) return;

  const p1Id = match.player1Id;
  const p2Id = match.player2Id;
  const winnerId = match.winnerId;

  // Find players
  const p1 = state.players.find(p => p.id === p1Id);
  const p2 = state.players.find(p => p.id === p2Id);

  if (!p1 || !p2) return;

  // Initialize/Update stats
  p1.matchesPlayed += 1;
  p2.matchesPlayed += 1;

  if (winnerId === p1Id) {
    p1.matchesWon += 1;
  } else {
    p2.matchesWon += 1;
  }

  // Count sets won and points won in this match
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

// Create the express app
async function startServer() {
  const app = express();
  const PORT = 3000;

  // Load online database state on startup
  await loadStateFromOnlineDb();

  app.use(express.json());

  // Automatically sync with online database on successful state-mutating POST requests
  app.use((req, res, next) => {
    res.on('finish', () => {
      if (req.method === 'POST' && res.statusCode >= 200 && res.statusCode < 300) {
        // Trigger non-blocking database write
        saveStateToOnlineDb().catch(err => {
          console.error("Async state sync error:", err);
        });
      }
    });
    next();
  });

  // API Routes: Player Management
  app.get("/api/players", (req, res) => {
    res.json(state.players);
  });

  app.post("/api/players/generate", (req, res) => {
    const { count } = req.body;
    const numToGenerate = Number(count) || 16;
    
    const firstNames = ["Marcus", "Kevin", "Hendra", "Mohammad", "Fajar", "Muhammad", "Rian", "Leo", "Daniel", "Bagas", "Shohibul", "Pramudya", "Yeremia", "Jonatan", "Anthony", "Shesar", "Chico", "Alwi", "Christian", "Tegar", "Bobby", "Yohanes", "Alvi", "Iqbal", "Jason", "Tommy", "Simon", "Taufik", "Sony", "Ardy", "Alan", "Hariyanto", "Joko", "Rudy", "Icuk", "Hastomo", "Eddy", "Hermawan", "Rexy", "Ricky", "Candra", "Sigit", "Tri", "Nova", "Liem", "King"];
    const lastNames = ["Fernaldi", "Sanjaya", "Setiawan", "Ahsan", "Alfian", "Ardianto", "Carnando", "Marthin", "Maulana", "Fikri", "Kusumawardana", "Rambitan", "Christie", "Ginting", "Rhustavito", "Wardoyo", "Farhan", "Adinata", "Sulistio", "Setiabudi", "Marcellyno", "Wijaya", "Antoni", "Christoper", "Sugiarto", "Hidayat", "Kuncoro", "Hartono", "Budiarto", "Mainaky", "Subagja", "Karono", "Gunawan", "Widianto", "Sukamuljo", "Prasetya"];
    const clubs = ["PB Djarum", "PB Tangkas", "PB Exist", "PB Jaya Raya", "SGS Bandung", "PB Mansion", "PB Mutiara Cardinal", "PB Suryanaga", "PB Champion", "PB United", "PB Raya", "PB Angkasa"];

    const generated: Player[] = [];
    const existingNames = new Set(state.players.map(p => p.name));

    // Seed top 8 of the generated players
    for (let i = 0; i < numToGenerate; i++) {
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
      // We can seed the first 8 players we generate as seeds 1-8
      if (i < 8) {
        seed = i + 1;
      }

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

    addNotification(`⚡ Berhasil menggenerasi ${numToGenerate} atlet acak!`, 'system');
    res.status(201).json({ success: true, players: generated });
  });

  app.post("/api/players", (req, res) => {
    const { name, club, seed } = req.body;
    if (!name || !club) {
      return res.status(400).json({ error: "Nama dan Klub wajib diisi." });
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
    addNotification(`Pemain baru ditambahkan: ${name} (${club})${newPlayer.seed ? ` [Seed ${newPlayer.seed}]` : ''}`, 'system');
    res.status(201).json(newPlayer);
  });

  // Edit player endpoint
  app.post("/api/players/:id/update", (req, res) => {
    const { id } = req.params;
    const { name, club, matchesPlayed, matchesWon, setsWon, pointsWon, seed } = req.body;
    const player = state.players.find(p => p.id === id);
    if (!player) {
      return res.status(404).json({ error: "Pemain tidak ditemukan." });
    }

    if (name !== undefined) player.name = name;
    if (club !== undefined) player.club = club;
    if (matchesPlayed !== undefined) player.matchesPlayed = Number(matchesPlayed);
    if (matchesWon !== undefined) player.matchesWon = Number(matchesWon);
    if (setsWon !== undefined) player.setsWon = Number(setsWon);
    if (pointsWon !== undefined) player.pointsWon = Number(pointsWon);
    if (seed !== undefined) player.seed = seed ? Number(seed) : undefined;

    addNotification(`Informasi pemain diperbarui: ${player.name} (${player.club})${player.seed ? ` [Seed ${player.seed}]` : ''}`, 'system');
    res.json(player);
  });

  // Delete player endpoint
  app.post("/api/players/:id/delete", (req, res) => {
    const { id } = req.params;
    const index = state.players.findIndex(p => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Pemain tidak ditemukan." });
    }
    const deletedPlayer = state.players[index];
    state.players.splice(index, 1);
    addNotification(`Pemain dihapus: ${deletedPlayer.name}`, 'system');
    res.json({ success: true, deletedPlayer });
  });


  // API Routes: Tournament Draw (Random Match Generation)
  app.post("/api/tournament/draw", (req, res) => {
    const { playerIds } = req.body; // Array of player IDs
    if (!playerIds || !Array.isArray(playerIds) || playerIds.length < 2) {
      return res.status(400).json({ error: "Harap pilih minimal 2 pemain untuk diundi." });
    }
    if (playerIds.length > 64) {
      return res.status(400).json({ error: "Jumlah pemain maksimal untuk diundi adalah 64." });
    }

    const pCount = playerIds.length;
    let bracketSize = 4;
    if (pCount > 32) bracketSize = 64;
    else if (pCount > 16) bracketSize = 32;
    else if (pCount > 8) bracketSize = 16;
    else if (pCount > 4) bracketSize = 8;
    else bracketSize = 4;

    // Filter players that actually exist
    const selectedPlayers = state.players.filter(p => playerIds.includes(p.id));
    if (selectedPlayers.length !== playerIds.length) {
      return res.status(400).json({ error: "Beberapa pemain terpilih tidak ditemukan." });
    }

    // Perform seeded draw to place top seeds top-down and separate them
    const shuffled = performSeededDraw(selectedPlayers, bracketSize);

    // Update active tournament playerIds
    const activeT = state.tournaments.find(t => t.id === state.activeTournamentId);
    if (activeT) {
      activeT.playerIds = playerIds;
      activeT.drawSize = bracketSize;
    }

    // Clear old match and bracket state
    state.matches = [];
    state.brackets = [];

    const nowStr = new Date().toISOString();
    const defaultDateStr = nowStr.split('T')[0];

    addNotification(`Pengundian turnamen acak dimulai dengan ${playerIds.length} pemain (Braket ${bracketSize})!`, 'system');

    const { matches, brackets } = buildBracketAndMatches("random", bracketSize, shuffled, defaultDateStr);
    
    state.matches = matches;
    state.brackets = brackets;

    res.json({
      matches: state.matches,
      brackets: state.brackets,
    });
  });

  // API Routes: Manual database save/sync
  app.post("/api/db/sync", async (req, res) => {
    try {
      const dbInstance = getDb();
      if (!dbInstance) {
        return res.status(400).json({ error: "Cloud database tidak terkonfigurasi pada server." });
      }
      await saveStateToOnlineDb();
      addNotification("💾 Sinkronisasi manual dengan cloud database berhasil!", "system");
      res.json({
        success: true,
        lastSync: lastSyncTime,
        databaseId: firestoreDbId
      });
    } catch (err: any) {
      console.error("Manual database sync error:", err);
      res.status(500).json({ error: err.message || "Gagal melakukan sinkronisasi database." });
    }
  });

  // API Routes: Get all state for live visual dashboard
  app.get("/api/state", (req, res) => {
    res.json({
      players: state.players,
      tournaments: state.tournaments,
      activeTournamentId: state.activeTournamentId,
      matches: state.matches,
      brackets: state.brackets,
      notifications: state.notifications,
      runningText: state.runningText,
      comments: state.comments,
      youtubeUrl: state.youtubeUrl,
      registrationClosed: !!state.registrationClosed,
      appTitle: state.appTitle || "BWF TOURNAMENT",
      appLogo: state.appLogo || "🏆",
      dbStatus: {
        configured: !!getDb(),
        lastSync: lastSyncTime,
        databaseId: firestoreDbId
      }
    });
  });

  // API Routes: Update registration status (closed or open)
  app.post("/api/registration-status", (req, res) => {
    const { closed } = req.body;
    state.registrationClosed = !!closed;
    addNotification(`📋 Pendaftaran turnamen telah ${closed ? 'DITUTUP' : 'DIBUKA'} oleh pengelola`, 'system');
    saveStateToOnlineDb();
    res.json({ success: true, registrationClosed: state.registrationClosed });
  });

  // API Routes: Update app branding (logo & title)
  app.post("/api/app-branding", (req, res) => {
    const { title, logo } = req.body;
    if (title !== undefined) state.appTitle = title;
    if (logo !== undefined) state.appLogo = logo;
    addNotification(`🎨 Identitas Turnamen diperbarui: "${title || state.appTitle}"`, 'system');
    saveStateToOnlineDb();
    res.json({ success: true, appTitle: state.appTitle, appLogo: state.appLogo });
  });

  // API Routes: Update custom running text
  app.post("/api/running-text", (req, res) => {
    const { text } = req.body;
    state.runningText = text !== undefined ? text : "";
    addNotification(`📢 Running Text diperbarui`, 'system');
    res.json({ success: true, runningText: state.runningText });
  });

  // API Routes: Update YouTube Embed URL or Video ID
  app.post("/api/youtube-url", (req, res) => {
    const { url } = req.body;
    state.youtubeUrl = url !== undefined ? url : "https://www.youtube.com/embed/Y-Ony4RveD4";
    addNotification(`🎥 Link Video Pertandingan YouTube diperbarui`, 'system');
    res.json({ success: true, youtubeUrl: state.youtubeUrl });
  });

  // API Routes: Post a spectator comment
  app.post("/api/comments", (req, res) => {
    const { author, text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Komentar tidak boleh kosong." });
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

    addNotification(`💬 Komentar baru dari ${nickname}: "${text.substring(0, 30)}"`, 'info');
    res.status(201).json(newComment);
  });

  app.get("/api/tournaments", (req, res) => {
    res.json(state.tournaments);
  });

  app.post("/api/tournaments", (req, res) => {
    const { name, drawSize, playerIds, customDate } = req.body;
    const size = Number(drawSize);
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Nama turnamen wajib diisi." });
    }
    if (![4, 8, 16, 32, 64].includes(size)) {
      return res.status(400).json({ error: "Ukuran turnamen harus 4, 8, 16, 32, atau 64 atlet." });
    }

    const pIds = playerIds || [];
    if (pIds.length > 0 && pIds.length > size) {
      return res.status(400).json({ error: `Jumlah pemain tidak boleh melebihi ukuran braket (${size} atlet).` });
    }

    const tDate = customDate || new Date().toISOString().split('T')[0];
    const newTournamentId = `t-${generateId()}`;
    const hasPlayers = pIds.length > 0;

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

    // Add to tournaments list
    state.tournaments.push(newTournament);
    
    // Set active tournament temporarily
    state.activeTournamentId = newTournamentId;

    if (hasPlayers) {
      // Run draw logic!
      const selectedPlayers = state.players.filter(p => pIds.includes(p.id));
      // Run seeded draw logic to place top seeds top-down and separate them
      const shuffled = performSeededDraw(selectedPlayers, size);

      const { matches, brackets } = buildBracketAndMatches(newTournamentId, size, shuffled, tDate);
      newTournament.matches = matches;
      newTournament.brackets = brackets;
      addNotification(`🏆 Turnamen baru dibuat: ${name} dengan ${pIds.length} pemain (Braket ${size} Atlet) dan langsung diaktifkan!`, 'system');
    } else {
      addNotification(`🏆 Turnamen baru dibuat: ${name} (Braket Kosong, susun pemain belakangan)`, 'system');
    }

    res.status(201).json(newTournament);
  });

  app.post("/api/tournaments/active", (req, res) => {
    const { tournamentId } = req.body;
    const tournament = state.tournaments.find(t => t.id === tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Turnamen tidak ditemukan." });
    }
    state.activeTournamentId = tournamentId;
    addNotification(`Turnamen aktif beralih ke: ${tournament.name}`, 'system');
    res.json({ success: true, activeTournamentId: tournamentId });
  });

  // Edit tournament endpoint
  app.post("/api/tournaments/:id/update", (req, res) => {
    const { id } = req.params;
    const { name, customDate } = req.body;
    const tournament = state.tournaments.find(t => t.id === id);
    if (!tournament) {
      return res.status(404).json({ error: "Turnamen tidak ditemukan." });
    }
    if (name !== undefined && name.trim() !== "") {
      tournament.name = name;
    }
    if (customDate !== undefined) {
      tournament.customDate = customDate;
    }
    addNotification(`Turnamen diperbarui: ${tournament.name}`, 'system');
    res.json(tournament);
  });

  // Delete tournament endpoint
  app.post("/api/tournaments/:id/delete", (req, res) => {
    const { id } = req.params;
    const index = state.tournaments.findIndex(t => t.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "Turnamen tidak ditemukan." });
    }
    const deletedTournament = state.tournaments[index];
    state.tournaments.splice(index, 1);
    
    // If the active tournament was deleted, switch to another or recreate default
    if (state.activeTournamentId === id) {
      if (state.tournaments.length > 0) {
        state.activeTournamentId = state.tournaments[0].id;
      } else {
        const defaultT = generateDefaultTournament();
        state.tournaments.push(defaultT);
        state.activeTournamentId = defaultT.id;
      }
    }
    
    addNotification(`Turnamen dihapus: ${deletedTournament.name}`, 'system');
    res.json({ success: true, activeTournamentId: state.activeTournamentId });
  });

  app.get("/api/matches", (req, res) => {
    res.json(state.matches);
  });

  app.post("/api/matches/:id/update", (req, res) => {
    const { id } = req.params;
    const { customDate, customTime, player1Name, player2Name } = req.body;

    const match = state.matches.find(m => m.id === id);
    if (!match) {
      return res.status(404).json({ error: "Pertandingan tidak ditemukan." });
    }

    if (customDate !== undefined) {
      match.customDate = customDate;
    }
    if (customTime !== undefined) {
      match.customTime = customTime;
    }
    if (player1Name !== undefined) {
      match.player1Name = player1Name;
    }
    if (player2Name !== undefined) {
      match.player2Name = player2Name;
    }

    match.updatedAt = new Date().toISOString();
    res.json(match);
  });

  app.get("/api/notifications", (req, res) => {
    res.json(state.notifications);
  });

  // Start a scheduled match
  app.post("/api/matches/:id/start", (req, res) => {
    const { id } = req.params;
    const match = state.matches.find(m => m.id === id);

    if (!match) {
      return res.status(404).json({ error: "Pertandingan tidak ditemukan." });
    }

    if (!match.player1Id || !match.player2Id) {
      return res.status(400).json({ error: "Pemain belum lengkap untuk memulai pertandingan ini." });
    }

    // Check if there is another live match. We only allow one live match at a time for maximum real-time focus
    const liveMatch = state.matches.find(m => m.status === 'live');
    if (liveMatch && liveMatch.id !== id) {
      return res.status(400).json({ error: `Silakan selesaikan pertandingan live saat ini (${liveMatch.player1Name} vs ${liveMatch.player2Name}) terlebih dahulu.` });
    }

    match.status = 'live';
    match.scores = [{ p1: 0, p2: 0 }];
    match.currentSet = 1;
    match.updatedAt = new Date().toISOString();

    addNotification(`▶️ PERTANDINGAN MULAI! ${match.player1Name} vs ${match.player2Name} (${match.round})`, 'system', match.id);

    res.json(match);
  });

  // Score manipulation endpoints (Referee UI + API Simulation)
  app.post("/api/matches/:id/score", (req, res) => {
    const { id } = req.params;
    const { playerIndex, action } = req.body; // playerIndex: 1 or 2, action: 'increment' | 'decrement'

    const match = state.matches.find(m => m.id === id);

    if (!match) {
      return res.status(404).json({ error: "Pertandingan tidak ditemukan." });
    }

    if (match.status !== 'live') {
      return res.status(400).json({ error: "Hanya pertandingan aktif (LIVE) yang dapat diubah skornya." });
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
          `🎉 PERTANDINGAN SELESAI AWAL! ${match.player1Name} mengalahkan ${match.player2Name} dengan set ${setsWonP1}-${setsWonP2}!`,
          'match_complete',
          match.id
        );
        updatePlayerStats(match);
        advanceWinnerInBracket(match);
      } else if (setsWonP2 === 2) {
        match.status = 'completed';
        match.winnerId = match.player2Id;
        addNotification(
          `🎉 PERTANDINGAN SELESAI AWAL! ${match.player2Name} mengalahkan ${match.player1Name} dengan set ${setsWonP2}-${setsWonP1}!`,
          'match_complete',
          match.id
        );
        updatePlayerStats(match);
        advanceWinnerInBracket(match);
      } else {
        match.currentSet += 1;
        match.scores.push({ p1: 0, p2: 0 });
        addNotification(`Memulai Set ${match.currentSet}!`, 'system', match.id);
      }
      
      match.updatedAt = new Date().toISOString();
      return res.json(match);
    }

    if (action === 'finish-match') {
      const matchWinner = Number(playerIndex) || 1;
      
      if (matchWinner === 1) {
        currentScore.p1 = currentScore.p1 >= 21 ? currentScore.p1 : 21;
        match.status = 'completed';
        match.winnerId = match.player1Id;
        
        addNotification(
          `🎉 PERTANDINGAN SELESAI CEPAT! ${match.player1Name} dinyatakan menang atas ${match.player2Name}!`,
          'match_complete',
          match.id
        );
      } else {
        currentScore.p2 = currentScore.p2 >= 21 ? currentScore.p2 : 21;
        match.status = 'completed';
        match.winnerId = match.player2Id;
        
        addNotification(
          `🎉 PERTANDINGAN SELESAI CEPAT! ${match.player2Name} dinyatakan menang atas ${match.player1Name}!`,
          'match_complete',
          match.id
        );
      }
      
      updatePlayerStats(match);
      advanceWinnerInBracket(match);
      match.updatedAt = new Date().toISOString();
      return res.json(match);
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
      return res.status(400).json({ error: "Pemain tidak valid. Gunakan playerIndex 1 atau 2." });
    }

    match.updatedAt = new Date().toISOString();

    // Visual score update notification
    addNotification(
      `Poin: ${match.player1Name} [${currentScore.p1}] - [${currentScore.p2}] ${match.player2Name} (Set ${match.currentSet})`,
      'score',
      match.id
    );

    // Evaluate set win conditions
    const p1Score = currentScore.p1;
    const p2Score = currentScore.p2;

    const isSetWon = (p1: number, p2: number) => {
      // Game to 30 points: First to reach 30 points wins the set!
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
        `🎾 Set ${match.currentSet} Selesai! Dimenangkan oleh ${winnerName} dengan skor ${p1Score}-${p2Score}`,
        'set_complete',
        match.id
      );

      // Check overall match winner (Best of 3)
      let setsWonP1 = 0;
      let setsWonP2 = 0;

      match.scores.forEach((score) => {
        if (score.p1 > score.p2) setsWonP1 += 1;
        else if (score.p2 > score.p1) setsWonP2 += 1;
      });

      if (setsWonP1 === 2) {
        // Player 1 wins the match!
        match.status = 'completed';
        match.winnerId = match.player1Id;
        addNotification(
          `🎉 PERTANDINGAN SELESAI! ${match.player1Name} mengalahkan ${match.player2Name} dengan set ${setsWonP1}-${setsWonP2}!`,
          'match_complete',
          match.id
        );
        updatePlayerStats(match);
        advanceWinnerInBracket(match);
      } else if (setsWonP2 === 2) {
        // Player 2 wins the match!
        match.status = 'completed';
        match.winnerId = match.player2Id;
        addNotification(
          `🎉 PERTANDINGAN SELESAI! ${match.player2Name} mengalahkan ${match.player1Name} dengan set ${setsWonP2}-${setsWonP1}!`,
          'match_complete',
          match.id
        );
        updatePlayerStats(match);
        advanceWinnerInBracket(match);
      } else {
        // Go to next set
        match.currentSet += 1;
        match.scores.push({ p1: 0, p2: 0 });
        addNotification(`Memulai Set ${match.currentSet}!`, 'system', match.id);
      }
    }

    res.json(match);
  });

  // Direct External Set/Point integration API as requested ("integrasi API untuk pembaruan data secara langsung di setiap set")
  app.post("/api/external/update-score", (req, res) => {
    const { apiKey, matchId, player, points, action } = req.body;

    // Simulated API Auth
    if (apiKey !== "BADMINTON_SECRET_2026") {
      return res.status(401).json({ error: "Kunci API (apiKey) tidak sah. Gunakan 'BADMINTON_SECRET_2026'." });
    }

    const match = state.matches.find(m => m.id === matchId);
    if (!match) {
      return res.status(404).json({ error: "ID Pertandingan tidak ditemukan." });
    }

    if (match.status !== 'live') {
      return res.status(400).json({ error: "Hanya pertandingan aktif (LIVE) yang dapat menerima input API." });
    }

    if (player !== 1 && player !== 2) {
      return res.status(400).json({ error: "Pemain tidak valid. Gunakan angka 1 atau 2." });
    }

    const setIdx = match.currentSet - 1;
    if (!match.scores[setIdx]) {
      match.scores[setIdx] = { p1: 0, p2: 0 };
    }

    const currentScore = match.scores[setIdx];

    addNotification(`🔌 [API Update] Menerima sinyal pembaruan eksternal`, 'system', match.id);

    if (action === "set-score") {
      const pNum = Number(points);
      if (isNaN(pNum) || pNum < 0) {
        return res.status(400).json({ error: "Format points harus angka positif saat menggunakan action 'set-score'." });
      }

      if (player === 1) {
        currentScore.p1 = pNum;
      } else {
        currentScore.p2 = pNum;
      }
    } else {
      // Default increment
      if (player === 1) {
        currentScore.p1 += 1;
      } else {
        currentScore.p2 += 1;
      }
    }

    match.updatedAt = new Date().toISOString();

    // Trigger score log notification
    addNotification(
      `Poin: ${match.player1Name} [${currentScore.p1}] - [${currentScore.p2}] ${match.player2Name} (Set ${match.currentSet})`,
      'score',
      match.id
    );

    // Evaluate set win conditions (same BWF rules)
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
          `🎉 PERTANDINGAN SELESAI! ${match.player1Name} mengalahkan ${match.player2Name} dengan set ${setsWonP1}-${setsWonP2}!`,
          'match_complete',
          match.id
        );
        updatePlayerStats(match);
        advanceWinnerInBracket(match);
      } else if (setsWonP2 === 2) {
        match.status = 'completed';
        match.winnerId = match.player2Id;
        addNotification(
          `🎉 PERTANDINGAN SELESAI! ${match.player2Name} mengalahkan ${match.player1Name} dengan set ${setsWonP2}-${setsWonP1}!`,
          'match_complete',
          match.id
        );
        updatePlayerStats(match);
        advanceWinnerInBracket(match);
      } else {
        match.currentSet += 1;
        match.scores.push({ p1: 0, p2: 0 });
        addNotification(`Memulai Set ${match.currentSet}!`, 'system', match.id);
      }
    }

    res.json({
      success: true,
      message: "Data skor berhasil diperbarui via API langsung.",
      match
    });
  });

  // Reset Server State to initial state
  app.post("/api/reset", (req, res) => {
    state.players = JSON.parse(JSON.stringify(DEFAULT_PLAYERS));
    state.tournaments = [generateDefaultTournament()];
    state.activeTournamentId = DEFAULT_TOURNAMENT_ID;
    state.notifications = JSON.parse(JSON.stringify(DEFAULT_NOTIFICATIONS));
    state.runningText = "Selamat Datang di Turnamen Bulutangkis Resmi BWF by Ichromn! Saksikan siaran langsung pertandingan real-time dan sampaikan komentar Anda di sini.";
    state.comments = [
      { id: "c-1", author: "Coach Herry IP", text: "Ginting bermain sangat agresif hari ini. Smes menyilangnya mematikan!", timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }), avatarColor: "from-emerald-500 to-teal-500" }
    ];
    state.youtubeUrl = "https://www.youtube.com/embed/Y-Ony4RveD4";
    state.appTitle = "BWF TOURNAMENT";
    state.appLogo = "🏆";
    addNotification("Sistem berhasil direset ke pengaturan awal.", 'system');
    res.json({ success: true, message: "Sistem berhasil direset." });
  });

  // Serve Vite or Static files depending on mode
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Gagal memulai server:", err);
});
