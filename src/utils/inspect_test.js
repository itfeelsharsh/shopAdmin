const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, limit, query } = require("firebase/firestore");
require("dotenv").config();

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

console.log("Firebase config loaded:", firebaseConfig);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  try {
    const ordersCol = collection(db, "orders");
    const snapshot = await getDocs(query(ordersCol, limit(5)));
    console.log(`Found ${snapshot.docs.length} orders`);
    snapshot.docs.forEach((doc, idx) => {
      console.log(`--- Order ${idx + 1} (${doc.id}) ---`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });

    const usersCol = collection(db, "users");
    const usersSnapshot = await getDocs(query(usersCol, limit(2)));
    console.log(`Found ${usersSnapshot.docs.length} users`);
    usersSnapshot.docs.forEach((doc, idx) => {
      console.log(`--- User ${idx + 1} (${doc.id}) ---`);
      console.log(JSON.stringify(doc.data(), null, 2));
    });

    process.exit(0);
  } catch (error) {
    console.error("Error inspecting:", error);
    process.exit(1);
  }
}

inspect();
