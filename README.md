# Grind — trening, dieta, postępy

Mobilna aplikacja webowa (PWA) do prowadzenia treningu siłowego i MMA, diety
oraz pozostałych aktywności. Cały interfejs jest po polsku, układ jest
zaprojektowany pod telefon trzymany w jednej ręce, a motyw jasny/ciemny
przełącza się automatycznie za ustawieniem systemu.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase
(Postgres + Auth + Row Level Security) · recharts · Vercel.

---

## Co jest w środku

### 1. Trening
- Plan treningowy **jest danymi w bazie**, nie kodem — każdy dzień, ćwiczenie,
  liczba serii i powtórzeń są edytowalne z poziomu aplikacji.
- Ekran „Dziś”: jeden przycisk startuje sesję, przy każdym ćwiczeniu widać
  wynik z poprzedniego treningu.
- Szybkie dodawanie serii: pola wstępnie wypełnione ostatnim wynikiem,
  plus/minus obok każdej wartości, skok ciężaru do wyboru (0,5 / 1 / 1,25 /
  2,5 / 5 / 10 kg) i zapamiętywany między treningami.
- Timer przerwy startuje sam po zapisaniu serii.
- Ćwiczenie spoza planu można dorzucić w trakcie sesji.
- **Ból kolana 0–10** — po dniu nóg aplikacja prosi o ocenę; historia trafia na
  wykres.

### 2. Dieta
- Wyszukiwarka produktów w **Open Food Facts** (przez własny endpoint, więc
  bez problemów z CORS i z buforowaniem).
- Własne produkty dodawane ręcznie.
- Dziennik: Śniadanie / Obiad / Kolacja / Przekąska; wpisujesz gramy albo
  wybierasz gotową porcję, makro liczy sama baza.
- Podsumowanie dnia zestawione z celami z profilu.

### 3. Aktywności
- Ręczne wpisy: typ, data, czas, dystans, kalorie, notatka.
- Tabela ma kolumnę `source` (`manual` / `strava`), więc późniejszy import ze
  Stravy nie będzie wymagał migracji schematu. Samej integracji w wersji 1 nie ma.

### 4. Postępy
- Wykres siły dla wybranego ćwiczenia (najcięższa seria albo szacowany 1RM).
- Waga ciała, ból kolana, objętość tygodniowa (ciężar × powtórzenia).
- Podsumowanie 7 / 30 dni: treningi, serie, objętość, średnie kcal, aktywności.
- Kalendarz łączący w jednym dniu trening + dietę + aktywność.

### Dodatkowo
- **Katalog ćwiczeń** ze zdjęciami, opisem, wskazówkami technicznymi i typowymi
  błędami — 41 pozycji opisanych ręcznie po polsku, plus opcjonalny import
  ~120 ćwiczeń z wger.de.
- **Własne plany** — każdy użytkownik może zbudować swój plan od zera albo
  skopiować gotowy szablon jednym kliknięciem.
- **AI-trener** — formularz opisuje cel, staż, kontuzje i dostępny sprzęt, a
  model układa plan, który przed zapisaniem można obejrzeć i poprawić.
  Działa po dodaniu `ANTHROPIC_API_KEY`; bez klucza reszta aplikacji działa
  normalnie.
- **PWA** — manifest i ikony, aplikację można dodać do ekranu głównego.

---

## Uruchomienie od zera

### Krok 1 — załóż projekt Supabase

1. Wejdź na [supabase.com/dashboard](https://supabase.com/dashboard) i kliknij
   **New project**.
2. Wybierz nazwę (np. `grind`), ustaw hasło do bazy i region **Frankfurt (eu-central-1)** —
   najbliżej Polski.
3. Poczekaj 1–2 minuty, aż projekt się postawi.

### Krok 2 — wgraj strukturę bazy

W panelu Supabase otwórz **SQL Editor → New query** i wykonaj pliki z katalogu
[`supabase/migrations/`](supabase/migrations/) **po kolei**, każdy jako osobne
zapytanie:

| Plik | Co robi |
|---|---|
| `0001_schema.sql` | 15 tabel, indeksy, triggery, funkcja nadająca rolę admina |
| `0002_rls.sql` | Row Level Security — polityki dostępu dla każdej tabeli |
| `0003_functions.sql` | `clone_plan`, `set_active_plan`, widoki i podsumowania |
| `0004_seed_catalog.sql` | 41 ćwiczeń w katalogu, po polsku, z opisem i wskazówkami |
| `0005_seed_plan_template.sql` | plan „Kolano + MMA” jako publiczny szablon (7 dni, 41 pozycji) |

Każdy plik jest idempotentny (`if not exists`, `on conflict do nothing`) —
ponowne uruchomienie niczego nie zepsuje.

Zamiast klikać w panelu można puścić wszystko jedną komendą — potrzebny jest
[Personal Access Token](https://supabase.com/dashboard/account/tokens) i `ref`
projektu (widoczny w adresie panelu):

```bash
SUPABASE_ACCESS_TOKEN=sbp_... SUPABASE_PROJECT_REF=twoj-ref npm run db:push
```

### Krok 3 — włącz logowanie e-mailem

**Authentication → Providers → Email**: zostaw włączone i **wyłącz Confirm email**
(*Authentication → Sign In / Providers → Email → Confirm email*).

To nie jest skrót na skróty — wbudowany mailer Supabase wysyła najwyżej 2 wiadomości
na godzinę i tylko na adres właściciela organizacji, więc rejestracja oparta o link
potwierdzający po prostu nie działa bez własnego SMTP. Z wyłączonym potwierdzaniem
konto jest aktywne od razu po rejestracji, bez udziału poczty.

Jeśli kiedyś podepniesz własny SMTP (*Project Settings → Authentication → SMTP Settings*,
np. Resend albo Postmark), możesz potwierdzanie włączyć z powrotem — wtedy zadziała
też resetowanie hasła, które jako jedyne nadal wymaga poczty.

### Krok 4 — skonfiguruj aplikację lokalnie

```bash
git clone <adres-repozytorium> grind-app
cd grind-app
npm install
cp .env.example .env.local
```

W `.env.local` wpisz dwie wartości z **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://twoj-projekt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

```bash
npm run dev
```

Aplikacja stanie na [localhost:3000](http://localhost:3000). Załóż konto
e-mailem — profil, cele makro i rola tworzą się automatycznie.

> Bez tych dwóch zmiennych aplikacja nie wywala się, tylko pokazuje ekran z
> instrukcją, czego brakuje.

---

## Wdrożenie na Vercel

1. Wypchnij repozytorium na GitHub.
2. [vercel.com/new](https://vercel.com/new) → **Import** wybranego repo.
   Framework (Next.js), komenda budowania i katalog wyjściowy wykryją się same.
3. W **Environment Variables** dodaj:

   | Zmienna | Wymagana | Skąd |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | tak | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tak | tamże, klucz `anon public` |
   | `ANTHROPIC_API_KEY` | nie | [console.anthropic.com](https://console.anthropic.com) — tylko dla AI-trenera |
   | `ANTHROPIC_MODEL` | nie | domyślnie `claude-opus-5` |

4. **Deploy**.
5. Wróć do Supabase → **Authentication → URL Configuration** i dopisz adres z
   Vercela do **Site URL** oraz **Redirect URLs**.

> ⚠️ **`SUPABASE_SERVICE_ROLE_KEY` nigdy nie trafia na Vercela ani do repozytorium.**
> Ten klucz omija Row Level Security — jest potrzebny wyłącznie lokalnie, przy
> jednorazowym imporcie katalogu z wger (niżej).

---

## Struktura bazy

15 tabel, każda z włączonym Row Level Security. Poza globalnym katalogiem
ćwiczeń i publicznymi szablonami planów **każdy widzi wyłącznie własne dane** —
sprawdza to zestaw testów (`npm run test:db`).

### Konto i katalog

| Tabela | Zawartość |
|---|---|
| `profiles` | konto: e-mail, nazwa, **rola** (`user` / `admin`), cele makro, wzrost, rocznik |
| `exercise_catalog` | ćwiczenia: nazwa, opis, wskazówki, błędy, partia, sprzęt, zdjęcie, metryka. `user_id IS NULL` = pozycja globalna, widoczna dla wszystkich; `user_id` ustawione = ćwiczenie prywatne |

### Plan treningowy

Hierarchia jest dokładnie taka, jak w założeniach: **plan → faza → dzień → ćwiczenie**.

| Tabela | Zawartość |
|---|---|
| `plans` | plan użytkownika; `is_template` + `is_public` oznaczają szablon do skopiowania |
| `phases` | faza planu (np. „Faza 1 — rehab kolana”), kolejność, opis |
| `workout_days` | dzień treningowy: `day_type`, `tracks_knee_pain` |
| `workout_exercises` | pozycja w dniu: ćwiczenie z katalogu, serie, powtórzenia, przerwa, uwagi |

### Zapisy treningu

| Tabela | Zawartość |
|---|---|
| `workout_sessions` | pojedynczy trening: data, dzień planu, start, koniec, czas trwania |
| `workout_logs` | **seria**: data, ćwiczenie, numer serii, ciężar, powtórzenia, czas, dystans, RPE, rozgrzewkowa czy robocza |
| `knee_pain_logs` | ocena bólu kolana 0–10 z notatką |
| `body_weight_logs` | pomiar wagi ciała |

### Dieta

| Tabela | Zawartość |
|---|---|
| `foods` | produkt: makro na 100 g, porcja, marka, zdjęcie, `off_id` dla pozycji z Open Food Facts |
| `meals` | posiłek danego dnia (Śniadanie / Obiad / Kolacja / Przekąska) |
| `meal_entries` | pozycja w posiłku: gramatura + makro **liczone automatycznie** kolumnami generowanymi w bazie |

### Reszta

| Tabela | Zawartość |
|---|---|
| `activities` | aktywność: typ, czas, dystans, kalorie, `source` (`manual` / `strava`) |
| `ai_plan_requests` | historia zapytań do AI-trenera wraz z wygenerowanym planem |

### Funkcje i widoki

| Nazwa | Do czego |
|---|---|
| `clone_plan(plan_id, nazwa, aktywuj)` | kopiuje cały plan z fazami, dniami i ćwiczeniami na konto wywołującego |
| `set_active_plan(plan_id)` | ustawia jeden plan jako aktywny |
| `last_exercise_sets(...)` | serie z ostatniego treningu danego ćwiczenia — to, co widać obok pól wpisywania |
| `period_summary(od, do)` | podsumowanie okresu: treningi, serie, objętość, kcal, aktywności, waga, ból kolana |
| `v_daily_nutrition` | makro zsumowane per dzień |
| `v_daily_volume` | objętość i liczba serii per dzień |
| `v_exercise_prs` | rekordy dla każdego ćwiczenia |

Widoki mają `security_invoker = on`, więc **nie omijają** Row Level Security.

---

## Konto administratora

Migracja `0001_schema.sql` nadaje rolę `admin` kontu założonemu na adres
**`zdzis.paschalski@gmail.com`** — automatycznie, w momencie rejestracji.

Administrator dodatkowo może edytować i usuwać pozycje w globalnym katalogu
ćwiczeń oraz publikować plany jako szablony. Żeby zmienić ten adres, popraw go
w funkcji `public.handle_new_user()` **zanim** uruchomisz migrację.

Roli nie da się nadać sobie samemu z aplikacji — polityka `profiles_update_own`
wprost blokuje zmianę kolumny `role` przez użytkownika.

---

## Opcjonalnie: import katalogu z wger

Dorzuca ~120 ćwiczeń ze zdjęciami z [wger.de](https://wger.de) do globalnego
katalogu (ręcznie opisane 41 pozycji zostaje na wierzchu).

```bash
# w .env.local, tylko lokalnie:
SUPABASE_SERVICE_ROLE_KEY=eyJ...

WGER_DRY_RUN=1 npm run import:wger   # podgląd, nic nie zapisuje
npm run import:wger                  # właściwy import
```

Skrypt jest idempotentny (`on conflict (source, source_id)`), więc można go
uruchomić ponownie. Po imporcie **usuń service role key z `.env.local`**.

---

## Skrypty

| Komenda | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` | build produkcyjny |
| `npm run lint` | ESLint + reguły React Compilera |
| `npm run validate:sql` | uruchamia wszystkie migracje w PGlite (Postgres w WASM) — łapie błędy SQL bez stawiania bazy |
| `npm run test:db` | 15 testów schematu i Row Level Security: izolacja danych między kontami, rola admina, kopiowanie planu, liczenie makro, podsumowania |
| `npm run db:push` | uruchamia wszystkie migracje na zdalnym projekcie Supabase (wymaga `SUPABASE_ACCESS_TOKEN` i `SUPABASE_PROJECT_REF`) |
| `npm run test:live` | test end-to-end na żywym wdrożeniu: rejestracja, logowanie, wszystkie ekrany, skopiowanie planu, zapis serii, podsumowanie — z posprzątaniem po sobie |
| `npm run import:wger` | import katalogu z wger (wymaga service role key) |
| `npm run icons` | generuje ikony PWA do `public/icons/` |

`validate:sql` i `test:db` nie potrzebują Dockera ani zainstalowanego Postgresa —
działają na PGlite.

`test:live` uderza w prawdziwe wdrożenie — zakłada konto testowe, przechodzi całą
ścieżkę użytkownika i kasuje je na końcu:

```bash
GRIND_URL=https://twoja-apka.vercel.app \
NEXT_PUBLIC_SUPABASE_URL=https://twoj-ref.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_... \
SUPABASE_SERVICE_ROLE_KEY=... \
npm run test:live
```

---

## Licencje i przypisanie źródeł

- **Open Food Facts** — dane produktów spożywczych na licencji
  [ODbL](https://opendatacommons.org/licenses/odbl/). Aplikacja pokazuje
  informację o źródle przy wynikach wyszukiwania.
- **wger** — opisy i zdjęcia ćwiczeń na licencji
  [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  Autor i licencja każdej pozycji są zapisywane w kolumnach
  `license`, `license_author` i `license_url` i wyświetlane na karcie ćwiczenia.

---

## Czego świadomie nie ma w wersji 1

- Integracji ze Stravą (jest przygotowana kolumna `source`, nie ma OAuth).
- Skanera kodów kreskowych.
- Aplikacji natywnej — Grind działa jako PWA.
- Trybu offline (manifest i ikony są, service workera nie ma).
