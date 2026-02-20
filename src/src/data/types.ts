export interface Entry {
  date: string;
  day: number;
  sleep_quality: number | null;
  alertness: number | null;
  mood: number | null;
  dreams: string;
  notes: string;
  sleep_time: string | null;
  wake_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataFile {
  version: number;
  entries: Record<string, Entry>;
  meta: {
    first_date: string | null;
    total_entries: number;
  };
}

export interface AppSettings {
  notificationsEnabled: boolean;
  notificationHour: number;
  notificationMinute: number;
  dataFolderUri: string | null;
  dataFileUri: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: false,
  notificationHour: 9,
  notificationMinute: 0,
  dataFolderUri: null,
  dataFileUri: null,
};
