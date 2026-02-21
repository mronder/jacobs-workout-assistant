import type { UserProfile, WorkoutPlan, WorkoutWeek } from '../store/useAppStore';

const API_BASE = '/api';

/**
 * Generate workout plan week-by-week to avoid token truncation.
 * Each week is a separate API call (~3-4k tokens vs 20-40k for full plan).
 */
export async function generateWorkoutPlan(
  profile: UserProfile,
  onPhaseChange?: (phase: string, weekProgress?: { current: number; total: number }) => void
): Promise<WorkoutPlan> {
  const totalWeeks = profile.planDurationWeeks;

  // Step 1: Generate metadata (title, description, frequency)
  onPhaseChange?.('Creating your program identity...');
  const meta = await fetchWithRetry<{ title: string; description: string; frequency: string }>(
    `${API_BASE}/generate-meta`,
    profile
  );

  // Step 2: Generate each week sequentially
  const weeks: WorkoutWeek[] = [];
  let previousWeekSummary: string | undefined;

  for (let w = 1; w <= totalWeeks; w++) {
    onPhaseChange?.(`Generating Week ${w} of ${totalWeeks}...`, { current: w, total: totalWeeks });

    const weekData = await fetchWeekWithRetry(
      `${API_BASE}/generate-week`,
      { profile, weekNumber: w, totalWeeks, previousWeekSummary }
    );

    // Validate week structure
    if (!weekData.schedule || !Array.isArray(weekData.schedule)) {
      throw new Error(`Week ${w} has invalid structure. Please try again.`);
    }

    weeks.push(weekData);

    // Build a brief summary for the next week's context (progression continuity)
    const trainingDays = weekData.schedule
      .filter((d) => !d.focus.toLowerCase().includes('rest'))
      .map((d) => d.focus);
    previousWeekSummary = `Week ${w}: ${trainingDays.join(', ')}`;
  }

  onPhaseChange?.('Finalizing your plan...');
  await sleep(300);

  return {
    title: meta.title || 'Your Custom Program',
    description: meta.description || '',
    frequency: meta.frequency || `${profile.daysPerWeek} days/week`,
    durationWeeks: totalWeeks,
    weeks,
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

      return (await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxRetries) break;
    }
  }

  throw lastError ?? new Error('Request failed');
}

/**
 * Fetch a workout week, supporting both:
 *  - Streaming responses (Netlify production: text/plain chunked stream)
 *  - Regular JSON responses (Vite dev server)
 * Reads the full response body as text, then JSON-parses.
 * Retries up to 2 times with exponential backoff.
 */
async function fetchWeekWithRetry(url: string, body: unknown, maxRetries = 2): Promise<WorkoutWeek> {
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
        // Error responses are always JSON
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error (${res.status})`);
      }

      // Read full body as text (works for both streaming and non-streaming)
      const text = await res.text();

      if (!text.trim()) {
        throw new Error('Empty response from AI');
      }

      try {
        return JSON.parse(text) as WorkoutWeek;
      } catch {
        throw new Error('AI returned invalid JSON. Please try again.');
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
