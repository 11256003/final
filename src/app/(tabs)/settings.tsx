import { router } from "expo-router";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Screen } from "../../components/Screen";
import { commonStyles } from "../../components/styles";
import { UserAvatar } from "../../components/UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { auth, db } from "../../services/firebase";

export default function SettingsScreen() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const onSave = async () => {
    if (!user) return;
    setMessage("");
    setError("");
    try {
      // 更新 Firestore 用戶資料
      const userRef = doc(db, "users", user.id);
      await updateDoc(userRef, {
        name: name || user.name,
        avatar_url: avatarUrl || null,
      });

      // 更新本地 state
      setUser({
        ...user,
        name: name || user.name,
        avatar_url: avatarUrl || null,
      });
      setMessage("已儲存個人設定");
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
    }
  };

  const onChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError("請輸入新密碼");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("兩次密碼不相同");
      return;
    }
    if (newPassword.length < 6) {
      setError("密碼至少需要 6 個字元");
      return;
    }

    setIsUpdatingPassword(true);
    setMessage("");
    setError("");
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("User not logged in");
      }

      // 更新密碼
      await updatePassword(currentUser, newPassword);
      
      setMessage("密碼已變更");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPassword("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "變更密碼失敗";
      if (errorMessage.includes("auth/requires-recent-login")) {
        setError("為了安全起見，請重新登入再變更密碼");
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const onSignOut = () => {
    Alert.alert("確認", "確定要登出嗎？", [
      { text: "取消", style: "cancel" },
      {
        text: "登出",
        onPress: () => {
          logout();
          router.replace("/");
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.form}>
        <View style={styles.profileHeader}>
          <UserAvatar name={name} uri={avatarUrl} size={72} />
          <View style={styles.profileText}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={commonStyles.rowMeta}>ID：{user?.id}</Text>
          </View>
        </View>

        {/* 個人資料編輯 */}
        <Text style={styles.sectionTitle}>編輯個人資料</Text>
        <TextInput
          placeholder="姓名"
          style={commonStyles.input}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          autoCapitalize="none"
          placeholder="頭像圖片 URL"
          style={commonStyles.input}
          value={avatarUrl}
          onChangeText={setAvatarUrl}
        />
        <Pressable style={commonStyles.button} onPress={onSave}>
          <Text style={commonStyles.buttonText}>儲存個人設定</Text>
        </Pressable>

        {/* 修改密碼 */}
        <Text style={styles.sectionTitle}>變更密碼</Text>
        <TextInput
          placeholder="新密碼"
          secureTextEntry
          style={commonStyles.input}
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          placeholder="確認新密碼"
          secureTextEntry
          style={commonStyles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />
        <Pressable
          style={commonStyles.button}
          onPress={onChangePassword}
          disabled={isUpdatingPassword}
        >
          <Text style={commonStyles.buttonText}>
            {isUpdatingPassword ? "更新中..." : "變更密碼"}
          </Text>
        </Pressable>

        {/* 訊息 */}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        {error ? <Text style={commonStyles.error}>{error}</Text> : null}

        {/* 登出 */}
        <Pressable style={commonStyles.secondaryButton} onPress={onSignOut}>
          <Text style={commonStyles.secondaryButtonText}>登出</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 12,
    paddingBottom: 24,
  },
  name: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "800",
  },
  profileHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginBottom: 8,
  },
  profileText: {
    flex: 1,
  },
  sectionTitle: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  success: {
    color: "#16a34a",
    fontSize: 14,
  },
});
