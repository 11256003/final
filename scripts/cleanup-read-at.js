#!/usr/bin/env node
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, getDocs, writeBatch } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyCyAzlotz_Q8wtvZSNP5ViffQYu30_qp7E",
  authDomain: "mychatapp-5f409.firebaseapp.com",
  projectId: "mychatapp-5f409",
  storageBucket: "mychatapp-5f409.firebasestorage.app",
  messagingSenderId: "418394668317",
  appId: "1:418394668317:web:570a254cb275371a58f5f4",
  measurementId: "G-31PH1JYYHV"
};

const MAX_BATCH_SIZE = 500;

async function removeReadAtFromDoc(db, docRef) {
  const batch = writeBatch(db);
  batch.update(docRef, { read_at: undefined });
  await batch.commit();
}

async function main() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const messagesCollection = collection(db, 'messages');

  console.log('掃描 messages collection 中所有 document...');

  const q = query(messagesCollection);
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    console.log('沒有找到任何 messages document。');
    return;
  }

  console.log(`找到 ${snapshot.size} 筆 messages document。`);

  const docsNeedingCleanup = snapshot.docs.filter((doc) => {
    const data = doc.data();
    return data && Object.prototype.hasOwnProperty.call(data, 'read_at');
  });

  if (docsNeedingCleanup.length === 0) {
    console.log('沒有需要移除的 read_at 欄位。');
    return;
  }

  console.log(`需要移除 ${docsNeedingCleanup.length} 筆 document 的 read_at 欄位。`);

  for (let i = 0; i < docsNeedingCleanup.length; i += MAX_BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = docsNeedingCleanup.slice(i, i + MAX_BATCH_SIZE);
    chunk.forEach((doc) => batch.update(doc.ref, { read_at: undefined }));
    console.log(`提交第 ${Math.floor(i / MAX_BATCH_SIZE) + 1} 個批次，含 ${chunk.length} 筆 document`);
    await batch.commit();
  }

  console.log('已完成 read_at 欄位清理。');
}

main().catch((err) => {
  console.error('執行失敗：', err);
  process.exit(1);
});