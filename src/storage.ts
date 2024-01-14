import { persisted } from "svelte-persisted-store";

interface AppPersistedState {
  npub?: string;
  trainingDataSize?: number;
  trainingData?: string;
  lastFetchedAt?: number;
}

const STORAGE_KEY = "data";

export const storage = persisted<AppPersistedState>(STORAGE_KEY, {});

export function update(data: Partial<AppPersistedState>): void {
  if (!window.localStorage) {
    return;
  }
  storage.update((current) => ({ ...current, ...data }));
}
