import * as Notifications from 'expo-notifications';
import type { NotifyFrequency, Product, Settings } from '../api/types';
import { formatDaysLeft, isoDayNumber, toDayNumber } from './expiry';

/** Шаг между напоминаниями в днях для каждой частоты. */
const STEPS: Record<NotifyFrequency, number> = {
  daily: 1,
  every_3_days: 3,
  weekly: 7,
};

/** Ограничение, чтобы частое напоминание не создавало сотни записей. */
const MAX_PER_PRODUCT = 30;
const MINUTE_MS = 60_000;

export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Локальное время нужного дня: напоминание приходит в указанный час по часам устройства. */
function localTimeOfDay(dayNumber: number, hour: number, minute: number): Date {
  const utcNoon = new Date(dayNumber * 86_400_000);
  return new Date(
    utcNoon.getUTCFullYear(),
    utcNoon.getUTCMonth(),
    utcNoon.getUTCDate(),
    hour,
    minute,
    0,
    0,
  );
}

/**
 * Пересобирает расписание напоминаний: напоминать начиная с (срок - warnDays)
 * и дальше с шагом выбранной частоты до самого срока годности.
 */
export async function rescheduleReminders(
  products: Product[],
  settings: Settings,
  now: Date,
): Promise<number> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  const step = STEPS[settings.notify_frequency] ?? 1;
  const [rawHour, rawMinute] = settings.notify_time.split(':');
  const hour = Number(rawHour);
  const minute = Number(rawMinute);
  const todayDay = toDayNumber(now);

  let scheduled = 0;

  for (const product of products) {
    const expiryDay = isoDayNumber(product.expiry_date);
    let day = Math.max(expiryDay - settings.warn_days, todayDay);
    let count = 0;

    while (day <= expiryDay && count < MAX_PER_PRODUCT) {
      const when = localTimeOfDay(day, hour, minute);

      if (when.getTime() > now.getTime() + MINUTE_MS) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: product.name,
            body: `${formatDaysLeft(product.expiry_date, now)} — срок годности ${product.expiry_date}`,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
          },
        });
        scheduled += 1;
      }

      day += step;
      count += 1;
    }
  }

  return scheduled;
}
