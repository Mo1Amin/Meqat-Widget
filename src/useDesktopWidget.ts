import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { announceShown, ensureOnScreen, openSettings, resizeWindow, setAlwaysOnTop, showWindow, startDrag } from "./native";

/**
 * Everything that makes a React tree behave like a desktop widget: the native
 * window follows the size of `stageRef`, drags from anywhere that is not a
 * button, and opens its page of the settings on right-click.
 */
export function useDesktopWidget(
  stageRef: RefObject<HTMLElement | null>,
  opts: { alwaysOnTop: boolean; lockPosition: boolean; settingsTab: string },
) {
  useEffect(() => {
    setAlwaysOnTop(opts.alwaysOnTop);
  }, [opts.alwaysOnTop]);

  // The native window is always exactly the size of the card (plus room for
  // its shadow), so there is never an invisible margin swallowing clicks on
  // the desktop and nothing is ever clipped at larger sizes.
  //
  // Measured after every commit, not only from a ResizeObserver: WebView2
  // pauses rendering while the window is hidden, and observers are delivered
  // in the rendering step, so the loading → loaded change was never reported
  // and the window stayed at the size of the loading message.
  const fitRef = useRef({ last: "", shown: false, fontsReady: false });
  const [shown, setShown] = useState(false);
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
      setShown(true);
      await announceShown();
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
    if (e.button !== 0 || opts.lockPosition) return;
    if ((e.target as HTMLElement).closest("button")) return;
    startDrag();
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    openSettings(opts.settingsTab);
  };

  /** True once the window has been sized and shown for the first time. */
  return { onMouseDown, onContextMenu, shown };
}
