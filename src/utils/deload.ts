/**
 * Goal-aware deload week generator.
 * Transforms an existing Week 1 plan into a recovery week — no GPT call needed.
 */

import type { WorkoutDay, WorkoutWeek } from '../types';

export function generateDeloadWeek(
  baseDays: WorkoutDay[],
  goal: string,
): WorkoutWeek {
  const lower = goal.toLowerCase();

  const days = baseDays.map(day => {
    const exercises = day.exercises.map(ex => {
      if (lower.includes('strength')) {
        // Strength deload: keep exercises, reduce sets by 50%, keep intensity high, 1-3 reps
        return {
          ...ex,
          sets: Math.max(1, Math.round(ex.sets * 0.5)),
          reps: '2-3',
          rest: '2-3 min',
          expertAdvice: `DELOAD: Use 80-85% of your working weight. Focus on crisp, explosive reps.`,
        };
      } else if (lower.includes('fat') || lower.includes('general') || lower.includes('endurance')) {
        // General/fat loss deload: fewer exercises, moderate weight, higher reps
        return {
          ...ex,
          sets: Math.max(2, Math.round(ex.sets * 0.5)),
          reps: '12-15',
          rest: '45-60s',
          expertAdvice: `DELOAD: Use 50-60% of your working weight. Keep it light and move well.`,
        };
      } else {
        // Hypertrophy deload (default): same exercises, drop sets by 50%, 60-70% weight
        return {
          ...ex,
          sets: Math.max(1, Math.round(ex.sets * 0.5)),
          reps: ex.reps, // keep same rep range
          rest: ex.rest,
          expertAdvice: `DELOAD: Use 60-70% of your working weight. Focus on muscle connection and form.`,
        };
      }
    });

    return {
      ...day,
      description: `Deload — ${day.focus} (Recovery Focus)`,
      exercises,
    };
  });

  return {
    weekNumber: 0, // Marker for deload week
    days,
  };
}
