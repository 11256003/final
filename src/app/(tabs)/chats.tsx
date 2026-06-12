import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { commonStyles } from "../../components/styles";
import { UserAvatar } from "../../components/UserAvatar";
import { useAuth } from "../../context/AuthContext";
import { listenToChatsList } from "../../services/chats";
import type { ChatSummary } from "../../types/chat";

function formatTime(value: string | null) {
  if (!value) return "尚無訊息";
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "現在";
  if (diffMins < 60) return `${diffMins}分鐘前`;
  if (diffHours < 24) return `${diffHours}小時前`;
  if (diffDays < 7) return `${diffDays}天前`;
  
  return date.toLocaleDateString();
}

export default function ChatsScreen() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      let isActive = true;

      // 使用實時聊天列表監聽
      const unsubscribe = listenToChatsList(user.id, (newChats) => {
        if (isActive) {
          setChats(newChats);
        }
      });

      return () => {
        isActive = false;
        unsubscribe();
      };
    }, [user]),
  );

  return (
    <Screen>
      {error ? <Text style={commonStyles.error}>{error}</Text> : null}
      <FlatList
        contentContainerStyle={styles.list}
        data={chats}
        keyExtractor={(item) => item.friend.id}
        ListEmptyComponent={
          <Text style={styles.empty}>聊天列表目前是空的</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={commonStyles.row}
            onPress={() => router.push(`/chat/${item.friend.id}`)}
          >
            <UserAvatar name={item.friend.name} uri={item.friend.avatar_url} />
            <View style={styles.rowText}>
              <View style={styles.titleRow}>
                <Text style={commonStyles.rowTitle}>{item.friend.name}</Text>
                <Text style={styles.time}>{formatTime(item.last_time)}</Text>
              </View>
              <Text numberOfLines={1} style={commonStyles.rowMeta}>
                {item.last_message?.text ?? "點擊開始聊天"}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    color: "#64748b",
    paddingTop: 32,
    textAlign: "center",
  },
  list: {
    gap: 10,
    paddingBottom: 24,
  },
  rowText: {
    flex: 1,
  },
  time: {
    color: "#64748b",
    fontSize: 12,
  },
  titleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
});
