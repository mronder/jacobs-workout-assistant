import { useState } from 'react';
import { motion } from 'motion/react';
import { Play, CheckCircle, Quote, ChevronRight } from 'lucide-react';
import { WorkoutPlan, TrackedWorkout } from '../types';

interface DashboardProps {
  plan: WorkoutPlan;
  trackedWorkouts: TrackedWorkout[];
  onStartWorkout: (week: number, day: number) => void;
}

export default function Dashboard({ plan, trackedWorkouts, onStartWorkout }: DashboardProps) {
  const [activeWeek, setActiveWeek] = useState(1);

  const totalWorkouts = plan.weeks.reduce((acc, week) => acc + week.days.length, 0);
  const completedCount = trackedWorkouts.length;
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
      {/* Hero Card */}
      <div className="relative bg-[#111] border border-[#222] rounded-2xl p-5 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-60 h-60 bg-orange-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-1">{plan.planName}</h2>
          <p className="text-zinc-400 text-xs sm:text-sm mb-4 leading-relaxed">{plan.splitDescription}</p>

          {/* Quote */}
          <div className="flex items-start gap-3 bg-black/30 rounded-xl p-4 border border-[#1a1a1a]">
            <Quote className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-zinc-300 italic leading-relaxed">"{plan.motivationalQuote}"</p>
              <p className="text-xs text-zinc-500 mt-2 font-semibold">— {plan.quoteAuthor}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3">
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
              trackedWorkouts.some((tw) => tw.weekNumber === w && tw.dayNumber === d.dayNumber)
            );

          return (
            <button
              key={w}
              onClick={() => setActiveWeek(w)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeWeek === w
                  ? 'bg-white text-black'
                  : 'bg-[#111] text-zinc-500 hover:text-zinc-300 border border-[#222]'
              }`}
            >
              Week {w}
              {weekCompleted && <CheckCircle className="w-3.5 h-3.5 text-orange-500" />}
            </button>
          );
        })}
      </div>

      {/* Day Cards */}
      <div className="space-y-3">
        {currentWeek?.days.map((day, idx) => {
          const completed = trackedWorkouts.some(
            (tw) => tw.weekNumber === activeWeek && tw.dayNumber === day.dayNumber
          );

          return (
            <motion.div
              key={day.dayNumber}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-[#111] border rounded-2xl p-4 sm:p-5 transition-all ${
                completed ? 'border-orange-500/30' : 'border-[#222]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center font-mono text-base font-bold shrink-0 mt-0.5 ${
                      completed ? 'bg-orange-500/15 text-orange-500' : 'bg-[#1a1a1a] text-zinc-500'
                    }`}
                  >
                    {completed ? <CheckCircle className="w-5 h-5" /> : `D${day.dayNumber}`}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm leading-snug">{day.focus.split(/[:\-\u2013]/)[0].trim()}</h3>
                    {day.focus.includes(':') || day.focus.includes('-') || day.focus.includes('\u2013') ? (
                      <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                        {day.focus.substring(day.focus.search(/[:\-\u2013]/) + 1).trim()}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-zinc-500 mt-0.5">{day.exercises.length} exercises</p>
                  </div>
                </div>

                <button
                  onClick={() => onStartWorkout(activeWeek, day.dayNumber)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                    completed
                      ? 'bg-[#1a1a1a] text-zinc-300 hover:bg-[#222]'
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
                    className="bg-black/30 rounded-lg px-3 py-2 border border-[#1a1a1a] shrink-0"
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
                  <div className="bg-black/30 rounded-lg px-3 py-2 border border-[#1a1a1a] shrink-0 flex items-center">
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
    <div className="bg-[#111] border border-[#222] rounded-xl p-4 text-center">
      <div className="text-2xl font-black font-mono text-white">{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 font-semibold">{label}</div>
    </div>
  );
}
