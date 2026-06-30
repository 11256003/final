import { collection, doc, getDoc, getDocs, onSnapshot, query, Unsubscribe, where, writeBatch } from "firebase/firestore";
import type { ChatSummary, Message, User } from "../types/chat";
import { db } from "./firebase";

function getConversationId(userId: string, friendId: string) {
  return [userId, friendId].sort().join("_");
}

function toUser(id: string, data: any): User {
  return {
    id,
    username: data.username,
    name: data.name,
    birthday: data.birthday || null,
    avatar_url: data.avatar_url || null,
    bio: data.bio || null,
    created_at: data.created_at,
  };
}

function toMessage(id: string, data: any): Message {
  return {
    id,
    sender_id: data.sender_id,
    receiver_id: data.receiver_id,
    text: data.text,
    created_at: data.created_at,
    isRead: !!data.isRead,
  };
}

async function buildChatSummary(userId: string, friendId: string): Promise<ChatSummary | null> {
  const friendDoc = await getDoc(doc(db, "users", friendId));
  if (!friendDoc.exists()) return null;

  const conversationId = getConversationId(userId, friendId);
  const messagesSnap = await getDocs(
    query(collection(db, "messages"), where("conversation", "==", conversationId)),
  );

  let lastMessage: Message | null = null;
  let lastTime: string | null = null;
  let unreadCount = 0;

  messagesSnap.forEach((messageDoc) => {
    const message = toMessage(messageDoc.id, messageDoc.data());

    if (message.receiver_id === userId && !message.isRead) {
      unreadCount += 1;
    }

    if (!lastMessage || new Date(message.created_at).getTime() > new Date(lastMessage.created_at).getTime()) {
      lastMessage = message;
      lastTime = message.created_at;
    }
  });

  return {
    friend: toUser(friendId, friendDoc.data()),
    last_message: lastMessage,
    last_time: lastTime,
    unread_count: unreadCount,
  };
}

async function loadChats(userId: string, friendIds: string[]) {
  const chats = (await Promise.all(friendIds.map((friendId) => buildChatSummary(userId, friendId)))).filter(
    (chat): chat is ChatSummary => chat !== null,
  );

  chats.sort((a, b) => {
    const aTime = a.last_time ? new Date(a.last_time).getTime() : 0;
    const bTime = b.last_time ? new Date(b.last_time).getTime() : 0;
    return bTime - aTime;
  });

  return chats;
}

export async function getChatsList(userId: string): Promise<ChatSummary[]> {
  const userDoc = await getDoc(doc(db, "users", userId));

  if (!userDoc.exists()) {
    throw new Error("User not found");
  }

  const friendIds = userDoc.data().friends || [];
  if (friendIds.length === 0) return [];

  return loadChats(userId, friendIds);
}

export function listenToChatsList(userId: string, callback: (chats: ChatSummary[]) => void): Unsubscribe {
  const userRef = doc(db, "users", userId);
  const unreadMessagesQuery = query(collection(db, "messages"), where("receiver_id", "==", userId));
  let friendIds: string[] = [];
  let isDisposed = false;
  let loadVersion = 0;

  const refresh = async () => {
    const version = ++loadVersion;

    try {
      if (friendIds.length === 0) {
        callback([]);
        return;
      }

      const chats = await loadChats(userId, friendIds);
      if (!isDisposed && version === loadVersion) {
        callback(chats);
      }
    } catch (error) {
      console.error("[listenToChatsList] Error loading chats:", error);
      if (!isDisposed) callback([]);
    }
  };

  const unsubscribeUser = onSnapshot(userRef, (userDoc) => {
    if (!userDoc.exists()) {
      friendIds = [];
      callback([]);
      return;
    }

    friendIds = userDoc.data().friends || [];
    void refresh();
  });

  const unsubscribeUnreadMessages = onSnapshot(unreadMessagesQuery, () => {
    void refresh();
  });

  return () => {
    isDisposed = true;
    unsubscribeUser();
    unsubscribeUnreadMessages();
  };
}

/**
 * ✨ 新增：將特定聊天室內所有發給我的未讀訊息標記為已讀
 */
export async function markChatAsRead(userId: string, friendId: string): Promise<void> {
  try {
    const conversationId = getConversationId(userId, friendId);
    const messagesRef = collection(db, "messages");
    
    // 找出該聊天室內的所有訊息
    const q = query(messagesRef, where("conversation", "==", conversationId));
    const snapshot = await getDocs(q);

    // 使用 Firestore Batch 批次寫入，效率高且省流量
    const batch = writeBatch(db);
    let hasUpdates = false;

    snapshot.forEach((messageDoc) => {
      const data = messageDoc.data();
      // 條件：如果我是接收者，而且這則訊息還沒有被標記已讀
      if (data.receiver_id === userId && !data.isRead) {
        batch.update(messageDoc.ref, { isRead: true });
        hasUpdates = true;
      }
    });

    // 只有當真的有需要更新的訊息時，才執行 commit
    if (hasUpdates) {
      await batch.commit();
    }
  } catch (error) {
    //console.error("[markChatAsRead] 標記已讀狀態時發生錯誤:", error);
  }
}