import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  buildSchedule,
  dayKey,
  formatClock,
  formatCountdown,
  formatDates,
  loadTimings,
  SALAH_KEYS,
  type LoadResult,
  type ScheduledPrayer,
} from "./prayer";
import { fontFamily, loadSettings, onSettingsChanged, saveSettings, type Settings } from "./settings";
import { ensureOnScreen, notify, openSettings, resizeWindow, setAlwaysOnTop, showWindow, startDrag } from "./native";
import { BellIcon, BellOffIcon, GearIcon, StopIcon } from "./icons";
import "./widget.css";

const AZAN_SRC = "/azan.mp3";
const RETRY_MS = 5 * 60_000;

export default function Widget() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [now, setNow] = useState(() => new Date());
  const [data, setData] = useState<LoadResult | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [calling, setCalling] = useState<string | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const firedRef = useRef(new Set<string>());
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => onSettingsChanged(setSettings), []);

  // Clock, aligned to the second boundary so the display never skips a digit.
  useEffect(() => {
    let id = 0;
    const tick = () => {
      setNow(new Date());
      id = window.setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
    };
    tick();
    return () => clearTimeout(id);
  }, []);

  // Timings follow the calendar day and the location/method settings.
  const today = dayKey(now);
  const locationKey = `${settings.place.latitude},${settings.place.longitude},${settings.method},${settings.school}`;
  useEffect(() => {
    let cancelled = false;
    loadTimings(settingsRef.current, new Date())
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [today, locationKey, retry]);

  // Offline or stale: try again periodically and as soon as the network is back.
  const needsRetry = failed || !!data?.stale;
  useEffect(() => {
    if (!needsRetry) return;
    const bump = () => setRetry((n) => n + 1);
    const id = window.setInterval(bump, RETRY_MS);
    window.addEventListener("online", bump);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", bump);
    };
  }, [needsRetry]);

  const schedule = useMemo(() => (data ? buildSchedule(data.today, data.tomorrow, now) : null), [data, now]);

  // ---------------------------------------------------------------- azan & reminders

  const stopAzan = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setCalling(null);
  };

  const fireAzan = (p: ScheduledPrayer) => {
    const s = settingsRef.current;
    setCalling(p.name);
    if (s.notify) notify("مِيقَات", `حان الآن موعد أذان ${p.name}`);
    if (s.azanEnabled) {
      audioRef.current ??= new Audio(AZAN_SRC);
      const audio = audioRef.current;
      audio.volume = s.volume;
      audio.currentTime = 0;
      audio.onended = () => setCalling(null);
      audio.play().catch((e) => console.error("azan playback failed", e));
    } else {
      window.setTimeout(() => setCalling((c) => (c === p.name ? null : c)), 3 * 60_000);
    }
  };

  useEffect(() => {
    if (!schedule) return;
    const t = now.getTime();
    const fired = firedRef.current;
    const { reminderMinutes, notify: wantsNotify } = settingsRef.current;
    for (const p of schedule.items) {
      if (!SALAH_KEYS.includes(p.key)) continue;
      const at = p.at.getTime();
      const id = `${dayKey(p.at)}-${p.key}`;
      // A one-minute window: late enough to survive a missed tick, short
      // enough that waking the PC an hour later does not start an azan.
      if (t >= at && t - at < 60_000 && !fired.has(id)) {
        fired.add(id);
        fireAzan(p);
      }
      if (reminderMinutes > 0 && wantsNotify) {
        const r = at - reminderMinutes * 60_000;
        if (t >= r && t - r < 60_000 && !fired.has(`${id}-r`)) {
          fired.add(`${id}-r`);
          notify("مِيقَات", `باقي ${reminderMinutes} دقيقة على أذان ${p.name}`);
        }
      }
    }
  }, [now, schedule]);

  // Muting mid-azan stops it; the volume slider applies live.
  useEffect(() => {
    if (!settings.azanEnabled) audioRef.current?.pause();
    if (audioRef.current) audioRef.current.volume = settings.volume;
  }, [settings.azanEnabled, settings.volume]);

  // ---------------------------------------------------------------- window

  useEffect(() => {
    setAlwaysOnTop(settings.alwaysOnTop);
  }, [settings.alwaysOnTop]);

  // The native window is always exactly the size of the card (plus room for
  // its shadow), so there is never an invisible margin swallowing clicks on
  // the desktop and nothing is ever clipped at larger sizes.
  //
  // Measured after every commit, not only from a ResizeObserver: WebView2
  // pauses rendering while the window is hidden, and observers are delivered
  // in the rendering step, so the loading → loaded change was never reported
  // and the window stayed at the size of the loading message.
  const fitRef = useRef({ last: "", shown: false, fontsReady: false });
  const fit = () => {
    const stage = stageRef.current;
    const state = fitRef.current;
    if (!stage || !state.fontsReady) return;
    const r = stage.getBoundingClientRect();
    const key = `${Math.ceil(r.width)}x${Math.ceil(r.height)}x${window.devicePixelRatio}`;
    if (key === state.last || r.width === 0 || r.height === 0) return;
    state.last = key;
    void resizeWindow(r.width, r.height).then(async () => {
      if (state.shown) return;
      state.shown = true;
      await ensureOnScreen();
      await showWindow();
    });
  };
  useLayoutEffect(fit);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const ro = new ResizeObserver(fit);
    document.fonts.ready.then(() => {
      fitRef.current.fontsReady = true;
      ro.observe(stage);
      fit();
    });
    // Moving to a monitor with a different scale changes devicePixelRatio.
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || settings.lockPosition) return;
    if ((e.target as HTMLElement).closest("button")) return;
    startDrag();
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openSettings();
  };

  const toggleAzan = () => {
    const next = { ...settings, azanEnabled: !settings.azanEnabled };
    setSettings(next);
    saveSettings(next);
  };

  // ---------------------------------------------------------------- render

  const { numerals, clockFormat, layout } = settings;
  const dates = useMemo(
    () => formatDates(now, settings.hijriOffset, numerals),
    // Dates only change once a day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [today, settings.hijriOffset, numerals],
  );
  const clock = formatClock(now, clockFormat, numerals, settings.showSeconds);

  const style = {
    "--accent": settings.accent,
    "--tint": settings.opacity,
    "--scale": settings.scale,
    fontFamily: fontFamily(settings.font),
  } as React.CSSProperties;

  let body: React.ReactNode;
  if (!schedule) {
    body = failed ? (
      <div className="state">
        <p>تعذّر تحميل المواقيت</p>
        <span>تأكد من الاتصال بالإنترنت</span>
        <button className="text-btn" onClick={() => setRetry((n) => n + 1)}>
          إعادة المحاولة
        </button>
      </div>
    ) : (
      <div className="state">
        <p>جارٍ تحميل المواقيت…</p>
      </div>
    );
  } else {
    const remaining = schedule.next.at.getTime() - now.getTime();
    const span = schedule.next.at.getTime() - schedule.previous.at.getTime();
    const progress = Math.min(1, Math.max(0, 1 - remaining / span));

    const nextPill = (
      <div className="next">
        <span className="next-name">{schedule.next.name}</span>
        <span className="next-after">بعد</span>
        <span className="num next-count" dir="ltr">
          {formatCountdown(remaining, numerals)}
        </span>
      </div>
    );

    const clockEl = (
      <div className="clock num" dir="ltr">
        <span>{clock.time}</span>
        {clock.period && <small>{clock.period}</small>}
      </div>
    );

    const row = (
      <ol className="prayers">
        {schedule.items.map((p) => {
          const isNext = p.key === schedule.next.key && p.at.getTime() === schedule.next.at.getTime();
          const passed = p.at <= now && !isNext;
          const t = formatClock(p.at, clockFormat, numerals);
          return (
            <li key={p.key} className={isNext ? "is-next" : passed ? "is-passed" : undefined}>
              <span className="p-name">{p.name}</span>
              <span className="p-time num" dir="ltr">
                {t.time}
                {t.period && <small>{t.period}</small>}
              </span>
            </li>
          );
        })}
      </ol>
    );

    const bar = (
      <div className="progress" aria-hidden>
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
    );

    if (layout === "compact") {
      body = (
        <div className="compact">
          {clockEl}
          <div className="compact-side">
            {nextPill}
            {bar}
          </div>
        </div>
      );
    } else if (layout === "prayers") {
      body = row;
    } else {
      body = (
        <>
          <header className="head">
            <div className="dates">
              <div className="weekday">{dates.weekday}</div>
              <div className="hijri num">{dates.hijri}</div>
              <div className="greg num">{dates.gregorian}</div>
            </div>
            <div className="clock-col">
              {clockEl}
              {nextPill}
            </div>
          </header>
          {bar}
          {row}
        </>
      );
    }
  }

  return (
    <div ref={stageRef} className="stage" style={style} dir="rtl" onContextMenu={onContextMenu}>
      <div
        className={`card layout-${layout}${settings.lockPosition ? " is-locked" : ""}`}
        onMouseDown={onMouseDown}
      >
        {calling && (
          <div className="calling" role="alert">
            <span className="calling-dot" />
            <span>
              حان الآن موعد أذان <b>{calling}</b>
            </span>
            <button className="icon-btn" onClick={stopAzan} title="إيقاف">
              <StopIcon />
            </button>
          </div>
        )}

        {body}

        {data?.stale && <div className="stale">غير متصل — مواقيت تقريبية</div>}

        <div className="tools">
          <button className="icon-btn" onClick={toggleAzan} title={settings.azanEnabled ? "كتم الأذان" : "تشغيل الأذان"}>
            {settings.azanEnabled ? <BellIcon /> : <BellOffIcon />}
          </button>
          <button className="icon-btn" onClick={() => openSettings()} title="الإعدادات">
            <GearIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
