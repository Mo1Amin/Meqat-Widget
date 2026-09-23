/**
 * Azan recordings bundled with the app (public/azan/*.mp3), so every voice
 * works offline. Recordings come from the Kiwifu/adhan-mp3 collection and were
 * re-encoded to mono and loudness-normalised so switching voices never jumps
 * in volume.
 */
export interface Voice {
  id: string;
  name: string;
  /** A Fajr recording, which includes «الصلاة خير من النوم». */
  fajr?: boolean;
  note?: string;
}

export const VOICES: Voice[] = [
  { id: "classic", name: "الأذان الأصلي" },
  { id: "qatami", name: "ناصر القطامي" },
  { id: "dosari", name: "ياسر الدوسري" },
  { id: "refaat", name: "محمد رفعت", note: "تسجيل تاريخي" },
  { id: "minshawi", name: "محمد صديق المنشاوي" },
  { id: "abdulbasit", name: "عبد الباسط عبد الصمد" },
  { id: "afasy", name: "مشاري راشد العفاسي" },
  { id: "makkah", name: "علي أحمد ملا — الحرم المكي" },
  { id: "fajr-abdulbasit", name: "عبد الباسط عبد الصمد", fajr: true },
  { id: "fajr-afasy", name: "مشاري راشد العفاسي", fajr: true },
  { id: "fajr-toubar", name: "نصر الدين طوبار", fajr: true },
  { id: "fajr-makkah", name: "الحرم المكي", fajr: true, note: "تسجيل قديم" },
];

const known = new Set(VOICES.map((v) => v.id));

export function voiceSrc(id: string): string {
  return `/azan/${known.has(id) ? id : "classic"}.mp3`;
}

/** The recording to play for a prayer, honouring the separate Fajr choice. */
export function azanSrcFor(prayerKey: string, azanVoice: string, fajrVoice: string): string {
  if (prayerKey === "Fajr" && fajrVoice !== "same") return voiceSrc(fajrVoice);
  return voiceSrc(azanVoice);
}
