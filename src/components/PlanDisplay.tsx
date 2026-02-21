import { useAppStore, type Exercise } from '../store/useAppStore';
import { motion, AnimatePresence } from 'motion/react';
import {
  Calendar,
  Clock,
  Info,
  RefreshCcw,
  Download,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  X,
  Shuffle,
  Dumbbell,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { WorkoutPlan as WPType } from '../store/useAppStore';

function exportPlanAsText(plan: WPType) {
  let text = `${plan.title}\n${'='.repeat(plan.title.length)}\n${plan.description}\n\n`;
  text += `Frequency: ${plan.frequency} · Duration: ${plan.durationWeeks} weeks\n\n`;

  for (const week of plan.weeks) {
    text += `── Week ${week.weekNumber} ${'─'.repeat(40)}\n\n`;
    for (const day of week.schedule) {
      text += `  ${day.dayName}  [${day.focus}]\n`;
      if (day.warmup?.length) text += `    Warmup: ${day.warmup.join(', ')}\n`;
      for (const ex of day.exercises) {
        text += `    • ${ex.name}  ${ex.sets}×${ex.reps}  rest ${ex.rest}\n`;
        if (ex.description) text += `      How: ${ex.description}\n`;
        if (ex.alternatives?.length) {
          text += `      Swaps: ${ex.alternatives.map((a) => a.name).join(', ')}\n`;
        }
      }
      if (day.cooldown?.length) text += `    Cooldown: ${day.cooldown.join(', ')}\n`;
      text += '\n';
    }
  }

  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${plan.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function PlanDisplay() {
  const { workoutPlan, userProfile, reset, swapExercise } = useAppStore();
  const [activeWeekIndex, setActiveWeekIndex] = useState(0);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [swappingExerciseIndex, setSwappingExerciseIndex] = useState<number | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const swapRef = useRef<HTMLDivElement>(null);

  // Close swap dropdown on outside click
  useEffect(() => {
    if (swappingExerciseIndex === null) return;
    const handler = (e: MouseEvent) => {
      if (swapRef.current && !swapRef.current.contains(e.target as Node)) {
        setSwappingExerciseIndex(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [swappingExerciseIndex]);

  // Close swap dropdown when day/week changes
  const closeSwap = useCallback(() => setSwappingExerciseIndex(null), []);

  if (!workoutPlan) return null;

  const activeWeek = workoutPlan.weeks[activeWeekIndex];
  const activeDay = activeWeek?.schedule[activeDayIndex];

  if (!activeDay) return null;

  const isRestDay =
    activeDay.focus.toLowerCase().includes('rest') ||
    activeDay.focus.toLowerCase().includes('recovery');

  const handleSwap = (e: React.MouseEvent, exerciseIdx: number, newExercise: Exercise) => {
    e.stopPropagation();
    swapExercise(activeWeekIndex, activeDayIndex, exerciseIdx, newExercise);
    setSwappingExerciseIndex(null);
  };

  const totalWorkouts = workoutPlan.weeks.reduce(
    (acc, week) =>
      acc +
      week.schedule.filter(
        (d) =>
          !d.focus.toLowerCase().includes('rest') &&
          !d.focus.toLowerCase().includes('recovery') &&
          d.exercises &&
          d.exercises.length > 0
      ).length,
    0
  );

  return (
    <div className="min-h-screen bg-surface-950 pb-20">
      {/* ─── Header ───────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate">
              {workoutPlan.title}
            </h1>
            <p className="text-surface-400 text-xs sm:text-sm truncate">{workoutPlan.description}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors text-xs font-medium"
            >
              <RefreshCcw size={14} /> New Plan
            </button>
            <button
              onClick={() => exportPlanAsText(workoutPlan)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 hover:shadow-lg hover:shadow-emerald-500/20 transition-all text-xs font-semibold"
            >
              <Download size={14} /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6 space-y-6">
        {/* ─── Personalization Banner ────────────────────── */}
        <div className="bg-gradient-to-r from-emerald-500/[0.07] to-cyan-500/[0.05] border border-emerald-500/20 rounded-2xl p-4">
          <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Designed For You</div>
          <div className="flex flex-wrap gap-2">
            {[
              capitalize(userProfile.goal.replace(/_/g, ' ')),
              capitalize(userProfile.experienceLevel),
              capitalize(userProfile.bodyType) + ' Build',
              `${userProfile.daysPerWeek} Days/Week`,
              `${userProfile.workoutDuration} Min Sessions`,
              userProfile.injuries ? `⚠️ ${userProfile.injuries}` : null,
            ]
              .filter(Boolean)
              .map((tag, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-surface-800/60 rounded-full text-[11px] font-medium text-surface-300 border border-surface-700/40"
                >
                  {tag}
                </span>
              ))}
          </div>
        </div>

        {/* ─── Stats Bar ─────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Frequency" value={workoutPlan.frequency} icon={Calendar} />
          <StatCard label="Duration" value={`${workoutPlan.durationWeeks} Weeks`} icon={Clock} />
          <StatCard label="Today's Focus" value={activeDay.focus} icon={Dumbbell} />
          <StatCard label="Total Sessions" value={totalWorkouts} icon={Calendar} />
        </div>

        {/* ─── Week Selector ─────────────────────────────── */}
        <div className="flex items-center justify-center gap-4 bg-surface-900/60 backdrop-blur p-2 rounded-2xl border border-surface-800/50 w-fit mx-auto">
          <button
            onClick={() => {
              setActiveWeekIndex(Math.max(0, activeWeekIndex - 1));
              setActiveDayIndex(0);
              closeSwap();
            }}
            disabled={activeWeekIndex === 0}
            className="p-2 rounded-lg hover:bg-surface-800 disabled:opacity-30 text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="px-4 text-center min-w-[120px]">
            <div className="text-[10px] text-surface-500 uppercase tracking-widest font-bold">
              Current View
            </div>
            <div className="text-lg font-bold text-white">Week {activeWeek.weekNumber}</div>
            {activeWeek.phaseLabel && (
              <div className="text-[9px] text-emerald-400 font-semibold uppercase tracking-wider mt-0.5">
                {activeWeek.phaseLabel}
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setActiveWeekIndex(Math.min(workoutPlan.weeks.length - 1, activeWeekIndex + 1));
              setActiveDayIndex(0);
              closeSwap();
            }}
            disabled={activeWeekIndex === workoutPlan.weeks.length - 1}
            className="p-2 rounded-lg hover:bg-surface-800 disabled:opacity-30 text-white transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* ─── Main Grid ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Day Navigation */}
          <div className="lg:col-span-3 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-none">
            {activeWeek.schedule.map((day, idx) => {
              const dayIsRest =
                day.focus.toLowerCase().includes('rest') ||
                day.focus.toLowerCase().includes('recovery') ||
                !day.exercises ||
                day.exercises.length === 0;
              return (
                <button
                  key={idx}
                  onClick={() => { setActiveDayIndex(idx); closeSwap(); }}
                  className={cn(
                    'text-left px-4 py-3 rounded-xl border transition-all whitespace-nowrap lg:whitespace-normal min-w-[150px] lg:min-w-0 overflow-hidden',
                    activeDayIndex === idx
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                      : dayIsRest
                        ? 'bg-surface-900/30 border-surface-800/30 text-surface-500 hover:text-surface-400'
                        : 'bg-surface-900/50 border-surface-800/50 text-surface-400 hover:text-white hover:border-surface-600'
                  )}
                >
                  <div className="font-semibold text-xs mb-0.5 truncate">{day.dayName}</div>
                  <div className="text-[10px] opacity-70 truncate overflow-hidden">{day.focus}</div>
                </button>
              );
            })}
          </div>

          {/* Day Detail */}
          <div className="lg:col-span-9">
            <motion.div
              key={`${activeWeekIndex}-${activeDayIndex}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="bg-surface-900/50 border border-surface-800/50 rounded-3xl p-5 sm:p-7"
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">{activeDay.dayName}</h2>
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider',
                    isRestDay
                      ? 'bg-surface-800 text-surface-500'
                      : 'bg-emerald-500/10 text-emerald-400'
                  )}
                >
                  {activeDay.focus}
                </span>
              </div>

              {isRestDay ? (
                <RestDayCard day={activeDay} />
              ) : (
                <>
                  {/* Warmup */}
                  {activeDay.warmup?.length > 0 && (
                    <Section label="Warmup" color="emerald">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {activeDay.warmup.map((w, i) => (
                          <div key={i} className="bg-surface-800/40 px-3 py-2 rounded-lg text-surface-300 text-xs">
                            {w}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Exercises */}
                  <Section label="Main Workout" color="white">
                    {/* Table Header (Desktop) */}
                    <div className="hidden md:grid grid-cols-12 gap-3 px-4 text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                      <div className="col-span-5">Exercise</div>
                      <div className="col-span-2 text-center">Sets</div>
                      <div className="col-span-2 text-center">Reps</div>
                      <div className="col-span-3 text-right">Rest</div>
                    </div>

                    <div className="space-y-2">
                      {activeDay.exercises.map((ex, i) => (
                        <motion.div
                          key={`${ex.name}-${i}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.04 }}
                          className="relative group"
                        >
                          <button
                            onClick={() => setSelectedExercise(ex)}
                            className="w-full text-left bg-surface-800/20 hover:bg-surface-800/40 border border-surface-700/30 hover:border-emerald-500/30 rounded-xl p-4 transition-all"
                          >
                            <div className="flex flex-col md:grid md:grid-cols-12 gap-3 md:items-center">
                              <div className="col-span-5">
                                <div className="font-semibold text-white text-sm group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                                  {ex.name}
                                  <Info size={12} className="text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="text-[11px] text-surface-500 mt-0.5 line-clamp-1">{ex.notes}</div>
                              </div>
                              <div className="col-span-2 flex md:justify-center items-center gap-1 md:gap-0">
                                <span className="md:hidden text-[10px] text-surface-500 uppercase">Sets:</span>
                                <span className="font-mono text-emerald-400 font-bold text-sm">{ex.sets}</span>
                              </div>
                              <div className="col-span-2 flex md:justify-center items-center gap-1 md:gap-0">
                                <span className="md:hidden text-[10px] text-surface-500 uppercase">Reps:</span>
                                <span className="font-mono text-white text-sm">{ex.reps}</span>
                              </div>
                              <div className="col-span-3 flex md:justify-end items-center gap-1 md:gap-0">
                                <span className="md:hidden text-[10px] text-surface-500 uppercase">Rest:</span>
                                <span className="font-mono text-surface-400 text-xs">{ex.rest}</span>
                              </div>
                            </div>
                          </button>

                          {/* Swap Button */}
                          {ex.alternatives?.length > 0 && (
                            <div ref={swappingExerciseIndex === i ? swapRef : undefined} className="absolute right-2 top-2 z-10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSwappingExerciseIndex(swappingExerciseIndex === i ? null : i);
                                }}
                                className="p-1.5 bg-surface-800 border border-surface-700 rounded-lg text-surface-400 hover:text-white hover:border-emerald-500 transition-all"
                                title="Swap Exercise"
                                aria-label={`Swap ${ex.name}`}
                              >
                                <Shuffle size={13} />
                              </button>

                              {/* Swap Dropdown */}
                              <AnimatePresence>
                                {swappingExerciseIndex === i && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="absolute right-0 top-full mt-1 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl p-1.5 w-56 z-50"
                                  >
                                    <div className="text-[10px] font-bold text-surface-500 uppercase tracking-wider px-2 py-1">
                                      Replace with:
                                    </div>
                                    {ex.alternatives.map((alt, altIdx) => (
                                      <button
                                        key={altIdx}
                                        onClick={(e) => handleSwap(e, i, alt as Exercise)}
                                        className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-800 text-xs text-surface-300 hover:text-white transition-colors"
                                      >
                                        <div className="font-medium">{alt.name}</div>
                                        <div className="text-[10px] text-surface-500">
                                          {alt.sets ?? ex.sets} × {alt.reps ?? ex.reps}
                                        </div>
                                      </button>
                                    ))}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </Section>

                  {/* Cooldown */}
                  {activeDay.cooldown?.length > 0 && (
                    <Section label="Cooldown" color="blue">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {activeDay.cooldown.map((c, i) => (
                          <div key={i} className="bg-surface-800/40 px-3 py-2 rounded-lg text-surface-300 text-xs">
                            {c}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}
                </>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ─── Exercise Detail Modal ──────────────────────── */}
      <AnimatePresence>
        {selectedExercise && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedExercise(null)}
            role="dialog"
            aria-modal="true"
            aria-label="Exercise details"
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="bg-surface-900 border border-surface-700 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 space-y-5">
                {/* Header */}
                <div className="flex justify-between items-start">
                  <h2 className="text-xl font-bold text-white pr-4">{selectedExercise.name}</h2>
                  <button
                    onClick={() => setSelectedExercise(null)}
                    className="p-2 bg-surface-800 rounded-full text-surface-400 hover:text-white transition-colors shrink-0"
                    aria-label="Close exercise details"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-surface-800/50 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-surface-500 uppercase tracking-wider font-bold mb-0.5">Sets</div>
                    <div className="text-lg font-mono text-emerald-400 font-bold">{selectedExercise.sets}</div>
                  </div>
                  <div className="bg-surface-800/50 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-surface-500 uppercase tracking-wider font-bold mb-0.5">Reps</div>
                    <div className="text-lg font-mono text-white font-bold">{selectedExercise.reps}</div>
                  </div>
                  <div className="bg-surface-800/50 p-3 rounded-xl text-center">
                    <div className="text-[10px] text-surface-500 uppercase tracking-wider font-bold mb-0.5">Rest</div>
                    <div className="text-lg font-mono text-surface-300 font-bold">{selectedExercise.rest}</div>
                  </div>
                </div>

                {/* Why */}
                <div>
                  <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-1.5">Why this exercise?</h3>
                  <p className="text-surface-300 text-sm leading-relaxed">{selectedExercise.notes}</p>
                </div>

                {/* How */}
                {selectedExercise.description && (
                  <div>
                    <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">How to perform</h3>
                    <p className="text-surface-300 text-sm leading-relaxed whitespace-pre-line">
                      {selectedExercise.description}
                    </p>
                  </div>
                )}

                {/* YouTube Link */}
                <a
                  href={`https://www.youtube.com/results?search_query=how+to+${selectedExercise.name.replace(/\s+/g, '+')}+exercise+form`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-colors text-sm"
                >
                  <PlayCircle size={18} />
                  Watch Tutorial on YouTube
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Reset Confirmation ─────────────────────────── */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowResetConfirm(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm reset"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-surface-900 border border-surface-700 rounded-2xl p-6 max-w-sm w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-2">Start Over?</h3>
              <p className="text-surface-400 text-sm mb-6">
                This will discard your current plan and take you back to the beginning.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surface-800 text-surface-300 hover:bg-surface-700 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowResetConfirm(false);
                    reset();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors text-sm font-medium"
                >
                  Yes, Start Over
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-surface-900/60 border border-surface-800/50 p-3.5 rounded-xl flex items-center gap-3">
      <div className="p-2.5 bg-surface-800/70 rounded-lg text-emerald-500">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] text-surface-500 uppercase tracking-wider font-semibold">{label}</div>
        <div className="text-white font-bold text-sm truncate">{value}</div>
      </div>
    </div>
  );
}

function Section({
  label,
  color,
  children,
}: {
  label: string;
  color: 'emerald' | 'white' | 'blue';
  children: React.ReactNode;
}) {
  const dotColor = color === 'emerald' ? 'bg-emerald-500' : color === 'blue' ? 'bg-blue-400' : 'bg-white';
  const textColor =
    color === 'emerald' ? 'text-emerald-500' : color === 'blue' ? 'text-blue-400' : 'text-white';
  return (
    <div className="mb-6">
      <h3
        className={cn('text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2', textColor)}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', dotColor)} /> {label}
      </h3>
      {children}
    </div>
  );
}

function RestDayCard({ day }: { day: { exercises: Exercise[]; focus: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-full bg-surface-800 flex items-center justify-center">
        <RefreshCcw className="text-surface-500" size={28} />
      </div>
      <h3 className="text-lg font-semibold text-white">{day.focus}</h3>
      {day.exercises.length > 0 ? (
        <div className="w-full max-w-md space-y-2 text-left">
          {day.exercises.map((ex, i) => (
            <div key={i} className="bg-surface-800/40 rounded-xl px-4 py-3 border border-surface-700/30">
              <div className="text-sm font-medium text-white">{ex.name}</div>
              {ex.description && <div className="text-xs text-surface-400 mt-0.5">{ex.description}</div>}
              {ex.notes && <div className="text-[11px] text-surface-500 mt-1 italic">"{ex.notes}"</div>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-surface-400 text-sm max-w-md">
          Take it easy today. Light walking, stretching, or mobility work helps your body recover and grow.
        </p>
      )}
    </div>
  );
}
function capitalize(s: string): string {
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}