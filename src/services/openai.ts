import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { WorkoutPlan } from '../types';

// Zod schemas for structured output
const AlternativeSchema = z.object({
  name: z.string(),
  expertAdvice: z.string(),
  videoSearchQuery: z.string(),
});

const ExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().int(),
  reps: z.string(),
  rest: z.string(),
  alternatives: z.array(AlternativeSchema),
  videoSearchQuery: z.string(),
  expertAdvice: z.string(),
});

const WorkoutDaySchema = z.object({
  dayNumber: z.number().int(),
  focus: z.string(),
  exercises: z.array(ExerciseSchema),
});

const PlanResponseSchema = z.object({
  planName: z.string(),
  splitDescription: z.string(),
  motivationalQuote: z.string(),
  quoteAuthor: z.string(),
  days: z.array(WorkoutDaySchema),
});

export async function generateWorkoutPlan(
  daysPerWeek: number,
  goal: string,
  level: string
): Promise<WorkoutPlan> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true,
  });

  const prompt = `Act as an elite personal trainer. Create a 1-week workout template for a ${level} individual whose goal is ${goal}. They train ${daysPerWeek} days/week.

RULES:
1. Use PROVEN splits:
   - 3 Days: Full Body (3x) or Push/Pull/Legs
   - 4 Days: Condensed Bro Split or Upper/Lower (2x)
   - 5 Days: Bro Split or Upper/Lower/PPL
   - 6 Days: Push/Pull/Legs (2x) or Extended Bro Split.
   Stick to these. No weird hybrids.
2. Each day: MINIMUM 6 exercises.
3. 2 alternatives per exercise with YouTube search queries and expert advice.
4. Expert advice = practical form cues (body position, where to feel tension, mistakes to avoid). No silly analogies. Plain English.
5. Each day's focus explains the goal and why the split works.
6. Include a real motivational quote from a famous person (Ali, Arnold, Marcus Aurelius, etc.) with their name.`;

  const completion = await client.beta.chat.completions.parse({
    model: 'gpt-4.1-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert personal trainer and exercise scientist. Return structured workout plans. Be concise but thorough with form cues.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: zodResponseFormat(PlanResponseSchema, 'workout_plan'),
    temperature: 0.7,
  });

  const message = completion.choices[0]?.message;

  if (!message?.parsed) {
    throw new Error('Failed to generate workout plan');
  }

  const data = message.parsed;

  // Map parsed data to our strict types and duplicate into 4-week plan
  const days = data.days.map((d) => ({
    dayNumber: d.dayNumber!,
    focus: d.focus!,
    exercises: d.exercises!.map((ex) => ({
      name: ex.name!,
      sets: ex.sets!,
      reps: ex.reps!,
      rest: ex.rest!,
      videoSearchQuery: ex.videoSearchQuery!,
      expertAdvice: ex.expertAdvice!,
      alternatives: ex.alternatives!.map((alt) => ({
        name: alt.name!,
        expertAdvice: alt.expertAdvice!,
        videoSearchQuery: alt.videoSearchQuery!,
      })),
    })),
  }));

  const weeks = [1, 2, 3, 4].map((weekNum) => ({
    weekNumber: weekNum,
    days,
  }));

  return {
    planName: data.planName!,
    splitDescription: data.splitDescription!,
    motivationalQuote: data.motivationalQuote!,
    quoteAuthor: data.quoteAuthor!,
    weeks,
  } satisfies WorkoutPlan;
}
