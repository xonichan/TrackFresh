import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { CategoryFilter, RootStackParamList } from '../navigation/types';
import { useData } from '../state/DataContext';
import {
  FRESHNESS_COLORS,
  FRESHNESS_LABELS,
  formatDaysLeft,
  freshness,
} from '../lib/expiry';

const FILTERS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'food', label: 'Продукты' },
  { key: 'medicine', label: 'Лекарства' },
];

export function ProductListScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const {
    products,
    settings,
    loading,
    refreshing,
    error,
    pendingCount,
    serverWon,
    refresh,
  } = useData();
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const today = new Date();
  const visible =
    filter === 'all' ? products : products.filter((item) => item.category === filter);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error && products.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
        <Pressable style={styles.retry} onPress={() => void refresh()}>
          <Text style={styles.retryText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {pendingCount > 0 ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Нет связи: {pendingCount} изменений ждут отправки
          </Text>
        </View>
      ) : null}

      {serverWon ? (
        <View style={[styles.banner, styles.bannerInfo]}>
          <Text style={styles.bannerText}>Данные обновлены с сервера</Text>
        </View>
      ) : null}

      {error && products.length > 0 ? (
        <View style={[styles.banner, styles.bannerError]}>
          <Text style={styles.bannerText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.filters}>
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            style={[styles.chip, filter === item.key && styles.chipActive]}
            onPress={() => setFilter(item.key)}
          >
            <Text style={filter === item.key ? styles.chipTextActive : styles.chipText}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>
            Пока пусто. Добавьте продукт на вкладке «Добавить».
          </Text>
        }
        renderItem={({ item }) => {
          const status = freshness(item.expiry_date, settings.warn_days, today);
          return (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('ProductDetail', { id: item.id })}
            >
              <View style={[styles.dot, { backgroundColor: FRESHNESS_COLORS[status] }]} />
              <View style={styles.rowText}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.category === 'food' ? 'Продукт' : 'Лекарство'} ·{' '}
                  {formatDaysLeft(item.expiry_date, today)} · {FRESHNESS_LABELS[status]}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  banner: { backgroundColor: '#fff8e1', padding: 10 },
  bannerInfo: { backgroundColor: '#e3f2fd' },
  bannerError: { backgroundColor: '#ffebee' },
  bannerText: { color: '#4e342e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  filters: { flexDirection: 'row', gap: 8, padding: 12 },
  chip: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: '#1565c0', borderColor: '#1565c0' },
  chipText: { color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowText: { gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { color: '#666', fontSize: 13 },
  empty: { textAlign: 'center', color: '#666', padding: 32 },
  error: { color: '#c62828', textAlign: 'center' },
  retry: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  retryText: { color: '#fff', fontWeight: '600' },
});
