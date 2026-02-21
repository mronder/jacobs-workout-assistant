import { useAppStore, type ExperienceLevel } from '../store/useAppStore';
import { WizardLayout } from './WizardLayout';
import { cn } from '../lib/utils';
import { AlertCircle, Award } from 'lucide-react';

const levels: { id: ExperienceLevel; label: string; desc: string }[] = [
  { id: 'beginner', label: 'Beginner', desc: '< 6 months consistent training' },
  { id: 'intermediate', label: 'Intermediate', desc: '6 months – 2 years of training' },
  { id: 'advanced', label: 'Advanced', desc: '2+ years of structured programming' },
];

export function StepHistory({ totalSteps }: { totalSteps: number }) {
  const { userProfile, updateProfile, setStep } = useAppStore();

  return (
    <WizardLayout
      title="Experience & Health"
      subtitle="Help us keep your program safe and effective."
      currentStep={4}
      totalSteps={totalSteps}
      onBack={() => setStep(3)}
      onNext={() => setStep(5)}
    >
      <div className="space-y-8">
        {/* Experience Level */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <Award size={14} /> Training Experience
          </label>
          <div className="space-y-2">
            {levels.map((level) => {
              const isSelected = userProfile.experienceLevel === level.id;
              return (
                <button
                  key={level.id}
                  onClick={() => updateProfile({ experienceLevel: level.id })}
                  className={cn(
                    'w-full flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.99]',
                    isSelected
                      ? 'bg-emerald-500/[0.08] border-emerald-500/40'
                      : 'bg-surface-800/40 border-surface-700/60 hover:border-surface-500'
                  )}
                >
                  <div className="text-left">
                    <div className={cn('font-semibold text-sm', isSelected ? 'text-emerald-400' : 'text-white')}>
                      {level.label}
                    </div>
                    <div className="text-xs text-surface-500 mt-0.5">{level.desc}</div>
                  </div>
                  {isSelected && (
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Injuries */}
        <div className="space-y-3">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertCircle size={14} /> Injuries or Limitations
          </label>
          <textarea
            value={userProfile.injuries}
            onChange={(e) => updateProfile({ injuries: e.target.value })}
            placeholder="e.g., Lower back pain, bad left knee, rotator cuff issue, recently had ACL surgery..."
            className="w-full h-28 bg-surface-800/50 border border-surface-700 rounded-xl p-4 text-white text-sm placeholder:text-surface-600 focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all resize-none"
          />
          <p className="text-[11px] text-surface-500">
            Leave blank if no injuries. The AI will avoid exercises that stress these areas and provide safer alternatives.
          </p>
        </div>
      </div>
    </WizardLayout>
  );
}
