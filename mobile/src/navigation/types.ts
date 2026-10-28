import type { Category } from '../api/types';

export type RootStackParamList = {
  SignIn: undefined;
  Tabs: { screen?: keyof TabsParamList } | undefined;
  ProductDetail: { id: string };
  EditProduct: { id: string };
};

export type TabsParamList = {
  List: undefined;
  Add: undefined;
  Settings: undefined;
};

export type CategoryFilter = 'all' | Category;
