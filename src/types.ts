/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  id: string;
  name: string;
  club: string;
  matchesPlayed: number;
  matchesWon: number;
  setsWon: number;
  pointsWon: number;
  seed?: number;
}

export interface MatchScore {
  p1: number;
  p2: number;
}

export type MatchStatus = 'scheduled' | 'live' | 'completed';

export interface Match {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  status: MatchStatus;
  scores: MatchScore[]; // Array of scores for each set (up to 3)
  currentSet: number; // 1, 2, or 3
  winnerId?: string;
  round: string; // e.g., "Perempat Final", "Semifinal", "Final"
  createdAt: string;
  updatedAt: string;
  customDate?: string;
  customTime?: string;
}

export interface BracketNode {
  id: string;
  roundIndex: number; // 0 for final, 1 for semi, 2 for quarter
  roundName: string;
  matchId?: string;
  player1Id?: string;
  player1Name?: string;
  player2Id?: string;
  player2Name?: string;
  winnerId?: string;
  nextMatchId?: string; // Where the winner of this match goes
}

export interface MatchNotification {
  id: string;
  matchId?: string;
  message: string;
  type: 'info' | 'score' | 'set_complete' | 'match_complete' | 'system';
  timestamp: string;
}

export interface SpectatorComment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
  avatarColor: string;
}

export interface GroupStanding {
  playerId: string;
  playerName: string;
  club: string;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
}

export interface TournamentGroup {
  id: string; // e.g. "A", "B"
  name: string; // e.g. "Grup A"
  playerIds: string[];
}

export interface Tournament {
  id: string;
  name: string;
  drawSize: number; // 4 or 8
  playerIds: string[];
  matches: Match[];
  brackets: BracketNode[];
  createdAt: string;
  customDate?: string;
  type?: 'knockout' | 'group'; // default 'knockout'
  groups?: TournamentGroup[];
}

export interface ServerState {
  players: Player[];
  tournaments: Tournament[];
  activeTournamentId: string | null;
  matches: Match[];
  brackets: BracketNode[];
  notifications: MatchNotification[];
  runningText?: string;
  comments?: SpectatorComment[];
  youtubeUrl?: string;
  registrationClosed?: boolean;
  appTitle?: string;
  appLogo?: string;
  dbStatus?: {
    configured: boolean;
    lastSync: string | null;
    databaseId: string | null;
  };
}
