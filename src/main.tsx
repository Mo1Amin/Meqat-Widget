import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fontsource/cairo/400.css";
import "@fontsource/cairo/600.css";
import "@fontsource/cairo/700.css";
import "@fontsource/almarai/400.css";
import "@fontsource/almarai/700.css";
import "@fontsource/amiri/400.css";
import "@fontsource/amiri/700.css";
import "@fontsource/aref-ruqaa/400.css";
import "@fontsource/aref-ruqaa/700.css";
import "@fontsource/amiri-quran/400.css";
import { isTauri } from "./native";
import Widget from "./Widget";
import SettingsWindow from "./SettingsWindow";
import AzkarWidget from "./AzkarWidget";
import AyahWidget from "./AyahWidget";

// Both windows load the same page; the window label decides what it shows.
// Outside Tauri (plain browser preview) `?view=settings` does the same job.
const view = isTauri
  ? getCurrentWindow().label
  : new URLSearchParams(location.search).get("view") ?? "main";

const VIEWS: Record<string, () => React.ReactElement> = {
  settings: SettingsWindow,
  azkar: AzkarWidget,
  ayah: AyahWidget,
};
const View = VIEWS[view] ?? Widget;

document.documentElement.dataset.view = view === "settings" ? "settings" : "widget";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <View />
  </React.StrictMode>,
);
