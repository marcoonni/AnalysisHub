export type BodyPart = 'foot' | 'head';
export type AssistType = 'pass' | 'cross' | 'rebound' | 'none';

export interface Shot {
  id: string;
  x: number; // 0-34 (distance from goal line)
  y: number; // 0-68 (distance from left touchline)
  isGoal: boolean;
  bodyPart: BodyPart;
  assistType: AssistType;
  xg: number;
  timestamp: number;
  minute: number;
  playerName?: string;
  matchName?: string;
  team: 'home' | 'away';
}

export interface PitchDimensions {
  width: number; // 68m
  height: number; // 34m (half pitch)
  goalWidth: number; // 7.32m
}

export const DEFAULT_PITCH: PitchDimensions = {
  width: 68,
  height: 34,
  goalWidth: 7.32,
};
