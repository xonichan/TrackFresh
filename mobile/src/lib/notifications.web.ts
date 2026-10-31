import type { Product, Settings } from '../api/types';

/**
 * Напоминания на устройстве — нативная возможность. В браузере их нет,
 * поэтому функции ничего не делают, а `remindersAvailable` говорит правду:
 * экран настроек предупреждает, что напоминания не придут.
 */
export const remindersAvailable = false;

export function configureNotifications(): void {
  // В браузере настраивать нечего.
}

export async function ensureNotificationPermission(): Promise<boolean> {
  return false;
}

/** Возвращает число поставленных напоминаний; в браузере их всегда ноль. */
export async function rescheduleReminders(
  _products: Product[],
  _settings: Settings,
  _now: Date,
): Promise<number> {
  return 0;
}
