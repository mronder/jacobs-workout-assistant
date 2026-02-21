import { useAppStore } from '../store/useAppStore';
import { WizardLayout } from './WizardLayout';
import { Calendar, Clock, Timer } from 'lucide-react';

export function StepConstraints({ totalSteps }: { totalSteps: number }) {
  const { userProfile, updateProfile, setStep } = useAppStore();

  return (
    <WizardLayout
      title="Your Schedule"
      subtitle="How much time can you dedicate to training?"
      currentStep={2}
      totalSteps={totalSteps}
      onBack={() => setStep(1)}
      onNext={() => setStep(3)}
    >
      <div className="space-y-10">
        {/* Days per week */}
        <SliderField
          icon={<Calendar className="text-emerald-400" size={18} />}
          label="Training Days / Week"
          value={userProfile.daysPerWeek}
          displayValue={`${userProfile.daysPerWeek} days`}
          min={1}
          max={7}
          step={1}
          minLabel="1"
          maxLabel="7"
          onChange={(v) => updateProfile({ daysPerWeek: v })}
          hint={getDayHint(userProfile.daysPerWeek)}
        />

        {/* Duration */}
        <SliderField
          icon={<Clock className="text-emerald-400" size={18} />}
          label="Session Duration"
          value={userProfile.workoutDuration}
          displayValue={`${userProfile.workoutDuration} min`}
          min={15}
          max={120}
          step={5}
          minLabel="15m"
          maxLabel="120m"
          onChange={(v) => updateProfile({ workoutDuration: v })}
        />

        {/* Plan Length */}
        <SliderField
          icon={<Timer className="text-emerald-400" size={18} />}
          label="Program Length"
          value={userProfile.planDurationWeeks}
          displayValue={`${userProfile.planDurationWeeks} weeks`}
          min={4}
          max={8}
          step={1}
          minLabel="4 wk"
          maxLabel="8 wk"
          onChange={(v) => updateProfile({ planDurationWeeks: v })}
        />
      </div>
    </WizardLayout>
  );
}

function getDayHint(days: number): string {
  if (days <= 2) return 'Full Body recommended';
  if (days === 3) return 'Full Body or Upper/Lower works great';
  if (days === 4) return 'Upper/Lower split is ideal';
  if (days === 5) return 'Upper/Lower + Accessory day is ideal';
  return 'Body Part split or Upper/Lower variant';
}

interface SliderFieldProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  onChange: (value: number) => void;
  hint?: string;
}

function SliderField({ icon, label, value, displayValue, min, max, step, minLabel, maxLabel, onChange, hint }: SliderFieldProps) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-white flex items-center gap-2">
          {icon} {label}
        </label>
        <span className="text-xl font-bold text-emerald-400 font-mono tabular-nums">
          {displayValue}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full cursor-pointer"
      />
      <div className="flex justify-between">
        <span className="text-[10px] text-surface-500 font-mono">{minLabel}</span>
        {hint && (
          <span className="text-[10px] text-emerald-500/70 font-medium">{hint}</span>
        )}
        <span className="text-[10px] text-surface-500 font-mono">{maxLabel}</span>
      </div>
    </div>
  );
}
