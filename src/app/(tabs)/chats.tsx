import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { getChatsList, markChatAsRead } from "../../services/chats";

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
  
  // ✨ 新增：用於前端「樂觀更新」的快取狀態，記錄哪些好友的聊天已經被點擊/看過
  const [localReadChats, setLocalReadChats] = useState<Record<string, boolean>>({});
  // ✨ 新增：記錄最後一次點擊進入的對象，用於從聊天室跳回列表時的防禦性歸零
  const [lastVisitedFriendId, setLastVisitedFriendId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      // ✨ 核心優化：從聊天室跳回列表的瞬間，立刻強制把剛剛離開的聊天室在本地端設為已讀（歸零）
      if (lastVisitedFriendId) {
        setLocalReadChats((prev) => ({ ...prev, [lastVisitedFriendId]: true }));
      }

      getChatsList(user.id)
        .then(() => {
          // 當成功從 Firebase 拿回最新真實資料後，清空本地快取，讓畫面完全與後端同步
          setLocalReadChats({});
          setLastVisitedFriendId(null);
        })
        .catch((err) => {
          console.error("[ChatsScreen] Error refreshing chats on focus:", err);
        });
    }, [user, lastVisitedFriendId]),
  );

  const onRefresh = useCallback(async () => {
    if (!user) return;

    try {
      await getChatsList(user.id);
      setLocalReadChats({}); // 重新整理時也同步清空
      setLastVisitedFriendId(null);
    } catch (error) {
      console.error("[ChatsScreen] Error refreshing chats:", error);
    }
  }, [user]);

  // 處理點擊聊天項目：先觸發前端秒歸零 + 後端標記已讀，再切換進入聊天室
  const handleChatPress = async (friendId: string) => {
    if (!user) return;
    
    // 💡 1. 紀錄這次造訪的聊天室，並在本地狀態瞬間設為已讀
    setLastVisitedFriendId(friendId);
    setLocalReadChats((prev) => ({ ...prev, [friendId]: true }));

    try {
      // 2. 呼叫 Firebase 將發給我的未讀訊息改為已讀
      await markChatAsRead(user.id, friendId); 
    } catch (error) {
      console.error("[ChatsScreen] 標記已讀失敗:", error);
    }

    // 3. 前往聊天室
    router.push(`/chat/${friendId}`);
  };

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
          // ✨ 3. 結合本地樂觀更新狀態，計算當前即時的未讀數量與狀態
          const isClearedLocally = localReadChats[item.friend.id];
          const unreadCount = isClearedLocally ? 0 : item.unread_count;
          const hasUnread = unreadCount > 0;
          
          // 判斷最後一則訊息是否是你發送的
          const isLastMessageMine = item.last_message?.sender_id === user?.id;

          return (
            <Pressable 
              style={[styles.chatItem, hasUnread && styles.unreadChatItem]} 
              onPress={() => handleChatPress(item.friend.id)}
            >
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
                  
                  {/* 狀態顯示邏輯 */}
                  {hasUnread ? (
                    // 如果有未讀（代表對方傳給你的），顯示藍色數字圈圈
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                    </View>
                  ) : item.last_message ? (
                    // 沒有未讀，且有歷史訊息
                    isLastMessageMine ? (
                      // 如果最後一則是你發的，依照是否已讀顯示不同勾勾
                      <View style={styles.readCheckmark}>
                        {item.last_message.isRead ? (
                           // 已讀：藍色雙勾
                          <Ionicons name="checkmark-done" size={18} color="#3b82f6" />
                        ) : (
                           // 未讀：灰色單勾
                          <Ionicons name="checkmark" size={18} color="#94a3b8" />
                        )}
                      </View>
                    ) : null // 如果最後一則是對方發的（且已讀），就不顯示任何圖示
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
  readCheckmark: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: { alignItems: "center", marginTop: 150 },
  emptyText: { color: "#94a3b8", marginTop: 16, fontSize: 16 },
});