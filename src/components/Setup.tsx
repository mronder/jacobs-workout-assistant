import { useState } from 'react';
import { motion } from 'motion/react';
import { Flame, Target, Zap, ChevronRight } from 'lucide-react';

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

export default function Setup({ onGenerate }: SetupProps) {
  const [days, setDays] = useState(4);
  const [goal, setGoal] = useState('Hypertrophy (Muscle Growth)');
  const [secondaryGoal, setSecondaryGoal] = useState<string | null>(null);
  const [level, setLevel] = useState('Intermediate');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
      className="max-w-lg mx-auto"
    >
      {/* Hero */}
      <div className="text-center mb-10 pt-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-orange-500/10 text-orange-400 text-xs font-semibold px-4 py-2 rounded-full mb-6 border border-orange-500/20"
        >
          <Flame className="w-3.5 h-3.5" />
          AI-POWERED WORKOUT PLAN
        </motion.div>
        <h2 className="text-4xl sm:text-5xl font-black tracking-tight leading-tight mb-3">
          Your Plan.<br />
          <span className="text-orange-500">Your Rules.</span>
        </h2>
        <p className="text-zinc-400 text-base max-w-sm mx-auto">
          Answer 3 quick questions and get a personalized 4-week training program in seconds.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-8">
        {/* Days Per Week */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#111] rounded-2xl p-5 border border-[#222]"
        >
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 mb-4">
            <Target className="w-4 h-4 text-orange-500" />
            DAYS PER WEEK
          </label>
          <div className="flex gap-2">
            {[3, 4, 5, 6].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`flex-1 h-14 rounded-xl font-mono text-xl font-bold transition-all duration-200 cursor-pointer ${
                  days === d
                    ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/25 scale-105'
                    : 'bg-[#1a1a1a] text-zinc-500 hover:text-zinc-300 hover:bg-[#222] border border-[#222]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Primary Goal */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-[#111] rounded-2xl p-5 border border-[#222]"
        >
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 mb-4">
            <Flame className="w-4 h-4 text-orange-500" />
            PRIMARY GOAL
          </label>
          <div className="grid grid-cols-2 gap-3">
            {goals.map((g) => (
              <button
                key={g.value}
                onClick={() => {
                  setGoal(g.value);
                  // Clear secondary if it matches the new primary
                  if (secondaryGoal === g.value) setSecondaryGoal(null);
                }}
                className={`flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-200 cursor-pointer border ${
                  goal === g.value
                    ? 'bg-orange-500/10 border-orange-500/50 text-white'
                    : 'bg-[#1a1a1a] border-transparent text-zinc-400 hover:bg-[#222] hover:text-zinc-200'
                }`}
              >
                <span className="text-xl">{g.icon}</span>
                <span className="text-sm font-semibold">{g.label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Secondary Goal */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#111] rounded-2xl p-5 border border-[#222]"
        >
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 mb-2">
            <Target className="w-4 h-4 text-orange-500" />
            SECONDARY GOAL
            <span className="text-[11px] font-normal text-zinc-500 ml-1">(optional)</span>
          </label>
          <p className="text-zinc-500 text-xs mb-4">Pick a secondary focus to complement your primary goal.</p>
          <div className="grid grid-cols-2 gap-3">
            {goals
              .filter((g) => g.value !== goal)
              .map((g) => (
                <button
                  key={g.value}
                  onClick={() =>
                    setSecondaryGoal(secondaryGoal === g.value ? null : g.value)
                  }
                  className={`flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-200 cursor-pointer border ${
                    secondaryGoal === g.value
                      ? 'bg-blue-500/10 border-blue-500/50 text-white'
                      : 'bg-[#1a1a1a] border-transparent text-zinc-400 hover:bg-[#222] hover:text-zinc-200'
                  }`}
                >
                  <span className="text-xl">{g.icon}</span>
                  <span className="text-sm font-semibold">{g.label}</span>
                </button>
              ))}
          </div>
        </motion.div>

        {/* Level */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#111] rounded-2xl p-5 border border-[#222]"
        >
          <label className="flex items-center gap-2 text-sm font-bold text-zinc-300 mb-4">
            <Zap className="w-4 h-4 text-orange-500" />
            EXPERIENCE LEVEL
          </label>
          <div className="flex gap-3">
            {levels.map((l) => (
              <button
                key={l.value}
                onClick={() => setLevel(l.value)}
                className={`flex-1 py-4 rounded-xl text-center transition-all duration-200 cursor-pointer border ${
                  level === l.value
                    ? 'bg-orange-500/10 border-orange-500/50 text-white'
                    : 'bg-[#1a1a1a] border-transparent text-zinc-400 hover:bg-[#222] hover:text-zinc-200'
                }`}
              >
                <div className="text-sm font-bold">{l.label}</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">{l.desc}</div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button
            onClick={() => onGenerate(days, goal, secondaryGoal, level)}
            className="w-full py-5 bg-orange-500 hover:bg-orange-400 text-black font-extrabold text-lg rounded-2xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-orange-500/20 active:scale-[0.98]"
          >
            Generate My Plan
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
