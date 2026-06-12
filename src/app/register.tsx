import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../components/Screen";
import { commonStyles } from "../components/styles";
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
      await register(
        email,
        password,
        username,
        displayName || username
      );
      router.replace("/friends");
    } catch (err) {
      setError(err instanceof Error ? err.message : "註冊失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.form}>
        <Text style={commonStyles.title}>註冊帳號</Text>
        <Text style={commonStyles.subtitle}>使用 Firebase 建立新帳號，建立後會產生使用者 ID。</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="信箱"
          style={commonStyles.input}
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          autoCapitalize="none"
          placeholder="帳號"
          style={commonStyles.input}
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          placeholder="顯示名稱"
          style={commonStyles.input}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          placeholder="密碼"
          secureTextEntry
          style={commonStyles.input}
          value={password}
          onChangeText={setPassword}
        />
        {error ? <Text style={commonStyles.error}>{error}</Text> : null}
        <Pressable style={commonStyles.button} onPress={onRegister} disabled={loading}>
          <Text style={commonStyles.buttonText}>{loading ? "建立中..." : "註冊並登入"}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
    paddingTop: 24,
  },
});
