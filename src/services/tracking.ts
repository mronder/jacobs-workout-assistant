/**
 * Service layer for saving and loading tracked workout data.
 * Thin fetch wrappers — the server handles all DB logic.
 */

import type { TrackedWorkout } from '../types';

/* ------------------------------------------------------------------ */
/*  Save (or update) a tracked workout                                 */
/* ------------------------------------------------------------------ */

export async function saveTrackedWorkout(
  planId: string,
  workout: TrackedWorkout,
): Promise<void> {
  const res = await fetch('/api/tracking', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ planId, workout }),
  });
  if (!res.ok) throw new Error('Failed to save tracked workout');
}

/* ------------------------------------------------------------------ */
/*  Load all tracked workouts for a plan                               */
/* ------------------------------------------------------------------ */

export async function loadTrackedWorkouts(
  planId: string,
): Promise<TrackedWorkout[]> {
  const res = await fetch(`/api/tracking?planId=${encodeURIComponent(planId)}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Failed to load tracked workouts');
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Weekly notes                                                        */
/* ------------------------------------------------------------------ */

export async function loadWeeklyNotes(
  planId: string,
): Promise<{ weekNumber: number; note: string }[]> {
  const res = await fetch(`/api/weekly-notes?planId=${encodeURIComponent(planId)}`, {
    credentials: 'same-origin',
  });
  if (!res.ok) throw new Error('Failed to load weekly notes');
  return res.json();
}

export async function saveWeeklyNote(
  planId: string,
  weekNumber: number,
  note: string,
): Promise<void> {
  const res = await fetch('/api/weekly-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ planId, weekNumber, note }),
  });
  if (!res.ok) throw new Error('Failed to save weekly note');
}
