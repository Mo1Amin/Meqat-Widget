import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalPosition, PhysicalSize, availableMonitors } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

/**
 * Thin wrappers over the Tauri APIs. Every call is a no-op in a plain browser,
 * so the UI can be previewed with `npm run dev` without the native shell.
 */
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!isTauri) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    return fallback;
  }
}

export const startDrag = () => safe(() => invoke("drag_window"), undefined);
const SETTINGS_TAB_KEY = "miqat.settingsTab";
const SETTINGS_TAB_EVENT = "miqat://settings-tab";

/**
 * Opens settings on a given tab. The tab is left in storage for a window that
 * is still loading, and announced for one that is already open.
 */
export const openSettings = (tab?: string) =>
  safe(async () => {
    if (tab) localStorage.setItem(SETTINGS_TAB_KEY, tab);
    await invoke("open_settings");
    if (tab) await emit(SETTINGS_TAB_EVENT, tab);
  }, undefined);

export function takeRequestedTab(): string | null {
  const tab = localStorage.getItem(SETTINGS_TAB_KEY);
  localStorage.removeItem(SETTINGS_TAB_KEY);
  return tab;
}

export function onTabRequested(handler: (tab: string) => void): () => void {
  if (!isTauri) return () => {};
  const off = listen<string>(SETTINGS_TAB_EVENT, (e) => {
    localStorage.removeItem(SETTINGS_TAB_KEY);
    handler(e.payload);
  });
  return () => void off.then((fn) => fn());
}

/** Opens or closes one of the extra widget windows ("azkar", "ayah"). */
export const setWidgetWindow = (label: string, open: boolean) =>
  safe(() => invoke(open ? "open_widget" : "close_widget", { label }), undefined);
export const setAlwaysOnTop = (on: boolean) => safe(() => getCurrentWindow().setAlwaysOnTop(on), undefined);
/** Shows this widget without stealing the focus (see reveal_widget in lib.rs). */
export const showWindow = () => safe(() => invoke("reveal_widget"), undefined);
export const closeWindow = () => safe(() => getCurrentWindow().close(), undefined);
/**
 * Sizes the window to a box measured in CSS pixels. The conversion goes
 * through devicePixelRatio, not the monitor scale: WebView2 also applies
 * Windows' "make text bigger" setting, so at 125% scale with 107% text one
 * CSS pixel is 1.34 device pixels, and a logical size would come out short.
 */
export const resizeWindow = (cssWidth: number, cssHeight: number) =>
  safe(() => {
    const dpr = window.devicePixelRatio || 1;
    return getCurrentWindow().setSize(new PhysicalSize(Math.ceil(cssWidth * dpr), Math.ceil(cssHeight * dpr)));
  }, undefined);

/**
 * If the remembered position is no longer on any monitor (a screen was
 * unplugged, resolution changed), bring the widget back to the centre.
 */
export const ensureOnScreen = () =>
  safe(async () => {
    const win = getCurrentWindow();
    const [pos, monitors, factor] = await Promise.all([win.outerPosition(), availableMonitors(), win.scaleFactor()]);
    const size = await win.outerSize();
    const cx = pos.x + size.width / 2;
    const cy = pos.y + size.height / 2;
    const visible = monitors.some(
      (m) =>
        cx >= m.position.x &&
        cx <= m.position.x + m.size.width &&
        cy >= m.position.y &&
        cy <= m.position.y + m.size.height,
    );
    if (!visible) {
      await win.center();
      // center() can land half off a very small screen; nudge into view.
      const p = await win.outerPosition();
      if (p.x < 0 || p.y < 0) await win.setPosition(new LogicalPosition(Math.max(0, p.x / factor), Math.max(0, p.y / factor)));
    }
  }, undefined);

let notifyAllowed: boolean | null = null;
export const notify = (title: string, body: string) =>
  safe(async () => {
    if (notifyAllowed === null) {
      notifyAllowed = (await isPermissionGranted()) || (await requestPermission()) === "granted";
    }
    if (notifyAllowed) sendNotification({ title, body });
  }, undefined);

export const autostart = {
  get: () => safe(() => isEnabled(), false),
  set: (on: boolean) => safe(() => (on ? enable() : disable()), undefined),
};
