import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import type { Message } from "../types/chat";
import { db } from "./firebase";

function getConversationId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join("_");
}

export async function getMessagesFromFirestore(userId: string, friendId: string): Promise<Message[]> {
  try {
    const conversationId = getConversationId(userId, friendId);
    const q = query(collection(db, "messages"), where("conversation", "==", conversationId));
    const querySnapshot = await getDocs(q);
    const messages: Message[] = [];

    querySnapshot.forEach((messageDoc) => {
      const data = messageDoc.data();
      messages.push({
        id: messageDoc.id,
        sender_id: data.sender_id,
        receiver_id: data.receiver_id,
        text: data.text,
        created_at: data.created_at,
        isRead: !!data.isRead,
      });
    });

    messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return messages;
  } catch (error) {
    console.error("Error getting messages:", error);
    throw error;
  }
}

export function listenToMessages(
  userId: string,
  friendId: string,
  callback: (messages: Message[]) => void,
): Unsubscribe {
  const conversationId = getConversationId(userId, friendId);
  const q = query(collection(db, "messages"), where("conversation", "==", conversationId));

  return onSnapshot(
    q,
    (querySnapshot) => {
      const messages: Message[] = [];

      querySnapshot.forEach((messageDoc) => {
        const data = messageDoc.data();
        messages.push({
          id: messageDoc.id,
          sender_id: data.sender_id,
          receiver_id: data.receiver_id,
          text: data.text,
          created_at: data.created_at,
          isRead: !!data.isRead,
        });
      });

      messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      callback(messages);
    },
    (error) => {
      console.error("[listenToMessages] Error listening to messages:", error);
    },
  );
}

export async function sendMessageToFirestore(
  senderId: string,
  receiverId: string,
  text: string,
): Promise<Message> {
  try {
    const conversationId = getConversationId(senderId, receiverId);

    const now = new Date().toISOString();
    const messageData = {
      sender_id: senderId,
      receiver_id: receiverId,
      text: text.trim(),
      conversation: conversationId,
      created_at: now,
      isRead: false,
    };

    const docRef = await addDoc(collection(db, "messages"), messageData);

    return {
      id: docRef.id,
      sender_id: senderId,
      receiver_id: receiverId,
      text: text.trim(),
      created_at: now,
      isRead: false,
    };
  } catch (error) {
    console.error("[sendMessageToFirestore] Error sending message:", error);
    throw error;
  }
}

export async function addReadReceipt(messageId: string, _userId: string): Promise<void> {
  try {
    const messageRef = doc(db, "messages", messageId);
    await updateDoc(messageRef, {
      isRead: true,
    });
  } catch (error) {
    console.error("[addReadReceipt] Error:", error);
    throw error;
  }
}

export async function markConversationAsRead(userId: string, friendId: string): Promise<void> {
  try {
    const conversationId = getConversationId(userId, friendId);
    const conversationQuery = query(collection(db, "messages"), where("conversation", "==", conversationId));
    const conversationSnap = await getDocs(conversationQuery);
    const unreadDocs = conversationSnap.docs.filter((messageDoc) => {
      const data = messageDoc.data();
      return data.receiver_id === userId && !data.isRead;
    });

    if (unreadDocs.length === 0) return;

    const batch = writeBatch(db);
    unreadDocs.forEach((messageDoc) => {
      batch.update(messageDoc.ref, { isRead: true });
    });

    await batch.commit();
  } catch (error) {
    console.error("[markConversationAsRead] Error:", error);
    throw error;
  }
}

export function listenToMessageReadStatus(
  messageId: string,
  callback: (isRead: boolean) => void,
): Unsubscribe {
  const messageRef = doc(db, "messages", messageId);

  return onSnapshot(messageRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback(!!data.isRead);
    }
  });
}
