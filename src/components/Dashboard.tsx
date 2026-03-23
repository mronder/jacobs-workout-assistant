import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Play, CheckCircle, ChevronRight, MessageSquare } from 'lucide-react';
import { WorkoutPlan, TrackedWorkout } from '../types';
import { loadWeeklyNotes, saveWeeklyNote } from '../services/tracking';

interface DashboardProps {
  plan: WorkoutPlan;
  planId: string | null;
  trackedWorkouts: TrackedWorkout[];
  onStartWorkout: (week: number, day: number) => void;
}

export default function Dashboard({ plan, planId, trackedWorkouts, onStartWorkout }: DashboardProps) {
  const [activeWeek, setActiveWeek] = useState(() => {
    // Default to the most recent workout's week, or week 1
    if (trackedWorkouts.length > 0) {
      const sorted = [...trackedWorkouts].sort((a, b) => {
        // Sort by date descending, fall back to weekNumber
        if (a.date && b.date) return new Date(b.date).getTime() - new Date(a.date).getTime();
        return b.weekNumber - a.weekNumber;
      });
      return sorted[0].weekNumber;
    }
    return 1;
  });
  const [weeklyNotes, setWeeklyNotes] = useState<Record<number, string>>({});
  const [showWeekNote, setShowWeekNote] = useState(false);

  // Check for in-progress session to show resume banner
  const [resumeSession, setResumeSession] = useState<{ week: number; day: number } | null>(null);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('jw_active_session');
      if (saved) {
        const session = JSON.parse(saved);
        if (session.week && session.day && session.exercises?.length) {
          // Check if any set has data entered
          const hasData = session.exercises.some((ex: { sets: { weight: number; reps: number }[] }) =>
            ex.sets.some((s: { weight: number; reps: number }) => s.weight > 0 || s.reps > 0)
          );
          if (hasData) {
            setResumeSession({ week: session.week, day: session.day });
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Load weekly notes from server
  useEffect(() => {
    if (!planId) return;
    loadWeeklyNotes(planId).then((notes) => {
      const map: Record<number, string> = {};
      for (const n of notes) map[n.weekNumber] = n.note;
      setWeeklyNotes(map);
    }).catch(() => { /* ignore */ });
  }, [planId]);

  // Debounced save for weekly notes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleWeekNoteChange = useCallback((value: string) => {
    setWeeklyNotes((prev) => ({ ...prev, [activeWeek]: value }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (planId) {
        saveWeeklyNote(planId, activeWeek, value).catch(() => { /* ignore */ });
      }
    }, 2000);
  }, [planId, activeWeek]);

  const totalWorkouts = plan.weeks.reduce((acc, week) => acc + week.days.length, 0);
  const completedCount = trackedWorkouts.filter(tw => tw.completed).length;
  const progress = Math.round((completedCount / totalWorkouts) * 100);

  const currentWeek = plan.weeks.find((w) => w.weekNumber === activeWeek);
  const currentWeekCompleted = currentWeek?.days.filter((day) =>
    trackedWorkouts.some((tw) => tw.weekNumber === activeWeek && tw.dayNumber === day.dayNumber && tw.completed)
  ).length ?? 0;
  const currentWeekTotal = currentWeek?.days.length ?? 0;
  const currentWeekRemaining = Math.max(0, currentWeekTotal - currentWeekCompleted);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {resumeSession && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-500/18 via-orange-500/10 to-transparent border border-orange-400/25 rounded-[24px] p-4 flex items-center justify-between gap-3 shadow-card"
        >
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-orange-300/80 mb-1">Live Session</p>
            <p className="text-sm font-bold text-orange-100">Workout in progress</p>
            <p className="text-xs text-zinc-400 mt-1">
              Week {resumeSession.week} · Day {resumeSession.day} — tap to continue
            </p>
          </div>
          <motion.button
            onClick={() => onStartWorkout(resumeSession.week, resumeSession.day)}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="bg-gradient-to-r from-orange-300 to-orange-500 text-black px-4 py-2.5 rounded-2xl text-sm font-bold cursor-pointer active:scale-95 transition-all min-h-[44px] flex items-center gap-1.5 shadow-lg shadow-orange-500/20"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Resume
          </motion.button>
        </motion.div>
      )}

      <div className="relative overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-card">
        <div className="absolute -top-20 right-[-40px] w-60 h-60 bg-orange-500/12 rounded-full blur-3xl pointer-events-none" />
        <div className="relative space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-orange-300/80 mb-2">Current Program</p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">{plan.planName}</h2>
              <p className="text-zinc-300 text-sm leading-relaxed max-w-md">{plan.splitDescription}</p>
            </div>
            <div className="shrink-0 rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Week</p>
              <p className="font-mono text-lg font-bold text-orange-200">{activeWeek}/4</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Completed</p>
              <p className="text-lg font-bold text-orange-100">{completedCount}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">This Week</p>
              <p className="text-lg font-bold text-orange-100">{currentWeekCompleted}/{currentWeekTotal}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Remaining</p>
              <p className="text-lg font-bold text-orange-100">{currentWeekRemaining}</p>
            </div>
          </div>

          <div className="border-l-2 border-orange-500/30 pl-3">
            <p className="text-xs text-zinc-400 italic leading-relaxed">"{plan.motivationalQuote}" — {plan.quoteAuthor}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div className="col-span-2 bg-surface-1 rounded-2xl p-5 shadow-card flex items-center gap-5">
          <ProgressRing percent={progress} />
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-extrabold font-mono text-orange-500">{progress}%</div>
            <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium mt-0.5">Overall Progress</div>
          </div>
        </div>
        <StatCard label="Completed" value={`${completedCount}`} color="green" />
        <StatCard label="Remaining" value={`${totalWorkouts - completedCount}`} color="neutral" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[1, 2, 3, 4].map((w) => {
          const weekData = plan.weeks.find((wk) => wk.weekNumber === w);
          const totalDays = weekData?.days.length ?? 0;
          const completedDays = weekData?.days.filter((d) =>
            trackedWorkouts.some((tw) => tw.weekNumber === w && tw.dayNumber === d.dayNumber && tw.completed)
          ).length ?? 0;
          const weekCompleted = totalDays > 0 && completedDays === totalDays;

          return (
            <button
              key={w}
              onClick={() => setActiveWeek(w)}
              className={`px-5 py-3 rounded-full text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 min-w-[96px] min-h-[46px] justify-center border ${
                activeWeek === w
                  ? 'bg-orange-500 text-black border-orange-400 shadow-lg shadow-orange-500/15'
                  : 'bg-surface-2/90 border-white/8 text-zinc-400 hover:text-zinc-200 hover:border-orange-300/18'
              }`}
            >
              Week {w}
              {weekCompleted ? (
                <CheckCircle className={`w-3.5 h-3.5 ${activeWeek === w ? 'text-black/60' : 'text-orange-500'}`} />
              ) : completedDays > 0 ? (
                <span className={`text-[10px] font-mono ${activeWeek === w ? 'text-black/60' : 'text-zinc-600'}`}>
                  {completedDays}/{totalDays}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="bg-surface-1 rounded-[24px] overflow-hidden shadow-card border border-white/8">
        <button
          onClick={() => setShowWeekNote(!showWeekNote)}
          className="w-full px-4 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-3 transition-colors"
        >
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3" /> WEEK {activeWeek} NOTES
            {weeklyNotes[activeWeek] && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
            )}
          </span>
          <ChevronRight className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${showWeekNote ? 'rotate-90' : ''}`} />
        </button>
        {showWeekNote && (
          <div className="px-4 pb-4">
            <textarea
              placeholder="Weekly reflection... How's the program feeling?"
              value={weeklyNotes[activeWeek] ?? ''}
              onChange={(e) => handleWeekNoteChange(e.target.value)}
              rows={3}
              className="w-full bg-ground/60 border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors resize-none"
            />
          </div>
        )}
      </div>

      <div className="space-y-3.5">
        {currentWeek?.days.map((day, idx) => {
          const completed = trackedWorkouts.some(
            (tw) => tw.weekNumber === activeWeek && tw.dayNumber === day.dayNumber && tw.completed
          );
          const focusEmoji = getMuscleEmoji(day.focus);

          return (
            <motion.div
              key={day.dayNumber}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-[28px] p-5 sm:p-6 transition-all shadow-card border ${
                completed
                  ? 'bg-surface-2/80 border-orange-500/20 opacity-75'
                  : 'bg-surface-2/95 border-white/8 hover:border-orange-300/16'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg shrink-0 mt-0.5 border ${
                      completed ? 'bg-orange-500/12 border-orange-500/15' : 'bg-surface-3 border-white/8'
                    }`}
                  >
                    {completed ? <CheckCircle className="w-5 h-5 text-orange-500" /> : focusEmoji}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-1">Day {day.dayNumber}</p>
                    <h3 className={`font-semibold text-sm leading-snug ${completed ? 'line-through text-zinc-500' : ''}`}>{day.focus}</h3>
                    {day.description && (
                      <p className="text-[12px] text-zinc-400 leading-relaxed mt-1.5 max-w-md">
                        {day.description}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => onStartWorkout(activeWeek, day.dayNumber)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all cursor-pointer active:scale-95 min-h-[44px] ${
                    completed
                      ? 'bg-surface-3 text-zinc-200 hover:bg-elevated border border-white/8'
                      : 'bg-gradient-to-r from-orange-300 to-orange-500 text-black hover:from-orange-300 hover:to-orange-400 shadow-lg shadow-orange-500/15'
                  }`}
                >
                  {completed ? 'Review' : 'Start'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className="rounded-full border border-white/8 bg-black/15 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-zinc-400">{day.exercises.length} exercises</span>
                {completed ? (
                  <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-orange-200">Completed</span>
                ) : (
                  <span className="rounded-full border border-white/8 bg-black/15 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-zinc-400">Ready to train</span>
                )}
              </div>

              <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                {day.exercises.slice(0, 4).map((ex, i) => (
                  <div
                    key={i}
                    className="bg-ground/55 border border-white/8 rounded-2xl px-3 py-2.5 shrink-0"
                  >
                    <p className="text-[11px] font-semibold text-zinc-300 truncate max-w-[132px]">
                      {ex.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-1">
                      {ex.sets}×{ex.reps}
                    </p>
                  </div>
                ))}
                {day.exercises.length > 4 && (
                  <div className="bg-ground/55 border border-white/8 rounded-2xl px-3 py-2 shrink-0 flex items-center">
                    <p className="text-[11px] text-zinc-600 font-mono">+{day.exercises.length - 4}</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function getMuscleEmoji(focus: string): string {
  const f = focus.toLowerCase();
  if (f.includes('chest')) return '🏋️';
  if (f.includes('back')) return '🔙';
  if (f.includes('leg') || f.includes('quad') || f.includes('ham')) return '🦵';
  if (f.includes('shoulder') || f.includes('delt')) return '💪';
  if (f.includes('arm') || f.includes('bicep') || f.includes('tricep')) return '💪';
  if (f.includes('core') || f.includes('ab')) return '🔥';
  if (f.includes('pull')) return '🔙';
  if (f.includes('push')) return '🏋️';
  if (f.includes('upper')) return '💪';
  if (f.includes('lower')) return '🦵';
  if (f.includes('full') || f.includes('total')) return '⚡';
  return '🏋️';
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 60;
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        className="text-surface-3"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        className="text-orange-500"
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        strokeDasharray={circumference}
      />
    </svg>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: 'green' | 'neutral' }) {
  const accent = color === 'green' ? 'text-green-400' : 'text-zinc-300';
  return (
    <div className="bg-surface-1 rounded-[22px] p-4 text-center shadow-card border border-white/8">
      <div className={`text-2xl font-extrabold font-mono ${accent}`}>{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 font-medium">{label}</div>
    </div>
  );
}
