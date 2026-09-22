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

async function nactiTerminy() {
  try {
    const response = await fetch("./terminy.json");
    const terminy = await response.json();
    const list = document.getElementById("terminy-list");
    list.innerHTML = "";
    if (terminy.length === 0) {
      list.innerHTML = "<p>Zatím žádné termíny.</p>";
      return;
    }
    terminy.forEach(t => {
      const datum = new Date(t.datum).toLocaleDateString("cs-CZ");
      list.innerHTML += `<p>${datum} – ${t.nazev}</p>`;
    });
  } catch (e) {
    console.error("Nepodařilo se načíst termíny:", e);
  }
}

nactiTerminy();
