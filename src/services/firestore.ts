import { arrayRemove, arrayUnion, collection, doc, getDoc, getDocs, query, updateDoc, where } from "firebase/firestore";
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
export async function searchUser(query_text: string): Promise<User | null> {
  try {
    // 先試著用 username 搜尋
    let q = query(collection(db, "users"), where("username", "==", query_text));
    let querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username,
        name: data.name,
        birthday: data.birthday || null,
        avatar_url: data.avatar_url || null,
        created_at: data.created_at,
      };
    }

    // 試著用 email 搜尋
    q = query(collection(db, "users"), where("email", "==", query_text));
    querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username,
        name: data.name,
        birthday: data.birthday || null,
        avatar_url: data.avatar_url || null,
        created_at: data.created_at,
      };
    }

    // 試著直接用 ID 取用戶
    const userDoc = await getDoc(doc(db, "users", query_text));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        id: query_text,
        username: data.username,
        name: data.name,
        birthday: data.birthday || null,
        avatar_url: data.avatar_url || null,
        created_at: data.created_at,
      };
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
    const q = query(collection(db, "users"), where("username", "==", username));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      return {
        id: doc.id,
        username: data.username,
        name: data.name,
        birthday: data.birthday || null,
        avatar_url: data.avatar_url || null,
        created_at: data.created_at,
      };
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
    // 搜尋好友（支持 username、email、id）
    const friend = await searchUser(searchQuery);
    if (!friend) {
      throw new Error(`User "${searchQuery}" not found`);
    }

    if (friend.id === userId) {
      throw new Error("Cannot add yourself as friend");
    }

    // 檢查是否已是好友
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const friends = userDoc.data().friends || [];
      if (friends.includes(friend.id)) {
        throw new Error("Already friends with this user");
      }
    }

    // 新增到當前用戶的好友列表
    await updateDoc(userRef, {
      friends: arrayUnion(friend.id),
    });

    // 也新增到好友的好友列表 (雙向)
    const friendRef = doc(db, "users", friend.id);
    await updateDoc(friendRef, {
      friends: arrayUnion(userId),
    });
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
