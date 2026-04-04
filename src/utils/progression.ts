/**
 * Progressive overload suggestion engine.
 * Analyzes last session data and returns smart per-exercise suggestions.
 */

import type { LastSessionSet } from '../services/history';

export interface ProgressionSuggestion {
  type: 'increase' | 'match' | 'technique';
  message: string;
  suggestedWeight: number | null;
}

// Lower-body compound keywords
const LOWER_COMPOUNDS = ['squat', 'deadlift', 'leg press', 'hip thrust', 'lunge', 'romanian', 'rdl', 'front squat', 'hack squat'];

function isLowerCompound(exerciseName: string): boolean {
  const lower = exerciseName.toLowerCase();
  return LOWER_COMPOUNDS.some(k => lower.includes(k));
}

export function getSuggestion(
  lastSets: LastSessionSet[],
  targetReps: string,
  exerciseName: string,
): ProgressionSuggestion {
  if (!lastSets || lastSets.length === 0) {
    return { type: 'match', message: 'First session — set your baseline', suggestedWeight: null };
  }

  // Parse target reps range (e.g. "8-12" → { low: 8, high: 12 })
  const repRange = parseRepRange(targetReps);
  const maxWeight = Math.max(...lastSets.map(s => s.weight));
  const workingSets = lastSets.filter(s => s.weight > 0 && s.reps > 0);

  if (workingSets.length === 0) {
    return { type: 'match', message: 'First session — set your baseline', suggestedWeight: null };
  }

  // Check if all sets hit the top of the rep range (or exceeded)
  const allHitTarget = workingSets.every(s => s.reps >= repRange.high);
  // Check if sets missed the bottom of the rep range
  const missedTarget = workingSets.some(s => s.reps < repRange.low);

  const increment = isLowerCompound(exerciseName) ? 10 : 5;

  if (allHitTarget) {
    const newWeight = maxWeight + increment;
    return {
      type: 'increase',
      message: `↑ Try ${newWeight} lbs`,
      suggestedWeight: newWeight,
    };
  }

  if (missedTarget) {
    return {
      type: 'match',
      message: `→ Match ${maxWeight} lbs, hit ${repRange.low}-${repRange.high} reps`,
      suggestedWeight: maxWeight,
    };
  }

  // In range but not maxed — suggest same weight
  return {
    type: 'match',
    message: `→ Match ${maxWeight} lbs, push for ${repRange.high} reps`,
    suggestedWeight: maxWeight,
  };
}

function parseRepRange(reps: string): { low: number; high: number } {
  const rangeMatch = reps.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return { low: parseInt(rangeMatch[1], 10), high: parseInt(rangeMatch[2], 10) };
  }
  const single = parseInt(reps, 10);
  if (!isNaN(single)) {
    return { low: single, high: single };
  }
  return { low: 8, high: 12 }; // fallback
}
