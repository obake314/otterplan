import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';

// TODO: Firebase コンソールから取得した設定に置き換えてください
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// イベント作成
export const createEvent = async (eventData, recaptchaToken) => {
  // reCAPTCHA検証（本番ではCloud Functionsでサーバーサイド検証推奨）
  const eventId = generateId();
  
  const event = {
    ...eventData,
    id: eventId,
    createdAt: serverTimestamp(),
    recaptchaToken: recaptchaToken // 記録用（サーバー検証時に使用）
  };
  
  await setDoc(doc(db, 'events', eventId), event);
  return eventId;
};

// イベント取得
export const getEvent = async (eventId) => {
  const docSnap = await getDoc(doc(db, 'events', eventId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};

// イベント更新
export const updateEvent = async (eventId, data) => {
  await updateDoc(doc(db, 'events', eventId), {
    ...data,
    updatedAt: serverTimestamp()
  });
};

// 回答追加
export const addResponse = async (eventId, responseData) => {
  const responseId = generateId();
  await setDoc(doc(db, 'events', eventId, 'responses', responseId), {
    ...responseData,
    id: responseId,
    createdAt: serverTimestamp()
  });
  return responseId;
};

// 回答一覧取得
export const getResponses = async (eventId) => {
  const q = query(
    collection(db, 'events', eventId, 'responses'),
    orderBy('createdAt', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// チャットメッセージ追加
export const addChatMessage = async (eventId, messageData) => {
  const messageId = generateId();
  await setDoc(doc(db, 'events', eventId, 'chat', messageId), {
    ...messageData,
    id: messageId,
    createdAt: serverTimestamp()
  });
  return messageId;
};

// チャット一覧取得
export const getChatMessages = async (eventId) => {
  const q = query(
    collection(db, 'events', eventId, 'chat'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// DM追加
export const addDirectMessage = async (eventId, dmData) => {
  const dmId = generateId();
  await setDoc(doc(db, 'events', eventId, 'dms', dmId), {
    ...dmData,
    id: dmId,
    createdAt: serverTimestamp()
  });
  return dmId;
};

// DM一覧取得（主催者用）
export const getDirectMessages = async (eventId) => {
  const q = query(
    collection(db, 'events', eventId, 'dms'),
    orderBy('createdAt', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// 期限切れイベント削除（定期実行用）
export const deleteExpiredEvents = async () => {
  const now = Timestamp.now();
  const q = query(
    collection(db, 'events'),
    where('expiresAt', '<=', now)
  );
  const snapshot = await getDocs(q);
  
  for (const docSnap of snapshot.docs) {
    await deleteDoc(doc(db, 'events', docSnap.id));
  }
  
  return snapshot.size;
};

// ID生成
const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

export { db, Timestamp };
