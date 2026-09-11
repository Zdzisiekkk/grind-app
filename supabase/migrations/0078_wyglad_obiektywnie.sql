-- ============================================================
-- Grind — Migracja 0078: ocena wyglądu, która reaguje na zmianę
--
-- Punkt wyjścia: użytkownik zgłosił, że wyraźne zmiany w wyglądzie nie ruszają
-- oceny. Przegląd jego skanów pokazał, że to nie było złudzenie - ocena
-- miała cztery wady konstrukcyjne:
--
--   1. Model nie widział poprzednich zdjęć. Dostawał same LICZBY z poprzedniego
--      skanu, więc nie mógł zobaczyć zmiany - mógł jedynie ocenić od nowa
--      i zakotwiczyć się na starej liczbie. Stąd "przyklejona" ocena.
--   2. Obszary bez zdjęcia dostawały ocenę. Zęby oceniane bez zdjęcia
--      uśmiechu, postawa i skład ciała bez zdjęcia sylwetki. Gdy później
--      pojawiało się prawdziwe zdjęcie, zmyślona liczba zamieniała się na
--      prawdziwą i wyglądało to jak pogorszenie (skład ciała 75 → 60).
--   3. Ocena ogólna była liczbą wybraną przez model, a nie średnią. Włączała
--      symetrię, której nie da się zmienić, i inny zestaw obszarów w każdym
--      skanie - więc dwie oceny ogólne nie były porównywalne.
--   4. Nieudana analiza (wiersz skanu bez oceny) zjadała pulę skanów
--      i blokowała odstęp 7 dni, choć użytkownik nic nie dostał.
--
-- Punkty 1 i 3 naprawia kod (trasa /api/ai/wyglad i normalizacja w
-- wygladSchema.ts): model dostaje zdjęcia poprzedniego skanu obok obecnych,
-- porównuje je obszar po obszarze, a ocenę ogólną liczy aplikacja.
-- Ta migracja robi resztę: porządkuje historię według tych samych reguł
-- i poprawia liczenie limitów.
-- ============================================================

-- ------------------------------------------------------------
-- Nowe kolumny
-- ------------------------------------------------------------
alter table public.wyglad_skany
  add column if not exists skan_odniesienia uuid
    references public.wyglad_skany (id) on delete set null,
  add column if not exists ocena_ogolna_model smallint
    check (ocena_ogolna_model is null or ocena_ogolna_model between 0 and 100);

comment on column public.wyglad_skany.skan_odniesienia is
  'Skan, którego zdjęcia model widział obok obecnych przy porównaniu (0078). '
  'NULL = pierwszy skan albo nie było z czym porównać.';
comment on column public.wyglad_skany.ocena_ogolna_model is
  'Ocena ogólna wybrana przez model w wersji 1, zachowana przy przeliczeniu '
  'historii w 0078. Od wersji 2 ocenę ogólną liczy aplikacja.';
comment on column public.wyglad_skany.ocena_ogolna is
  'Od 0078: średnia ocen obszarów bez symetrii, liczona przez aplikację '
  '(ocenaOgolna w src/lib/ai/wygladSchema.ts).';

-- ------------------------------------------------------------
-- Przeliczenie historii
--
-- Te same reguły co w kodzie, żeby wykres nie skakał na granicy wersji:
--   * zeby wymaga zdjęcia "zeby", postawa i sklad_ciala - zdjęcia "sylwetka",
--     reszta obszarów - zdjęcia twarzy na wprost, które jest w każdym skanie,
--   * ocena ogólna = zaokrąglona średnia obszarów bez symetrii.
--
-- Z raportu wypadają te same podoceny, żeby ekran raportu nie pokazywał
-- liczby, której nie ma już w kolumnie `oceny`. Pierwotna ocena ogólna
-- modelu zostaje w `ocena_ogolna_model` - przeliczenie niczego nie gubi.
-- ------------------------------------------------------------
with z as (
  select skan_id, array_agg(ujecie) as ujecia
    from public.wyglad_zdjecia
   group by skan_id
),
nowe as (
  select s.id,
         coalesce((
           select jsonb_object_agg(e.key, e.value)
             from jsonb_each(s.oceny) e
            where case e.key
                    when 'zeby'        then 'zeby'     = any (z.ujecia)
                    when 'postawa'     then 'sylwetka' = any (z.ujecia)
                    when 'sklad_ciala' then 'sylwetka' = any (z.ujecia)
                    else true
                  end
         ), '{}'::jsonb) as oceny
    from public.wyglad_skany s
    join z on z.skan_id = s.id
   where s.oceny is not null
     and s.wersja_promptu = 1
     and s.ocena_ogolna_model is null
)
update public.wyglad_skany s
   set ocena_ogolna_model = s.ocena_ogolna,
       oceny = n.oceny,
       ocena_ogolna = coalesce(
         (select round(avg(e.value::numeric))::smallint
            from jsonb_each_text(n.oceny) e
           where e.key <> 'symetria'),
         s.ocena_ogolna),
       raport = case
         when jsonb_typeof(s.raport -> 'podoceny') = 'array' then
           jsonb_set(
             jsonb_set(s.raport, '{podoceny}', coalesce((
               select jsonb_agg(p)
                 from jsonb_array_elements(s.raport -> 'podoceny') p
                where n.oceny ? (p ->> 'klucz')
             ), '[]'::jsonb)),
             '{ocena_ogolna}',
             to_jsonb(coalesce(
               (select round(avg(e.value::numeric))::int
                  from jsonb_each_text(n.oceny) e
                 where e.key <> 'symetria'),
               s.ocena_ogolna)))
         else s.raport
       end
  from nowe n
 where n.id = s.id;

-- ------------------------------------------------------------
-- Limity liczone z tego, co faktycznie się stało
--
-- Dotąd pula i odstęp liczyły KAŻDY wiersz w wyglad_skany. Wiersz powstaje
-- przy starcie skanu, przed wysłaniem zdjęć - więc zerwane łącze albo błąd
-- modelu zostawiały skan bez oceny, który zjadał pulę i blokował tydzień.
--
-- Teraz liczy się:
--   * skan z oceną,
--   * skan w toku (bez oceny, młodszy niż 15 minut) - inaczej dałoby się
--     rozpocząć pięć skanów naraz i dopiero potem je analizować,
--   * wpis w rejestrze kosztów AI, który nie został zwolniony.
--
-- Pula to WIĘKSZA z dwóch liczb: skanów i wpisów w rejestrze. Rejestr jest
-- tu po to, żeby skasowanie skanu nie zwalniało miejsca w puli - bez niego
-- "zrób skan, skasuj, zrób znowu" byłoby darmową analizą bez końca na nasz
-- rachunek. Rejestru użytkownik nie zmieni: tabela jest zamknięta dla
-- przeglądarki od 0043.
--
-- Zwolniona rezerwacja (model się wywalił) ma koszt 0 i datę rozliczenia
-- - taką pomijamy, bo nic nie kosztowała i nic nie dała.
--
-- Poza tym funkcja jest przepisana z 0059 bez zmian.
-- ------------------------------------------------------------
create or replace function public.wyglad_limit()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select coalesce((value ->> 'odstep_dni')::int, 7) as odstep,
           case
             when public.plan_poziom() >= 2
               then coalesce((value ->> 'limit_miesiaca')::int, 5)
             else coalesce((value ->> 'limit_miesiaca_starter')::int, 1)
           end as limit_mies
      from public.app_settings where key = 'wyglad'
  ),
  s as (
    select max(utworzono) as ostatni,
           count(*) filter (where utworzono >= date_trunc('month', now())) as w_miesiacu
      from public.wyglad_skany
     where user_id = auth.uid()
       and (ocena_ogolna is not null or utworzono > now() - interval '15 minutes')
  ),
  w as (
    select max(utworzono) as ostatni,
           count(*) filter (where utworzono >= date_trunc('month', now())) as w_miesiacu
      from public.ai_wydatki
     where user_id = auth.uid()
       and kategoria = 'wyglad'
       and not (rozliczono is not null and coalesce(koszt_usd, 0) = 0)
  ),
  l as (
    select greatest(coalesce(s.w_miesiacu, 0), coalesce(w.w_miesiacu, 0)) as w_miesiacu,
           greatest(s.ostatni, w.ostatni) as ostatni
      from s cross join w
  ),
  a as (
    select public.is_admin()
        or coalesce(
             (select pr.wyglad_bez_limitu from public.profiles pr where pr.id = auth.uid()),
             false)
      as admin
  )
  select jsonb_build_object(
    'odstep_dni',     p.odstep,
    'limit_miesiaca', p.limit_mies,
    'w_miesiacu',     l.w_miesiacu,
    'ostatni_skan',   l.ostatni,
    'bez_limitu',     a.admin,
    'nastepny_od',    case when a.admin or l.ostatni is null then now()
                           else l.ostatni + make_interval(days => p.odstep) end,
    'mozna',          a.admin
                        or (l.w_miesiacu < p.limit_mies
                            and (l.ostatni is null
                                 or l.ostatni + make_interval(days => p.odstep) <= now())),
    'powod',          case
                        when a.admin then null
                        when l.w_miesiacu >= p.limit_mies then 'limit_miesiaca'
                        when l.ostatni is not null
                             and l.ostatni + make_interval(days => p.odstep) > now() then 'odstep'
                        else null
                      end
  )
  from p cross join l cross join a;
$$;

revoke all on function public.wyglad_limit() from public, anon;
grant execute on function public.wyglad_limit() to authenticated;

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
declare
  v_user uuid;
  v_skan uuid;
  v_l    jsonb;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'wyglad_skany'
       and column_name = 'skan_odniesienia'
  ) then
    raise exception 'Migracja 0078: brak kolumny wyglad_skany.skan_odniesienia';
  end if;

  -- Po przeliczeniu żaden skan wersji 1 nie może mieć oceny zębów bez zdjęcia zębów.
  if exists (
    select 1 from public.wyglad_skany s
     where s.wersja_promptu = 1 and s.oceny ? 'zeby'
       and not exists (select 1 from public.wyglad_zdjecia z
                        where z.skan_id = s.id and z.ujecie = 'zeby')
  ) then
    raise exception 'Migracja 0078: została ocena zębów bez zdjęcia zębów';
  end if;

  insert into auth.users (id, email)
       values (gen_random_uuid(), 'test-0078@grind.local')
    returning id into v_user;
  perform set_config('request.jwt.claim.sub', v_user::text, true);

  -- Skan sprzed godziny bez oceny = nieudana analiza. Nie może niczego blokować.
  insert into public.wyglad_skany (user_id, utworzono) values (v_user, now() - interval '1 hour');
  v_l := public.wyglad_limit();
  if (v_l ->> 'w_miesiacu')::int <> 0 or not (v_l ->> 'mozna')::boolean then
    raise exception 'Migracja 0078: nieudany skan dalej zjada limit (%)', v_l;
  end if;

  -- Skan w toku liczy się od razu - inaczej dałoby się otworzyć kilka naraz.
  insert into public.wyglad_skany (user_id) values (v_user) returning id into v_skan;
  v_l := public.wyglad_limit();
  if (v_l ->> 'w_miesiacu')::int <> 1 or (v_l ->> 'mozna')::boolean then
    raise exception 'Migracja 0078: skan w toku nie blokuje kolejnego (%)', v_l;
  end if;

  -- Zapłacona analiza, potem skasowany skan: miejsce w puli dalej zajęte.
  insert into public.ai_wydatki (user_id, kategoria, szacunek_usd, koszt_usd, rozliczono)
       values (v_user, 'wyglad', 0.1, 0.05, now());
  delete from public.wyglad_skany where id = v_skan;
  v_l := public.wyglad_limit();
  if (v_l ->> 'w_miesiacu')::int <> 1 then
    raise exception 'Migracja 0078: skasowanie skanu zwolniło pulę (%)', v_l;
  end if;

  -- Zwolniona rezerwacja (model się wywalił) nic nie kosztowała - nie liczy się.
  delete from public.ai_wydatki where user_id = v_user;
  insert into public.ai_wydatki (user_id, kategoria, szacunek_usd, koszt_usd, rozliczono)
       values (v_user, 'wyglad', 0.1, 0, now());
  v_l := public.wyglad_limit();
  if (v_l ->> 'w_miesiacu')::int <> 0 then
    raise exception 'Migracja 0078: zwolniona rezerwacja zjada pulę (%)', v_l;
  end if;

  perform set_config('request.jwt.claim.sub', '', true);
  delete from auth.users where id = v_user;
end;
$$;
