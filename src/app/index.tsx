import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/friends");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登入失敗，請檢查帳號密碼");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>教學聊天 App</Text>
          <Text style={styles.subtitle}>歡迎回來！請登入您的帳號</Text>
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
            placeholder="密碼 (Password)"
            placeholderTextColor="#9ca3af"
            secureTextEntry
            style={styles.input}
            value={password}
            onChangeText={setPassword}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* 美化後的登入按鈕，加入按下時的縮放動畫 */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled
            ]}
            onPress={onLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? "登入中..." : "登 入"}</Text>
          </Pressable>

          {/* 註冊連結 */}
          <Link href="/register" asChild>
            <Pressable style={styles.linkButton}>
              <Text style={styles.linkText}>還沒有帳號？ <Text style={styles.linkTextBold}>立即註冊</Text></Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6', 
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
  linkButton: {
    alignItems: 'center',
    marginTop: 16,
    padding: 8,
  },
  linkText: {
    color: '#6b7280',
    fontSize: 15,
  },
  linkTextBold: {
    color: '#6366f1',
    fontWeight: '700',
  },
});