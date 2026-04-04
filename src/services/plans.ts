/**
 * Service layer for saving and loading workout plans.
 * All heavy lifting is on the server — these are thin fetch wrappers.
 */

import type { WorkoutPlan } from '../types';

/* ------------------------------------------------------------------ */
/*  Save a newly generated plan                                        */
/* ------------------------------------------------------------------ */

export async function savePlan(
  plan: WorkoutPlan,
  daysPerWeek: number,
  goal: string,
  level: string,
  secondaryGoal: string | null = null,
  splitType: string | null = null,
): Promise<string> {
  const res = await fetch('/api/plans', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ plan, daysPerWeek, goal, level, secondaryGoal, splitType }),
  });
  if (!res.ok) throw new Error('Failed to save plan');
  const data = (await res.json()) as { planId: string };
  return data.planId;
}

/* ------------------------------------------------------------------ */
/*  Load the active plan                                               */
/* ------------------------------------------------------------------ */

export async function loadActivePlan(): Promise<{ plan: WorkoutPlan; planId: string; splitType: string | null } | null> {
  const res = await fetch('/api/plans', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load plan');
  const data = (await res.json()) as { plan: WorkoutPlan; planId: string; splitType: string | null } | null;
  return data;
}

/* ------------------------------------------------------------------ */
/*  Load all plans (history)                                           */
/* ------------------------------------------------------------------ */

export async function loadAllPlans(): Promise<
  Array<{ id: string; planName: string; createdAt: string; isActive: boolean; splitType: string | null }>
> {
  const res = await fetch('/api/plans/history', { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load plans');
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Deactivate the current plan                                        */
/* ------------------------------------------------------------------ */

export async function deactivatePlan(planId: string): Promise<void> {
  const res = await fetch('/api/plans/deactivate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ planId }),
  });
  if (!res.ok) throw new Error('Failed to deactivate plan');
}
