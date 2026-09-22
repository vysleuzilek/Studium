import os
import json
import re
import urllib.request
from icalendar import Calendar

ICAL_URL = os.environ["MOODLE_ICAL_URL"]


def fetch_ical(url):
    with urllib.request.urlopen(url) as response:
        return response.read()


def ziskej_predmet(component):
    kategorie = component.get("categories")
    if not kategorie:
        return None
    try:
        if hasattr(kategorie, "cats"):
            return ", ".join(str(c) for c in kategorie.cats)
        return str(kategorie)
    except Exception:
        return None


def ziskej_odkaz(component):
    # 1) přímo v poli URL, pokud ho Moodle posílá
    url_pole = component.get("url")
    if url_pole:
        return str(url_pole)
    # 2) jinak zkusit najít odkaz přímo v textu popisu (DESCRIPTION)
    popis = component.get("description")
    if popis:
        shoda = re.search(r"https?://\S+", str(popis))
        if shoda:
            return shoda.group(0).rstrip(").,")
    return None


def parse_events(ical_data):
    cal = Calendar.from_ical(ical_data)
    events = []
    for component in cal.walk():
        if component.name == "VEVENT":
            summary = str(component.get("summary", "Bez názvu"))
            dtstart = component.get("dtstart")
            dt = dtstart.dt if dtstart else None
            date_str = dt.isoformat() if hasattr(dt, "isoformat") else str(dt)
            predmet = ziskej_predmet(component)
            odkaz = ziskej_odkaz(component)
            event = {"nazev": summary, "datum": date_str}
            if predmet:
                event["predmet"] = predmet
            if odkaz:
                event["odkaz"] = odkaz
            events.append(event)
    events.sort(key=lambda e: e["datum"])
    return events


def main():
    data = fetch_ical(ICAL_URL)
    events = parse_events(data)
    with open("terminy.json", "w", encoding="utf-8") as f:
        json.dump(events, f, ensure_ascii=False, indent=2)
    print(f"Uloženo {len(events)} termínů.")


if __name__ == "__main__":
    main()
