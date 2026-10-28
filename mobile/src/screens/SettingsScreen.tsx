import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NotifyFrequency } from '../api/types';
import { useData } from '../state/DataContext';

const FREQUENCIES: { key: NotifyFrequency; label: string }[] = [
  { key: 'daily', label: 'Ежедневно' },
  { key: 'every_3_days', label: 'Раз в 3 дня' },
  { key: 'weekly', label: 'Еженедельно' },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function SettingsScreen() {
  const { settings, saveSettings, notificationsDenied, error } = useData();
  const [frequency, setFrequency] = useState<NotifyFrequency>(settings.notify_frequency);
  const [time, setTime] = useState(settings.notify_time);
  const [warnDays, setWarnDays] = useState(String(settings.warn_days));
  const [saved, setSaved] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const submit = () => {
    const found: string[] = [];
    if (!TIME_PATTERN.test(time)) {
      found.push('Время в формате ЧЧ:ММ.');
    }
    const days = Number(warnDays);
    if (!Number.isInteger(days) || days < 0 || days > 365) {
      found.push('Период предупреждения — целое число от 0 до 365.');
    }

    setProblems(found);
    setSaved(false);
    if (found.length > 0) {
      return;
    }

    void saveSettings({ notifyFrequency: frequency, notifyTime: time, warnDays: days }).then(
      () => setSaved(true),
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.label}>Частота напоминаний</Text>
      <View style={styles.row}>
        {FREQUENCIES.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.chip, frequency === item.key && styles.chipActive]}
            onPress={() => setFrequency(item.key)}
          >
            <Text
              style={frequency === item.key ? styles.chipTextActive : styles.chipText}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Время отправки (ЧЧ:ММ)</Text>
      <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="09:00" />

      <Text style={styles.label}>Период предупреждения, дней</Text>
      <TextInput
        style={styles.input}
        value={warnDays}
        onChangeText={setWarnDays}
        keyboardType="number-pad"
        placeholder="7"
      />

      <Pressable style={styles.button} onPress={submit}>
        <Text style={styles.buttonText}>Сохранить</Text>
      </Pressable>

      {problems.map((problem) => (
        <Text key={problem} style={styles.problem}>
          {problem}
        </Text>
      ))}
      {error ? <Text style={styles.problem}>{error}</Text> : null}
      {saved ? <Text style={styles.saved}>Настройки сохранены.</Text> : null}
      {notificationsDenied ? (
        <Text style={styles.hint}>
          Уведомления запрещены в системе — напоминания приходить не будут.
        </Text>
      ) : null}
      <Text style={styles.hint}>
        Период предупреждения влияет и на цвет продуктов в списке.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 6 },
  label: { color: '#555', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: '#1565c0', borderColor: '#1565c0' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  problem: { color: '#c62828', marginTop: 6 },
  saved: { color: '#2e7d32', marginTop: 6 },
  hint: { color: '#666', marginTop: 12 },
});
