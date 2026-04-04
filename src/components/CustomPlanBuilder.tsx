import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Trash2, Layers, Dumbbell, Sparkles, Loader2 } from 'lucide-react';
import type { WorkoutPlan, WorkoutWeek, WorkoutDay, Exercise } from '../types';

interface SplitInfo {
  key: string;
  splitName: string;
  dayFocuses: string[];
}

interface CustomPlanBuilderProps {
  onSave: (plan: WorkoutPlan, splitType: string | null) => void;
  onCancel: () => void;
}

interface DayConfig {
  focus: string;
  exercises: Exercise[];
}

export default function CustomPlanBuilder({ onSave, onCancel }: CustomPlanBuilderProps) {
  const [step, setStep] = useState(0); // 0=days, 1=split, 2=build exercises
  const [direction, setDirection] = useState(1);
  const [days, setDays] = useState(4);
  const [splitType, setSplitType] = useState<string | null>(null);
  const [availableSplits, setAvailableSplits] = useState<SplitInfo[]>([]);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);

  // Fetch available splits
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/splits?days=${days}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data: SplitInfo[]) => {
        if (cancelled) return;
        setAvailableSplits(data);
        if (!data.find((s) => s.key === splitType)) {
          setSplitType(data.length > 0 ? data[0].key : null);
        }
      })
      .catch(() => { if (!cancelled) setAvailableSplits([]); });
    return () => { cancelled = true; };
  }, [days]);

  // Initialize day configs when split is selected and we move to step 2
  useEffect(() => {
    if (step === 2 && dayConfigs.length === 0) {
      const selected = availableSplits.find(s => s.key === splitType);
      const focuses = selected?.dayFocuses || Array.from({ length: days }, (_, i) => `Day ${i + 1}`);
      setDayConfigs(focuses.map(f => ({ focus: f, exercises: [] })));
    }
  }, [step]);

  const goNext = () => { setDirection(1); setStep(s => s + 1); };
  const goBack = () => {
    if (step === 0) { onCancel(); return; }
    setDirection(-1);
    setStep(s => s - 1);
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  const addExercise = async () => {
    const name = newExerciseName.trim();
    if (!name) return;
    setNewExerciseName('');
    setSuggestingFor(name);

    // Default exercise
    const defaultExercise: Exercise = {
      name,
      sets: 3,
      reps: '8-12',
      rest: '60-90s',
      alternatives: [],
      videoSearchQuery: `${name} proper form`,
      expertAdvice: 'Focus on controlled form and full range of motion.',
    };

    // Add immediately with defaults
    setDayConfigs(prev => {
      const updated = [...prev];
      updated[activeDayIndex] = {
        ...updated[activeDayIndex],
        exercises: [...updated[activeDayIndex].exercises, defaultExercise],
      };
      return updated;
    });

    // Fire AI suggestion in background
    try {
      const res = await fetch('/api/suggest-exercise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ exerciseName: name }),
      });
      if (res.ok) {
        const suggestion: { sets: number; reps: string; rest: string; expertAdvice: string } = await res.json();
        setDayConfigs(prev => {
          const updated = [...prev];
          const dayExercises = [...updated[activeDayIndex].exercises];
          const idx = dayExercises.findIndex(e => e.name === name);
          if (idx >= 0) {
            dayExercises[idx] = {
              ...dayExercises[idx],
              sets: suggestion.sets || 3,
              reps: suggestion.reps || '8-12',
              rest: suggestion.rest || '60-90s',
              expertAdvice: suggestion.expertAdvice || dayExercises[idx].expertAdvice,
            };
            updated[activeDayIndex] = { ...updated[activeDayIndex], exercises: dayExercises };
          }
          return updated;
        });
      }
    } catch {
      // Ignore — defaults already applied
    } finally {
      setSuggestingFor(null);
    }
  };

  const removeExercise = (exIndex: number) => {
    setDayConfigs(prev => {
      const updated = [...prev];
      updated[activeDayIndex] = {
        ...updated[activeDayIndex],
        exercises: updated[activeDayIndex].exercises.filter((_, i) => i !== exIndex),
      };
      return updated;
    });
  };

  const updateDayFocus = (focus: string) => {
    setDayConfigs(prev => {
      const updated = [...prev];
      updated[activeDayIndex] = { ...updated[activeDayIndex], focus };
      return updated;
    });
  };

  const buildAndSave = () => {
    const selected = availableSplits.find(s => s.key === splitType);
    const splitName = selected?.splitName || 'Custom Plan';

    // Build a single week, then duplicate for 4 weeks (same as AI-generated plans)
    const baseDays: WorkoutDay[] = dayConfigs.map((dc, i) => ({
      dayNumber: i + 1,
      focus: dc.focus,
      description: `Custom ${dc.focus} day.`,
      exercises: dc.exercises.length > 0 ? dc.exercises : [{
        name: 'Rest / Active Recovery',
        sets: 1,
        reps: '—',
        rest: '—',
        alternatives: [],
        videoSearchQuery: 'active recovery routine',
        expertAdvice: 'Add exercises to customize this day.',
      }],
    }));

    const weeks: WorkoutWeek[] = [1, 2, 3, 4].map(weekNumber => ({
      weekNumber,
      days: baseDays.map(d => ({ ...d })),
    }));

    const plan: WorkoutPlan = {
      planName: `Custom ${splitName}`,
      splitDescription: `A custom ${days}-day ${splitName} split built from scratch.`,
      motivationalQuote: 'The iron never lies to you.',
      quoteAuthor: 'Henry Rollins',
      weeks,
    };

    onSave(plan, splitType);
  };

  const hasExercises = dayConfigs.some(dc => dc.exercises.length > 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="max-w-lg mx-auto flex flex-col min-h-[calc(100vh-8rem)]"
    >
      {/* Header card */}
      <div className="relative overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-5 py-5 shadow-card mb-5">
        <div className="absolute -top-16 right-[-40px] h-36 w-36 rounded-full bg-orange-500/14 blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-4">
          <button onClick={goBack} className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-2 -ml-2 rounded-xl hover:bg-white/5">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-[10px] text-zinc-500 uppercase tracking-[0.28em] font-medium">
            Custom Builder · {step + 1} of 3
          </span>
          <div className="w-7" />
        </div>
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-orange-300/80 mb-2">Build from Scratch</p>
          <h2 className="text-3xl font-bold tracking-tight leading-none mb-2">Design your own program.</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {step === 0 ? 'Pick your training frequency.' : step === 1 ? 'Choose a split template.' : 'Add exercises to each day.'}
          </p>
        </div>
        <div className="flex gap-1.5 mb-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/8">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-300 to-orange-500 rounded-full"
                initial={false}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center py-4">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 0 && (
            <motion.div key="cb-days" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeInOut' }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-[22px] bg-orange-500/15 border border-orange-300/15 flex items-center justify-center mx-auto mb-5 shadow-card">
                  <Dumbbell className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight mb-3">How many days?</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[3, 4, 5, 6].map(d => (
                  <button
                    key={d}
                    onClick={() => { setDays(d); goNext(); }}
                    className={`rounded-[24px] border px-4 py-5 text-left transition-all duration-200 cursor-pointer ${
                      days === d
                        ? 'border-orange-300/40 bg-gradient-to-br from-orange-300 to-orange-500 text-black shadow-lg shadow-orange-500/25'
                        : 'border-white/8 bg-surface-1/80 text-zinc-300 hover:border-orange-300/20 hover:bg-surface-2 shadow-card'
                    }`}
                  >
                    <div className="font-mono text-3xl font-bold">{d}</div>
                    <div className={`text-xs mt-2 ${days === d ? 'text-black/70' : 'text-zinc-500'}`}>days/week</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="cb-split" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeInOut' }}>
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-[22px] bg-orange-500/15 border border-orange-300/15 flex items-center justify-center mx-auto mb-5 shadow-card">
                  <Layers className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight mb-3">Pick a split</h2>
              </div>
              <div className="space-y-3">
                {availableSplits.map(s => (
                  <button
                    key={s.key}
                    onClick={() => { setSplitType(s.key); setDayConfigs([]); goNext(); }}
                    className={`w-full rounded-[24px] border p-5 text-left transition-all duration-200 cursor-pointer shadow-card ${
                      splitType === s.key
                        ? 'border-orange-300/40 bg-gradient-to-r from-orange-400/15 to-transparent text-white'
                        : 'border-white/8 bg-surface-1/80 text-zinc-400 hover:border-orange-300/15 hover:bg-surface-2 hover:text-zinc-200'
                    }`}
                  >
                    <div className="text-base font-bold mb-2">{s.splitName}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.dayFocuses.map((focus, i) => (
                        <span key={i} className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/5 text-zinc-500">
                          D{i + 1}: {focus.split('(')[0].trim()}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="cb-exercises" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25, ease: 'easeInOut' }}>
              {/* Day tabs */}
              <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                {dayConfigs.map((dc, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveDayIndex(i)}
                    className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-medium transition-all cursor-pointer ${
                      activeDayIndex === i
                        ? 'bg-orange-500 text-black'
                        : 'bg-surface-1/80 text-zinc-400 hover:text-white border border-white/8'
                    }`}
                  >
                    Day {i + 1}
                    {dc.exercises.length > 0 && (
                      <span className="ml-1.5 text-[10px] opacity-70">({dc.exercises.length})</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Focus input */}
              <div className="mb-4">
                <label className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-2 block">Day Focus</label>
                <input
                  type="text"
                  value={dayConfigs[activeDayIndex]?.focus || ''}
                  onChange={(e) => updateDayFocus(e.target.value)}
                  className="w-full bg-surface-1 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-orange-300/40 transition-colors"
                  placeholder="e.g. Chest & Triceps"
                />
              </div>

              {/* Exercise list */}
              <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
                {dayConfigs[activeDayIndex]?.exercises.map((ex, i) => (
                  <div key={i} className="flex items-center gap-3 bg-surface-1/80 border border-white/8 rounded-2xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ex.name}</p>
                      <p className="text-[10px] text-zinc-500">{ex.sets} sets × {ex.reps} · {ex.rest}</p>
                    </div>
                    {suggestingFor === ex.name && (
                      <Sparkles className="w-4 h-4 text-orange-400 animate-pulse shrink-0" />
                    )}
                    <button onClick={() => removeExercise(i)} className="text-zinc-500 hover:text-red-400 transition-colors cursor-pointer p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {dayConfigs[activeDayIndex]?.exercises.length === 0 && (
                  <p className="text-center text-zinc-500 text-sm py-6">No exercises yet. Add some below.</p>
                )}
              </div>

              {/* Add exercise input */}
              <div className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newExerciseName}
                  onChange={(e) => setNewExerciseName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addExercise(); }}
                  className="flex-1 bg-surface-1 border border-white/8 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-orange-300/40 transition-colors"
                  placeholder="Exercise name..."
                />
                <button
                  onClick={addExercise}
                  disabled={!!suggestingFor}
                  className="bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-black rounded-2xl px-4 py-3 transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  {suggestingFor ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </button>
              </div>

              {/* Save button */}
              <motion.button
                onClick={buildAndSave}
                disabled={!hasExercises}
                className="w-full py-5 bg-gradient-to-r from-orange-300 via-orange-500 to-orange-600 hover:from-orange-300 hover:to-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold text-lg rounded-[26px] transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-orange-500/25 active:scale-[0.98]"
                whileTap={{ scale: 0.97 }}
              >
                <Dumbbell className="w-5 h-5" />
                Save Plan
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
