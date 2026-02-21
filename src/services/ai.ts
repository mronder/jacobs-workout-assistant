import type { UserProfile, WorkoutPlan, WorkoutWeek, WorkoutDay } from '../store/useAppStore';

/**
 * API base path — same in dev (Vite plugin) and production (Netlify Edge Functions).
 */
const API_BASE = '/api';

/**
 * Generate workout plan with ALL weeks in parallel.
 * Meta + every week fire simultaneously → total time ≈ slowest single call (~20-25s)
 * instead of sum of all calls (~2-5 minutes).
 */
export async function generateWorkoutPlan(
  profile: UserProfile,
  onPhaseChange?: (phase: string, weekProgress?: { current: number; total: number }) => void
): Promise<WorkoutPlan> {
  const totalWeeks = profile.planDurationWeeks;

  onPhaseChange?.('Generating your complete program...', { current: 0, total: totalWeeks });

  // Fire meta + ALL weeks in parallel
  const metaPromise = fetchWithRetry<{ title: string; description: string; frequency: string }>(
    `${API_BASE}/generate-meta`,
    profile
  );

  const weekPromises = Array.from({ length: totalWeeks }, (_, i) => {
    const weekNumber = i + 1;
    return fetchWeekWithRetry(
      `${API_BASE}/generate-week`,
      { profile, weekNumber, totalWeeks },
      profile.daysPerWeek
    ).then((weekData) => {
      // Report progress as each week completes
      onPhaseChange?.(`Week ${weekNumber} complete`, { current: weekNumber, total: totalWeeks });
      return weekData;
    });
  });

  // Wait for everything
  const [meta, ...weeks] = await Promise.all([metaPromise, ...weekPromises]);

  // Validate & enforce 7-day schedule for each week
  const validatedWeeks = weeks.map((week, i) => {
    if (!week.schedule || !Array.isArray(week.schedule)) {
      throw new Error(`Week ${i + 1} has invalid structure. Please try again.`);
    }
    return enforceSevenDays(week, profile.daysPerWeek);
  });

  onPhaseChange?.('Finalizing your plan...');

  return {
    title: meta.title || 'Your Custom Program',
    description: meta.description || '',
    frequency: meta.frequency || `${profile.daysPerWeek} days/week`,
    durationWeeks: totalWeeks,
    weeks: validatedWeeks,
  };
}

/**
 * Enforce exactly 7 days with the correct training-to-rest ratio.
 *
 * Step 1: Classify each day as training or rest.
 *         - Any day with "rest" or "recovery" in its focus AND empty/no exercises → rest
 *         - Any day with "rest" or "recovery" in focus BUT with exercises → strip exercises, make it rest
 *         - Anything else with exercises → training
 *
 * Step 2: Ensure exactly targetTrainingDays training days.
 *         If too many: convert excess training days (from the end) to rest.
 *         If too few: can't add training (no exercises), but this is rare with the prompt.
 *
 * Step 3: Pad or trim to exactly 7 total.
 */
function enforceSevenDays(week: WorkoutWeek, targetTrainingDays: number): WorkoutWeek {
  // Step 1: Classify and clean up
  const classified = (week.schedule || []).map((day) => {
    const focus = (day.focus || '').toLowerCase();
    const isRecoveryLabel = focus.includes('rest') || focus.includes('recovery');

    if (isRecoveryLabel) {
      // Force to proper rest day — move any exercises to cooldown activities
      return {
        ...day,
        focus: 'Rest',
        warmup: [],
        exercises: [],
        cooldown: day.cooldown?.length
          ? day.cooldown
          : ['Foam rolling (10 min)', 'Light walk (20 min)', 'Mobility flow (5 min)', 'Full body stretching (10 min)'],
      };
    }

    return day;
  });

  // Step 2: Split into training and rest
  const training: WorkoutDay[] = [];
  const rest: WorkoutDay[] = [];

  for (const day of classified) {
    if (day.exercises && day.exercises.length > 0) {
      training.push(day);
    } else {
      rest.push(day);
    }
  }

  // Trim excess training days if we have too many
  while (training.length > targetTrainingDays) {
    const removed = training.pop()!;
    rest.push({
      ...removed,
      focus: 'Rest',
      warmup: [],
      exercises: [],
      cooldown: ['Foam rolling (10 min)', 'Light walk (20 min)', 'Mobility flow (5 min)', 'Stretching (10 min)'],
    });
  }

  // Step 3: Build final 7-day schedule
  const restNeeded = 7 - training.length;

  // Pad rest days if needed
  while (rest.length < restNeeded) {
    rest.push(createRestDay(0));
  }

  // Interleave training and rest days naturally
  const final: WorkoutDay[] = [];
  let tIdx = 0;
  let rIdx = 0;

  for (let d = 0; d < 7; d++) {
    if (tIdx < training.length && (rIdx >= restNeeded || d % Math.ceil(7 / targetTrainingDays) !== Math.ceil(7 / targetTrainingDays) - 1)) {
      final.push(training[tIdx++]);
    } else if (rIdx < restNeeded) {
      final.push(rest[rIdx++]);
    } else if (tIdx < training.length) {
      final.push(training[tIdx++]);
    } else {
      final.push(createRestDay(d + 1));
    }
  }

  // Re-number days
  final.forEach((d, idx) => {
    d.dayName = d.dayName.replace(/Day \d+/, `Day ${idx + 1}`);
  });

  return { ...week, schedule: final };
}

function isRestDay(day: WorkoutDay): boolean {
  const focus = (day.focus || '').toLowerCase();
  return focus.includes('rest') || focus.includes('recovery') || !day.exercises || day.exercises.length === 0;
}

function createRestDay(dayNum: number): WorkoutDay {
  return {
    dayName: `Day ${dayNum} — Active Recovery`,
    focus: 'Rest',
    warmup: [],
    exercises: [],
    cooldown: [
      'Foam rolling — full body (10 min)',
      'Light walk or easy cycling (20 min)',
      'Hip mobility flow (5 min)',
      'Full body stretching routine (10 min)',
    ],
  };
}

/**
 * Fetch with exponential backoff retry (up to 2 retries).
 * Used for simple JSON endpoints (e.g. generate-meta).
 */
async function fetchWithRetry<T>(url: string, body: unknown, maxRetries = 2): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(1000 * Math.pow(2, attempt));
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        throw new Error('API endpoint returned HTML. The serverless function may not be deployed correctly.');
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) break;
    }
  }

  throw lastError ?? new Error('Request failed');
}

/**
 * Fetch a workout week, supporting both streaming and regular JSON responses.
 * Only retries on real failures (500, network). Day-count issues are handled
 * client-side by enforceSevenDays() — retrying is too expensive (20-30s per call).
 */
async function fetchWeekWithRetry(
  url: string,
  body: unknown,
  _expectedTrainingDays: number,
  maxRetries = 1
): Promise<WorkoutWeek> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(2000);
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      const text = await res.text();

      if (!text.trim()) {
        throw new Error('Empty response from AI');
      }

      if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
        throw new Error('API endpoint returned HTML instead of JSON.');
      }

      try {
        return JSON.parse(text) as WorkoutWeek;
      } catch {
        const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
        throw new Error(`AI returned invalid JSON: "${preview}"`);
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) break;
    }
  }

  throw lastError ?? new Error('Request failed');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
