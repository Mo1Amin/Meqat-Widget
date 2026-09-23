import { useEffect, useRef, useState } from "react";
import { AZKAR, AZKAR_TITLES, azkarForNow } from "./content";
import { dayKey, digits, loadTimings, type DayTimings } from "./prayer";
import { fontFamily, loadSettings, onSettingsChanged, type Settings } from "./settings";
import { openSettings } from "./native";
import { useDesktopWidget } from "./useDesktopWidget";
import { ChevronNextIcon, ChevronPrevIcon, GearIcon } from "./icons";
import "./widget.css";
import "./extras.css";

const CATEGORY_CHECK_MS = 30_000;

export default function AzkarWidget() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [now, setNow] = useState(() => new Date());
  const [timings, setTimings] = useState<DayTimings | null>(null);
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(0);
  const [paused, setPaused] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const cfg = settings.azkar;

  useEffect(() => onSettingsChanged(setSettings), []);

  // «Automatic» follows the prayer times, so re-check the time now and then.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), CATEGORY_CHECK_MS);
    return () => clearInterval(id);
  }, []);

  const today = dayKey(now);
  const locationKey = `${settings.place.latitude},${settings.place.longitude},${settings.method},${settings.school}`;
  useEffect(() => {
    let cancelled = false;
    // The prayer widget already cached this month, so this is normally offline.
    loadTimings(settings, new Date())
      .then((r) => !cancelled && setTimings(r.today))
      .catch(() => !cancelled && setTimings(null));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, locationKey]);

  const category = cfg.mode === "auto" ? azkarForNow(now, timings) : cfg.mode;
  const list = AZKAR[category];
  const safeIndex = index % list.length;
  const zikr = list[safeIndex];

  // A new set starts from its first dhikr.
  useEffect(() => setIndex(0), [category]);
  useEffect(() => setLeft(zikr.count), [zikr]);

  const step = (by: 1 | -1) => setIndex((i) => (i + by + list.length) % list.length);

  // Rotation pauses while the pointer is on the widget, so nothing moves
  // under someone who is reading or counting.
  useEffect(() => {
    if (!cfg.interval || paused) return;
    const id = window.setTimeout(() => step(1), cfg.interval * 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, category, paused, cfg.interval]);

  const count = () => {
    if (left > 1) setLeft(left - 1);
    else step(1);
  };

  const { onMouseDown, onContextMenu } = useDesktopWidget(stageRef, {
    alwaysOnTop: settings.alwaysOnTop,
    lockPosition: settings.lockPosition,
    settingsTab: "widgets",
  });

  const n = (v: number) => digits(v, settings.numerals);
  const counterLabel = zikr.count === 1 ? "مرة واحدة" : `${n(left)} من ${n(zikr.count)}`;

  const style = {
    "--accent": settings.accent,
    "--tint": cfg.opacity,
    "--scale": cfg.scale,
    "--card-width": cfg.width,
    fontFamily: fontFamily(settings.font),
  } as React.CSSProperties;

  return (
    <div ref={stageRef} className="stage" style={style} dir="rtl" onContextMenu={onContextMenu}>
      <div
        className={`card extra-card${settings.lockPosition ? " is-locked" : ""}`}
        onMouseDown={onMouseDown}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <header className="x-head">
          <span className="x-title">{AZKAR_TITLES[category]}</span>
          <span className="x-pos num">
            {n(safeIndex + 1)} / {n(list.length)}
          </span>
        </header>

        <p className={`x-text${zikr.quran ? " is-quran" : ""}${zikr.text.length < 45 ? " is-short" : ""}`}>{zikr.text}</p>
        {cfg.showNote && zikr.note && <p className="x-note">{zikr.note}</p>}

        <footer className="x-foot">
          <button
            className="counter"
            onClick={count}
            title={zikr.count > 1 ? "اضغط مع كل مرة تقولها" : "التالي"}
          >
            {counterLabel}
          </button>
          <div className="x-nav">
            <button className="icon-btn" onClick={() => step(-1)} title="السابق">
              <ChevronPrevIcon />
            </button>
            <button className="icon-btn" onClick={() => step(1)} title="التالي">
              <ChevronNextIcon />
            </button>
            <button className="icon-btn" onClick={() => openSettings("widgets")} title="الإعدادات">
              <GearIcon />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
