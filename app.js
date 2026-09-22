import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let terminyData = [];
let aktualniRok, aktualniMesic;
let aktualniPredmetId = null;
let aktualniPredmetNazev = "";
let aktualniSekceId = null;
let editSekceId = null;
let editPoznamkaId = null;

/* ---------- Bezpečné vložení textu zkopírovaného z Moodlu ---------- */

function sanitizeHtml(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  tpl.content.querySelectorAll("script, style, iframe, object, embed, link, meta").forEach(el => el.remove());
  tpl.content.querySelectorAll("*").forEach(el => {
    [...el.attributes].forEach(attr => {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    });
  });
  return tpl.innerHTML.trim();
}

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
    list.innerHTML += `
      <div class="card predmet-card">
        <span class="predmet-otevrit" data-id="${d.id}" data-nazev="${p.nazev}">${p.nazev}</span>
        <span class="mini-akce">
          <button type="button" class="btn-icon predmet-upravit" data-id="${d.id}" data-nazev="${p.nazev}" title="Přejmenovat">✎</button>
          <button type="button" class="btn-icon predmet-smazat" data-id="${d.id}" title="Smazat">🗑</button>
        </span>
      </div>`;
  });

  document.querySelectorAll(".predmet-otevrit").forEach(el => {
    el.addEventListener("click", () => otevriPredmet(el.dataset.id, el.dataset.nazev));
  });

  document.querySelectorAll(".predmet-upravit").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      const novyNazev = prompt("Nový název předmětu:", el.dataset.nazev);
      if (novyNazev && novyNazev.trim()) {
        await updateDoc(doc(db, "predmety", el.dataset.id), { nazev: novyNazev.trim() });
        nactiPredmety();
      }
    });
  });

  document.querySelectorAll(".predmet-smazat").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Smazat tento předmět?")) {
        await deleteDoc(doc(db, "predmety", el.dataset.id));
        nactiPredmety();
      }
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

/* ---------- NAVIGACE MEZI VIEW ---------- */

function zobrazView(id) {
  ["view-domov", "view-predmet", "view-sekce"].forEach(v => {
    document.getElementById(v).classList.toggle("hidden", v !== id);
  });
}

function otevriDomov() {
  zobrazView("view-domov");
}

async function otevriPredmet(id, nazev) {
  aktualniPredmetId = id;
  aktualniPredmetNazev = nazev;
  document.getElementById("predmet-nadpis").textContent = nazev;
  zresetujSekceForm();
  zobrazView("view-predmet");
  await nactiSekce();
}

async function otevriSekci(id, nazev) {
  aktualniSekceId = id;
  document.getElementById("sekce-nadpis").textContent = `${aktualniPredmetNazev} – ${nazev}`;
  zresetujPoznamkaForm();
  zobrazView("view-sekce");
  await nactiMaterialy();
  await nactiPoznamky();
}

document.getElementById("zpet-btn").addEventListener("click", otevriDomov);
document.getElementById("zpet-sekce-btn").addEventListener("click", () => {
  zobrazView("view-predmet");
});

/* ---------- SEKCE (KAPITOLY PŘEDMĚTU) ---------- */

function sekceRef() {
  return collection(db, "predmety", aktualniPredmetId, "sekce");
}

async function nactiSekce() {
  const snapshot = await getDocs(sekceRef());
  const list = document.getElementById("sekce-list");
  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = "<p class='prazdno'>Zatím žádné sekce. Přidej první níže.</p>";
    return;
  }

  snapshot.forEach(d => {
    const s = d.data();
    list.innerHTML += `
      <div class="card akordeon" data-id="${d.id}">
        <div class="akordeon-hlavicka">
          <span>${s.nazev}</span>
          <span class="sipka">▾</span>
        </div>
        <div class="akordeon-telo">
          <div class="rte-zobrazeni">${s.popis || "<p class='prazdno'>Bez poznámek.</p>"}</div>
          <div class="akordeon-akce">
            <button type="button" class="btn-maly sekce-otevrit" data-id="${d.id}" data-nazev="${s.nazev}">Otevřít &rarr;</button>
            <button type="button" class="btn-maly sekce-upravit" data-id="${d.id}">Upravit</button>
            <button type="button" class="btn-maly btn-smazat sekce-smazat" data-id="${d.id}">Smazat</button>
          </div>
        </div>
      </div>`;
  });

  pripojAkordeonUdalosti();
}

function pripojAkordeonUdalosti() {
  document.querySelectorAll("#sekce-list .akordeon-hlavicka").forEach(el => {
    el.addEventListener("click", () => {
      el.closest(".akordeon").classList.toggle("otevrena");
    });
  });

  document.querySelectorAll(".sekce-otevrit").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      otevriSekci(el.dataset.id, el.dataset.nazev);
    });
  });

  document.querySelectorAll(".sekce-upravit").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      const snap = await getDocs(sekceRef());
      const dokument = snap.docs.find(d => d.id === el.dataset.id);
      if (!dokument) return;
      const data = dokument.data();
      document.getElementById("sekce-nazev-input").value = data.nazev;
      document.getElementById("sekce-popis-input").innerHTML = data.popis || "";
      editSekceId = el.dataset.id;
      document.getElementById("sekce-submit-btn").textContent = "Uložit změny";
      document.getElementById("sekce-zrusit-btn").classList.remove("hidden");
      document.getElementById("sekce-nazev-input").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  document.querySelectorAll(".sekce-smazat").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Smazat tuto sekci?")) {
        await deleteDoc(doc(db, "predmety", aktualniPredmetId, "sekce", el.dataset.id));
        nactiSekce();
      }
    });
  });
}

function zresetujSekceForm() {
  editSekceId = null;
  document.getElementById("sekce-nazev-input").value = "";
  document.getElementById("sekce-popis-input").innerHTML = "";
  document.getElementById("sekce-submit-btn").textContent = "Přidat sekci";
  document.getElementById("sekce-zrusit-btn").classList.add("hidden");
}

document.getElementById("sekce-zrusit-btn").addEventListener("click", zresetujSekceForm);

document.getElementById("sekce-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nazev = document.getElementById("sekce-nazev-input").value.trim();
  const popis = sanitizeHtml(document.getElementById("sekce-popis-input").innerHTML);
  if (!nazev) return;

  if (editSekceId) {
    await updateDoc(doc(db, "predmety", aktualniPredmetId, "sekce", editSekceId), { nazev, popis });
  } else {
    await addDoc(sekceRef(), { nazev, popis });
  }
  zresetujSekceForm();
  nactiSekce();
});

/* ---------- MATERIÁLY (ODKAZY UVNITŘ SEKCE) ---------- */

function materialyRef() {
  return collection(db, "predmety", aktualniPredmetId, "sekce", aktualniSekceId, "materialy");
}

async function nactiMaterialy() {
  const snapshot = await getDocs(materialyRef());
  const list = document.getElementById("materialy-list");
  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = "<p class='prazdno'>Zatím žádné materiály.</p>";
    return;
  }

  snapshot.forEach(d => {
    const m = d.data();
    list.innerHTML += `
      <div class="card material-card">
        <a href="${m.odkaz}" target="_blank" rel="noopener">${m.nazev}</a>
        <button type="button" class="btn-icon material-smazat" data-id="${d.id}" title="Smazat">🗑</button>
      </div>`;
  });

  document.querySelectorAll(".material-smazat").forEach(el => {
    el.addEventListener("click", async () => {
      if (confirm("Smazat tento materiál?")) {
        await deleteDoc(doc(db, "predmety", aktualniPredmetId, "sekce", aktualniSekceId, "materialy", el.dataset.id));
        nactiMaterialy();
      }
    });
  });
}

document.getElementById("material-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nazev = document.getElementById("material-nazev-input").value.trim();
  const odkaz = document.getElementById("material-odkaz-input").value.trim();
  if (!nazev || !odkaz) return;
  await addDoc(materialyRef(), { nazev, odkaz });
  document.getElementById("material-nazev-input").value = "";
  document.getElementById("material-odkaz-input").value = "";
  nactiMaterialy();
});

/* ---------- POZNÁMKY (BLOKY UVNITŘ SEKCE) ---------- */

function poznamkyRef() {
  return collection(db, "predmety", aktualniPredmetId, "sekce", aktualniSekceId, "poznamky");
}

async function nactiPoznamky() {
  const snapshot = await getDocs(poznamkyRef());
  const list = document.getElementById("poznamky-list");
  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = "<p class='prazdno'>Zatím žádné poznámky.</p>";
    return;
  }

  snapshot.forEach(d => {
    const p = d.data();
    list.innerHTML += `
      <div class="card akordeon" data-id="${d.id}">
        <div class="akordeon-hlavicka">
          <span>${p.nazev}</span>
          <span class="sipka">▾</span>
        </div>
        <div class="akordeon-telo">
          <div class="rte-zobrazeni">${p.popis || ""}</div>
          <div class="akordeon-akce">
            <button type="button" class="btn-maly poznamka-upravit" data-id="${d.id}">Upravit</button>
            <button type="button" class="btn-maly btn-smazat poznamka-smazat" data-id="${d.id}">Smazat</button>
          </div>
        </div>
      </div>`;
  });

  document.querySelectorAll("#poznamky-list .akordeon-hlavicka").forEach(el => {
    el.addEventListener("click", () => el.closest(".akordeon").classList.toggle("otevrena"));
  });

  document.querySelectorAll(".poznamka-upravit").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      const snap = await getDocs(poznamkyRef());
      const dokument = snap.docs.find(d => d.id === el.dataset.id);
      if (!dokument) return;
      const data = dokument.data();
      document.getElementById("poznamka-nazev-input").value = data.nazev;
      document.getElementById("poznamka-popis-input").innerHTML = data.popis || "";
      editPoznamkaId = el.dataset.id;
      document.getElementById("poznamka-submit-btn").textContent = "Uložit změny";
      document.getElementById("poznamka-zrusit-btn").classList.remove("hidden");
      document.getElementById("poznamka-nazev-input").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  document.querySelectorAll(".poznamka-smazat").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Smazat tuto poznámku?")) {
        await deleteDoc(doc(db, "predmety", aktualniPredmetId, "sekce", aktualniSekceId, "poznamky", el.dataset.id));
        nactiPoznamky();
      }
    });
  });
}

function zresetujPoznamkaForm() {
  editPoznamkaId = null;
  document.getElementById("poznamka-nazev-input").value = "";
  document.getElementById("poznamka-popis-input").innerHTML = "";
  document.getElementById("poznamka-submit-btn").textContent = "Přidat poznámku";
  document.getElementById("poznamka-zrusit-btn").classList.add("hidden");
}

document.getElementById("poznamka-zrusit-btn").addEventListener("click", zresetujPoznamkaForm);

document.getElementById("poznamka-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nazev = document.getElementById("poznamka-nazev-input").value.trim();
  const popis = sanitizeHtml(document.getElementById("poznamka-popis-input").innerHTML);
  if (!nazev) return;

  if (editPoznamkaId) {
    await updateDoc(doc(db, "predmety", aktualniPredmetId, "sekce", aktualniSekceId, "poznamky", editPoznamkaId), { nazev, popis });
  } else {
    await addDoc(poznamkyRef(), { nazev, popis });
  }
  zresetujPoznamkaForm();
  nactiPoznamky();
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
  const offset = (prvniDen.getDay() + 6) % 7;

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
      <div class="termin-datum">${datumTxt}${u.predmet ? " · " + u.predmet : ""}</div>
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
