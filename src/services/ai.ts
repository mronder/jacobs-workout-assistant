import type { UserProfile, WorkoutPlan, WorkoutWeek } from '../store/useAppStore';

/**
 * In development the Vite plugin serves /api/*. In production Netlify
 * Functions are at /.netlify/functions/*. Using direct function URLs in
 * production avoids reliance on redirect rules that can silently fall
 * through to the SPA catch-all (returning index.html instead of JSON).
 */
const API_BASE = import.meta.env.DEV ? '/api' : '/.netlify/functions';

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

      // Detect HTML responses (SPA fallback served index.html instead of function)
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

      // Detect HTML responses (indicates SPA fallback served index.html)
      if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
        throw new Error('API endpoint returned HTML instead of JSON. The serverless function may not be deployed correctly.');
      }

      try {
        return JSON.parse(text) as WorkoutWeek;
      } catch {
        // Include a preview of the text for debugging
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
