// Returns the current date as YYYY-MM-DD in Asia/Bangkok, independent of server timezone.
export function todayInBangkok(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
}
