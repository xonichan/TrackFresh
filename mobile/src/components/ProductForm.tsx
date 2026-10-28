import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Category, ProductDraft } from '../api/types';

export type ProductFormValues = {
  name: string;
  category: Category;
  expiryDate: string;
  productionDate: string;
};

export const EMPTY_FORM: ProductFormValues = {
  name: '',
  category: 'food',
  expiryDate: '',
  productionDate: '',
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/** Проверки, которые ловят ошибку до запроса: те же правила, что у API. */
export function validateForm(values: ProductFormValues): string[] {
  const problems: string[] = [];
  if (!values.name.trim()) {
    problems.push('Укажите название.');
  }
  if (!isRealDate(values.expiryDate)) {
    problems.push('Срок годности в формате ГГГГ-ММ-ДД.');
  }
  if (values.productionDate && !isRealDate(values.productionDate)) {
    problems.push('Дата производства в формате ГГГГ-ММ-ДД.');
  }
  if (
    values.productionDate &&
    isRealDate(values.productionDate) &&
    isRealDate(values.expiryDate) &&
    values.productionDate > values.expiryDate
  ) {
    problems.push('Дата производства позже срока годности.');
  }
  return problems;
}

export function toDraft(values: ProductFormValues): ProductDraft {
  return {
    name: values.name.trim(),
    category: values.category,
    expiryDate: values.expiryDate,
    productionDate: values.productionDate ? values.productionDate : null,
  };
}

type Props = {
  values: ProductFormValues;
  onChange(values: ProductFormValues): void;
  submitLabel: string;
  busy?: boolean;
  serverError?: string | null;
  onSubmit(): void;
  onScan?(): void;
};

export function ProductForm({
  values,
  onChange,
  submitLabel,
  busy,
  serverError,
  onSubmit,
  onScan,
}: Props) {
  const [problems, setProblems] = React.useState<string[]>([]);

  const update = <K extends keyof ProductFormValues>(
    key: K,
    value: ProductFormValues[K],
  ) => onChange({ ...values, [key]: value });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Название</Text>
      <TextInput
        style={styles.input}
        value={values.name}
        onChangeText={(text) => update('name', text)}
        placeholder="Например, Молоко"
      />

      <Text style={styles.label}>Категория</Text>
      <View style={styles.row}>
        {(['food', 'medicine'] as Category[]).map((category) => (
          <Pressable
            key={category}
            style={[styles.chip, values.category === category && styles.chipActive]}
            onPress={() => update('category', category)}
          >
            <Text
              style={
                values.category === category ? styles.chipTextActive : styles.chipText
              }
            >
              {category === 'food' ? 'Продукт' : 'Лекарство'}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Срок годности (ГГГГ-ММ-ДД)</Text>
      <TextInput
        style={styles.input}
        value={values.expiryDate}
        onChangeText={(text) => update('expiryDate', text)}
        placeholder="2026-11-01"
        keyboardType="numbers-and-punctuation"
      />

      <Text style={styles.label}>Дата производства — необязательно</Text>
      <TextInput
        style={styles.input}
        value={values.productionDate}
        onChangeText={(text) => update('productionDate', text)}
        placeholder="2026-10-01"
        keyboardType="numbers-and-punctuation"
      />

      {onScan ? (
        <Pressable style={styles.secondary} onPress={onScan} disabled={busy}>
          <Text style={styles.secondaryText}>Сканировать упаковку</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={() => {
          const found = validateForm(values);
          setProblems(found);
          if (found.length === 0) {
            onSubmit();
          }
        }}
      >
        <Text style={styles.buttonText}>{submitLabel}</Text>
      </Pressable>

      {problems.map((problem) => (
        <Text key={problem} style={styles.problem}>
          {problem}
        </Text>
      ))}
      {serverError ? <Text style={styles.problem}>{serverError}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 6 },
  label: { color: '#555', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 8 },
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
    marginTop: 12,
  },
  buttonDisabled: { backgroundColor: '#9e9e9e' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondary: {
    borderWidth: 1,
    borderColor: '#1565c0',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryText: { color: '#1565c0', fontWeight: '600' },
  problem: { color: '#c62828', marginTop: 6 },
});
