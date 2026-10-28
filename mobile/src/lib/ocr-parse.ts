/**
 * Разбор текста с упаковки. Чистые функции без нативных зависимостей,
 * поэтому проверяются тестами.
 */

const DAY_FIRST = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/g;
const YEAR_FIRST = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g;

/** Подсказки, после которых обычно стоит срок годности. */
const MARKERS = [
  'годен до',
  'годен',
  'срок годности',
  'срок службы',
  'употребить до',
  'использовать до',
  'best before',
  'exp',
];

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toIso(year: number, month: number, day: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}`;
}

function normalizeYear(raw: number): number {
  return raw < 100 ? 2000 + raw : raw;
}

type Candidate = { iso: string; index: number };

function collect(text: string): Candidate[] {
  const found: Candidate[] = [];

  for (const match of text.matchAll(YEAR_FIRST)) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (isValidDate(year, month, day)) {
      found.push({ iso: toIso(year, month, day), index: match.index ?? 0 });
    }
  }

  for (const match of text.matchAll(DAY_FIRST)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = normalizeYear(Number(match[3]));
    if (isValidDate(year, month, day)) {
      found.push({ iso: toIso(year, month, day), index: match.index ?? 0 });
    }
  }

  return found.sort((left, right) => left.index - right.index);
}

/**
 * Ищет срок годности: сначала дату после подсказки-маркера, иначе — самую позднюю
 * найденную дату (на упаковке обычно указаны и дата изготовления, и срок годности).
 */
export function parseExpiryDate(text: string): string | null {
  const lower = text.toLowerCase();
  const candidates = collect(text);

  if (candidates.length === 0) {
    return null;
  }

  for (const marker of MARKERS) {
    const markerIndex = lower.indexOf(marker);
    if (markerIndex === -1) {
      continue;
    }
    const after = candidates.filter((candidate) => candidate.index >= markerIndex);
    if (after.length > 0) {
      return after[after.length - 1]!.iso;
    }
  }

  const sorted = [...candidates].sort((left, right) => (left.iso < right.iso ? 1 : -1));
  return sorted[0]!.iso;
}

/** Название — первая строка без даты и без цифр, не короче двух символов. */
export function parseProductName(text: string): string | null {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 2);

  for (const line of lines) {
    if (/\d/.test(line)) {
      continue;
    }
    if (!/[a-zA-Zа-яА-Я]/.test(line)) {
      continue;
    }
    return line.slice(0, 60);
  }

  return null;
}

export type ParsedLabel = {
  name: string | null;
  expiryDate: string | null;
};

export function parseLabel(text: string): ParsedLabel {
  return {
    name: parseProductName(text),
    expiryDate: parseExpiryDate(text),
  };
}
