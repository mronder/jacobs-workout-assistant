import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, ChevronRight, Trophy, ArrowLeft, Dumbbell, Calendar, Loader2, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  getDistinctExercises,
  getExerciseHistory,
  getExercisePR,
  getProgressionData,
  type ExerciseSummary,
  type HistorySession,
  type PersonalRecord,
  type ProgressionPoint,
} from '../services/history';
import ProgressChart from './ProgressChart';

export default function History() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<ExerciseSummary[]>([]);
  const [filtered, setFiltered] = useState<ExerciseSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getDistinctExercises(user.id)
      .then((data) => {
        setExercises(data);
        setFiltered(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!search.trim()) {
      setFiltered(exercises);
    } else {
      const q = search.toLowerCase();
      setFiltered(exercises.filter((e) => e.exerciseName.toLowerCase().includes(q)));
    }
  }, [search, exercises]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin mb-3" />
        <p className="text-zinc-500 text-sm">Loading history...</p>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {selectedExercise ? (
        <ExerciseDetail
          key="detail"
          exerciseName={selectedExercise}
          onBack={() => setSelectedExercise(null)}
        />
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, x: -20 }}
        >
          {/* Header */}
          <div className="mb-5">
            <h2 className="text-xl font-black tracking-tight mb-1">Exercise History</h2>
            <p className="text-zinc-500 text-sm">Track your progress over time</p>
          </div>

          {exercises.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-[#111] border border-[#1a1a1a] flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-7 h-7 text-zinc-600" />
              </div>
              <p className="text-zinc-400 font-semibold mb-1">No History Yet</p>
              <p className="text-zinc-600 text-sm max-w-xs mx-auto">
                Complete a workout to start tracking your exercise history here.
              </p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search exercises..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/50 transition-colors"
                />
              </div>

              {/* Exercise List */}
              <div className="space-y-1.5">
                {filtered.map((ex) => (
                  <motion.button
                    key={ex.exerciseName}
                    onClick={() => setSelectedExercise(ex.exerciseName)}
                    className="w-full bg-[#111] hover:bg-[#151515] border border-[#1a1a1a] rounded-xl px-4 py-3 flex items-center justify-between transition-colors cursor-pointer text-left"
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{ex.exerciseName}</p>
                      <p className="text-xs text-zinc-500">{ex.sessionCount} session{ex.sessionCount !== 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                  </motion.button>
                ))}
              </div>

              {filtered.length === 0 && search && (
                <p className="text-center text-zinc-500 text-sm py-8">
                  No exercises match "{search}"
                </p>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Exercise Detail                                                    */
/* ------------------------------------------------------------------ */

function ExerciseDetail({
  exerciseName,
  onBack,
}: {
  exerciseName: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [pr, setPR] = useState<PersonalRecord | null>(null);
  const [chartData, setChartData] = useState<ProgressionPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      getExerciseHistory(user.id, exerciseName),
      getExercisePR(user.id, exerciseName),
      getProgressionData(user.id, exerciseName),
    ])
      .then(([hist, prData, prog]) => {
        setSessions(hist);
        setPR(prData);
        setChartData(prog);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, exerciseName]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin mb-3" />
        <p className="text-zinc-500 text-sm">Loading {exerciseName}...</p>
      </div>
    );
  }

  return (
    <motion.div
      key="detail"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      {/* Back button + title */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm mb-4 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> All Exercises
      </button>

      <h2 className="text-lg font-black tracking-tight mb-4">{exerciseName}</h2>

      {/* PR Banner */}
      {pr && pr.maxWeight > 0 && (
        <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-xl p-4 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-orange-400 font-semibold uppercase tracking-wider mb-0.5">Personal Record</p>
            <p className="text-white font-bold text-sm">
              {pr.maxWeight} lbs
              {pr.maxVolume > 0 && (
                <span className="text-zinc-400 font-normal">
                  {' '} · Best set: {pr.maxVolumeWeight} × {pr.maxVolumeReps}
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Progression Chart */}
      <div className="mb-4">
        <ProgressChart data={chartData} />
      </div>

      {/* Session List */}
      <div className="mb-20">
        <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" /> Session History
        </p>

        {sessions.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-8">No sessions recorded.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((session, idx) => (
              <div
                key={idx}
                className="bg-[#111] border border-[#1a1a1a] rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="text-xs text-zinc-400">
                      {session.date ? new Date(session.date).toLocaleDateString() : 'Unknown date'}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600 uppercase tracking-wider">
                    {session.planName}
                  </span>
                </div>

                {/* Sets table */}
                <div className="grid grid-cols-3 gap-1 text-[10px] text-zinc-600 uppercase tracking-wider font-semibold mb-1.5 px-1">
                  <span>Set</span>
                  <span className="text-center">Weight</span>
                  <span className="text-right">Reps</span>
                </div>
                {session.sets.map((s) => (
                  <div
                    key={s.setNumber}
                    className={`grid grid-cols-3 gap-1 text-sm px-1 py-0.5 rounded ${
                      s.completed ? 'text-white' : 'text-zinc-600'
                    }`}
                  >
                    <span className="text-zinc-500">{s.setNumber}</span>
                    <span className="text-center font-medium">{s.weight} lbs</span>
                    <span className="text-right">{s.reps}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
