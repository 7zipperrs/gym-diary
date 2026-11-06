import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Check, History, Plus, Search, Star, X } from 'lucide-react';
import { addExercise, db } from '../db';
import { MUSCLE_GROUPS, formatNumber } from '../lib/format';
import type { Exercise, ExerciseType, WorkoutSet } from '../types';

interface Props {
  workoutId?: number;
  workoutName?: string;
  alreadyAddedIds?: number[];
  onClose: () => void;
  onPick: (exerciseId: number) => void;
}

const EXERCISE_TYPES: { id: ExerciseType; label: string; hint: string }[] = [
  { id: 'weight', label: 'Вес × повторы', hint: 'Штанга, гантели, тренажёры (кг × раз)' },
  { id: 'bodyweight', label: 'Свой вес', hint: 'Подтягивания, брусья, отжимания' },
  { id: 'time', label: 'На время', hint: 'Планка, вис, статика (в секундах)' }
];

function inferMuscleGroupsFromTitle(title: string): Set<string> {
  const t = title.toLowerCase();
  const res = new Set<string>();
  if (t.includes('груд')) res.add('Грудь');
  if (t.includes('спин') || t.includes('тяг')) res.add('Спина');
  if (t.includes('ног') || t.includes('присед') || t.includes('ягод')) res.add('Ноги');
  if (t.includes('плеч') || t.includes('дельт')) res.add('Плечи');
  if (t.includes('рук') || t.includes('трицепс') || t.includes('бицепс')) res.add('Руки');
  if (t.includes('пресс') || t.includes('кор')) res.add('Пресс');
  return res;
}

function formatSetBrief(s: WorkoutSet, type: ExerciseType): string {
  if (type === 'time') return `${formatNumber(s.reps)} сек`;
  if (s.weight <= 0) return `× ${formatNumber(s.reps)}`;
  return `${formatNumber(s.weight)} кг × ${formatNumber(s.reps)}`;
}

export default function ExercisePicker({
  workoutId,
  workoutName = '',
  alreadyAddedIds = [],
  onClose,
  onPick
}: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('Все');
  const [createMode, setCreateMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<string>('Грудь');
  const [newType, setNewType] = useState<ExerciseType>('weight');
  const [creating, setCreating] = useState(false);

  const data = useLiveQuery(async () => {
    const [exercises, sets, workouts] = await Promise.all([
      db.exercises.toArray(),
      db.sets.toArray(),
      db.workouts.toArray()
    ]);
    return { exercises, sets, workouts };
  }, []);

  const statsByExercise = useMemo(() => {
    const map = new Map<
      number,
      {
        hasHistory: boolean;
        inSameSplit: boolean;
        lastText: string;
        sessionsCount: number;
        lastOrder: number;
      }
    >();
    if (!data) return map;

    const cleanSplit = workoutName.trim().toLowerCase();
    const isNamedSplit = cleanSplit !== '' && cleanSplit !== 'тренировка';
    const sameSplitWorkoutIds = new Set<number>();

    for (const w of data.workouts) {
      if (!w.id || w.id === workoutId) continue;
      if (isNamedSplit && w.name.trim().toLowerCase() === cleanSplit) {
        sameSplitWorkoutIds.add(w.id);
      }
    }

    const exerciseTypeMap = new Map<number, ExerciseType>(
      data.exercises.map((e) => [e.id as number, e.type])
    );

    const byExercise = new Map<number, WorkoutSet[]>();
    for (const s of data.sets) {
      if (s.workoutId === workoutId) continue;
      const list = byExercise.get(s.exerciseId) ?? [];
      list.push(s);
      byExercise.set(s.exerciseId, list);
    }

    for (const [exId, list] of byExercise) {
      if (list.length === 0) continue;
      const workoutIds = new Set(list.map((s) => s.workoutId));
      const inSameSplit = [...workoutIds].some((id) => sameSplitWorkoutIds.has(id));
      const lastWorkoutId = list.reduce((max, s) => Math.max(max, s.workoutId), 0);
      const lastSets = list
        .filter((s) => s.workoutId === lastWorkoutId)
        .sort((a, b) => a.order - b.order);
      const exType = exerciseTypeMap.get(exId) ?? 'weight';
      const lastText = lastSets
        .slice(0, 3)
        .map((s) => formatSetBrief(s, exType))
        .join(' · ');

      map.set(exId, {
        hasHistory: true,
        inSameSplit,
        lastText,
        sessionsCount: workoutIds.size,
        lastOrder: lastSets[0]?.order ?? 99
      });
    }

    return map;
  }, [data, workoutId, workoutName]);

  const targetMuscles = useMemo(
    () => inferMuscleGroupsFromTitle(workoutName),
    [workoutName]
  );

  const alreadySet = useMemo(() => new Set(alreadyAddedIds), [alreadyAddedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.exercises ?? []).filter((e) => {
      const byGroup = group === 'Все' || e.muscleGroup === group;
      const byQuery = !q || e.name.toLowerCase().includes(q);
      return byGroup && byQuery;
    });

    function rank(e: Exercise): number {
      const id = e.id as number;
      if (alreadySet.has(id)) return 10; // Уже добавленные в текущую тренировку — вниз
      const st = statsByExercise.get(id);
      const matchesMuscle = targetMuscles.has(e.muscleGroup);
      if (st?.inSameSplit) return 0; // Делал в тренировке с таким же названием
      if (st?.hasHistory && matchesMuscle) return 1; // Делал ранее + подходит под мышечную группу тренировки
      if (st?.hasHistory) return 2; // Любое упражнение, где уже есть история подходов
      if (matchesMuscle) return 3; // Подходит по группе мышц к названию тренировки
      return 4;
    }

    return list.sort((a, b) => {
      const rA = rank(a);
      const rB = rank(b);
      if (rA !== rB) return rA - rB;
      const stA = statsByExercise.get(a.id as number);
      const stB = statsByExercise.get(b.id as number);
      if (stA && stB && stA.sessionsCount !== stB.sessionsCount) {
        return stB.sessionsCount - stA.sessionsCount;
      }
      return a.name.localeCompare(b.name, 'ru');
    });
  }, [data?.exercises, query, group, alreadySet, statsByExercise, targetMuscles]);

  const exactMatch = (data?.exercises ?? []).some(
    (e) => e.name.toLowerCase() === query.trim().toLowerCase()
  );

  function openCreateForm(prefill = '') {
    setNewName(prefill || query.trim());
    const firstTarget = [...targetMuscles][0];
    setNewGroup(group !== 'Все' ? group : firstTarget || 'Грудь');
    setNewType('weight');
    setCreateMode(true);
  }

  async function handleSaveNew() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const id = await addExercise(name, newGroup, newType);
      onPick(id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute bottom-0 left-1/2 flex max-h-[88dvh] w-full max-w-[560px] -translate-x-1/2 flex-col rounded-t-3xl border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4">
          {createMode ? (
            <button
              type="button"
              onClick={() => setCreateMode(false)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted"
            >
              <ArrowLeft size={17} /> Назад к списку
            </button>
          ) : (
            <h2 className="text-base font-semibold">Упражнение</h2>
          )}

          <div className="flex items-center gap-2">
            {!createMode && (
              <button
                type="button"
                onClick={() => openCreateForm()}
                className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[12px] font-bold text-bg transition active:scale-95"
              >
                <Plus size={15} strokeWidth={2.6} />
                Своё упражнение
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {createMode ? (
          <div className="space-y-4 overflow-y-auto px-4 pb-6 pt-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted">
                Название упражнения
              </label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Например: Жим гантелей на наклонной"
                className="w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/60 focus:border-accent/60"
              />
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                Группа мышц
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setNewGroup(g)}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                      newGroup === g
                        ? 'bg-accent text-bg'
                        : 'border border-line bg-surface text-muted'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted">
                Как считать подходы
              </p>
              <div className="space-y-2">
                {EXERCISE_TYPES.map((t) => {
                  const active = newType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewType(t.id)}
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-accent bg-accent/10'
                          : 'border-line bg-surface'
                      }`}
                    >
                      <div>
                        <p className="text-[14px] font-semibold">{t.label}</p>
                        <p className="mt-0.5 text-[11px] text-muted">{t.hint}</p>
                      </div>
                      <span
                        className={`h-4 w-4 rounded-full border ${
                          active ? 'border-accent bg-accent' : 'border-muted'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveNew}
              disabled={!newName.trim() || creating}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 text-[15px] font-bold text-bg transition active:scale-[0.99] disabled:bg-surface2 disabled:text-muted"
            >
              <Plus size={18} strokeWidth={2.6} />
              Сохранить и добавить в тренировку
            </button>
          </div>
        ) : (
          <>
            <div className="shrink-0 px-4 pb-2">
              <div className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Найти упражнение"
                  className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-[15px] outline-none placeholder:text-muted/70 focus:border-accent/60"
                />
              </div>
            </div>

            <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto px-4 pb-3">
              {['Все', ...MUSCLE_GROUPS].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGroup(g)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium transition ${
                    group === g
                      ? 'bg-accent text-bg'
                      : 'border border-line bg-surface text-muted'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto border-t border-line/60">
              {!exactMatch && query.trim() !== '' && (
                <button
                  type="button"
                  onClick={() => openCreateForm(query.trim())}
                  className="flex w-full items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition active:bg-surface"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Plus size={18} />
                  </span>
                  <span className="text-[14px]">
                    Создать «<span className="font-semibold">{query.trim()}</span>»…
                  </span>
                </button>
              )}

              {filtered.map((e: Exercise) => {
                const id = e.id as number;
                const st = statsByExercise.get(id);
                const isAdded = alreadySet.has(id);

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onPick(id)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-line/40 px-4 py-3 text-left transition active:bg-surface ${
                      isAdded ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-medium">
                          {e.name}
                        </span>
                        {st?.inSameSplit && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                            <Star size={10} />
                            из сплита
                          </span>
                        )}
                        {!st?.inSameSplit && st?.hasHistory && (
                          <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] font-medium text-accent/90">
                            <History size={10} />
                            делал
                          </span>
                        )}
                      </div>
                      {st?.lastText && (
                        <p className="mt-0.5 truncate text-[11px] text-muted tabular-nums">
                          Прошлый раз: {st.lastText}
                        </p>
                      )}
                    </div>

                    {isAdded ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-medium text-muted">
                        <Check size={11} />В трен.
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                        {e.muscleGroup}
                      </span>
                    )}
                  </button>
                );
              })}

              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-muted">Ничего не найдено</p>
                  <button
                    type="button"
                    onClick={() => openCreateForm(query.trim())}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-bold text-bg"
                  >
                    <Plus size={15} strokeWidth={2.6} />
                    Добавить своё упражнение
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
