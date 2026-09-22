import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function nactiPredmety() {
  const snapshot = await getDocs(collection(db, "predmety"));
  const list = document.getElementById("predmety-list");
  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = "<p class='prazdno'>Zatím žádné předměty.</p>";
    return;
  }

  snapshot.forEach(doc => {
    const p = doc.data();
    list.innerHTML += `<div class="card">${p.nazev}</div>`;
  });
}

document.getElementById("pridat-predmet-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("novy-predmet");
  const nazev = input.value.trim();
  if (!nazev) return;

  await addDoc(collection(db, "predmety"), { nazev });
  input.value = "";
  nactiPredmety();
});

nactiPredmety();

async function nactiTerminy() {
  try {
    const response = await fetch("./terminy.json");
    const terminy = await response.json();
    const list = document.getElementById("terminy-list");
    list.innerHTML = "";

    if (terminy.length === 0) {
      list.innerHTML = "<p class='prazdno'>Zatím žádné termíny.</p>";
      return;
    }

    const dnes = new Date();

    terminy.forEach(t => {
      const datumObj = new Date(t.datum);
      const datum = datumObj.toLocaleDateString("cs-CZ");
      const dniZbyva = Math.ceil((datumObj - dnes) / (1000 * 60 * 60 * 24));

      let trida = "card termin";
      if (dniZbyva <= 3) trida += " urgentni";
      else if (dniZbyva <= 7) trida += " brzy";

      list.innerHTML += `
        <div class="${trida}">
          <div class="termin-datum">${datum}</div>
          <div class="termin-nazev">${t.nazev}</div>
        </div>`;
    });
  } catch (e) {
    console.error("Nepodařilo se načíst termíny:", e);
  }
}

nactiTerminy();
