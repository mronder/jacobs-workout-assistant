/**
 * Service layer for exercise history queries.
 * Thin fetch wrappers — the server handles all DB logic.
 */
import { lastSessionCacheKey } from '../storageKeys';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ExerciseSummary {
  exerciseName: string;
  sessionCount: number;
}

export interface HistorySet {
  setNumber: number;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface HistorySession {
  date: string;
  planName: string;
  weekNumber: number;
  dayNumber: number;
  sets: HistorySet[];
}

export interface PersonalRecord {
  maxWeight: number;
  maxVolume: number;
  maxVolumeWeight: number;
  maxVolumeReps: number;
}

export interface ProgressionPoint {
  date: string;
  maxWeight: number;
}

/* ------------------------------------------------------------------ */
/*  Distinct exercises                                                 */
/* ------------------------------------------------------------------ */

export async function getDistinctExercises(): Promise<ExerciseSummary[]> {
  const res = await fetch('/api/history/exercises', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load exercises');
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Full history for a specific exercise                              */
/* ------------------------------------------------------------------ */

export async function getExerciseHistory(exerciseName: string): Promise<HistorySession[]> {
  const res = await fetch(`/api/history/exercise?name=${encodeURIComponent(exerciseName)}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Failed to load exercise history');
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Personal record                                                    */
/* ------------------------------------------------------------------ */

export async function getExercisePR(exerciseName: string): Promise<PersonalRecord | null> {
  const res = await fetch(`/api/history/pr?name=${encodeURIComponent(exerciseName)}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Failed to load PR');
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Progression data (for chart)                                       */
/* ------------------------------------------------------------------ */

export async function getProgressionData(exerciseName: string): Promise<ProgressionPoint[]> {
  const res = await fetch(`/api/history/progression?name=${encodeURIComponent(exerciseName)}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Failed to load progression');
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Last session data (for progressive overload ghost rows)            */
/* ------------------------------------------------------------------ */

export interface LastSessionSet {
  weight: number;
  reps: number;
}

export interface LastSessionData {
  sets: LastSessionSet[];
  date: string;
}

export type LastSessionMap = Record<string, LastSessionData>;

export async function fetchLastSessionData(planId: string, dayNumber: number): Promise<LastSessionMap> {
  const cacheKey = lastSessionCacheKey(planId, dayNumber);
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }

  const res = await fetch(`/api/history/last-session?planId=${encodeURIComponent(planId)}&dayNumber=${dayNumber}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) return {};
  const data: LastSessionMap = await res.json();

  try {
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
  } catch { /* ignore */ }

  return data;
}
