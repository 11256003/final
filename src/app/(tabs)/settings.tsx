import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { auth, db } from "../../services/firebase";
import { uploadProfileImage } from "../../services/storage";

export default function SettingsScreen() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false); 

  const [isConfirmModalVisible, setConfirmModalVisible] = useState(false);

  const pickAvatarImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      const message = "需要相簿權限才能更換頭貼。";
      if (Platform.OS === "web") window.alert(message);
      else Alert.alert("權限不足", message);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets.length > 0) {
      setLocalAvatarUri(result.assets[0].uri);
      setAvatarUrl(result.assets[0].uri);
    }
  };

  // 儲存個人資料
  const onSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const userRef = doc(db, "users", user.id);
      let remoteAvatarUrl = user.avatar_url || null;

      if (localAvatarUri) {
        remoteAvatarUrl = await uploadProfileImage(user.id, localAvatarUri);
      }

      await updateDoc(userRef, {
        name,
        bio: bio || null,
        avatar_url: remoteAvatarUrl || null,
      });

      setUser({ ...user, name, bio: bio || null, avatar_url: remoteAvatarUrl || null });
      setLocalAvatarUri(null);
      setAvatarUrl(remoteAvatarUrl || "");

      if (Platform.OS === 'web') {
        window.alert("個人資料已更新！");
      } else {
        Alert.alert("成功", "個人資料已更新");
      }
    } catch (err) {
      if (Platform.OS === 'web') window.alert("儲存失敗");
      else Alert.alert("錯誤", "儲存失敗");
    } finally {
      setLoading(false);
    }
  };

  // 執行密碼更新
  const performPasswordUpdate = async () => {
    setUpdatingPassword(true); 
    setConfirmModalVisible(false); 
    
    if (!auth.currentUser) {
        setUpdatingPassword(false);
        return;
    }
    
    try {
      await updatePassword(auth.currentUser, newPassword);
      setNewPassword(""); 
      if (Platform.OS === 'web') window.alert("密碼已成功更新！");
      else Alert.alert("成功", "密碼已成功更新！");
    } catch (err: any) {
      const errorMsg = err.message || "更新失敗，您可能需要先登出再重新登入才能修改密碼。";
      if (Platform.OS === 'web') window.alert(errorMsg);
      else Alert.alert("錯誤", errorMsg);
    } finally {
      setUpdatingPassword(false); 
    }
  };

  // 打開確認彈窗
  const onAskToUpdatePassword = () => {
    // 🔥 修改這裡：檢查是否達到 6 個字元
    if (newPassword.length < 6) {
      if (Platform.OS === 'web') window.alert("密碼長度至少需要 6 個字元！");
      else Alert.alert("提示", "密碼長度至少需要 6 個字元！");
      return;
    }
    setConfirmModalVisible(true); 
  };

  // 登出
  const onSignOut = async () => {
    try {
      await logout();
      router.replace("/"); 
    } catch (err) {
      console.error("登出失敗:", err);
    }
  };

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <UserAvatar name={name} uri={avatarUrl || undefined} size={100} />
        <Text style={styles.profileName}>{user?.name}</Text>
        <Text style={styles.profileBio}>{user?.bio || "請輸入你的自我介紹"}</Text>
        <Pressable style={styles.avatarButton} onPress={pickAvatarImage}>
          <Text style={styles.avatarButtonText}>更換頭貼</Text>
        </Pressable>
        <Text style={styles.profileId}>ID: {user?.id}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>個人資料</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>顯示名稱</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
        </View>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>自我介紹</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder="介紹一下自己"
            numberOfLines={4}
          />
        </View>
        <Pressable style={loading ? styles.disabledSaveButton : styles.saveButton} onPress={onSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>儲存修改</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>安全設定</Text>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>新密碼</Text>
          <TextInput 
            style={styles.input} 
            secureTextEntry 
            placeholder="請輸入新密碼 (至少 6 個字元)"
            value={newPassword} 
            onChangeText={setNewPassword} 
          />
        </View>
        
        {/* 🔥 修改這裡：大於等於 6 才會亮起 */}
        <Pressable 
          style={
            updatingPassword 
              ? styles.disabledPasswordUpdateButton 
              : newPassword.length >= 6 
                ? styles.saveButton // 滿 6 個字：亮起 (預設的靛藍色)
                : [styles.saveButton, { backgroundColor: '#cbd5e1' }] // 未滿 6 個字：淺灰色
          } 
          onPress={onAskToUpdatePassword}
          disabled={updatingPassword}
        >
          {updatingPassword ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>更新密碼</Text>
          )}
        </Pressable>
      </View>

      <Pressable style={styles.logoutButton} onPress={onSignOut}>
        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>登出帳號</Text>
      </Pressable>
    </ScrollView>

    <Modal
      visible={isConfirmModalVisible}
      transparent={true} 
      animationType="fade" 
      onRequestClose={() => setConfirmModalVisible(false)} 
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalIconContainer}>
            <Ionicons name="key-outline" size={48} color="#6366f1" /> 
          </View>
          <Text style={styles.modalTitle}>確認變更密碼</Text>
          <Text style={styles.modalMessage}>您確定要變更您的密碼嗎？本操作無法撤銷。新密碼將在您下一次登入時生效。</Text>
          
          <View style={styles.modalButtonContainer}>
            <Pressable 
              style={[styles.modalButton, styles.modalButtonCancel]} 
              onPress={() => setConfirmModalVisible(false)}
            >
              <Text style={styles.modalButtonTextCancel}>取消</Text>
            </Pressable>
            <Pressable 
              style={[styles.modalButton, styles.modalButtonConfirm]} 
              onPress={performPasswordUpdate}
            >
              <Text style={styles.modalButtonTextConfirm}>確定變更</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#fff' },
  profileName: { fontSize: 24, fontWeight: '800', color: '#1e293b', marginTop: 16 },
  profileBio: { fontSize: 14, color: '#64748b', marginTop: 8, textAlign: 'center', maxWidth: '80%' },
  avatarButton: { marginTop: 12, backgroundColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  avatarButtonText: { color: '#1e293b', fontWeight: '700' },
  profileId: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  section: { backgroundColor: '#fff', marginTop: 20, padding: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#6366f1', marginBottom: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, color: '#64748b', marginBottom: 8 },
  input: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 12, fontSize: 16 },
  bioInput: { minHeight: 100, textAlignVertical: 'top' },
  saveButton: { backgroundColor: '#6366f1', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10, minHeight: 52 },
  disabledSaveButton: { backgroundColor: '#a1a4f0', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10, minHeight: 52, opacity: 0.7 },
  disabledPasswordUpdateButton: { backgroundColor: '#a8b0c2', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 10, minHeight: 52, opacity: 0.7 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  logoutButton: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    marginVertical: 40, padding: 16 
  },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: '700', marginLeft: 8 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340, 
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10, 
  },
  modalIconContainer: {
    backgroundColor: '#eef2ff', 
    padding: 16,
    borderRadius: 50,
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  modalButtonContainer: {
    flexDirection: 'row', 
    gap: 12, 
    width: '100%',
  },
  modalButton: {
    flex: 1, 
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f1f5f9', 
  },
  modalButtonConfirm: {
    backgroundColor: '#6366f1', 
  },
  modalButtonTextCancel: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 15,
  },
  modalButtonTextConfirm: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});