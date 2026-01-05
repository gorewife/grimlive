/**
 * Type definitions for Player and related models
 */

export interface Role {
  id: string;
  name: string;
  team: "townsfolk" | "outsider" | "minion" | "demon" | "traveller" | "fabled";
  ability: string;
  edition: string;
  firstNight: number;
  firstNightReminder: string;
  otherNight: number;
  otherNightReminder: string;
  reminders: string[];
  remindersGlobal: string[];
  setup: boolean;
  image?: string;
  isCustom?: boolean;
}

export interface Player {
  id: string;
  name: string;
  role: Role;
  isDead: boolean;
  isVoteless: boolean;
  pronouns?: string;
  discord_id?: string;
  connected: boolean;
  reminders: Array<{ role: Role; name: string }>;
  alignmentIndex: number;
  isMarked: boolean;
  hasTwoVotes: boolean;
}

export interface SessionState {
  sessionId: string;
  isSpectator: boolean;
  isReconnecting: boolean;
  playerCount: number;
  ping: number;
  playerId: string;
  claimedSeat: number;
  nomination: [number, number] | false;
  votes: number[];
  lockedVote: number;
  votingSpeed: number;
  allowSelfNaming: boolean;
  isVoteInProgress: boolean;
  voteHistory: VoteHistoryEntry[];
  markedPlayer: number;
  isVoteHistoryAllowed: boolean;
  isVoteWatchingAllowed: boolean;
  isTwoVotesEnabled: boolean;
  isRolesDistributed: boolean;
  messages: Message[];
  timer: TimerState;
}

export interface TimerState {
  isActive: boolean;
  duration: number;
  endTime: number | null;
  startedBy: string | null;
  isPaused: boolean;
  pausedTime: number | null;
  pausedRemaining: number;
}

export interface VoteHistoryEntry {
  timestamp: number;
  nominator: string;
  nominee: string;
  votes: number;
  majority: number;
}

export interface Message {
  id: string;
  text: string;
  author: string;
  timestamp: number;
}

export interface GrimoireState {
  isNight: boolean;
  isNightOrder: boolean;
  isPublic: boolean;
  isMenuOpen: boolean;
  isStatic: boolean;
  isMuted: boolean;
  isImageOptIn: boolean;
  isMockAssignmentsAllowed: boolean;
  zoom: number;
  background: string;
  nightNumber: number;
  nightStart: number | null;
  nightEnd: number | null;
}

export interface Edition {
  id: string;
  name: string;
  author: string;
  description: string;
  isOfficial: boolean;
  roles: string[];
  logo?: string;
}

export interface StatsState {
  discordUserId: string | null;
  discordUsername: string | null;
  sessionCode: string | null;
  statsToken: string | null;
  statsSessionId: string | null;
  currentGameId: number | null;
  trackingEnabled: boolean;
  baseUrl: string;
}
