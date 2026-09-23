import azkarData from "./data/azkar.json";
import type { AyahSource, AzkarMode } from "./settings";
import type { DayTimings } from "./prayer";

// ---------------------------------------------------------------- adhkar

export type AzkarCategory = Exclude<AzkarMode, "auto">;

export interface Zikr {
  text: string;
  count: number;
  note: string;
  /** Qur'anic text, shown in the mushaf font. */
  quran?: boolean;
}

export const AZKAR = azkarData as Record<AzkarCategory, Zikr[]>;

export const AZKAR_TITLES: Record<AzkarCategory, string> = {
  morning: "أذكار الصباح",
  evening: "أذكار المساء",
  afterPrayer: "أذكار بعد الصلاة",
  sleep: "أذكار النوم",
  waking: "أذكار الاستيقاظ",
  tasbih: "تسابيح",
};

const AFTER_PRAYER_MINUTES = 20;

const at = (day: Date, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
};

/**
 * Which adhkar suit this moment: the after-prayer set right after each prayer,
 * morning adhkar from Fajr until Dhuhr, evening adhkar from Asr until Isha,
 * sleep adhkar through the night, and general tasbih in between.
 */
export function azkarForNow(now: Date, t: DayTimings | null): AzkarCategory {
  if (!t) {
    const h = now.getHours();
    if (h >= 4 && h < 12) return "morning";
    if (h >= 15 && h < 20) return "evening";
    if (h >= 21 || h < 4) return "sleep";
    return "tasbih";
  }
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  for (const k of ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const) {
    const start = at(day, t[k]);
    const end = new Date(start.getTime() + AFTER_PRAYER_MINUTES * 60_000);
    if (now >= start && now < end) return "afterPrayer";
  }
  if (now < at(day, t.Fajr)) return "sleep";
  if (now < at(day, t.Dhuhr)) return "morning";
  if (now < at(day, t.Asr)) return "tasbih";
  if (now < at(day, t.Isha)) return "evening";
  return "sleep";
}

// ---------------------------------------------------------------- Qur'an

interface QuranData {
  surahs: { name: string; ayahs: string[] }[];
  curated: [number, number, number][];
}

let quranPromise: Promise<QuranData> | null = null;

/** The whole mushaf is 1.3 MB, so it is only loaded by the window that shows it. */
export function loadQuran(): Promise<QuranData> {
  quranPromise ??= fetch("/data/quran.json").then((r) => {
    if (!r.ok) throw new Error(`quran.json ${r.status}`);
    return r.json();
  });
  return quranPromise;
}

export interface Passage {
  surah: number;
  from: number;
  to: number;
}

export interface RenderedPassage extends Passage {
  surahName: string;
  ayahs: string[];
}

export function renderPassage(q: QuranData, p: Passage): RenderedPassage {
  const s = q.surahs[p.surah - 1];
  return {
    ...p,
    surahName: s.name,
    // «۞» marks a hizb quarter in the printed mushaf; it means nothing on its own.
    ayahs: s.ayahs.slice(p.from - 1, p.to).map((a) => a.replace(/^۞\s*/, "")),
  };
}

function hash(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Verses long enough to stand alone and short enough to fit a widget. */
function standalone(q: QuranData): Passage[] {
  const out: Passage[] = [];
  q.surahs.forEach((s, si) =>
    s.ayahs.forEach((a, ai) => {
      if (a.length >= 50 && a.length <= 380) out.push({ surah: si + 1, from: ai + 1, to: ai + 1 });
    }),
  );
  return out;
}

let standaloneCache: Passage[] | null = null;

/**
 * Picks the passage for a given slot. `slot` is the number of intervals since
 * the epoch, so every window and every restart agrees on the same verse, and
 * «once a day» is simply a one-day interval.
 */
export function pickPassage(q: QuranData, source: AyahSource, slot: number): Passage {
  if (source === "all") {
    standaloneCache ??= standalone(q);
    return standaloneCache[hash(slot) % standaloneCache.length];
  }
  const [surah, from, to] = q.curated[hash(slot) % q.curated.length];
  return { surah, from, to };
}

// Sequential reading («ورد») keeps its place across restarts.
const POS_KEY = "miqat.ayah.position";

export function readPosition(): Passage {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) ?? "");
    if (p && p.surah >= 1 && p.from >= 1) return { surah: p.surah, from: p.from, to: p.from };
  } catch {
    /* start from the beginning */
  }
  return { surah: 1, from: 1, to: 1 };
}

export function advancePosition(q: QuranData, p: Passage, by: 1 | -1 = 1): Passage {
  let surah = p.surah;
  let ayah = p.from + by;
  if (ayah > q.surahs[surah - 1].ayahs.length) {
    surah = surah === 114 ? 1 : surah + 1;
    ayah = 1;
  } else if (ayah < 1) {
    surah = surah === 1 ? 114 : surah - 1;
    ayah = q.surahs[surah - 1].ayahs.length;
  }
  const next = { surah, from: ayah, to: ayah };
  localStorage.setItem(POS_KEY, JSON.stringify(next));
  return next;
}

export const slotFor = (now: Date, intervalSec: number) => {
  if (intervalSec >= 86_400) {
    // Daily: count local days so the verse changes at midnight, not at UTC midnight.
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return Math.round((day.getTime() - new Date(2024, 0, 1).getTime()) / 86_400_000);
  }
  return Math.floor(now.getTime() / 1000 / Math.max(intervalSec, 60));
};
