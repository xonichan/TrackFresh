import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/types';
import { useData } from '../state/DataContext';
import { useLabelScan } from '../lib/useLabelScan';
import {
  EMPTY_FORM,
  ProductForm,
  toDraft,
  type ProductFormValues,
} from '../components/ProductForm';

/** Сканирование упаковки; при неудаче значения формы не меняются. */
export function AddProductScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { addProduct, error } = useData();
  const { scan, busy: scanning } = useLabelScan();

  const [values, setValues] = useState<ProductFormValues>(EMPTY_FORM);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onScan = async () => {
    setNotice(null);
    const outcome = await scan();

    if (outcome.status === 'unrecognized') {
      setNotice('Не удалось распознать данные. Введите их вручную.');
      return;
    }
    if (outcome.status === 'cancelled') {
      return;
    }

    setValues((current) => ({
      ...current,
      name: outcome.parsed.name ?? current.name,
      expiryDate: outcome.parsed.expiryDate ?? current.expiryDate,
    }));
    setNotice('Проверьте распознанные данные перед сохранением.');
  };

  const onSubmit = async () => {
    setSaving(true);
    await addProduct(toDraft(values));
    setSaving(false);
    navigation.navigate('Tabs', { screen: 'List' });
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ProductForm
        values={values}
        onChange={setValues}
        submitLabel="Добавить"
        busy={saving || scanning}
        serverError={error}
        onSubmit={() => void onSubmit()}
        onScan={() => void onScan()}
      />
      {notice ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  notice: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff8e1',
  },
  noticeText: { color: '#6d4c41' },
});
