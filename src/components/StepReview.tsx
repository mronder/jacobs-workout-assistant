import { useAppStore } from '../store/useAppStore';
import { WizardLayout } from './WizardLayout';
import { generateWorkoutPlan } from '../services/ai';
import { Pencil } from 'lucide-react';

export function StepReview({ totalSteps }: { totalSteps: number }) {
  const {
    userProfile,
    isGenerating,
    setStep,
    setIsGenerating,
    setGeneratingPhase,
    setGeneratingWeekProgress,
    setWorkoutPlan,
    setError,
  } = useAppStore();

  const handleGenerate = async () => {
    if (isGenerating) return; // double-click protection
    setIsGenerating(true);
    setError(null);
    setGeneratingWeekProgress(null);
    try {
      const plan = await generateWorkoutPlan(userProfile, (phase, weekProgress) => {
        setGeneratingPhase(phase);
        if (weekProgress) setGeneratingWeekProgress(weekProgress);
      });
      setWorkoutPlan(plan);
      setStep(6);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to generate plan. Please try again.');
    } finally {
      setIsGenerating(false);
      setGeneratingPhase('');
      setGeneratingWeekProgress(null);
    }
  };

  const rows: { label: string; value: string; editStep: number }[] = [
    {
      label: 'Biometrics',
      value: `${userProfile.age}y · ${userProfile.gender} · ${userProfile.heightFt}'${userProfile.heightIn}" · ${userProfile.weight} lbs`,
      editStep: 0,
    },
    { label: 'Body Type', value: capitalize(userProfile.bodyType), editStep: 1 },
    {
      label: 'Schedule',
      value: `${userProfile.daysPerWeek} days/week · ${userProfile.workoutDuration} min`,
      editStep: 2,
    },
    { label: 'Program Length', value: `${userProfile.planDurationWeeks} weeks`, editStep: 2 },
    { label: 'Goal', value: capitalize(userProfile.goal.replace(/_/g, ' ')), editStep: 3 },
    { label: 'Split', value: capitalize(userProfile.splitPreference.replace(/_/g, ' ')), editStep: 3 },
    { label: 'Intensity', value: capitalize(userProfile.intensity), editStep: 3 },
    { label: 'Experience', value: capitalize(userProfile.experienceLevel), editStep: 4 },
    { label: 'Injuries', value: userProfile.injuries || 'None', editStep: 4 },
  ];

  return (
    <WizardLayout
      title="Ready to Launch?"
      subtitle="Review your profile, then let Titan build your program."
      currentStep={5}
      totalSteps={totalSteps}
      onBack={() => setStep(4)}
      onNext={handleGenerate}
      nextLabel="Generate My Plan"
      isNextDisabled={isGenerating}
    >
      <div className="bg-surface-800/30 rounded-2xl border border-surface-700/50 divide-y divide-surface-700/30 overflow-hidden">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between px-5 py-3.5 group">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-surface-500 mb-0.5">{row.label}</div>
              <div className="text-sm text-white font-medium truncate">{row.value}</div>
            </div>
            <button
              onClick={() => setStep(row.editStep)}
              className="p-1.5 rounded-lg text-surface-600 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all opacity-0 group-hover:opacity-100"
              title={`Edit ${row.label}`}
              aria-label={`Edit ${row.label}`}
            >
              <Pencil size={14} />
            </button>
          </div>
        ))}
      </div>
    </WizardLayout>
  );
}

function capitalize(s: string): string {
  return s
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
