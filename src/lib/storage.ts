import { Storage } from 'expo-sqlite/kv-store';

// Everything lives in a small SQLite file on the phone. Nothing leaves the device.
export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = Storage.getItemSync(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  Storage.setItemSync(key, JSON.stringify(value));
}
