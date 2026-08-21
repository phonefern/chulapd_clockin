export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

const WORK_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WORK_MONTH_PATTERN = /^\d{4}-\d{2}$/;

// Returns the current date as YYYY-MM-DD in Asia/Bangkok, independent of server timezone.
export function todayInBangkok(): string {
  return formatDateKeyInBangkok(new Date());
}

export function currentMonthInBangkok(): string {
  return todayInBangkok().slice(0, 7);
}

export function formatDateKeyInBangkok(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BANGKOK_TIME_ZONE }).format(date);
}

export function isValidWorkDate(value: string): boolean {
  if (!WORK_DATE_PATTERN.test(value)) return false;
  return formatDateKeyInBangkok(new Date(`${value}T00:00:00+07:00`)) === value;
}

export function isValidWorkMonth(value: string): boolean {
  if (!WORK_MONTH_PATTERN.test(value)) return false;
  return isValidWorkDate(`${value}-01`);
}

export function resolveWorkMonth(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && isValidWorkMonth(candidate) ? candidate : currentMonthInBangkok();
}

export function resolveWorkDate(value: string | string[] | undefined): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate && isValidWorkDate(candidate) ? candidate : todayInBangkok();
}

export function addWorkDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00+07:00`);
  base.setUTCDate(base.getUTCDate() + days);
  return formatDateKeyInBangkok(base);
}

export function enumerateWorkDates(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addWorkDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export function lastDayOfMonth(month: string): string {
  if (!isValidWorkMonth(month)) return lastDayOfMonth(currentMonthInBangkok());
  const end = new Date(`${month}-01T00:00:00+07:00`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return formatDateKeyInBangkok(end);
}

export function addWorkMonths(month: string, months: number): string {
  const baseMonth = isValidWorkMonth(month) ? month : currentMonthInBangkok();
  const date = new Date(`${baseMonth}-01T00:00:00+07:00`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return formatDateKeyInBangkok(date).slice(0, 7);
}
