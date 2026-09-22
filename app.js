import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let terminyData = [];
let aktualniRok, aktualniMesic;
let aktualniPredmetId = null;

/* ---------- PŘEDMĚTY ---------- */

async function nactiPredmety() {
  const snapshot = await getDocs(collection(db, "predmety"));
  const list = document.getElementById("predmety-list");
  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = "<p class='prazdno'>Zatím žádné předměty.</p>";
    return;
  }

  snapshot.forEach(d => {
    const p = d.data();
    list.innerHTML += `<div class="card predmet-card" data-id="${d.id}" data-nazev="${p.nazev}">${p.nazev}</div>`;
  });

  document.querySelectorAll(".predmet-card").forEach(el => {
    el.addEventListener("click", () => {
      otevriPredmet(el.dataset.id, el.dataset.nazev);
    });
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

/* ---------- DETAIL PŘEDMĚTU (SEKCE) ---------- */

function otevriDomov() {
  document.getElementById("view-domov").classList.remove("hidden");
  document.getElementById("view-predmet").classList.add("hidden");
}

async function otevriPredmet(id, nazev) {
  aktualniPredmetId = id;
  document.getElementById("view-domov").classList.add("hidden");
  document.getElementById("view-predmet").classList.remove("hidden");
  document.getElementById("predmet-nadpis").textContent = nazev;
  await nactiSekce(id);
}

async function nactiSekce(predmetId) {
  const snapshot = await getDocs(collection(db, "predmety", predmetId, "sekce"));
  const list = document.getElementById("sekce-list");
  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = "<p class='prazdno'>Zatím žádné sekce. Přidej první níže.</p>";
    return;
  }

  snapshot.forEach(d => {
    const s = d.data();
    list.innerHTML += `
      <div class="card sekce-card">
        <div class="sekce-nazev">${s.nazev}</div>
        ${s.popis ? `<div class="sekce-popis">${s.popis}</div>` : ""}
      </div>`;
  });
}

document.getElementById("zpet-btn").addEventListener("click", otevriDomov);

document.getElementById("pridat-sekci-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nazev = document.getElementById("nova-sekce-nazev").value.trim();
  const popis = document.getElementById("nova-sekce-popis").value.trim();
  if (!nazev || !aktualniPredmetId) return;

  await addDoc(collection(db, "predmety", aktualniPredmetId, "sekce"), { nazev, popis });
  document.getElementById("nova-sekce-nazev").value = "";
  document.getElementById("nova-sekce-popis").value = "";
  nactiSekce(aktualniPredmetId);
});

/* ---------- KALENDÁŘ ---------- */

async function nactiTerminyData() {
  try {
    const response = await fetch("./terminy.json");
    terminyData = await response.json();
  } catch (e) {
    console.error("Nepodařilo se načíst termíny:", e);
    terminyData = [];
  }
}

function terminyProDen(rok, mesic, den) {
  return terminyData.filter(t => {
    const d = new Date(t.datum);
    return d.getFullYear() === rok && d.getMonth() === mesic && d.getDate() === den;
  });
}

function vykresliKalendar(rok, mesic) {
  aktualniRok = rok;
  aktualniMesic = mesic;

  const nazvyMesicu = ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
    "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"];
  document.getElementById("kalendar-nadpis").textContent = `${nazvyMesicu[mesic]} ${rok}`;

  const prvniDen = new Date(rok, mesic, 1);
  const pocetDni = new Date(rok, mesic + 1, 0).getDate();
  const offset = (prvniDen.getDay() + 6) % 7; // pondělí = 0

  const mrizka = document.getElementById("kalendar-mrizka");
  mrizka.innerHTML = "";

  ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"].forEach(d => {
    mrizka.innerHTML += `<div class="kalendar-den-nazev">${d}</div>`;
  });

  for (let i = 0; i < offset; i++) {
    mrizka.innerHTML += `<div class="kalendar-den prazdny"></div>`;
  }

  const dnes = new Date();
  for (let den = 1; den <= pocetDni; den++) {
    const udalosti = terminyProDen(rok, mesic, den);
    const jeDnes = dnes.getFullYear() === rok && dnes.getMonth() === mesic && dnes.getDate() === den;

    let trida = "kalendar-den";
    if (jeDnes) trida += " dnes";
    if (udalosti.length > 0) trida += " ma-udalost";

    mrizka.innerHTML += `
      <div class="${trida}" data-den="${den}">
        <span>${den}</span>
        ${udalosti.length > 0 ? `<div class="tecka"></div>` : ""}
      </div>`;
  }

  document.querySelectorAll(".kalendar-den:not(.prazdny)").forEach(el => {
    el.addEventListener("click", () => {
      const den = parseInt(el.dataset.den, 10);
      zobrazDenDetail(rok, mesic, den);
    });
  });

  const dnesVTomtoMesici = dnes.getFullYear() === rok && dnes.getMonth() === mesic;
  if (dnesVTomtoMesici) {
    zobrazDenDetail(rok, mesic, dnes.getDate());
  } else {
    document.getElementById("kalendar-detail").innerHTML = "";
  }
}

function zobrazDenDetail(rok, mesic, den) {
  const udalosti = terminyProDen(rok, mesic, den);
  const box = document.getElementById("kalendar-detail");
  const datumTxt = new Date(rok, mesic, den).toLocaleDateString("cs-CZ");

  if (udalosti.length === 0) {
    box.innerHTML = `<p class="prazdno">${datumTxt} – žádné termíny.</p>`;
    return;
  }

  box.innerHTML = udalosti.map(u => `
    <div class="card termin">
      <div class="termin-datum">${datumTxt}</div>
      <div class="termin-nazev">${u.nazev}</div>
    </div>`).join("");
}

document.getElementById("mesic-predchozi").addEventListener("click", () => {
  let m = aktualniMesic - 1, r = aktualniRok;
  if (m < 0) { m = 11; r--; }
  vykresliKalendar(r, m);
});

document.getElementById("mesic-dalsi").addEventListener("click", () => {
  let m = aktualniMesic + 1, r = aktualniRok;
  if (m > 11) { m = 0; r++; }
  vykresliKalendar(r, m);
});

/* ---------- START ---------- */

async function init() {
  await nactiPredmety();
  await nactiTerminyData();
  const dnes = new Date();
  vykresliKalendar(dnes.getFullYear(), dnes.getMonth());
}

init();
