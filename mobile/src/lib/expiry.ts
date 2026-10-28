export type Freshness = 'fresh' | 'soon' | 'expired';

export const FRESHNESS_COLORS: Record<Freshness, string> = {
  fresh: '#2e7d32',
  soon: '#f9a825',
  expired: '#c62828',
};

export const FRESHNESS_LABELS: Record<Freshness, string> = {
  fresh: 'Свежий',
  soon: 'Истекает скоро',
  expired: 'Просрочен',
};

/** Календарный день без времени — в UTC, чтобы не зависеть от часового пояса. */
export function toDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
}

/** Календарная дата YYYY-MM-DD как номер дня. */
export function isoDayNumber(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/** Сколько календарных дней осталось до срока годности; отрицательное — просрочено. */
export function daysUntil(expiryDate: string, today: Date): number {
  return isoDayNumber(expiryDate) - toDayNumber(today);
}

/** Статус продукта. Порог «скоро» задаётся периодом предупреждения из настроек. */
export function freshness(expiryDate: string, warnDays: number, today: Date): Freshness {
  const days = daysUntil(expiryDate, today);
  if (days < 0) {
    return 'expired';
  }
  return days <= warnDays ? 'soon' : 'fresh';
}

export function formatDaysLeft(expiryDate: string, today: Date): string {
  const days = daysUntil(expiryDate, today);
  if (days < 0) {
    return `просрочен ${Math.abs(days)} дн.`;
  }
  if (days === 0) {
    return 'истекает сегодня';
  }
  return `осталось ${days} дн.`;
}
