-- ============================================================
-- Grind — Migracja 0055: zęby jako czwarte ujęcie skanu wyglądu
--
-- Nie jest to nowy moduł - `zeby` był już od migracji 0039 wpisany
-- w komentarz kolumny `wyglad_skany.oceny` oraz w PODOCENA_KLUCZE i KATEGORIE
-- w src/lib/ai/wygladSchema.ts (model mógł ocenić zęby, gdyby je zobaczył).
-- Brakowało wyłącznie sposobu, żeby faktycznie mu je pokazać: instrukcja
-- do zdjęcia "front" każe zachować neutralny wyraz twarzy, czyli zamknięte
-- usta. Ta migracja dokłada `zeby` jako dozwolone ujęcie zdjęcia - resztę
-- (ocena, kategoria zaleceń, upsert rutyny pielęgnacyjnej) system już umiał.
-- ============================================================

alter table public.wyglad_zdjecia drop constraint if exists wyglad_zdjecia_ujecie_check;
alter table public.wyglad_zdjecia add constraint wyglad_zdjecia_ujecie_check
  check (ujecie in ('front', 'zeby', 'profil', 'sylwetka'));

-- ------------------------------------------------------------
-- Sprawdzenie
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'wyglad_zdjecia_ujecie_check'
       and pg_get_constraintdef(oid) ilike '%zeby%'
  ) then
    raise exception 'Migracja 0055: ujecie "zeby" nie jest dozwolone';
  end if;

  -- Stare wartości muszą dalej przechodzić - to nie ma być wymiana, tylko dodanie.
  if not exists (
    select 1 from pg_constraint
     where conname = 'wyglad_zdjecia_ujecie_check'
       and pg_get_constraintdef(oid) ilike '%front%'
       and pg_get_constraintdef(oid) ilike '%profil%'
       and pg_get_constraintdef(oid) ilike '%sylwetka%'
  ) then
    raise exception 'Migracja 0055: stare ujęcia przestały być dozwolone';
  end if;
end $$;
