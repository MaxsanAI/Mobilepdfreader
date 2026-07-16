export interface BookChapter {
  title: string;
  html: string;
}

export interface BookImage {
  id: string;
  dataUrl: string;
}

export interface ReaderSettings {
  fontSize: number;
  theme: 'light' | 'dark' | 'sepia';
  width: 'narrow' | 'medium' | 'wide';
  fontFamily: 'serif' | 'sans';
}

export interface Book {
  id: string;
  title: string;
  author?: string;
  cover?: string;
  fileName: string;
  chapters: BookChapter[];
  images: BookImage[];
  wordCount: number;
  dateAdded: number;
  lastReadPosition: number;
  lastReadChapter: number;
  settings: ReaderSettings;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  fontSize: 18,
  theme: 'light',
  width: 'medium',
  fontFamily: 'serif',
};

const DB_NAME = 'mobile-pdf-reader';
const DB_VERSION = 1;
const STORE_NAME = 'books';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

export async function saveBook(book: Book): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, 'readwrite').put(book);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function getBook(id: string): Promise<Book | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, 'readonly').get(id);
    request.onsuccess = () => {
      db.close();
      resolve(request.result as Book | undefined);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function getAllBooks(): Promise<Book[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, 'readonly').getAll();
    request.onsuccess = () => {
      db.close();
      resolve((request.result as Book[]).sort((a, b) => b.dateAdded - a.dateAdded));
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function deleteBook(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = tx(db, 'readwrite').delete(id);
    request.onsuccess = () => {
      db.close();
      resolve();
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

export async function updateBookProgress(
  id: string,
  position: number,
  chapter: number,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const book = getReq.result as Book | undefined;
      if (book) {
        book.lastReadPosition = position;
        book.lastReadChapter = chapter;
        store.put(book);
      }
    };
    const done = db.transaction(STORE_NAME);
    done.oncomplete = () => {
      db.close();
      resolve();
    };
    done.onerror = () => {
      db.close();
      reject(done.error);
    };
  });
}

export async function updateBookSettings(
  id: string,
  settings: ReaderSettings,
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readwrite');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const book = getReq.result as Book | undefined;
      if (book) {
        book.settings = settings;
        store.put(book);
      }
    };
    const done = db.transaction(STORE_NAME);
    done.oncomplete = () => {
      db.close();
      resolve();
    };
    done.onerror = () => {
      db.close();
      reject(done.error);
    };
  });
}

export function generateId(): string {
  return `book-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
