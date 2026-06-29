import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";

export async function uploadProfileImage(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const extension = uri.split(".").pop()?.split("?")[0] || "jpg";
  const fileName = `avatars/${userId}.${extension}`;
  const storageRef = ref(storage, fileName);

  await uploadBytes(storageRef, blob, { contentType: blob.type || "image/jpeg" });
  return getDownloadURL(storageRef);
}
