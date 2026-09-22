import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAZYgn-_DRK6sCHDS2C5UH5TzYB0qNppDQ",
  authDomain: "studijni-prehled.firebaseapp.com",
  databaseURL: "https://studijni-prehled-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "studijni-prehled",
  storageBucket: "studijni-prehled.firebasestorage.app",
  messagingSenderId: "692217559448",
  appId: "1:692217559448:web:6a522624e7e72a57a413ed"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
