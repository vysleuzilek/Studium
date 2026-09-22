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
let editMaterialId = null;

/* ---------- Bezpečné a čisté vložení textu zkopírovaného z Moodlu ---------- */
/* Necháme jen strukturu (tučné, odstavce, seznamy) - žádné ikonky, barvy,
   podtržení ani jiné zbytky Moodle designu. */

const POVOLENE_TAGY = new Set(["P", "BR", "B", "STRONG", "I", "EM", "UL", "OL", "LI"]);

function sanitizeHtml(html) {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;

  // Obrázky, ikonky a další nechtěné prvky pryč úplně
  tpl.content.querySelectorAll("img, script, style, iframe, object, embed, link, meta, svg, video, audio, picture, source").forEach(el => el.remove());

  function vycisti(rodic) {
    [...rodic.children].forEach(el => {
      vycisti(el);
      if (!POVOLENE_TAGY.has(el.tagName)) {
        // Prvek, co nechceme (span, div, a, font...) - necháme jen jeho obsah
        while (el.firstChild) {
          el.parentNode.insertBefore(el.firstChild, el);
        }
        el.remove();
      } else {
        // Povolený tag - smažeme z něj všechny atributy (style, class...)
        [...el.attributes].forEach(attr => el.removeAttribute(attr.name));
      }
    });
  }

  vycisti(tpl.content);
  return tpl.innerHTML.trim();
}

/* ---------- Pořadí položek (podle času vytvoření, ne podle Firestore) ---------- */

function serazenaPole(snapshot) {
  return snapshot.docs.slice().sort((a, b) => {
    const pa = a.data().poradi;
    const pb = b.data().poradi;
    const ka = typeof pa === "number" ? pa : -1;
    const kb = typeof pb === "number" ? pb : -1;
    return ka - kb;
  });
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

  serazenaPole(snapshot).forEach(d => {
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

document.getElementById("predmet-form-toggle").addEventListener("click", () => {
  document.getElementById("pridat-predmet-form").classList.toggle("hidden");
});

document.getElementById("pridat-predmet-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("novy-predmet");
  const nazev = input.value.trim();
  if (!nazev) return;
  await addDoc(collection(db, "predmety"), { nazev, poradi: Date.now() });
  input.value = "";
  document.getElementById("pridat-predmet-form").classList.add("hidden");
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
  zresetujMaterialForm();
  zobrazView("view-sekce");
  await nactiMaterialy();
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

  serazenaPole(snapshot).forEach(d => {
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
      document.getElementById("sekce-form").classList.remove("hidden");
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
  document.getElementById("sekce-form").classList.add("hidden");
}

document.getElementById("sekce-form-toggle").addEventListener("click", () => {
  document.getElementById("sekce-form").classList.toggle("hidden");
});

document.getElementById("sekce-zrusit-btn").addEventListener("click", zresetujSekceForm);

document.getElementById("sekce-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nazev = document.getElementById("sekce-nazev-input").value.trim();
  const popis = sanitizeHtml(document.getElementById("sekce-popis-input").innerHTML);
  if (!nazev) return;

  if (editSekceId) {
    await updateDoc(doc(db, "predmety", aktualniPredmetId, "sekce", editSekceId), { nazev, popis });
  } else {
    await addDoc(sekceRef(), { nazev, popis, poradi: Date.now() });
  }
  zresetujSekceForm();
  nactiSekce();
});

/* ---------- MATERIÁLY (text i/nebo víc dokumentů, uvnitř sekce) ---------- */

function materialyRef() {
  return collection(db, "predmety", aktualniPredmetId, "sekce", aktualniSekceId, "materialy");
}

function pridejDokumentRadek(nazev = "", odkaz = "") {
  const container = document.getElementById("dokumenty-editor");
  const radek = document.createElement("div");
  radek.className = "dokument-radek";

  const nazevInput = document.createElement("input");
  nazevInput.type = "text";
  nazevInput.className = "dokument-nazev";
  nazevInput.placeholder = "Název dokumentu (např. DS1_01 Obsah, ERD-I.pdf)";
  nazevInput.value = nazev;

  const odkazInput = document.createElement("input");
  odkazInput.type = "url";
  odkazInput.className = "dokument-odkaz";
  odkazInput.placeholder = "Odkaz (URL)";
  odkazInput.value = odkaz;

  const odebratBtn = document.createElement("button");
  odebratBtn.type = "button";
  odebratBtn.className = "btn-icon dokument-odebrat";
  odebratBtn.title = "Odebrat";
  odebratBtn.textContent = "✕";
  odebratBtn.addEventListener("click", () => radek.remove());

  radek.appendChild(nazevInput);
  radek.appendChild(odkazInput);
  radek.appendChild(odebratBtn);
  container.appendChild(radek);
}

document.getElementById("pridat-dokument-btn").addEventListener("click", () => pridejDokumentRadek());

function ziskejDokumenty() {
  const dokumenty = [];
  document.querySelectorAll("#dokumenty-editor .dokument-radek").forEach(r => {
    const nazev = r.querySelector(".dokument-nazev").value.trim();
    const odkaz = r.querySelector(".dokument-odkaz").value.trim();
    if (nazev && odkaz) dokumenty.push({ nazev, odkaz });
  });
  return dokumenty;
}

async function nactiMaterialy() {
  const snapshot = await getDocs(materialyRef());
  const list = document.getElementById("materialy-list");
  list.innerHTML = "";

  if (snapshot.empty) {
    list.innerHTML = "<p class='prazdno'>Zatím žádné materiály. Přidej první níže.</p>";
    return;
  }

  serazenaPole(snapshot).forEach(d => {
    const m = d.data();
    // zpětná kompatibilita se starším jedním polem "odkaz"
    const dokumenty = (m.dokumenty && m.dokumenty.length)
      ? m.dokumenty
      : (m.odkaz ? [{ nazev: m.nazev, odkaz: m.odkaz }] : []);

    const dokumentyHtml = dokumenty.length
      ? `<div class="dokumenty-seznam">${dokumenty.map(dk =>
          `<a href="${dk.odkaz}" target="_blank" rel="noopener">${dk.nazev}</a>`).join("")}</div>`
      : "";

    list.innerHTML += `
      <div class="card akordeon" data-id="${d.id}">
        <div class="akordeon-hlavicka">
          <span>${m.nazev}</span>
          <span class="sipka">▾</span>
        </div>
        <div class="akordeon-telo">
          ${m.popis ? `<div class="rte-zobrazeni">${m.popis}</div>` : ""}
          ${dokumentyHtml}
          <div class="akordeon-akce">
            <button type="button" class="btn-maly material-upravit" data-id="${d.id}">Upravit</button>
            <button type="button" class="btn-maly btn-smazat material-smazat" data-id="${d.id}">Smazat</button>
          </div>
        </div>
      </div>`;
  });

  document.querySelectorAll("#materialy-list .akordeon-hlavicka").forEach(el => {
    el.addEventListener("click", () => el.closest(".akordeon").classList.toggle("otevrena"));
  });

  document.querySelectorAll(".material-upravit").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      const snap = await getDocs(materialyRef());
      const dokument = snap.docs.find(d => d.id === el.dataset.id);
      if (!dokument) return;
      const data = dokument.data();

      document.getElementById("material-nazev-input").value = data.nazev;
      document.getElementById("material-popis-input").innerHTML = data.popis || "";

      document.getElementById("dokumenty-editor").innerHTML = "";
      const dokumenty = (data.dokumenty && data.dokumenty.length)
        ? data.dokumenty
        : (data.odkaz ? [{ nazev: "", odkaz: data.odkaz }] : []);
      if (dokumenty.length) {
        dokumenty.forEach(dk => pridejDokumentRadek(dk.nazev, dk.odkaz));
      } else {
        pridejDokumentRadek();
      }

      editMaterialId = el.dataset.id;
      document.getElementById("material-submit-btn").textContent = "Uložit změny";
      document.getElementById("material-zrusit-btn").classList.remove("hidden");
      document.getElementById("material-form").classList.remove("hidden");
      document.getElementById("material-nazev-input").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  document.querySelectorAll(".material-smazat").forEach(el => {
    el.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (confirm("Smazat tento materiál?")) {
        await deleteDoc(doc(db, "predmety", aktualniPredmetId, "sekce", aktualniSekceId, "materialy", el.dataset.id));
        nactiMaterialy();
      }
    });
  });
}

function zresetujMaterialForm() {
  editMaterialId = null;
  document.getElementById("material-nazev-input").value = "";
  document.getElementById("material-popis-input").innerHTML = "";
  document.getElementById("dokumenty-editor").innerHTML = "";
  pridejDokumentRadek();
  document.getElementById("material-submit-btn").textContent = "Přidat materiál";
  document.getElementById("material-zrusit-btn").classList.add("hidden");
  document.getElementById("material-form").classList.add("hidden");
}

document.getElementById("material-form-toggle").addEventListener("click", () => {
  document.getElementById("material-form").classList.toggle("hidden");
});

document.getElementById("material-zrusit-btn").addEventListener("click", zresetujMaterialForm);

document.getElementById("material-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nazev = document.getElementById("material-nazev-input").value.trim();
  const popis = sanitizeHtml(document.getElementById("material-popis-input").innerHTML);
  const dokumenty = ziskejDokumenty();
  if (!nazev) return;
  if (!popis && dokumenty.length === 0) {
    alert("Zadej aspoň text, nebo jeden dokument (název + odkaz).");
    return;
  }

  const data = { nazev, popis: popis || null, dokumenty, odkaz: null };

  if (editMaterialId) {
    await updateDoc(doc(db, "predmety", aktualniPredmetId, "sekce", aktualniSekceId, "materialy", editMaterialId), data);
  } else {
    data.poradi = Date.now();
    await addDoc(materialyRef(), data);
  }
  zresetujMaterialForm();
  nactiMaterialy();
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
      ${u.odkaz ? `<a class="btn-maly termin-odkaz" href="${u.odkaz}" target="_blank" rel="noopener">Otevřít v Moodlu &rarr;</a>` : ""}
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
