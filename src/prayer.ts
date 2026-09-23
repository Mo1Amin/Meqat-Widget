import type { ClockFormat, Numerals, Settings } from "./settings";

export type PrayerKey = "Fajr" | "Sunrise" | "Dhuhr" | "Asr" | "Maghrib" | "Isha";
export type DayTimings = Record<PrayerKey, string>; // "HH:mm", 24h, local time

export const PRAYER_KEYS: PrayerKey[] = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"];
/** Sunrise is shown but is not a prayer: no azan, no countdown target. */
export const SALAH_KEYS: PrayerKey[] = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];

const NAMES: Record<PrayerKey, string> = {
  Fajr: "الفجر",
  Sunrise: "الشروق",
  Dhuhr: "الظهر",
  Asr: "العصر",
  Maghrib: "المغرب",
  Isha: "العشاء",
};

export function prayerName(key: PrayerKey, date: Date): string {
  if (key === "Dhuhr" && date.getDay() === 5) return "الجمعة";
  return NAMES[key];
}

// ---------------------------------------------------------------- dates

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const out = new Date(day);
  out.setHours(h, m, 0, 0);
  return out;
}

// ---------------------------------------------------------------- fetching & cache

const CACHE_PREFIX = "miqat.cal.";
const MAX_CACHED_MONTHS = 4;

function locationKey(s: Settings): string {
  return [s.place.latitude.toFixed(3), s.place.longitude.toFixed(3), s.method, s.school].join(",");
}

function monthCacheKey(s: Settings, year: number, month: number): string {
  return `${CACHE_PREFIX}${locationKey(s)}|${year}-${month}`;
}

type MonthCache = Record<string, DayTimings>;

function readMonth(key: string): MonthCache | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as MonthCache) : null;
  } catch {
    return null;
  }
}

function pruneCache() {
  const keys = Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX));
  if (keys.length <= MAX_CACHED_MONTHS) return;
  // Keys end in "|YYYY-M"; drop the oldest months first.
  const stamp = (k: string) => {
    const [y, m] = k.slice(k.lastIndexOf("|") + 1).split("-").map(Number);
    return y * 12 + m;
  };
  keys.sort((a, b) => stamp(a) - stamp(b));
  keys.slice(0, keys.length - MAX_CACHED_MONTHS).forEach((k) => localStorage.removeItem(k));
}

async function fetchMonth(s: Settings, year: number, month: number): Promise<MonthCache> {
  const params = new URLSearchParams({
    latitude: String(s.place.latitude),
    longitude: String(s.place.longitude),
    method: String(s.method),
    school: String(s.school),
  });
  const url = `https://api.aladhan.com/v1/calendar/${year}/${month}?${params}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || body.code !== 200 || !Array.isArray(body.data)) {
    throw new Error(`Aladhan ${res.status}`);
  }

  const out: MonthCache = {};
  for (const entry of body.data) {
    const [dd, mm, yyyy] = String(entry.date.gregorian.date).split("-");
    const day = {} as DayTimings;
    for (const k of PRAYER_KEYS) {
      // Calendar timings come as "04:10 (EET)"; keep only the clock part.
      day[k] = String(entry.timings[k]).slice(0, 5);
    }
    out[`${yyyy}-${mm}-${dd}`] = day;
  }
  return out;
}

export interface LoadResult {
  today: DayTimings;
  tomorrow: DayTimings | null;
  /** True when the data is a fallback from another day because we are offline. */
  stale: boolean;
}

/**
 * Timings for `date` and the day after, from the monthly cache when possible.
 * A whole month is fetched at once so the widget keeps working offline.
 */
export async function loadTimings(s: Settings, date: Date, forceRefresh = false): Promise<LoadResult> {
  const get = async (d: Date): Promise<DayTimings | null> => {
    const key = monthCacheKey(s, d.getFullYear(), d.getMonth() + 1);
    let month = forceRefresh ? null : readMonth(key);
    if (!month) {
      month = await fetchMonth(s, d.getFullYear(), d.getMonth() + 1);
      localStorage.setItem(key, JSON.stringify(month));
      pruneCache();
    }
    return month[dayKey(d)] ?? null;
  };

  try {
    const today = await get(date);
    if (!today) throw new Error("day missing from calendar");
    const tomorrow = await get(addDays(date, 1)).catch(() => null);
    return { today, tomorrow, stale: false };
  } catch (err) {
    const fallback = anyCachedDay(s, date);
    if (fallback) return { today: fallback, tomorrow: null, stale: true };
    throw err;
  }
}

/** Closest cached day for this location, used when offline in an uncached month. */
function anyCachedDay(s: Settings, date: Date): DayTimings | null {
  const prefix = `${CACHE_PREFIX}${locationKey(s)}|`;
  const target = date.getTime();
  let best: { diff: number; t: DayTimings } | null = null;
  for (const k of Object.keys(localStorage)) {
    if (!k.startsWith(prefix)) continue;
    const month = readMonth(k);
    if (!month) continue;
    for (const [day, t] of Object.entries(month)) {
      const diff = Math.abs(new Date(`${day}T12:00:00`).getTime() - target);
      if (!best || diff < best.diff) best = { diff, t };
    }
  }
  return best?.t ?? null;
}

// ---------------------------------------------------------------- schedule

export interface ScheduledPrayer {
  key: PrayerKey;
  name: string;
  at: Date;
}

export interface Schedule {
  items: ScheduledPrayer[]; // today's six times, in order
  next: ScheduledPrayer; // the next salah (never sunrise)
  previous: ScheduledPrayer; // the salah whose time we are in
}

export function buildSchedule(today: DayTimings, tomorrow: DayTimings | null, now: Date): Schedule {
  const base = new Date(now);
  base.setHours(0, 0, 0, 0);

  const items = PRAYER_KEYS.map((key) => ({ key, name: prayerName(key, base), at: atTime(base, today[key]) }));
  const salah = items.filter((p) => SALAH_KEYS.includes(p.key));

  let next = salah.find((p) => p.at > now);
  if (!next) {
    const tmr = addDays(base, 1);
    next = { key: "Fajr", name: prayerName("Fajr", tmr), at: atTime(tmr, (tomorrow ?? today).Fajr) };
  }

  let previous = [...salah].reverse().find((p) => p.at <= now);
  if (!previous) {
    const ystd = addDays(base, -1);
    previous = { key: "Isha", name: prayerName("Isha", ystd), at: atTime(ystd, today.Isha) };
  }

  return { items, next, previous };
}

// ---------------------------------------------------------------- formatting

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

export function digits(text: string | number, numerals: Numerals): string {
  const s = String(text);
  return numerals === "en" ? s : s.replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

export function formatClock(
  d: Date,
  fmt: ClockFormat,
  numerals: Numerals,
  withSeconds = false,
): { time: string; period: string } {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const sec = withSeconds ? `:${String(d.getSeconds()).padStart(2, "0")}` : "";
  if (fmt === "24") return { time: digits(`${String(h).padStart(2, "0")}:${m}${sec}`, numerals), period: "" };
  const period = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return { time: digits(`${h}:${m}${sec}`, numerals), period };
}

export function formatCountdown(ms: number, numerals: Numerals): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return digits(h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`, numerals);
}

export function formatDates(d: Date, hijriOffset: number, numerals: Numerals) {
  const weekday = new Intl.DateTimeFormat("ar-EG", { weekday: "long" }).format(d);
  const gregorian = new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);

  const hijriParts = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura-nu-latn", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(addDays(d, hijriOffset));
  const part = (type: string) => hijriParts.find((p) => p.type === type)?.value ?? "";
  const hijri = `${part("day")} ${part("month")} ${part("year")} ${part("era") || "هـ"}`;

  return { weekday, gregorian: digits(gregorian, numerals), hijri: digits(hijri, numerals) };
}
