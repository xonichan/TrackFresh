import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/state/AuthContext';
import { DataProvider } from './src/state/DataContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { configureNotifications } from './src/lib/notifications';

configureNotifications();

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <DataProvider>
          <RootNavigator />
        </DataProvider>
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
