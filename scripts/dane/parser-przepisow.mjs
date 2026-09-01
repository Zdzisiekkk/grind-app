/**
 * Zamiana przepisu z Wikibooks na dane, które umie policzyć dziennik diety.
 *
 * Wejście to wikitekst: lista składników po gwiazdkach i kroki po kratkach.
 * Wyjście to gramy - bo w gramach liczy cała reszta aplikacji.
 *
 * DLACZEGO OSOBNY PLIK, A NIE SKRYPT IMPORTU. Import uruchamia się raz,
 * a to tutaj trzeba dać się przetestować bez sieci i bez bazy. "2 łyżki oleju"
 * ma znaczyć 20 gramów także za rok, kiedy nikt nie będzie pamiętał,
 * skąd ta liczba.
 */

import { MIARY_DOMYSLNE, SUROWCE } from "./surowce.mjs";

/** Ułamki, które w przepisach pojawiają się jako jeden znak. */
const UŁAMKI = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };

/**
 * Miary domowe wraz z odmianą, w jakiej naprawdę występują.
 *
 * Klucz to forma znaleziona w tekście, wartość to nazwa miary w tabeli
 * surowców. Lista jest jawna, bo automatyczne odmienianie polskiego myli
 * "łyżkę" z "łyżeczką", a różnica to trzykrotność wagi.
 */
const MIARY = {
  łyżka: "łyżka", łyżki: "łyżka", łyżek: "łyżka", łyżkę: "łyżka", łyżeczka: "łyżeczka",
  łyżeczki: "łyżeczka", łyżeczek: "łyżeczka", łyżeczkę: "łyżeczka",
  szklanka: "szklanka", szklanki: "szklanka", szklanek: "szklanka", szklankę: "szklanka",
  kubek: "kubek", kubka: "kubek", kubki: "kubek",
  szczypta: "szczypta", szczypty: "szczypta", szczyptę: "szczypta",
  garść: "garść", garści: "garść", garstka: "garść",
  ząbek: "ząbek", ząbki: "ząbek", ząbków: "ząbek", ząbka: "ząbek",
  plaster: "plaster", plastry: "plaster", plastrów: "plaster", plasterek: "plaster",
  plasterki: "plaster", plasterków: "plaster",
  kromka: "kromka", kromki: "kromka", kromek: "kromka",
  puszka: "puszka", puszki: "puszka", puszek: "puszka", puszkę: "puszka",
  słoik: "słoik", słoika: "słoik", słoiki: "słoik",
  opakowanie: "opakowanie", opakowania: "opakowanie", opakowań: "opakowanie",
  paczka: "opakowanie", paczki: "opakowanie", torebka: "opakowanie", torebki: "opakowanie",
  pęczek: "pęczek", pęczka: "pęczek", pęczki: "pęczek",
  listek: "listek", listki: "listek", listków: "listek", liść: "listek", liście: "listek",
  gałązka: "gałązka", gałązki: "gałązka", gałązek: "gałązka",
  kieliszek: "kieliszek", kieliszki: "kieliszek",
  łodyga: "łodyga", łodygi: "łodyga",
  główka: "główka", główki: "główka",
  kostka: "kostka", kostki: "kostka", kostek: "kostka",
  tabliczka: "tabliczka", tabliczki: "tabliczka",
  kulka: "kulka", kulki: "kulka",
  sztuka: "sztuka", sztuki: "sztuka", sztuk: "sztuka",
  filiżanka: "szklanka", filiżanki: "szklanka", filiżanek: "szklanka",
};

/**
 * Jednostki wagi i objętości - jedyne, które dają wynik dokładny.
 *
 * Formy rozpisane słowem też, bo przepisy piszą "pół kilograma żeberek".
 * Bez nich taka linia lądowała w gałęzi "sztuka" i pół kilograma mięsa
 * stawało się pięćdziesięcioma gramami.
 */
const JEDNOSTKI = {
  g: 1, gram: 1, grama: 1, gramy: 1, gramów: 1,
  dag: 10, dkg: 10, deka: 10, dekagram: 10, dekagrama: 10, dekagramów: 10,
  kg: 1000, kilogram: 1000, kilograma: 1000, kilogramy: 1000, kilogramów: 1000, kilo: 1000,
  ml: 1, mililitr: 1, mililitra: 1, mililitrów: 1,
  l: 1000, litr: 1000, litra: 1000, litry: 1000, litrów: 1000,
};

/**
 * Ile brać, gdy przepis pisze samo "sól", "olej" albo "cukier do posypania".
 *
 * Trzecia część wszystkich linii składników nie ma żadnej ilości - autor
 * przepisu zakłada, że wiadomo. Pominięcie takiej linii byłoby gorsze niż
 * przybliżenie: składnik zniknąłby z listy zakupów, a przy oleju do smażenia
 * z makr zniknęłoby sto kilkadziesiąt kalorii.
 *
 * Wartości są celowo skromne. Przepis, w którym cokolwiek zostało tak
 * oszacowane, dostaje znacznik makra_orientacyjne i ekran mówi o tym wprost.
 */
const BEZ_ILOSCI = {
  Przyprawy: 2,
  Warzywa: 10,   // natka, koperek, szczypiorek "do posypania"
  Dodatki: 5,
  Tłuszcze: 10,  // "olej do smażenia" - tyle zostaje na patelni
  Słodkie: 10,
  Nabiał: 20,
  Owoce: 50,
  Napoje: 15,    // "sok z cytryny" to skropienie, nie szklanka
  "Mąki i kasze": 20,
  Pieczywo: 30,
  Bakalie: 15,
  Mięso: 100,
  Ryby: 100,
  Wędliny: 50,
};

/** Ilości zapisane słowem - w kuchni częstsze, niż się wydaje. */
const LICZEBNIKI = {
  pół: 0.5, "półtorej": 1.5, "półtora": 1.5, ćwierć: 0.25,
  jeden: 1, jedna: 1, jedno: 1, dwa: 2, dwie: 2, trzy: 3, cztery: 4,
  pięć: 5, sześć: 6, siedem: 7, osiem: 8, dziewięć: 9, dziesięć: 10,
  kilka: 3, kilkanaście: 12, parę: 3, para: 2,
};

/** Bez ogonków i wielkich liter - do porównywania, nie do wyświetlania. */
function uprość(s) {
  return s
    .toLowerCase()
    .replace(/[ąàâ]/g, "a").replace(/[ćç]/g, "c").replace(/[ęèé]/g, "e")
    .replace(/ł/g, "l").replace(/ń/g, "n").replace(/[óô]/g, "o")
    .replace(/[śş]/g, "s").replace(/[źż]/g, "z")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Rdzeń słowa - tyle, ile wystarczy, by "masła" spotkało się z "masłem".
 *
 * To nie jest porządny stemmer polskiego i nie udaje, że jest. Obcina jedną
 * końcówkę z listy, i tylko wtedy, gdy zostanie co najmniej cztery znaki -
 * inaczej "mak" i "makaron" zlałyby się w jedno.
 */
const KOŃCÓWKI = ["ami", "ach", "owi", "ego", "emu", "ow", "om", "ie", "ia", "ie",
  "ę", "ą", "y", "i", "a", "u", "e", "o"];
function rdzeń(słowo) {
  const s = uprość(słowo);
  for (const k of KOŃCÓWKI) {
    if (s.length - k.length >= 4 && s.endsWith(uprość(k))) return s.slice(0, -k.length);
  }
  return s;
}

function rdzeńFrazy(fraza) {
  return uprość(fraza).split(" ").map(rdzeń).join(" ");
}

/*
 * Indeks aliasów budowany raz, posortowany od najdłuższego.
 *
 * Kolejność ma znaczenie: "natka pietruszki" musi wygrać z "pietruszka",
 * bo to dwa różne składniki o różnych makrach, a jeden zawiera drugi.
 */
const INDEKS = SUROWCE
  .flatMap((s) => s.a.map((alias) => ({ alias, rdzeń: rdzeńFrazy(alias), surowiec: s })))
  .sort((x, y) => y.rdzeń.length - x.rdzeń.length);

/** Surowiec pasujący do nazwy z przepisu albo null. */
export function dopasujSurowiec(nazwa) {
  const r = rdzeńFrazy(nazwa);
  if (!r) return null;
  const dokładnie = INDEKS.find((i) => i.rdzeń === r);
  if (dokładnie) return dokładnie.surowiec;
  // Nazwa bywa doprecyzowana ("cebula czerwona drobno posiekana"), więc
  // wystarczy, że alias jest w niej zawarty jako całe słowa.
  const zawiera = INDEKS.find(
    (i) => r === i.rdzeń || r.startsWith(i.rdzeń + " ") || r.endsWith(" " + i.rdzeń) ||
           r.includes(" " + i.rdzeń + " "),
  );
  return zawiera ? zawiera.surowiec : null;
}

/** Liczba z początku linii: "2", "1,5", "1/2", "½", "2-3" (średnia). */
function wczytajLiczbę(tekst) {
  let t = tekst.trim();
  /*
   * Bez \b na końcu. Granica słowa w JavaScripcie liczy tylko znaki ASCII,
   * więc po "pół" (kończy się na "ł") granicy NIE MA i dopasowanie przepadało
   * razem z każdą ilością zapisaną słowem.
   */
  const słowo = t.match(/^([a-ząćęłńóśźż]+)(?=\s|$)/i);
  if (słowo) {
    const klucz = Object.keys(LICZEBNIKI).find((k) => uprość(k) === uprość(słowo[1]));
    if (klucz) return { ile: LICZEBNIKI[klucz], reszta: t.slice(słowo[0].length) };
  }
  const zakres = t.match(/^(\d+)\s*[-–]\s*(\d+)\b/);
  if (zakres) {
    return { ile: (Number(zakres[1]) + Number(zakres[2])) / 2, reszta: t.slice(zakres[0].length) };
  }
  const ułamekZnak = t.match(/^([½¼¾⅓⅔⅛])/);
  if (ułamekZnak) return { ile: UŁAMKI[ułamekZnak[1]], reszta: t.slice(1) };
  const ułamek = t.match(/^(\d+)\s*\/\s*(\d+)\b/);
  if (ułamek) {
    return { ile: Number(ułamek[1]) / Number(ułamek[2]), reszta: t.slice(ułamek[0].length) };
  }
  const całość = t.match(/^(\d+(?:[.,]\d+)?)/);
  if (całość) {
    const ile = Number(całość[1].replace(",", "."));
    let reszta = t.slice(całość[0].length);
    // "1 i 1/2 szklanki"
    const dopisek = reszta.match(/^\s*i\s+(\d+)\s*\/\s*(\d+)\b/);
    if (dopisek) return { ile: ile + Number(dopisek[1]) / Number(dopisek[2]),
                          reszta: reszta.slice(dopisek[0].length) };
    return { ile, reszta };
  }
  return { ile: null, reszta: t };
}

/**
 * Jedna linia składnika na gramy.
 *
 * Zwraca też `dokładne`: fałsz znaczy, że wynik pochodzi z miary domowej albo
 * z wagi sztuki, czyli z przybliżenia. Przepis, w którym choć jeden składnik
 * jest przybliżony, dostaje w bazie znacznik makra_orientacyjne.
 */
export function parsujSkladnik(linia) {
  const surowa = linia.trim();
  // Nawias to zwykle komentarz ("(najlepiej młode)") - do nazwy nie wnosi nic.
  let t = surowa.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/^(ok\.?|około|mniej więcej)\s+/i, "");

  const { ile, reszta } = wczytajLiczbę(t);
  let ogon = reszta.trim().replace(/^(x|szt\.?)\s*/i, "");

  // Jednostka wagi lub objętości
  const jedn = ogon.match(/^([a-ząćęłńóśźż]+)\.?\s+/i);
  const pierwsze = jedn ? uprość(jedn[1]) : null;

  let miara = null;
  let jednostka = null;
  if (pierwsze && Object.prototype.hasOwnProperty.call(JEDNOSTKI, pierwsze)) {
    jednostka = pierwsze;
    ogon = ogon.slice(jedn[0].length);
  } else if (jedn) {
    const klucz = Object.keys(MIARY).find((m) => uprość(m) === pierwsze);
    if (klucz) {
      miara = MIARY[klucz];
      ogon = ogon.slice(jedn[0].length);
    }
  }

  // "szklanka mleka" bez liczby - domyślnie jedna sztuka miary
  if (!miara && !jednostka && ile === null) {
    const sam = ogon.match(/^([a-ząćęłńóśźż]+)\s+/i);
    if (sam) {
      const klucz = Object.keys(MIARY).find((m) => uprość(m) === uprość(sam[1]));
      if (klucz) {
        miara = MIARY[klucz];
        ogon = ogon.slice(sam[0].length);
      }
    }
  }

  const nazwa = ogon.replace(/^(z|ze|do|na)\s+/i, "").trim();
  const surowiec = dopasujSurowiec(nazwa) ?? dopasujSurowiec(surowa);

  if (!surowiec) return { surowa, nazwa, gramy: null, surowiec: null, dokładne: false };

  const ilość = ile ?? 1;
  let gramy = null;
  let dokładne = false;

  if (jednostka) {
    gramy = ilość * JEDNOSTKI[jednostka];
    // Mililitr to gram tylko dla rzeczy wodnistych, ale w kuchni domowej
    // różnica jest mniejsza niż rozrzut samego przepisu.
    dokładne = true;
  } else if (miara) {
    const waga = surowiec.m?.[miara] ?? MIARY_DOMYSLNE[miara];
    if (waga != null) gramy = ilość * waga;
  } else if (ile !== null) {
    gramy = ilość * (surowiec.s ?? surowiec.m?.sztuka ?? MIARY_DOMYSLNE.sztuka);
  } else {
    // Bez ilości: przyprawa albo zieleń "do posypania".
    const domyślna = BEZ_ILOSCI[surowiec.kat];
    if (domyślna != null) gramy = domyślna;
  }

  if (gramy == null) return { surowa, nazwa, gramy: null, surowiec, dokładne: false };
  return { surowa, nazwa, gramy: Math.round(gramy * 10) / 10, surowiec, dokładne };
}

/** Kroki bywają rozbite na zdania - minutnik bierzemy z pierwszego czasu. */
export function minutyZKroku(tekst) {
  const godziny = tekst.match(/(\d+(?:[.,]\d+)?)\s*(godzin[ayę]?|godz\.?|h)\b/i);
  if (godziny) return Math.round(Number(godziny[1].replace(",", ".")) * 60);
  const minuty = tekst.match(/(\d+)\s*(?:[-–]\s*(\d+)\s*)?(minut[ayę]?|min\.?)\b/i);
  if (minuty) {
    const a = Number(minuty[1]);
    const b = minuty[2] ? Number(minuty[2]) : null;
    return b ? Math.round((a + b) / 2) : a;
  }
  return null;
}

/** Wikitekst bez znaczników - to, co ma zobaczyć człowiek. */
export function oczyśćTekst(s) {
  return s
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/<ref[^>]*>.*?<\/ref>/gis, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/'''?/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cała strona: nazwa, składniki, kroki, kategorie. */
export function parsujStronę(tytuł, wikitekst) {
  const nazwa = tytuł.split("/").slice(1).join("/").trim();
  const skladniki = [];
  const sekcjaS = wikitekst.match(/==\s*Składniki\s*==(.*?)(?===|$)/s);
  if (sekcjaS) {
    for (const l of sekcjaS[1].split("\n")) {
      if (!l.trim().startsWith("*")) continue;
      const tekst = oczyśćTekst(l.trim().replace(/^\*+/, ""));
      if (tekst) skladniki.push(parsujSkladnik(tekst));
    }
  }
  const kroki = [];
  const sekcjaK = wikitekst.match(
    /==\s*(?:Przygotowanie|Wykonanie|Sposób przygotowania)\s*==(.*?)(?===|$)/s,
  );
  if (sekcjaK) {
    for (const l of sekcjaK[1].split("\n")) {
      if (!l.trim().startsWith("#")) continue;
      const tekst = oczyśćTekst(l.trim().replace(/^#+/, ""));
      if (tekst) kroki.push({ tekst, minuty: minutyZKroku(tekst) });
    }
  }
  const kategorie = [];
  for (const k of wikitekst.matchAll(/\{\{SortKuchWolumin\|([^}]*)\}\}/g)) {
    kategorie.push(...k[1].split("|").map((x) => x.trim()).filter(Boolean));
  }
  return { nazwa, tytuł, skladniki, kroki, kategorie };
}
