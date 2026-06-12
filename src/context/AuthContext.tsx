import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "../services/firebase";
import type { User } from "../types/chat";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  error: string | null;
  register: (email: string, password: string, username: string, name: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            setUser({
              id: firebaseUser.uid,
              username: userData.username,
              name: userData.name,
              birthday: userData.birthday || null,
              avatar_url: userData.avatar_url || null,
              created_at: userData.created_at,
            });
          }
        } else {
          setUser(null);
        }
        setError(null);
      } catch (err) {
        console.error("Error loading user data:", err);
        setError(err instanceof Error ? err.message : "Failed to load user data");
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
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

      // 設定 user state
      setUser({
        id: firebaseUser.uid,
        username,
        name,
        birthday: null,
        avatar_url: null,
        created_at: userData.created_at,
      });
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

      // 從 Firestore 獲取用戶資料
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // 確保用戶有 friends 陣列
        if (!userData.friends) {
          await updateDoc(userDocRef, { friends: [] });
        }

        setUser({
          id: firebaseUser.uid,
          username: userData.username,
          name: userData.name,
          birthday: userData.birthday || null,
          avatar_url: userData.avatar_url || null,
          created_at: userData.created_at,
        });
      }
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
    }),
    [user, loading, error],
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
