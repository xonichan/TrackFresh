import { useCallback, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { parseLabel, type ParsedLabel } from '../lib/ocr-parse';

export type ScanOutcome =
  | { status: 'recognized'; parsed: ParsedLabel }
  | { status: 'unrecognized' }
  | { status: 'cancelled' };

/**
 * Открывает камеру, распознаёт текст через ML Kit и разбирает название и срок годности.
 * Если ничего не найдено, форма не заполняется — экран покажет предложение ввести вручную.
 */
export function useLabelScan() {
  const [busy, setBusy] = useState(false);

  const scan = useCallback(async (): Promise<ScanOutcome> => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return { status: 'cancelled' };
      }

      const shot = await ImagePicker.launchCameraAsync({ quality: 0.7 });
      if (shot.canceled || !shot.assets?.[0]?.uri) {
        return { status: 'cancelled' };
      }

      const result = await TextRecognition.recognize(shot.assets[0].uri);
      const parsed = parseLabel(result.text ?? '');

      if (!parsed.name && !parsed.expiryDate) {
        return { status: 'unrecognized' };
      }

      return { status: 'recognized', parsed };
    } catch {
      return { status: 'unrecognized' };
    } finally {
      setBusy(false);
    }
  }, []);

  return { scan, busy };
}
