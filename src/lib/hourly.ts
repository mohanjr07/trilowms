/** Real hourly buckets for the overview charts (last N hours, oldest first). */
export function hourlySeries<K extends string>(
  keys: K[],
  events: Partial<Record<K, { ts?: string | null; qty?: number }[]>> = {},
  hours = 12,
): ({ hour: string } & Record<K, number>)[] {
  const now = new Date();
  const top = new Date(now); top.setMinutes(0, 0, 0);
  const start = top.getTime() - (hours - 1) * 3600000;
  return Array.from({ length: hours }, (_, i) => {
    const from = start + i * 3600000;
    const row = { hour: `${String(new Date(from).getHours()).padStart(2, "0")}:00` } as { hour: string } & Record<K, number>;
    for (const k of keys) {
      row[k] = (events[k] ?? []).reduce<number>((s, e) => {
        const t = e.ts ? new Date(e.ts).getTime() : NaN;
        return t >= from && t < from + 3600000 ? s + (e.qty ?? 1) : s;
      }, 0) as never;
    }
    return row;
  });
}
