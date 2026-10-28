import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import type { RootStackParamList, TabsParamList } from './types';
import { useAuth } from '../state/AuthContext';
import { SignInScreen } from '../screens/SignInScreen';
import { ProductListScreen } from '../screens/ProductListScreen';
import { AddProductScreen } from '../screens/AddProductScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ProductDetailScreen } from '../screens/ProductDetailScreen';
import { EditProductScreen } from '../screens/EditProductScreen';

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabsParamList>();

function Tabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="List" component={ProductListScreen} options={{ title: 'Список' }} />
      <Tab.Screen name="Add" component={AddProductScreen} options={{ title: 'Добавить' }} />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Настройки' }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {user ? (
          <>
            <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
            <Stack.Screen
              name="ProductDetail"
              component={ProductDetailScreen}
              options={{ title: 'Продукт' }}
            />
            <Stack.Screen
              name="EditProduct"
              component={EditProductScreen}
              options={{ title: 'Изменить' }}
            />
          </>
        ) : (
          <Stack.Screen
            name="SignIn"
            component={SignInScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
