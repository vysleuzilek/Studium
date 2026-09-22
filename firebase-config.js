import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "TVOJE_API_KEY",
  authDomain: "TVUJ_PROJEKT.firebaseapp.com",
  projectId: "TVUJ_PROJEKT",
  storageBucket: "TVUJ_PROJEKT.appspot.com",
  messagingSenderId: "TVOJE_ID",
  appId: "TVOJE_APP_ID"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
