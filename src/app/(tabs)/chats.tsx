import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { getChatsList } from "../../services/chats";

function formatChatDate(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  return isToday
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString();
}

export default function ChatsScreen() {
  const { user, chats } = useAuth();

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      getChatsList(user.id).catch((err) => {
        console.error("[ChatsScreen] Error refreshing chats on focus:", err);
      });
    }, [user]),
  );

  const onRefresh = useCallback(async () => {
    if (!user) return;

    try {
      await getChatsList(user.id);
    } catch (error) {
      console.error("[ChatsScreen] Error refreshing chats:", error);
    }
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>聊天</Text>
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.friend.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>還沒有聊天紀錄</Text>
          </View>
        }
        renderItem={({ item }) => {
          const hasUnread = item.unread_count > 0;

          return (
            <Pressable style={[styles.chatItem, hasUnread && styles.unreadChatItem]} onPress={() => router.push(`/chat/${item.friend.id}`)}>
              <View>
                <UserAvatar name={item.friend.name} uri={item.friend.avatar_url ?? undefined} size={56} />
                {hasUnread ? <View style={styles.avatarDot} /> : null}
              </View>

              <View style={styles.chatInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, hasUnread && styles.unreadName]}>{item.friend.name}</Text>
                  <Text style={[styles.time, hasUnread && styles.unreadTime]}>{formatChatDate(item.last_time)}</Text>
                </View>

                <View style={styles.messageRow}>
                  <Text numberOfLines={1} style={[styles.lastMsg, hasUnread && styles.unreadLastMsg]}>
                    {item.last_message?.text ?? "還沒有訊息"}
                  </Text>
                  {hasUnread ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{item.unread_count > 99 ? "99+" : item.unread_count}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  header: { padding: 24, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  headerTitle: { fontSize: 28, fontWeight: "800", color: "#1e293b" },
  listContent: { paddingVertical: 8 },
  chatItem: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  unreadChatItem: { backgroundColor: "#f8fbff" },
  avatarDot: {
    position: "absolute",
    right: 1,
    top: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563eb",
    borderWidth: 2,
    borderColor: "#fff",
  },
  chatInfo: { flex: 1, marginLeft: 16, justifyContent: "center" },
  nameRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  name: { flex: 1, fontSize: 17, fontWeight: "700", color: "#1e293b" },
  unreadName: { color: "#0f172a", fontWeight: "800" },
  time: { fontSize: 12, color: "#94a3b8" },
  unreadTime: { color: "#2563eb", fontWeight: "700" },
  messageRow: { alignItems: "center", flexDirection: "row", gap: 12 },
  lastMsg: { flex: 1, fontSize: 14, color: "#64748b" },
  unreadLastMsg: { color: "#1e293b", fontWeight: "700" },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  unreadBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  emptyContainer: { alignItems: "center", marginTop: 150 },
  emptyText: { color: "#94a3b8", marginTop: 16, fontSize: 16 },
});
