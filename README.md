# 🕋 مِيقَات (Meqat) - Islamic Desktop Widget

A beautifully designed, Glassmorphism-inspired Islamic prayer times widget for Windows. Designed to sit elegantly on your desktop without cluttering your workspace, providing accurate prayer times, offline support, and complete UI customization.

<p align="center">
  <a href="https://github.com/Mo1Amin/Meqat-Widget/releases/latest"><img src="https://img.shields.io/github/v/release/Mo1Amin/Meqat-Widget?style=for-the-badge&label=Download&color=0f766e" alt="Download the latest release"></a>
  <img src="https://img.shields.io/badge/Tauri-24C8DB?style=for-the-badge&logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
</p>

<img src="docs/preview.webp" alt="Meqat 1.4 on a Windows desktop: the prayer-times widget, a Qur'an verse widget, and a morning adhkar widget showing Ayat al-Kursi" width="100%">

## ✨ Features

* **Three desktop widgets:** prayer times, adhkar, and Qur'an verses — add or remove each from the Widgets tab in Settings, drag it anywhere, and right-click it for its own options.
* **Adhkar widget:** Hisn al-Muslim morning, evening, after-prayer, sleep and waking adhkar plus tasbih. In automatic mode it follows the prayer times (morning after Fajr, evening after Asr, after-prayer adhkar for 20 minutes after each prayer). Click the counter with each repetition; rotation pauses while the pointer is on it.
* **Qur'an widget:** verses in the Uthmani script and the Amiri Quran typeface — hand-picked verses, any verse from the whole mushaf, or sequential reading that remembers its place. Changes every minute up to once a day, with copy and next/previous.
* **12 azan voices, offline:** Nasser Al-Qatami, Yasser Al-Dosari, Muhammad Refaat, Muhammad Siddiq Al-Minshawi, Abdul Basit Abdul Samad, Mishary Alafasy, Ali Ahmed Mulla (Masjid al-Haram) and the original — plus a separate Fajr azan with «الصلاة خير من النوم». Every voice can be previewed, and all are loudness-matched.
* **Sized to its content:** The window is always exactly the size of the widget, at any scale from 70% to 160% — nothing is clipped, and no invisible margin blocks clicks on your desktop.
* **Any city:** Search for your city in Arabic or English; prayer times are fetched by coordinates, with 11 calculation methods and Shafi'i/Hanafi Asr.
* **Accurate Hijri date:** Computed locally (Umm al-Qura) with a ±2 day correction for your country's sighting.
* **Three layouts for the prayer widget:** Full (date, clock, countdown and all six times), compact (clock and countdown), or the prayer row alone.
* **Live countdown and progress:** The next prayer is highlighted, passed prayers fade, and a bar shows how far through the current prayer time you are. Friday's Dhuhr shows as الجمعة.
* **Azan and reminders:** Plays the azan once per prayer, with volume control and a preview button; optional Windows notifications, plus a reminder 5–30 minutes before each prayer.
* **Offline-first:** A whole month is cached per location; the day rolls over at midnight without a restart, and the widget retries on its own when the connection returns.
* **Personalise it:** Accent colour, four bundled Arabic fonts (work offline), Arabic or Latin numerals, 12/24-hour clock, optional seconds, background opacity, and separate sizes for the weekday name and the dates under it.
* **Behaves like a desktop widget:** Always-on-top, lock position, launch at login, a single instance, and it comes back on screen if a monitor is unplugged.

## 🚀 Tech Stack

* **Frontend:** React, TypeScript, Vite
* **Backend & System Integration:** Tauri, Rust
* **Styling:** Vanilla CSS (CSS Variables, Flexbox, Keyframe Animations)
* **Offline content:** Qur'an text from [Tanzil](https://tanzil.net) (Uthmani, unmodified), adhkar from Hisn al-Muslim via [azkar-api](https://github.com/nawafalqari/azkar-api) with typos corrected in `scripts/build-data.mjs`, azan recordings from [adhan-mp3](https://github.com/Kiwifu/adhan-mp3)
* **APIs:** [Aladhan](https://aladhan.com/prayer-times-api) for prayer times, [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) for city search

## 📥 Installation & Usage

1. Go to the [Releases](https://github.com/Mo1Amin/Meqat-Widget/releases) page.
2. Download the latest `miqat_1.4.0_x64-setup.exe` file.
3. Install and run the application.
4. **Controls:**
   * **Left-click** the tray icon to show or hide all widgets; **right-click** it for settings and quit.
   * **Right-click** any widget, or hover it and press the gear, to open its settings. Add the adhkar and Qur'an widgets from **Settings → الويدجتس**.
   * **Hover** the prayer widget for a quick azan mute button, and the adhkar or Qur'an widget for next/previous.
   * **Drag** a widget anywhere to move it (unless positions are locked).

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
