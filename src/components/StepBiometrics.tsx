import { useAppStore } from '../store/useAppStore';
import { WizardLayout } from './WizardLayout';
import { Ruler, Weight, User, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';
import type { Gender } from '../store/useAppStore';

/**
 * Controlled number input that starts empty, lets the user type freely,
 * and only commits the clamped value to the store on blur.
 */
function NumberField({
  value,
  onChange,
  min,
  max,
  placeholder,
  className,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  placeholder: string;
  className?: string;
  suffix?: string;
}) {
  // Local string to allow empty / partial input while typing
  const [local, setLocal] = useState<string>('');
  const [focused, setFocused] = useState(false);

  const display = focused ? local : value ? String(value) : '';

  const handleFocus = () => {
    setLocal(value ? String(value) : '');
    setFocused(true);
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseInt(local, 10);
    if (isNaN(parsed) || local.trim() === '') return; // leave store value as-is
    let clamped = parsed;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    onChange(clamped);
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={display}
        placeholder={placeholder}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(e) => {
          const raw = e.target.value.replace(/[^0-9]/g, '');
          setLocal(raw);
        }}
        className={cn(
          'w-full bg-surface-800/50 border border-surface-700 rounded-xl px-4 py-3 text-white font-mono text-lg focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all',
          suffix && 'pr-12',
          className
        )}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 text-sm font-medium pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
}

export function StepBiometrics({ totalSteps }: { totalSteps: number }) {
  const { userProfile, updateProfile, setStep } = useAppStore();

  const genders: { id: Gender; label: string }[] = [
    { id: 'male', label: 'Male' },
    { id: 'female', label: 'Female' },
  ];

  const isValid = userProfile.age > 0 && userProfile.heightFt > 0 && userProfile.weight > 0;

  return (
    <WizardLayout
      title="The Basics"
      subtitle="Let's calibrate your baseline metrics."
      currentStep={0}
      totalSteps={totalSteps}
      onNext={() => setStep(1)}
      isNextDisabled={!isValid}
    >
      <div className="space-y-6">
        {/* Gender Pills */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <User size={14} /> Gender
          </label>
          <div className="flex gap-2">
            {genders.map((g) => (
              <button
                key={g.id}
                onClick={() => updateProfile({ gender: g.id })}
                className={cn(
                  'flex-1 py-3 rounded-xl text-sm font-semibold border transition-all active:scale-95',
                  userProfile.gender === g.id
                    ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                    : 'bg-surface-800/50 border-surface-700 text-surface-300 hover:border-surface-500'
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Age */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={14} /> Age
          </label>
          <NumberField
            value={userProfile.age}
            onChange={(v) => updateProfile({ age: v })}
            min={13}
            max={99}
            placeholder="Age"
            className="text-center"
          />
        </div>

        {/* Height */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <Ruler size={14} /> Height
          </label>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              value={userProfile.heightFt}
              onChange={(v) => updateProfile({ heightFt: v })}
              min={3}
              max={8}
              placeholder="Feet"
              suffix="ft"
            />
            <NumberField
              value={userProfile.heightIn}
              onChange={(v) => updateProfile({ heightIn: v })}
              min={0}
              max={11}
              placeholder="Inches"
              suffix="in"
            />
          </div>
        </div>

        {/* Weight */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
            <Weight size={14} /> Weight
          </label>
          <NumberField
            value={userProfile.weight}
            onChange={(v) => updateProfile({ weight: v })}
            min={50}
            max={700}
            placeholder="Weight"
            suffix="lbs"
            className="text-center"
          />
        </div>
      </div>
    </WizardLayout>
  );
}
