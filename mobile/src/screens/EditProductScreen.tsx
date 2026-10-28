import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/types';
import { useData } from '../state/DataContext';
import { ProductForm, toDraft, type ProductFormValues } from '../components/ProductForm';

export function EditProductScreen() {
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'EditProduct'>>();
  const { products, updateProduct, error } = useData();
  const [saving, setSaving] = useState(false);

  const product = products.find((item) => item.id === params.id);

  const [values, setValues] = useState<ProductFormValues | null>(() =>
    product
      ? {
          name: product.name,
          category: product.category,
          expiryDate: product.expiry_date,
          productionDate: product.production_date ?? '',
        }
      : null,
  );

  if (!product || !values) {
    return (
      <View style={styles.center}>
        <Text style={styles.missing}>Продукт не найден.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ProductForm
        values={values}
        onChange={setValues}
        submitLabel="Сохранить"
        busy={saving}
        serverError={error}
        onSubmit={() => {
          setSaving(true);
          void updateProduct(product.id, toDraft(values)).then(() => {
            setSaving(false);
            navigation.goBack();
          });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missing: { color: '#666' },
});
