import { motion } from 'motion/react';
import { useAppStore } from '../store/useAppStore';
import { BrainCircuit } from 'lucide-react';

export function GeneratingScreen() {
  const { generatingPhase, generatingWeekProgress } = useAppStore();

  const progress = generatingWeekProgress
    ? Math.round((generatingWeekProgress.current / (generatingWeekProgress.total + 1)) * 100)
    : 5;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-surface-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-8"
    >
      {/* Pulsing brain */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, -5, 0],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="mb-8 relative"
      >
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-2xl scale-150" />
        <div className="relative p-6 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 rounded-full border border-emerald-500/20">
          <BrainCircuit size={48} className="text-emerald-400" />
        </div>
      </motion.div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-white mb-2 text-center">Building Your Program</h2>

      {/* Phase text */}
      {generatingPhase && (
        <p className="text-emerald-400 text-sm font-medium mb-4 font-mono">{generatingPhase}</p>
      )}

      {/* Week progress indicators */}
      {generatingWeekProgress && (
        <div className="flex gap-2 mb-4">
          {Array.from({ length: generatingWeekProgress.total }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-500 ${
                i < generatingWeekProgress!.current
                  ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  : i === generatingWeekProgress!.current
                    ? 'bg-emerald-500/50 animate-pulse'
                    : 'bg-surface-700'
              }`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full max-w-xs h-1 bg-surface-800 rounded-full overflow-hidden mb-6">
        <motion.div
          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full"
          animate={{ width: `${Math.min(progress, 95)}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <p className="text-surface-500 text-xs text-center">
        Generating each week separately for maximum detail & reliability
      </p>
    </motion.div>
  );
}
