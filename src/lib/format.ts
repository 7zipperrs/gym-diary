import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';

export function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  const full = format(date, 'dd.MM.yyyy, EEE', { locale: ru });
  if (isToday(date)) return `Сегодня · ${full}`;
  if (isYesterday(date)) return `Вчера · ${full}`;
  return full;
}

export function formatShortDate(iso: string): string {
  return format(new Date(`${iso}T12:00:00`), 'd MMM', { locale: ru });
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

export function formatTonnage(kg: number): string {
  if (kg >= 10000) return `${Math.round(kg / 1000)} т`;
  return `${Math.round(kg)} кг`;
}

export const MUSCLE_GROUPS = [
  'Грудь',
  'Спина',
  'Ноги',
  'Плечи',
  'Руки',
  'Пресс',
  'Другое'
] as const;

export const WORKOUT_PRESETS = [
  'Грудь, трицепс',
  'Спина, бицепс',
  'Ноги, плечи',
  'Кардио',
  'Фулбоди',
  'Руки, пресс'
] as const;
