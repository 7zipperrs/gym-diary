import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Dumbbell, History, Settings, TrendingUp } from 'lucide-react';
import { db, finishWorkout, startWorkout } from './db';
import WorkoutScreen from './components/WorkoutScreen';
import HistoryScreen from './components/HistoryScreen';
import ProgressScreen from './components/ProgressScreen';
import SettingsSheet from './components/SettingsSheet';

type Tab = 'workout' | 'history' | 'progress';

const TABS = [
  { id: 'workout', label: 'Тренировка', Icon: Dumbbell },
  { id: 'history', label: 'История', Icon: History },
  { id: 'progress', label: 'Прогресс', Icon: TrendingUp }
] as const;

export default function App() {
  const [tab, setTab] = useState<Tab>('workout');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeWorkouts = useLiveQuery(
    () => db.workouts.filter((w) => !w.finishedAt).toArray(),
    []
  );
  const activeWorkout = activeWorkouts?.[0] ?? null;

  async function handleStart(name?: string) {
    await startWorkout(name);
    setTab('workout');
  }

  async function handleFinish() {
    if (!activeWorkout?.id) return;
    const setsCount = await db.sets.where('workoutId').equals(activeWorkout.id).count();
    if (setsCount === 0) {
      if (!window.confirm('В тренировке нет подходов. Удалить её?')) return;
    } else if (!window.confirm('Завершить тренировку?')) {
      return;
    }
    await finishWorkout(activeWorkout.id);
    localStorage.removeItem('gymdiary.restEnd');
    localStorage.removeItem(`gymdiary.done.${activeWorkout.id}`);
    setTab('workout');
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-bg">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/60 bg-bg/85 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)] backdrop-blur-md">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            Дневник
          </p>
          <h1 className="text-[17px] font-semibold leading-tight">Тренировки</h1>
        </div>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Настройки"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-muted transition active:scale-95"
        >
          <Settings size={19} />
        </button>
      </header>

      <main className="flex-1 pb-[calc(env(safe-area-inset-bottom)+84px)]">
        {tab === 'workout' && (
          <WorkoutScreen
            workout={activeWorkout}
            loading={activeWorkouts === undefined}
            onStart={handleStart}
            onFinish={handleFinish}
          />
        )}
        {tab === 'history' && <HistoryScreen />}
        {tab === 'progress' && <ProgressScreen />}
      </main>

      <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[560px] -translate-x-1/2 border-t border-line/60 bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="grid grid-cols-3">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      {settingsOpen && <SettingsSheet onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
