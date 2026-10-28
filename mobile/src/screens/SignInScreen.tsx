import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../state/AuthContext';

export function SignInScreen() {
  const { signIn, signUp, signInWithGoogle, error, busy } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');

  const canSubmit = useMemo(
    () => email.trim().length > 3 && password.length >= 6 && !busy,
    [email, password, busy],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TrackFresh</Text>
      <Text style={styles.subtitle}>Следите за сроками годности</Text>

      <TextInput
        style={styles.input}
        placeholder="Почта"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={() => void (mode === 'signIn' ? signIn(email, password) : signUp(email, password))}
      >
        <Text style={styles.buttonText}>
          {mode === 'signIn' ? 'Войти' : 'Зарегистрироваться'}
        </Text>
      </Pressable>

      <Pressable
        style={styles.link}
        onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
      >
        <Text style={styles.linkText}>
          {mode === 'signIn' ? 'Создать аккаунт' : 'У меня уже есть аккаунт'}
        </Text>
      </Pressable>

      <Pressable style={styles.google} onPress={() => void signInWithGoogle()}>
        <Text style={styles.buttonText}>Войти через Google</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center' },
  subtitle: { textAlign: 'center', color: '#666', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#1565c0',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: '#9e9e9e' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { alignItems: 'center', padding: 6 },
  linkText: { color: '#1565c0' },
  google: {
    backgroundColor: '#37474f',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  error: { color: '#c62828', textAlign: 'center' },
});
