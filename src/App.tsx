import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dumbbell, RefreshCw, Flame } from 'lucide-react';
import { WorkoutPlan, TrackedWorkout } from './types';
import { generateWorkoutPlan } from './services/openai';

import Setup from './components/Setup';
import Dashboard from './components/Dashboard';
import ActiveWorkout from './components/ActiveWorkout';

const STORAGE_KEYS = {
  plan: 'jw_plan',
  tracked: 'jw_tracked',
} as const;

export default function App() {
  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [trackedWorkouts, setTrackedWorkouts] = useState<TrackedWorkout[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<{ week: number; day: number } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const savedPlan = localStorage.getItem(STORAGE_KEYS.plan);
    const savedTracked = localStorage.getItem(STORAGE_KEYS.tracked);
    if (savedPlan) setPlan(JSON.parse(savedPlan));
    if (savedTracked) setTrackedWorkouts(JSON.parse(savedTracked));
  }, []);

  const handleGenerate = async (days: number, goal: string, level: string) => {
    setIsGenerating(true);
    try {
      const newPlan = await generateWorkoutPlan(days, goal, level);
      setPlan(newPlan);
      setTrackedWorkouts([]);
      localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(newPlan));
      localStorage.setItem(STORAGE_KEYS.tracked, JSON.stringify([]));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      alert(`Failed to generate plan: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompleteWorkout = (workout: TrackedWorkout) => {
    const idx = trackedWorkouts.findIndex(
      (w) => w.weekNumber === workout.weekNumber && w.dayNumber === workout.dayNumber
    );
    const updated = idx >= 0
      ? trackedWorkouts.map((w, i) => (i === idx ? workout : w))
      : [...trackedWorkouts, workout];
    setTrackedWorkouts(updated);
    localStorage.setItem(STORAGE_KEYS.tracked, JSON.stringify(updated));
    setActiveWorkout(null);
  };

  const resetPlan = () => {
    if (!confirm('Start a new plan? This will clear your current progress.')) return;
    setPlan(null);
    setTrackedWorkouts([]);
    localStorage.removeItem(STORAGE_KEYS.plan);
    localStorage.removeItem(STORAGE_KEYS.tracked);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-[#1a1a1a] bg-[#0a0a0a]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <Dumbbell className="w-4.5 h-4.5 text-black" />
            </div>
            <div>
              <h1 className="font-black text-base leading-none tracking-tight">
                JACOB<span className="text-orange-500">'S</span>
              </h1>
              <p className="text-[9px] text-zinc-600 uppercase tracking-[0.2em] font-semibold leading-none mt-0.5">
                Workout Planner
              </p>
            </div>
          </div>
          {plan && !activeWorkout && (
            <button
              onClick={resetPlan}
              className="text-xs text-zinc-500 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer px-3 py-1.5 rounded-lg hover:bg-[#111]"
            >
              <RefreshCw className="w-3 h-3" /> New Plan
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <LoadingScreen key="loading" />
          ) : !plan ? (
            <Setup key="setup" onGenerate={handleGenerate} />
          ) : activeWorkout ? (
            <ActiveWorkout
              key="active"
              plan={plan}
              week={activeWorkout.week}
              day={activeWorkout.day}
              existingWorkout={trackedWorkouts.find(
                (w) => w.weekNumber === activeWorkout.week && w.dayNumber === activeWorkout.day
              )}
              onComplete={handleCompleteWorkout}
              onCancel={() => setActiveWorkout(null)}
            />
          ) : (
            <Dashboard
              key="dashboard"
              plan={plan}
              trackedWorkouts={trackedWorkouts}
              onStartWorkout={(w, d) => setActiveWorkout({ week: w, day: d })}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function LoadingScreen() {
  const messages = [
    'Designing your optimal split...',
    'Selecting the best exercises...',
    'Writing form cues for each lift...',
    'Finding optimal set & rep ranges...',
    'Almost ready...',
  ];
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIdx((i) => (i + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-32 text-center"
    >
      <div className="relative w-20 h-20 mb-8">
        <div className="absolute inset-0 border-2 border-[#222] rounded-full" />
        <motion.div
          className="absolute inset-0 border-2 border-orange-500 rounded-full border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Flame className="w-7 h-7 text-orange-500" />
        </div>
      </div>
      <h2 className="text-xl font-black mb-3 tracking-tight">Building Your Plan</h2>
      <AnimatePresence mode="wait">
        <motion.p
          key={msgIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="text-zinc-500 text-sm max-w-xs h-8"
        >
          {messages[msgIdx]}
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}
