import { BANGKOK_TIME_ZONE } from "@/lib/workDate";

export const WORK_END_HOUR = 16;
export const WORK_END_MINUTE = 30;
export const EARLY_CLOCK_OUT_THRESHOLD_MINUTES = 30;
export const CLOCK_OUT_UNDO_WINDOW_MS = 2 * 60 * 1000;

function getBangkokTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
}

export function isEarlyClockOut(now: Date): boolean {
  const { hour, minute } = getBangkokTimeParts(now);
  const minutesNow = hour * 60 + minute;
  const endMinutes = WORK_END_HOUR * 60 + WORK_END_MINUTE;
  return endMinutes - minutesNow > EARLY_CLOCK_OUT_THRESHOLD_MINUTES;
}

export function formatBangkokTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: BANGKOK_TIME_ZONE,
  }).format(date);
}
