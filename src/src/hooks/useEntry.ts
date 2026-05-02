import { useState, useEffect, useCallback, useRef } from 'react';
import { Entry } from '../data/types';
import {
  defaultEntry,
  flushPendingWrites,
  upsertEntry,
  getCachedData,
  refreshCache,
} from '../data/store';
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
  const entryRef = useRef<Partial<Entry>>(initialEntry ?? defaultEntry(date, initialDayNumber));
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSeqRef = useRef(0);
  const dateRef = useRef(date);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    dateRef.current = date;
  }, [date]);

  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  // When date changes, try cache first (synchronous), then refresh from SAF
  useEffect(() => {
    // Reset initialization flag on date change so we don't auto-save the loaded data
    initializedRef.current = false;

    const cached = getCachedData();
    if (cached) {
      const existing = cached.entries[date] ?? null;
      const dayNumber = computeDayNumber(date, cached.meta.first_date);
      if (existing) {
        entryRef.current = existing;
        setEntry(existing);
        setSavedEntry(existing);
      } else {
        const fresh = defaultEntry(date, dayNumber);
        entryRef.current = fresh;
        setEntry(fresh);
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
          entryRef.current = existing;
          setEntry(existing);
          setSavedEntry(existing);
        } else {
          const fresh = defaultEntry(date, dayNumber);
          entryRef.current = fresh;
          setEntry(fresh);
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

  const saveDraft = useCallback(async (draft: Partial<Entry>) => {
    const seq = ++saveSeqRef.current;
    const saved = await upsertEntry({ ...draft, date } as Partial<Entry> & { date: string });
    if (mountedRef.current && dateRef.current === date && seq === saveSeqRef.current) {
      entryRef.current = saved;
      setSavedEntry(saved);
      setEntry(saved);
    }
    return saved;
  }, [date]);

  const updateField = useCallback(<K extends keyof Entry>(field: K, value: Entry[K]) => {
    const next = { ...entryRef.current, [field]: value };
    entryRef.current = next;
    setEntry(next);
    if (initializedRef.current) {
      saveDraft(next);
    }
  }, [saveDraft]);

  const updateFields = useCallback((patch: Partial<Entry>) => {
    const next = { ...entryRef.current, ...patch };
    entryRef.current = next;
    setEntry(next);
    if (initializedRef.current) {
      saveDraft(next);
    }
  }, [saveDraft]);

  const save = useCallback(async () => {
    return saveDraft(entry);
  }, [entry, saveDraft]);

  const isDirty = (() => {
    if (!savedEntry) {
      return entry.sleep_quality != null || entry.alertness != null || entry.mood != null
        || (entry.dreams ?? '') !== '' || (entry.notes ?? '') !== ''
        || entry.sleep_time != null || entry.wake_time != null;
    }
    return JSON.stringify(entry) !== JSON.stringify(savedEntry);
  })();

  // Export catch-up: local storage is written immediately on edits; this
  // catches changes from slower text composition paths without delaying save.
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
    await flushPendingWrites();
  }, [isDirty, save]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { entry, updateField, updateFields, saveNow, isDirty, loading };
}
