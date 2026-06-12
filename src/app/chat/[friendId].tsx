import {
  Redirect,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
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
import { getUserData } from "../../services/firestore";
import { listenToMessages, sendMessageToFirestore } from "../../services/messages";
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

  useFocusEffect(
    useCallback(() => {
      if (!user || !friendId) return;

      let isActive = true;

      (async () => {
        try {
          const data = await getUserData(friendId);
          if (isActive) {
            setFriendData(data);
          }
        } catch (err) {
          console.error("Error loading friend data:", err);
        }
      })();

      const unsubscribe = listenToMessages(user.id, friendId, (newMessages) => {
        if (isActive) {
          setMessages(newMessages);
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

  if (!user) {
    return <Redirect href="/" />;
  }

  const onSend = async () => {
    if (!text.trim() || !friendId) return;
    const draft = text.trim();
    setText("");
    setError("");
    try {
      await sendMessageToFirestore(user.id, friendId, draft);
    } catch (err) {
      setText(draft);
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <Stack.Screen options={{ title: friendData?.name || "Chat" }} />
      {error ? (
        <Text style={[commonStyles.error, styles.error]}>{error}</Text>
      ) : null}
      <FlatList
        ref={messageListRef}
        contentContainerStyle={styles.messages}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMine = item.sender_id === user.id;
          return (
            <View style={[styles.bubbleRow, isMine && styles.myBubbleRow]}>
              {!isMine && friendData && (
                <UserAvatar
                  name={friendData.name}
                  uri={friendData.avatar_url}
                  size={32}
                />
              )}
              <View
                style={[
                  styles.bubble,
                  isMine ? styles.myBubble : styles.friendBubble,
                ]}
              >
                <Text
                  style={[styles.messageText, isMine && styles.myMessageText]}
                >
                  {item.text}
                </Text>
                <Text
                  style={[styles.messageTime, isMine && styles.myMessageTime]}
                >
                  {formatTime(item.created_at)}
                </Text>
              </View>
              {isMine && user && (
                <UserAvatar
                  name={user.name}
                  uri={user.avatar_url}
                  size={32}
                />
              )}
            </View>
          );
        }}
      />
      <View style={styles.inputBar}>
        <TextInput
          multiline
          placeholder="Type a message"
          style={[commonStyles.input, styles.messageInput]}
          value={text}
          onChangeText={setText}
        />
        <Pressable style={styles.sendButton} onPress={onSend}>
          <Text style={commonStyles.buttonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble: {
    borderRadius: 8,
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleRow: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 8,
  },
  container: {
    backgroundColor: "#f8fafc",
    flex: 1,
  },
  error: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  friendBubble: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderWidth: 1,
  },
  inputBar: {
    alignItems: "flex-end",
    backgroundColor: "#ffffff",
    borderTopColor: "#e2e8f0",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 12,
  },
  messageInput: {
    flex: 1,
    maxHeight: 120,
  },
  messageText: {
    color: "#0f172a",
    fontSize: 16,
    lineHeight: 22,
  },
  messageTime: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  messages: {
    gap: 10,
    padding: 16,
  },
  myBubble: {
    backgroundColor: "#2563eb",
  },
  myBubbleRow: {
    justifyContent: "flex-end",
  },
  myMessageText: {
    color: "#ffffff",
  },
  myMessageTime: {
    color: "#dbeafe",
  },
  sendButton: {
    ...commonStyles.button,
    minWidth: 76,
  },
});
