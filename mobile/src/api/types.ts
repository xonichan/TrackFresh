export type Category = 'food' | 'medicine';

export type NotifyFrequency = 'daily' | 'every_3_days' | 'weekly';

/** Продукт в том виде, в каком его отдаёт API (см. docs/api.md). */
export type Product = {
  id: string;
  name: string;
  category: Category;
  expiry_date: string;
  production_date: string | null;
  /** Момент последнего изменения на сервере, ISO 8601. */
  updated_at: string;
};

export type Settings = {
  notify_frequency: NotifyFrequency;
  notify_time: string;
  warn_days: number;
};

export type ProductDraft = {
  /** Свой идентификатор присылается при создании, чтобы повтор не создал дубликат. */
  id?: string;
  name: string;
  category: Category;
  expiryDate: string;
  productionDate: string | null;
};

export type SettingsDraft = {
  notifyFrequency: NotifyFrequency;
  notifyTime: string;
  warnDays: number;
};
