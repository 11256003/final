import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onRegister = async () => {
    setError("");
    setLoading(true);
    try {
      await register(email, password, username, displayName || username);
      router.replace("/friends");
    } catch (err) {
      setError(err instanceof Error ? err.message : "註冊失敗，請稍後再試");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.headerContainer}>
            <Text style={styles.title}>建立新帳號</Text>
            <Text style={styles.subtitle}>加入我們，開始與好友聊天</Text>
          </View>

          <View style={styles.formContainer}>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="信箱 (Email)"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />
            <TextInput
              autoCapitalize="none"
              placeholder="使用者帳號 (Username)"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              value={username}
              onChangeText={setUsername}
            />
            <TextInput
              placeholder="名稱 (Nickname)"
              placeholderTextColor="#9ca3af"
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
            />
            <TextInput
              placeholder="密碼 (Password)"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
            />

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
                loading && styles.buttonDisabled
              ]}
              onPress={onRegister}
              disabled={loading}
            >
              <Text style={styles.buttonText}>{loading ? "建立中..." : "註冊並登入"}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  headerContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
  },
  formContainer: {
    gap: 16,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1f2937',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});