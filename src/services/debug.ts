import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

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
