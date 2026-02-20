import { StorageAccessFramework } from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataFile, Entry, AppSettings, DEFAULT_SETTINGS } from './types';
import { todayStr, computeDayNumber } from './dateUtils';

const SETTINGS_KEY = 'daily-checkin-settings';
const BACKUP_KEY = 'daily-checkin-backup';
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

  return { folderUri, fileUri };
}

// --- SAF Safe Write Helper ---

// Safely write content to SAF by finding-or-creating the data file.
// Avoids truncation (delete + recreate) and detects duplicate files.
async function safWriteToFolder(folderUri: string, content: string): Promise<string> {
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

// --- Data File Read/Write ---

export async function readDataFile(): Promise<DataFile> {
  const settings = await loadSettings();

  // Always check backup first to merge any data that didn't make it to SAF
  const backup = await AsyncStorage.getItem(BACKUP_KEY);
  let backupData: DataFile | null = null;
  if (backup) {
    try { backupData = JSON.parse(backup); } catch { /* ignore */ }
  }

  if (!settings.dataFileUri) {
    return backupData ?? emptyDataFile();
  }

  try {
    const content = await StorageAccessFramework.readAsStringAsync(
      settings.dataFileUri
    );
    const safData: DataFile = JSON.parse(content);

    // If backup has more entries than SAF file, SAF writes have been failing
    // Use whichever has more data
    if (backupData && Object.keys(backupData.entries).length > Object.keys(safData.entries).length) {
      console.warn('Backup has more data than SAF file, using backup and syncing to file');
      if (settings.dataFolderUri) {
        try {
          const newUri = await safWriteToFolder(settings.dataFolderUri, JSON.stringify(backupData, null, 2));
          if (newUri !== settings.dataFileUri) {
            await saveSettings({ ...settings, dataFileUri: newUri });
          }
        } catch { /* best effort */ }
      }
      return backupData;
    }

    // SAF is up to date, update backup
    await AsyncStorage.setItem(BACKUP_KEY, content);
    return safData;
  } catch (e) {
    console.warn('SAF read failed:', e);
    return backupData ?? emptyDataFile();
  }
}

export async function writeDataFile(data: DataFile): Promise<void> {
  // Update in-memory cache immediately
  cachedData = data;

  const settings = await loadSettings();
  const content = JSON.stringify(data, null, 2);

  // Always save backup
  await AsyncStorage.setItem(BACKUP_KEY, content);

  if (!settings.dataFileUri || !settings.dataFolderUri) return;

  try {
    const newUri = await safWriteToFolder(settings.dataFolderUri, content);

    // Update stored URI since it changes on each recreate
    if (newUri !== settings.dataFileUri) {
      await saveSettings({ ...settings, dataFileUri: newUri });
    }
  } catch (e) {
    console.warn('SAF write failed, data saved to backup only:', e);
  }
}

// --- Entry Operations ---

export async function upsertEntry(entry: Partial<Entry> & { date: string }): Promise<Entry> {
  const data = await readDataFile();
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
