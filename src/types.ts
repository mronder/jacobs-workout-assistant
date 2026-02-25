export interface Alternative {
  name: string;
  expertAdvice: string;
  videoSearchQuery: string;
}

export interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  alternatives: Alternative[];
  videoSearchQuery: string;
  expertAdvice: string;
}

export interface WorkoutDay {
  dayNumber: number;
  focus: string;
  exercises: Exercise[];
}

export interface WorkoutWeek {
  weekNumber: number;
  days: WorkoutDay[];
}

export interface WorkoutPlan {
  planName: string;
  splitDescription: string;
  motivationalQuote: string;
  quoteAuthor: string;
  weeks: WorkoutWeek[];
}

export interface TrackedSet {
  weight: number;
  reps: number;
  completed: boolean;
}

export interface TrackedExercise {
  exerciseName: string;
  sets: TrackedSet[];
}

export interface TrackedWorkout {
  weekNumber: number;
  dayNumber: number;
  date: string;
  exercises: TrackedExercise[];
  completed: boolean;
}
