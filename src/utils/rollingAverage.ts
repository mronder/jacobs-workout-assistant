/**
 * Compute a 7-day rolling average from bodyweight entries.
 */

export interface RollingAvgPoint {
  date: string;
  raw: number;
  average: number | null;
}

export function computeRollingAverage(
  entries: Array<{ weight: number; date: string }>,
  windowDays: number = 7,
): RollingAvgPoint[] {
  if (entries.length === 0) return [];

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((entry, i) => {
    const entryDate = new Date(entry.date).getTime();
    const windowStart = entryDate - windowDays * 24 * 60 * 60 * 1000;

    // Get all entries within the window ending at this entry
    const windowEntries = sorted.filter(e => {
      const t = new Date(e.date).getTime();
      return t >= windowStart && t <= entryDate;
    });

    const average = windowEntries.length >= 2
      ? windowEntries.reduce((sum, e) => sum + e.weight, 0) / windowEntries.length
      : null;

    return {
      date: entry.date,
      raw: entry.weight,
      average: average !== null ? Math.round(average * 10) / 10 : null,
    };
  });
}

export type TrendDirection = 'up' | 'down' | 'stable';

export function computeTrend(
  points: RollingAvgPoint[],
  lookbackDays: number = 14,
): { direction: TrendDirection; change: number } {
  const withAvg = points.filter(p => p.average !== null);
  if (withAvg.length < 2) return { direction: 'stable', change: 0 };

  const latest = withAvg[withAvg.length - 1];
  const cutoff = new Date(latest.date).getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  const earlier = withAvg.find(p => new Date(p.date).getTime() >= cutoff && p.average !== null);

  if (!earlier || !latest.average || !earlier.average) return { direction: 'stable', change: 0 };

  const change = Math.round((latest.average - earlier.average) * 10) / 10;
  const threshold = 0.5; // lbs

  if (Math.abs(change) < threshold) return { direction: 'stable', change };
  return { direction: change > 0 ? 'up' : 'down', change };
}
