import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { listenToChatsList } from "../../services/chats";
import type { ChatSummary } from "../../types/chat";
import { Ionicons } from '@expo/vector-icons';

export default function ChatsScreen() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      const unsubscribe = listenToChatsList(user.id, setChats);
      return () => unsubscribe();
    }, [user]),
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>訊息</Text>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.friend.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>還沒有任何聊天訊息</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.chatItem} onPress={() => router.push(`/chat/${item.friend.id}`)}>
            <UserAvatar name={item.friend.name} uri={item.friend.avatar_url} size={56} />
            <View style={styles.chatInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.friend.name}</Text>
                <Text style={styles.time}>{item.last_time ? new Date(item.last_time).toLocaleDateString() : ""}</Text>
              </View>
              <Text numberOfLines={1} style={styles.lastMsg}>
                {item.last_message?.text ?? "點擊開始聊天"}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1e293b' },
  listContent: { paddingVertical: 8 },
  chatItem: { flexDirection: 'row', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  chatInfo: { flex: 1, marginLeft: 16, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  name: { fontSize: 17, fontWeight: '700', color: '#1e293b' },
  time: { fontSize: 12, color: '#94a3b8' },
  lastMsg: { fontSize: 14, color: '#64748b' },
  emptyContainer: { alignItems: 'center', marginTop: 150 },
  emptyText: { color: '#94a3b8', marginTop: 16, fontSize: 16 },
});