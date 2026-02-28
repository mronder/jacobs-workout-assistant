/**
 * Service layer for saving and loading workout plans from Supabase.
 *
 * Components should call these functions — never use `supabase.from(...)` directly.
 */

import { supabase } from './supabaseClient';
import type { WorkoutPlan } from '../types';

/* ------------------------------------------------------------------ */
/*  Save a newly generated plan (and all nested children)             */
/* ------------------------------------------------------------------ */

/** Deactivate previous active plans, then insert the new one. */
export async function savePlan(
  userId: string,
  plan: WorkoutPlan,
  daysPerWeek: number,
  goal: string,
  level: string,
  secondaryGoal: string | null = null,
): Promise<string> {
  // 1. Deactivate any currently active plan
  await supabase
    .from('workout_plans')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('is_active', true);

  // 2. Insert the new plan
  const { data: planRow, error: planErr } = await supabase
    .from('workout_plans')
    .insert({
      user_id: userId,
      plan_name: plan.planName,
      split_description: plan.splitDescription,
      motivational_quote: plan.motivationalQuote,
      quote_author: plan.quoteAuthor,
      days_per_week: daysPerWeek,
      goal,
      level,
      secondary_goal: secondaryGoal,
      is_active: true,
    })
    .select('id')
    .single();

  if (planErr || !planRow) throw new Error(planErr?.message ?? 'Failed to save plan');
  const planId = planRow.id;

  // The template is just the first week — weeks 2-4 are clones.
  const templateDays = plan.weeks[0]?.days ?? [];

  // 3. Insert plan_days
  const dayInserts = templateDays.map((d) => ({
    plan_id: planId,
    day_number: d.dayNumber,
    focus: d.focus,
  }));

  const { data: dayRows, error: dayErr } = await supabase
    .from('plan_days')
    .insert(dayInserts)
    .select('id, day_number');

  if (dayErr || !dayRows) throw new Error(dayErr?.message ?? 'Failed to save plan days');

  // Build a map: dayNumber → plan_day uuid
  const dayIdMap = new Map(dayRows.map((r) => [r.day_number, r.id]));

  // 4. Insert plan_exercises (collect all exercises across all days)
  const exerciseInserts: Array<{
    plan_day_id: string;
    position: number;
    name: string;
    sets: number;
    reps: string;
    rest: string;
    expert_advice: string;
    video_search_query: string;
  }> = [];

  for (const day of templateDays) {
    const dayId = dayIdMap.get(day.dayNumber);
    if (!dayId) continue;
    day.exercises.forEach((ex, idx) => {
      exerciseInserts.push({
        plan_day_id: dayId,
        position: idx + 1,
        name: ex.name,
        sets: ex.sets,
        reps: ex.reps,
        rest: ex.rest,
        expert_advice: ex.expertAdvice,
        video_search_query: ex.videoSearchQuery,
      });
    });
  }

  const { data: exerciseRows, error: exErr } = await supabase
    .from('plan_exercises')
    .insert(exerciseInserts)
    .select('id, plan_day_id, position');

  if (exErr || !exerciseRows) throw new Error(exErr?.message ?? 'Failed to save exercises');

  // 5. Insert exercise_alternatives
  // We need to map exerciseRow ids back to the original data.
  const altInserts: Array<{
    exercise_id: string;
    name: string;
    expert_advice: string;
    video_search_query: string;
  }> = [];

  for (const day of templateDays) {
    const dayId = dayIdMap.get(day.dayNumber);
    if (!dayId) continue;
    day.exercises.forEach((ex, idx) => {
      const row = exerciseRows.find(
        (r) => r.plan_day_id === dayId && r.position === idx + 1,
      );
      if (!row) return;
      for (const alt of ex.alternatives) {
        altInserts.push({
          exercise_id: row.id,
          name: alt.name,
          expert_advice: alt.expertAdvice,
          video_search_query: alt.videoSearchQuery,
        });
      }
    });
  }

  if (altInserts.length > 0) {
    const { error: altErr } = await supabase
      .from('exercise_alternatives')
      .insert(altInserts);
    if (altErr) throw new Error(altErr.message);
  }

  return planId;
}

/* ------------------------------------------------------------------ */
/*  Load this user's active plan (with all nested data)               */
/* ------------------------------------------------------------------ */

export async function loadActivePlan(
  userId: string,
): Promise<{ plan: WorkoutPlan; planId: string } | null> {
  const { data: planRow, error } = await supabase
    .from('workout_plans')
    .select(
      `
      id,
      plan_name,
      split_description,
      motivational_quote,
      quote_author,
      plan_days (
        id,
        day_number,
        focus,
        plan_exercises (
          id,
          position,
          name,
          sets,
          reps,
          rest,
          expert_advice,
          video_search_query,
          exercise_alternatives (
            name,
            expert_advice,
            video_search_query
          )
        )
      )
    `,
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!planRow) return null;

  // Transform DB shape → existing WorkoutPlan type
  const days = (planRow.plan_days ?? [])
    .sort((a, b) => a.day_number - b.day_number)
    .map((d) => ({
      dayNumber: d.day_number,
      focus: d.focus,
      exercises: (d.plan_exercises ?? [])
        .sort((a, b) => a.position - b.position)
        .map((ex) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          rest: ex.rest,
          expertAdvice: ex.expert_advice ?? '',
          videoSearchQuery: ex.video_search_query ?? '',
          alternatives: (ex.exercise_alternatives ?? []).map((alt) => ({
            name: alt.name,
            expertAdvice: alt.expert_advice ?? '',
            videoSearchQuery: alt.video_search_query ?? '',
          })),
        })),
    }));

  const weeks = [1, 2, 3, 4].map((weekNumber) => ({ weekNumber, days }));

  const plan: WorkoutPlan = {
    planName: planRow.plan_name,
    splitDescription: planRow.split_description ?? '',
    motivationalQuote: planRow.motivational_quote ?? '',
    quoteAuthor: planRow.quote_author ?? '',
    weeks,
  };

  return { plan, planId: planRow.id };
}

/* ------------------------------------------------------------------ */
/*  Load all plans (for history / reference)                          */
/* ------------------------------------------------------------------ */

export async function loadAllPlans(
  userId: string,
): Promise<Array<{ id: string; planName: string; createdAt: string; isActive: boolean }>> {
  const { data, error } = await supabase
    .from('workout_plans')
    .select('id, plan_name, created_at, is_active')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    planName: r.plan_name,
    createdAt: r.created_at,
    isActive: r.is_active,
  }));
}

/* ------------------------------------------------------------------ */
/*  Deactivate the current plan (used when resetting)                 */
/* ------------------------------------------------------------------ */

export async function deactivatePlan(planId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_plans')
    .update({ is_active: false })
    .eq('id', planId);

  if (error) throw new Error(error.message);
}
