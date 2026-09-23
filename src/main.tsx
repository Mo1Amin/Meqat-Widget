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
import { isTauri } from "./native";
import Widget from "./Widget";
import SettingsWindow from "./SettingsWindow";

// Both windows load the same page; the window label decides what it shows.
// Outside Tauri (plain browser preview) `?view=settings` does the same job.
const view = isTauri
  ? getCurrentWindow().label
  : new URLSearchParams(location.search).get("view") ?? "main";

document.documentElement.dataset.view = view === "settings" ? "settings" : "widget";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{view === "settings" ? <SettingsWindow /> : <Widget />}</React.StrictMode>,
);
