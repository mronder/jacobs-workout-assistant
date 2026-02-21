import { useAppStore } from './store/useAppStore';
import { StepBiometrics } from './components/StepBiometrics';
import { StepBodyType } from './components/StepBodyType';
import { StepConstraints } from './components/StepConstraints';
import { StepGoals } from './components/StepGoals';
import { StepHistory } from './components/StepHistory';
import { StepReview } from './components/StepReview';
import { PlanDisplay } from './components/PlanDisplay';
import { GeneratingScreen } from './components/GeneratingScreen';
import { AnimatePresence, motion } from 'motion/react';

const TOTAL_STEPS = 6;

export default function App() {
  const { step, isGenerating, error, setError } = useAppStore();

  return (
    <div className="min-h-screen bg-surface-950 text-white font-sans selection:bg-emerald-500/30">
      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-md w-full mx-4"
          >
            <div className="bg-red-500/10 border border-red-500/30 backdrop-blur-xl rounded-2xl px-5 py-4 flex items-start gap-3">
              <span className="text-red-400 text-sm flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-white transition-colors text-sm font-medium shrink-0"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generating Overlay */}
      <AnimatePresence>
        {isGenerating && <GeneratingScreen />}
      </AnimatePresence>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full"
        >
          {step === 0 && <StepBiometrics totalSteps={TOTAL_STEPS} />}
          {step === 1 && <StepBodyType totalSteps={TOTAL_STEPS} />}
          {step === 2 && <StepConstraints totalSteps={TOTAL_STEPS} />}
          {step === 3 && <StepGoals totalSteps={TOTAL_STEPS} />}
          {step === 4 && <StepHistory totalSteps={TOTAL_STEPS} />}
          {step === 5 && <StepReview totalSteps={TOTAL_STEPS} />}
          {step === 6 && <PlanDisplay />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
