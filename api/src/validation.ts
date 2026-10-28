const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Category = 'food' | 'medicine';

export type ProductInput = {
  id?: string;
  name: string;
  category: Category;
  expiryDate: string;
  productionDate: string | null;
};

export type ValidationResult =
  | { ok: true; value: ProductInput }
  | { ok: false; details: string[] };

/** Проверяет и формат, и что дата существует: 2026-02-30 и 2026-99-99 не пройдут. */
export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // Годы 0000-0099 отвергаются: Date.UTC(26, ...) превращается в 1926, а такие сроки годности нереальны.
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function checkCategory(value: unknown): Category | null {
  return value === 'food' || value === 'medicine' ? value : null;
}

function checkDate(value: unknown): string | null {
  return isDateString(value) ? value : null;
}

export function parseProductInput(body: unknown): ValidationResult {
  const input = (body ?? {}) as Record<string, unknown>;
  const details: string[] = [];

  let id: string | undefined;
  if (input.id !== undefined) {
    if (!isUuid(input.id)) {
      details.push('id должен быть uuid');
    } else {
      id = input.id;
    }
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    details.push('name обязателен');
  }

  const category = checkCategory(input.category);
  if (!category) {
    details.push('category должен быть food или medicine');
  }

  const expiryDate = checkDate(input.expiryDate);
  if (!expiryDate) {
    details.push('expiryDate должен быть существующей датой YYYY-MM-DD');
  }

  let productionDate: string | null = null;
  if (input.productionDate !== undefined && input.productionDate !== null) {
    productionDate = checkDate(input.productionDate);
    if (!productionDate) {
      details.push('productionDate должен быть существующей датой YYYY-MM-DD');
    }
  }

  if (details.length > 0) {
    return { ok: false, details };
  }

  return {
    ok: true,
    value: { id, name, category: category!, expiryDate: expiryDate!, productionDate },
  };
}

export type ProductPatch = {
  name?: string;
  category?: Category;
  expiryDate?: string;
  productionDate?: string | null;
};

export type PatchResult =
  | { ok: true; value: ProductPatch }
  | { ok: false; details: string[] };

/** Разбирает частичное обновление продукта: проверяются только переданные поля. */
export function parseProductPatch(body: unknown): PatchResult {
  const input = (body ?? {}) as Record<string, unknown>;
  const details: string[] = [];
  const value: ProductPatch = {};
  let provided = 0;

  if (input.name !== undefined) {
    provided += 1;
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name) {
      details.push('name не может быть пустым');
    } else {
      value.name = name;
    }
  }

  if (input.category !== undefined) {
    provided += 1;
    const category = checkCategory(input.category);
    if (!category) {
      details.push('category должен быть food или medicine');
    } else {
      value.category = category;
    }
  }

  if (input.expiryDate !== undefined) {
    provided += 1;
    const expiryDate = checkDate(input.expiryDate);
    if (!expiryDate) {
      details.push('expiryDate должен быть существующей датой YYYY-MM-DD');
    } else {
      value.expiryDate = expiryDate;
    }
  }

  if (input.productionDate !== undefined) {
    provided += 1;
    if (input.productionDate === null) {
      value.productionDate = null;
    } else {
      const productionDate = checkDate(input.productionDate);
      if (!productionDate) {
        details.push('productionDate должен быть существующей датой YYYY-MM-DD или null');
      } else {
        value.productionDate = productionDate;
      }
    }
  }

  if (provided === 0) {
    details.push('нет полей для изменения');
  }

  if (details.length > 0) {
    return { ok: false, details };
  }

  return { ok: true, value };
}

export const NOTIFY_FREQUENCIES = ['daily', 'every_3_days', 'weekly'] as const;

export type NotifyFrequency = (typeof NOTIFY_FREQUENCIES)[number];

export type SettingsInput = {
  notifyFrequency: NotifyFrequency;
  notifyTime: string;
  warnDays: number;
};

export type SettingsResult =
  | { ok: true; value: SettingsInput }
  | { ok: false; details: string[] };

export function parseSettingsInput(body: unknown): SettingsResult {
  const input = (body ?? {}) as Record<string, unknown>;
  const details: string[] = [];

  const frequency = input.notifyFrequency;
  if (!NOTIFY_FREQUENCIES.includes(frequency as NotifyFrequency)) {
    details.push(`notifyFrequency должен быть одним из: ${NOTIFY_FREQUENCIES.join(', ')}`);
  }

  const time = input.notifyTime;
  if (typeof time !== 'string' || !TIME_PATTERN.test(time)) {
    details.push('notifyTime должен быть в формате HH:MM');
  }

  const warnDays = input.warnDays;
  if (
    typeof warnDays !== 'number' ||
    !Number.isInteger(warnDays) ||
    warnDays < 0 ||
    warnDays > 365
  ) {
    details.push('warnDays должен быть целым числом от 0 до 365');
  }

  if (details.length > 0) {
    return { ok: false, details };
  }

  return {
    ok: true,
    value: {
      notifyFrequency: frequency as NotifyFrequency,
      notifyTime: time as string,
      warnDays: warnDays as number,
    },
  };
}
