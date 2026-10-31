import type { Product, Settings } from '../api/types';

// Типы поверхности: реализация на телефоне — notifications.native.ts, в браузере — notifications.web.ts.
export declare function configureNotifications(): void;
export declare function ensureNotificationPermission(): Promise<boolean>;
export declare function rescheduleReminders(
  products: Product[],
  settings: Settings,
  now: Date,
): Promise<number>;
/** false, если напоминания на этой платформе недоступны. */
export declare const remindersAvailable: boolean;
