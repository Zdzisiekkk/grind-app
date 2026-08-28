/**
 * Typy bazy danych Grind.
 *
 * Pisane ręcznie i utrzymywane razem z migracjami w supabase/migrations/.
 * Jeśli podłączysz Supabase CLI, ten plik można wygenerować automatycznie:
 *   supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 */

/** Insert: `Req` to kolumny obowiązkowe, reszta ma wartości domyślne w bazie. */
type Tbl<Row, Req extends keyof Row = never> = {
  Row: Row;
  Insert: Pick<Row, Req> & Partial<Omit<Row, Req>>;
  Update: Partial<Row>;
  Relationships: [];
};

export type ExerciseMetric = "weight_reps" | "reps" | "time" | "distance" | "rounds";
export type DayType = "gym" | "conditioning" | "mobility" | "mma" | "other";
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type ActivityType =
  | "running"
  | "cycling"
  | "swimming"
  | "mma_sparring"
  | "mma_training"
  | "walking"
  | "rowing"
  | "hiking"
  | "climbing"
  | "other";

export type Profile = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: "user" | "admin";
  daily_kcal: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  height_cm: number | null;
  birth_year: number | null;
  sex: "m" | "f" | "other" | null;
  /** Cel nawodnienia na dobę w mililitrach. */
  daily_water_ml: number | null;
  /** Ile mililitrów dodaje jedno tapnięcie „+". */
  water_portion_ml: number;
  water_reminder_from: string | null;
  water_reminder_to: string | null;
  water_reminder_every_min: number | null;
  /** Cel snu na dobę w minutach. */
  sleep_goal_min: number;
  /** Godzina, o której chcesz gasić światło — punkt odniesienia regularności. */
  sleep_target_bedtime: string | null;
  sleep_reminder_at: string | null;
  /** Strefa czasowa urządzenia — bez niej push o 22:00 przyszedłby o północy. */
  timezone: string;
  /* --- Wypełnia kreator startowy (/start) --- */
  goal: "cut" | "maintain" | "bulk" | null;
  activity_level: "sedentary" | "light" | "moderate" | "high" | "athlete" | null;
  experience: "beginner" | "intermediate" | "advanced" | null;
  equipment: "gym" | "minimal" | "home" | null;
  /** Ile treningów tygodniowo to komplet — mianownik filaru treningowego. */
  weekly_workouts: number | null;
  /** Puste = kreator jeszcze nie przeszedł. */
  onboarded_at: string | null;
  /* --- Zgody (RODO) --- */
  /** Wersja regulaminu, na którą wyrażono zgodę. */
  terms_version: number | null;
  terms_accepted_at: string | null;
  /** Osobna zgoda na dane o zdrowiu — art. 9 RODO wymaga odrębnej. */
  health_consent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CatalogExercise = {
  id: string;
  user_id: string | null;
  slug: string | null;
  name: string;
  name_en: string | null;
  aliases: string[];
  description: string | null;
  cues: string[];
  mistakes: string[];
  category: string | null;
  muscle_group: string | null;
  muscles: string[];
  muscles_secondary: string[];
  equipment: string[];
  image_url: string | null;
  image_thumb_url: string | null;
  muscle_image_urls: string[];
  metric: ExerciseMetric;
  source: "curated" | "wger" | "user";
  source_id: string | null;
  license: string | null;
  license_author: string | null;
  license_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type Plan = {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  goal: string | null;
  is_template: boolean;
  is_public: boolean;
  is_active: boolean;
  source: "manual" | "template" | "ai";
  /* --- Opis szablonu: po tym kreator dobiera plan --- */
  days_per_week: number | null;
  level: "beginner" | "intermediate" | "advanced" | null;
  /** 'gym' — siłownia, 'minimal' — hantle i drążek, 'home' — nic. */
  equipment: "gym" | "minimal" | "home" | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type Phase = {
  id: string;
  plan_id: string;
  name: string;
  description: string | null;
  frequency: string | null;
  order_index: number;
  created_at: string;
};

export type WorkoutDay = {
  id: string;
  phase_id: string;
  name: string;
  short_label: string | null;
  description: string | null;
  day_type: DayType;
  tracks_pain: boolean;
  order_index: number;
  created_at: string;
};

export type WorkoutExercise = {
  id: string;
  workout_day_id: string;
  catalog_exercise_id: string | null;
  name_override: string | null;
  muscle_group: string | null;
  target_sets: number | null;
  target_reps: string | null;
  target_note: string | null;
  technique_notes: string | null;
  rest_seconds: number | null;
  order_index: number;
  created_at: string;
};

export type WorkoutSession = {
  id: string;
  user_id: string;
  workout_day_id: string | null;
  day_label: string | null;
  date: string;
  started_at: string;
  finished_at: string | null;
  duration_min: number | null;
  notes: string | null;
  created_at: string;
};

export type WorkoutLog = {
  id: string;
  user_id: string;
  session_id: string | null;
  workout_exercise_id: string | null;
  catalog_exercise_id: string | null;
  exercise_name: string;
  date: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_m: number | null;
  rpe: number | null;
  is_warmup: boolean;
  notes: string | null;
  created_at: string;
};

export type Habit = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  note: string | null;
  target_per_day: number;
  unit: string | null;
  /** ISO: 1 = poniedziałek … 7 = niedziela. Pusta tablica = codziennie. */
  days_of_week: number[];
  reminder_at: string | null;
  is_archived: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type HabitLog = {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  count: number;
  note: string | null;
  created_at: string;
};

export type WaterLog = {
  id: string;
  user_id: string;
  date: string;
  ml: number;
  created_at: string;
};

export type DailyWater = { user_id: string; date: string; ml: number; wpisy: number };

export type TodoList = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  order_index: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type Todo = {
  id: string;
  user_id: string;
  list_id: string | null;
  title: string;
  note: string | null;
  due_date: string | null;
  /** 0 = zwykłe, 1 = ważne, 2 = pilne. */
  priority: number;
  done_at: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type SleepFactor =
  | "alkohol" | "kofeina" | "ekran" | "pozny_posilek" | "trening_wieczor"
  | "stres" | "choroba" | "halas" | "upal" | "podroz" | "drzemka"
  | "melatonina" | "magnez" | "ciemno" | "chlodno";

export type SleepLog = {
  id: string;
  user_id: string;
  /** Data PORANKA, którego się obudziłeś — noc z 3 na 4 maja to 4 maja. */
  date: string;
  bedtime: string;
  wake_time: string;
  fell_asleep_min: number;
  awakenings: number;
  awake_min: number;
  /** Jak Ci się spało, 1–5. */
  quality: number;
  /** Jak się obudziłeś, 1–5. Osobno, bo to nie to samo co jakość snu. */
  morning_energy: number | null;
  factors: string[];
  note: string | null;
  /** Kolumna generowana: różnica pobudka − położenie się, liczona przez północ. */
  time_in_bed_min: number;
  created_at: string;
  updated_at: string;
};

/** Widok v_sleep — to samo plus realny sen po odjęciu zasypiania i pobudek. */
export type SleepView = {
  user_id: string;
  date: string;
  bedtime: string;
  wake_time: string;
  time_in_bed_min: number;
  sleep_min: number;
  fell_asleep_min: number;
  awakenings: number;
  awake_min: number;
  quality: number;
  morning_energy: number | null;
  /** Suma minut drzemek z tego dnia — liczona w widoku z tabeli sleep_naps. */
  nap_min: number;
  /** Ile drzemek. Trzy po 20 minut to nie to samo co jedna godzinna. */
  nap_count: number;
  /** Rozbicie na pojedyncze drzemki, w kolejności godzin. */
  naps: Array<{ minutes: number; start_time: string | null }>;
  factors: string[];
  note: string | null;
};

/** Propozycja trenera — czeka na tapnięcie, nic nie zmienia sama z siebie. */
export type CoachProposal = {
  id: string;
  user_id: string;
  kind: "diet_kcal" | "training" | "note";
  title: string;
  rationale: string;
  facts: Record<string, unknown>;
  /** Co się stanie po akceptacji, np. { daily_kcal: 2200 }. Puste = nic. */
  action: Record<string, unknown>;
  /** 'superseded' = zastąpiona nowszą analizą; zostaje w historii, nie znika. */
  status: "pending" | "accepted" | "rejected" | "superseded";
  decided_at: string | null;
  superseded_at: string | null;
  created_at: string;
};

export type CoachMessage = {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export type AiUsage = { user_id: string; date: string; calls: number };

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string | null;
  last_ok_at: string | null;
  failures: number;
  created_at: string;
};

/**
 * Własne danie ze składników. Szablon posiłku to ten sam byt — powstały
 * z zapisania posiłku, a nie z ręcznego układania składników.
 */
export type Recipe = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  note: string | null;
  /** Na ile porcji wychodzi cała ilość. */
  servings: number;
  created_at: string;
  updated_at: string;
};

export type RecipeItem = {
  id: string;
  user_id: string;
  recipe_id: string;
  food_id: string | null;
  name: string;
  grams: number;
  /** Kopiowane w chwili dodania — poprawka produktu nie zmienia historii. */
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  order_index: number;
  created_at: string;
};

/** Przepis policzony jako produkt — te same pola, co zwykłe jedzenie. */
export type RecipeTotals = {
  recipe_id: string;
  user_id: string;
  name: string;
  icon: string;
  servings: number;
  total_g: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  items: number;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
};

export type BookStatus = "want" | "reading" | "read" | "abandoned";

export type Vice = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  /** Moment rzucenia — punkt zero licznika, dopóki nie ma wpadki. */
  started_at: string;
  daily_cost: number | null;
  daily_minutes: number | null;
  motivation: string | null;
  is_archived: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

/** 'lapse' — wpadka (zeruje licznik), 'urge' — chęć, która minęła. */
export type ViceEventKind = "lapse" | "urge";

export type ViceEvent = {
  id: string;
  user_id: string;
  vice_id: string;
  kind: ViceEventKind;
  occurred_at: string;
  trigger: string | null;
  note: string | null;
  created_at: string;
};

export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  status: BookStatus;
  pages: number | null;
  current_page: number;
  rating: number | null;
  summary: string | null;
  started_at: string | null;
  finished_at: string | null;
  /** ISBN-13 — tylko dla książek dodanych skanem. */
  isbn: string | null;
  /** Adres okładki u Open Library; sam obrazek zostaje u nich. */
  cover_url: string | null;
  created_at: string;
  updated_at: string;
};

export type BookNote = {
  id: string;
  user_id: string;
  book_id: string;
  page: number | null;
  /** Cytat z książki — trzymany oddzielnie od własnego komentarza. */
  quote: string | null;
  note: string | null;
  created_at: string;
};

export type ReadingLog = {
  id: string;
  user_id: string;
  book_id: string | null;
  date: string;
  minutes: number | null;
  pages_read: number;
  created_at: string;
};

export type SubscriptionStatus =
  | "none" | "trialing" | "active" | "past_due" | "canceled" | "incomplete";

/**
 * Lokalna kopia stanu ze Stripe'a — źródłem prawdy jest Stripe, a ten wiersz
 * wypełnia wyłącznie webhook kluczem serwisowym. Użytkownik ma tu tylko odczyt.
 */
export type Subscription = {
  user_id: string;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
};

export type AppSetting = {
  key: string;
  value: unknown;
  updated_at: string;
};

export type InjuryStatus = "active" | "monitoring" | "healed";
export type InjurySide = "left" | "right" | "both" | "none";

export type Injury = {
  id: string;
  user_id: string;
  name: string;
  body_part: string;
  side: InjurySide;
  status: InjuryStatus;
  started_at: string | null;
  healed_at: string | null;
  note: string | null;
  track_pain: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
};

export type PainLog = {
  id: string;
  user_id: string;
  injury_id: string;
  session_id: string | null;
  date: string;
  level: number;
  note: string | null;
  created_at: string;
};

export type BodyWeightLog = {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  note: string | null;
  created_at: string;
};

export type Food = {
  id: string;
  user_id: string | null;
  source: "off" | "custom" | "curated";
  off_id: string | null;
  /** Produkt z opakowania czy gotowe danie z talerza. */
  kind: "product" | "dish";
  name: string;
  brand: string | null;
  image_url: string | null;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  fiber_100g: number | null;
  sugar_100g: number | null;
  salt_100g: number | null;
  serving_size_g: number | null;
  serving_label: string | null;
  created_at: string;
  updated_at: string;
};

export type Meal = {
  id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  note: string | null;
  created_at: string;
};

export type MealEntry = {
  id: string;
  user_id: string;
  meal_id: string;
  food_id: string | null;
  food_name: string;
  grams: number;
  kcal_100g: number;
  protein_100g: number;
  carbs_100g: number;
  fat_100g: number;
  created_at: string;
  /** kolumny wyliczane w bazie — tylko do odczytu */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Activity = {
  id: string;
  user_id: string;
  type: ActivityType;
  custom_type: string | null;
  date: string;
  started_at: string | null;
  duration_min: number | null;
  distance_km: number | null;
  kcal: number | null;
  avg_hr: number | null;
  notes: string | null;
  source: "manual" | "strava";
  external_id: string | null;
  raw: unknown | null;
  created_at: string;
  updated_at: string;
};

export type AiPlanRequest = {
  id: string;
  user_id: string;
  input: unknown;
  output: unknown | null;
  plan_id: string | null;
  model: string | null;
  status: "pending" | "ok" | "error";
  error: string | null;
  created_at: string;
};

export type DailyNutrition = {
  user_id: string;
  date: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  entries: number;
};

export type DailyVolume = {
  user_id: string;
  date: string;
  sets: number;
  reps: number;
  volume_kg: number;
  exercises: number;
};

export type ExercisePr = {
  user_id: string;
  exercise_key: string;
  catalog_exercise_id: string | null;
  exercise_name: string;
  best_weight_kg: number | null;
  best_e1rm_kg: number | null;
  last_done: string;
  total_sets: number;
};

export type PeriodSummary = {
  from: string;
  to: string;
  days_in_period: number;
  workouts: number;
  sets: number;
  volume_kg: number;
  avg_kcal: number;
  days_logged_food: number;
  activities: number;
  activity_minutes: number;
  avg_pain: number | null;
  pain_by_injury: {
    id: string;
    name: string;
    body_part: string;
    avg_level: number;
    max_level: number;
    entries: number;
  }[];
  avg_water_ml: number | null;
  days_water_logged: number;
  avg_protein_g: number | null;
  habit_days_done: number;
  /** Ile odhaczeń w ogóle wypadało w okresie — mianownik filaru nawyków. */
  habit_days_due: number;
  nights_logged: number;
  avg_sleep_min: number | null;
  avg_sleep_quality: number | null;
  /** Średnia pora zaśnięcia jako minuty od 18:00. */
  avg_bedtime_min: number | null;
  weight_start: number | null;
  weight_end: number | null;
};

export type LastExerciseSet = {
  date: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  rpe: number | null;
  duration_seconds: number | null;
};

/* ------------------------------- Wygląd ----------------------------------- */

export type Ujecie = "front" | "profil" | "sylwetka";
export type PoraDnia = "rano" | "wieczor" | "dowolnie";
export type ZrodloRutyny = "ai" | "wlasna" | "biblioteka";

export type WygladZgoda = {
  user_id: string;
  wiek_potwierdzony: boolean;
  zaakceptowano_at: string;
};

export type WygladSkan = {
  id: string;
  user_id: string;
  utworzono: string;
  ocena_ogolna: number | null;
  /** Podoceny wyjęte z raportu, żeby wykres nie musiał go rozpakowywać. */
  oceny: Record<string, number> | null;
  raport: unknown;
  /** false = model uznał zdjęcie za niewystarczające; taki punkt nie ciągnie wykresu. */
  jakosc_ok: boolean | null;
  model: string | null;
  wersja_promptu: number;
};

export type WygladZdjecie = {
  id: string;
  user_id: string;
  skan_id: string;
  ujecie: Ujecie;
  storage_path: string;
  utworzono: string;
};

export type WygladPomiar = {
  id: string;
  user_id: string;
  data: string;
  talia: number | null;
  klatka: number | null;
  ramie: number | null;
  szyja: number | null;
  biodra: number | null;
  bf_szac: number | null;
};

export type WygladRutyna = {
  id: string;
  user_id: string;
  klucz: string;
  nazwa: string;
  pora: PoraDnia;
  kroki: string[];
  aktywna: boolean;
  zrodlo: ZrodloRutyny;
  created_at: string;
  updated_at: string;
};

export type WygladRutynaLog = {
  id: string;
  user_id: string;
  rutyna_id: string;
  data: string;
  wykonano: boolean;
};

export type WygladProtokol = {
  id: string;
  user_id: string;
  klucz: string;
  aktywny: boolean;
  rozpoczeto: string;
};

export type WygladProdukt = {
  id: string;
  user_id: string;
  nazwa: string;
  skladniki_aktywne: string[];
  pora: PoraDnia;
  otwarty_od: string | null;
  wazny_do: string | null;
  created_at: string;
};

/** Stan limitów skanowania — zwracany przez `wyglad_limit()`. */
export type WygladLimit = {
  odstep_dni: number;
  limit_miesiaca: number;
  w_miesiacu: number;
  ostatni_skan: string | null;
  nastepny_od: string;
  mozna: boolean;
  /** Administrator nie podlega limitom — liczniki nadal są prawdziwe. */
  bez_limitu?: boolean;
  powod: "limit_miesiaca" | "odstep" | null;
};

/**
 * Stan miesięcznego budżetu na AI — zwracany przez `ai_budzet_stan()`.
 *
 * Rejestr kosztów (`ai_wydatki`) świadomie NIE ma tu odpowiednika: tabela nie
 * daje użytkownikowi żadnych uprawnień, więc typ opisujący zapytanie o nią
 * opisywałby zapytanie, które zawsze kończy się odmową.
 */
export type AiBudzetStan = {
  limit_pln: number;
  limit_usd: number;
  kurs: number;
  wydano_usd: number;
  wydano_pln: number;
  zostalo_pln: number;
  /** Ile wywołań weszło do puli w tym miesiącu. */
  wywolan: number;
  /** Konto administratora — próg nie obowiązuje, liczniki nadal prawdziwe. */
  bez_limitu: boolean;
  /** Kiedy budżet się odnowi (początek następnego miesiąca, czas polski). */
  odnowa: string;
};

/** Odpowiedź `ai_koszt_rezerwuj()`. Przy `ok: false` nic nie zostało zapisane. */
export type AiRezerwacja =
  | { ok: true; id: string; szacunek_usd: number; stan: AiBudzetStan }
  | { ok: false; powod: "limit_miesiaca" | "brak_logowania"; stan?: AiBudzetStan };

export type SleepNap = {
  id: string;
  user_id: string;
  date: string;
  /** Godzina rozpoczęcia, „HH:MM:SS". Null, gdy nieznana. */
  start_time: string | null;
  minutes: number;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: Tbl<Profile, "id">;
      exercise_catalog: Tbl<CatalogExercise, "name">;
      plans: Tbl<Plan, "name">;
      phases: Tbl<Phase, "plan_id" | "name">;
      workout_days: Tbl<WorkoutDay, "phase_id" | "name">;
      workout_exercises: Tbl<WorkoutExercise, "workout_day_id">;
      workout_sessions: Tbl<WorkoutSession, "user_id">;
      workout_logs: Tbl<WorkoutLog, "user_id" | "exercise_name" | "set_number">;
      injuries: Tbl<Injury, "user_id" | "name">;
      pain_logs: Tbl<PainLog, "user_id" | "injury_id" | "level">;
      habits: Tbl<Habit, "user_id" | "name">;
      habit_logs: Tbl<HabitLog, "user_id" | "habit_id">;
      water_logs: Tbl<WaterLog, "user_id" | "ml">;
      todo_lists: Tbl<TodoList, "user_id" | "name">;
      todos: Tbl<Todo, "user_id" | "title">;
      subscriptions: Tbl<Subscription, "user_id">;
      coach_proposals: Tbl<CoachProposal, "user_id" | "kind" | "title" | "rationale">;
      coach_messages: Tbl<CoachMessage, "user_id" | "role" | "content">;
      ai_usage: Tbl<AiUsage, "user_id">;
      push_subscriptions: Tbl<PushSubscription, "user_id" | "endpoint" | "p256dh" | "auth">;
      app_settings: Tbl<AppSetting, "key" | "value">;
      recipes: Tbl<Recipe, "user_id" | "name">;
      recipe_items: Tbl<
        RecipeItem,
        "user_id" | "recipe_id" | "name" | "grams" | "kcal_100g"
      >;
      vices: Tbl<Vice, "user_id" | "name">;
      vice_events: Tbl<ViceEvent, "user_id" | "vice_id" | "kind">;
      books: Tbl<Book, "user_id" | "title">;
      book_notes: Tbl<BookNote, "user_id" | "book_id">;
      reading_logs: Tbl<ReadingLog, "user_id">;
      sleep_logs: Tbl<
        Omit<SleepLog, "time_in_bed_min">,
        "user_id" | "bedtime" | "wake_time" | "quality"
      > & { Row: SleepLog };
      sleep_naps: Tbl<SleepNap, "user_id" | "minutes">;
      body_weight_logs: Tbl<BodyWeightLog, "user_id" | "weight_kg">;
      foods: Tbl<Food, "name" | "kcal_100g">;
      meals: Tbl<Meal, "user_id" | "meal_type">;
      meal_entries: Tbl<
        Omit<MealEntry, "kcal" | "protein" | "carbs" | "fat">,
        "user_id" | "meal_id" | "food_name" | "grams" | "kcal_100g"
      > & { Row: MealEntry };
      activities: Tbl<Activity, "user_id" | "type">;
      ai_plan_requests: Tbl<AiPlanRequest, "user_id" | "input">;
      wyglad_zgoda: Tbl<WygladZgoda, "user_id">;
      wyglad_skany: Tbl<WygladSkan, "user_id">;
      wyglad_zdjecia: Tbl<WygladZdjecie, "user_id" | "skan_id" | "ujecie" | "storage_path">;
      wyglad_pomiary: Tbl<WygladPomiar, "user_id">;
      wyglad_rutyny: Tbl<WygladRutyna, "user_id" | "klucz" | "nazwa" | "pora">;
      wyglad_rutyna_log: Tbl<WygladRutynaLog, "user_id" | "rutyna_id">;
      wyglad_protokoly: Tbl<WygladProtokol, "user_id" | "klucz">;
      wyglad_produkty: Tbl<WygladProdukt, "user_id" | "nazwa">;
    };
    Views: {
      v_daily_nutrition: { Row: DailyNutrition; Relationships: [] };
      v_daily_volume: { Row: DailyVolume; Relationships: [] };
      v_exercise_prs: { Row: ExercisePr; Relationships: [] };
      v_daily_water: { Row: DailyWater; Relationships: [] };
      v_sleep: { Row: SleepView; Relationships: [] };
      v_recipe_totals: { Row: RecipeTotals; Relationships: [] };
    };
    Functions: {
      clone_plan: {
        Args: { p_source_plan_id: string; p_new_name?: string | null; p_activate?: boolean };
        Returns: string;
      };
      set_active_plan: { Args: { p_plan_id: string }; Returns: undefined };
      last_exercise_sets: {
        Args: {
          p_catalog_exercise_id: string | null;
          p_exercise_name?: string | null;
          p_before_date?: string;
        };
        Returns: LastExerciseSet[];
      };
      period_summary: { Args: { p_from: string; p_to: string }; Returns: PeriodSummary };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      has_pro: { Args: { p_user?: string }; Returns: boolean };
      /** Podbija dzienny licznik wywołań modelu; false = limit wyczerpany. */
      consume_ai_call: { Args: { p_limit: number }; Returns: boolean };
      /** Czy wolno zrobić kolejny skan i kiedy najwcześniej następny. */
      wyglad_limit: { Args: Record<string, never>; Returns: WygladLimit };
      /** Ile z miesięcznego budżetu na AI zostało. */
      ai_budzet_stan: { Args: Record<string, never>; Returns: AiBudzetStan };
      /** Rezerwacja przed wywołaniem modelu. Odmowa nic nie zapisuje. */
      ai_koszt_rezerwuj: { Args: { p_kategoria: string }; Returns: AiRezerwacja };
      /** Wpisanie prawdziwego kosztu po wywołaniu. Kwota 0 zwalnia rezerwację. */
      ai_koszt_rozlicz: {
        Args: {
          p_id: string;
          p_model: string;
          /** Null = nie wiadomo; zostaje pesymistyczna rezerwacja. */
          p_koszt_usd: number | null;
          p_tokeny: Record<string, unknown>;
        };
        Returns: boolean;
      };
      /** Tabele w public bez RLS. Pusta tablica to jedyny poprawny wynik. */
      tables_without_rls: { Args: Record<string, never>; Returns: string[] };
      /** Trwałe usunięcie własnego konta. Działa tylko na koncie wywołującego. */
      delete_my_account: { Args: Record<string, never>; Returns: undefined };
      /* Wysyłka powiadomień — chronione sekretem, wołane tylko przez cron. */
      push_due: { Args: { p_secret: string }; Returns: unknown };
      push_ok: { Args: { p_secret: string; p_endpoint: string }; Returns: undefined };
      push_failed: {
        Args: { p_secret: string; p_endpoint: string; p_gone: boolean };
        Returns: undefined;
      };
      /** Wersje mnogie — cała paczka jednym zapytaniem zamiast jednego na sztukę. */
      push_ok_many: { Args: { p_secret: string; p_endpoints: string[] }; Returns: number };
      push_failed_many: {
        Args: { p_secret: string; p_endpoints: string[]; p_gone: boolean };
        Returns: number;
      };
      /** Dopisanie produktu z OFF do wspólnego cache'u. Istniejącego nie zmienia. */
      cache_off_product: {
        Args: {
          p_off_id: string;
          p_name: string;
          p_brand?: string | null;
          p_image_url?: string | null;
          p_kcal_100g?: number | null;
          p_protein_100g?: number | null;
          p_carbs_100g?: number | null;
          p_fat_100g?: number | null;
          p_fiber_100g?: number | null;
          p_sugar_100g?: number | null;
          p_salt_100g?: number | null;
          p_serving_size_g?: number | null;
          p_serving_label?: string | null;
        };
        Returns: Food;
      };
      /** Zapis wygenerowanego planu w całości albo wcale. Zwraca id planu. */
      save_ai_plan: { Args: { p_request_id: string }; Returns: string };
      /** Odkłada oczekujące propozycje trenera do historii. Zwraca ile. */
      supersede_coach_proposals: { Args: Record<string, never>; Returns: number };
      /** Polityki, które nadal przeliczają auth.uid() dla każdego wiersza. */
      policies_rechecking_uid: { Args: Record<string, never>; Returns: string[] };
      /** Wąska furtka dla webhooka Stripe'a — chroniona osobnym sekretem. */
      apply_subscription: {
        Args: {
          p_secret: string;
          p_user_id: string;
          p_status: string;
          p_customer_id: string | null;
          p_subscription_id: string | null;
          p_price_id: string | null;
          p_period_end: string | null;
          p_cancel_at_period_end: boolean;
          p_trial_end: string | null;
          p_event_id?: string | null;
          p_event_at?: string | null;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
