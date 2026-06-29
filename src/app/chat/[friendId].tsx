import { Redirect, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useHeaderHeight } from "expo-router/react-navigation";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { commonStyles } from "../../components/styles";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../services/firebase";
import { getUserData } from "../../services/firestore";
import { addReadReceipt, listenToMessageReadStatus, listenToMessages, sendMessageToFirestore } from "../../services/messages";
import type { Message, User } from "../../types/chat";

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatRoomScreen() {
  const { user } = useAuth();
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const headerHeight = useHeaderHeight();
  const messageListRef = useRef<FlatList<Message>>(null);
  const markedAsReadRef = useRef<Set<string>>(new Set());
  const readListenersRef = useRef<Map<string, () => void>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());
  const [friendData, setFriendData] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!user || !friendId) return undefined;

      let isActive = true;

      (async () => {
        try {
          const data = await getUserData(friendId);
          if (isActive) setFriendData(data);
        } catch (err) {
          console.error("Error loading friend data:", err);
        }
      })();

      const unsubscribe = listenToMessages(user.id, friendId, async (newMessages) => {
        if (!isActive) return;
        setMessages(newMessages);

        for (const msg of newMessages) {
          if (msg.sender_id === friendId && msg.receiver_id === user.id && !markedAsReadRef.current.has(msg.id)) {
            markedAsReadRef.current.add(msg.id);
            try {
              await addReadReceipt(msg.id, user.id);
            } catch (err) {
              console.error("Failed to add read receipt:", err);
            }
          }
        }

        for (const msg of newMessages) {
          if (msg.sender_id !== user.id || readListenersRef.current.has(msg.id)) continue;

          const unsubscribeRead = listenToMessageReadStatus(msg.id, (isRead: boolean) => {
            if (!isRead || !isActive) return;

            setReadMessageIds((prev) => {
              const next = new Set(prev);
              next.add(msg.id);
              return next;
            });
          });

          readListenersRef.current.set(msg.id, unsubscribeRead);
        }
      });

      return () => {
        isActive = false;
        unsubscribe();
        readListenersRef.current.forEach((unsubscribeRead) => unsubscribeRead());
        readListenersRef.current.clear();
        markedAsReadRef.current.clear();
      };
    }, [friendId, user]),
  );

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => messageListRef.current?.scrollToEnd({ animated: true }));
  }, [messages]);

  if (!user) return <Redirect href="/" />;

  const onSend = async () => {
    if (!text.trim() || !friendId || !user) return;

    const draft = text.trim();
    setText("");
    setError("");

    try {
      await sendMessageToFirestore(user.id, friendId, draft);
      await updateDoc(doc(db, "users", user.id), {
        lastUpdated: serverTimestamp(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send message";
      console.error("[onSend] Error:", errorMessage);
      setText(draft);
      setError(errorMessage);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={headerHeight}
      style={styles.container}
    >
      <Stack.Screen options={{ title: friendData?.name || "Chat" }} />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <FlatList
        ref={messageListRef}
        contentContainerStyle={styles.messages}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMine = item.sender_id === user.id;
          const isRead = readMessageIds.has(item.id);

          return (
            <View style={[styles.bubbleRow, isMine && styles.myBubbleRow]}>
              {!isMine && friendData && (
                <UserAvatar name={friendData.name} uri={friendData.avatar_url ?? undefined} size={32} />
              )}

              {isMine && (
                <View style={styles.statusContainerRight}>
                  {isRead && <Text style={styles.chatStatusText}>已讀</Text>}
                  <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
                </View>
              )}

              <View style={[styles.bubble, isMine ? styles.myBubble : styles.friendBubble]}>
                <Text style={[styles.messageText, isMine && styles.myMessageText]}>{item.text}</Text>
              </View>

              {!isMine && (
                <View style={styles.statusContainerLeft}>
                  <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
                </View>
              )}

              {isMine && <UserAvatar name={user.name} uri={user.avatar_url ?? undefined} size={32} />}
            </View>
          );
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          multiline
          placeholder="輸入訊息"
          style={[commonStyles.input, styles.messageInput]}
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.sendButton} onPress={onSend}>
          <Text style={commonStyles.buttonText}>送出</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  statusContainerRight: {
    justifyContent: "flex-end",
    alignItems: "flex-end",
    marginBottom: 2,
  },
  statusContainerLeft: {
    justifyContent: "flex-end",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  chatStatusText: {
    fontSize: 11,
    color: "#94a3b8",
    marginBottom: 2,
    fontWeight: "600",
  },
  messageTime: {
    color: "#94a3b8",
    fontSize: 10,
  },
  bubble: { borderRadius: 8, maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 9 },
  bubbleRow: { alignItems: "flex-end", flexDirection: "row", gap: 8 },
  container: { backgroundColor: "#f8fafc", flex: 1 },
  error: { color: "#dc2626", paddingHorizontal: 16, paddingTop: 12 },
  friendBubble: { backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderWidth: 1 },
  inputBar: {
    alignItems: "flex-end",
    backgroundColor: "#ffffff",
    borderTopColor: "#e2e8f0",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  messageInput: { flex: 1, maxHeight: 120 },
  messageText: { color: "#0f172a", fontSize: 16, lineHeight: 22 },
  messages: { gap: 10, padding: 16 },
  myBubble: { backgroundColor: "#2563eb" },
  myBubbleRow: { justifyContent: "flex-end" },
  myMessageText: { color: "#ffffff" },
  sendButton: { ...commonStyles.button, minWidth: 76 },
});
