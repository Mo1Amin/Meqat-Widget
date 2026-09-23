# 🕋 مِيقَات (Meqat) - Islamic Desktop Widget

A beautifully designed, Glassmorphism-inspired Islamic prayer times widget for Windows. Designed to sit elegantly on your desktop without cluttering your workspace, providing accurate prayer times, offline support, and complete UI customization.

<p align="center">
  <a href="https://github.com/Mo1Amin/Meqat-Widget/releases/latest"><img src="https://img.shields.io/github/v/release/Mo1Amin/Meqat-Widget?style=for-the-badge&label=Download&color=0f766e" alt="Download the latest release"></a>
  <img src="https://img.shields.io/badge/Tauri-24C8DB?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
</p>

<img src="docs/preview.webp" alt="Meqat widget on a Windows desktop: today's prayer times, the Hijri and Gregorian date, and a countdown to the next prayer" width="100%">

## ✨ Features

* **Sized to its content:** The window is always exactly the size of the widget, at any scale from 70% to 160% — nothing is clipped, and no invisible margin blocks clicks on your desktop.
* **Any city:** Search for your city in Arabic or English; prayer times are fetched by coordinates, with 11 calculation methods and Shafi'i/Hanafi Asr.
* **Accurate Hijri date:** Computed locally (Umm al-Qura) with a ±2 day correction for your country's sighting.
* **Three layouts:** Full (date, clock, countdown and all six times), compact (clock and countdown), or the prayer row alone.
* **Live countdown and progress:** The next prayer is highlighted, passed prayers fade, and a bar shows how far through the current prayer time you are. Friday's Dhuhr shows as الجمعة.
* **Azan and reminders:** Plays the azan once per prayer, with volume control and a preview button; optional Windows notifications, plus a reminder 5–30 minutes before each prayer.
* **Offline-first:** A whole month is cached per location; the day rolls over at midnight without a restart, and the widget retries on its own when the connection returns.
* **Personalise it:** Accent colour, four bundled Arabic fonts (work offline), Arabic or Latin numerals, 12/24-hour clock, optional seconds, background opacity.
* **Behaves like a desktop widget:** Always-on-top, lock position, launch at login, a single instance, and it comes back on screen if a monitor is unplugged.

## 🚀 Tech Stack

* **Frontend:** React, TypeScript, Vite
* **Backend & System Integration:** Tauri, Rust
* **Styling:** Vanilla CSS (CSS Variables, Flexbox, Keyframe Animations)
* **APIs:** [Aladhan](https://aladhan.com/prayer-times-api) for prayer times, [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) for city search

## 📥 Installation & Usage

1. Go to the [Releases](https://github.com/Mo1Amin/Meqat-Widget/releases) page.
2. Download the latest `miqat_1.3.0_x64-setup.exe` file.
3. Install and run the application.
4. **Controls:** * **Left-Click** on the tray icon to show the widget.
   * **Right-Click** on the widget to open the Settings Panel.
   * **Drag & Drop** from the clock or prayer times area to move the widget around your screen.

## 🛠️ Development

To run this project locally:

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```
