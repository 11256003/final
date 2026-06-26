import { collection, doc, getDoc, getDocs, onSnapshot, query, Unsubscribe, where } from "firebase/firestore";
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
        bio: friendDoc.data().bio || null,
        created_at: friendDoc.data().created_at,
      };

      // 獲取最後一筆訊息
      const conversationId = [userId, friendId].sort().join("_");
      const messagesRef = query(
        collection(db, "messages"),
        where("conversation", "==", conversationId)
      );

      const messagesSnap = await getDocs(messagesRef);
      let lastMessage: Message | null = null;
      let lastTime: string | null = null;

      if (!messagesSnap.empty) {
        // 在客戶端排序以找到最後一筆訊息
        const sortedDocs = messagesSnap.docs.sort((a, b) => {
          const aTime = new Date(a.data().created_at).getTime();
          const bTime = new Date(b.data().created_at).getTime();
          return bTime - aTime;
        });
        
        const messageData = sortedDocs[0].data();
        lastMessage = {
          id: sortedDocs[0].id,
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
  console.log(`[listenToChatsList] Starting to listen for chats of user ${userId}`);

  return onSnapshot(userRef, (userDoc) => {
    try {
      console.log(`[listenToChatsList] User document updated for ${userId}`);
      if (!userDoc.exists()) {
        console.log(`[listenToChatsList] User document does not exist`);
        callback([]);
        return;
      }

      const friendIds = userDoc.data().friends || [];
      console.log(`[listenToChatsList] Friend IDs:`, friendIds);
      
      if (friendIds.length === 0) {
        console.log(`[listenToChatsList] No friends found`);
        callback([]);
        return;
      }

      // 使用 IIFE 來處理異步操作
      (async () => {
        try {
          const chats: ChatSummary[] = [];

          // 並行加載所有好友的聊天信息
          const chatPromises = friendIds.map(async (friendId: string) => {
            try {
              const friendDoc = await getDoc(doc(db, "users", friendId));
              if (!friendDoc.exists()) {
                console.warn(`[listenToChatsList] Friend document does not exist: ${friendId}`);
                return null;
              }

              const friend: User = {
                id: friendId,
                username: friendDoc.data().username,
                name: friendDoc.data().name,
                birthday: friendDoc.data().birthday || null,
                avatar_url: friendDoc.data().avatar_url || null,
                bio: friendDoc.data().bio || null,
                created_at: friendDoc.data().created_at,
              };

              const conversationId = [userId, friendId].sort().join("_");
              const messagesRef = query(
                collection(db, "messages"),
                where("conversation", "==", conversationId)
              );

              const messagesSnap = await getDocs(messagesRef);
              let lastMessage: Message | null = null;
              let lastTime: string | null = null;

              if (!messagesSnap.empty) {
                const sortedDocs = messagesSnap.docs.sort((a, b) => {
                  const aTime = new Date(a.data().created_at).getTime();
                  const bTime = new Date(b.data().created_at).getTime();
                  return bTime - aTime;
                });
                
                const messageData = sortedDocs[0].data();
                lastMessage = {
                  id: sortedDocs[0].id,
                  sender_id: messageData.sender_id,
                  receiver_id: messageData.receiver_id,
                  text: messageData.text,
                  created_at: messageData.created_at,
                };
                lastTime = messageData.created_at;
              }

              return {
                friend,
                last_message: lastMessage,
                last_time: lastTime,
              };
            } catch (error) {
              console.error(`[listenToChatsList] Error loading chat for friend ${friendId}:`, error);
              return null;
            }
          });

          // 等待所有 Promise 完成
          const results = await Promise.all(chatPromises);
          
          // 過濾掉 null 結果
          const validChats = results.filter((chat) => chat !== null) as ChatSummary[];

          // 按最後訊息時間排序
          validChats.sort((a, b) => {
            const aTime = a.last_time ? new Date(a.last_time).getTime() : 0;
            const bTime = b.last_time ? new Date(b.last_time).getTime() : 0;
            return bTime - aTime;
          });

          console.log(`[listenToChatsList] Loaded ${validChats.length} chats for user ${userId}`);
          callback(validChats);
        } catch (error) {
          console.error("[listenToChatsList] Error in async handler:", error);
          callback([]);
        }
      })();
    } catch (error) {
      console.error("[listenToChatsList] Error in listenToChatsList:", error);
      callback([]);
    }
  });
}
