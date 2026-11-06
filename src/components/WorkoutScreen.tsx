import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BellRing, Check, Dumbbell, Pencil, Plus, Timer, X } from 'lucide-react';
import type { Exercise, Workout, WorkoutSet } from '../types';
import {
  addSet,
  db,
  setVolume,
  todayISO,
  updateSet,
  updateWorkoutName
} from '../db';
import {
  WORKOUT_PRESETS,
  formatDate,
  formatDuration,
  formatNumber,
  formatTonnage
} from '../lib/format';
import { playRestFinishedChime, unlockAudio } from '../lib/sound';
import ExercisePicker from './ExercisePicker';

interface Props {
  workout: Workout | null | undefined;
  loading: boolean;
  onStart: (name?: string) => void;
  onFinish: () => void;
}

const REST_KEY = 'gymdiary.restEnd';
const DEFAULT_REST = 120;

export default function WorkoutScreen({ workout, loading, onStart, onFinish }: Props) {
  const workoutId = workout?.id;
  const [startName, setStartName] = useState('');
  const [workoutTitle, setWorkoutTitle] = useState(workout?.name ?? '');
  const [extraIds, setExtraIds] = useState<number[]>([]);
  const [doneIds, setDoneIds] = useState<number[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [restEnd, setRestEnd] = useState(() => {
    const raw = Number(localStorage.getItem(REST_KEY));
    return Number.isFinite(raw) && raw > Date.now() - 15 * 60 * 1000 ? raw : 0;
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
    setWorkoutTitle(workout?.name ?? '');
    if (workoutId) {
      try {
        const saved = JSON.parse(
          localStorage.getItem(`gymdiary.done.${workoutId}`) ?? '[]'
        );
        setDoneIds(Array.isArray(saved) ? saved : []);
      } catch {
        setDoneIds([]);
      }
    } else {
      setDoneIds([]);
    }
  }, [workoutId, workout?.name]);

  function toggleExerciseDone(exerciseId: number) {
    setDoneIds((prev) => {
      const next = prev.includes(exerciseId)
        ? prev.filter((id) => id !== exerciseId)
        : [...prev, exerciseId];
      if (workoutId) {
        localStorage.setItem(`gymdiary.done.${workoutId}`, JSON.stringify(next));
      }
      return next;
    });
  }

  async function saveTitle(nextTitle: string) {
    setWorkoutTitle(nextTitle);
    if (workoutId) {
      await updateWorkoutName(workoutId, nextTitle);
    }
  }

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
      <section className="px-5 pt-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-accent/20 bg-accent/10 text-accent">
            <Dumbbell size={32} />
          </div>
          <p className="mt-4 text-[11px] font-medium uppercase tracking-wider text-muted">
            {formatDate(todayISO())}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Новая тренировка</h2>
        </div>

        <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-muted">
            Название тренировки
          </label>
          <input
            value={startName}
            onChange={(e) => setStartName(e.target.value)}
            placeholder="Например: Грудь, трицепс"
            className="mt-1.5 w-full rounded-xl border border-line bg-surface2 px-3.5 py-2.5 text-[15px] font-medium outline-none placeholder:text-muted/60 focus:border-accent/60"
          />
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {WORKOUT_PRESETS.map((preset) => {
              const active = startName.trim().toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setStartName(preset)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
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
        </div>

        <button
          type="button"
          onClick={() => onStart(startName.trim() || 'Тренировка')}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-[15px] font-bold text-bg transition active:scale-[0.98]"
        >
          <Plus size={20} strokeWidth={2.6} />
          Начать тренировку
        </button>
      </section>
    );
  }

  return (
    <div className="px-4 pb-24 pt-4">
      <div className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-muted">
              {formatDate(workout.date)} · идёт
            </p>
            <p className="mt-0.5 text-[28px] font-semibold tabular-nums leading-none">
              {formatDuration(now - workout.startedAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex items-center gap-1 rounded-xl border border-line bg-surface2 px-3 py-2.5 text-[13px] font-semibold transition active:scale-95"
            >
              <Plus size={16} className="text-accent" />
              Упражнение
            </button>
            <button
              type="button"
              onClick={onFinish}
              className="rounded-xl bg-accent px-4 py-2.5 text-[13px] font-bold text-bg transition active:scale-95"
            >
              Завершить
            </button>
          </div>
        </div>

        <div className="mt-3">
          <input
            value={workoutTitle}
            onChange={(e) => setWorkoutTitle(e.target.value)}
            onBlur={() => void saveTitle(workoutTitle)}
            placeholder="Название тренировки (например: Грудь, трицепс)"
            className="w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-[14px] font-semibold outline-none placeholder:font-normal placeholder:text-muted/60 focus:border-accent/60"
          />
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-0.5">
            {WORKOUT_PRESETS.map((preset) => {
              const active = workoutTitle.trim().toLowerCase() === preset.toLowerCase();
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
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
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
              done={doneIds.includes(id)}
              onToggleDone={() => toggleExerciseDone(id)}
              sets={(sets ?? [])
                .filter((s) => s.exerciseId === id)
                .sort((a, b) => a.order - b.order)}
              previous={previousByExercise?.[id] ?? []}
              onAdd={(weight, reps) => handleAddSet(id, weight, reps)}
              onUpdate={(setId, weight, reps) => updateSet(setId, { weight, reps })}
              onDelete={(setId) => db.sets.delete(setId)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface/60 py-3.5 text-sm font-medium text-muted transition active:scale-[0.99]"
      >
        <Plus size={18} className="text-accent" />
        Добавить упражнение
      </button>

      {pickerOpen && (
        <ExercisePicker
          workoutId={workoutId}
          workoutName={workoutTitle}
          alreadyAddedIds={orderedIds}
          onClose={() => setPickerOpen(false)}
          onPick={(id) => {
            setExtraIds((prev) => [...prev, id]);
            // Если упражнение было помечено завершённым, разворачиваем его
            setDoneIds((prev) => prev.filter((item) => item !== id));
            setPickerOpen(false);
            setTimeout(() => {
              document
                .getElementById(`exercise-card-${id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 80);
          }}
        />
      )}

      <RestTimer end={restEnd} onChange={setRestEnd} onStop={stopRest} />
    </div>
  );
}

interface CardProps {
  exercise: Exercise;
  done: boolean;
  onToggleDone: () => void;
  sets: WorkoutSet[];
  previous: WorkoutSet[];
  onAdd: (weight: number, reps: number) => Promise<void>;
  onUpdate: (setId: number, weight: number, reps: number) => Promise<void>;
  onDelete: (setId: number) => void;
}

function ExerciseCard({
  exercise,
  done,
  onToggleDone,
  sets,
  previous,
  onAdd,
  onUpdate,
  onDelete
}: CardProps) {
  const last = previous[0];
  const [weight, setWeight] = useState(
    last ? formatNumber(last.weight) : exercise.type === 'bodyweight' ? '0' : ''
  );
  const [reps, setReps] = useState(last ? String(last.reps) : '');
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');

  const weightNum = weight.trim() === '' ? 0 : Number(weight.replace(',', '.'));
  const repsNum = reps.trim() === '' ? 0 : Number(reps.replace(',', '.'));
  const valid =
    Number.isFinite(weightNum) &&
    Number.isFinite(repsNum) &&
    repsNum > 0 &&
    (exercise.type !== 'weight' || weightNum > 0);

  async function submit() {
    if (!valid || saving) return;
    unlockAudio();
    setSaving(true);
    try {
      await onAdd(weightNum, repsNum);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(s: WorkoutSet) {
    if (!s.id) return;
    setEditingId(s.id);
    setEditWeight(formatNumber(s.weight));
    setEditReps(formatNumber(s.reps));
  }

  async function saveEdit(setId: number) {
    const w =
      exercise.type === 'time'
        ? 0
        : editWeight.trim() === ''
          ? 0
          : Number(editWeight.replace(',', '.'));
    const r = editReps.trim() === '' ? 0 : Number(editReps.replace(',', '.'));
    if (!Number.isFinite(w) || !Number.isFinite(r) || r <= 0) return;
    if (exercise.type === 'weight' && w <= 0) return;
    await onUpdate(setId, w, r);
    setEditingId(null);
  }

  return (
    <div
      id={`exercise-card-${exercise.id}`}
      className={`rounded-2xl border p-4 transition ${
        done ? 'border-accent/40 bg-surface/75' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-semibold leading-tight">{exercise.name}</h3>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted">
            {exercise.muscleGroup} · {sets.length} подх.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleDone}
          aria-label={done ? 'Развернуть упражнение' : 'Завершить упражнение'}
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition active:scale-95 ${
            done
              ? 'bg-accent text-bg'
              : 'border border-line bg-surface2 text-muted'
          }`}
        >
          <Check size={13} strokeWidth={2.6} />
          {done ? 'Готово' : 'Завершить'}
        </button>
      </div>

      {!done && previous.length > 0 && (
        <p className="mt-2 truncate text-[12px] text-muted">
          Прошлый раз: {previous.slice(0, 4).map((s) => setLabel(s, exercise)).join(' · ')}
          {previous.length > 4 ? ' …' : ''}
        </p>
      )}

      {sets.length > 0 && (
        <div className="mt-3 divide-y divide-line/60 rounded-xl bg-surface2/60 px-3">
          {sets.map((s, i) => {
            const isEditing = editingId === s.id;
            return (
              <div key={s.id} className="flex items-center gap-2 py-2 text-[13px]">
                <span className="w-4 shrink-0 text-muted tabular-nums">{i + 1}</span>

                {isEditing ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    {exercise.type !== 'time' && (
                      <>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            min="0"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            className="w-full rounded-lg border border-accent/60 bg-bg py-1.5 pl-2 pr-6 text-center text-[14px] font-semibold tabular-nums outline-none"
                          />
                          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">
                            кг
                          </span>
                        </div>
                        <span className="text-muted">×</span>
                      </>
                    )}
                    <div className="relative flex-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="1"
                        value={editReps}
                        onChange={(e) => setEditReps(e.target.value)}
                        className="w-full rounded-lg border border-accent/60 bg-bg py-1.5 pl-2 pr-7 text-center text-[14px] font-semibold tabular-nums outline-none"
                      />
                      <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted">
                        {exercise.type === 'time' ? 'сек' : 'раз'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => s.id && void saveEdit(s.id)}
                      aria-label="Сохранить изменения подхода"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-bg"
                    >
                      <Check size={15} strokeWidth={2.8} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="Отменить редактирование"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-muted"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="flex flex-1 items-center gap-1.5 text-left font-medium tabular-nums"
                    >
                      <span>{setLabel(s, exercise)}</span>
                      <Pencil size={12} className="text-muted/60" />
                    </button>
                    <button
                      type="button"
                      onClick={() => s.id && onDelete(s.id)}
                      aria-label="Удалить подход"
                      className="ml-auto rounded-md p-1 text-muted transition active:text-danger"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!done && (
        <div className="mt-3 flex items-center gap-2">
          {exercise.type !== 'time' && (
            <>
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
            </>
          )}
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
      )}
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
  const beepedForEndRef = useRef<number>(end <= Date.now() ? end : 0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (end > 0 && now >= end && beepedForEndRef.current !== end) {
      beepedForEndRef.current = end;
      playRestFinishedChime();
    }
  }, [end, now]);

  if (end <= 0) return null;

  const isFinished = now >= end;
  const left = Math.max(0, Math.ceil((end - now) / 1000));
  const overtime = Math.max(0, Math.floor((now - end) / 1000));

  function shift(deltaMs: number) {
    unlockAudio();
    const base = end > Date.now() ? end : Date.now();
    const next = Math.max(Date.now() + 1000, base + deltaMs);
    localStorage.setItem(REST_KEY, String(next));
    onChange(next);
  }

  if (isFinished) {
    return (
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-accent bg-accent px-4 py-3 text-bg shadow-lg shadow-accent/25">
          <BellRing size={20} className="shrink-0 animate-bounce" />
          <div className="flex-1">
            <p className="text-[13px] font-extrabold uppercase tracking-wide leading-tight">
              Пора в подход!
            </p>
            <p className="text-[11px] font-semibold tabular-nums opacity-80">
              Отдых окончен · +{formatDuration(overtime * 1000)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => shift(30000)}
            className="rounded-xl bg-bg/15 px-3 py-1.5 text-[12px] font-bold text-bg transition active:scale-95"
          >
            +30 сек
          </button>
          <button
            type="button"
            onClick={onStop}
            className="rounded-xl bg-bg px-3.5 py-1.5 text-[12px] font-bold text-accent transition active:scale-95"
          >
            Ок
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+72px)] left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 px-4">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface2 px-4 py-2.5 shadow-lg shadow-black/40">
        <Timer size={18} className="text-accent" />
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-wider text-muted">Отдых</p>
          <p className="text-lg font-semibold tabular-nums leading-none">
            {formatDuration(left * 1000)}
          </p>
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
