import type { ScanOutcome } from './scan-types';

// Типы поверхности: см. useLabelScan.native.ts и useLabelScan.web.ts
export declare function useLabelScan(): {
  scan: () => Promise<ScanOutcome>;
  busy: boolean;
  /** false, если сканирование на этой платформе недоступно. */
  available: boolean;
};
