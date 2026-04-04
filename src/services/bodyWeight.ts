/**
 * Service layer for bodyweight tracking.
 */

export interface BodyWeightEntry {
  id: string;
  weight: number;
  unit: string;
  date: string;
}

export async function loadBodyWeightHistory(range: number = 90): Promise<BodyWeightEntry[]> {
  const res = await fetch(`/api/body-weight?range=${range}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error('Failed to load body weight history');
  return res.json();
}

export async function saveBodyWeight(weight: number, unit: string = 'lbs'): Promise<void> {
  const res = await fetch('/api/body-weight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ weight, unit }),
  });
  if (!res.ok) throw new Error('Failed to save body weight');
}
