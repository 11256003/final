import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, Unsubscribe, where } from "firebase/firestore";
import type { ChatSummary, Message, User } from "../types/chat";
import { db } from "./firebase";

/**
 * 從 Firestore 獲取聊天列表（所有好友及最後一筆訊息）
 */
export async function getChatsList(userId: string): Promise<ChatSummary[]> {
  try {
    // 獲取用戶的好友列表
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error("User not found");
    }

    const friendIds = userDoc.data().friends || [];
    if (friendIds.length === 0) {
      return [];
    }

    const chats: ChatSummary[] = [];

    // 對於每個好友，獲取最後一筆訊息
    for (const friendId of friendIds) {
      // 獲取好友資料
      const friendDoc = await getDoc(doc(db, "users", friendId));
      if (!friendDoc.exists()) continue;

      const friend: User = {
        id: friendId,
        username: friendDoc.data().username,
        name: friendDoc.data().name,
        birthday: friendDoc.data().birthday || null,
        avatar_url: friendDoc.data().avatar_url || null,
        created_at: friendDoc.data().created_at,
      };

      // 獲取最後一筆訊息
      const conversationId = [userId, friendId].sort().join("_");
      const messagesRef = query(
        collection(db, "messages"),
        where("conversation", "==", conversationId),
        orderBy("created_at", "desc"),
        limit(1)
      );

      const messagesSnap = await getDocs(messagesRef);
      let lastMessage: Message | null = null;
      let lastTime: string | null = null;

      if (!messagesSnap.empty) {
        const messageData = messagesSnap.docs[0].data();
        lastMessage = {
          id: messagesSnap.docs[0].id,
          sender_id: messageData.sender_id,
          receiver_id: messageData.receiver_id,
          text: messageData.text,
          created_at: messageData.created_at,
        };
        lastTime = messageData.created_at;
      }

      chats.push({
        friend,
        last_message: lastMessage,
        last_time: lastTime,
      });
    }

    // 按最後訊息時間排序
    chats.sort((a, b) => {
      const aTime = a.last_time ? new Date(a.last_time).getTime() : 0;
      const bTime = b.last_time ? new Date(b.last_time).getTime() : 0;
      return bTime - aTime;
    });

    return chats;
  } catch (error) {
    console.error("Error getting chats list:", error);
    throw error;
  }
}

/**
 * 監聽聊天列表更新（實時）
 */
export function listenToChatsList(userId: string, callback: (chats: ChatSummary[]) => void): Unsubscribe {
  const userRef = doc(db, "users", userId);

  return onSnapshot(userRef, async (userDoc) => {
    try {
      if (!userDoc.exists()) {
        callback([]);
        return;
      }

      const friendIds = userDoc.data().friends || [];
      if (friendIds.length === 0) {
        callback([]);
        return;
      }

      const chats: ChatSummary[] = [];

      // 對於每個好友，獲取最後一筆訊息
      for (const friendId of friendIds) {
        const friendDoc = await getDoc(doc(db, "users", friendId));
        if (!friendDoc.exists()) continue;

        const friend: User = {
          id: friendId,
          username: friendDoc.data().username,
          name: friendDoc.data().name,
          birthday: friendDoc.data().birthday || null,
          avatar_url: friendDoc.data().avatar_url || null,
          created_at: friendDoc.data().created_at,
        };

        const conversationId = [userId, friendId].sort().join("_");
        const messagesRef = query(
          collection(db, "messages"),
          where("conversation", "==", conversationId),
          orderBy("created_at", "desc"),
          limit(1)
        );

        const messagesSnap = await getDocs(messagesRef);
        let lastMessage: Message | null = null;
        let lastTime: string | null = null;

        if (!messagesSnap.empty) {
          const messageData = messagesSnap.docs[0].data();
          lastMessage = {
            id: messagesSnap.docs[0].id,
            sender_id: messageData.sender_id,
            receiver_id: messageData.receiver_id,
            text: messageData.text,
            created_at: messageData.created_at,
          };
          lastTime = messageData.created_at;
        }

        chats.push({
          friend,
          last_message: lastMessage,
          last_time: lastTime,
        });
      }

      chats.sort((a, b) => {
        const aTime = a.last_time ? new Date(a.last_time).getTime() : 0;
        const bTime = b.last_time ? new Date(b.last_time).getTime() : 0;
        return bTime - aTime;
      });

      callback(chats);
    } catch (error) {
      console.error("Error in listenToChatsList:", error);
    }
  });
}
