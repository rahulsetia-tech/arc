import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { api } from '../../src/utils/api';
import { saveAuth } from '../../src/utils/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      const result = await api.login(email.trim().toLowerCase(), password) as any;
      await saveAuth(result.token, result.user);
      // Navigate to the main app
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.logo}>SUPER</Text>
          <Text style={styles.logoAccent}>ACRES</Text>
          <Text style={styles.tagline}>Run. Capture. Dominate.</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.title}>WELCOME BACK</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL</Text>
            <TextInput
              style={styles.input}
              placeholder="your@email.com"
              placeholderTextColor="#555"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              testID="login-email-input"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              testID="login-password-input"
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            testID="login-submit-button"
          >
            {loading ? (
              <ActivityIndicator color="#0D0D0D" />
            ) : (
              <Text style={styles.buttonText}>LOGIN</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.link}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkAccent}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  logoAccent: {
    fontSize: 48,
    fontWeight: '900',
    color: '#00FF88',
    letterSpacing: 4,
    marginTop: -8,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    letterSpacing: 3,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  form: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 3,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 2,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0D0D0D',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 10,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#00FF88',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#0D0D0D',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  link: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#888',
    fontSize: 14,
  },
  linkAccent: {
    color: '#00FF88',
    fontWeight: '700',
  },
});
