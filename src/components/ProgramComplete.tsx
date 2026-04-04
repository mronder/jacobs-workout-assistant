import { motion } from 'motion/react';
import { Trophy, RotateCcw, TrendingUp, Plus, Coffee } from 'lucide-react';

interface ProgramCompleteProps {
  planName: string;
  onLoop: () => void;
  onProgress: () => void;
  onNewPlan: () => void;
  onDeload: () => void;
}

export default function ProgramComplete({ planName, onLoop, onProgress, onNewPlan, onDeload }: ProgramCompleteProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full max-w-sm"
      >
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-2xl">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full bg-orange-500/20 blur-3xl pointer-events-none" />

          {/* Trophy */}
          <div className="relative text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
              className="w-20 h-20 rounded-[26px] bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/30"
            >
              <Trophy className="w-10 h-10 text-black" />
            </motion.div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Program Complete!</h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              You finished all 4 weeks of <span className="text-orange-300 font-medium">{planName}</span>. Choose what's next.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <button
              onClick={onLoop}
              className="w-full rounded-[22px] border border-white/8 bg-surface-1/80 hover:bg-surface-2 p-4 text-left transition-all cursor-pointer flex items-center gap-4 shadow-card"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-400/15 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Loop</p>
                <p className="text-xs text-zinc-400 mt-0.5">Restart from Week 1 with the same plan</p>
              </div>
            </button>

            <button
              onClick={onProgress}
              className="w-full rounded-[22px] border border-orange-400/20 bg-gradient-to-r from-orange-500/10 to-transparent hover:from-orange-500/18 p-4 text-left transition-all cursor-pointer flex items-center gap-4 shadow-card"
            >
              <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-400/15 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Progress</p>
                <p className="text-xs text-zinc-400 mt-0.5">Generate a harder plan based on this one</p>
              </div>
            </button>

            <button
              onClick={onNewPlan}
              className="w-full rounded-[22px] border border-white/8 bg-surface-1/80 hover:bg-surface-2 p-4 text-left transition-all cursor-pointer flex items-center gap-4 shadow-card"
            >
              <div className="w-12 h-12 rounded-2xl bg-zinc-500/15 border border-zinc-400/15 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-zinc-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">New Plan</p>
                <p className="text-xs text-zinc-400 mt-0.5">Start fresh with a completely new program</p>
              </div>
            </button>

            <button
              onClick={onDeload}
              className="w-full rounded-[22px] border border-green-400/15 bg-green-500/8 hover:bg-green-500/15 p-4 text-left transition-all cursor-pointer flex items-center gap-4 shadow-card"
            >
              <div className="w-12 h-12 rounded-2xl bg-green-500/15 border border-green-400/15 flex items-center justify-center shrink-0">
                <Coffee className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Deload Week</p>
                <p className="text-xs text-zinc-400 mt-0.5">Recovery week before your next cycle</p>
              </div>
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
