import { useState, useEffect, useCallback, useRef } from 'react';
import { Entry } from '../data/types';
import { defaultEntry, upsertEntry, getCachedData, refreshCache } from '../data/store';
import { computeDayNumber } from '../data/dateUtils';

export function useEntry(date: string) {
  const cached = getCachedData();
  const initialEntry = cached?.entries[date] ?? null;
  const initialDayNumber = cached
    ? computeDayNumber(date, cached.meta.first_date)
    : 1;

  const [entry, setEntry] = useState<Partial<Entry>>(
    initialEntry ?? defaultEntry(date, initialDayNumber)
  );
  const [savedEntry, setSavedEntry] = useState<Entry | null>(initialEntry);
  const [loading, setLoading] = useState(!cached);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // When date changes, try cache first (synchronous), then refresh from SAF
  useEffect(() => {
    // Reset initialization flag on date change so we don't auto-save the loaded data
    initializedRef.current = false;

    const cached = getCachedData();
    if (cached) {
      const existing = cached.entries[date] ?? null;
      const dayNumber = computeDayNumber(date, cached.meta.first_date);
      if (existing) {
        setEntry(existing);
        setSavedEntry(existing);
      } else {
        setEntry(defaultEntry(date, dayNumber));
        setSavedEntry(null);
      }
      setLoading(false);
    } else {
      setLoading(true);
      (async () => {
        const data = await refreshCache();
        if (!mountedRef.current) return;
        const existing = data.entries[date] ?? null;
        const dayNumber = computeDayNumber(date, data.meta.first_date);
        if (existing) {
          setEntry(existing);
          setSavedEntry(existing);
        } else {
          setEntry(defaultEntry(date, dayNumber));
          setSavedEntry(null);
        }
        setLoading(false);
      })();
    }
  }, [date]);

  // Mark initialized after data loads — small delay so setEntry from load doesn't trigger auto-save
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => { initializedRef.current = true; }, 200);
      return () => clearTimeout(t);
    }
  }, [loading, date]);

  const updateField = useCallback(<K extends keyof Entry>(field: K, value: Entry[K]) => {
    setEntry((prev) => ({ ...prev, [field]: value }));
  }, []);

  const save = useCallback(async () => {
    const saved = await upsertEntry({ ...entry, date } as Partial<Entry> & { date: string });
    if (mountedRef.current) {
      setSavedEntry(saved);
      setEntry(saved);
    }
    return saved;
  }, [entry, date]);

  const isDirty = (() => {
    if (!savedEntry) {
      return entry.sleep_quality != null || entry.alertness != null || entry.mood != null
        || (entry.dreams ?? '') !== '' || (entry.notes ?? '') !== ''
        || entry.sleep_time != null || entry.wake_time != null;
    }
    return JSON.stringify(entry) !== JSON.stringify(savedEntry);
  })();

  // Auto-save: debounce 2s after field changes
  useEffect(() => {
    if (!initializedRef.current) return;
    if (!isDirty) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      save();
    }, 2000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [entry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save immediately (for navigation guards)
  const saveNow = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (isDirty) await save();
  }, [isDirty, save]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { entry, updateField, saveNow, isDirty, loading };
}
