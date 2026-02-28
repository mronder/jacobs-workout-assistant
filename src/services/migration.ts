/**
 * One-time migration of localStorage data into Supabase.
 */

import { savePlan } from './plans';
import { saveTrackedWorkout } from './tracking';
import type { WorkoutPlan, TrackedWorkout } from '../types';

const STORAGE_KEYS = {
  plan: 'jw_plan',
  tracked: 'jw_tracked',
  migrationDone: 'jw_migration_done',
} as const;

/** Returns true if there is existing plan/tracked data in localStorage AND migration hasn't been done yet. */
export function checkLocalStorageData(): boolean {
  if (localStorage.getItem(STORAGE_KEYS.migrationDone)) return false;
  return !!(localStorage.getItem(STORAGE_KEYS.plan) || localStorage.getItem(STORAGE_KEYS.tracked));
}

/** Migrate localStorage data into Supabase for the given user. */
export async function migrateLocalStorageToSupabase(userId: string): Promise<void> {
  const planJson = localStorage.getItem(STORAGE_KEYS.plan);
  const trackedJson = localStorage.getItem(STORAGE_KEYS.tracked);

  if (!planJson) return;

  const plan: WorkoutPlan = JSON.parse(planJson);

  // We don't have the original daysPerWeek/goal/level stored, so infer from the plan
  const daysPerWeek = plan.weeks[0]?.days.length ?? 4;
  const goal = 'Imported';
  const level = 'Imported';

  const planId = await savePlan(userId, plan, daysPerWeek, goal, level);

  // Migrate tracked workouts
  if (trackedJson) {
    const tracked: TrackedWorkout[] = JSON.parse(trackedJson);
    for (const workout of tracked) {
      await saveTrackedWorkout(userId, planId, workout);
    }
  }

  // Clear old localStorage data and mark migration as done
  localStorage.removeItem(STORAGE_KEYS.plan);
  localStorage.removeItem(STORAGE_KEYS.tracked);
  localStorage.setItem(STORAGE_KEYS.migrationDone, '1');
}

/** Clear localStorage data without importing and mark migration as done. */
export function clearLocalStorageData(): void {
  localStorage.removeItem(STORAGE_KEYS.plan);
  localStorage.removeItem(STORAGE_KEYS.tracked);
  localStorage.setItem(STORAGE_KEYS.migrationDone, '1');
}
