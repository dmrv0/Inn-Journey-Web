/**
 * Date helpers for the booking domain.
 *
 * The API speaks DateOnly (`yyyy-MM-dd`) for stays, and a stay occupies the
 * half-open interval [checkIn, checkOut) — the departure day is not a night.
 * Everything here works in local calendar terms, never UTC instants, so a
 * booking made late at night does not slip a day.
 */

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function today(): string {
  return toIsoDate(new Date());
}

/** Number of nights in a stay. Zero or fewer is not a stay. */
export function nightsBetween(from: string, to: string): number {
  return Math.round(
    (parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000
  );
}

/** Every night in [from, to) — the departure day is excluded. */
export function nightsIn(from: string, to: string): string[] {
  const nights: string[] = [];

  for (let d = from; d < to; d = addDays(d, 1)) {
    nights.push(d);
  }

  return nights;
}

export function formatDate(iso: string | null | undefined, withYear = true): string {
  if (!iso) return '—';

  const date = iso.length > 10 ? new Date(iso) : parseIsoDate(iso);

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';

  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMoney(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—';

  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function weekdayInitial(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, { weekday: 'narrow' });
}

export function dayOfMonth(iso: string): number {
  return parseIsoDate(iso).getDate();
}

export function isWeekend(iso: string): boolean {
  const day = parseIsoDate(iso).getDay();
  return day === 0 || day === 6;
}
