import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search, X } from 'lucide-react';
import { addExercise, db } from '../db';
import { MUSCLE_GROUPS } from '../lib/format';
import type { Exercise } from '../types';

interface Props {
  onClose: () => void;
  onPick: (exerciseId: number) => void;
}

export default function ExercisePicker({ onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('Все');
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

  async function createAndPick() {
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const id = await addExercise(
        name,
        group === 'Все' ? 'Другое' : group,
        'weight'
      );
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
        className="absolute bottom-0 left-1/2 flex max-h-[85dvh] w-full max-w-[560px] -translate-x-1/2 flex-col rounded-t-3xl border-t border-line bg-bg pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-base font-semibold">Упражнение</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted"
          >
            <X size={18} />
          </button>
        </div>

        <div className="shrink-0 px-4 pb-2">
          <div className="relative">
            <Search
              size={17}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Найти или создать упражнение"
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
              onClick={createAndPick}
              disabled={creating}
              className="flex w-full items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition active:bg-surface"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Plus size={18} />
              </span>
              <span className="text-[14px]">
                Создать «<span className="font-semibold">{query.trim()}</span>»
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

          {filtered.length === 0 && query.trim() === '' && (
            <p className="px-4 py-8 text-center text-sm text-muted">Ничего не найдено</p>
          )}
        </div>
      </div>
    </div>
  );
}
