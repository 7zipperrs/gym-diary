import Dexie, { type Table } from 'dexie';
import type { Exercise, Template, Workout, WorkoutSet } from './types';
import { SEED_EXERCISES } from './seed';

class GymDB extends Dexie {
  exercises!: Table<Exercise, number>;
  workouts!: Table<Workout, number>;
  sets!: Table<WorkoutSet, number>;
  templates!: Table<Template, number>;

  constructor() {
    super('gymdiary');
    this.version(1).stores({
      exercises: '++id, name, muscleGroup',
      workouts: '++id, date, startedAt, finishedAt',
      sets: '++id, workoutId, exerciseId, [workoutId+exerciseId]',
      templates: '++id, name'
    });

    this.on('populate', () => {
      void this.exercises.bulkAdd(SEED_EXERCISES);
    });
  }
}

export const db = new GymDB();

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function startWorkout(name = 'Тренировка'): Promise<number> {
  return db.workouts.add({
    date: todayISO(),
    startedAt: Date.now(),
    name: name.trim() || 'Тренировка'
  });
}

export async function updateWorkoutName(workoutId: number, name: string): Promise<void> {
  await db.workouts.update(workoutId, { name: name.trim() || 'Тренировка' });
}

export async function updateSet(
  setId: number,
  input: { weight: number; reps: number }
): Promise<void> {
  await db.sets.update(setId, {
    weight: input.weight,
    reps: input.reps
  });
}

export async function finishWorkout(workoutId: number): Promise<void> {
  const setCount = await db.sets.where('workoutId').equals(workoutId).count();
  if (setCount === 0) {
    await db.workouts.delete(workoutId);
    return;
  }
  await db.workouts.update(workoutId, { finishedAt: Date.now() });
}

export async function addExercise(
  name: string,
  muscleGroup = 'Другое',
  type: Exercise['type'] = 'weight'
): Promise<number> {
  const trimmed = name.trim();
  const existing = await db.exercises.where('name').equalsIgnoreCase(trimmed).first();
  if (existing?.id) return existing.id;
  return db.exercises.add({ name: trimmed, muscleGroup, type });
}

export async function addSet(input: {
  workoutId: number;
  exerciseId: number;
  weight: number;
  reps: number;
}): Promise<void> {
  const existing = await db.sets
    .where('[workoutId+exerciseId]')
    .equals([input.workoutId, input.exerciseId])
    .toArray();
  const order = existing.reduce((max, s) => Math.max(max, s.order), 0) + 1;
  await db.sets.add({
    workoutId: input.workoutId,
    exerciseId: input.exerciseId,
    order,
    weight: input.weight,
    reps: input.reps,
    isWarmup: false,
    createdAt: Date.now()
  });
}

export async function getPreviousSets(
  exerciseId: number,
  currentWorkoutId: number
): Promise<WorkoutSet[]> {
  const all = await db.sets.where('exerciseId').equals(exerciseId).toArray();
  const other = all.filter((s) => s.workoutId !== currentWorkoutId);
  if (other.length === 0) return [];
  const lastWorkoutId = other.reduce((max, s) => Math.max(max, s.workoutId), 0);
  return other
    .filter((s) => s.workoutId === lastWorkoutId)
    .sort((a, b) => a.order - b.order);
}

export function setVolume(s: WorkoutSet): number {
  return s.weight * s.reps;
}

export function estimate1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
