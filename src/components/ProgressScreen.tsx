import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { Award, Flame, TrendingUp } from 'lucide-react';
import type { WorkoutSet } from '../types';
import { db, estimate1RM, setVolume } from '../db';
import { formatNumber, formatShortDate, formatTonnage } from '../lib/format';

interface Session {
  workoutId: number;
  date: string;
  finishedAt: number;
  best: WorkoutSet;
  e1rm: number;
  volume: number;
}

export default function ProgressScreen() {
  const [exerciseId, setExerciseId] = useState<number | null>(null);

  const data = useLiveQuery(async () => {
    const [exercises, sets, workouts] = await Promise.all([
      db.exercises.toArray(),
      db.sets.toArray(),
      db.workouts.filter((w) => Boolean(w.finishedAt)).toArray()
    ]);
    return {
      exercises: exercises.sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      sets,
      workouts
    };
  }, []);

  const availableExercises = useMemo(() => {
    if (!data) return [];
    const finishedIds = new Set(data.workouts.map((w) => w.id as number));
    const withData = new Set(
      data.sets.filter((s) => finishedIds.has(s.workoutId)).map((s) => s.exerciseId)
    );
    return data.exercises.filter((e) => e.id !== undefined && withData.has(e.id));
  }, [data]);

  const effectiveId = useMemo(() => {
    if (availableExercises.length === 0) return null;
    if (exerciseId && availableExercises.some((e) => e.id === exerciseId)) {
      return exerciseId;
    }
    return availableExercises[0]?.id ?? null;
  }, [availableExercises, exerciseId]);

  const sessions = useMemo<Session[]>(() => {
    if (!data || !effectiveId) return [];
    const workoutMap = new Map(data.workouts.map((w) => [w.id as number, w]));
    const byWorkout = new Map<number, WorkoutSet[]>();
    for (const s of data.sets) {
      if (s.exerciseId !== effectiveId) continue;
      const list = byWorkout.get(s.workoutId) ?? [];
      list.push(s);
      byWorkout.set(s.workoutId, list);
    }

    return [...byWorkout.entries()]
      .map(([workoutId, list]) => {
        const workout = workoutMap.get(workoutId);
        const best = list.reduce(
          (a, b) =>
            b.weight > a.weight || (b.weight === a.weight && b.reps > a.reps) ? b : a,
          list[0]
        );
        return {
          workoutId,
          date: workout?.date ?? '',
          finishedAt: workout?.finishedAt ?? 0,
          best,
          e1rm: Math.max(...list.map((s) => estimate1RM(s.weight, s.reps))),
          volume: list.reduce((sum, s) => sum + setVolume(s), 0)
        };
      })
      .filter((s) => s.date && s.finishedAt > 0)
      .sort((a, b) => a.finishedAt - b.finishedAt);
  }, [data, effectiveId]);

  if (!data) {
    return (
      <div className="space-y-3 p-4">
        <div className="h-12 animate-pulse rounded-xl bg-surface" />
        <div className="h-60 animate-pulse rounded-2xl bg-surface" />
      </div>
    );
  }

  const selectedExercise = data.exercises.find((e) => e.id === effectiveId);
  const pr = sessions.reduce((max, s) => Math.max(max, s.best.weight), 0);
  const bestE1rm = sessions.reduce((max, s) => Math.max(max, s.e1rm), 0);

  const chartData = sessions.slice(-12).map((s) => ({
    label: formatShortDate(s.date),
    weight: s.best.weight,
    e1rm: Math.round(s.e1rm * 10) / 10
  }));

  return (
    <div className="p-4">
      {availableExercises.length > 0 && (
        <label className="relative block">
          <select
            value={effectiveId ?? ''}
            onChange={(e) => setExerciseId(Number(e.target.value))}
            className="w-full appearance-none rounded-xl border border-line bg-surface px-3 py-3 text-[14px] font-medium outline-none focus:border-accent/60"
          >
            {availableExercises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
            ▾
          </span>
        </label>
      )}

      {sessions.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-line p-8 text-center">
          <TrendingUp size={26} className="mx-auto text-muted" />
          <p className="mt-3 text-sm text-muted">
            По этому упражнению пока нет завершённых тренировок.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-line bg-surface p-3">
              <Award size={16} className="text-accent" />
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">Рекорд</p>
              <p className="text-[15px] font-semibold tabular-nums">
                {formatNumber(pr)} кг
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3">
              <Flame size={16} className="text-accent" />
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">1ПМ</p>
              <p className="text-[15px] font-semibold tabular-nums">
                {formatNumber(bestE1rm)} кг
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3">
              <TrendingUp size={16} className="text-accent" />
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted">Трен.</p>
              <p className="text-[15px] font-semibold tabular-nums">{sessions.length}</p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-line bg-surface p-3 pb-1">
            <div className="flex items-center justify-between px-1">
              <p className="text-[12px] font-medium text-muted">Динамика</p>
              <p className="text-[11px] text-muted/70">{selectedExercise?.name}</p>
            </div>
            <div className="mt-2 h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="#26313d" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#8b98a5', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#8b98a5', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    width={44}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#141b23',
                      border: '1px solid #26313d',
                      borderRadius: 12,
                      fontSize: 12
                    }}
                    labelStyle={{ color: '#f5f7fa' }}
                    itemStyle={{ color: '#d7ff3e' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    name="Рабочий вес"
                    stroke="#d7ff3e"
                    strokeWidth={2.2}
                    dot={{ r: 3, fill: '#d7ff3e', strokeWidth: 0 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="e1rm"
                    name="Расчётный 1ПМ"
                    stroke="#8b98a5"
                    strokeWidth={1.8}
                    strokeDasharray="5 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4">
            <p className="px-1 pb-2 text-[11px] uppercase tracking-wider text-muted">
              Последние тренировки
            </p>
            <div className="space-y-2">
              {[...sessions].reverse().map((s) => (
                <div
                  key={s.workoutId}
                  className="flex items-center justify-between rounded-xl border border-line bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted">
                      {formatShortDate(s.date)}
                    </p>
                    <p className="text-[14px] font-semibold tabular-nums">
                      {s.best.weight > 0
                        ? `${formatNumber(s.best.weight)} кг × ${formatNumber(s.best.reps)}`
                        : `${formatNumber(s.best.reps)} повт.`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wide text-muted">Объём</p>
                    <p className="text-[13px] font-medium tabular-nums">
                      {formatTonnage(s.volume)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
