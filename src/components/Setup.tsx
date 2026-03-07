import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, Target, Zap, ChevronRight, ChevronLeft, Rocket } from 'lucide-react';

interface SetupProps {
  onGenerate: (days: number, goal: string, secondaryGoal: string | null, level: string) => void;
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

const TOTAL_STEPS = 4;

export default function Setup({ onGenerate }: SetupProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [days, setDays] = useState(4);
  const [goal, setGoal] = useState('Hypertrophy (Muscle Growth)');
  const [secondaryGoal, setSecondaryGoal] = useState<string | null>(null);
  const [level, setLevel] = useState('Intermediate');

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

  const stepLabels = ['Schedule', 'Goal', 'Secondary', 'Level'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="max-w-lg mx-auto flex flex-col min-h-[calc(100vh-8rem)]"
    >
      {/* Progress Bar */}
      <div className="pt-4 mb-2">
        <div className="flex items-center justify-between mb-3">
          {step > 0 ? (
            <button onClick={goBack} className="text-zinc-500 hover:text-white transition-colors cursor-pointer p-1 -ml-1">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-7" />
          )}
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium">
            {stepLabels[step]} · {step + 1} of {TOTAL_STEPS}
          </span>
          <div className="w-7" />
        </div>
        <div className="flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-surface-3">
              <motion.div
                className="h-full bg-orange-500 rounded-full"
                initial={false}
                animate={{ width: i <= step ? '100%' : '0%' }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 flex flex-col justify-center py-8">
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
                <div className="w-14 h-14 rounded-2xl bg-orange-500/15 flex items-center justify-center mx-auto mb-5">
                  <Target className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                  How many days<br />can you train?
                </h2>
                <p className="text-zinc-500 text-sm">Pick what's sustainable — consistency beats intensity.</p>
              </div>
              <div className="flex gap-3 max-w-xs mx-auto">
                {[3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDays(d); goNext(); }}
                    className={`flex-1 h-16 rounded-2xl font-mono text-2xl font-bold transition-all duration-200 cursor-pointer ${
                      days === d
                        ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/25 scale-105'
                        : 'bg-surface-1 text-zinc-500 hover:text-zinc-300 hover:bg-surface-3 shadow-card'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 1 && (
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
                <div className="w-14 h-14 rounded-2xl bg-orange-500/15 flex items-center justify-center mx-auto mb-5">
                  <Flame className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                  What's your<br />primary goal?
                </h2>
                <p className="text-zinc-500 text-sm">This shapes your entire program structure.</p>
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
                    className={`flex items-center gap-3 p-5 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-card ${
                      goal === g.value
                        ? 'bg-orange-500/10 ring-1 ring-orange-500/50 text-white'
                        : 'bg-surface-1 text-zinc-400 hover:bg-surface-3 hover:text-zinc-200'
                    }`}
                  >
                    <span className="text-2xl">{g.icon}</span>
                    <span className="text-sm font-semibold">{g.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === 2 && (
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
                <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center mx-auto mb-5">
                  <Target className="w-7 h-7 text-blue-400" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                  Any secondary<br />focus?
                </h2>
                <p className="text-zinc-500 text-sm">Optional — adds a complementary angle to your plan.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {goals
                  .filter((g) => g.value !== goal)
                  .map((g) => (
                    <button
                      key={g.value}
                      onClick={() => setSecondaryGoal(secondaryGoal === g.value ? null : g.value)}
                      className={`flex items-center gap-3 p-5 rounded-2xl text-left transition-all duration-200 cursor-pointer shadow-card ${
                        secondaryGoal === g.value
                          ? 'bg-blue-500/10 ring-1 ring-blue-500/50 text-white'
                          : 'bg-surface-1 text-zinc-400 hover:bg-surface-3 hover:text-zinc-200'
                      }`}
                    >
                      <span className="text-2xl">{g.icon}</span>
                      <span className="text-sm font-semibold">{g.label}</span>
                    </button>
                  ))}
              </div>
              <button
                onClick={goNext}
                className="w-full py-4 bg-surface-1 hover:bg-surface-3 text-zinc-300 font-semibold text-sm rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-card"
              >
                {secondaryGoal ? 'Continue' : 'Skip'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 3 && (
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
                <div className="w-14 h-14 rounded-2xl bg-orange-500/15 flex items-center justify-center mx-auto mb-5">
                  <Zap className="w-7 h-7 text-orange-500" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
                  Experience level?
                </h2>
                <p className="text-zinc-500 text-sm">Determines exercise complexity and volume.</p>
              </div>
              <div className="space-y-3 mb-8">
                {levels.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => setLevel(l.value)}
                    className={`w-full py-5 px-6 rounded-2xl text-left transition-all duration-200 cursor-pointer flex items-center justify-between shadow-card ${
                      level === l.value
                        ? 'bg-orange-500/10 ring-1 ring-orange-500/50 text-white'
                        : 'bg-surface-1 text-zinc-400 hover:bg-surface-3 hover:text-zinc-200'
                    }`}
                  >
                    <div>
                      <div className="text-base font-semibold">{l.label}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{l.desc}</div>
                    </div>
                    {level === l.value && (
                      <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                        <div className="w-2 h-2 rounded-full bg-black" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
              <motion.button
                onClick={() => onGenerate(days, goal, secondaryGoal, level)}
                className="w-full py-5 bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-lg rounded-2xl transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-orange-500/20 active:scale-[0.98]"
                whileTap={{ scale: 0.97 }}
              >
                <Rocket className="w-5 h-5" />
                Generate My Plan
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
