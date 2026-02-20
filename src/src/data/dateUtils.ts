import { format, parseISO, differenceInCalendarDays, addDays, subDays, isToday as isTodayFns } from 'date-fns';

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function formatDisplay(dateStr: string): string {
  const date = parseISO(dateStr);
  return format(date, 'EEE, MMM d');
}

export function prevDay(dateStr: string): string {
  return format(subDays(parseISO(dateStr), 1), 'yyyy-MM-dd');
}

export function nextDay(dateStr: string): string {
  return format(addDays(parseISO(dateStr), 1), 'yyyy-MM-dd');
}

export function isToday(dateStr: string): boolean {
  return isTodayFns(parseISO(dateStr));
}

export function computeDayNumber(dateStr: string, firstDate: string | null): number {
  if (!firstDate) return 1;
  const first = parseISO(firstDate);
  const current = parseISO(dateStr);
  return differenceInCalendarDays(current, first) + 1;
}
