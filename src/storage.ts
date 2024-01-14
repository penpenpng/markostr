interface AppPersistedState {
  npub?: string;
  trainingDataSize?: number;
  trainingData?: string;
  lastFetchedAt?: number;
}

const STORAGE_KEY = "data";

export function get(): AppPersistedState {
  if (!window.localStorage) {
    return {};
  }

  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function update(data: Partial<AppPersistedState>): void {
  if (!window.localStorage) {
    return;
  }

  const current = get();

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...current, ...data })
    );
  } catch {
    return;
  }
}
