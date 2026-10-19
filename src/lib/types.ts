/** Shapes exchanged between the API and the browser. */
import type { Direction, TileColor } from './scoring';

export interface QuestionInfo {
  id: number;
  number: number;
  date: string; // YYYY-MM-DD (UTC)
  text: string;
}

export interface TodayResponse {
  today: string;
  closesAt: string;
  question: QuestionInfo | null;
  myVote: boolean | null;
}

export interface GuessTile {
  value: number;
  color: TileColor;
  direction: Direction;
}

export interface LocaleBreakdown {
  locale: string;
  total: number;
  yesPct: number;
}

export interface ResultPayload {
  yesPct: number;
  answer: number;
  total: number;
  seeded: boolean;
  sourceUrl: string | null;
  histogram: number[]; // 20 buckets of 5 points
  finishedCount: number;
  within3Count: number;
  perLocale: LocaleBreakdown[];
  breakdownMin: number;
}

export interface GameState {
  guesses: GuessTile[];
  finished: boolean;
  solvedIn?: number | null;
  finalError?: number | null;
  result?: ResultPayload | null;
}

export type Fallback = { reason: 'too_few_votes'; votes: number; needed: number } | { reason: 'no_question' };

export type PuzzleResponse =
  | { status: 'launch'; today: string }
  | { status: 'not_found'; today: string }
  | {
      status: 'ok';
      today: string;
      mode: 'daily' | 'archive';
      puzzle: QuestionInfo;
      dailyNumber: number | null;
      prevDailyNumber: number | null;
      fallback: Fallback | null;
      game: GameState;
    };

export type GuessStatus = 'ok' | 'finished' | 'repeated' | 'invalid' | 'not_playable' | 'rate_limited';
export interface GuessResponse {
  status: GuessStatus;
  game?: GameState;
}

export type VoteStatus =
  | 'ok'
  | 'duplicate'
  | 'closed'
  | 'rate_limited'
  | 'challenge_required'
  | 'challenge_failed';
export interface VoteResponse {
  status: VoteStatus;
  siteKey?: string;
}

export interface ArchiveItem {
  number: number;
  date: string;
  text: string;
  yesPct: number;
  answer: number;
  total: number;
  played: boolean;
  solvedIn: number | null;
  finalError: number | null;
}

export interface ArchiveResponse {
  items: ArchiveItem[];
  hasMore: boolean;
}

export type SuggestError = 'too_short' | 'too_long' | 'profanity' | 'invalid' | 'rate_limited';
export interface SuggestResponse {
  status: 'ok' | 'error';
  error?: SuggestError;
}

// ---- Admin -----------------------------------------------------------------

export type QuestionStatus = 'draft' | 'scheduled' | 'live' | 'closed' | 'void';

export interface AdminTranslation {
  text: string;
  reviewed: boolean;
  reviewedAt?: string | null;
}

export interface AdminQuestion {
  id: number;
  status: QuestionStatus;
  date: string | null;
  number: number | null;
  source: 'seed' | 'community' | 'survey';
  minVotes: number;
  ready: boolean;
  createdAt: string;
  translations: Record<string, AdminTranslation>;
  votes: number;
  result: { yesPct: number | null; total: number; seeded: boolean } | null;
}

export interface AdminDashboard {
  today: string;
  launchDate: string;
  locales: { code: string; name: string; active: boolean }[];
  scheduledAhead: number;
  firstGap: string | null;
  pendingSubmissions: number;
  calendar: { date: string; question: AdminQuestion | null }[];
}

export interface AdminStats {
  question: AdminQuestion;
  votes: number;
  yesPct: number | null;
  perLocale: LocaleBreakdown[];
  perHour: { hour: string; votes: number }[];
  guesses: { started: number; finished: number; solved: number; avgError: number | null };
}

export interface AdminSubmission {
  id: number;
  text: string;
  locale: string;
  nickname: string | null;
  status: 'pending' | 'approved' | 'rejected';
  questionId: number | null;
  createdAt: string;
}
