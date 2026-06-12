import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, updateDoc } from "firebase/firestore";
import type { User } from "../types/chat";
import { db } from "./firebase";

/**
 * 從 Firestore 獲取用戶資料
 */
export async function getUserData(userId: string): Promise<User | null> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        id: userId,
        username: data.username,
        name: data.name,
        birthday: data.birthday || null,
        avatar_url: data.avatar_url || null,
        created_at: data.created_at,
      };
    }
    return null;
  } catch (error) {
    console.error("Error getting user data:", error);
    throw error;
  }
}

/**
 * 搜尋用戶 (by username, email, or id)
 */
export async function searchUser(query_text: string, currentUserId?: string): Promise<User | null> {
  try {
    const normalizedQuery = query_text.toLowerCase().trim();
    
    if (!normalizedQuery) {
      throw new Error("搜尋詞不能為空");
    }
    
    // 直接用 ID 搜尋（優先，完全匹配）
    const userId = query_text.trim();
    if (userId !== currentUserId) {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          id: userId,
          username: data.username,
          name: data.name,
          birthday: data.birthday || null,
          avatar_url: data.avatar_url || null,
          created_at: data.created_at,
        };
      }
    }

    // 獲取所有用戶並進行客戶端搜尋（不區分大小寫）
    const q = query(collection(db, "users"));
    const querySnapshot = await getDocs(q);
    
    // 完全匹配優先
    for (const doc of querySnapshot.docs) {
      if (currentUserId && doc.id === currentUserId) continue; // 跳過自己
      
      const data = doc.data();
      const username = data.username?.toLowerCase() || "";
      const email = data.email?.toLowerCase() || "";
      
      if (username === normalizedQuery || email === normalizedQuery) {
        return {
          id: doc.id,
          username: data.username,
          name: data.name,
          birthday: data.birthday || null,
          avatar_url: data.avatar_url || null,
          created_at: data.created_at,
        };
      }
    }
    
    // 模糊匹配（包含搜尋詞）
    for (const doc of querySnapshot.docs) {
      if (currentUserId && doc.id === currentUserId) continue; // 跳過自己
      
      const data = doc.data();
      const username = data.username?.toLowerCase() || "";
      const email = data.email?.toLowerCase() || "";
      const name = data.name?.toLowerCase() || "";
      
      if (
        username.includes(normalizedQuery) ||
        email.includes(normalizedQuery) ||
        name.includes(normalizedQuery)
      ) {
        return {
          id: doc.id,
          username: data.username,
          name: data.name,
          birthday: data.birthday || null,
          avatar_url: data.avatar_url || null,
          created_at: data.created_at,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error searching user:", error);
    throw error;
  }
}

/**
 * 搜尋用戶 (by username)
 */
export async function searchUserByUsername(username: string): Promise<User | null> {
  try {
    const normalizedUsername = username.toLowerCase().trim();
    const q = query(collection(db, "users"));
    const querySnapshot = await getDocs(q);
    
    for (const doc of querySnapshot.docs) {
      const data = doc.data();
      if (data.username?.toLowerCase() === normalizedUsername) {
        return {
          id: doc.id,
          username: data.username,
          name: data.name,
          birthday: data.birthday || null,
          avatar_url: data.avatar_url || null,
          created_at: data.created_at,
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Error searching user:", error);
    throw error;
  }
}

/**
 * 獲取好友列表
 */
export async function getFriendsList(userId: string): Promise<User[]> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      throw new Error("User not found");
    }

    const friendIds = userDoc.data().friends || [];
    if (friendIds.length === 0) {
      return [];
    }

    const friends: User[] = [];
    for (const friendId of friendIds) {
      const friend = await getUserData(friendId);
      if (friend) {
        friends.push(friend);
      }
    }
    return friends;
  } catch (error) {
    console.error("Error getting friends list:", error);
    throw error;
  }
}

/**
 * 新增好友 (支持 username、email、id)
 */
export async function addFriend(userId: string, searchQuery: string): Promise<void> {
  try {
    // 搜尋好友（支持 username、email、id），排除當前用戶
    const friend = await searchUser(searchQuery, userId);
    if (!friend) {
      throw new Error(`找不到帳號「${searchQuery}」，請確認帳號、email 或用戶 ID 是否正確`);
    }

    console.log(`[addFriend] Found friend: id=${friend.id}, name=${friend.name}`);

    if (friend.id === userId) {
      throw new Error("無法將自己加為好友");
    }

    // 檢查是否已是好友
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const friends = userDoc.data().friends || [];
      if (friends.includes(friend.id)) {
        throw new Error(`已經和「${friend.name}」是好友了`);
      }
    }

    // 新增到當前用戶的好友列表
    console.log(`[addFriend] Adding ${friend.id} to ${userId}'s friends`);
    await updateDoc(userRef, {
      friends: arrayUnion(friend.id),
    });
    console.log(`[addFriend] Successfully added ${friend.id} to ${userId}'s friends`);

    // 也新增到好友的好友列表 (雙向)
    const friendRef = doc(db, "users", friend.id);
    console.log(`[addFriend] Adding ${userId} to ${friend.id}'s friends`);
    await updateDoc(friendRef, {
      friends: arrayUnion(userId),
    });
    console.log(`[addFriend] Successfully added ${userId} to ${friend.id}'s friends`);
    console.log(`[addFriend] Friendship bidirectional setup complete`);
  } catch (error) {
    console.error("Error adding friend:", error);
    throw error;
  }
}

/**
 * 新增好友（已廢棄，使用 addFriend 替代）
 */
export async function addFriendByUsername(userId: string, friendUsername: string): Promise<void> {
  return addFriend(userId, friendUsername);
}

/**
 * 移除好友
 */
export async function removeFriend(userId: string, friendId: string): Promise<void> {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      friends: arrayRemove(friendId),
    });

    const friendRef = doc(db, "users", friendId);
    await updateDoc(friendRef, {
      friends: arrayRemove(userId),
    });
  } catch (error) {
    console.error("Error removing friend:", error);
    throw error;
  }
}
