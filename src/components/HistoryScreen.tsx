import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ChevronRight, Clock, Layers, Trash2, Weight } from 'lucide-react';
import type { Exercise, Workout, WorkoutSet } from '../types';
import { db, setVolume, updateWorkoutName } from '../db';
import {
  WORKOUT_PRESETS,
  formatDate,
  formatDuration,
  formatNumber,
  formatTonnage
} from '../lib/format';

interface HistoryItem {
  workout: Workout;
  sets: WorkoutSet[];
  volume: number;
  exerciseCount: number;
  exerciseNames: string[];
}

export default function HistoryScreen() {
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const data = useLiveQuery(async () => {
    const [workouts, sets, exercises] = await Promise.all([
      db.workouts.orderBy('startedAt').reverse().toArray(),
      db.sets.toArray(),
      db.exercises.toArray()
    ]);

    const exerciseMap = new Map<number, Exercise>(
      exercises.map((e) => [e.id as number, e])
    );
    const setsByWorkout = new Map<number, WorkoutSet[]>();
    for (const s of sets) {
      const list = setsByWorkout.get(s.workoutId) ?? [];
      list.push(s);
      setsByWorkout.set(s.workoutId, list);
    }

    const items: HistoryItem[] = workouts
      .filter((w) => Boolean(w.finishedAt))
      .map((w) => {
        const ws = (setsByWorkout.get(w.id as number) ?? []).sort(
          (a, b) => a.order - b.order
        );
        const uniqueExerciseIds = [...new Set(ws.map((s) => s.exerciseId))];
        const exerciseNames = uniqueExerciseIds
          .map((id) => exerciseMap.get(id)?.name)
          .filter((n): n is string => Boolean(n));
        return {
          workout: w,
          sets: ws,
          volume: ws.reduce((sum, s) => sum + setVolume(s), 0),
          exerciseCount: uniqueExerciseIds.length,
          exerciseNames
        };
      });

    return { items, exerciseMap };
  }, []);

  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-20 animate-pulse rounded-2xl bg-surface" />
        <div className="h-20 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  const selected = data.items.find((i) => i.workout.id === selectedId);

  if (selected) {
    return (
      <WorkoutDetails
        item={selected}
        exerciseMap={data.exerciseMap}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="p-4">
      <h2 className="px-1 pb-3 text-[13px] font-medium uppercase tracking-wider text-muted">
        Завершённые тренировки
      </h2>

      {data.items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-8 text-center">
          <p className="text-sm text-muted">Пока нет завершённых тренировок.</p>
          <p className="mt-1 text-xs text-muted/70">
            Начни тренировку на первой вкладке — она появится здесь.
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {data.items.map((item) => {
          const w = item.workout;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => setSelectedId(w.id as number)}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-accent">
                  {formatDate(w.date)}
                </p>
                <p className="mt-0.5 truncate text-[16px] font-semibold">{w.name}</p>
                {item.exerciseNames.length > 0 && (
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {item.exerciseNames.join(' · ')}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-3 text-[12px] text-muted">
                  <span className="flex items-center gap-1">
                    <Layers size={13} /> {item.sets.length} подх.
                  </span>
                  <span className="flex items-center gap-1">
                    <Weight size={13} /> {formatTonnage(item.volume)}
                  </span>
                  {w.finishedAt && (
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> {formatDuration(w.finishedAt - w.startedAt)}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WorkoutDetails({
  item,
  exerciseMap,
  onBack
}: {
  item: HistoryItem;
  exerciseMap: Map<number, Exercise>;
  onBack: () => void;
}) {
  const { workout, sets } = item;
  const [title, setTitle] = useState(workout.name);

  const groups = new Map<number, WorkoutSet[]>();
  for (const s of sets) {
    const list = groups.get(s.exerciseId) ?? [];
    list.push(s);
    groups.set(s.exerciseId, list);
  }

  async function saveTitle(next: string) {
    setTitle(next);
    if (workout.id) {
      await updateWorkoutName(workout.id, next);
    }
  }

  async function remove() {
    if (!workout.id) return;
    if (!window.confirm('Удалить тренировку и все её подходы?')) return;
    await db.sets.where('workoutId').equals(workout.id).delete();
    await db.workouts.delete(workout.id);
    onBack();
  }

  return (
    <div className="p-4">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-muted"
      >
        <ArrowLeft size={16} /> Назад
      </button>

      <div className="rounded-2xl border border-line bg-surface p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-accent">
          {formatDate(workout.date)}
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle(title)}
          placeholder="Название тренировки"
          className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-[16px] font-semibold outline-none focus:border-accent/60"
        />
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {WORKOUT_PRESETS.map((preset) => {
            const active = title.trim().toLowerCase() === preset.toLowerCase();
            return (
              <button
                key={preset}
                type="button"
                onClick={() => void saveTitle(preset)}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                  active
                    ? 'bg-accent text-bg'
                    : 'border border-line bg-surface2 text-muted'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Подходы" value={String(item.sets.length)} />
          <Stat label="Тоннаж" value={formatTonnage(item.volume)} />
          <Stat
            label="Время"
            value={
              workout.finishedAt
                ? formatDuration(workout.finishedAt - workout.startedAt)
                : '—'
            }
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {[...groups.entries()].map(([exerciseId, exerciseSets]) => {
          const exercise = exerciseMap.get(exerciseId);
          if (!exercise) return null;
          const volume = exerciseSets.reduce((sum, s) => sum + setVolume(s), 0);
          return (
            <div key={exerciseId} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold">{exercise.name}</h3>
                <span className="text-[12px] text-muted">{formatTonnage(volume)}</span>
              </div>
              <div className="mt-2 space-y-1">
                {exerciseSets.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 text-[13px]">
                    <span className="w-4 text-muted tabular-nums">{i + 1}</span>
                    <span className="tabular-nums">
                      {s.weight > 0
                        ? `${formatNumber(s.weight)} кг × ${formatNumber(s.reps)}`
                        : `${formatNumber(s.reps)} ${
                            exercise.type === 'time' ? 'сек' : 'повт.'
                          }`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={remove}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 py-3 text-sm font-medium text-danger"
      >
        <Trash2 size={16} /> Удалить тренировку
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface2 px-2 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-[13px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}
