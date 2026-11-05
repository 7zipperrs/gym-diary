import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import { addExercise, db } from '../db';
import { MUSCLE_GROUPS } from '../lib/format';
import type { Exercise, ExerciseType } from '../types';

interface Props {
  onClose: () => void;
  onPick: (exerciseId: number) => void;
}

const EXERCISE_TYPES: { id: ExerciseType; label: string; hint: string }[] = [
  { id: 'weight', label: 'Вес × повторы', hint: 'Штанга, гантели, тренажёры (кг × раз)' },
  { id: 'bodyweight', label: 'Свой вес', hint: 'Подтягивания, брусья, отжимания' },
  { id: 'time', label: 'На время', hint: 'Планка, вис, статика (в секундах)' }
];

export default function ExercisePicker({ onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('Все');
  const [createMode, setCreateMode] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<string>('Грудь');
  const [newType, setNewType] = useState<ExerciseType>('weight');
  const [creating, setCreating] = useState(false);

  const exercises = useLiveQuery(async () => {
    const all = await db.exercises.toArray();
    return all.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exercises ?? []).filter((e) => {
      const byGroup = group === 'Все' || e.muscleGroup === group;
      const byQuery = !q || e.name.toLowerCase().includes(q);
      return byGroup && byQuery;
    });
  }, [exercises, query, group]);

  const exactMatch = (exercises ?? []).some(
    (e) => e.name.toLowerCase() === query.trim().toLowerCase()
  );

  function openCreateForm(prefill = '') {
    setNewName(prefill || query.trim());
    setNewGroup(group === 'Все' ? 'Грудь' : group);
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

              {filtered.map((e: Exercise) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => e.id && onPick(e.id)}
                  className="flex w-full items-center justify-between gap-3 border-b border-line/40 px-4 py-3 text-left transition active:bg-surface"
                >
                  <span className="text-[14px]">{e.name}</span>
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {e.muscleGroup}
                  </span>
                </button>
              ))}

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
