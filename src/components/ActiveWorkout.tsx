import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { X, Check, PlayCircle, Info, ChevronDown, ChevronUp, Plus, Timer, ArrowLeft, MessageSquare } from 'lucide-react';
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
    // Recover in-progress session from localStorage
    try {
      const saved = localStorage.getItem('jw_active_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session.week === week && session.day === day && session.exercises?.length) {
          return session.exercises;
        }
      }
    } catch { /* ignore corrupt data */ }
    if (existingWorkout) return existingWorkout.exercises;
    return workoutDay?.exercises.map((ex) => ({
      exerciseName: ex.name,
      weightUnit: 'lbs' as const,
      sets: Array.from({ length: ex.sets }).map(() => ({
        weight: 0,
        reps: 0,
        completed: false,
      })),
    })) ?? [];
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
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Rest timer state
  const [activeTimer, setActiveTimer] = useState<{
    exIndex: number;
    totalSeconds: number;
    startedAt: number;
  } | null>(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState<number>(0);
  const [timerComplete, setTimerComplete] = useState(false);

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

  const addSet = (exIndex: number) => {
    const newData = [...trackedData];
    newData[exIndex] = {
      ...newData[exIndex],
      sets: [...newData[exIndex].sets, { weight: 0, reps: 0, completed: false }],
    };
    setTrackedData(newData);
  };

  const finishWorkout = () => {
    onComplete({
      weekNumber: week,
      dayNumber: day,
      date: new Date().toISOString(),
      exercises: trackedData,
      completed: true,
      note: workoutNote || undefined,
    });
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

  // Detect superset pairing: an exercise has a "partner" if the next exercise
  // also mentions "superset" in its rest or description
  const hasSupersetPartner = (exIndex: number): boolean => {
    const exercises = workoutDay.exercises;
    const current = exercises[exIndex];
    const next = exercises[exIndex + 1];
    const prev = exercises[exIndex - 1];
    const supersetPattern = /super\s*set/i;
    const currentMention = supersetPattern.test(current.rest) || supersetPattern.test(current.expertAdvice || '');
    if (!currentMention) return false;
    const nextMention = next && (supersetPattern.test(next.rest) || supersetPattern.test(next.expertAdvice || ''));
    const prevMention = prev && (supersetPattern.test(prev.rest) || supersetPattern.test(prev.expertAdvice || ''));
    return !!(nextMention || prevMention);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-lg mx-auto pb-28"
    >
      {/* Sticky Header */}
      <div className="flex items-center justify-between mb-6 sticky top-14 bg-[#0a0a0a]/95 backdrop-blur-md py-3 z-40 border-b border-[#1a1a1a]">
        <div className="min-w-0 mr-3">
          <p className="text-orange-500 text-[10px] font-bold tracking-widest mb-0.5">
            WEEK {week} · DAY {day}
          </p>
          <h2 className="text-sm sm:text-base font-black leading-snug">{workoutDay.focus}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-mono">
            {completedSets}/{totalSets}
          </span>
          <button
            onClick={onCancel}
            className="w-9 h-9 bg-[#111] border border-[#222] rounded-full flex items-center justify-center hover:bg-[#1a1a1a] transition-colors cursor-pointer"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Floating Rest Timer Banner */}
      {(activeTimer || timerComplete) && (
        <div className={`sticky top-[7.5rem] z-30 mb-3 rounded-xl p-3 flex items-center justify-between transition-all ${
          timerComplete
            ? 'bg-green-500/20 border border-green-500/30'
            : 'bg-orange-500/15 border border-orange-500/25'
        }`}>
          <div className="flex items-center gap-2">
            <Timer className={`w-4 h-4 ${timerComplete ? 'text-green-400' : 'text-orange-500'}`} />
            <span className="text-sm font-bold">
              {timerComplete ? (
                <span className="text-green-400">REST COMPLETE — GO!</span>
              ) : (
                <span className="text-orange-300 font-mono text-lg">{formatTime(timerSecondsLeft)}</span>
              )}
            </span>
          </div>
          {!timerComplete && (
            <span className="text-[10px] text-zinc-500">
              {workoutDay.exercises[activeTimer!.exIndex]?.name}
            </span>
          )}
        </div>
      )}

      {/* Exercise List */}
      <div className="space-y-3">
        {workoutDay.exercises.map((ex, exIndex) => {
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

          return (
            <div
              key={exIndex}
              ref={(el) => {
                exerciseRefs.current[exIndex] = el;
              }}
              className={`bg-[#111] border rounded-2xl overflow-hidden transition-all ${
                allDone ? 'border-orange-500/40' : 'border-[#222]'
              }`}
            >
              {/* Exercise Header */}
              <div
                className="p-4 cursor-pointer flex items-center justify-between select-none active:bg-[#1a1a1a] transition-colors"
                onClick={() =>
                  setExpandedExercise(isExpanded ? null : exIndex)
                }
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center border shrink-0 text-sm font-bold ${
                      allDone
                        ? 'bg-orange-500 border-orange-500 text-black'
                        : 'border-[#333] text-zinc-500'
                    }`}
                  >
                    {allDone ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <span className="font-mono">{exIndex + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm truncate">
                        {trackedEx.exerciseName}
                      </h3>
                      {trackedEx.exerciseName !== ex.name && (
                        <span className="text-[9px] text-orange-500 bg-orange-500/10 px-1.5 py-0.5 rounded font-bold shrink-0">
                          ALT
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      {ex.sets}×{ex.reps} · {displayRest}
                    </p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-zinc-600 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-600 shrink-0" />
                )}
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-[#1a1a1a] pt-4 space-y-4">
                  {/* Expert Advice */}
                  <div className="bg-orange-500/8 border border-orange-500/15 rounded-xl p-3.5">
                    <p className="text-[10px] text-orange-500 uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1">
                      <Info className="w-3 h-3" /> FORM TIPS
                    </p>
                    <p className="text-[13px] text-orange-100/70 leading-relaxed">
                      {cleanSupersetText(displayAdvice, isSupersetPartner)}
                    </p>
                  </div>

                  {/* Alternatives & Video */}
                  <div className="flex gap-3">
                    <div className="flex-1 bg-[#0a0a0a] rounded-xl p-3 border border-[#1a1a1a]">
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2">
                        SWAP EXERCISE
                      </p>
                      <div className="space-y-1.5">
                        {allSwapOptions.map((opt, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between"
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
                                className="text-[10px] bg-[#1a1a1a] hover:bg-[#222] px-2 py-1 rounded text-zinc-400 transition-colors cursor-pointer shrink-0"
                              >
                                Use
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <a
                      href={`https://www.youtube.com/results?search_query=${encodeURIComponent(displayVideo)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-20 bg-[#0a0a0a] rounded-xl p-3 border border-[#1a1a1a] flex flex-col items-center justify-center text-center hover:bg-[#111] transition-colors cursor-pointer group shrink-0"
                    >
                      <PlayCircle className="w-7 h-7 text-orange-500 mb-1 group-hover:scale-110 transition-transform" />
                      <p className="text-[9px] font-bold text-zinc-500">
                        VIDEO
                      </p>
                    </a>
                  </div>

                  {/* Set Tracking */}
                  <div>
                    <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-1 text-[10px] font-bold text-zinc-600 uppercase tracking-wider mb-2">
                      <div className="text-center">Set</div>
                      <div className="flex items-center gap-1.5">
                        Weight
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleWeightUnit(exIndex); }}
                          className="text-[9px] bg-[#1a1a1a] hover:bg-[#222] px-1.5 py-0.5 rounded text-orange-500 font-bold transition-colors cursor-pointer normal-case"
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
                          set.completed ? 'bg-orange-500/8' : ''
                        }`}
                      >
                        <div className={`text-center font-mono text-xs transition-colors ${set.completed ? 'text-orange-500 font-bold' : 'text-zinc-500'}`}>
                          {set.completed ? '✓' : setIndex + 1}
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
                          className="w-full bg-black/40 border border-[#222] rounded-lg px-2 py-2.5 text-center text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
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
                          className="w-full bg-black/40 border border-[#222] rounded-lg px-2 py-2.5 text-center text-sm text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                        />
                      </div>
                    ))}

                    <button
                      onClick={() => addSet(exIndex)}
                      className="w-full py-2 mt-2 border border-dashed border-[#222] rounded-lg text-xs text-zinc-600 hover:text-zinc-400 hover:border-zinc-500 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> Add Set
                    </button>
                  </div>

                  {/* Rest Timer Button */}
                  <button
                    onClick={() => startRestTimer(exIndex, ex.rest)}
                    disabled={isTimerRunning}
                    className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      isTimerRunning
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'bg-[#1a1a1a] text-zinc-300 hover:bg-[#222] border border-[#333] active:scale-[0.98]'
                    }`}
                  >
                    <Timer className="w-4 h-4" />
                    {isTimerRunning
                      ? `Resting... ${formatTime(timerSecondsLeft)}`
                      : `Start Rest (${displayRest})`
                    }
                  </button>

                  {/* Exercise Note */}
                  <div className="bg-[#0a0a0a] rounded-xl border border-[#1a1a1a] p-3">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> EXERCISE NOTES
                    </p>
                    <textarea
                      placeholder="Add a note about this exercise..."
                      value={trackedEx.note ?? ''}
                      onChange={(e) => updateExerciseNote(exIndex, e.target.value)}
                      rows={2}
                      className="w-full bg-black/40 border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Workout Day Note */}
      <div className="mt-6 bg-[#111] border border-[#222] rounded-2xl p-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mb-2 flex items-center gap-1">
          <MessageSquare className="w-3 h-3" /> WORKOUT NOTES
        </p>
        <textarea
          placeholder="How did today's workout feel?"
          value={workoutNote}
          onChange={(e) => setWorkoutNote(e.target.value)}
          rows={3}
          className="w-full bg-black/40 border border-[#222] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
        />
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent z-50">
        <div className="max-w-lg mx-auto">
          <button
            onClick={finishWorkout}
            className="w-full py-4 bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-base rounded-2xl transition-all shadow-lg shadow-orange-500/20 cursor-pointer active:scale-[0.98]"
          >
            Finish Workout
          </button>
        </div>
      </div>
    </motion.div>
  );
}
