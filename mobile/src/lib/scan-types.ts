/** Разбор текста упаковки: результат одинаков для обеих платформ. */
export type ScanOutcome =
  | { status: 'recognized'; parsed: { name: string | null; expiryDate: string | null } }
  | { status: 'unrecognized' }
  | { status: 'cancelled' };
