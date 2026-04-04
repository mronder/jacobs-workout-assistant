/**
 * Service layer for user preferences.
 */

export interface UserPreferences {
  defaultWeightUnit: string;
  mobilityAreas: string[];
  sessionDuration: number;
}

export async function loadPreferences(): Promise<UserPreferences> {
  const res = await fetch('/api/preferences', { credentials: 'same-origin' });
  if (!res.ok) return { defaultWeightUnit: 'lbs', mobilityAreas: [], sessionDuration: 60 };
  return res.json();
}

export async function savePreferences(prefs: Partial<UserPreferences>): Promise<void> {
  await fetch('/api/preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(prefs),
  });
}
