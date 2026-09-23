// Builds the offline data the widgets ship with. Run with `node scripts/build-data.mjs`
// whenever the sources or the fix list below change; the outputs are committed.
//
//   src/data/azkar.json   Hisn al-Muslim adhkar, cleaned and corrected
//   public/data/quran.json  the full Qur'an (Tanzil Uthmani) for the ayah widget
//
// Sources
//   adhkar : https://github.com/nawafalqari/azkar-api (src/data/adkar.json)
//   Qur'an : Tanzil Uthmani text, via https://api.alquran.cloud/v1/quran/quran-uthmani
//            Tanzil's terms: the text may be used freely as long as it is not changed
//            and the source is credited — so the Qur'an text is never edited here, only
//            the basmala prefix that the API glues to verse 1 is split off.
import { mkdir, writeFile } from "node:fs/promises";

const ADHKAR_URL = "https://raw.githubusercontent.com/nawafalqari/azkar-api/HEAD/src/data/adkar.json";
const QURAN_URL = "https://api.alquran.cloud/v1/quran/quran-uthmani";

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
};

const TASHKEEL = /[ً-ٰٟۖ-ۭ]/g;

// ------------------------------------------------------------------ Qur'an

const quranRaw = (await getJson(QURAN_URL)).data.surahs;
const BASMALA_WORDS = 4;

const surahs = quranRaw.map((s) => {
  const ayahs = s.ayahs.map((a) => a.text);
  // The API prefixes verse 1 of every surah except al-Fatiha and at-Tawba with the
  // basmala. It is not part of the verse, so it is split off (whole words only).
  if (s.number !== 1 && s.number !== 9 && ayahs[0].startsWith("بِسْمِ")) {
    ayahs[0] = ayahs[0].split(" ").slice(BASMALA_WORDS).join(" ");
  }
  return {
    name: s.name.replace(/^سُورَةُ\s+/, "").replace(TASHKEEL, ""),
    ayahs,
  };
});

const total = surahs.reduce((n, s) => n + s.ayahs.length, 0);
if (surahs.length !== 114 || total !== 6236) throw new Error(`unexpected Qur'an shape: ${surahs.length}/${total}`);

// Verses that read well on their own. Each entry is surah:first[-last].
const CURATED = `
2:152 2:153 2:186 2:201 2:286 3:8 3:26 3:139 3:159 3:173 3:185 3:190 6:59 6:162 7:56 8:46
9:51 11:88 12:87 13:11 13:28 14:7 15:49 16:18 16:97 16:128 17:24 17:82 18:10 18:46
20:25-28 20:46 20:114 21:87 23:1-2 24:35 25:63 28:24 29:45 29:69 33:41-42 35:15 39:10 39:53
40:44 40:60 41:34 42:19 50:16 51:56 55:13 57:4 57:20 59:18 64:11 65:3 67:1-2 76:9 93:3-5
94:5-8 99:7-8 103:1-3 112:1-4
`
  .trim()
  .split(/\s+/)
  .map((ref) => {
    const [s, range] = ref.split(":");
    const [from, to = from] = range.split("-").map(Number);
    const surah = surahs[Number(s) - 1];
    if (!surah || to > surah.ayahs.length || from < 1) throw new Error(`bad reference ${ref}`);
    return [Number(s), from, to];
  });

await mkdir("public/data", { recursive: true });
await writeFile("public/data/quran.json", JSON.stringify({ surahs, curated: CURATED }));

// ------------------------------------------------------------------ adhkar

const raw = await getJson(ADHKAR_URL);

// Typos in the source text, fixed by exact match so an unexpected upstream
// change fails loudly instead of silently skipping a correction.
const FIXES = [
  ["أَعـوذُبِكَ", "أَعـوذُ بِكَ"],
  ["وَأَنَّ ُ مُحَمّـداً", "وَأَنَّ مُحَمّـداً"],
  ["أَصْبَـحْـنا وَأَصْبَـحْ المُـلكُ", "أَصْبَـحْـنا وَأَصْبَـحَ المُـلكُ"],
  ["عَلَى كُلِّ شَيْءِ قَدِيرِ", "عَلَى كُلِّ شَيْءٍ قَدِيرٌ"],
  ["عَلَى كُلُّ شَيْءِ قَدِيرِ", "عَلَى كُلِّ شَيْءٍ قَدِيرٌ"],
  ["أَسْـتَغْفِرُ الله.اللّهُـمَّ", "أَسْـتَغْفِرُ الله. اللّهُـمَّ"],
  ["اللّهُـمَّ إِنَّـي أَسْـأَلُـكَ العـافِـيَة", "اللّهُـمَّ إِنِّـي أَسْـأَلُـكَ العـافِـيَة"],
  ["وَأَلْـجَـاْتُ", "وَأَلْـجَـأْتُ"],
  ["الْلَّه", "اللَّه"],
];

// Whole-entry replacements where the source is incomplete or has several errors.
const REPLACE = {
  // The source drops the second half of the morning version.
  "أذكار الصباح#0":
    "أَصْبَحْنا وَأَصْبَحَ المُلْكُ للهِ، وَالحَمْدُ للهِ، لا إِلَهَ إِلَّا اللهُ وَحْدَهُ لا شَرِيكَ لَهُ، لَهُ المُلْكُ وَلَهُ الحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ ما فِي هَذا اليَوْمِ وَخَيْرَ ما بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ ما فِي هَذا اليَوْمِ وَشَرِّ ما بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الكَسَلِ وَسُوءِ الكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذابٍ فِي النّارِ وَعَذابٍ فِي القَبْرِ.",
  // Five separate typos in the source (إِنَّي، هَذَه، فيهِا، وَشَرَّ، الْعَالَمَيْنِ).
  "أذكار المساء#14":
    "أَمْسَيْنا وَأَمْسَى المُلْكُ للهِ رَبِّ العالَمِينَ، اللَّهُمَّ إِنِّي أَسْأَلُكَ خَيْرَ هَذِهِ اللَّيْلَةِ: فَتْحَها، وَنَصْرَها، وَنُورَها، وَبَرَكَتَها، وَهُداها، وَأَعُوذُ بِكَ مِنْ شَرِّ ما فِيها وَشَرِّ ما بَعْدَها.",
};

const CATEGORIES = {
  "أذكار الصباح": "morning",
  "أذكار المساء": "evening",
  "أذكار بعد السلام من الصلاة المفروضة": "afterPrayer",
  "أذكار النوم": "sleep",
  "أذكار الاستيقاظ": "waking",
  "تسابيح": "tasbih",
};

const tidy = (s) =>
  s
    .replace(/ـ/g, "") // tatweel is decoration only
    .replace(/\s*[,،]\s*/g, "، ")
    .replace(/\s+([.:])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const used = new Set();
const applyFixes = (s) => {
  // NFC puts stacked marks (shadda + kasra) in one canonical order, so a fix
  // typed on another keyboard still matches.
  let out = s.normalize("NFC").replace(/\s+/g, " ");
  for (const [rawFrom, to] of FIXES) {
    const from = rawFrom.normalize("NFC");
    if (out.includes(from)) {
      out = out.split(from).join(to.normalize("NFC"));
      used.add(rawFrom);
    }
  }
  return out;
};

const azkar = {};
for (const [arabic, key] of Object.entries(CATEGORIES)) {
  const list = raw[arabic];
  if (!Array.isArray(list)) throw new Error(`missing category ${arabic}`);
  azkar[key] = list.map((z, i) => {
    const replaced = REPLACE[`${arabic}#${i}`];
    return {
      text: tidy(replaced ?? applyFixes(z.content)),
      count: Math.max(1, parseInt(z.count, 10) || 1),
      note: tidy(applyFixes(z.description ?? "")),
    };
  });
}

const unused = FIXES.map(([f]) => f).filter((f) => !used.has(f));
if (unused.length) throw new Error(`fixes that matched nothing (source changed?): ${unused.join(" | ")}`);

// Qur'anic adhkar come from the Tanzil text above rather than from the adhkar
// source, so every verse shown anywhere in the app is the same verified text.
const verse = (s, a) => surahs[s - 1].ayahs[a - 1];
const surahText = (s) => surahs[s - 1].ayahs.join(" ");
const kursi = { text: verse(2, 255), count: 1, note: "آية الكرسي", quran: true };
const quls = [112, 113, 114].map((s) => ({
  text: `${verse(1, 1)} ${surahText(s)}`,
  count: 3,
  note: `سورة ${surahs[s - 1].name}`,
  quran: true,
}));
azkar.morning.unshift(kursi, ...quls);
azkar.evening.unshift(kursi, ...quls);
azkar.afterPrayer.splice(4, 0, { ...kursi });
azkar.sleep.unshift({ ...kursi }, ...quls);

await mkdir("src/data", { recursive: true });
await writeFile("src/data/azkar.json", JSON.stringify(azkar, null, 1));

console.log(
  "quran:",
  total,
  "ayahs,",
  CURATED.length,
  "curated | azkar:",
  Object.entries(azkar)
    .map(([k, v]) => `${k}=${v.length}`)
    .join(" "),
);
