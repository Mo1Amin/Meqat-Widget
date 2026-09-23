import { useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  FONTS,
  METHODS,
  loadSettings,
  onSettingsChanged,
  saveSettings,
  type AyahWidget,
  type AzkarWidget,
  type Place,
  type Settings,
} from "./settings";
import { searchPlaces } from "./places";
import { digits } from "./prayer";
import { AZKAR_TITLES } from "./content";
import { VOICES, voiceSrc } from "./voices";
import { autostart, isTauri, onTabRequested, takeRequestedTab } from "./native";
import { PinIcon, PlayIcon, StopIcon } from "./icons";
import "./settings.css";

const TABS = [
  ["widgets", "الويدجتس"],
  ["times", "المواقيت"],
  ["look", "المظهر"],
  ["azan", "الأذان"],
  ["general", "عام"],
] as const;
type Tab = (typeof TABS)[number][0];

const isTab = (t: string | null): t is Tab => TABS.some(([id]) => id === t);

export default function SettingsWindow() {
  const [s, setS] = useState<Settings>(loadSettings);
  const [tab, setTab] = useState<Tab>(() => {
    const requested = takeRequestedTab();
    return isTab(requested) ? requested : "widgets";
  });
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [version, setVersion] = useState("");
  const preview = usePreview(s.volume);

  useEffect(() => onSettingsChanged(setS), []);
  useEffect(() => onTabRequested((t) => isTab(t) && setTab(t)), []);
  useEffect(() => {
    autostart.get().then(setLaunchAtLogin);
    if (isTauri) getVersion().then(setVersion).catch(() => {});
  }, []);
  // Leaving the azan tab stops any voice being previewed.
  useEffect(() => {
    if (tab !== "azan") preview.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Every change is applied immediately — there is no "save" step to forget.
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...s, [key]: value };
    setS(next);
    saveSettings(next);
  };
  const updateAzkar = (patch: Partial<AzkarWidget>) => update("azkar", { ...s.azkar, ...patch });
  const updateAyah = (patch: Partial<AyahWidget>) => update("ayah", { ...s.ayah, ...patch });

  const n = (v: number | string) => digits(v, s.numerals);
  const pct = (v: number) => `${n(Math.round(v * 100))}٪`;

  return (
    <main className="settings" dir="rtl">
      <header className="settings-head">
        <h1>الإعدادات</h1>
        <nav className="tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "widgets" && (
        <>
          <p className="tab-intro">اختار الويدجتس اللي تظهر على سطح المكتب. كل ويدجت بيتسحب لمكانه لوحده، وكليك يمين عليه بيفتح إعداداته.</p>

          <WidgetCard
            glyph="١٢"
            title="مواقيت الصلاة"
            description="الساعة والتاريخ والعدّ التنازلي للصلاة الجاية."
            fixed
            onCustomize={() => setTab("look")}
          />

          <WidgetCard
            glyph="ذ"
            title="الأذكار"
            description="أذكار الصباح والمساء وبعد الصلاة والنوم من حصن المسلم، بتتغير لوحدها."
            enabled={s.azkar.enabled}
            onToggle={(v) => updateAzkar({ enabled: v })}
          >
            <Row label="النوع" hint={s.azkar.mode === "auto" ? "صباح بعد الفجر، مساء بعد العصر، وبعد كل صلاة" : undefined}>
              <select value={s.azkar.mode} onChange={(e) => updateAzkar({ mode: e.target.value as AzkarWidget["mode"] })}>
                <option value="auto">تلقائي حسب الوقت</option>
                {Object.entries(AZKAR_TITLES).map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="التبديل" hint="بيقف لما الماوس يكون عليه">
              <select value={s.azkar.interval} onChange={(e) => updateAzkar({ interval: Number(e.target.value) })}>
                <option value={15}>كل {n(15)} ثانية</option>
                <option value={30}>كل {n(30)} ثانية</option>
                <option value={60}>كل دقيقة</option>
                <option value={120}>كل دقيقتين</option>
                <option value={300}>كل {n(5)} دقائق</option>
                <option value={0}>يدويًا فقط</option>
              </select>
            </Row>
            <Row label="فضل الذكر">
              <Toggle checked={s.azkar.showNote} onChange={(v) => updateAzkar({ showNote: v })} />
            </Row>
            <LookRows value={s.azkar} onChange={updateAzkar} pct={pct} widthRange={[16, 40]} />
          </WidgetCard>

          <WidgetCard
            glyph="﴿﴾"
            title="آيات قرآنية"
            description="آية بالرسم العثماني تتجدد لوحدها، أو ورد بالترتيب يكمّل من مكانه."
            enabled={s.ayah.enabled}
            onToggle={(v) => updateAyah({ enabled: v })}
          >
            <Row
              label="المصدر"
              hint={
                s.ayah.source === "curated"
                  ? "آيات مختارة تُقرأ لوحدها"
                  : s.ayah.source === "all"
                    ? "أي آية من المصحف"
                    : "آية بعد آية، ويكمّل من مكانه"
              }
            >
              <Segmented
                value={s.ayah.source}
                onChange={(v) => updateAyah({ source: v })}
                options={[
                  ["curated", "مختارة"],
                  ["all", "المصحف كله"],
                  ["sequential", "بالترتيب"],
                ]}
              />
            </Row>
            <Row label="التبديل">
              <select value={s.ayah.interval} onChange={(e) => updateAyah({ interval: Number(e.target.value) })}>
                <option value={60}>كل دقيقة</option>
                <option value={300}>كل {n(5)} دقائق</option>
                <option value={900}>كل ربع ساعة</option>
                <option value={1800}>كل نص ساعة</option>
                <option value={3600}>كل ساعة</option>
                <option value={86400}>آية اليوم</option>
                <option value={0}>يدويًا فقط</option>
              </select>
            </Row>
            <Row label="اسم السورة ورقم الآية">
              <Toggle checked={s.ayah.showRef} onChange={(v) => updateAyah({ showRef: v })} />
            </Row>
            <LookRows value={s.ayah} onChange={updateAyah} pct={pct} widthRange={[18, 44]} />
          </WidgetCard>
        </>
      )}

      {tab === "times" && (
        <Section title="الموقع والحساب">
          <PlacePicker place={s.place} onPick={(p) => update("place", p)} />
          <Row label="طريقة الحساب">
            <select value={s.method} onChange={(e) => update("method", Number(e.target.value))}>
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="وقت العصر">
            <Segmented
              value={s.school}
              onChange={(v) => update("school", v)}
              options={[
                [0, "الجمهور"],
                [1, "الحنفي"],
              ]}
            />
          </Row>
          <Row label="تصحيح التاريخ الهجري" hint="لو التقويم متقدّم أو متأخر يوم عن بلدك">
            <Stepper
              value={s.hijriOffset}
              min={-2}
              max={2}
              format={(v) => (v === 0 ? "بدون" : `${v > 0 ? "+" : "−"}${n(Math.abs(v))} يوم`)}
              onChange={(v) => update("hijriOffset", v)}
            />
          </Row>
        </Section>
      )}

      {tab === "look" && (
        <>
          <Section title="ويدجت المواقيت">
            <Row label="الشكل">
              <Segmented
                value={s.layout}
                onChange={(v) => update("layout", v)}
                options={[
                  ["full", "كامل"],
                  ["compact", "مصغّر"],
                  ["prayers", "المواقيت فقط"],
                ]}
              />
            </Row>
            <Row label="الحجم" value={pct(s.scale)}>
              <input type="range" min={0.7} max={1.6} step={0.05} value={s.scale} onChange={(e) => update("scale", Number(e.target.value))} />
            </Row>
            <Row label="حجم اسم اليوم" value={pct(s.weekdaySize)} hint="في الشكل الكامل">
              <input
                type="range"
                min={0.6}
                max={1.6}
                step={0.05}
                value={s.weekdaySize}
                disabled={s.layout !== "full"}
                onChange={(e) => update("weekdaySize", Number(e.target.value))}
              />
            </Row>
            <Row label="حجم التاريخ" value={pct(s.dateSize)} hint="الهجري والميلادي تحت اليوم">
              <input
                type="range"
                min={0.7}
                max={1.6}
                step={0.05}
                value={s.dateSize}
                disabled={s.layout !== "full"}
                onChange={(e) => update("dateSize", Number(e.target.value))}
              />
            </Row>
            <Row label="عتامة الخلفية" value={pct(s.opacity)}>
              <input type="range" min={0} max={0.95} step={0.05} value={s.opacity} onChange={(e) => update("opacity", Number(e.target.value))} />
            </Row>
          </Section>

          <Section title="للكل">
            <Row label="اللون">
              <div className="swatches">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    className={`swatch${s.accent.toLowerCase() === c ? " is-on" : ""}`}
                    style={{ background: c }}
                    onClick={() => update("accent", c)}
                    aria-label={c}
                  />
                ))}
                <label className="swatch custom" title="لون مخصص">
                  <input type="color" value={s.accent} onChange={(e) => update("accent", e.target.value)} />
                </label>
              </div>
            </Row>
            <Row label="الخط">
              <select value={s.font} onChange={(e) => update("font", e.target.value)}>
                {Object.entries(FONTS).map(([k, f]) => (
                  <option key={k} value={k} style={{ fontFamily: f.family }}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Row>
            <Row label="الأرقام">
              <Segmented
                value={s.numerals}
                onChange={(v) => update("numerals", v)}
                options={[
                  ["ar", "١٢٣"],
                  ["en", "123"],
                ]}
              />
            </Row>
            <Row label="نظام الساعة">
              <Segmented
                value={s.clockFormat}
                onChange={(v) => update("clockFormat", v)}
                options={[
                  ["12", "١٢ ساعة"],
                  ["24", "٢٤ ساعة"],
                ]}
              />
            </Row>
            <Row label="إظهار الثواني">
              <Toggle checked={s.showSeconds} onChange={(v) => update("showSeconds", v)} />
            </Row>
          </Section>
        </>
      )}

      {tab === "azan" && (
        <>
          <Section title="التشغيل">
            <Row label="صوت الأذان">
              <Toggle checked={s.azanEnabled} onChange={(v) => update("azanEnabled", v)} />
            </Row>
            <Row label="مستوى الصوت" value={pct(s.volume)}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={s.volume}
                disabled={!s.azanEnabled}
                onChange={(e) => update("volume", Number(e.target.value))}
              />
            </Row>
          </Section>

          <Section title="المؤذّن">
            <VoiceList
              voices={VOICES.filter((v) => !v.fajr)}
              selected={s.azanVoice}
              onSelect={(id) => update("azanVoice", id)}
              preview={preview}
              numerals={s.numerals}
            />
          </Section>

          <Section title="أذان الفجر" hint="تسجيلات فيها «الصلاة خير من النوم»">
            <VoiceList
              voices={[{ id: "same", name: "نفس صوت الأذان" }, ...VOICES.filter((v) => v.fajr)]}
              selected={s.fajrVoice}
              onSelect={(id) => update("fajrVoice", id)}
              preview={preview}
              numerals={s.numerals}
            />
          </Section>

          <Section title="التنبيهات">
            <Row label="إشعارات ويندوز" hint="إشعار وقت الأذان حتى لو الويدجت مخفي">
              <Toggle checked={s.notify} onChange={(v) => update("notify", v)} />
            </Row>
            <Row label="تذكير قبل الأذان">
              <select value={s.reminderMinutes} disabled={!s.notify} onChange={(e) => update("reminderMinutes", Number(e.target.value))}>
                <option value={0}>بدون تذكير</option>
                {[5, 10, 15, 20, 30].map((m) => (
                  <option key={m} value={m}>
                    قبلها بـ {n(m)} دقيقة
                  </option>
                ))}
              </select>
            </Row>
          </Section>
        </>
      )}

      {tab === "general" && (
        <>
          <Section title="النوافذ">
            <Row label="فوق كل النوافذ">
              <Toggle checked={s.alwaysOnTop} onChange={(v) => update("alwaysOnTop", v)} />
            </Row>
            <Row label="تثبيت المكان" hint="يمنع تحريك الويدجتس بالغلط">
              <Toggle checked={s.lockPosition} onChange={(v) => update("lockPosition", v)} />
            </Row>
            <Row label="التشغيل مع ويندوز">
              <Toggle
                checked={launchAtLogin}
                onChange={async (v) => {
                  await autostart.set(v);
                  setLaunchAtLogin(await autostart.get());
                }}
              />
            </Row>
          </Section>

          <Section title="المصادر">
            <p className="credits">
              مواقيت الصلاة من Aladhan، والبحث عن المدن من Open-Meteo. نص القرآن الكريم برسم المصحف العثماني من مشروع Tanzil. الأذكار من حصن المسلم.
              تسجيلات الأذان من مجموعة adhan-mp3.
            </p>
          </Section>

          <footer className="settings-foot">
            <span>مِيقَات {version && n(version)}</span>
            <button
              className="link-btn"
              onClick={() => {
                const next = { ...DEFAULT_SETTINGS, place: s.place, method: s.method, school: s.school, azkar: { ...DEFAULT_SETTINGS.azkar, enabled: s.azkar.enabled }, ayah: { ...DEFAULT_SETTINGS.ayah, enabled: s.ayah.enabled } };
                setS(next);
                saveSettings(next);
              }}
            >
              استرجاع الشكل الافتراضي
            </button>
          </footer>
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------- widgets tab

function WidgetCard({
  glyph,
  title,
  description,
  fixed,
  enabled,
  onToggle,
  onCustomize,
  children,
}: {
  glyph: string;
  title: string;
  description: string;
  fixed?: boolean;
  enabled?: boolean;
  onToggle?: (v: boolean) => void;
  onCustomize?: () => void;
  children?: React.ReactNode;
}) {
  const on = fixed || enabled;
  return (
    <section className={`widget-card${on ? " is-on" : ""}`}>
      <div className="widget-card-head">
        <span className="widget-glyph" aria-hidden>
          {glyph}
        </span>
        <div className="widget-card-text">
          <strong>{title}</strong>
          <small>{description}</small>
        </div>
        {fixed ? (
          <button className="icon-pill" onClick={onCustomize}>
            تخصيص
          </button>
        ) : (
          <button className={`add-btn${enabled ? " is-on" : ""}`} onClick={() => onToggle?.(!enabled)}>
            {enabled ? "إزالة" : "إضافة"}
          </button>
        )}
      </div>
      {!fixed && enabled && <div className="section-body widget-card-body">{children}</div>}
    </section>
  );
}

function LookRows<T extends { scale: number; width: number; opacity: number }>({
  value,
  onChange,
  pct,
  widthRange,
}: {
  value: T;
  onChange: (patch: Partial<T>) => void;
  pct: (v: number) => string;
  widthRange: [number, number];
}) {
  return (
    <>
      <Row label="الحجم" value={pct(value.scale)}>
        <input
          type="range"
          min={0.7}
          max={1.6}
          step={0.05}
          value={value.scale}
          onChange={(e) => onChange({ scale: Number(e.target.value) } as Partial<T>)}
        />
      </Row>
      <Row label="العرض">
        <input
          type="range"
          min={widthRange[0]}
          max={widthRange[1]}
          step={1}
          value={value.width}
          onChange={(e) => onChange({ width: Number(e.target.value) } as Partial<T>)}
        />
      </Row>
      <Row label="عتامة الخلفية" value={pct(value.opacity)}>
        <input
          type="range"
          min={0}
          max={0.95}
          step={0.05}
          value={value.opacity}
          onChange={(e) => onChange({ opacity: Number(e.target.value) } as Partial<T>)}
        />
      </Row>
    </>
  );
}

// ---------------------------------------------------------------- azan voices

type Preview = ReturnType<typeof usePreview>;

/** One shared player, so previewing a voice always stops the previous one. */
function usePreview(volume: number) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(() => () => audio.current?.pause(), []);

  const stop = () => {
    audio.current?.pause();
    setPlaying(null);
  };

  const toggle = (id: string) => {
    if (playing === id) return stop();
    audio.current ??= new Audio();
    const a = audio.current;
    a.pause();
    a.src = voiceSrc(id);
    a.volume = volume;
    a.onended = () => setPlaying(null);
    setPlaying(id);
    a.play().catch(() => setPlaying(null));
  };

  return { playing, toggle, stop };
}

function VoiceList({
  voices,
  selected,
  onSelect,
  preview,
}: {
  voices: { id: string; name: string; note?: string }[];
  selected: string;
  onSelect: (id: string) => void;
  preview: Preview;
  numerals: string;
}) {
  return (
    <ul className="voices" role="radiogroup">
      {voices.map((v) => {
        const isOn = v.id === selected;
        const isPlaying = preview.playing === v.id;
        return (
          <li key={v.id} className={isOn ? "is-on" : ""}>
            <button role="radio" aria-checked={isOn} className="voice-pick" onClick={() => onSelect(v.id)}>
              <span className="radio-dot" aria-hidden />
              <span className="voice-name">{v.name}</span>
              {v.note && <small>{v.note}</small>}
            </button>
            {v.id !== "same" && (
              <button className="icon-btn-s" onClick={() => preview.toggle(v.id)} title={isPlaying ? "إيقاف" : "استماع"}>
                {isPlaying ? <StopIcon /> : <PlayIcon />}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- pieces

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2>
        {title}
        {hint && <small>{hint}</small>}
      </h2>
      <div className="section-body">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  value,
  children,
}: {
  label: string;
  hint?: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="row">
      <div className="row-label">
        <span>
          {label}
          {value && <em>{value}</em>}
        </span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  );
}

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={String(v)} role="radio" aria-checked={v === value} className={v === value ? "is-on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} className={`toggle${checked ? " is-on" : ""}`} onClick={() => onChange(!checked)}>
      <i />
    </button>
  );
}

function Stepper({
  value,
  min,
  max,
  format,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="stepper">
      <button disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="زيادة">
        +
      </button>
      <span>{format(value)}</span>
      <button disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="نقص">
        −
      </button>
    </div>
  );
}

function PlacePicker({ place, onPick }: { place: Place; onPick: (p: Place) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    const id = window.setTimeout(() => {
      setStatus("loading");
      searchPlaces(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setStatus(r.length ? "idle" : "empty");
        })
        .catch((e) => {
          if (e.name !== "AbortError") setStatus("error");
        });
    }, 350);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  return (
    <div className="place">
      <div className="place-current">
        <PinIcon />
        <div>
          <strong>{place.name}</strong>
          <small>{place.region}</small>
        </div>
      </div>
      <input
        type="search"
        placeholder="ابحث عن مدينة… (مثلاً: المنصورة، الرياض، Istanbul)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {status === "loading" && <p className="place-note">جارٍ البحث…</p>}
      {status === "empty" && <p className="place-note">مفيش نتايج — جرّب تكتب الاسم بالإنجليزي.</p>}
      {status === "error" && <p className="place-note">البحث محتاج اتصال بالإنترنت.</p>}
      {results.length > 0 && (
        <ul className="place-results">
          {results.map((r) => (
            <li key={`${r.latitude},${r.longitude}`}>
              <button
                onClick={() => {
                  onPick(r);
                  setQuery("");
                }}
              >
                <strong>{r.name}</strong>
                <small>{r.region}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
