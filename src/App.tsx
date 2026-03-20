import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dumbbell, RefreshCw, Flame, LogOut } from 'lucide-react';
import { WorkoutPlan, TrackedWorkout, TrackedExercise } from './types';
import { generateWorkoutPlan } from './services/openai';
import { useAuth } from './contexts/AuthContext';
import { savePlan, loadActivePlan, deactivatePlan } from './services/plans';
import { saveTrackedWorkout, loadTrackedWorkouts } from './services/tracking';

import Auth from './components/Auth';
import Setup from './components/Setup';
import Dashboard from './components/Dashboard';
import ActiveWorkout from './components/ActiveWorkout';
import BottomNav from './components/BottomNav';
import History from './components/History';

const STORAGE_KEYS = {
  plan: 'jw_plan',
  tracked: 'jw_tracked',
  activeSession: 'jw_active_session',
} as const;

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [plan, setPlan] = useState<WorkoutPlan | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [trackedWorkouts, setTrackedWorkouts] = useState<TrackedWorkout[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<{ week: number; day: number } | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.activeSession);
      if (saved) {
        const session = JSON.parse(saved);
        if (session.week && session.day) return { week: session.week, day: session.day };
      }
    } catch { /* ignore */ }
    return null;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentTab, setCurrentTab] = useState<'workouts' | 'history'>('workouts');
  const [dataLoading, setDataLoading] = useState(false);

  /* ---- Load data from server when user is authenticated ---- */
  const loadUserData = useCallback(async () => {
    setDataLoading(true);
    try {
      const result = await loadActivePlan();
      if (result) {
        setPlan(result.plan);
        setPlanId(result.planId);
        localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(result.plan));

        const tracked = await loadTrackedWorkouts(result.planId);
        setTrackedWorkouts(tracked);
        localStorage.setItem(STORAGE_KEYS.tracked, JSON.stringify(tracked));
      } else {
        setPlan(null);
        setPlanId(null);
        setTrackedWorkouts([]);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
      const cachedPlan = localStorage.getItem(STORAGE_KEYS.plan);
      const cachedTracked = localStorage.getItem(STORAGE_KEYS.tracked);
      if (cachedPlan) setPlan(JSON.parse(cachedPlan));
      if (cachedTracked) setTrackedWorkouts(JSON.parse(cachedTracked));
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadUserData();
  }, [user, loadUserData]);

  /* ---- Handlers ---- */

  const handleGenerate = async (days: number, goal: string, secondaryGoal: string | null, level: string) => {
    setIsGenerating(true);
    try {
      const newPlan = await generateWorkoutPlan(days, goal, level, secondaryGoal);
      setPlan(newPlan);
      setTrackedWorkouts([]);
      localStorage.setItem(STORAGE_KEYS.plan, JSON.stringify(newPlan));
      localStorage.setItem(STORAGE_KEYS.tracked, JSON.stringify([]));

      // Save to server
      if (user) {
        try {
          const id = await savePlan(newPlan, days, goal, level, secondaryGoal);
          setPlanId(id);
        } catch (err) {
          console.error('Failed to save plan:', err);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      alert(`Failed to generate plan: ${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompleteWorkout = async (workout: TrackedWorkout) => {
    const idx = trackedWorkouts.findIndex(
      (w) => w.weekNumber === workout.weekNumber && w.dayNumber === workout.dayNumber
    );
    const updated = idx >= 0
      ? trackedWorkouts.map((w, i) => (i === idx ? workout : w))
      : [...trackedWorkouts, workout];
    setTrackedWorkouts(updated);
    localStorage.setItem(STORAGE_KEYS.tracked, JSON.stringify(updated));
    localStorage.removeItem(STORAGE_KEYS.activeSession);
    setActiveWorkout(null);

    // Save to server
    if (user && planId) {
      try {
        await saveTrackedWorkout(planId, workout);
      } catch (err) {
        console.error('Failed to save tracked workout:', err);
      }
    }
  };

  const handleAutoSave = useCallback(async (exercises: TrackedExercise[], note?: string) => {
    if (!user || !planId || !activeWorkout) return;
    try {
      await saveTrackedWorkout(planId, {
        weekNumber: activeWorkout.week,
        dayNumber: activeWorkout.day,
        date: new Date().toISOString(),
        exercises,
        completed: false,
        note,
      });
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  }, [user, planId, activeWorkout]);

  const resetPlan = async () => {
    if (!confirm('Start a new plan? This will clear your current progress.')) return;

    // Deactivate on server (don't delete — we want history)
    if (planId) {
      try {
        await deactivatePlan(planId);
      } catch (err) {
        console.error('Failed to deactivate plan:', err);
      }
    }

    setPlan(null);
    setPlanId(null);
    setTrackedWorkouts([]);
    localStorage.removeItem(STORAGE_KEYS.plan);
    localStorage.removeItem(STORAGE_KEYS.tracked);
  };

  /* ---- Auth loading state ---- */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-ground flex flex-col items-center justify-center gap-5">
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="w-14 h-14 rounded-2xl bg-orange-500 flex items-center justify-center"
        >
          <Dumbbell className="w-7 h-7 text-black" />
        </motion.div>
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-orange-500"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    );
  }

  /* ---- Not logged in ---- */
  if (!user) {
    return (
      <div className="min-h-screen bg-ground text-zinc-100 font-sans selection:bg-orange-500/30">
        <Auth />
      </div>
    );
  }

  /* ---- Logged in ---- */
  const showBottomNav = !activeWorkout && !isGenerating;

  return (
    <div className="min-h-screen bg-ground text-zinc-100 font-sans selection:bg-orange-500/30 relative overflow-x-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_top,rgba(255,122,26,0.18),transparent_58%)]" />
      {/* Header */}
      <header className="border-b border-border-subtle bg-ground/65 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/20 flex items-center justify-center shrink-0">
              <Dumbbell className="w-4 h-4 text-black" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.32em] text-orange-300/70 mb-0.5">Performance System</p>
              <h1 className="font-bold text-sm leading-none tracking-tight">
                JACOB<span className="text-orange-500">'S</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {plan && !activeWorkout && currentTab === 'workouts' && (
              <button
                onClick={resetPlan}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-2 rounded-xl border border-border-subtle bg-surface-1/70 hover:bg-surface-1 min-h-[40px] min-w-[40px] flex items-center justify-center"
                title="New Plan"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={signOut}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-2 rounded-xl border border-border-subtle bg-surface-1/70 hover:bg-surface-1 min-h-[40px] min-w-[40px] flex items-center justify-center"
              title={user.email ?? 'Log out'}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className={`relative max-w-lg mx-auto px-4 py-6 ${showBottomNav ? 'pb-28' : ''}`}>
        {dataLoading ? (
          <div className="space-y-4 py-6">
            {/* Shimmer skeleton placeholders */}
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-1 rounded-2xl p-6 shadow-card animate-pulse">
                <div className="h-4 bg-surface-3 rounded w-2/3 mb-3" />
                <div className="h-3 bg-surface-3 rounded w-1/2 mb-2" />
                <div className="h-3 bg-surface-3 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {currentTab === 'history' ? (
              <History key="history" />
            ) : isGenerating ? (
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
                onCancel={() => {
                  // Don't delete session data — just go back to dashboard
                  // Data is already auto-saved to localStorage and server
                  setActiveWorkout(null);
                }}
                onAutoSave={handleAutoSave}
              />
            ) : (
              <Dashboard
                key="dashboard"
                plan={plan}
                planId={planId}
                trackedWorkouts={trackedWorkouts}
                onStartWorkout={(w, d) => setActiveWorkout({ week: w, day: d })}
              />
            )}
          </AnimatePresence>
        )}
      </main>

      {/* Bottom Navigation */}
      {showBottomNav && <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />}
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

  const progressPercent = ((msgIdx + 1) / messages.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-32 text-center"
    >
      {/* Branded animation */}
      <div className="relative w-20 h-20 mb-8">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-orange-500/20"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 border-2 border-surface-3 rounded-full" />
        <motion.div
          className="absolute inset-0 border-2 border-orange-500 rounded-full border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Flame className="w-7 h-7 text-orange-500" />
        </motion.div>
      </div>
      <h2 className="text-xl font-extrabold mb-3 tracking-tight">Building Your Plan</h2>
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

      {/* Progress bar */}
      <div className="w-48 h-1 bg-surface-3 rounded-full mt-6 overflow-hidden">
        <motion.div
          className="h-full bg-orange-500 rounded-full"
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}
