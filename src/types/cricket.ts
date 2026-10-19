// Shared types. Coordinate system (metres): x = across (screen-right when viewed from behind the bowler),
// y = up, z = along the pitch. Bowler's stumps at z=+10.06, striker's stumps at z=-10.06.
export type Role = 'Batter' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';
export type BowlStyle = 'fast' | 'medium' | 'offspin' | 'legspin';
export type Hand = 'R' | 'L';
export type TeamSide = 'A' | 'B';

export interface Player {
  id: string; name: string; teamId: string; number: number; role: Role;
  batting: number; bowling: number; fielding: number; /* 0..100 */
  speed: number; /* running speed m/s */
  bowlStyle: BowlStyle; hand: Hand; skin: number;
}
export interface Team {
  id: string; name: string; short: string; primary: string; accent: string; trousers: string; players: Player[];
}
export const overall = (p: Player) =>
  Math.round(p.role === 'Batter' ? p.batting * 0.7 + p.fielding * 0.2 + p.bowling * 0.1
    : p.role === 'Bowler' ? p.bowling * 0.7 + p.fielding * 0.2 + p.batting * 0.1
    : p.role === 'Wicketkeeper' ? p.batting * 0.5 + p.fielding * 0.5
    : p.batting * 0.45 + p.bowling * 0.45 + p.fielding * 0.1);

export type Shot = 'leave' | 'defend' | 'drive' | 'cut' | 'pull' | 'sweep' | 'glance' | 'loft';
export type ContactType = 'none' | 'clean' | 'edge' | 'miss' | 'pad';
export type DismissalType = 'bowled' | 'caught' | 'runout';

export interface DeliverySpec {
  style: BowlStyle;
  pace: number;      // release speed m/s
  lineOff: number;   // metres toward the off side of middle stump at pitching (negative = leg side)
  length: number;    // metres in front of striker's stumps where ball pitches (<0.6 = full toss)
  turn: number;      // spin/seam deviation, + toward off side, - toward leg
  label: string;
}

/** The single authoritative record of one delivery, produced by the simulation and consumed by the rules engine. */
export interface DeliveryResult {
  id: number;
  extra: 'wide' | 'noball' | null;
  batContact: boolean;        // ball struck by bat (clean or edge)
  bodyHit: boolean;           // ball deflected off pads (leg-bye)
  runsRan: number;            // runs physically completed (ignored if boundary)
  boundary: 4 | 6 | null;
  wicket: { kind: DismissalType; batterId: string; fielderId?: string } | null;
  shot: Shot; contact: ContactType; spec: DeliverySpec;
  dropped?: string; stoppedBy?: string; dirDeg?: number; airborne?: boolean; timing?: number; keeperTook?: boolean;
}

export interface BallRecord {
  id: number; over: number; ball: number;
  strikerId: string; nonStrikerId: string; bowlerId: string;
  runs: number; batRuns: number; extraRuns: number; extra: 'wide' | 'noball' | 'bye' | 'legbye' | null;
  legal: boolean; boundary: 4 | 6 | null; wicket: DeliveryResult['wicket']; freeHit: boolean;
  shot: Shot; contact: ContactType; spec: DeliverySpec; text: string; scoreAfter: string;
}
export interface BatStat { playerId: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; howOut?: string; }
export interface BowlStat { playerId: string; balls: number; runs: number; wickets: number; maidens: number; dots: number; wides: number; noballs: number; }

export interface Innings {
  battingTeamId: string; bowlingTeamId: string;
  maxOvers: number; maxWickets: number; target: number | null;
  runs: number; wickets: number; legalBalls: number; extras: { wides: number; noballs: number; byes: number; legbyes: number };
  battingOrder: string[]; nextBatterIdx: number;
  strikerId: string; nonStrikerId: string; bowlerId: string | null; lastBowlerId: string | null;
  bat: Record<string, BatStat>; bowl: Record<string, BowlStat>;
  balls: BallRecord[]; appliedIds: number[];
  freeHit: boolean; partnership: { runs: number; balls: number };
  overRuns: number; overHadBatRunOrWicket: boolean; completed: boolean; endReason: 'overs' | 'allout' | 'target' | null;
  fallOfWickets: { runs: number; wicket: number; playerId: string; over: string }[];
}
export interface MatchResult { winnerTeamId: string | null; tied: boolean; text: string; margin: string; }
export interface MatchMeta { overs: number; first: { teamId: string; order: string[] }; second: { teamId: string; order: string[] }; }
export interface MatchState { innings: Innings[]; current: number; finished: boolean; result: MatchResult | null; meta: MatchMeta; }

export type MatchFormat = 'quick' | 'short' | 't10' | 't20';
export type ControlMode = 'auto' | 'bat' | 'bowl' | 'both' | 'practice';
export type Difficulty = 'easy' | 'normal' | 'hard';
export interface MatchConfig {
  teamAId: string; teamBId: string; format: MatchFormat; overs: number; stadiumId: string; night: boolean;
  mode: ControlMode; controlTeam: TeamSide; difficulty: Difficulty; speed: 0.5 | 1 | 2;
  tossWinner: TeamSide; battingFirst: TeamSide; seed: number; practiceKind?: 'batting' | 'bowling';
  tournamentMatchId?: string;
}
export interface MatchRecord {
  id: string; date: number; config: MatchConfig; teamAId: string; teamBId: string;
  innings: Innings[]; result: MatchResult; live: boolean; tournamentMatchId?: string;
}
export const FORMAT_OVERS: Record<string, number> = { quick: 2, short: 6, t10: 10, t20: 20 };
