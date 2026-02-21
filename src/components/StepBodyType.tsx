import { useAppStore, type BodyType } from '../store/useAppStore';
import { WizardLayout } from './WizardLayout';
import { cn } from '../lib/utils';
import { Flame, Dumbbell, Scale, Zap } from 'lucide-react';

const types: { id: BodyType; label: string; desc: string; bestFor: string; icon: typeof Flame }[] = [
  {
    id: 'slim',
    label: 'Ectomorph / Slim',
    desc: 'Naturally lean, fast metabolism, hard to gain weight.',
    bestFor: 'Hypertrophy & Strength',
    icon: Zap,
  },
  {
    id: 'average',
    label: 'Mesomorph / Average',
    desc: 'Moderate build, gains muscle and loses fat relatively easily.',
    bestFor: 'Balanced Programming',
    icon: Scale,
  },
  {
    id: 'heavy',
    label: 'Endomorph / Heavy',
    desc: 'Broader frame, gains weight easily, higher body fat.',
    bestFor: 'Fat Loss & Conditioning',
    icon: Flame,
  },
  {
    id: 'athletic',
    label: 'Athletic',
    desc: 'Already muscular with low body fat, sport-specific training background.',
    bestFor: 'Performance & Progression',
    icon: Dumbbell,
  },
];

export function StepBodyType({ totalSteps }: { totalSteps: number }) {
  const { userProfile, updateProfile, setStep } = useAppStore();

  return (
    <WizardLayout
      title="Current Build"
      subtitle="How would you describe your physique right now?"
      currentStep={1}
      totalSteps={totalSteps}
      onBack={() => setStep(0)}
      onNext={() => setStep(2)}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {types.map((type) => {
          const Icon = type.icon;
          const isSelected = userProfile.bodyType === type.id;
          return (
            <button
              key={type.id}
              onClick={() => updateProfile({ bodyType: type.id })}
              className={cn(
                'relative p-5 rounded-2xl border-2 text-left transition-all duration-200 group active:scale-[0.98]',
                isSelected
                  ? 'border-emerald-500/60 bg-emerald-500/[0.08]'
                  : 'border-surface-700/60 bg-surface-800/40 hover:border-surface-500/60'
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
                    isSelected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-surface-700/50 text-surface-400'
                  )}
                >
                  <Icon size={18} />
                </div>
                <span
                  className={cn(
                    'font-semibold text-base transition-colors',
                    isSelected ? 'text-emerald-400' : 'text-white'
                  )}
                >
                  {type.label}
                </span>
              </div>
              <p className="text-xs text-surface-400 leading-relaxed mb-2">{type.desc}</p>
              <div
                className={cn(
                  'text-[10px] font-mono uppercase tracking-wider',
                  isSelected ? 'text-emerald-500/70' : 'text-surface-500'
                )}
              >
                Best for: {type.bestFor}
              </div>

              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              )}
            </button>
          );
        })}
      </div>
    </WizardLayout>
  );
}
