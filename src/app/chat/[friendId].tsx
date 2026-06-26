import {
  Redirect,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore"; // 1. 新增此處
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
import { db } from "../../services/firebase"; // 2. 確保匯入 db
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
  const messageListRef = useRef<FlatList<Message>>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [friendData, setFriendData] = useState<User | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      if (!user || !friendId) return;

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
        if (isActive) {
          setMessages(newMessages);
          
          // 接收方：對所有對方發來的訊息新增讀取紀錄
          for (const msg of newMessages) {
            if (msg.sender_id === friendId && msg.receiver_id === user.id) {
              await addReadReceipt(msg.id, user.id);
            }
          }
          
          // 監聽所有自己發出去訊息的已讀狀態
          const readIds = new Set<string>();
          for (const msg of newMessages) {
            if (msg.sender_id === user.id) {
              const unsubRead = listenToMessageReadStatus(msg.id, (isRead) => {
                if (isRead) {
                  setReadMessageIds(prev => new Set([...prev, msg.id]));
                }
              });
            }
          }
        }
      });

      return () => {
        isActive = false;
        unsubscribe();
      };
    }, [friendId, user]),
  );

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() =>
      messageListRef.current?.scrollToEnd({ animated: true }),
    );
  }, [messages]);

  if (!user) return <Redirect href="/" />;

  const onSend = async () => {
    if (!text.trim() || !friendId || !user) return;
    const draft = text.trim();
    setText("");
    setError("");

    try {
      // A. 發送訊息
      await sendMessageToFirestore(user.id, friendId, draft);
      
      // B. 更新使用者的最後更新時間，這會觸發你 service 中的 onSnapshot 監聽器，讓左邊清單更新
      await updateDoc(doc(db, "users", user.id), {
        
        lastUpdated: serverTimestamp()
      });
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send message";
      console.error("[onSend] Error:", errorMsg);
      setText(draft);
      setError(errorMsg);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <Stack.Screen options={{ title: friendData?.name || "Chat" }} />
      {error ? <Text style={[commonStyles.error, styles.error]}>{error}</Text> : null}
      
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
                <UserAvatar name={friendData.name} uri={friendData.avatar_url} size={32} />
              )}
              <View style={[styles.bubble, isMine ? styles.myBubble : styles.friendBubble]}>
                <Text style={[styles.messageText, isMine && styles.myMessageText]}>
                  {item.text}
                </Text>
                <View style={styles.messageFooter}>
                  <Text style={[styles.messageTime, isMine && styles.myMessageTime]}>
                    {formatTime(item.created_at)}
                  </Text>
                  {isMine && (
                    <Text style={[styles.readMark, isRead ? styles.readMarkRead : styles.readMarkUnread]}>
                      {isRead ? "✓✓" : "✓"}
                    </Text>
                  )}
                </View>
              </View>
              {isMine && user && (
                <UserAvatar name={user.name} uri={user.avatar_url} size={32} />
              )}
            </View>
          );
        }}
      />

      <View style={styles.inputBar}>
        <TextInput
          multiline
          placeholder="請輸入發送內容"
          style={[commonStyles.input, styles.messageInput]}
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.sendButton} onPress={onSend}>
          <Text style={commonStyles.buttonText}>傳送</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: { borderRadius: 8, maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 9 },
  bubbleRow: { alignItems: "flex-end", flexDirection: "row", gap: 8 },
  container: { backgroundColor: "#f8fafc", flex: 1 },
  error: { paddingHorizontal: 16, paddingTop: 12 },
  friendBubble: { backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderWidth: 1 },
  inputBar: { alignItems: "flex-end", backgroundColor: "#ffffff", borderTopColor: "#e2e8f0", borderTopWidth: 1, flexDirection: "row", gap: 8, padding: 12 },
  messageInput: { flex: 1, maxHeight: 120 },
  messageText: { color: "#0f172a", fontSize: 16, lineHeight: 22 },
  messageTime: { color: "#64748b", fontSize: 11, marginTop: 4 },
  messageFooter: { alignItems: "center", flexDirection: "row", gap: 4, justifyContent: "flex-end", marginTop: 4 },
  readMark: { fontSize: 10, marginLeft: 2 },
  readMarkRead: { color: "#dbeafe" },
  readMarkUnread: { color: "#94a3b8" },
  messages: { gap: 10, padding: 16 },
  myBubble: { backgroundColor: "#2563eb" },
  myBubbleRow: { justifyContent: "flex-end" },
  myMessageText: { color: "#ffffff" },
  myMessageTime: { color: "#dbeafe" },
  sendButton: { ...commonStyles.button, minWidth: 76 },
});