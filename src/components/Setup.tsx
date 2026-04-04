import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Target, Zap, ChevronRight, ChevronLeft, Rocket, Layers, Heart } from 'lucide-react';
import { savePreferences } from '../services/preferences';

interface SplitInfo {
  key: string;
  splitName: string;
  dayFocuses: string[];
}

interface SetupProps {
  onGenerate: (days: number, goal: string, secondaryGoal: string | null, level: string, noSupersets: boolean, splitType: string | null, mobilityAreas?: string[], sessionDuration?: number) => void;
  onCustomBuild?: () => void;
}

const goals = [
  { label: 'Muscle Growth', value: 'Hypertrophy (Muscle Growth)', icon: '💪' },
  { label: 'Strength', value: 'Strength', icon: '🏋️' },
  { label: 'Fat Loss', value: 'Fat Loss', icon: '🔥' },
  { label: 'General Fitness', value: 'General Fitness', icon: '⚡' },
];

const levels = [
  { label: 'Beginner', value: 'Beginner', desc: 'New to lifting' },
  { label: 'Intermediate', value: 'Intermediate', desc: '1-3 years' },
  { label: 'Advanced', value: 'Advanced', desc: '3+ years' },
];

const TOTAL_STEPS = 6;

const MOBILITY_AREAS = [
  { key: 'hips', label: 'Hips', emoji: '🦵' },
  { key: 'shoulders', label: 'Shoulders', emoji: '💪' },
  { key: 'lower-back', label: 'Lower Back', emoji: '🔙' },
  { key: 'ankles', label: 'Ankles', emoji: '🦶' },
  { key: 'wrists', label: 'Wrists', emoji: '✋' },
  { key: 'thoracic', label: 'Upper Back / T-Spine', emoji: '🏋️' },
];

export default function Setup({ onGenerate, onCustomBuild }: SetupProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [days, setDays] = useState(4);
  const [splitType, setSplitType] = useState<string | null>(null);
  const [availableSplits, setAvailableSplits] = useState<SplitInfo[]>([]);
  const [goal, setGoal] = useState('Hypertrophy (Muscle Growth)');
  const [secondaryGoal, setSecondaryGoal] = useState<string | null>(null);
  const [level, setLevel] = useState('Intermediate');
  const [noSupersets, setNoSupersets] = useState(false);
  const [mobilityAreas, setMobilityAreas] = useState<string[]>([]);
  const [sessionDuration, setSessionDuration] = useState(60);

  // Fetch available splits when days change
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/splits?days=${days}`)
      .then((res) => res.ok ? res.json() : [])
      .then((data: SplitInfo[]) => {
        if (cancelled) return;
        setAvailableSplits(data);
        // Auto-select first if current selection invalid
        if (!data.find((s) => s.key === splitType)) {
          setSplitType(data.length > 0 ? data[0].key : null);
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableSplits([]);
      });
    return () => { cancelled = true; };
  }, [days]);

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
  };

  const stepLabels = ['Schedule', 'Split', 'Goal', 'Secondary', 'Level', 'Mobility'];
  const stepDescriptions = [
    'Shape a schedule you can actually sustain.',
    'Choose how to organize your training days.',
    'Set the primary result the plan should chase.',
    'Add an optional secondary bias if it matters.',
    'Match the program complexity to your training background.',
    'Optional: Tell us about tight areas and session length.',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="max-w-lg mx-auto flex flex-col min-h-[calc(100vh-8rem)]"
    >
      <div className="relative overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-5 py-5 shadow-card mb-5">
        <div className="absolute -top-16 right-[-40px] h-36 w-36 rounded-full bg-orange-500/14 blur-3xl pointer-events-none" />
        <div className="flex items-center justify-between mb-4">
          {step > 0 ? (
            <button onClick={goBack} className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-2 -ml-2 rounded-xl hover:bg-white/5">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-7" />
          )}
          <span className="text-[10px] text-zinc-500 uppercase tracking-[0.28em] font-medium">
            {stepLabels[step]} · {step + 1} of {TOTAL_STEPS}
          </span>
          <div className="w-7" />
        </div>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.28em] text-orange-300/80 mb-2">Plan Builder</p>
          <h2 className="text-3xl font-bold tracking-tight leading-none mb-2">Build a plan that feels like it was made for one person.</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">{stepDescriptions[step]}</p>
        </div>

        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
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

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Days</p>
            <p className="text-base font-bold text-orange-100">{days}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Goal</p>
            <p className="text-sm font-bold text-orange-100">{goal.split(' ')[0]}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/15 px-3 py-3">
            <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500 mb-1">Level</p>
            <p className="text-sm font-bold text-orange-100">{level}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center py-4">
        <AnimatePresence mode="wait" custom={direction}>
          {step === 0 && (
            <motion.div
              key="step-days"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-[22px] bg-orange-500/15 border border-orange-300/15 flex items-center justify-center mx-auto mb-5 shadow-card">
                  <Target className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                  How many days<br />can you train?
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">Pick the cadence you can repeat for months, not the one that sounds impressive for a weekend.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDays(d); goNext(); }}
                    className={`rounded-[24px] border px-4 py-5 text-left transition-all duration-200 cursor-pointer ${
                      days === d
                        ? 'border-orange-300/40 bg-gradient-to-br from-orange-300 to-orange-500 text-black shadow-lg shadow-orange-500/25 scale-[1.02]'
                        : 'border-white/8 bg-surface-1/80 text-zinc-300 hover:border-orange-300/20 hover:bg-surface-2 shadow-card'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-[0.25em] opacity-70 mb-2">Weekly Pace</div>
                    <div className="font-mono text-3xl font-bold">{d}</div>
                    <div className={`text-xs mt-2 ${days === d ? 'text-black/70' : 'text-zinc-500'}`}>{d === 3 ? 'Lean and sustainable' : d === 4 ? 'Balanced progression' : d === 5 ? 'Classic training split' : 'High-frequency push'}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="step-split"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-[22px] bg-orange-500/15 border border-orange-300/15 flex items-center justify-center mx-auto mb-5 shadow-card">
                  <Layers className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                  Choose your<br />training split
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">How should your {days} training days be organized? Each split hits muscles differently.</p>
              </div>
              <div className="space-y-3">
                {availableSplits.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => { setSplitType(s.key); goNext(); }}
                    className={`w-full rounded-[24px] border p-5 text-left transition-all duration-200 cursor-pointer shadow-card ${
                      splitType === s.key
                        ? 'border-orange-300/40 bg-gradient-to-r from-orange-400/15 to-transparent text-white'
                        : 'border-white/8 bg-surface-1/80 text-zinc-400 hover:border-orange-300/15 hover:bg-surface-2 hover:text-zinc-200'
                    }`}
                  >
                    <div className="text-base font-bold mb-2">{s.splitName}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.dayFocuses.map((focus, i) => (
                        <span key={i} className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          splitType === s.key ? 'bg-orange-500/20 text-orange-200' : 'bg-white/5 text-zinc-500'
                        }`}>
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
            <motion.div
              key="step-goal"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-[22px] bg-orange-500/15 border border-orange-300/15 flex items-center justify-center mx-auto mb-5 shadow-card">
                  <Flame className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                  What's your<br />primary goal?
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">This decides whether the plan prioritizes size, force output, body composition, or overall athletic consistency.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {goals.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => {
                      setGoal(g.value);
                      if (secondaryGoal === g.value) setSecondaryGoal(null);
                      goNext();
                    }}
                    className={`rounded-[24px] border p-5 text-left transition-all duration-200 cursor-pointer shadow-card ${
                      goal === g.value
                        ? 'border-orange-300/40 bg-gradient-to-br from-orange-400/18 to-orange-500/8 text-white'
                        : 'border-white/8 bg-surface-1/80 text-zinc-400 hover:border-orange-300/15 hover:bg-surface-2 hover:text-zinc-200'
                    }`}
                  >
                    <div className="text-2xl mb-4">{g.icon}</div>
                    <div className="text-base font-bold mb-1">{g.label}</div>
                    <div className="text-xs text-zinc-500">{g.value === 'Strength' ? 'Lower rep bias, heavier work' : g.value === 'Fat Loss' ? 'Density and workload emphasis' : g.value === 'General Fitness' ? 'Balanced performance and energy' : 'Volume and muscular development'}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-secondary"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-[22px] bg-sky-500/12 border border-sky-300/12 flex items-center justify-center mx-auto mb-5 shadow-card">
                  <Target className="w-7 h-7 text-blue-400" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                  Any secondary<br />focus?
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">This is optional. Use it when you want the plan to lean in two directions without losing its main job.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {goals
                  .filter((g) => g.value !== goal)
                  .map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setSecondaryGoal(secondaryGoal === g.value ? null : g.value)}
                      className={`rounded-[24px] border p-5 text-left transition-all duration-200 cursor-pointer shadow-card ${
                        secondaryGoal === g.value
                          ? 'border-sky-300/40 bg-gradient-to-br from-sky-500/16 to-sky-500/6 text-white'
                          : 'border-white/8 bg-surface-1/80 text-zinc-400 hover:border-sky-300/18 hover:bg-surface-2 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-2xl mb-4">{g.icon}</div>
                      <div className="text-base font-bold mb-1">{g.label}</div>
                      <div className="text-xs text-zinc-500">Optional secondary bias</div>
                    </button>
                  ))}
              </div>
              <button
                onClick={goNext}
                className="w-full py-4 bg-surface-1/85 hover:bg-surface-2 text-zinc-200 font-semibold text-sm rounded-[24px] border border-white/8 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-card"
              >
                {secondaryGoal ? 'Continue' : 'Skip'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step-level"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-[22px] bg-orange-500/15 border border-orange-300/15 flex items-center justify-center mx-auto mb-5 shadow-card">
                  <Zap className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                  Experience level?
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">The plan should meet you where you really train, not where your ego says you train.</p>
              </div>
              <div className="space-y-3 mb-8">
                {levels.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLevel(l.value)}
                    className={`w-full py-5 px-6 rounded-[24px] border text-left transition-all duration-200 cursor-pointer flex items-center justify-between shadow-card ${
                      level === l.value
                        ? 'border-orange-300/40 bg-gradient-to-r from-orange-400/15 to-transparent text-white'
                        : 'border-white/8 bg-surface-1/80 text-zinc-400 hover:border-orange-300/15 hover:bg-surface-2 hover:text-zinc-200'
                    }`}
                  >
                    <div>
                      <div className="text-base font-bold">{l.label}</div>
                      <div className="text-xs text-zinc-500 mt-1">{l.desc}</div>
                    </div>
                    {level === l.value && (
                      <div className="w-8 h-8 rounded-full bg-orange-500 text-black flex items-center justify-center shrink-0 font-bold text-xs">
                        OK
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {/* Superset Exclusion Toggle */}
              <div className="mb-6">
                <button
                  onClick={() => setNoSupersets(!noSupersets)}
                  className={`w-full py-4 px-5 rounded-[24px] border text-left transition-all duration-200 cursor-pointer flex items-center justify-between shadow-card ${
                    noSupersets
                      ? 'border-orange-300/40 bg-gradient-to-r from-orange-400/15 to-transparent text-white'
                      : 'border-white/8 bg-surface-1/80 text-zinc-400 hover:border-orange-300/15 hover:bg-surface-2 hover:text-zinc-200'
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold">Exclude Supersets</div>
                    <div className="text-xs text-zinc-500 mt-1">No paired exercises — straight sets only</div>
                  </div>
                  <div className={`w-12 h-7 rounded-full p-1 transition-colors ${
                    noSupersets ? 'bg-orange-500' : 'bg-surface-3'
                  }`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      noSupersets ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </div>
                </button>
              </div>

              <motion.button
                onClick={goNext}
                className="w-full py-5 bg-gradient-to-r from-orange-300 via-orange-500 to-orange-600 hover:from-orange-300 hover:to-orange-500 text-black font-bold text-lg rounded-[26px] transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-orange-500/25 active:scale-[0.98]"
                whileTap={{ scale: 0.97 }}
              >
                <ChevronRight className="w-5 h-5" />
                Continue
              </motion.button>
            </motion.div>
          )}

          {step === 5 && (
            <motion.div
              key="step-mobility"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-[22px] bg-green-500/12 border border-green-300/12 flex items-center justify-center mx-auto mb-5 shadow-card">
                  <Heart className="w-7 h-7 text-green-400" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
                  Mobility &amp;<br />Session Time
                </h2>
                <p className="text-zinc-400 text-sm leading-relaxed max-w-sm mx-auto">Both are optional. We'll tailor warm-ups and exercise count to your answers.</p>
              </div>

              {/* Tight Areas Multi-Select */}
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 font-medium mb-3">Any areas that feel tight or restricted?</p>
                <div className="grid grid-cols-2 gap-2">
                  {MOBILITY_AREAS.map((area) => {
                    const selected = mobilityAreas.includes(area.key);
                    return (
                      <button
                        key={area.key}
                        onClick={() => {
                          setMobilityAreas(prev =>
                            selected ? prev.filter(a => a !== area.key) : [...prev, area.key]
                          );
                        }}
                        className={`rounded-[18px] border p-3 text-left transition-all duration-200 cursor-pointer flex items-center gap-2.5 shadow-card ${
                          selected
                            ? 'border-green-300/40 bg-green-500/12 text-white'
                            : 'border-white/8 bg-surface-1/80 text-zinc-400 hover:border-green-300/15 hover:bg-surface-2 hover:text-zinc-200'
                        }`}
                      >
                        <span className="text-lg">{area.emoji}</span>
                        <span className="text-sm font-medium">{area.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Session Duration Slider */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 font-medium">Typical session length</p>
                  <span className="text-sm font-bold text-orange-100">{sessionDuration} min</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={90}
                  step={5}
                  value={sessionDuration}
                  onChange={(e) => setSessionDuration(parseInt(e.target.value, 10))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer bg-surface-3 accent-orange-500"
                />
                <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                  <span>30 min</span>
                  <span>60 min</span>
                  <span>90 min</span>
                </div>
              </div>

              <motion.button
                onClick={() => {
                  // Save preferences in background
                  savePreferences({ mobilityAreas, sessionDuration }).catch(() => {});
                  onGenerate(days, goal, secondaryGoal, level, noSupersets, splitType, mobilityAreas, sessionDuration);
                }}
                className="w-full py-5 bg-gradient-to-r from-orange-300 via-orange-500 to-orange-600 hover:from-orange-300 hover:to-orange-500 text-black font-bold text-lg rounded-[26px] transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-orange-500/25 active:scale-[0.98]"
                whileTap={{ scale: 0.97 }}
              >
                <Rocket className="w-5 h-5" />
                Generate My Plan
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Build from Scratch option */}
      {onCustomBuild && (
        <div className="mt-auto pb-4">
          <button
            onClick={onCustomBuild}
            className="w-full py-4 text-zinc-400 hover:text-white text-sm font-medium transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <Layers className="w-4 h-4" />
            Or build a plan from scratch
          </button>
        </div>
      )}
    </motion.div>
  );
}
