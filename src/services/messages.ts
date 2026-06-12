import { addDoc, collection, getDocs, onSnapshot, orderBy, query, Unsubscribe, where } from "firebase/firestore";
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
      where("conversation", "==", conversationId),
      orderBy("created_at", "asc")
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
  
  const q = query(
    collection(db, "messages"),
    where("conversation", "==", conversationId),
    orderBy("created_at", "asc")
  );

  return onSnapshot(q, (querySnapshot) => {
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

    callback(messages);
  });
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

    const docRef = await addDoc(collection(db, "messages"), {
      sender_id: senderId,
      receiver_id: receiverId,
      text: text.trim(),
      conversation: conversationId,
      created_at: new Date().toISOString(),
    });

    return {
      id: docRef.id,
      sender_id: senderId,
      receiver_id: receiverId,
      text: text.trim(),
      created_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
}
