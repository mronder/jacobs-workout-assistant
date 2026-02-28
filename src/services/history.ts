/**
 * Service layer for exercise history queries.
 *
 * Provides data for the History page: distinct exercises, per-exercise
 * history, personal records, and progression data for charts.
 */

import { supabase } from './supabaseClient';

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
  maxVolume: number; // weight × reps (best single set)
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

/** Return an alphabetized list of unique exercise names the user has logged. */
export async function getDistinctExercises(userId: string): Promise<ExerciseSummary[]> {
  // Join tracked_sets → tracked_workouts to filter by user
  const { data, error } = await supabase
    .from('tracked_sets')
    .select(
      `
      exercise_name,
      tracked_workout_id,
      tracked_workouts!inner (
        user_id
      )
    `,
    )
    .eq('tracked_workouts.user_id', userId);

  if (error) throw new Error(error.message);

  // Count distinct workout sessions per exercise
  const sessionMap = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    if (!sessionMap.has(row.exercise_name)) sessionMap.set(row.exercise_name, new Set());
    sessionMap.get(row.exercise_name)!.add(row.tracked_workout_id);
  }

  const exercises: ExerciseSummary[] = Array.from(sessionMap.entries()).map(
    ([name, sessions]) => ({ exerciseName: name, sessionCount: sessions.size }),
  );

  return exercises.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

/* ------------------------------------------------------------------ */
/*  Full history for a specific exercise                              */
/* ------------------------------------------------------------------ */

export async function getExerciseHistory(
  userId: string,
  exerciseName: string,
): Promise<HistorySession[]> {
  const { data, error } = await supabase
    .from('tracked_sets')
    .select(
      `
      set_number,
      weight,
      reps,
      completed,
      tracked_workouts!inner (
        user_id,
        week_number,
        day_number,
        completed_at,
        workout_plans!inner (
          plan_name
        )
      )
    `,
    )
    .eq('exercise_name', exerciseName)
    .eq('tracked_workouts.user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  // Group by workout session (completed_at)
  const sessionMap = new Map<string, HistorySession>();

  for (const row of data ?? []) {
    const tw = row.tracked_workouts as unknown as {
      completed_at: string | null;
      week_number: number;
      day_number: number;
      workout_plans: { plan_name: string };
    };

    const key = tw.completed_at ?? 'unknown';
    if (!sessionMap.has(key)) {
      sessionMap.set(key, {
        date: tw.completed_at ?? '',
        planName: tw.workout_plans?.plan_name ?? '',
        weekNumber: tw.week_number,
        dayNumber: tw.day_number,
        sets: [],
      });
    }

    sessionMap.get(key)!.sets.push({
      setNumber: row.set_number,
      weight: row.weight,
      reps: row.reps,
      completed: row.completed,
    });
  }

  // Sort sets within each session and sort sessions newest first
  const sessions = Array.from(sessionMap.values());
  for (const s of sessions) {
    s.sets.sort((a, b) => a.setNumber - b.setNumber);
  }
  sessions.sort((a, b) => (b.date > a.date ? 1 : -1));

  return sessions;
}

/* ------------------------------------------------------------------ */
/*  Personal record                                                    */
/* ------------------------------------------------------------------ */

export async function getExercisePR(
  userId: string,
  exerciseName: string,
): Promise<PersonalRecord | null> {
  const { data, error } = await supabase
    .from('tracked_sets')
    .select(
      `
      weight,
      reps,
      tracked_workouts!inner (
        user_id
      )
    `,
    )
    .eq('exercise_name', exerciseName)
    .eq('tracked_workouts.user_id', userId)
    .eq('completed', true);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return null;

  let maxWeight = 0;
  let maxVolume = 0;
  let maxVolumeWeight = 0;
  let maxVolumeReps = 0;

  for (const row of data) {
    if (row.weight > maxWeight) maxWeight = row.weight;
    const vol = row.weight * row.reps;
    if (vol > maxVolume) {
      maxVolume = vol;
      maxVolumeWeight = row.weight;
      maxVolumeReps = row.reps;
    }
  }

  return { maxWeight, maxVolume, maxVolumeWeight, maxVolumeReps };
}

/* ------------------------------------------------------------------ */
/*  Progression data (for chart)                                       */
/* ------------------------------------------------------------------ */

export async function getProgressionData(
  userId: string,
  exerciseName: string,
): Promise<ProgressionPoint[]> {
  const { data, error } = await supabase
    .from('tracked_sets')
    .select(
      `
      weight,
      tracked_workouts!inner (
        user_id,
        completed_at
      )
    `,
    )
    .eq('exercise_name', exerciseName)
    .eq('tracked_workouts.user_id', userId)
    .eq('completed', true);

  if (error) throw new Error(error.message);

  // Group by date (completed_at) and take the max weight per session
  const dateMap = new Map<string, number>();

  for (const row of data ?? []) {
    const tw = row.tracked_workouts as unknown as { completed_at: string | null };
    const date = tw.completed_at?.split('T')[0] ?? '';
    if (!date) continue;
    const current = dateMap.get(date) ?? 0;
    if (row.weight > current) dateMap.set(date, row.weight);
  }

  return Array.from(dateMap.entries())
    .map(([date, maxWeight]) => ({ date, maxWeight }))
    .sort((a, b) => (a.date > b.date ? 1 : -1));
}
