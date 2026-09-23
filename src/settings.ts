import { emit, listen } from "@tauri-apps/api/event";
import { isTauri } from "./native";

export type Layout = "full" | "compact" | "prayers";
export type Numerals = "ar" | "en";
export type ClockFormat = "12" | "24";

export interface Place {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

export interface Settings {
  // Location & calculation
  place: Place;
  method: number;
  school: 0 | 1;
  hijriOffset: number;

  // Appearance
  layout: Layout;
  accent: string;
  font: string;
  numerals: Numerals;
  clockFormat: ClockFormat;
  showSeconds: boolean;
  scale: number;
  opacity: number;

  // Behaviour
  alwaysOnTop: boolean;
  lockPosition: boolean;

  // Alerts
  azanEnabled: boolean;
  volume: number;
  notify: boolean;
  reminderMinutes: number;
}

export const DEFAULT_SETTINGS: Settings = {
  place: { name: "القاهرة", region: "مصر", latitude: 30.0444, longitude: 31.2357 },
  method: 5,
  school: 0,
  hijriOffset: 0,

  layout: "full",
  accent: "#dde3c6",
  font: "cairo",
  numerals: "ar",
  clockFormat: "12",
  showSeconds: false,
  scale: 1,
  opacity: 0.5,

  alwaysOnTop: false,
  lockPosition: false,

  azanEnabled: true,
  volume: 0.8,
  notify: true,
  reminderMinutes: 10,
};

export const FONTS: Record<string, { label: string; family: string }> = {
  cairo: { label: "القاهرة — عصري", family: "'Cairo', sans-serif" },
  almarai: { label: "المراعي — بسيط", family: "'Almarai', sans-serif" },
  amiri: { label: "الأميري — نسخ", family: "'Amiri', serif" },
  ruqaa: { label: "الرقعة — كلاسيكي", family: "'Aref Ruqaa', serif" },
};

export const ACCENTS = ["#dde3c6", "#f5d38a", "#8fd3c1", "#9cc4ff", "#f4a7b9", "#ffffff"];

/** Calculation methods as numbered by the Aladhan API. */
export const METHODS: { id: number; label: string }[] = [
  { id: 5, label: "الهيئة المصرية العامة للمساحة" },
  { id: 4, label: "أم القرى — مكة المكرمة" },
  { id: 3, label: "رابطة العالم الإسلامي" },
  { id: 2, label: "أمريكا الشمالية (ISNA)" },
  { id: 1, label: "جامعة العلوم الإسلامية — كراتشي" },
  { id: 8, label: "منطقة الخليج" },
  { id: 9, label: "الكويت" },
  { id: 10, label: "قطر" },
  { id: 16, label: "دبي" },
  { id: 13, label: "رئاسة الشؤون الدينية — تركيا" },
  { id: 12, label: "اتحاد المنظمات الإسلامية — فرنسا" },
];

const STORAGE_KEY = "miqat.settings";
const CHANGED_EVENT = "miqat://settings-changed";

/** Pulls the scattered keys used by v1.2 into the new single settings object. */
function migrateLegacy(): Partial<Settings> {
  const out: Partial<Settings> = {};
  const scale = parseFloat(localStorage.getItem("widgetScale") ?? "");
  if (!Number.isNaN(scale)) out.scale = scale;
  const color = localStorage.getItem("widgetColor");
  if (color) out.accent = color;
  const font = localStorage.getItem("widgetFont");
  if (font?.includes("Aref")) out.font = "ruqaa";
  else if (font?.includes("Amiri")) out.font = "amiri";
  const onTop = localStorage.getItem("alwaysOnTop");
  if (onTop) out.alwaysOnTop = onTop === "true";
  const numerals = localStorage.getItem("numeralType");
  if (numerals === "ar" || numerals === "en") out.numerals = numerals;
  const clock = localStorage.getItem("timeFormat");
  if (clock === "12" || clock === "24") out.clockFormat = clock;
  return out;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_SETTINGS, ...migrateLegacy() };
}

/** Persists settings and tells every other window about the change. */
export async function saveSettings(settings: Settings): Promise<void> {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  if (isTauri) await emit(CHANGED_EVENT, settings);
}

export function onSettingsChanged(handler: (s: Settings) => void): () => void {
  if (isTauri) {
    const off = listen<Settings>(CHANGED_EVENT, (e) => handler({ ...DEFAULT_SETTINGS, ...e.payload }));
    return () => void off.then((fn) => fn());
  }
  // Browser preview: two tabs talk through the storage event instead.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) handler(loadSettings());
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function fontFamily(key: string): string {
  return (FONTS[key] ?? FONTS.cairo).family;
}
