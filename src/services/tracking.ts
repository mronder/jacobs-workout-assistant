/**
 * Service layer for saving and loading tracked workout data from Supabase.
 */

import { supabase } from './supabaseClient';
import type { TrackedWorkout } from '../types';

/* ------------------------------------------------------------------ */
/*  Save (or update) a tracked workout and its sets                   */
/* ------------------------------------------------------------------ */

export async function saveTrackedWorkout(
  userId: string,
  planId: string,
  workout: TrackedWorkout,
): Promise<void> {
  // Check if a tracked workout already exists for this plan/week/day
  const { data: existing } = await supabase
    .from('tracked_workouts')
    .select('id')
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('week_number', workout.weekNumber)
    .eq('day_number', workout.dayNumber)
    .maybeSingle();

  let workoutId: string;

  if (existing) {
    // Update existing row
    workoutId = existing.id;
    await supabase
      .from('tracked_workouts')
      .update({
        completed: workout.completed,
        completed_at: workout.completed ? new Date().toISOString() : null,
      })
      .eq('id', workoutId);

    // Delete old sets and re-insert (simplest upsert strategy)
    await supabase
      .from('tracked_sets')
      .delete()
      .eq('tracked_workout_id', workoutId);
  } else {
    // Insert new row
    const { data: row, error } = await supabase
      .from('tracked_workouts')
      .insert({
        user_id: userId,
        plan_id: planId,
        week_number: workout.weekNumber,
        day_number: workout.dayNumber,
        completed: workout.completed,
        completed_at: workout.completed ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (error || !row) throw new Error(error?.message ?? 'Failed to save tracked workout');
    workoutId = row.id;
  }

  // Insert all sets
  const setInserts = workout.exercises.flatMap((ex) =>
    ex.sets.map((s, idx) => ({
      tracked_workout_id: workoutId,
      exercise_name: ex.exerciseName,
      set_number: idx + 1,
      weight: s.weight,
      reps: s.reps,
      completed: s.completed,
      weight_unit: ex.weightUnit ?? 'lbs',
    })),
  );

  if (setInserts.length > 0) {
    const { error: setErr } = await supabase.from('tracked_sets').insert(setInserts);
    if (setErr) throw new Error(setErr.message);
  }
}

/* ------------------------------------------------------------------ */
/*  Load all tracked workouts for a plan                              */
/* ------------------------------------------------------------------ */

export async function loadTrackedWorkouts(
  userId: string,
  planId: string,
): Promise<TrackedWorkout[]> {
  const { data, error } = await supabase
    .from('tracked_workouts')
    .select(
      `
      id,
      week_number,
      day_number,
      completed,
      completed_at,
      tracked_sets (
        exercise_name,
        set_number,
        weight,
        reps,
        completed,
        weight_unit
      )
    `,
    )
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .order('week_number')
    .order('day_number');

  if (error) throw new Error(error.message);

  return (data ?? []).map((tw) => {
    // Group sets by exercise_name
    const exerciseMap = new Map<
      string,
      Array<{ weight: number; reps: number; completed: boolean; setNumber: number; weightUnit: string }>
    >();

    for (const s of tw.tracked_sets ?? []) {
      if (!exerciseMap.has(s.exercise_name)) exerciseMap.set(s.exercise_name, []);
      exerciseMap.get(s.exercise_name)!.push({
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
        setNumber: s.set_number,
        weightUnit: s.weight_unit ?? 'lbs',
      });
    }

    const exercises = Array.from(exerciseMap.entries()).map(([name, sets]) => ({
      exerciseName: name,
      weightUnit: (sets[0]?.weightUnit as 'kg' | 'lbs') ?? 'lbs',
      sets: sets.sort((a, b) => a.setNumber - b.setNumber).map((s) => ({
        weight: s.weight,
        reps: s.reps,
        completed: s.completed,
      })),
    }));

    return {
      weekNumber: tw.week_number,
      dayNumber: tw.day_number,
      date: tw.completed_at ?? '',
      exercises,
      completed: tw.completed,
    } satisfies TrackedWorkout;
  });
}
