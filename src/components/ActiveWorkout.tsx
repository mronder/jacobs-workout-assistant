import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, PlayCircle, Info, ChevronDown, ChevronUp, Plus, Timer, ArrowLeft, MessageSquare, MoreVertical, Trophy } from 'lucide-react';
import { WorkoutPlan, TrackedWorkout, TrackedExercise } from '../types';

/** Parse rest strings like '60s', '90s', '2 min', '2-3 min', '60-90s' into seconds (lower bound). */
function parseRestSeconds(rest: string): number {
  const cleaned = rest.toLowerCase().trim();
  // Match patterns like "60-90s", "60s", "2-3 min", "2 min"
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|minutes?)?$/);
  if (rangeMatch) {
    const val = parseFloat(rangeMatch[1]);
    const unit = rangeMatch[3] || 's';
    return unit.startsWith('m') ? Math.round(val * 60) : Math.round(val);
  }
  const singleMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*(s|sec|seconds?|m|min|minutes?)?$/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    const unit = singleMatch[2] || 's';
    return unit.startsWith('m') ? Math.round(val * 60) : Math.round(val);
  }
  return 60; // Fallback default
}

/** Strip orphaned superset labels from rest/description text */
function cleanSupersetText(text: string, hasPartner: boolean): string {
  if (hasPartner) return text;
  return text.replace(/\b[Ss]uper\s*[Ss]et\b[:\s-]*/gi, '').trim() || text;
}

interface ActiveWorkoutProps {
  plan: WorkoutPlan;
  week: number;
  day: number;
  existingWorkout?: TrackedWorkout;
  onComplete: (workout: TrackedWorkout) => void;
  onCancel: () => void;
  onAutoSave?: (exercises: TrackedExercise[], note?: string) => void;
}

export default function ActiveWorkout({
  plan,
  week,
  day,
  existingWorkout,
  onComplete,
  onCancel,
  onAutoSave,
}: ActiveWorkoutProps) {
  const workoutDay = plan.weeks
    .find((w) => w.weekNumber === week)
    ?.days.find((d) => d.dayNumber === day);

  const [trackedData, setTrackedData] = useState<TrackedExercise[]>(() => {
    // Build fresh default from plan
    const freshDefault = () => workoutDay?.exercises.map((ex) => ({
      exerciseName: ex.name,
      weightUnit: 'lbs' as const,
      sets: Array.from({ length: ex.sets }).map(() => ({
        weight: 0,
        reps: 0,
        completed: false,
      })),
    })) ?? [];

    // Validate that a saved exercise name matches the plan exercise (original or alt)
    const isValidName = (savedName: string, planEx: { name: string; alternatives: { name: string }[] }) =>
      savedName === planEx.name || planEx.alternatives.some(a => a.name === savedName);

    // Recover in-progress session from localStorage
    try {
      const saved = localStorage.getItem('jw_active_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session.week === week && session.day === day && session.exercises?.length && workoutDay) {
          // Validate exercise count matches current plan
          if (session.exercises.length === workoutDay.exercises.length) {
            // Validate each exercise name is the original or a known alternative
            const validated = session.exercises.map((savedEx: TrackedExercise, i: number) => {
              const planEx = workoutDay.exercises[i];
              if (isValidName(savedEx.exerciseName, planEx)) return savedEx;
              // Name doesn't match — reset to original exercise name, keep set data
              return { ...savedEx, exerciseName: planEx.name };
            });
            return validated;
          }
          // Exercise count mismatch — discard stale session
        }
      }
    } catch { /* ignore corrupt data */ }
    if (existingWorkout && workoutDay && existingWorkout.exercises.length === workoutDay.exercises.length) {
      // Validate existing workout exercise names too
      return existingWorkout.exercises.map((savedEx, i) => {
        const planEx = workoutDay.exercises[i];
        if (isValidName(savedEx.exerciseName, planEx)) return savedEx;
        return { ...savedEx, exerciseName: planEx.name };
      });
    }
    if (existingWorkout) return existingWorkout.exercises;
    return freshDefault();
  });

  // Day-level note
  const [workoutNote, setWorkoutNote] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('jw_active_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session.week === week && session.day === day) {
          return session.workoutNote ?? '';
        }
      }
    } catch { /* ignore */ }
    return existingWorkout?.note ?? '';
  });

  const [expandedExercise, setExpandedExercise] = useState<number | null>(0);
  const [showTips, setShowTips] = useState<Record<number, boolean>>({});
  const [showSwap, setShowSwap] = useState<Record<number, boolean>>({});
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Rest timer state
  const [activeTimer, setActiveTimer] = useState<{
    exIndex: number;
    totalSeconds: number;
    startedAt: number;
  } | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(0);
  const [timerComplete, setTimerComplete] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (expandedExercise !== null && exerciseRefs.current[expandedExercise]) {
      setTimeout(() => {
        const el = exerciseRefs.current[expandedExercise];
        if (el) {
          const y = el.getBoundingClientRect().top + window.scrollY - 100;
          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 50);
    }
  }, [expandedExercise]);

  // Auto-save to localStorage on every change (survives phone lock / app close)
  useEffect(() => {
    localStorage.setItem(
      'jw_active_session',
      JSON.stringify({ week, day, exercises: trackedData, workoutNote, lastSaved: Date.now() })
    );
  }, [trackedData, workoutNote, week, day]);

  // Debounced auto-save to server (2s after last change)
  const trackedDataRef = useRef(trackedData);
  trackedDataRef.current = trackedData;
  const workoutNoteRef = useRef(workoutNote);
  workoutNoteRef.current = workoutNote;
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedServerSave = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onAutoSave?.(trackedDataRef.current, workoutNoteRef.current);
    }, 2000);
  }, [onAutoSave]);

  // Trigger debounced save on every data change
  useEffect(() => {
    debouncedServerSave();
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [trackedData, workoutNote, debouncedServerSave]);

  // Also save to server when app goes to background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        onAutoSave?.(trackedDataRef.current, workoutNoteRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [onAutoSave]);

  // Rest timer countdown using elapsed-time calculation (survives phone sleep)
  useEffect(() => {
    if (!activeTimer) return;
    const tick = () => {
      const elapsed = (Date.now() - activeTimer.startedAt) / 1000;
      const remaining = Math.max(0, activeTimer.totalSeconds - elapsed);
      setTimerSecondsLeft(Math.ceil(remaining));
      if (remaining <= 0) {
        setTimerComplete(true);
        setActiveTimer(null);
        // Auto-dismiss "complete" state after 3 seconds
        setTimeout(() => setTimerComplete(false), 3000);
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!workoutDay) return null;

  const startRestTimer = (exIndex: number, restString: string) => {
    const seconds = parseRestSeconds(restString);
    setTimerComplete(false);
    setActiveTimer({ exIndex, totalSeconds: seconds, startedAt: Date.now() });
    setTimerSecondsLeft(seconds);
  };

  const selectAlternative = (exIndex: number, altName: string) => {
    const newData = [...trackedData];
    newData[exIndex] = { ...newData[exIndex], exerciseName: altName };
    setTrackedData(newData);
  };

  const updateSet = (
    exIndex: number,
    setIndex: number,
    field: 'weight' | 'reps',
    value: number
  ) => {
    const newData = [...trackedData];
    const currentSet = { ...newData[exIndex].sets[setIndex], [field]: value };
    currentSet.completed = currentSet.reps > 0;
    newData[exIndex] = {
      ...newData[exIndex],
      sets: newData[exIndex].sets.map((s, i) =>
        i === setIndex ? currentSet : s
      ),
    };
    setTrackedData(newData);
  };

  const updateExerciseNote = (exIndex: number, note: string) => {
    const newData = [...trackedData];
    newData[exIndex] = { ...newData[exIndex], note };
    setTrackedData(newData);
  };

  const toggleWeightUnit = (exIndex: number) => {
    const newData = [...trackedData];
    const current = newData[exIndex].weightUnit ?? 'lbs';
    newData[exIndex] = {
      ...newData[exIndex],
      weightUnit: current === 'lbs' ? 'kg' : 'lbs',
    };
    setTrackedData(newData);
  };

  const setWeightUnit = (exerciseIndexes: number[], weightUnit: 'kg' | 'lbs') => {
    const newData = [...trackedData];

    exerciseIndexes.forEach((exerciseIndex) => {
      newData[exerciseIndex] = {
        ...newData[exerciseIndex],
        weightUnit,
      };
    });

    setTrackedData(newData);
  };

  const addSet = (exIndex: number) => {
    const newData = [...trackedData];
    newData[exIndex] = {
      ...newData[exIndex],
      sets: [...newData[exIndex].sets, { weight: 0, reps: 0, completed: false }],
    };
    setTrackedData(newData);
  };

  const finishWorkout = () => {
    setShowCelebration(true);
    setTimeout(() => {
      onComplete({
        weekNumber: week,
        dayNumber: day,
        date: new Date().toISOString(),
        exercises: trackedData,
        completed: true,
        note: workoutNote || undefined,
      });
    }, 1800);
  };

  const completedSets = trackedData.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = trackedData.reduce((acc, ex) => acc + ex.sets.length, 0);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  // Precompute superset pairs in a single pass to avoid chaining bugs.
  // Each exercise can belong to at most one pair. Once two consecutive exercises
  // are paired, the second one is "consumed" and cannot pair with exercise after it.
  const supersetMap = (() => {
    const exercises = workoutDay.exercises;
    const supersetPattern = /super\s*set/i;
    const map: Record<number, 'A1' | 'A2'> = {};
    let i = 0;
    while (i < exercises.length) {
      const current = exercises[i];
      const next = exercises[i + 1];
      const currentMentions = supersetPattern.test(current.rest) || supersetPattern.test(current.expertAdvice || '');
      const nextMentions = next && (supersetPattern.test(next.rest) || supersetPattern.test(next.expertAdvice || ''));
      if (currentMentions && nextMentions) {
        map[i] = 'A1';
        map[i + 1] = 'A2';
        i += 2; // Skip past the pair — next exercise cannot chain
      } else {
        i += 1;
      }
    }
    return map;
  })();

  const hasSupersetPartner = (exIndex: number): boolean => exIndex in supersetMap;
  const getSupersetLabel = (exIndex: number): 'A1' | 'A2' | null => supersetMap[exIndex] ?? null;
  const isSupersetStart = (exIndex: number): boolean => supersetMap[exIndex] === 'A1';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-lg mx-auto pb-28"
    >
      {/* Sticky Header */}
      <div className="flex items-center justify-between mb-6 sticky top-12 bg-ground/95 backdrop-blur-md py-3 z-40 border-b border-border-subtle">
        <div className="min-w-0 mr-3">
          <p className="text-orange-500 text-[10px] font-medium tracking-widest mb-0.5">
            WEEK {week} · DAY {day}
          </p>
          <h2 className="text-sm sm:text-base font-bold leading-snug">{workoutDay.focus}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-mono">
            {completedSets}/{totalSets}
          </span>
          <button
            onClick={onCancel}
            className="w-9 h-9 bg-surface-2 rounded-full flex items-center justify-center hover:bg-surface-3 transition-colors cursor-pointer"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Rest Timer Banner */}
      <AnimatePresence>
        {(activeTimer || timerComplete) && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`sticky top-[6.75rem] z-30 mb-3 rounded-xl overflow-hidden transition-colors ${
              timerComplete
                ? 'bg-green-500/20 border border-green-500/30'
                : 'bg-orange-500/15 border border-orange-500/25'
            }`}
          >
          <div className="p-3 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2">
              <Timer className={`w-4 h-4 ${timerComplete ? 'text-green-400' : 'text-orange-500'}`} />
              <span className="text-sm font-bold">
                {timerComplete ? (
                  <motion.span
                    className="text-green-400"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 0.6, repeat: 2 }}
                  >
                    REST COMPLETE — GO!
                  </motion.span>
                ) : (
                  <span className="text-orange-300 font-mono text-lg">{formatTime(timerSecondsLeft)}</span>
                )}
              </span>
            </div>
            {!timerComplete && (
              <span className="text-[11px] text-zinc-400 font-medium truncate max-w-[140px]">
                {trackedData[activeTimer!.exIndex]?.exerciseName ?? workoutDay.exercises[activeTimer!.exIndex]?.name}
              </span>
            )}
          </div>
          {/* Timer progress bar */}
          {!timerComplete && activeTimer && (
            <div className="h-1 w-full bg-orange-500/10">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-500 to-green-500"
                initial={{ width: '0%' }}
                animate={{ width: `${((activeTimer.totalSeconds - timerSecondsLeft) / activeTimer.totalSeconds) * 100}%` }}
                transition={{ duration: 0.25, ease: 'linear' }}
              />
            </div>
          )}
        </motion.div>
        )}
      </AnimatePresence>

      {/* Exercise List */}
      <div className="space-y-3.5">
        {(() => { let visualNum = 0; return workoutDay.exercises.map((ex, exIndex) => {
          const isExpanded = expandedExercise === exIndex;
          const trackedEx = trackedData[exIndex];
          const allDone = trackedEx.sets.every((s) => s.completed);
          const isSupersetPartner = hasSupersetPartner(exIndex);

          const currentAlt = ex.alternatives.find(
            (a) => a.name === trackedEx.exerciseName
          );
          const displayAdvice = currentAlt?.expertAdvice || ex.expertAdvice || 'Focus on proper form and controlled movements.';
          const displayVideo = currentAlt?.videoSearchQuery || ex.videoSearchQuery || `${trackedEx.exerciseName} exercise form tutorial`;

          // Clean superset mentions from rest text if not properly paired
          const displayRest = cleanSupersetText(ex.rest, isSupersetPartner);

          const allSwapOptions = [
            { name: ex.name, isOriginal: true },
            ...ex.alternatives
              .filter(a => a.name !== ex.name)
              .map(a => ({ name: a.name, isOriginal: false })),
          ];

          const isTimerRunning = activeTimer?.exIndex === exIndex;
          const supersetLabel = getSupersetLabel(exIndex);
          const isFirstInSuperset = isSupersetStart(exIndex);

          // Track visual exercise number (A2 exercises don't get their own number)
          if (supersetLabel !== 'A2') visualNum++;

          // Skip A2 exercises — they're rendered inside the A1 superset card
          if (supersetLabel === 'A2') return null;

          // --- Superset Combined Card ---
          if (isFirstInSuperset && exIndex + 1 < workoutDay.exercises.length && trackedData[exIndex + 1]) {
            const ex2 = workoutDay.exercises[exIndex + 1];
            const trackedEx2 = trackedData[exIndex + 1];
            const allDone2 = trackedEx2.sets.every((s) => s.completed);
            const bothDone = allDone && allDone2;

            const currentAlt2 = ex2.alternatives.find((a) => a.name === trackedEx2.exerciseName);
            const displayAdvice2 = currentAlt2?.expertAdvice || ex2.expertAdvice || 'Focus on proper form and controlled movements.';
            const displayVideo2 = currentAlt2?.videoSearchQuery || ex2.videoSearchQuery || `${trackedEx2.exerciseName} exercise form tutorial`;

            const allSwapOptions2 = [
              { name: ex2.name, isOriginal: true },
              ...ex2.alternatives.filter(a => a.name !== ex2.name).map(a => ({ name: a.name, isOriginal: false })),
            ];

            const maxSets = Math.max(trackedEx.sets.length, trackedEx2.sets.length);

            return (
              <div key={exIndex}>
                {/* Superset header */}
                <div className="flex items-center gap-2 mb-2 mt-1">
                  <div className="h-px flex-1 bg-purple-500/20" />
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Superset</span>
                  <div className="h-px flex-1 bg-purple-500/20" />
                </div>

                <div
                  ref={(el) => { exerciseRefs.current[exIndex] = el; }}
                  className={`bg-surface-1 rounded-2xl overflow-hidden transition-all shadow-card border-l-2 border-l-purple-500/40 ${
                    bothDone ? 'ring-1 ring-orange-500/40' : ''
                  }`}
                >
                  {/* Combined Header — both exercises */}
                  <div
                    className="p-4 cursor-pointer select-none active:bg-surface-3 transition-colors min-h-[52px]"
                    onClick={() => setExpandedExercise(isExpanded ? null : exIndex)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold ${
                          bothDone ? 'bg-orange-500 text-black' : 'border border-border text-zinc-500'
                        }`}>
                          {bothDone ? <Check className="w-3.5 h-3.5" /> : <span className="font-mono">{visualNum}</span>}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[9px] text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded font-bold">A1</span>
                            <h3 className="font-semibold text-sm leading-snug line-clamp-1">{trackedEx.exerciseName}</h3>
                            {trackedEx.exerciseName !== ex.name && (
                              <span className="text-[9px] text-orange-500 bg-orange-500/10 px-1 py-0.5 rounded font-semibold shrink-0">ALT</span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 font-mono">{ex.sets}×{ex.reps} · {displayRest}</p>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-zinc-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" />}
                    </div>

                    <div className="flex items-center gap-2 min-w-0 pl-10">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] text-purple-400 bg-purple-500/10 px-1 py-0.5 rounded font-bold">A2</span>
                        <h3 className="font-semibold text-sm leading-snug line-clamp-1">{trackedEx2.exerciseName}</h3>
                        {trackedEx2.exerciseName !== ex2.name && (
                          <span className="text-[9px] text-orange-500 bg-orange-500/10 px-1 py-0.5 rounded font-semibold shrink-0">ALT</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded — dual tracking grid */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-border-subtle pt-4 space-y-4">
                      {/* Swap panels for both exercises */}
                      {showSwap[exIndex] && (
                        <div className="bg-ground/60 rounded-xl p-3">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-2">SWAP A1 — {trackedEx.exerciseName}</p>
                          <div className="space-y-1.5">
                            {allSwapOptions.map((opt, i) => (
                              <div key={i} className="flex items-center justify-between min-h-[36px]">
                                <span className="text-xs text-zinc-400 truncate mr-2">{opt.name}</span>
                                {trackedEx.exerciseName === opt.name ? (
                                  <span className="text-[10px] text-orange-500 font-bold shrink-0">Active</span>
                                ) : (
                                  <button onClick={() => selectAlternative(exIndex, opt.name)} className="text-[10px] bg-surface-3 hover:bg-elevated px-3 py-1.5 rounded text-zinc-400 transition-colors cursor-pointer shrink-0 min-h-[32px]">Use</button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {showSwap[exIndex + 1] && (
                        <div className="bg-ground/60 rounded-xl p-3">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-2">SWAP A2 — {trackedEx2.exerciseName}</p>
                          <div className="space-y-1.5">
                            {allSwapOptions2.map((opt, i) => (
                              <div key={i} className="flex items-center justify-between min-h-[36px]">
                                <span className="text-xs text-zinc-400 truncate mr-2">{opt.name}</span>
                                {trackedEx2.exerciseName === opt.name ? (
                                  <span className="text-[10px] text-orange-500 font-bold shrink-0">Active</span>
                                ) : (
                                  <button onClick={() => selectAlternative(exIndex + 1, opt.name)} className="text-[10px] bg-surface-3 hover:bg-elevated px-3 py-1.5 rounded text-zinc-400 transition-colors cursor-pointer shrink-0 min-h-[32px]">Use</button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowSwap(prev => ({ ...prev, [exIndex]: !prev[exIndex] })); }}
                          className="flex-1 py-2 rounded-lg text-[10px] font-medium text-zinc-400 bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer"
                        >Swap A1</button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowSwap(prev => ({ ...prev, [exIndex + 1]: !prev[exIndex + 1] })); }}
                          className="flex-1 py-2 rounded-lg text-[10px] font-medium text-zinc-400 bg-surface-2 hover:bg-surface-3 transition-colors cursor-pointer"
                        >Swap A2</button>
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(displayVideo)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="py-2 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors"
                        ><PlayCircle className="w-4 h-4 text-orange-500" /></a>
                        <a
                          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(displayVideo2)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="py-2 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 transition-colors"
                        ><PlayCircle className="w-4 h-4 text-purple-400" /></a>
                      </div>

                      {/* Dual Tracking Grid — stacked rows per set */}
                      <div>
                        {/* Header row */}
                        <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-1 text-[10px] font-medium text-zinc-600 uppercase tracking-wider mb-2">
                          <div className="text-center">Set</div>
                          <div className="flex items-center gap-1.5">
                            Weight
                            <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const nextUnit = (trackedEx.weightUnit ?? 'lbs') === 'lbs' ? 'kg' : 'lbs';
                                  setWeightUnit([exIndex, exIndex + 1], nextUnit);
                                }}
                              className="text-[9px] bg-surface-3 hover:bg-elevated px-1.5 py-0.5 rounded text-orange-500 font-semibold transition-colors cursor-pointer normal-case"
                            >{trackedEx.weightUnit ?? 'lbs'}</button>
                          </div>
                          <div>Reps</div>
                        </div>

                        {/* Set rows — two rows per set (A then B) */}
                        {Array.from({ length: maxSets }).map((_, setIndex) => {
                          const set1 = trackedEx.sets[setIndex];
                          const set2 = trackedEx2.sets[setIndex];
                          const rowDone = (set1?.completed ?? false) && (set2?.completed ?? false);

                          return (
                            <div key={setIndex} className={`rounded-xl transition-colors mb-1 ${rowDone ? 'bg-orange-500/12' : ''}`}>
                              {/* Exercise A row */}
                              <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center py-1 px-1">
                                <div className={`text-center font-mono text-sm transition-colors row-span-2 ${rowDone ? 'text-orange-500 font-bold' : 'text-zinc-500'}`}>
                                  {rowDone ? (
                                    <motion.span key="check" initial={{ scale: 0.5 }} animate={{ scale: [0.5, 1.2, 1] }} transition={{ duration: 0.25 }}>✓</motion.span>
                                  ) : (
                                    setIndex + 1
                                  )}
                                </div>
                                {set1 ? (
                                  <>
                                    <input
                                      type="number" inputMode="decimal" step="any" placeholder="0"
                                      value={set1.weight || ''}
                                      onChange={(e) => updateSet(exIndex, setIndex, 'weight', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-ground/60 border border-border-subtle rounded-lg px-2 py-2.5 text-center text-sm text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors min-h-[40px]"
                                    />
                                    <input
                                      type="number" inputMode="numeric" placeholder={ex.reps.split('-')[0] || '0'}
                                      value={set1.reps || ''}
                                      onChange={(e) => updateSet(exIndex, setIndex, 'reps', Number(e.target.value))}
                                      className="w-full bg-ground/60 border border-border-subtle rounded-lg px-2 py-2.5 text-center text-sm text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors min-h-[40px]"
                                    />
                                  </>
                                ) : <><div /><div /></>}
                              </div>
                              {/* Exercise A label */}
                              <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-1">
                                <div />
                                <p className="text-[9px] text-purple-400 font-medium -mt-0.5 mb-0.5 truncate col-span-2">A1: {trackedEx.exerciseName}</p>
                              </div>
                              {/* Exercise B row */}
                              <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center py-1 px-1">
                                <div />
                                {set2 ? (
                                  <>
                                    <input
                                      type="number" inputMode="decimal" step="any" placeholder="0"
                                      value={set2.weight || ''}
                                      onChange={(e) => updateSet(exIndex + 1, setIndex, 'weight', parseFloat(e.target.value) || 0)}
                                      className="w-full bg-ground/60 border border-purple-500/20 rounded-lg px-2 py-2.5 text-center text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-colors min-h-[40px]"
                                    />
                                    <input
                                      type="number" inputMode="numeric" placeholder={ex2.reps.split('-')[0] || '0'}
                                      value={set2.reps || ''}
                                      onChange={(e) => updateSet(exIndex + 1, setIndex, 'reps', Number(e.target.value))}
                                      className="w-full bg-ground/60 border border-purple-500/20 rounded-lg px-2 py-2.5 text-center text-sm text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-colors min-h-[40px]"
                                    />
                                  </>
                                ) : <><div /><div /></>}
                              </div>
                              {/* Exercise B label */}
                              <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-1">
                                <div />
                                <p className="text-[9px] text-purple-400/60 font-medium -mt-0.5 mb-1.5 truncate col-span-2">A2: {trackedEx2.exerciseName}</p>
                              </div>
                            </div>
                          );
                        })}

                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => { addSet(exIndex); addSet(exIndex + 1); }}
                            className="flex-1 py-2.5 border border-dashed border-border rounded-lg text-xs text-zinc-600 hover:text-zinc-400 hover:border-zinc-500 transition-colors flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
                          ><Plus className="w-3 h-3" /> Add Set</button>
                        </div>
                      </div>

                      {/* Rest Timer */}
                      <button
                        onClick={() => startRestTimer(exIndex, displayRest)}
                        disabled={activeTimer?.exIndex === exIndex}
                        className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] ${
                          activeTimer?.exIndex === exIndex
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                            : 'bg-surface-3 text-zinc-300 hover:bg-elevated border border-border active:scale-[0.98]'
                        }`}
                      >
                        <Timer className="w-4 h-4" />
                        {activeTimer?.exIndex === exIndex ? `Resting... ${formatTime(timerSecondsLeft)}` : `Start Rest (${displayRest})`}
                      </button>

                      {/* Form Tips */}
                      <button
                        onClick={() => setShowTips(prev => ({ ...prev, [exIndex]: !prev[exIndex] }))}
                        className="w-full flex items-center justify-between py-2 text-left cursor-pointer min-h-[44px]"
                      >
                        <span className="text-[10px] text-orange-500 uppercase tracking-wider font-medium flex items-center gap-1">
                          <Info className="w-3 h-3" /> FORM TIPS
                        </span>
                        {showTips[exIndex] ? <ChevronUp className="w-3.5 h-3.5 text-zinc-600" /> : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
                      </button>
                      {showTips[exIndex] && (
                        <div className="bg-orange-500/8 border border-orange-500/15 rounded-xl p-3.5 -mt-2 space-y-2">
                          <p className="text-[10px] text-purple-400 font-bold uppercase">A1 — {trackedEx.exerciseName}</p>
                          <p className="text-[13px] text-orange-100/70 leading-relaxed">{cleanSupersetText(displayAdvice, true)}</p>
                          <p className="text-[10px] text-purple-400 font-bold uppercase mt-2">A2 — {trackedEx2.exerciseName}</p>
                          <p className="text-[13px] text-orange-100/70 leading-relaxed">{cleanSupersetText(displayAdvice2, true)}</p>
                        </div>
                      )}

                      {/* Notes for both exercises */}
                      <div className="space-y-2">
                        <textarea
                          placeholder={`A1 note — ${trackedEx.exerciseName}...`}
                          value={trackedEx.note ?? ''}
                          onChange={(e) => updateExerciseNote(exIndex, e.target.value)}
                          rows={1}
                          className="w-full bg-transparent border border-transparent rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-border-subtle focus:bg-ground/60 transition-colors resize-none"
                        />
                        <textarea
                          placeholder={`A2 note — ${trackedEx2.exerciseName}...`}
                          value={trackedEx2.note ?? ''}
                          onChange={(e) => updateExerciseNote(exIndex + 1, e.target.value)}
                          rows={1}
                          className="w-full bg-transparent border border-transparent rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-border-subtle focus:bg-ground/60 transition-colors resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          // --- Regular (non-superset) exercise card ---
          return (
            <div key={exIndex}>
              <div
                ref={(el) => { exerciseRefs.current[exIndex] = el; }}
                className={`bg-surface-1 rounded-2xl overflow-hidden transition-all shadow-card ${
                  allDone ? 'ring-1 ring-orange-500/40' : ''
                }`}
              >
              {/* Exercise Header */}
              <div
                className="p-4 cursor-pointer flex items-center justify-between select-none active:bg-surface-3 transition-colors min-h-[52px]"
                onClick={() =>
                  setExpandedExercise(isExpanded ? null : exIndex)
                }
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold ${
                      allDone
                        ? 'bg-orange-500 text-black'
                        : 'border border-border text-zinc-500'
                    }`}
                  >
                    {allDone ? (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.3, 1] }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                      >
                        <Check className="w-4 h-4" />
                      </motion.span>
                    ) : (
                      <span className="font-mono">{visualNum}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm leading-snug line-clamp-2">
                        {trackedEx.exerciseName}
                      </h3>
                      {supersetLabel && (
                        <span className="text-[9px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded font-bold shrink-0">
                          {supersetLabel}
                        </span>
                      )}
                      {trackedEx.exerciseName !== ex.name && (
                        <span className="text-[9px] text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded font-semibold shrink-0">
                          ALT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      {ex.sets}×{ex.reps} · {displayRest}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isExpanded && (
                    <>
                      <a
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(displayVideo)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-3 transition-colors"
                        title="Watch form video"
                      >
                        <PlayCircle className="w-4.5 h-4.5 text-orange-500" />
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowSwap(prev => ({ ...prev, [exIndex]: !prev[exIndex] })); }}
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-3 transition-colors cursor-pointer"
                        title="Swap exercise"
                      >
                        <MoreVertical className="w-4.5 h-4.5 text-zinc-500" />
                      </button>
                    </>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-border-subtle pt-4 space-y-4">
                  {/* Swap Exercise Panel (hidden by default) */}
                  {showSwap[exIndex] && (
                    <div className="bg-ground/60 rounded-xl p-3">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium mb-2">
                        SWAP EXERCISE
                      </p>
                      <div className="space-y-1.5">
                        {allSwapOptions.map((opt, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between min-h-[36px]"
                          >
                            <span className="text-xs text-zinc-400 truncate mr-2">
                              {opt.name}
                              {opt.isOriginal && trackedEx.exerciseName !== ex.name && (
                                <span className="text-[9px] text-zinc-600 ml-1">(original)</span>
                              )}
                            </span>
                            {trackedEx.exerciseName === opt.name ? (
                              <span className="text-[10px] text-orange-500 font-bold shrink-0">
                                Active
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  selectAlternative(exIndex, opt.name)
                                }
                                className="text-[10px] bg-surface-3 hover:bg-elevated px-3 py-1.5 rounded text-zinc-400 transition-colors cursor-pointer shrink-0 min-h-[32px]"
                              >
                                Use
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Set Tracking (PRIMARY — shown first) */}
                  <div>
                    <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-1 text-[10px] font-medium text-zinc-600 uppercase tracking-wider mb-2">
                      <div className="text-center">Set</div>
                      <div className="flex items-center gap-1.5">
                        Weight
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWeightUnit(exIndex); }}
                          className="text-[9px] bg-surface-3 hover:bg-elevated px-1.5 py-0.5 rounded text-orange-500 font-semibold transition-colors cursor-pointer normal-case"
                        >
                          {trackedEx.weightUnit ?? 'lbs'}
                        </button>
                      </div>
                      <div>Reps</div>
                    </div>

                    {trackedEx.sets.map((set, setIndex) => (
                      <div
                        key={setIndex}
                        className={`grid grid-cols-[2rem_1fr_1fr] gap-2 items-center py-1.5 px-1 rounded-xl transition-colors ${
                          set.completed ? 'bg-orange-500/12' : ''
                        }`}
                      >
                        <div className={`text-center font-mono text-sm transition-colors ${set.completed ? 'text-orange-500 font-bold' : 'text-zinc-500'}`}>
                          {set.completed ? (
                            <motion.span
                              key="check"
                              initial={{ scale: 0.5 }}
                              animate={{ scale: [0.5, 1.2, 1] }}
                              transition={{ duration: 0.25 }}
                            >
                              ✓
                            </motion.span>
                          ) : (
                            setIndex + 1
                          )}
                        </div>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="any"
                          placeholder="0"
                          value={set.weight || ''}
                          onChange={(e) =>
                            updateSet(
                              exIndex,
                              setIndex,
                              'weight',
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-full bg-ground/60 border border-border-subtle rounded-lg px-2 py-3 text-center text-base text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors min-h-[44px]"
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder={ex.reps.split('-')[0] || '0'}
                          value={set.reps || ''}
                          onChange={(e) =>
                            updateSet(
                              exIndex,
                              setIndex,
                              'reps',
                              Number(e.target.value)
                            )
                          }
                          className="w-full bg-ground/60 border border-border-subtle rounded-lg px-2 py-3 text-center text-base text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors min-h-[44px]"
                        />
                      </div>
                    ))}

                    <button
                      onClick={() => addSet(exIndex)}
                      className="w-full py-2.5 mt-2 border border-dashed border-border rounded-lg text-xs text-zinc-600 hover:text-zinc-400 hover:border-zinc-500 transition-colors flex items-center justify-center gap-1 cursor-pointer min-h-[44px]"
                    >
                      <Plus className="w-3 h-3" /> Add Set
                    </button>
                  </div>

                  {/* Rest Timer Button */}
                  <button
                    onClick={() => startRestTimer(exIndex, displayRest)}
                    disabled={isTimerRunning}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer min-h-[44px] ${
                      isTimerRunning
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-surface-3 text-zinc-300 hover:bg-elevated border border-border active:scale-[0.98]'
                    }`}
                  >
                    <Timer className="w-4 h-4" />
                    {isTimerRunning
                      ? `Resting... ${formatTime(timerSecondsLeft)}`
                      : `Start Rest (${displayRest})`
                    }
                  </button>

                  {/* Form Tips (collapsed by default) */}
                  <button
                    onClick={() => setShowTips(prev => ({ ...prev, [exIndex]: !prev[exIndex] }))}
                    className="w-full flex items-center justify-between py-2 text-left cursor-pointer min-h-[44px]"
                  >
                    <span className="text-[10px] text-orange-500 uppercase tracking-wider font-medium flex items-center gap-1">
                      <Info className="w-3 h-3" /> FORM TIPS
                    </span>
                    {showTips[exIndex] ? (
                      <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
                    )}
                  </button>
                  {showTips[exIndex] && (
                    <div className="bg-orange-500/8 border border-orange-500/15 rounded-xl p-3.5 -mt-2">
                      <p className="text-[13px] text-orange-100/70 leading-relaxed">
                        {cleanSupersetText(displayAdvice, isSupersetPartner)}
                      </p>
                    </div>
                  )}

                  {/* Exercise Note (simplified - borderless until focus) */}
                  <textarea
                    placeholder="Add a note about this exercise..."
                    value={trackedEx.note ?? ''}
                    onChange={(e) => updateExerciseNote(exIndex, e.target.value)}
                    rows={2}
                    className="w-full bg-transparent border border-transparent rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-border-subtle focus:bg-ground/60 transition-colors resize-none"
                  />
                </div>
              )}
            </div>
            </div>
          );
        }); })()}
      </div>
      <div className="mt-6">
        <textarea
          placeholder="How did today's workout feel? Add notes here..."
          value={workoutNote}
          onChange={(e) => setWorkoutNote(e.target.value)}
          rows={3}
          className="w-full bg-transparent border border-transparent rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-border-subtle focus:bg-surface-1 transition-colors resize-none"
        />
      </div>

      {/* Celebration Overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-ground/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-5"
              >
                <Trophy className="w-10 h-10 text-orange-500" />
              </motion.div>
              <h2 className="text-2xl font-extrabold tracking-tight mb-2">Workout Complete!</h2>
              <p className="text-zinc-500 text-sm">
                {completedSets}/{totalSets} sets crushed
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle backdrop-blur-xl bg-ground/80">
        <div className="max-w-lg mx-auto p-4">
          <button
            onClick={finishWorkout}
            className={`w-full py-4 bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-base rounded-2xl transition-all shadow-xl shadow-orange-500/25 cursor-pointer active:scale-[0.98] min-h-[52px] ${
              completedSets === totalSets && totalSets > 0 ? 'animate-pulse' : ''
            }`}
          >
            Finish Workout
          </button>
        </div>
      </div>
    </motion.div>
  );
}
