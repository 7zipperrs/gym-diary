export type ExerciseType = 'weight' | 'bodyweight' | 'time';

export interface Exercise {
  id?: number;
  name: string;
  muscleGroup: string;
  type: ExerciseType;
}

export interface Workout {
  id?: number;
  date: string; // YYYY-MM-DD
  startedAt: number;
  finishedAt?: number;
  name: string;
  note?: string;
}

export interface WorkoutSet {
  id?: number;
  workoutId: number;
  exerciseId: number;
  order: number;
  weight: number;
  reps: number;
  rpe?: number;
  isWarmup: boolean;
  createdAt: number;
}

export interface Template {
  id?: number;
  name: string;
  exerciseIds: number[];
}
