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
  type Place,
  type Settings,
} from "./settings";
import { searchPlaces } from "./places";
import { digits } from "./prayer";
import { autostart, isTauri } from "./native";
import { PinIcon, PlayIcon, StopIcon } from "./icons";
import "./settings.css";

export default function SettingsWindow() {
  const [s, setS] = useState<Settings>(loadSettings);
  const [launchAtLogin, setLaunchAtLogin] = useState(false);
  const [version, setVersion] = useState("");

  useEffect(() => onSettingsChanged(setS), []);
  useEffect(() => {
    autostart.get().then(setLaunchAtLogin);
    if (isTauri) getVersion().then(setVersion).catch(() => {});
  }, []);

  // Every change is applied immediately — there is no "save" step to forget.
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const next = { ...s, [key]: value };
    setS(next);
    saveSettings(next);
  };

  const n = (v: number | string) => digits(v, s.numerals);

  return (
    <main className="settings" dir="rtl">
      <header className="settings-head">
        <h1>الإعدادات</h1>
        <p>كل تغيير بيتطبّق على الويدجت فورًا.</p>
      </header>

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

      <Section title="المظهر">
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
        <Row label="الحجم" value={`${n(Math.round(s.scale * 100))}٪`}>
          <input
            type="range"
            min={0.7}
            max={1.6}
            step={0.05}
            value={s.scale}
            onChange={(e) => update("scale", Number(e.target.value))}
          />
        </Row>
        <Row label="عتامة الخلفية" value={`${n(Math.round(s.opacity * 100))}٪`}>
          <input
            type="range"
            min={0}
            max={0.95}
            step={0.05}
            value={s.opacity}
            onChange={(e) => update("opacity", Number(e.target.value))}
          />
        </Row>
      </Section>

      <Section title="التنبيهات">
        <Row label="صوت الأذان">
          <Toggle checked={s.azanEnabled} onChange={(v) => update("azanEnabled", v)} />
        </Row>
        <Row label="مستوى الصوت" value={`${n(Math.round(s.volume * 100))}٪`}>
          <div className="volume">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              disabled={!s.azanEnabled}
              onChange={(e) => update("volume", Number(e.target.value))}
            />
            <PreviewButton volume={s.volume} disabled={!s.azanEnabled} />
          </div>
        </Row>
        <Row label="إشعارات ويندوز" hint="إشعار وقت الأذان حتى لو الويدجت مخفي">
          <Toggle checked={s.notify} onChange={(v) => update("notify", v)} />
        </Row>
        <Row label="تذكير قبل الأذان">
          <select
            value={s.reminderMinutes}
            disabled={!s.notify}
            onChange={(e) => update("reminderMinutes", Number(e.target.value))}
          >
            <option value={0}>بدون تذكير</option>
            {[5, 10, 15, 20, 30].map((m) => (
              <option key={m} value={m}>
                قبلها بـ {n(m)} دقيقة
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="النافذة">
        <Row label="فوق كل النوافذ">
          <Toggle checked={s.alwaysOnTop} onChange={(v) => update("alwaysOnTop", v)} />
        </Row>
        <Row label="تثبيت المكان" hint="يمنع تحريك الويدجت بالغلط">
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

      <footer className="settings-foot">
        <span>مِيقَات {version && n(version)}</span>
        <button
          className="link-btn"
          onClick={() => {
            const next = { ...DEFAULT_SETTINGS, place: s.place, method: s.method, school: s.school };
            setS(next);
            saveSettings(next);
          }}
        >
          استرجاع الشكل الافتراضي
        </button>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------- pieces

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2>{title}</h2>
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

function PreviewButton({ volume, disabled }: { volume: number; disabled: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(() => () => audio.current?.pause(), []);
  useEffect(() => {
    if (disabled && audio.current) {
      audio.current.pause();
      setPlaying(false);
    }
  }, [disabled]);

  const toggle = () => {
    audio.current ??= new Audio("/azan.mp3");
    const a = audio.current;
    if (playing) {
      a.pause();
      a.currentTime = 0;
      setPlaying(false);
    } else {
      a.volume = volume;
      a.onended = () => setPlaying(false);
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  return (
    <button className="icon-pill" onClick={toggle} disabled={disabled} title={playing ? "إيقاف" : "تجربة الصوت"}>
      {playing ? <StopIcon /> : <PlayIcon />}
      <span>{playing ? "إيقاف" : "تجربة"}</span>
    </button>
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
