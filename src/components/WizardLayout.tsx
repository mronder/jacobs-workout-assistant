import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface WizardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  isNextDisabled?: boolean;
}

const stepLabels = ['Basics', 'Build', 'Schedule', 'Goals', 'Health', 'Review'];

export function WizardLayout({
  children,
  title,
  subtitle,
  currentStep,
  totalSteps,
  onBack,
  onNext,
  nextLabel = 'Continue',
  isNextDisabled = false,
}: WizardLayoutProps) {
  // Keyboard nav: Enter = Next (but not when typing in a textarea)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'Enter' && onNext && !isNextDisabled) {
        e.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNext, isNextDisabled]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-2xl"
      >
        {/* ─── Segmented Progress ─────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">
              Step {currentStep + 1} of {totalSteps}
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1 rounded-full flex-1 transition-all duration-500',
                  i <= currentStep
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                    : 'bg-surface-800'
                )}
              />
            ))}
          </div>
          <div className="hidden sm:flex justify-between mt-2">
            {stepLabels.map((label, i) => (
              <span
                key={label}
                className={cn(
                  'text-[10px] font-medium uppercase tracking-wider transition-colors',
                  i <= currentStep ? 'text-emerald-400' : 'text-surface-600'
                )}
              >
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ─── Card ──────────────────────────────────────── */}
        <div className="bg-surface-900/60 backdrop-blur-2xl border border-white/[0.06] rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/30">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-1">{title}</h1>
            {subtitle && <p className="text-surface-400 text-sm sm:text-base">{subtitle}</p>}
          </div>

          {/* Content */}
          <div className="min-h-[280px] flex flex-col justify-center">{children}</div>

          {/* ─── Footer Navigation ──────────────────────── */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/[0.04]">
            <button
              onClick={onBack}
              disabled={!onBack}
              className={cn(
                'px-5 py-2.5 rounded-xl text-surface-400 font-medium transition-all text-sm',
                onBack
                  ? 'hover:text-white hover:bg-white/5 active:scale-95'
                  : 'opacity-0 pointer-events-none'
              )}
            >
              Back
            </button>

            <button
              onClick={onNext}
              disabled={isNextDisabled}
              className={cn(
                'px-7 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95',
                isNextDisabled
                  ? 'bg-surface-700 text-surface-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-900 hover:shadow-lg hover:shadow-emerald-500/20'
              )}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
