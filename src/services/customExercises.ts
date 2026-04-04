/**
 * Service layer for custom exercises CRUD.
 * Thin fetch wrappers — the server handles all DB logic.
 */

export interface CustomExercise {
  id: string;
  dayNumber: number;
  exerciseName: string;
  sets: number;
  position: number;
}

/* ------------------------------------------------------------------ */
/*  Load custom exercises for a plan (optionally filtered by day)      */
/* ------------------------------------------------------------------ */

export async function loadCustomExercises(
  planId: string,
  dayNumber?: number,
): Promise<CustomExercise[]> {
  let url = `/api/custom-exercises?planId=${encodeURIComponent(planId)}`;
  if (dayNumber !== undefined) {
    url += `&dayNumber=${dayNumber}`;
  }
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load custom exercises');
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Add a custom exercise to a plan day                                */
/* ------------------------------------------------------------------ */

export async function addCustomExercise(
  planId: string,
  dayNumber: number,
  exerciseName: string,
  sets: number = 3,
): Promise<CustomExercise> {
  const res = await fetch('/api/custom-exercises', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ planId, dayNumber, exerciseName, sets }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Failed to add exercise' }));
    throw new Error((data as { error?: string }).error || 'Failed to add exercise');
  }
  return res.json();
}

/* ------------------------------------------------------------------ */
/*  Remove a custom exercise                                           */
/* ------------------------------------------------------------------ */

export async function removeCustomExercise(id: string): Promise<void> {
  const res = await fetch('/api/custom-exercises', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ id }),
  });
  if (!res.ok) throw new Error('Failed to remove custom exercise');
}
