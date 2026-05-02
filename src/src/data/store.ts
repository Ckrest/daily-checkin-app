import { StorageAccessFramework } from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataFile, Entry, AppSettings, DEFAULT_SETTINGS } from './types';
import { todayStr, computeDayNumber } from './dateUtils';

const SETTINGS_KEY = 'daily-checkin-settings';
// Keep the old key so existing installs migrate without copying data.
const LOCAL_DATA_KEY = 'daily-checkin-backup';
const DATA_FILENAME = 'daily-checkin.json';

// --- In-memory cache (avoids async loading on day navigation) ---
let cachedData: DataFile | null = null;

export function getCachedData(): DataFile | null {
  return cachedData;
}

export async function refreshCache(): Promise<DataFile> {
  cachedData = await readDataFile();
  return cachedData;
}

function emptyDataFile(): DataFile {
  return {
    version: 1,
    entries: {},
    meta: { first_date: null, total_entries: 0 },
  };
}

function cloneDataFile(data: DataFile): DataFile {
  return {
    version: data.version,
    entries: { ...data.entries },
    meta: { ...data.meta },
  };
}

function recomputeMeta(data: DataFile): DataFile {
  const dates = Object.keys(data.entries).sort();
  data.meta.first_date = dates[0] ?? null;
  data.meta.total_entries = dates.length;
  for (const date of dates) {
    data.entries[date].day = computeDayNumber(date, data.meta.first_date);
  }
  return data;
}

function updatedAtMs(entry?: Entry): number {
  if (!entry?.updated_at) return 0;
  const ts = Date.parse(entry.updated_at);
  return Number.isFinite(ts) ? ts : 0;
}

function mergeDataFiles(localData: DataFile | null, safData: DataFile | null): DataFile {
  const merged = cloneDataFile(localData ?? safData ?? emptyDataFile());
  const dates = new Set([
    ...Object.keys(localData?.entries ?? {}),
    ...Object.keys(safData?.entries ?? {}),
  ]);

  for (const date of dates) {
    const localEntry = localData?.entries[date];
    const safEntry = safData?.entries[date];
    if (!localEntry) {
      merged.entries[date] = safEntry as Entry;
    } else if (!safEntry) {
      merged.entries[date] = localEntry;
    } else {
      merged.entries[date] = updatedAtMs(safEntry) > updatedAtMs(localEntry)
        ? safEntry
        : localEntry;
    }
  }

  return recomputeMeta(merged);
}

function dataEquals(a: DataFile | null, b: DataFile | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function readLocalData(): Promise<DataFile | null> {
  const raw = await AsyncStorage.getItem(LOCAL_DATA_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeLocalData(data: DataFile): Promise<void> {
  await AsyncStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data, null, 2));
}

export function defaultEntry(date: string, dayNumber: number = 1): Entry {
  const now = new Date().toISOString();
  return {
    date,
    day: dayNumber,
    sleep_quality: null,
    alertness: null,
    mood: null,
    dreams: '',
    notes: '',
    sleep_time: null,
    wake_time: null,
    created_at: now,
    updated_at: now,
  };
}

// --- Settings ---

export async function loadSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// --- SAF Folder Picker ---

export async function pickDataFolder(): Promise<{ folderUri: string; fileUri: string } | null> {
  const perms = await StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perms.granted) return null;

  const folderUri = perms.directoryUri;

  // Check if file already exists in folder
  const files = await StorageAccessFramework.readDirectoryAsync(folderUri);
  const existing = files.find((f: string) => decodeURIComponent(f).endsWith(DATA_FILENAME));

  let fileUri: string;
  if (existing) {
    fileUri = existing;
  } else {
    fileUri = await StorageAccessFramework.createFileAsync(
      folderUri,
      DATA_FILENAME,
      'application/json'
    );
    await StorageAccessFramework.writeAsStringAsync(
      fileUri,
      JSON.stringify(emptyDataFile(), null, 2)
    );
  }

  const settings = await loadSettings();
  settings.dataFolderUri = folderUri;
  settings.dataFileUri = fileUri;
  await saveSettings(settings);

  const merged = mergeDataFiles(await readLocalData(), await readSafData(settings));
  cachedData = merged;
  await writeLocalData(merged);
  await exportDataFile(merged);

  return { folderUri, fileUri };
}

// --- SAF Safe Write Helper ---

// Recreate only as a fallback when the stored SAF file URI is no longer writable.
async function recreateSafFile(folderUri: string, content: string): Promise<string> {
  // List folder to find existing file(s), including duplicates like "daily-checkin (1).json"
  const baseName = DATA_FILENAME.replace('.json', '');
  const files = await StorageAccessFramework.readDirectoryAsync(folderUri);
  const matches = files.filter((f: string) => {
    const decoded = decodeURIComponent(f);
    return decoded.endsWith(DATA_FILENAME) || decoded.includes(`${baseName} (`) ;
  });

  // Delete ALL matching files
  for (const uri of matches) {
    try {
      await StorageAccessFramework.deleteAsync(uri, { idempotent: true });
    } catch {
      // Best effort — file may already be gone
    }
  }

  // Create fresh file and write
  const newUri = await StorageAccessFramework.createFileAsync(
    folderUri,
    DATA_FILENAME,
    'application/json'
  );
  await StorageAccessFramework.writeAsStringAsync(newUri, content);
  return newUri;
}

async function readSafData(settings: AppSettings): Promise<DataFile | null> {
  if (!settings.dataFileUri) return null;
  try {
    const content = await StorageAccessFramework.readAsStringAsync(
      settings.dataFileUri
    );
    return JSON.parse(content);
  } catch (e) {
    console.warn('SAF read failed:', e);
    return null;
  }
}

let localWriteQueue: Promise<void> = Promise.resolve();
let pendingExportData: DataFile | null = null;
let pendingExportTimer: ReturnType<typeof setTimeout> | null = null;

async function exportDataFile(data: DataFile): Promise<boolean> {
  const settings = await loadSettings();
  if (!settings.dataFolderUri) return false;

  const content = JSON.stringify(data, null, 2);

  if (settings.dataFileUri) {
    try {
      await StorageAccessFramework.writeAsStringAsync(settings.dataFileUri, content);
      return true;
    } catch (e) {
      console.warn('SAF existing-file write failed, recreating:', e);
    }
  }

  try {
    const newUri = await recreateSafFile(settings.dataFolderUri, content);
    await saveSettings({ ...settings, dataFileUri: newUri });
    return true;
  } catch (e) {
    console.warn('SAF export failed, data remains saved locally:', e);
    return false;
  }
}

function scheduleExport(data: DataFile, delayMs = 800): void {
  pendingExportData = data;
  if (pendingExportTimer) clearTimeout(pendingExportTimer);
  pendingExportTimer = setTimeout(() => {
    const next = pendingExportData;
    pendingExportTimer = null;
    pendingExportData = null;
    if (next) {
      exportDataFile(next);
    }
  }, delayMs);
}

export async function flushPendingWrites(): Promise<void> {
  await localWriteQueue;

  if (pendingExportTimer) {
    clearTimeout(pendingExportTimer);
    pendingExportTimer = null;
  }

  const next = pendingExportData ?? cachedData;
  pendingExportData = null;
  if (next) {
    await exportDataFile(next);
  }
}

// --- Data File Read/Write ---

export async function readDataFile(): Promise<DataFile> {
  const settings = await loadSettings();
  const localData = await readLocalData();
  const safData = await readSafData(settings);
  const merged = mergeDataFiles(localData, safData);

  cachedData = merged;
  if (!dataEquals(localData, merged)) {
    await writeLocalData(merged);
  }
  if (settings.dataFolderUri && !dataEquals(safData, merged)) {
    scheduleExport(merged);
  }

  return merged;
}

export async function writeDataFile(data: DataFile, exportNow = false): Promise<void> {
  // Update in-memory cache immediately
  cachedData = data;

  localWriteQueue = localWriteQueue
    .catch(() => undefined)
    .then(() => writeLocalData(data));
  await localWriteQueue;

  if (exportNow) {
    await exportDataFile(data);
  } else {
    scheduleExport(data);
  }
}

// --- Entry Operations ---

export async function upsertEntry(entry: Partial<Entry> & { date: string }): Promise<Entry> {
  const data = cachedData ? cloneDataFile(cachedData) : await readDataFile();
  const existing = data.entries[entry.date];
  const now = new Date().toISOString();

  // Determine first_date
  let firstDate = data.meta.first_date;
  if (!firstDate || entry.date < firstDate) {
    firstDate = entry.date;
  }

  const dayNumber = computeDayNumber(entry.date, firstDate);

  const updated: Entry = {
    ...defaultEntry(entry.date, dayNumber),
    ...existing,
    ...entry,
    day: dayNumber,
    updated_at: now,
    created_at: existing?.created_at ?? now,
  };

  data.entries[entry.date] = updated;
  data.meta.first_date = firstDate;
  data.meta.total_entries = Object.keys(data.entries).length;

  await writeDataFile(data);
  return updated;
}

export async function getEntry(date: string): Promise<Entry | null> {
  const data = await readDataFile();
  return data.entries[date] ?? null;
}

export async function getDataFile(): Promise<DataFile> {
  return readDataFile();
}
