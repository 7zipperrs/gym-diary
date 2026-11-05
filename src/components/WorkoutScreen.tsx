import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Dumbbell, Plus, Timer, X } from 'lucide-react';
import type { Exercise, Workout, WorkoutSet } from '../types';
import { addSet, db, setVolume } from '../db';
import { formatDate, formatDuration, formatNumber, formatTonnage } from '../lib/format';
import ExercisePicker from './ExercisePicker';

interface Props {
  workout: Workout | null | undefined;
  loading: boolean;
  onStart: () => void;
  onFinish: () => void;
}

const REST_KEY = 'gymdiary.restEnd';
const DEFAULT_REST = 120;

export default function WorkoutScreen({ workout, loading, onStart, onFinish }: Props) {
  const workoutId = workout?.id;
  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [restEnd, setRestEnd] = useState(() => {
    const raw = Number(localStorage.getItem(REST_KEY));
    return Number.isFinite(raw) && raw > Date.now() ? raw : 0;
  });

  const sets = useLiveQuery(
    async () => (workoutId ? db.sets.where('workoutId').equals(workoutId).toArray() : []),
    [workoutId]
  );
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []);

  const previousByExercise = useLiveQuery(async () => {
    const map: Record<number, WorkoutSet[]> = {};
    if (!workoutId) return map;
    const all = await db.sets.toArray();
    const byExercise = new Map<number, WorkoutSet[]>();
    for (const s of all) {
      if (s.workoutId === workoutId) continue;
      const list = byExercise.get(s.exerciseId) ?? [];
      list.push(s);
      byExercise.set(s.exerciseId, list);
    }
    for (const [exerciseId, list] of byExercise) {
      const lastWorkoutId = list.reduce((max, s) => Math.max(max, s.workoutId), 0);
      map[exerciseId] = list
        .filter((s) => s.workoutId === lastWorkoutId)
        .sort((a, b) => a.order - b.order);
    }
    return map;
  }, [workoutId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setExtraIds([]);
  }, [workoutId]);

  const exerciseMap = useMemo(
    () => new Map((exercises ?? []).map((e) => [e.id as number, e])),
    [exercises]
  );

  const orderedIds = useMemo(() => {
    const ids: number[] = [];
    for (const s of sets ?? []) {
      if (!ids.includes(s.exerciseId)) ids.push(s.exerciseId);
    }
    for (const id of extraIds) {
      if (!ids.includes(id)) ids.push(id);
    }
    return ids.filter((id) => exerciseMap.has(id));
  }, [sets, extraIds, exerciseMap]);

  const totalSets = sets?.length ?? 0;
  const tonnage = (sets ?? []).reduce((sum, s) => sum + setVolume(s), 0);

  function startRest() {
    const end = Date.now() + DEFAULT_REST * 1000;
    localStorage.setItem(REST_KEY, String(end));
    setRestEnd(end);
  }

  function stopRest() {
    localStorage.removeItem(REST_KEY);
    setRestEnd(0);
  }

  async function handleAddSet(exerciseId: number, weight: number, reps: number) {
    if (!workoutId) return;
    await addSet({ workoutId, exerciseId, weight, reps });
    startRest();
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-28 animate-pulse rounded-2xl bg-surface" />
        <div className="h-40 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  if (!workout) {
    return (
      <section className="px-5 pt-12 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-accent/20 bg-accent/10 text-accent">
          <Dumbbell size={36} />
        </div>
        <h2 className="mt-6 text-2xl font-semibold">Готов к тренировке?</h2>
        <p className="mx-auto mt-2 max-w-[300px] text-sm leading-relaxed text-muted">
          Записывай подходы прямо в зале. Приложение покажет прошлые результаты и посчитает
          прогресс.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-[15px] font-bold text-bg transition active:scale-[0.98]"
        >
          <Plus size={20} strokeWidth={2.6} />
          Начать тренировку
        </button>
        <div className="mt-8 space-y-2 text-left">
          {[
            'Добавляй упражнения из базы или создавай свои',
            'Вес и повторы подставляются из прошлого раза',
            'Заверши тренировку — прогресс появится в графиках'
          ].map((text) => (
            <div
              key={text}
              className="flex items-start gap-3 rounded-xl border border-line/70 bg-surface/60 p-3"
            >
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <p className="text-[13px] leading-snug text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="px-4 pt-4">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">
              {formatDate(workout.date)} · идёт
            </p>
            <p className="mt-0.5 text-[28px] font-semibold tabular-nums leading-none">
              {formatDuration(now - workout.startedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onFinish}
            className="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-bold text-bg transition active:scale-95"
          >
            Завершить
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-surface2 px-3 py-2">
            <p className="text-[11px] text-muted">Подходы</p>
            <p className="text-base font-semibold tabular-nums">{totalSets}</p>
          </div>
          <div className="rounded-xl bg-surface2 px-3 py-2">
            <p className="text-[11px] text-muted">Тоннаж</p>
            <p className="text-base font-semibold tabular-nums">{formatTonnage(tonnage)}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {orderedIds.length === 0 && (
          <p className="px-1 py-6 text-center text-sm text-muted">
            Добавь первое упражнение, чтобы начать записывать подходы.
          </p>
        )}
        {orderedIds.map((id) => {
          const exercise = exerciseMap.get(id);
          if (!exercise) return null;
          return (
            <ExerciseCard
              key={id}
              exercise={exercise}
              sets={(sets ?? [])
                .filter((s) => s.exerciseId === id)
                .sort((a, b) => a.order - b.order)}
              previous={previousByExercise?.[id] ?? []}
              onAdd={(weight, reps) => handleAddSet(id, weight, reps)}
              onDelete={(setId) => db.sets.delete(setId)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface/40 py-3.5 text-sm font-medium text-muted transition active:scale-[0.99]"
      >
        <Plus size={18} />
        Добавить упражнение
      </button>

      {pickerOpen && (
        <ExercisePicker
          onClose={() => setPickerOpen(false)}
          onPick={(id) => {
            setExtraIds((prev) => [...prev, id]);
            setPickerOpen(false);
          }}
        />
      )}

      <RestTimer end={restEnd} onChange={setRestEnd} onStop={stopRest} />
    </div>
  );
}

interface CardProps {
  exercise: Exercise;
  sets: WorkoutSet[];
  previous: WorkoutSet[];
  onAdd: (weight: number, reps: number) => Promise<void>;
  onDelete: (setId: number) => void;
}

function ExerciseCard({ exercise, sets, previous, onAdd, onDelete }: CardProps) {
  const last = previous[0];
  const [weight, setWeight] = useState(
    last ? formatNumber(last.weight) : exercise.type === 'bodyweight' ? '0' : ''
  );
  const [reps, setReps] = useState(last ? String(last.reps) : '');
  const [saving, setSaving] = useState(false);

  const weightNum = weight.trim() === '' ? 0 : Number(weight.replace(',', '.'));
  const repsNum = reps.trim() === '' ? 0 : Number(reps.replace(',', '.'));
  const valid =
    Number.isFinite(weightNum) &&
    Number.isFinite(repsNum) &&
    repsNum > 0 &&
    (exercise.type !== 'weight' || weightNum > 0);

  async function submit() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onAdd(weightNum, repsNum);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold leading-tight">{exercise.name}</h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
            {exercise.muscleGroup}
          </p>
        </div>
        <span className="rounded-full bg-surface2 px-2 py-0.5 text-[11px] text-muted">
          {sets.length} подх.
        </span>
      </div>

      {previous.length > 0 && (
        <p className="mt-2 truncate text-[12px] text-muted">
          Прошлый раз: {previous.slice(0, 4).map((s) => setLabel(s, exercise)).join(' · ')}
          {previous.length > 4 ? ' …' : ''}
        </p>
      )}

      {sets.length > 0 && (
        <div className="mt-3 divide-y divide-line/60 rounded-xl bg-surface2/60 px-3">
          {sets.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 py-2 text-[13px]">
              <span className="w-4 text-muted tabular-nums">{i + 1}</span>
              <span className="font-medium tabular-nums">{setLabel(s, exercise)}</span>
              <button
                type="button"
                onClick={() => s.id && onDelete(s.id)}
                aria-label="Удалить подход"
                className="ml-auto rounded-md p-1 text-muted transition active:text-danger"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <label className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-3 pr-8 text-center text-[15px] font-semibold tabular-nums outline-none focus:border-accent/60"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">
            кг
          </span>
        </label>
        <span className="text-muted">×</span>
        <label className="relative flex-1">
          <input
            type="number"
            inputMode="numeric"
            min="1"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-line bg-surface2 py-2.5 pl-3 pr-10 text-center text-[15px] font-semibold tabular-nums outline-none focus:border-accent/60"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">
            {exercise.type === 'time' ? 'сек' : 'раз'}
          </span>
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={!valid || saving}
          aria-label="Добавить подход"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-bg transition active:scale-95 disabled:bg-surface2 disabled:text-muted"
        >
          <Plus size={22} strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

function setLabel(s: WorkoutSet, exercise: Exercise): string {
  if (exercise.type === 'time') return `${formatNumber(s.reps)} сек`;
  if (s.weight <= 0) return `× ${formatNumber(s.reps)}`;
  return `${formatNumber(s.weight)} кг × ${formatNumber(s.reps)}`;
}

function RestTimer({
  end,
  onChange,
  onStop
}: {
  end: number;
  onChange: (end: number) => void;
  onStop: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  if (end <= now) return null;
  const left = Math.max(0, Math.ceil((end - now) / 1000));

  function shift(deltaMs: number) {
    const next = Math.max(Date.now() + 1000, end + deltaMs);
    localStorage.setItem(REST_KEY, String(next));
    onChange(next);
  }

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface2 px-4 py-2.5 shadow-lg shadow-black/40">
        <Timer size={18} className="text-accent" />
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted">Отдых</p>
          <p className="text-lg font-semibold tabular-nums leading-none">{formatDuration(left * 1000)}</p>
        </div>
        <button
          type="button"
          onClick={() => shift(-15000)}
          className="rounded-lg bg-surface px-2 py-1.5 text-[11px] font-medium text-muted"
        >
          −15
        </button>
        <button
          type="button"
          onClick={() => shift(15000)}
          className="rounded-lg bg-surface px-2 py-1.5 text-[11px] font-medium text-muted"
        >
          +15
        </button>
        <button
          type="button"
          onClick={onStop}
          aria-label="Пропустить отдых"
          className="rounded-lg p-1.5 text-muted"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
