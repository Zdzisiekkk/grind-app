/**
 * Kolejka zapisów na czas braku zasięgu.
 *
 * Siłownia bywa w piwnicy. Zapisana seria nie może zniknąć tylko dlatego, że
 * telefon akurat nie miał zasięgu - więc żądanie, które nie doleciało, ląduje
 * w IndexedDB i wysyła się samo, gdy sieć wróci.
 *
 * IndexedDB, a nie localStorage, bo zapis musi przetrwać zamknięcie karty
 * i zabicie aplikacji przez system - a localStorage jest synchroniczny i
 * potrafi się urwać w połowie przy wygaszaniu ekranu.
 */

const DB_NAME = "grind-offline";
const DB_VERSION = 1;
const STORE = "mutations";

export type QueuedMutation = {
  /** Nadawane przez IndexedDB, rosnące - dzięki temu kolejność jest zachowana. */
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  /** Nazwa tabeli - tylko do pokazania człowiekowi, co czeka. */
  table: string;
  createdAt: number;
  /** Ile razy próba wysyłki się nie udała z winy sieci. */
  attempts: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = run(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function enqueue(item: Omit<QueuedMutation, "id">): Promise<void> {
  await tx("readwrite", (store) => store.add(item));
  notify();
}

export async function allQueued(): Promise<QueuedMutation[]> {
  const items = await tx<QueuedMutation[]>("readonly", (store) => store.getAll());
  return items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function dropQueued(id: number): Promise<void> {
  await tx("readwrite", (store) => store.delete(id));
  notify();
}

export async function bumpAttempts(item: QueuedMutation): Promise<void> {
  await tx("readwrite", (store) => store.put({ ...item, attempts: item.attempts + 1 }));
}

export async function queueLength(): Promise<number> {
  try {
    return await tx<number>("readonly", (store) => store.count());
  } catch {
    // Prywatne okno albo zablokowane dane witryny - apka ma działać dalej,
    // tylko bez kolejki. Lepsze niż biały ekran.
    return 0;
  }
}

/* ------------------------- Powiadamianie interfejsu ------------------------ */

const listeners = new Set<() => void>();

export function subscribeToQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(): void {
  for (const listener of listeners) listener();
}
