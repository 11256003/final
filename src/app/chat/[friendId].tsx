import { useHeaderHeight } from '@react-navigation/elements';
import {
  Redirect,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
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
        if (!isActive) return;
        setMessages(newMessages);
        
        // A. 接收方：對「新收到」的對方訊息新增讀取紀錄（利用 Ref 阻斷重複觸發的無限迴圈）
        for (const msg of newMessages) {
          if (msg.sender_id === friendId && msg.receiver_id === user.id) {
            if (!markedAsReadRef.current.has(msg.id)) {
              markedAsReadRef.current.add(msg.id);
              try {
                await addReadReceipt(msg.id, user.id);
              } catch (e) {
                console.error("Failed to add read receipt:", e);
              }
            }
          }
        }
        
        // B. 發送方：動態監聽自己發出去訊息的已讀狀態（利用 Map 確保每則訊息只有一個監聽器）
        for (const msg of newMessages) {
          if (msg.sender_id === user.id) {
            if (!readListenersRef.current.has(msg.id)) {
              const unsubRead = listenToMessageReadStatus(msg.id, (isRead:boolean) => {
                if (isRead && isActive) {
                  setReadMessageIds(prev => {
                    const next = new Set(prev);
                    next.add(msg.id);
                    return next;
                  });
                }
              });
              // 將解鎖函式存入 Map 中
              readListenersRef.current.set(msg.id, unsubRead);
            }
          }
        }
      });

      return () => {
        isActive = false;
        unsubscribe();
        // 🌟 離開聊天室時，一口氣把所有訊息的監聽器全部關閉，釋放記憶體
        readListenersRef.current.forEach((unsub) => unsub());
        readListenersRef.current.clear();
        markedAsReadRef.current.clear();
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
      // 🌟 1. 稍微調整一下 behavior，讓 Android 也能有更好的適應性
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      
      // 🌟 直接餵給它最精準的動態高度！
      keyboardVerticalOffset={headerHeight}
      
      style={styles.container}
    >
      <Stack.Screen options={{ title: friendData?.name || "Chat" }} />
      
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
              {/* 1. 對方的頭貼 (在最左邊) */}
              {!isMine && friendData && (
                <UserAvatar name={friendData.name} uri={friendData.avatar_url ?? undefined} size={32} />
              )}

              {isMine && (
                <View style={styles.statusContainerRight}>
                {isRead && <Text style={styles.chatStatusText}>已讀</Text>}
                <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
                </View>
                )}

              {/* 3. 對話泡泡本體 */}
              <View style={[styles.bubble, isMine ? styles.myBubble : styles.friendBubble]}>
                <Text style={[styles.messageText, isMine && styles.myMessageText]}>
                  {item.text}
                </Text>
              </View>

              {/* 4. 對方的訊息：「時間」放在泡泡右下角 */}
              {!isMine && (
                <View style={styles.statusContainerLeft}>
                  <Text style={styles.messageTime}>{formatTime(item.created_at)}</Text>
                </View>
              )}

              {/* 5. 自己的頭貼 (在最右邊) */}
              {isMine && user && (
                <UserAvatar name={user.name} uri={user.avatar_url ?? undefined} size={32} />
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
  // 👇 把這四個缺失的樣式貼進你的 styles 裡面
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
  error: { paddingHorizontal: 16, paddingTop: 12 },
  friendBubble: { backgroundColor: "#ffffff", borderColor: "#e2e8f0", borderWidth: 1 },
  inputBar: { alignItems: "flex-end", backgroundColor: "#ffffff", borderTopColor: "#e2e8f0", borderTopWidth: 1, flexDirection: "row", gap: 8, padding: 12 },
  messageInput: { flex: 1, maxHeight: 120 },
  messageText: { color: "#0f172a", fontSize: 16, lineHeight: 22 },
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
