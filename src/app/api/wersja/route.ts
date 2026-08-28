import { NextResponse } from "next/server";

/**
 * Która wersja kodu faktycznie stoi na serwerze.
 *
 * Powstało z konkretnej potrzeby: migracja bazy i wdrożenie kodu to dwa
 * osobne zdarzenia, między którymi bywa kilka minut. Przy zmianach, gdzie
 * kolejność ma znaczenie — na przykład skasowanie kolumny, do której stary
 * kod jeszcze pisze — zgadywanie „chyba już poszło" kończy się awarią.
 *
 * Nic tajnego: sam skrót commita i moment zbudowania. Bez sesji, bo test
 * sprawdzający wdrożenie nie ma powodu się logować.
 */
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "lokalnie",
    galaz: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    zbudowano: process.env.VERCEL_DEPLOYMENT_ID ? new Date().toISOString() : null,
  });
}
