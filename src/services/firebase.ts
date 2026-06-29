// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCyAzlotz_Q8wtvZSNP5ViffQYu30_qp7E",
  authDomain: "mychatapp-5f409.firebaseapp.com",
  projectId: "mychatapp-5f409",
  storageBucket: "mychatapp-5f409.firebasestorage.app",
  messagingSenderId: "418394668317",
  appId: "1:418394668317:web:570a254cb275371a58f5f4",
  measurementId: "G-31PH1JYYHV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Firestore Database
export const db = getFirestore(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

export default app;
