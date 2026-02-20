import { useState, useEffect, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../data/types';
import { loadSettings, saveSettings } from '../data/store';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      setLoading(false);
    })();
  }, []);

  const update = useCallback(async (partial: Partial<AppSettings>) => {
    const updated = { ...settings, ...partial };
    setSettings(updated);
    await saveSettings(updated);
    return updated;
  }, [settings]);

  return { settings, update, loading };
}
