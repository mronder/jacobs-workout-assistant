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
 * Ensure exactly 7 days in the schedule.
 * If AI returned fewer, pad with rest days. If more, trim excess rest days.
 */
function enforceSevenDays(week: WorkoutWeek, targetTrainingDays: number): WorkoutWeek {
  const schedule = [...week.schedule];

  // Pad to 7 if under
  while (schedule.length < 7) {
    const dayNum = schedule.length + 1;
    schedule.push(createRestDay(dayNum));
  }

  // Trim to 7 if over — remove extra rest days first, then excess training days
  if (schedule.length > 7) {
    // Separate training and rest days
    const training = schedule.filter((d) => !isRestDay(d));
    const rest = schedule.filter((d) => isRestDay(d));

    // Keep exactly targetTrainingDays training + fill rest to 7
    const kept = training.slice(0, targetTrainingDays);
    const restNeeded = 7 - kept.length;
    const keptRest = rest.slice(0, restNeeded);

    // Fill any remaining gap
    while (kept.length + keptRest.length < 7) {
      keptRest.push(createRestDay(kept.length + keptRest.length + 1));
    }

    // Interleave: alternate training and rest logically
    const merged = [...kept, ...keptRest].slice(0, 7);
    // Re-number days
    merged.forEach((d, idx) => {
      d.dayName = d.dayName.replace(/Day \d+/, `Day ${idx + 1}`);
    });
    return { ...week, schedule: merged };
  }

  return { ...week, schedule };
}

function isRestDay(day: WorkoutDay): boolean {
  const focus = day.focus.toLowerCase();
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
 * Validates the training day count matches the target.
 * Retries up to 2 times with exponential backoff.
 */
async function fetchWeekWithRetry(
  url: string,
  body: unknown,
  expectedTrainingDays: number,
  maxRetries = 2
): Promise<WorkoutWeek> {
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

      const text = await res.text();

      if (!text.trim()) {
        throw new Error('Empty response from AI');
      }

      if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
        throw new Error('API endpoint returned HTML instead of JSON.');
      }

      let weekData: WorkoutWeek;
      try {
        weekData = JSON.parse(text) as WorkoutWeek;
      } catch {
        const preview = text.length > 120 ? text.slice(0, 120) + '…' : text;
        throw new Error(`AI returned invalid JSON: "${preview}"`);
      }

      // Validate training day count — retry if AI returned wrong count
      if (weekData.schedule && Array.isArray(weekData.schedule)) {
        const trainingDays = weekData.schedule.filter((d) => !isRestDay(d)).length;
        if (trainingDays < expectedTrainingDays && attempt < maxRetries) {
          throw new Error(
            `Expected ${expectedTrainingDays} training days but got ${trainingDays}. Retrying...`
          );
        }
      }

      return weekData;
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
