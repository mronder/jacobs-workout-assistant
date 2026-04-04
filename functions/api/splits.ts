/**
 * Cloudflare Pages Function – GET /api/splits?days=N
 *
 * Returns available split options for the given day count.
 */

import type { Env } from './_shared/types';

type SplitOption = { splitName: string; dayFocuses: string[] };

const SPLIT_OPTIONS: Record<number, Record<string, SplitOption>> = {
  1: {
    full_body: {
      splitName: 'Full Body',
      dayFocuses: ['Full Body (Compounds Focus)'],
    },
  },
  2: {
    upper_lower: {
      splitName: 'Upper/Lower',
      dayFocuses: ['Upper Body (Chest, Back, Shoulders, Arms)', 'Lower Body (Quads, Hamstrings, Glutes, Calves)'],
    },
    full_body: {
      splitName: 'Full Body (×2)',
      dayFocuses: ['Full Body Day 1 (Strength)', 'Full Body Day 2 (Hypertrophy)'],
    },
  },
  3: {
    ppl: {
      splitName: 'Push/Pull/Legs',
      dayFocuses: ['Push (Chest, Shoulders, Triceps)', 'Pull (Back, Biceps, Rear Delts)', 'Legs (Quads, Hamstrings, Glutes, Calves)'],
    },
    full_body: {
      splitName: 'Full Body',
      dayFocuses: ['Full Body Day 1', 'Full Body Day 2', 'Full Body Day 3'],
    },
    upper_lower_full: {
      splitName: 'Upper/Lower + Full Body',
      dayFocuses: ['Upper Body (Chest, Back, Shoulders, Arms)', 'Lower Body (Quads, Hamstrings, Glutes, Calves)', 'Full Body'],
    },
  },
  4: {
    upper_lower: {
      splitName: 'Upper/Lower (×2)',
      dayFocuses: ['Upper Body A (Strength)', 'Lower Body A (Strength)', 'Upper Body B (Hypertrophy)', 'Lower Body B (Hypertrophy)'],
    },
    bro_split: {
      splitName: '4 Day Bro Split',
      dayFocuses: ['Chest & Triceps', 'Back & Biceps', 'Shoulders & Abs', 'Legs'],
    },
    ppl_full: {
      splitName: 'PPL + Full Body',
      dayFocuses: ['Push (Chest, Shoulders, Triceps)', 'Pull (Back, Biceps, Rear Delts)', 'Legs (Quads, Hamstrings, Glutes, Calves)', 'Full Body'],
    },
  },
  5: {
    bro_split: {
      splitName: 'Classic 5 Day Bro Split',
      dayFocuses: ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms (Biceps & Triceps)'],
    },
    upper_lower_ppl: {
      splitName: 'Upper/Lower + PPL',
      dayFocuses: ['Upper Body', 'Lower Body', 'Push (Chest, Shoulders, Triceps)', 'Pull (Back, Biceps, Rear Delts)', 'Legs (Quads, Hamstrings, Glutes, Calves)'],
    },
    phat: {
      splitName: 'PHAT',
      dayFocuses: ['Upper Power', 'Lower Power', 'Back & Shoulders Hypertrophy', 'Lower Hypertrophy', 'Chest & Arms Hypertrophy'],
    },
  },
  6: {
    ppl: {
      splitName: 'PPL (×2)',
      dayFocuses: [
        'Push A (Chest-focused)',
        'Pull A (Back-focused)',
        'Legs A (Quad-focused)',
        'Push B (Shoulder-focused)',
        'Pull B (Rear Delt & Bicep-focused)',
        'Legs B (Hamstring & Glute-focused)',
      ],
    },
    arnold: {
      splitName: 'Arnold Split',
      dayFocuses: [
        'Chest & Back A',
        'Shoulders & Arms A',
        'Legs A',
        'Chest & Back B',
        'Shoulders & Arms B',
        'Legs B',
      ],
    },
    ppl_upper_lower: {
      splitName: 'PPL + Upper/Lower',
      dayFocuses: [
        'Push (Chest, Shoulders, Triceps)',
        'Pull (Back, Biceps, Rear Delts)',
        'Legs (Quads, Hamstrings, Glutes, Calves)',
        'Upper Body',
        'Lower Body',
        'Full Body / Weak Points',
      ],
    },
  },
  7: {
    ppl_plus: {
      splitName: 'PPL + Upper/Lower + Active Recovery',
      dayFocuses: [
        'Push (Chest, Shoulders, Triceps)',
        'Pull (Back, Biceps, Rear Delts)',
        'Legs (Quads, Hamstrings, Glutes, Calves)',
        'Upper Body (Hypertrophy)',
        'Lower Body (Hypertrophy)',
        'Full Body / Weak Points',
        'Active Recovery / Mobility',
      ],
    },
    bro_split: {
      splitName: '7 Day Bro Split',
      dayFocuses: [
        'Chest',
        'Back',
        'Shoulders',
        'Legs (Quad-focused)',
        'Arms (Biceps & Triceps)',
        'Legs (Hamstring & Glute-focused)',
        'Active Recovery / Abs & Calves',
      ],
    },
  },
};

export const onRequest: PagesFunction<Env> = async (context) => {
  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (context.request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
  }

  const url = new URL(context.request.url);
  const daysParam = url.searchParams.get('days');
  const days = daysParam ? parseInt(daysParam, 10) : 0;

  if (!days || days < 1 || days > 7) {
    return new Response(JSON.stringify({ error: 'Invalid days parameter' }), { status: 400, headers: corsHeaders });
  }

  const options = SPLIT_OPTIONS[days];
  if (!options) {
    return new Response(
      JSON.stringify([{ key: 'full_body', splitName: 'Full Body', dayFocuses: Array.from({ length: days }, (_, i) => `Full Body Day ${i + 1}`) }]),
      { status: 200, headers: corsHeaders },
    );
  }

  const result = Object.entries(options).map(([key, opt]) => ({
    key,
    splitName: opt.splitName,
    dayFocuses: opt.dayFocuses,
  }));

  return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });
};
