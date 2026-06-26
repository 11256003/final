import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, Unsubscribe, updateDoc } from "firebase/firestore";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from "react";
import { listenToChatsList } from "../services/chats";
import { auth, db } from "../services/firebase";
import type { ChatSummary, User } from "../types/chat";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  register: (email: string, password: string, username: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  chats: ChatSummary[];
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const unsubscribeChatsRef = useRef<Unsubscribe | null>(null);

  // 啟動聊天列表監聽器
  const startChatsListener = (userId: string) => {
    // 停止之前的監聽器（如果存在）
    if (unsubscribeChatsRef.current) {
      unsubscribeChatsRef.current();
    }
    // 啟動新的監聽器
    unsubscribeChatsRef.current = listenToChatsList(userId, setChats);
    console.log(`[AuthContext] Started listening to chats for user ${userId}`);
  };

  // 停止聊天列表監聽器
  const stopChatsListener = () => {
    if (unsubscribeChatsRef.current) {
      unsubscribeChatsRef.current();
      unsubscribeChatsRef.current = null;
      console.log(`[AuthContext] Stopped listening to chats`);
    }
  };

  // 監聽 Firebase 認證狀態變化
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // 從 Firestore 獲取用戶資料
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const userState: User = {
              id: firebaseUser.uid,
              username: userData.username,
              name: userData.name,
              birthday: userData.birthday || null,
              avatar_url: userData.avatar_url || null,
              created_at: userData.created_at,
            };
            setUser(userState);
            console.log(`[AuthContext] User authenticated: ${firebaseUser.uid}`);
            // 只在 onAuthStateChanged 中啟動監聽器
            startChatsListener(firebaseUser.uid);
          }
        } else {
          setUser(null);
          setChats([]);
          stopChatsListener();
          console.log(`[AuthContext] User logged out`);
        }
        setError(null);
      } catch (err) {
        console.error("Error loading user data:", err);
        setError(err instanceof Error ? err.message : "Failed to load user data");
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      stopChatsListener();
    };
  }, []);

  // 註冊新用戶
  const register = async (email: string, password: string, username: string, name: string) => {
    try {
      setLoading(true);
      setError(null);

      // 在 Firebase Authentication 建立用戶
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // 在 Firestore 儲存用戶資料
      const userData = {
        username,
        name,
        email,
        birthday: null,
        avatar_url: null,
        created_at: new Date().toISOString(),
        friends: [],
      };

      await setDoc(doc(db, "users", firebaseUser.uid), userData);
      console.log(`[AuthContext] User registered: ${firebaseUser.uid}`);
      // onAuthStateChanged 會自動觸發並啟動監聽器
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Registration failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 登入用戶
  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      console.log(`[AuthContext] User logged in: ${firebaseUser.uid}`);

      // 從 Firestore 獲取用戶資料
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // 確保用戶有 friends 陣列
        if (!userData.friends) {
          await updateDoc(userDocRef, { friends: [] });
        }
      }
      // onAuthStateChanged 會自動觸發並啟動監聽器
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 登出用戶
  const logout = async () => {
    try {
      setLoading(true);
      setError(null);
      await signOut(auth);
      setUser(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Logout failed";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      register,
      login,
      logout,
      setUser,
      chats,
    }),
    [user, loading, error, chats],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
