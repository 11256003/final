import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { forceMakeFriends } from "./firestore";

/**
 * 列出 Firestore 中的所有用戶 (僅用於調試)
 */
export async function debugListAllUsers() {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    const users: any[] = [];
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    console.log("All users in Firestore:", users);
    return users;
  } catch (error) {
    console.error("Error listing users:", error);
    throw error;
  }
}

/**
 * 調試用：強制把兩個 userId 設為好友（回傳更新後的 users 陣列）
 */
export async function debugForceMakeFriends(userIdA: string, userIdB: string) {
  try {
    await forceMakeFriends(userIdA, userIdB);
    return await debugListAllUsers();
  } catch (error) {
    console.error("Error in debugForceMakeFriends:", error);
    throw error;
  }
}
