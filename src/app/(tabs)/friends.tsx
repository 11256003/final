import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { getChatsList } from "../../services/chats";
import { addFriendByUsername, getFriendsList, verifyAndFixFriendship } from "../../services/firestore";
import type { User } from "../../types/chat";

export default function FriendsScreen() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<User[]>([]);
  const [friendUsername, setFriendUsername] = useState("");
  const [error, setError] = useState("");

  const loadFriends = useCallback(async () => {
    if (!user) return;
    const data = await getFriendsList(user.id);
    setFriends(data);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadFriends().catch((err) => setError("載入好友失敗"));
    }, [loadFriends]),
  );

  const onAddFriend = async () => {
    if (!user || !friendUsername.trim()) return;
    setError("");
    try {
      const friendIdOrUsername = friendUsername.trim();
      
      // Step 1: 添加好友
      console.log(`[FriendsScreen] Adding friend: ${friendIdOrUsername}`);
      await addFriendByUsername(user.id, friendIdOrUsername);
      console.log(`[FriendsScreen] Successfully added friend`);
      
      // Step 2: 等待 Firestore 同步
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: 嘗試從好友名單中找到該好友
      const updatedFriends = await getFriendsList(user.id);
      const addedFriend = updatedFriends.find(f => 
        f.id === friendIdOrUsername || f.username === friendIdOrUsername
      );
      
      if (addedFriend) {
        // Step 4: 驗證並修復雙向關係
        console.log(`[FriendsScreen] Verifying friendship with ${addedFriend.id}`);
        await verifyAndFixFriendship(user.id, addedFriend.id);
        console.log(`[FriendsScreen] Friendship verified and fixed`);
      }
      
      setFriendUsername("");
      
      // Step 5: 刷新好友列表和聊天列表
      await loadFriends();
      const chats = await getChatsList(user.id);
      console.log(`[FriendsScreen] Final chat count: ${chats.length} chats`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "加入失敗";
      console.error(`[FriendsScreen] Error adding friend:`, errorMsg);
      setError(errorMsg);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>好友列表</Text>
        <View style={styles.idBadge}>
          <Text style={styles.myIdLabel}>我的 ID：</Text>
          <Text style={styles.myIdValue}>{user?.id}</Text>
        </View>
      </View>

      <View style={styles.addSection}>
        <View style={styles.searchBar}>
          <Ionicons name="person-add-outline" size={20} color="#94a3b8" />
          <TextInput
            autoCapitalize="none"
            placeholder="搜尋帳號、Email 或 ID..."
            style={styles.searchInput}
            value={friendUsername}
            onChangeText={setFriendUsername}
          />
          <Pressable style={styles.addButton} onPress={onAddFriend}>
            <Text style={styles.addButtonText}>加入</Text>
          </Pressable>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>尚未加入任何好友</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.friendItem} onPress={() => router.push(`/chat/${item.id}`)}>
            <UserAvatar name={item.name} uri={item.avatar_url ?? undefined} size={50} />
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{item.name}</Text>
              <Text style={styles.friendId}>ID: {item.id}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 24, backgroundColor: '#fff' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b', marginBottom: 12 },
  idBadge: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 12, alignSelf: 'flex-start' },
  myIdLabel: { color: '#64748b', fontSize: 13 },
  myIdValue: { color: '#334155', fontSize: 13, fontWeight: '600' },
  addSection: { paddingHorizontal: 20, marginTop: -20 },
  searchBar: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', 
    borderRadius: 16, paddingLeft: 16, paddingRight: 8, height: 56,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 
  },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  addButton: { backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  addButtonText: { color: '#fff', fontWeight: '700' },
  errorText: { color: '#ef4444', marginTop: 8, textAlign: 'center', fontSize: 13 },
  listContent: { padding: 20 },
  friendItem: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', 
    padding: 16, borderRadius: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#f1f5f9'
  },
  friendInfo: { flex: 1, marginLeft: 12 },
  friendName: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  friendId: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { color: '#94a3b8', marginTop: 16, fontSize: 16 },
});