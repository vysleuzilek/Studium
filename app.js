import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function nactiPredmety() {
  const snapshot = await getDocs(collection(db, "predmety"));
  const list = document.getElementById("predmety-list");
  list.innerHTML = "";
  snapshot.forEach(doc => {
    const p = doc.data();
    list.innerHTML += `<p>${p.nazev}</p>`;
  });
}

nactiPredmety();
