# Zadanie: moduł "Wygląd" (looksmaxing) w Grind

Zbuduj kompletną, działającą zakładkę **Wygląd**: skan twarzy kamerą → analiza AI →
raport z zaleceniami (pielęgnacja, mewing, ćwiczenia, postawa, nawyki) → zapis oceny →
śledzenie progresu w czasie.

Pracuj po polsku: nazwy tabel, kolumn, tras, etykiet UI i komentarzy w kodzie.

---

## 0. Kontekst repo - nie odkrywaj tego na nowo

- Next.js **16.3.3** (App Router, React 19.2, Tailwind 4). **Przeczytaj `node_modules/next/dist/docs/`
  zanim napiszesz kod** - ta wersja różni się od Twoich danych treningowych (patrz `AGENTS.md`).
- Supabase: `@/lib/supabase/server` (`createClient()`), typy w `src/lib/database.types.ts`.
- Migracje: `supabase/migrations/NNNN_nazwa.sql`. **Ostatnia to `0038_search_path.sql` → Twoja to `0039_wyglad.sql`.**
  Uruchamianie: `npm run db:push`, walidacja: `npm run validate:sql`.
- Trasy aplikacji: `src/app/(app)/<trasa>/page.tsx`. Komponenty: `src/components/<modul>/`.
- Design system: `src/components/ui.tsx` - masz `Card, Button, Spinner, Field, Input, Textarea,
  Select, Chip, Stat, EmptyState, SegmentedControl, Sheet, Alert, NumberField, Toast, Skeleton,
  ScreenSkeleton, ProgressRing, ScoreRing`. **Nie twórz własnych odpowiedników.**
- Wykresy: `recharts` + `src/lib/viz.ts` i `src/lib/useVizColors.ts`.
- AI: `@anthropic-ai/sdk` + `zodOutputFormat` z `@anthropic-ai/sdk/helpers/zod`. Wzorzec do
  skopiowania 1:1: **`src/app/api/ai/coach/route.ts`** (bramka `guard()`, `has_pro` RPC,
  `consume_ai_call` RPC, `maxDuration`, `MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5"`).
- Kamera: wzorzec pracy z `getUserMedia` i zwalniania strumienia masz w
  **`src/components/books/IsbnScanner.tsx`** - użyj tej samej dyscypliny (`stopCamera` w cleanupie,
  obsługa braku zgody, fallback).
- Nawigacja: `src/components/BottomNav.tsx` ma **7 zakładek i to jest twardy limit - nie dodawaj ósmej.**
- Push: `web-push`, kolejka w migracjach `0018`-`0020`, `0030`.
- Zod v4. Stripe do bramkowania Pro.

---

## 1. Nawigacja i wejście

- Nowa trasa `/(app)/wyglad`.
- Wpis **na górze** listy `LINKS` w `src/app/(app)/wiecej/page.tsx`:
  `{ href: "/wyglad", icon: "🪞", label: "Wygląd", desc: "Skan twarzy, pielęgnacja, postawa, progres" }`.
- Kafelek na pulpicie "Dziś" pokazujący aktualną ocenę + datę ostatniego skanu
  (albo CTA "Zrób pierwszy skan", gdy brak danych).

---

## 2. Migracja `0039_wyglad.sql`

Wszystkie tabele z **RLS per-użytkownik** wzorem `supabase/migrations/0002_rls.sql`
(`using (auth.uid() = user_id)` dla select/insert/update/delete). Zachowaj konwencję
`set search_path` z `0038_search_path.sql` dla każdej nowej funkcji.

```sql
-- Prywatny bucket na zdjęcia. NIGDY publiczny - dostęp wyłącznie signed URL.
insert into storage.buckets (id, name, public) values ('wyglad', 'wyglad', false)
  on conflict do nothing;
-- + polityki storage: user czyta/pisze wyłącznie w prefiksie własnego auth.uid()

wyglad_skany (
  id uuid pk, user_id uuid not null, utworzono timestamptz default now(),
  ujecie text check (ujecie in ('front','profil','sylwetka')),
  storage_path text not null,
  ocena_ogolna smallint,              -- 0-100, składowa z podocen
  oceny jsonb,                         -- { skora, symetria, definicja_zuchwy, oczy, wlosy, postawa, zeby }
  raport jsonb,                        -- pełna odpowiedź modelu (WyglądAnalysisSchema)
  model text, wersja_promptu smallint
)

wyglad_pomiary (id, user_id, data date, waga, talia, klatka, ramie, szyja, biodra, bf_szac)

wyglad_rutyny (id, user_id, klucz text, nazwa, pora text check (pora in ('rano','wieczor','dowolnie')),
               kroki jsonb, aktywna bool, zrodlo text)   -- zrodlo: 'ai' | 'wlasna' | 'biblioteka'

wyglad_rutyna_log (id, user_id, rutyna_id, data date, wykonano bool)

wyglad_protokoly (id, user_id, klucz text, aktywny bool, rozpoczeto date)
  -- klucz: 'mewing' | 'cwiczenia_twarzy' | 'postawa' | 'spf' | 'nic_dentystyczna' | ...

wyglad_produkty (id, user_id, nazwa, skladniki_aktywne text[], pora, otwarty_od date, wazny_do date)

wyglad_zgoda (user_id pk, wiek_potwierdzony bool, zaakceptowano_at timestamptz)
```

Indeksy: `(user_id, utworzono desc)` na skanach, `(user_id, data)` na logu i pomiarach -
wzorem `0036_indeksy_i_polityki.sql`.

---

## 3. Skan kamerą - `src/components/looks/FaceScanner.tsx`

Klient, `"use client"`, otwierany w `Sheet`.

Wymagania:
1. `getUserMedia({ video: { facingMode: "user", width: { ideal: 1080 } } })`.
   **Zwolnienie strumienia w cleanupie i przy zamknięciu arkusza - jak w `IsbnScanner`.**
   Kamera zapalona po zamknięciu to błąd krytyczny.
2. **Owal-prowadnica** na podglądzie + instrukcja: "Twarz w owalu, neutralny wyraz, światło
   z przodu, bez okularów". Kolor owalu zmienia się na `accent`, gdy kadr jest OK.
3. **Ghost overlay** - jeżeli istnieje poprzedni skan tego samego ujęcia, nałóż go na podgląd
   z `opacity: .28`. To decyduje o tym, czy porównanie po 3 miesiącach ma jakąkolwiek wartość.
4. Sekwencja 3 ujęć: `front → profil → sylwetka` (profil i sylwetka opcjonalne, da się pominąć).
5. Klatka do `canvas` → `toBlob('image/jpeg', 0.85)`, **max 1600 px dłuższy bok** (kompresja
   po stronie klienta - nie wysyłaj 6 MB z telefonu).
6. Upload do bucketu `wyglad` pod `${user.id}/${skanId}/${ujecie}.jpg`, potem POST do `/api/ai/wyglad`.
7. Fallback: wybór pliku z galerii (`<input type="file" accept="image/*" capture="user">`),
   gdy brak zgody na kamerę lub brak przedniego obiektywu.
8. Przed pierwszym skanem - jednorazowy ekran zgody zapisywany w `wyglad_zgoda`:
   potwierdzenie 16+ i zdanie, że to nie jest porada medyczna ani diagnoza dermatologiczna.

---

## 4. API `src/app/api/ai/wyglad/route.ts`

Skopiuj strukturę z `src/app/api/ai/coach/route.ts`:

- `export const maxDuration = 120;`
- `guard()`: zalogowany → `ANTHROPIC_API_KEY` obecny → `supabase.rpc("has_pro")`.
  Skan jest funkcją **Pro** (kody błędów jak w coachu: 401 / 503 `missing_api_key` /
  402 `needs_subscription`).
- `consume_ai_call` z `DAILY_LIMIT = 3` - **wołane dopiero tuż przed wywołaniem modelu.**
  Analiza obrazu jest droga, trzy skany dziennie to i tak dużo (sensowna kadencja to raz na tydzień).
- Odczyt obrazu: signed URL z bucketu → pobranie → base64 → blok `image` w treści wiadomości.
- `zodOutputFormat(WygladAnalysisSchema, "analiza_wygladu")`.
- Do promptu doklej sekcję **FAKTY** z bazy (tak jak coach robi z dietą i snem):
  średni sen z 14 dni, średnie kcal i trend wagi, aktywne nałogi z `0027_nalogi.sql`,
  nawodnienie z `0008_habits_water.sql`, wynik poprzedniego skanu i jego datę.
  **Model nie liczy tych liczb - dostaje je gotowe i ma je zinterpretować.**
- Zapis do `wyglad_skany`, a następnie **automatyczne utworzenie/aktualizacja rutyn
  i protokołów** z pola `plan` odpowiedzi (upsert po `klucz`, nie duplikuj istniejących).

---

## 5. Schemat odpowiedzi - `src/lib/ai/wygladSchema.ts`

Wzoruj się stylistycznie na `src/lib/ai/coachSchema.ts` (opisy `.describe()` po polsku,
twarde limity długości, twarde limity liczby elementów).

```ts
const PodocenaSchema = z.object({
  klucz: z.enum(["skora","symetria","definicja_zuchwy","oczy","wlosy","zarost","zeby","postawa","skladu_ciala"]),
  ocena: z.number().int().min(0).max(100),
  obserwacja: z.string().max(240).describe("Co konkretnie widać. Opisowo, bez ogólników."),
});

const ZalecenieSchema = z.object({
  kategoria: z.enum(["pielegnacja","mewing","cwiczenia_twarzy","postawa","trening","dieta","sen","nawyki","fryzura","zeby","specjalista"]),
  tytul: z.string().max(80),
  dlaczego: z.string().max(400).describe("Powiąż z konkretną obserwacją ze skanu albo liczbą z FAKTÓW."),
  jak: z.array(z.string().max(160)).max(6).describe("Kroki do wykonania. Konkret, nie 'zadbaj o'."),
  czestotliwosc: z.string().max(60).describe("np. 'codziennie wieczorem', '3× w tygodniu'"),
  horyzont_tygodni: z.number().int().min(1).max(52).describe("Realny czas do zauważalnego efektu."),
  priorytet: z.number().int().min(1).max(3).describe("1 = największy realny wpływ"),
});

export const WygladAnalysisSchema = z.object({
  ocena_ogolna: z.number().int().min(0).max(100),
  podsumowanie: z.string().max(500).describe("3-4 zdania. Rzeczowo, bez komplementów i bez straszenia."),
  podoceny: z.array(PodocenaSchema).min(3).max(9),
  mocne_strony: z.array(z.string().max(120)).max(3),
  plan: z.array(ZalecenieSchema).min(3).max(6).describe("Uszeregowane po priorytecie."),
  najwieksza_dzwignia: z.string().max(160).describe("JEDNA rzecz na najbliższe 30 dni."),
  jakosc_zdjecia: z.object({
    wystarczajaca: z.boolean(),
    uwagi: z.string().max(200).describe("np. 'zdjęcie prześwietlone, oceny skóry są niepewne'"),
  }),
});
```

---

## 6. System prompt modelu

Umieść jako stałą `SYSTEM` w route (styl jak w coachu - numerowane zasady):

```
Jesteś doświadczonym konsultantem wizerunku i pielęgnacji, rozmawiasz po polsku z osobą,
która sama poprosiła o ocenę swojego wyglądu i prowadzi w aplikacji dziennik treningu,
diety, snu i nawyków.

Jak pracujesz:
1. Oceniasz WYŁĄCZNIE to, co widać na zdjęciu i co wynika z liczb w sekcji FAKTY.
   Nie zgadujesz wieku, pochodzenia, statusu ani charakteru.
2. Każda podocena musi mieć konkretną obserwację. "Cienie podoczodołowe i lekki obrzęk powiek"
   zamiast "zmęczony wygląd".
3. Wszystkie liczby w FAKTACH są już policzone. Nie przeliczaj ich - wyjaśnij je i połącz
   z tym, co widzisz. Jeżeli widzisz stan skóry, a FAKTY mówią o 5h snu i alkoholu 3× w tygodniu,
   powiedz to wprost.
4. Plan zawiera maksymalnie sześć zaleceń, uszeregowanych po realnym wpływie. Podajesz uczciwy
   horyzont czasowy: pielęgnacja skóry 8-12 tygodni, skład ciała 12-24 tygodnie, włosy 16+ tygodni.
5. Mewing i ćwiczenia mięśni twarzy opisujesz uczciwie: to praca nad postawą języka, żuchwy i szyi.
   U dorosłych nie przebudowują kości - dają umiarkowaną poprawę napięcia i linii żuchwy,
   zwłaszcza przy niskim poziomie tkanki tłuszczowej. Nie obiecujesz zmiany budowy czaszki.
6. NIGDY nie proponujesz: zabiegów chirurgicznych, sterydów anaboliczno-androgennych, leków na
   receptę, głodówek, "bone smashing" ani żadnego urazu zadawanego celowo. Przy podejrzeniu
   problemu medycznego (nasilony trądzik, gwałtowne wypadanie włosów, zmiana barwnikowa)
   piszesz jedno zdanie o wizycie u dermatologa i przechodzisz dalej.
7. Nie porównujesz użytkownika do innych ludzi ani do żadnych "średnich". Punktem odniesienia
   jest wyłącznie jego własny poprzedni skan.
8. Gdy zdjęcie jest złej jakości (prześwietlone, rozmyte, w cieniu, twarz częściowo zasłonięta),
   ustawiasz jakosc_zdjecia.wystarczajaca = false, obniżasz pewność ocen i mówisz, co poprawić.
   Nie zmyślasz obserwacji, których nie widać.
9. Piszesz zwięźle i bezpośrednio. Bez motywacyjnych ogólników, bez komplementów z grzeczności
   i bez straszenia.
```

---

## 7. Ekrany - `src/components/looks/`

**`LooksScreen.tsx`** (główny, `/wyglad`):
- `ScoreRing` z `ocena_ogolna` + delta względem poprzedniego skanu ("+4 od 12 sierpnia").
- Wiersz `Stat` z podocenami (skóra, żuchwa, oczy, włosy, postawa).
- Karta **"Największa dźwignia"** - jedno zdanie z `najwieksza_dzwignia`.
- Dzisiejsze rutyny jako checklisty (zapis do `wyglad_rutyna_log`).
- Aktywne protokoły (mewing, ćwiczenia twarzy, postawa) ze streakiem.
- Duży przycisk **"Nowy skan"** + informacja, kiedy następny ma sens (sugerowana kadencja: 7 dni).
- `EmptyState`, gdy brak skanów.

**`ScanReport.tsx`** - pełny raport z ostatniego skanu: podsumowanie, podoceny z obserwacjami,
mocne strony, plan jako lista rozwijana (`kategoria`, `dlaczego`, kroki `jak`, `horyzont_tygodni`).
Każde zalecenie ma przycisk **"Dodaj do rutyny"** / **"Włącz protokół"**.

**`ProgressTimeline.tsx`** - oś czasu skanów: miniatury (signed URL), wykres `recharts`
z `ocena_ogolna` i wybraną podoceną w czasie, oraz **suwak przed/po** nakładający najstarsze
i najnowsze zdjęcie tego samego ujęcia.

**`RoutineEditor.tsx`** - edycja rutyn rano/wieczór, dodawanie produktów.
**Ostrzeżenia o konfliktach składników** licz w kodzie (nie w modelu), w `src/lib/looks.ts`:
retinoid + AHA/BHA tego samego wieczoru, retinoid + wit. C, benzoyl peroxide + retinoid,
brak SPF przy aktywnym retinoidzie.

**Biblioteka protokołów** - `src/lib/looks/protokoly.ts`, dane statyczne, bez AI:
- `mewing` - postawa języka, oddychanie nosem, pozycja żuchwy; 3 poziomy, uczciwy opis efektów
- `cwiczenia_twarzy` - 5-6 ćwiczeń, czas trwania, opis wykonania
- `postawa` - 5-minutowa mobilność (klatka, biodra, szyja); **podlinkuj do modułu kontuzji**
- `spf`, `nic_dentystyczna`, `nawodnienie` - proste nawyki dzienne

---

## 8. Progres i ocena w czasie

- Widok "Progres" liczy deltę per podocena między pierwszym a ostatnim skanem.
- Korelacje liczone w kodzie (`src/lib/looks.ts`), nie przez model: średni sen vs `oceny.skora`,
  dni bez alkoholu vs `oceny.skora`, waga vs `oceny.definicja_zuchwy`. Prezentuj jako
  obserwację z zastrzeżeniem, nie jako dowód przyczynowy.
- Adherencja rutyn (% wykonanych dni z 30) obok wyniku - to ona tłumaczy brak progresu.

---

## 9. Integracje

- **Nawyki**: rutyny "rano"/"wieczór" i protokoły pojawiają się w istniejącym module
  `/nawyki`, żeby codzienne odhaczanie nie wymagało wchodzenia w osobną zakładkę.
- **Push**: przypomnienie o rutynie wieczornej i o skanie co 7 dni - dołóż do istniejącej
  kolejki (`0019_push_kolejka.sql`, `0030_push_zbiorczo.sql`), nie buduj nowego mechanizmu.
- **Dane osobowe**: skany i zdjęcia muszą trafić do eksportu i do usuwania konta
  z `0024_zgody_i_dane.sql` - łącznie z plikami w buckecie.

---

## 10. Free vs Pro

- **Free**: rutyny pielęgnacyjne i protokoły, pomiary, ręczne zdjęcia, historia 3 miesiące.
- **Pro**: skan AI i raport, pełna historia zdjęć, porównania przed/po, korelacje, wykresy.

---

## 11. Standard wykonania

- Komentarze po polsku i **wyjaśniające "dlaczego", nie "co"** - dokładnie w stylu
  `BottomNav.tsx` i `coach/route.ts`. Trzymaj tę samą gęstość komentarzy co reszta repo.
- Zero `any`. Typy Supabase dopisz do `src/lib/database.types.ts`.
- Obsłuż stany: brak zgody na kamerę, brak sieci (repo ma `src/lib/offline`), przekroczony
  limit dzienny, brak subskrypcji, złe zdjęcie, pierwszy raz bez danych.
- Dostępność: `aria-label` na przyciskach kamery, komunikat statusu przez `aria-live`.

## 12. Definicja ukończenia

1. `npm run validate:sql` i `npm run db:push` przechodzą.
2. `npm run lint` i `npx tsc --noEmit` bez błędów.
3. `npm run test:offline` przechodzi.
4. Ręcznie: skan → raport → dodanie zalecenia do rutyny → odhaczenie → drugi skan →
   widoczna delta i suwak przed/po.
5. Kamera zwalniana po zamknięciu arkusza (sprawdź diodę / wskaźnik w pasku przeglądarki).
6. Zdjęcie nie jest dostępne bez signed URL - sprawdź surowy URL bucketu w trybie incognito.

Zacznij od migracji `0039_wyglad.sql` i komponentu skanu - to najbardziej ryzykowne części.
Po migracji zatrzymaj się i pokaż mi SQL do akceptacji, zanim ruszysz z UI.
