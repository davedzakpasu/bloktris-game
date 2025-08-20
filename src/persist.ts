import type { GameState } from "./types";

const KEY = "bloktris.match.v1";

type StorageLike = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
  removeItem: (k: string) => Promise<void>;
};

/** Fallbacks: in-memory if window.localStorage is unavailable (SSR/native) */
const mem = new Map<string, string>();
const webLocal =
  typeof window !== "undefined" && window.localStorage
    ? window.localStorage
    : null;

const defaultStorage: StorageLike = webLocal
  ? {
      getItem: async (k) => webLocal.getItem(k),
      setItem: async (k, v) => {
        webLocal.setItem(k, v);
      },
      removeItem: async (k) => {
        webLocal.removeItem(k);
      },
    }
  : {
      getItem: async (k) => mem.get(k) ?? null,
      setItem: async (k, v) => {
        mem.set(k, v);
      },
      removeItem: async (k) => {
        mem.delete(k);
      },
    };

/** Initialize with a valid default so TS knows it's assigned */
let storage: StorageLike = defaultStorage;

/** Try to swap in AsyncStorage when available (native) */
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AS = require("@react-native-async-storage/async-storage").default;
  if (AS) {
    storage = {
      getItem: (k) => AS.getItem(k),
      setItem: (k, v) => AS.setItem(k, v),
      removeItem: (k) => AS.removeItem(k),
    };
  }
} catch {
  // keep defaultStorage
}

export async function saveMatch(state: GameState) {
  try {
    await storage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("[persist] save failed", e);
  }
}

export async function loadMatch(): Promise<GameState | null> {
  try {
    const raw = await storage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch (e) {
    console.warn("[persist] load failed", e);
    return null;
  }
}

export async function clearMatch() {
  try {
    await storage.removeItem(KEY);
  } catch (e) {
    console.warn("[persist] clear failed", e);
  }
}

export async function hasSavedMatch(): Promise<boolean> {
  try {
    const raw = await storage.getItem(KEY);
    return !!raw;
  } catch {
    return false;
  }
}
