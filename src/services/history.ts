/**
 * Service layer for exercise history queries.
 * Thin fetch wrappers — the server handles all DB logic.
 */

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
