/**
 * Zamienia plan_treningowy.json na migrację SQL.
 *
 *   node scripts/generate-plan-migration.mjs <plik.json> <plik-wyjsciowy.sql>
 *
 * Treść planu przepisujemy dosłownie - nazwy, kolejność, serie, powtórzenia i
 * opisy techniki trafiają do bazy bez zmian. Tożsamością ćwiczenia jest
 * `icon_key`; warianty tej samej pozycji (np. "(z impetem)") wskazują na tę samą
 * pozycję katalogu, a różnica w nazwie ląduje w `name_override` slotu planu.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Użycie: node scripts/generate-plan-migration.mjs <plan.json> <migracja.sql>");
  process.exit(1);
}

const plan = JSON.parse(readFileSync(inputPath, "utf8"));

/* ------------------------------------------------------------------ */
/* Metryka logowania - decyduje, jakie pola pokazuje formularz serii.   */
/* ------------------------------------------------------------------ */
const TIME = new Set([
  "plank", "side_plank", "dead_hang", "deep_squat_hold", "shadowbox", "jump_rope",
  "heavy_bag", "sprint", "hip_90_90", "bike_rower",
  "quad_stand", "quad_kneel", "quad_lying",
  "ham_seated", "ham_strap", "forward_fold",
  "figure_four", "pigeon", "knee_to_chest",
]);
const REPS = new Set([
  "dead_bug", "box_jump", "lateral_bound", "band_punch",
  "hip_circles", "thoracic_rotation", "shoulder_cars",
]);
const DISTANCE = new Set(["farmers_walk"]);

/**
 * Wyjątki po nazwie - w źródłowym pliku jeden icon_key bywa przypisany do
 * dwóch różnych ćwiczeń, więc sama ikona nie wystarcza do wyboru metryki.
 */
const METRIC_BY_NAME = {
  "Rower stacjonarny / ergometr wioślarski": "time",
};

function metricFor(iconKey, name) {
  if (METRIC_BY_NAME[name]) return METRIC_BY_NAME[name];
  if (TIME.has(iconKey)) return "time";
  if (REPS.has(iconKey)) return "reps";
  if (DISTANCE.has(iconKey)) return "distance";
  return "weight_reps";
}

/** Jak dobrze nazwa pasuje do klucza ikony - rozstrzyga, kto dostaje bazowy slug. */
function iconAffinity(iconKey, name) {
  const words = new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter(Boolean),
  );
  return iconKey.split("_").filter((part) => words.has(part)).length;
}

/* ------------------------------------------------------------------ */
/* Pomocnicze                                                          */
/* ------------------------------------------------------------------ */
const q = (v) =>
  v === null || v === undefined || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`;

/** "Dzień B (opcjonalnie)" → "Dzień B" - do rozpoznania wariantów tej samej pozycji. */
const baseName = (name) => name.replace(/\s*\([^)]*\)\s*$/, "").trim();

/** "4x6-8" → { sets: 4, reps: "6-8" }; "2 rundy/nogę" → { sets: null, note }. */
function parseSetsReps(raw) {
  if (!raw) return { sets: null, reps: null, note: null };
  const m = /^(\d+)\s*[xX×]\s*(.+)$/.exec(raw.trim());
  if (m) return { sets: Number(m[1]), reps: m[2].trim(), note: null };
  return { sets: null, reps: null, note: raw.trim() };
}

const DAY_TYPE = {
  strength: "gym",
  power_mobility: "mobility",
  conditioning: "conditioning",
  mma_specific: "mma",
};

/** Dni obciążające nogi - po nich apka pyta o ból kontuzji. */
const TRACKS_PAIN = new Set(["faza1_dzien_a", "faza1_dzien_b", "faza2_dol"]);

/* ------------------------------------------------------------------ */
/* 1. Zbieramy wszystkie pozycje planu                                 */
/* ------------------------------------------------------------------ */
const days = [];

for (const phase of plan.phases) {
  for (const day of phase.workout_days) {
    days.push({
      phaseKey: phase.key,
      phaseName: phase.name,
      phaseGoal: phase.goal,
      phaseFrequency: phase.frequency,
      key: day.key,
      name: day.name,
      note: day.note ?? null,
      dayType: DAY_TYPE[day.type] ?? "other",
      tracksPain: TRACKS_PAIN.has(day.key),
      exercises: day.exercises,
    });
  }
}

// Rozciąganie od fizjoterapeuty - osobny dzień, na czas, bez ciężaru.
const rehabGroups = [
  ["czworogłowy", "czworogłowy uda"],
  ["dwugłowy", "dwugłowy uda"],
  ["pośladki", "pośladki"],
];
const rehabExercises = [];
let rehabOrder = 0;
for (const [key, muscle] of rehabGroups) {
  for (const e of plan.rehab_stretches[key] ?? []) {
    rehabExercises.push({ ...e, order: ++rehabOrder, muscle_group: muscle });
  }
}
days.push({
  phaseKey: plan.phases[0].key,
  phaseName: plan.phases[0].name,
  phaseGoal: plan.phases[0].goal,
  phaseFrequency: plan.phases[0].frequency,
  key: "rehab_stretches",
  name: "Rozciąganie rehabilitacyjne (zalecenia fizjo)",
  note: plan.rehab_stretches.note,
  dayType: "mobility",
  tracksPain: false,
  exercises: rehabExercises,
});

/* ------------------------------------------------------------------ */
/* 2. Katalog: jedna pozycja na realne ćwiczenie                       */
/*    icon_key bywa współdzielony przez dwa różne ćwiczenia            */
/*    (farmers_walk), więc rozróżniamy dodatkowo po nazwie bazowej.    */
/* ------------------------------------------------------------------ */
const catalog = new Map(); // klucz: `${icon_key}::${baseName}`

for (const day of days) {
  for (const e of day.exercises) {
    const base = baseName(e.name);
    const key = `${e.icon_key}::${base}`;
    if (!catalog.has(key)) {
      catalog.set(key, {
        iconKey: e.icon_key,
        name: base,
        allNames: new Set([e.name]),
        muscleGroup: e.muscle_group ?? null,
        technique: e.technique ?? null,
        metric: metricFor(e.icon_key, base),
      });
    } else {
      catalog.get(key).allNames.add(e.name);
    }
  }
}

// Slug: icon_key, a przy kolizji dwóch różnych ćwiczeń - z przyrostkiem.
const byIcon = new Map();
for (const item of catalog.values()) {
  const list = byIcon.get(item.iconKey) ?? [];
  list.push(item);
  byIcon.set(item.iconKey, list);
}
for (const [icon, list] of byIcon) {
  // Bazowy slug dostaje ta pozycja, której nazwa najlepiej odpowiada ikonie.
  list.sort((a, b) => iconAffinity(icon, b.name) - iconAffinity(icon, a.name));
  list.forEach((item, i) => {
    item.slug = i === 0 ? icon : `${icon}_${i + 1}`;
  });
}

/* ------------------------------------------------------------------ */
/* 3. SQL                                                             */
/* ------------------------------------------------------------------ */
const meta = plan.meta;
const sampleWeeks = Object.entries(plan.sample_weeks ?? {})
  .map(([label, rows]) => {
    const dni = rows.map((r) => `${r.dzien}: ${r.trening}`).join(" · ");
    return `Przykładowy tydzień (${label.replace("_", " ")}): ${dni}`;
  })
  .join("\n");

const description = [
  meta.golden_rule,
  "",
  "Założenia:",
  ...meta.assumptions.map((a) => `• ${a}`),
  "",
  sampleWeeks,
  "",
  plan.progress_tracking?.notes ?? "",
]
  .join("\n")
  .trim();

const out = [];
const w = (line = "") => out.push(line);

w("-- ============================================================");
w("-- Grind - Migracja 0007: plan treningowy właściciela aplikacji");
w("--");
w("-- Wygenerowane z plan_treningowy.json przez");
w("-- scripts/generate-plan-migration.mjs - nie edytuj ręcznie,");
w("-- popraw źródłowy JSON i wygeneruj ponownie.");
w("--");
w(`-- Zawartość: ${days.length} dni, ${days.reduce((s, d) => s + d.exercises.length, 0)} pozycji,`);
w(`-- ${catalog.size} ćwiczeń w katalogu.`);
w("-- ============================================================");
w();
w("-- icon_key: klucz ilustracji podany w planie, przechowywany przy ćwiczeniu.");
w("alter table public.exercise_catalog add column if not exists icon_key text;");
w("create index if not exists exercise_catalog_icon_key_idx");
w("  on public.exercise_catalog (icon_key) where icon_key is not null;");
w();
w("do $$");
w("declare");
w("  v_plan       uuid;");
w("  v_phase      uuid;");
w("  v_day        uuid;");
w("  v_cat        uuid;");
w("  v_owner      uuid;");
w("  v_copy       uuid;");
w("  v_slug       text;");
w("begin");
w();
w("-- ---------------------------------------------------------------");
w("-- Katalog ćwiczeń: dokładamy tylko to, czego jeszcze nie ma.");
w("-- Istniejące pozycje dostają icon_key, ale nie nadpisujemy ich opisów.");
w("-- ---------------------------------------------------------------");

for (const item of catalog.values()) {
  // Szukamy po każdej nazwie użytej w planie ORAZ po nazwie bazowej - katalog
  // trzyma "Martwy ciąg sztangą", a plan pisze "Martwy ciąg sztangą (opcjonalnie)".
  const names = [...new Set([item.name, ...item.allNames])];
  w();
  w(`  -- ${item.name}`);
  // Szukamy po nazwie, a gdy to nie trafia - po slugu. Katalog bywa opisany
  // szerzej niż plan ("Plank (deska)" kontra "Plank"), więc sama nazwa nie wystarcza.
  w("  select id into v_cat from public.exercise_catalog");
  w(`   where user_id is null and (name in (${names.map(q).join(", ")}) or slug = ${q(item.slug)})`);
  w(`   order by (name in (${names.map(q).join(", ")})) desc limit 1;`);
  w("  if v_cat is null then");
  w(`    v_slug := ${q(item.slug)};`);
  w("    while exists (select 1 from public.exercise_catalog");
  w("                   where user_id is null and slug = v_slug) loop");
  w(`      v_slug := v_slug || '_2';`);
  w("    end loop;");
  w("    insert into public.exercise_catalog");
  w("      (slug, name, description, muscle_group, metric, source, icon_key, is_public)");
  w(
    `    values (v_slug, ${q(item.name)}, ${q(item.technique)}, ${q(item.muscleGroup)}, ${q(
      item.metric,
    )}, 'curated', ${q(item.iconKey)}, true);`,
  );
  w("  else");
  w(`    update public.exercise_catalog set icon_key = ${q(item.iconKey)}`);
  w("     where id = v_cat and icon_key is distinct from " + q(item.iconKey) + ";");
  w("  end if;");
}

w();
w("-- ---------------------------------------------------------------");
w("-- Plan jako publiczny szablon - kopiowalny przez każdego.");
w("-- ---------------------------------------------------------------");
w(`  select id into v_plan from public.plans`);
w(`   where user_id is null and is_template and name = ${q(meta.title)} limit 1;`);
w();
w("  if v_plan is not null then");
w("    -- Migracja już przeszła: nic nie duplikujemy.");
w("    delete from public.phases where plan_id = v_plan;");
w("  else");
w("    insert into public.plans (user_id, name, description, goal, is_template, is_public, source)");
w(
  `    values (null, ${q(meta.title)}, ${q(description)}, ${q(
    "Powrót po kontuzji kolana + przygotowanie pod MMA",
  )}, true, true, 'template')`,
);
w("    returning id into v_plan;");
w("  end if;");

const phases = [];
for (const day of days) {
  if (!phases.some((p) => p.key === day.phaseKey)) {
    phases.push({ key: day.phaseKey, name: day.phaseName, goal: day.phaseGoal, frequency: day.phaseFrequency });
  }
}

phases.forEach((phase, phaseIndex) => {
  w();
  w(`  -- === ${phase.name} ===`);
  w("  insert into public.phases (plan_id, name, description, frequency, order_index)");
  w(`  values (v_plan, ${q(phase.name)}, ${q(phase.goal)}, ${q(phase.frequency)}, ${phaseIndex})`);
  w("  returning id into v_phase;");

  const phaseDays = days.filter((d) => d.phaseKey === phase.key);
  phaseDays.forEach((day, dayIndex) => {
    w();
    w(`  -- --- ${day.name} (${day.exercises.length} pozycji) ---`);
    w("  insert into public.workout_days");
    w("    (phase_id, name, short_label, description, day_type, tracks_pain, order_index)");
    w(
      `  values (v_phase, ${q(day.name)}, ${q(shortLabel(day))}, ${q(day.note)}, ${q(
        day.dayType,
      )}, ${day.tracksPain}, ${dayIndex})`,
    );
    w("  returning id into v_day;");

    for (const e of day.exercises) {
      const base = baseName(e.name);
      const item = catalog.get(`${e.icon_key}::${base}`);
      const { sets, reps, note } = parseSetsReps(e.target_sets_reps);
      // Nazwę z planu zapisujemy zawsze, nie tylko przy wariantach. Pozycja
      // katalogu może nazywać się inaczej ("Plank (deska)" kontra "Plank"),
      // a w planie ma być dokładnie to, co napisał autor.
      const override = e.name;

      w();
      w(`  select id into v_cat from public.exercise_catalog`);
      w(
        `   where user_id is null and (icon_key = ${q(item.iconKey)} or name = ${q(
          item.name,
        )} or slug = ${q(item.slug)})`,
      );
      w(`   order by (name = ${q(item.name)}) desc, (icon_key = ${q(item.iconKey)}) desc limit 1;`);
      w("  insert into public.workout_exercises");
      w("    (workout_day_id, catalog_exercise_id, name_override, muscle_group,");
      w("     target_sets, target_reps, target_note, technique_notes, order_index)");
      w(
        `  values (v_day, v_cat, ${q(override)}, ${q(e.muscle_group)}, ${
          sets ?? "null"
        }, ${q(reps)}, ${q(note)}, ${q(e.technique)}, ${e.order});`,
      );
    }
  });
});

w();
w("-- ---------------------------------------------------------------");
w("-- Szablon odtworzony wcześniej ze specyfikacji przestaje być publiczny -");
w("-- zastępuje go plan z tego pliku. Nie kasujemy go, żeby nie zabrać planu");
w("-- nikomu, kto zdążył go skopiować.");
w("-- ---------------------------------------------------------------");
w("  update public.plans set is_public = false");
w("   where user_id is null and is_template");
w("     and name = 'Powrót po kontuzji kolana + MMA'");
w("     and id <> v_plan;");
w();
w("-- ---------------------------------------------------------------");
w("-- Kopia na koncie właściciela, jeśli takie konto istnieje.");
w("-- Dzięki temu plan jest od razu aktywny, a szablon zostaje dla innych.");
w("-- ---------------------------------------------------------------");
w("  select id into v_owner from auth.users where email = 'zdzis.paschalski@gmail.com' limit 1;");
w();
w("  if v_owner is not null then");
w(`    select id into v_copy from public.plans`);
w(`     where user_id = v_owner and name = ${q(meta.title)} limit 1;`);
w();
w("    if v_copy is null then");
w("      insert into public.plans (user_id, name, description, goal, source, is_active)");
w(
  `      select v_owner, ${q(meta.title)}, description, goal, 'template', true`,
);
w("        from public.plans where id = v_plan");
w("      returning id into v_copy;");
w();
w("      update public.plans set is_active = false");
w("       where user_id = v_owner and id <> v_copy;");
w();
w("      insert into public.phases (plan_id, name, description, frequency, order_index)");
w("      select v_copy, name, description, frequency, order_index");
w("        from public.phases where plan_id = v_plan;");
w();
w("      insert into public.workout_days");
w("        (phase_id, name, short_label, description, day_type, tracks_pain, order_index)");
w("      select np.id, d.name, d.short_label, d.description, d.day_type, d.tracks_pain, d.order_index");
w("        from public.workout_days d");
w("        join public.phases op on op.id = d.phase_id and op.plan_id = v_plan");
w("        join public.phases np on np.plan_id = v_copy and np.order_index = op.order_index;");
w();
w("      insert into public.workout_exercises");
w("        (workout_day_id, catalog_exercise_id, name_override, muscle_group,");
w("         target_sets, target_reps, target_note, technique_notes, rest_seconds, order_index)");
w("      select nd.id, we.catalog_exercise_id, we.name_override, we.muscle_group,");
w("             we.target_sets, we.target_reps, we.target_note, we.technique_notes,");
w("             we.rest_seconds, we.order_index");
w("        from public.workout_exercises we");
w("        join public.workout_days od on od.id = we.workout_day_id");
w("        join public.phases op on op.id = od.phase_id and op.plan_id = v_plan");
w("        join public.phases np on np.plan_id = v_copy and np.order_index = op.order_index");
w("        join public.workout_days nd on nd.phase_id = np.id and nd.order_index = od.order_index;");
w("    end if;");
w("  end if;");
w("end;");
w("$$;");
w();

function shortLabel(day) {
  const m = /Dzień\s+([A-Z])/.exec(day.name);
  if (m) return m[1];
  if (day.key === "faza1_kondycja") return "Kond.";
  if (day.key === "faza2_dol") return "Dół";
  if (day.key === "faza2_mma") return "MMA";
  if (day.key === "rehab_stretches") return "Rehab";
  return null;
}

writeFileSync(outputPath, out.join("\n"), "utf8");

console.log(`Zapisano ${outputPath}`);
console.log(`  faz:      ${phases.length}`);
console.log(`  dni:      ${days.length}`);
console.log(`  pozycji:  ${days.reduce((s, d) => s + d.exercises.length, 0)}`);
console.log(`  katalog:  ${catalog.size} ćwiczeń`);
for (const [icon, list] of byIcon) {
  if (list.length > 1) {
    console.log(`  uwaga: icon_key "${icon}" wskazuje na ${list.length} różne ćwiczenia - rozdzielone:`);
    list.forEach((i) => console.log(`         ${i.slug} → ${i.name}`));
  }
}
