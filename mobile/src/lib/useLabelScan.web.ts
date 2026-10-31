import { useCallback } from 'react';
import type { ScanOutcome } from './scan-types';

/**
 * Сканирование упаковки требует ML Kit — нативной библиотеки.
 * В браузере операция недоступна, поэтому `available` равно false:
 * экран добавления не показывает кнопку, а сама функция сразу сообщает об этом.
 */
export function useLabelScan() {
  const scan = useCallback(async (): Promise<ScanOutcome> => {
    return { status: 'unrecognized' };
  }, []);

  return { scan, busy: false, available: false };
}
