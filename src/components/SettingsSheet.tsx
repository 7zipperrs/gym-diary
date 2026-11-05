import { useRef, useState } from 'react';
import { Download, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { db, todayISO } from '../db';

interface Props {
  onClose: () => void;
}

export default function SettingsSheet({ onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  async function exportData() {
    setBusy(true);
    setMessage(null);
    try {
      const [exercises, workouts, sets, templates] = await Promise.all([
        db.exercises.toArray(),
        db.workouts.toArray(),
        db.sets.toArray(),
        db.templates.toArray()
      ]);
      const payload = {
        app: 'gym-diary',
        version: 1,
        exportedAt: new Date().toISOString(),
        exercises,
        workouts,
        sets,
        templates
      };
      const name = `gymdiary-${todayISO()}.json`;
      const file = new File([JSON.stringify(payload, null, 2)], name, {
        type: 'application/json'
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Бэкап дневника' });
      } else {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage('Бэкап сохранён.');
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessage('Не удалось сохранить бэкап.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function importData(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const parsed = JSON.parse(await file.text()) as {
        exercises?: unknown[];
        workouts?: unknown[];
        sets?: unknown[];
        templates?: unknown[];
      };
      if (
        !Array.isArray(parsed.exercises) ||
        !Array.isArray(parsed.workouts) ||
        !Array.isArray(parsed.sets)
      ) {
        throw new Error('bad file');
      }
      if (
        !window.confirm(
          'Импорт заменит все текущие данные. Продолжить?'
        )
      ) {
        return;
      }
      await db.transaction('rw', db.exercises, db.workouts, db.sets, db.templates, async () => {
        await Promise.all([
          db.exercises.clear(),
          db.workouts.clear(),
          db.sets.clear(),
          db.templates.clear()
        ]);
        await db.exercises.bulkAdd(parsed.exercises as never[]);
        await db.workouts.bulkAdd(parsed.workouts as never[]);
        await db.sets.bulkAdd(parsed.sets as never[]);
        if (Array.isArray(parsed.templates) && parsed.templates.length > 0) {
          await db.templates.bulkAdd(parsed.templates as never[]);
        }
      });
      window.location.reload();
    } catch {
      setMessage('Файл не похож на бэкап GymDiary.');
    } finally {
      setBusy(false);
    }
  }

  async function resetAll() {
    if (
      !window.confirm(
        'Удалить все тренировки и упражнения без возможности восстановления?'
      )
    ) {
      return;
    }
    setBusy(true);
    await db.delete();
    window.location.reload();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="absolute bottom-0 left-1/2 max-h-[88dvh] w-full max-w-[560px] -translate-x-1/2 overflow-y-auto rounded-t-3xl border-t border-line bg-bg pb-[calc(env(safe-area-inset-bottom)+16px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="text-base font-semibold">Настройки</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-muted"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2 px-4 pt-2">
          <button
            type="button"
            onClick={exportData}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Download size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-[14px] font-medium">Экспорт бэкапа</span>
              <span className="block text-[11px] text-muted">
                Сохранить все данные в JSON-файл
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Upload size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-[14px] font-medium">Импорт бэкапа</span>
              <span className="block text-[11px] text-muted">
                Заменить данные файлом из экспорта
              </span>
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importData(file);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={resetAll}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-xl border border-danger/25 p-3.5 text-left transition active:scale-[0.99] disabled:opacity-60"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10 text-danger">
              <Trash2 size={18} />
            </span>
            <span className="flex-1">
              <span className="block text-[14px] font-medium text-danger">
                Удалить все данные
              </span>
              <span className="block text-[11px] text-muted">Действие необратимо</span>
            </span>
          </button>
        </div>

        {message && (
          <p className="mx-4 mt-3 rounded-lg bg-surface px-3 py-2 text-center text-[12px] text-muted">
            {message}
          </p>
        )}

        <div className="mx-4 mt-4 rounded-xl border border-line/70 bg-surface/50 p-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
            <div>
              <p className="text-[12px] font-medium">
                {isStandalone
                  ? 'Приложение установлено на iPhone'
                  : 'Как установить на iPhone'}
              </p>
              {!isStandalone && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted">
                  Открой сайт в Safari → «Поделиться» → «На экран Домой». После этого
                  приложение будет работать полноэкранно и офлайн.
                </p>
              )}
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Данные хранятся только на этом устройстве. Раз в неделю делай экспорт
                бэкапа — iOS может очистить хранилище при нехватке места.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-muted/60">
          GymDiary · v0.1.0 · локальное хранилище
        </p>
      </div>
    </div>
  );
}
