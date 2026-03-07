import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { Play, CheckCircle, Quote, ChevronRight, MessageSquare } from 'lucide-react';
import { WorkoutPlan, TrackedWorkout } from '../types';
import { loadWeeklyNotes, saveWeeklyNote } from '../services/tracking';

interface DashboardProps {
  plan: WorkoutPlan;
  planId: string | null;
  trackedWorkouts: TrackedWorkout[];
  onStartWorkout: (week: number, day: number) => void;
}

export default function Dashboard({ plan, planId, trackedWorkouts, onStartWorkout }: DashboardProps) {
  const [activeWeek, setActiveWeek] = useState(1);
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Resume Workout Banner */}
      {resumeSession && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-500/15 border border-orange-500/30 rounded-2xl p-4 flex items-center justify-between"
        >
          <div>
            <p className="text-sm font-bold text-orange-400">Workout in progress</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Week {resumeSession.week} · Day {resumeSession.day} — tap to continue
            </p>
          </div>
          <button
            onClick={() => onStartWorkout(resumeSession.week, resumeSession.day)}
            className="bg-orange-500 text-black px-4 py-2 rounded-xl text-sm font-bold cursor-pointer active:scale-95 transition-all"
          >
            Resume
          </button>
        </motion.div>
      )}

      {/* Hero Card */}
      <div className="relative bg-surface-1 rounded-2xl p-6 overflow-hidden shadow-card">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-orange-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mb-1">{plan.planName}</h2>
          <p className="text-zinc-400 text-xs sm:text-sm mb-4 leading-relaxed">{plan.splitDescription}</p>

          {/* Quote */}
          <div className="flex items-start gap-3 bg-ground/60 rounded-xl p-4">
            <Quote className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-zinc-300 italic leading-relaxed">"{plan.motivationalQuote}"</p>
              <p className="text-xs text-zinc-500 mt-2 font-medium">— {plan.quoteAuthor}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3.5">
        <StatCard label="Progress" value={`${progress}%`} />
        <StatCard label="Completed" value={`${completedCount}`} />
        <StatCard label="Remaining" value={`${totalWorkouts - completedCount}`} />
      </div>

      {/* Week Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {[1, 2, 3, 4].map((w) => {
          const weekCompleted = plan.weeks
            .find((wk) => wk.weekNumber === w)
            ?.days.every((d) =>
              trackedWorkouts.some((tw) => tw.weekNumber === w && tw.dayNumber === d.dayNumber && tw.completed)
            );

          return (
            <button
              key={w}
              onClick={() => setActiveWeek(w)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 min-w-[80px] justify-center ${
                activeWeek === w
                  ? 'bg-orange-500 text-black'
                  : 'bg-surface-2 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Week {w}
              {weekCompleted && <CheckCircle className="w-3.5 h-3.5 text-orange-500" />}
            </button>
          );
        })}
      </div>

      {/* Weekly Note */}
      <div className="bg-surface-1 rounded-2xl overflow-hidden shadow-card">
        <button
          onClick={() => setShowWeekNote(!showWeekNote)}
          className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface-3 transition-colors"
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
              className="w-full bg-ground/60 border border-border-subtle rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
            />
          </div>
        )}
      </div>

      {/* Day Cards */}
      <div className="space-y-3.5">
        {currentWeek?.days.map((day, idx) => {
          const completed = trackedWorkouts.some(
            (tw) => tw.weekNumber === activeWeek && tw.dayNumber === day.dayNumber && tw.completed
          );

          return (
            <motion.div
              key={day.dayNumber}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-surface-2 rounded-2xl p-5 sm:p-6 transition-all shadow-card ${
                completed ? 'ring-1 ring-orange-500/30' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono text-base font-semibold shrink-0 mt-0.5 ${
                      completed ? 'bg-orange-500/15 text-orange-500' : 'bg-surface-3 text-zinc-500'
                    }`}
                  >
                    {completed ? <CheckCircle className="w-5 h-5" /> : `D${day.dayNumber}`}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm leading-snug">{day.focus}</h3>
                    {day.description && (
                      <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                        {day.description}
                      </p>
                    )}
                    <p className="text-[11px] text-zinc-500 mt-0.5">{day.exercises.length} exercises</p>
                  </div>
                </div>

                <button
                  onClick={() => onStartWorkout(activeWeek, day.dayNumber)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                    completed
                      ? 'bg-surface-3 text-zinc-300 hover:bg-elevated'
                      : 'bg-orange-500 text-black hover:bg-orange-400'
                  }`}
                >
                  {completed ? 'Review' : 'Start'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Exercise Preview */}
              <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                {day.exercises.slice(0, 4).map((ex, i) => (
                  <div
                    key={i}
                    className="bg-ground/60 rounded-lg px-3 py-2 shrink-0"
                  >
                    <p className="text-[11px] font-semibold text-zinc-400 truncate max-w-[120px]">
                      {ex.name}
                    </p>
                    <p className="text-[10px] text-zinc-600 font-mono">
                      {ex.sets}×{ex.reps}
                    </p>
                  </div>
                ))}
                {day.exercises.length > 4 && (
                  <div className="bg-ground/60 rounded-lg px-3 py-2 shrink-0 flex items-center">
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-1 rounded-xl p-4 text-center shadow-card">
      <div className="text-2xl font-extrabold font-mono text-white">{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 font-medium">{label}</div>
    </div>
  );
}
