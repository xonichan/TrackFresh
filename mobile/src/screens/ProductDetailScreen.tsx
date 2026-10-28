import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/types';
import { useData } from '../state/DataContext';
import { FRESHNESS_COLORS, FRESHNESS_LABELS, formatDaysLeft, freshness } from '../lib/expiry';

export function ProductDetailScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ProductDetail'>>();
  const { products, settings, removeProduct, error } = useData();
  const [deleting, setDeleting] = useState(false);

  const product = products.find((item) => item.id === params.id);

  if (!product) {
    return (
      <View style={styles.center}>
        <Text style={styles.missing}>Продукт не найден.</Text>
      </View>
    );
  }

  const today = new Date();
  const status = freshness(product.expiry_date, settings.warn_days, today);

  const confirmDelete = () => {
    Alert.alert('Удалить продукт?', product.name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          setDeleting(true);
          void removeProduct(product.id).then(() => {
            setDeleting(false);
            navigation.goBack();
          });
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.name}>{product.name}</Text>
      <Text style={styles.meta}>
        {product.category === 'food' ? 'Продукт' : 'Лекарство'}
      </Text>

      <View style={styles.status}>
        <View style={[styles.dot, { backgroundColor: FRESHNESS_COLORS[status] }]} />
        <Text style={styles.statusText}>
          {FRESHNESS_LABELS[status]} · {formatDaysLeft(product.expiry_date, today)}
        </Text>
      </View>

      <Text style={styles.field}>Срок годности: {product.expiry_date}</Text>
      <Text style={styles.field}>
        Дата производства: {product.production_date ?? 'не указана'}
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={styles.button}
        onPress={() => navigation.navigate('EditProduct', { id: product.id })}
      >
        <Text style={styles.buttonText}>Изменить</Text>
      </Pressable>

      <Pressable
        style={[styles.button, styles.danger]}
        disabled={deleting}
        onPress={confirmDelete}
      >
        <Text style={styles.buttonText}>{deleting ? 'Удаляем…' : 'Удалить'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missing: { color: '#666' },
  name: { fontSize: 24, fontWeight: '700' },
  meta: { color: '#666' },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  statusText: { fontSize: 15 },
  field: { fontSize: 15 },
  error: { color: '#c62828' },
  button: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  danger: { backgroundColor: '#c62828' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
