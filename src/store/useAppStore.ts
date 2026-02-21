import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Type Definitions ────────────────────────────────────────────────

export type Gender = 'male' | 'female';
export type BodyType = 'slim' | 'average' | 'heavy' | 'athletic';
export type Goal = 'lose_weight' | 'build_muscle' | 'strength' | 'endurance' | 'flexibility';
export type Intensity = 'low' | 'medium' | 'high';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type Split = 'auto' | 'full_body' | 'upper_lower' | 'ppl' | 'body_part';

export interface UserProfile {
  age: number;
  heightFt: number;
  heightIn: number;
  weight: number; // lbs
  gender: Gender;
  bodyType: BodyType;
  daysPerWeek: number;
  workoutDuration: number; // minutes
  planDurationWeeks: number;
  intensity: Intensity;
  goal: Goal;
  splitPreference: Split;
  experienceLevel: ExperienceLevel;
  injuries: string;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  notes: string;
  description: string;
  alternatives: AlternativeExercise[];
}

export interface AlternativeExercise {
  name: string;
  sets?: number;
  reps?: string;
  rest?: string;
  notes?: string;
  description?: string;
}

export interface WorkoutDay {
  dayName: string;
  focus: string;
  warmup: string[];
  exercises: Exercise[];
  cooldown: string[];
}

export interface WorkoutWeek {
  weekNumber: number;
  phaseLabel?: string;
  schedule: WorkoutDay[];
}

export interface WorkoutPlan {
  title: string;
  description: string;
  frequency: string;
  durationWeeks: number;
  weeks: WorkoutWeek[];
}

// ─── Store ───────────────────────────────────────────────────────────

interface AppState {
  step: number;
  userProfile: UserProfile;
  workoutPlan: WorkoutPlan | null;
  isGenerating: boolean;
  generatingPhase: string;
  generatingWeekProgress: { current: number; total: number } | null;
  error: string | null;

  setStep: (step: number) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setWorkoutPlan: (plan: WorkoutPlan) => void;
  setIsGenerating: (isGenerating: boolean) => void;
  setGeneratingPhase: (phase: string) => void;
  setGeneratingWeekProgress: (progress: { current: number; total: number } | null) => void;
  setError: (error: string | null) => void;
  swapExercise: (weekIdx: number, dayIdx: number, exerciseIdx: number, newExercise: AlternativeExercise) => void;
  reset: () => void;
}

const initialProfile: UserProfile = {
  age: 0,
  heightFt: 0,
  heightIn: 0,
  weight: 0,
  gender: 'male',
  bodyType: 'average',
  daysPerWeek: 4,
  workoutDuration: 45,
  planDurationWeeks: 4,
  intensity: 'medium',
  goal: 'build_muscle',
  splitPreference: 'auto',
  experienceLevel: 'intermediate',
  injuries: '',
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      step: 0,
      userProfile: initialProfile,
      workoutPlan: null,
      isGenerating: false,
      generatingPhase: '',
      generatingWeekProgress: null,
      error: null,

      setStep: (step) => set({ step }),

      updateProfile: (updates) =>
        set((state) => ({ userProfile: { ...state.userProfile, ...updates } })),

      setWorkoutPlan: (plan) => set({ workoutPlan: plan }),

      setIsGenerating: (isGenerating) => set({ isGenerating }),

      setGeneratingPhase: (generatingPhase) => set({ generatingPhase }),

      setGeneratingWeekProgress: (generatingWeekProgress) => set({ generatingWeekProgress }),

      setError: (error) => set({ error }),

      swapExercise: (weekIdx, dayIdx, exerciseIdx, newExercise) =>
        set((state) => {
          if (!state.workoutPlan) return state;
          const plan = structuredClone(state.workoutPlan);
          const currentExercise = plan.weeks[weekIdx].schedule[dayIdx].exercises[exerciseIdx];
          // Inherit sets/reps/rest from original if alternative only has name
          const swappedIn: Exercise = {
            name: newExercise.name,
            sets: newExercise.sets ?? currentExercise.sets,
            reps: newExercise.reps ?? currentExercise.reps,
            rest: newExercise.rest ?? currentExercise.rest,
            notes: newExercise.notes ?? currentExercise.notes,
            description: newExercise.description ?? currentExercise.description,
            alternatives: [
              {
                name: currentExercise.name,
                sets: currentExercise.sets,
                reps: currentExercise.reps,
                rest: currentExercise.rest,
                notes: currentExercise.notes,
                description: currentExercise.description,
              },
              ...currentExercise.alternatives.filter((a) => a.name !== newExercise.name),
            ],
          };
          plan.weeks[weekIdx].schedule[dayIdx].exercises[exerciseIdx] = swappedIn;
          return { workoutPlan: plan };
        }),

      reset: () =>
        set({
          step: 0,
          userProfile: initialProfile,
          workoutPlan: null,
          isGenerating: false,
          generatingPhase: '',
          generatingWeekProgress: null,
          error: null,
        }),
    }),
    {
      name: 'titan-ai-trainer',
      partialize: (state) => ({
        step: state.step,
        userProfile: state.userProfile,
        workoutPlan: state.workoutPlan,
      }),
    }
  )
);
