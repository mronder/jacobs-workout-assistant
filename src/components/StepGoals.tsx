import { useAppStore, type Goal, type Intensity, type Split } from '../store/useAppStore';
import { WizardLayout } from './WizardLayout';
import { cn } from '../lib/utils';
import { Target, Zap, LayoutGrid, Flame, Dumbbell, Shield, Wind, StretchHorizontal } from 'lucide-react';

const goals: { id: Goal; label: string; icon: typeof Flame }[] = [
  { id: 'lose_weight', label: 'Lose Fat', icon: Flame },
  { id: 'build_muscle', label: 'Build Muscle', icon: Dumbbell },
  { id: 'strength', label: 'Pure Strength', icon: Shield },
  { id: 'endurance', label: 'Endurance', icon: Wind },
  { id: 'flexibility', label: 'Mobility', icon: StretchHorizontal },
];

const splits: { id: Split; label: string }[] = [
  { id: 'auto', label: 'Auto (AI Decides)' },
  { id: 'full_body', label: 'Full Body' },
  { id: 'upper_lower', label: 'Upper / Lower' },
  { id: 'ppl', label: 'Push / Pull / Legs' },
  { id: 'body_part', label: 'Body Part Split' },
];

const intensities: { id: Intensity; label: string; rpe: string; color: string }[] = [
  { id: 'low', label: 'Low', rpe: 'RPE 4-5', color: 'emerald' },
  { id: 'medium', label: 'Medium', rpe: 'RPE 6-7', color: 'amber' },
  { id: 'high', label: 'High', rpe: 'RPE 8-9', color: 'red' },
];

export function StepGoals({ totalSteps }: { totalSteps: number }) {
  const { userProfile, updateProfile, setStep } = useAppStore();

  return (
    <WizardLayout
      title="Goals & Strategy"
      subtitle="Define your target, training split, and effort level."
      currentStep={3}
      totalSteps={totalSteps}
      onBack={() => setStep(2)}
      onNext={() => setStep(4)}
    >
      <div className="space-y-8">
        {/* Primary Goal */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <Target size={14} /> Primary Goal
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {goals.map((g) => {
              const Icon = g.icon;
              const isSelected = userProfile.goal === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => updateProfile({ goal: g.id })}
                  className={cn(
                    'flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium border transition-all active:scale-95',
                    isSelected
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                      : 'bg-surface-800/50 text-surface-300 border-surface-700 hover:border-surface-500'
                  )}
                >
                  <Icon size={15} className={isSelected ? 'text-emerald-400' : 'text-surface-500'} />
                  {g.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Split Preference */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <LayoutGrid size={14} /> Workout Split
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {splits.map((s) => (
              <button
                key={s.id}
                onClick={() => updateProfile({ splitPreference: s.id })}
                className={cn(
                  'px-3 py-3 rounded-xl text-sm font-medium border transition-all active:scale-95',
                  userProfile.splitPreference === s.id
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                    : 'bg-surface-800/50 text-surface-300 border-surface-700 hover:border-surface-500'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Intensity */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={14} /> Intensity Level
          </label>
          <div className="grid grid-cols-3 gap-2">
            {intensities.map((i) => {
              const isSelected = userProfile.intensity === i.id;
              return (
                <button
                  key={i.id}
                  onClick={() => updateProfile({ intensity: i.id })}
                  className={cn(
                    'p-4 rounded-xl border text-center transition-all active:scale-95',
                    isSelected
                      ? i.color === 'emerald'
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : i.color === 'amber'
                          ? 'bg-amber-500/10 border-amber-500/40'
                          : 'bg-red-500/10 border-red-500/40'
                      : 'bg-surface-800/50 border-surface-700 hover:border-surface-500'
                  )}
                >
                  <div
                    className={cn(
                      'font-bold text-sm mb-0.5',
                      isSelected
                        ? i.color === 'emerald'
                          ? 'text-emerald-400'
                          : i.color === 'amber'
                            ? 'text-amber-400'
                            : 'text-red-400'
                        : 'text-white'
                    )}
                  >
                    {i.label}
                  </div>
                  <div className="text-[10px] text-surface-500 font-mono">{i.rpe}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </WizardLayout>
  );
}
