import { addDoc, collection, getDocs, onSnapshot, query, Unsubscribe, where } from "firebase/firestore";
import type { Message } from "../types/chat";
import { db } from "./firebase";

/**
 * 生成對話 ID（確保兩個方向都相同）
 */
function getConversationId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join("_");
}

/**
 * 獲取兩個用戶之間的訊息
 */
export async function getMessagesFromFirestore(
  userId: string,
  friendId: string
): Promise<Message[]> {
  try {
    const conversationId = getConversationId(userId, friendId);
    
    const q = query(
      collection(db, "messages"),
      where("conversation", "==", conversationId)
    );

    const querySnapshot = await getDocs(q);
    const messages: Message[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        sender_id: data.sender_id,
        receiver_id: data.receiver_id,
        text: data.text,
        created_at: data.created_at,
      });
    });

    // 在客戶端排序
    messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return messages;
  } catch (error) {
    console.error("Error getting messages:", error);
    throw error;
  }
}

/**
 * 監聽訊息更新 (實時)
 */
export function listenToMessages(
  userId: string,
  friendId: string,
  callback: (messages: Message[]) => void
): Unsubscribe {
  const conversationId = getConversationId(userId, friendId);
  console.log(`[listenToMessages] userId: ${userId}, friendId: ${friendId}, conversationId: ${conversationId}`);
  
  // 簡化查詢：只用 where，在客戶端排序
  const q = query(
    collection(db, "messages"),
    where("conversation", "==", conversationId)
  );

  return onSnapshot(
    q,
    (querySnapshot) => {
      const messages: Message[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        messages.push({
          id: doc.id,
          sender_id: data.sender_id,
          receiver_id: data.receiver_id,
          text: data.text,
          created_at: data.created_at,
        });
      });

      // 在客戶端排序
      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      console.log(`[listenToMessages] Received ${messages.length} messages for conversation ${conversationId}`);
      callback(messages);
    },
    (error) => {
      console.error(`[listenToMessages] Error listening to messages:`, error);
    }
  );
}

/**
 * 發送訊息
 */
export async function sendMessageToFirestore(
  senderId: string,
  receiverId: string,
  text: string
): Promise<Message> {
  try {
    const conversationId = getConversationId(senderId, receiverId);
    console.log(`[sendMessageToFirestore] Sending message: senderId=${senderId}, receiverId=${receiverId}, conversationId=${conversationId}, text="${text}"`);

    const messageData = {
      sender_id: senderId,
      receiver_id: receiverId,
      text: text.trim(),
      conversation: conversationId,
      created_at: new Date().toISOString(),
    };

    console.log(`[sendMessageToFirestore] Message data:`, messageData);

    const docRef = await addDoc(collection(db, "messages"), messageData);
    console.log(`[sendMessageToFirestore] Message saved successfully with ID: ${docRef.id}`);

    return {
      id: docRef.id,
      sender_id: senderId,
      receiver_id: receiverId,
      text: text.trim(),
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[sendMessageToFirestore] Error sending message:", error);
    throw error;
  }
}
