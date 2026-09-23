import { Fragment, useEffect, useRef, useState } from "react";
import {
  advancePosition,
  loadQuran,
  pickPassage,
  readPosition,
  renderPassage,
  slotFor,
  type Passage,
} from "./content";
import { digits } from "./prayer";
import { loadSettings, onSettingsChanged, type Settings } from "./settings";
import { openSettings } from "./native";
import { useDesktopWidget } from "./useDesktopWidget";
import { CheckIcon, ChevronNextIcon, ChevronPrevIcon, CopyIcon, GearIcon } from "./icons";
import "./widget.css";
import "./extras.css";

type Quran = Awaited<ReturnType<typeof loadQuran>>;

const TICK_MS = 15_000;

export default function AyahWidget() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [quran, setQuran] = useState<Quran | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  // Manual next/previous on top of the scheduled verse.
  const [offset, setOffset] = useState(0);
  const [position, setPosition] = useState<Passage>(readPosition);
  const [copied, setCopied] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const cfg = settings.ayah;

  useEffect(() => onSettingsChanged(setSettings), []);
  useEffect(() => {
    loadQuran().then(setQuran, () => setFailed(true));
  }, []);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // A new scheduled slot replaces whatever was picked by hand.
  const slot = cfg.interval ? slotFor(now, cfg.interval) : 0;
  useEffect(() => setOffset(0), [slot, cfg.source]);

  // Sequential reading moves forward one verse per interval.
  const lastSlot = useRef(slot);
  useEffect(() => {
    if (!quran || cfg.source !== "sequential" || !cfg.interval) return;
    if (slot !== lastSlot.current) setPosition((p) => advancePosition(quran, p));
    lastSlot.current = slot;
  }, [slot, quran, cfg.source, cfg.interval]);

  const step = (by: 1 | -1) => {
    if (!quran) return;
    if (cfg.source === "sequential") setPosition((p) => advancePosition(quran, p, by));
    else setOffset((o) => o + by);
  };

  const { onMouseDown, onContextMenu } = useDesktopWidget(stageRef, {
    alwaysOnTop: settings.alwaysOnTop,
    lockPosition: settings.lockPosition,
    settingsTab: "widgets",
  });

  const style = {
    "--accent": settings.accent,
    "--tint": cfg.opacity,
    "--scale": cfg.scale,
    "--card-width": cfg.width,
  } as React.CSSProperties;

  // Verse numbers inside the mushaf text are always Arabic-Indic.
  const ar = (v: number) => digits(v, "ar");

  let body: React.ReactNode;
  if (!quran) {
    body = <p className="x-note">{failed ? "تعذّر تحميل المصحف" : "جارٍ التحميل…"}</p>;
  } else {
    const passage = renderPassage(
      quran,
      cfg.source === "sequential" ? position : pickPassage(quran, cfg.source, slot * 7919 + offset),
    );
    const ref =
      passage.from === passage.to
        ? `${passage.surahName} · ${ar(passage.from)}`
        : `${passage.surahName} · ${ar(passage.from)}–${ar(passage.to)}`;

    const copy = async () => {
      const text = `${passage.ayahs.join(" ")}\n[${ref}]`;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      } catch {
        /* clipboard unavailable — nothing to do */
      }
    };

    body = (
      <>
        <p className="x-text is-quran ayah-text">
          {passage.ayahs.map((a, i) => (
            <Fragment key={i}>
              {a} <span className="ayah-no">﴿{ar(passage.from + i)}﴾</span>{" "}
            </Fragment>
          ))}
        </p>
        <footer className="x-foot">
          {cfg.showRef ? <span className="x-ref">سورة {ref}</span> : <span />}
          <div className="x-nav">
            <button className="icon-btn" onClick={() => step(-1)} title="السابقة">
              <ChevronPrevIcon />
            </button>
            <button className="icon-btn" onClick={() => step(1)} title="التالية">
              <ChevronNextIcon />
            </button>
            <button className="icon-btn" onClick={copy} title="نسخ الآية">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
            <button className="icon-btn" onClick={() => openSettings("widgets")} title="الإعدادات">
              <GearIcon />
            </button>
          </div>
        </footer>
      </>
    );
  }

  return (
    <div ref={stageRef} className="stage" style={style} dir="rtl" onContextMenu={onContextMenu}>
      <div className={`card extra-card${settings.lockPosition ? " is-locked" : ""}`} onMouseDown={onMouseDown}>
        {body}
      </div>
    </div>
  );
}
