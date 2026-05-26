import { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import "./App.css";

// Global audio instances to avoid re-initialization on every render
const azanAudioFajr = new Audio("/azan_fajr.mp3");
const azanAudio = new Audio("/azan.mp3");

interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
}

function App() {
  // Core app state
  const [timings, setTimings] = useState<PrayerTimings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [nextPrayerName, setNextPrayerName] = useState<string>("");
  const [countdown, setCountdown] = useState<string>("");

  // User preferences (synced with localStorage)
  const [widgetScale, setWidgetScale] = useState<number>(() => {
    return parseFloat(localStorage.getItem("widgetScale") || "1");
  });
  const [primaryColor, setPrimaryColor] = useState<string>(() => {
    return localStorage.getItem("widgetColor") || "#dde3c6";
  });
  const [selectedFont, setSelectedFont] = useState<string>(() => {
    return localStorage.getItem("widgetFont") || "'Cairo', sans-serif";
  });
  const [alwaysOnTop, setAlwaysOnTop] = useState<boolean>(() => {
    return localStorage.getItem("alwaysOnTop") === "true";
  });
  const [numeralType, setNumeralType] = useState<string>(() => {
    return localStorage.getItem("numeralType") || "ar";
  });
  const [timeFormat, setTimeFormat] = useState<string>(() => {
    return localStorage.getItem("timeFormat") || "12";
  });

  // UI toggles & temporary states
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showPopup, setShowPopup] = useState<string | null>(null);

  // Utility: Number formatter based on user's locale preference
  const formatNumbers = (text: string | number) => {
    if (numeralType === "en") return text.toString();
    const arabicNums = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return text.toString().replace(/[0-9]/g, w => arabicNums[Number(w)]);
  };

  // Utility: Time formatter handling 12h/24h logic
  const formatPrayerTime = (time24: string) => {
    if (timeFormat === "24") return formatNumbers(time24);
    let [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'م' : 'ص';
    h = h % 12 || 12;
    return formatNumbers(`${h}:${m.toString().padStart(2, '0')} ${ampm}`);
  };

  // 1. Sync 'Always on Top' window state with Tauri API
  useEffect(() => {
    const updateAlwaysOnTop = async () => {
      try {
        await getCurrentWindow().setAlwaysOnTop(alwaysOnTop);
      } catch (error) {
        console.error("Failed to pin window:", error);
      }
    };
    updateAlwaysOnTop();
  }, [alwaysOnTop]);

  // 2. Inject CSS variables for live theming
  useEffect(() => {
    document.documentElement.style.setProperty("--primary-color", primaryColor);
    document.documentElement.style.setProperty("--widget-font", selectedFont);
  }, [primaryColor, selectedFont]);

  // 3. Fetch timings from API (with local storage fallback for offline support)
  useEffect(() => {
    const fetchPrayerTimes = async () => {
      const today = new Date();
      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      const cacheKey = "prayerTimes";
      const dateKey = "prayerMonth";

      try {
        const response = await fetch(
          `https://api.aladhan.com/v1/timingsByCity?city=Cairo&country=Egypt&method=5&month=${currentMonth}&year=${currentYear}`
        );
        if (!response.ok) throw new Error("API Connection Failed");
        const data = await response.json();
        
        localStorage.setItem(cacheKey, JSON.stringify(data.data.timings));
        localStorage.setItem(dateKey, `${currentMonth}-${currentYear}`);
        setTimings(data.data.timings);
      } catch (error) {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) setTimings(JSON.parse(cachedData));
      } finally {
        setLoading(false);
      }
    };

    fetchPrayerTimes();
    
    // Request notification permissions gracefully
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  // 4. Main clock interval: Ticks every second to update UI and countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      calculateNextPrayer();
    }, 1000);
    return () => clearInterval(timer);
  }, [timings, currentTime]);

  // 5. Azan Trigger Logic: Checks for matches every 30 seconds
  useEffect(() => {
    const triggerAzan = (name: string, audio: HTMLAudioElement) => {
      if (!isMuted) audio.play().catch(e => console.log("Audio playback error:", e));
      setShowPopup(name);
      setTimeout(() => setShowPopup(null), 15000);
    };

    const checkPrayerTime = () => {
      if (!timings) return;
      const now = new Date();
      const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

      if (timeStr === timings.Fajr) triggerAzan("الفجر", azanAudioFajr);
      else if ([timings.Dhuhr, timings.Asr, timings.Maghrib, timings.Isha].includes(timeStr)) {
        triggerAzan("الصلاة", azanAudio);
      }
    };

    const interval = setInterval(checkPrayerTime, 1000 * 30);
    return () => clearInterval(interval);
  }, [timings, isMuted]);

  // Core logic to determine the upcoming prayer and calculate the time difference
  const calculateNextPrayer = () => {
    if (!timings) return;
    const prayerOrder = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
    const prayerNamesAr: { [key: string]: string } = {
      Fajr: "الفجر", Dhuhr: "الظهر", Asr: "العصر", Maghrib: "المغرب", Isha: "العشاء",
    };

    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes;

    let foundNext = false;
    for (const prayer of prayerOrder) {
      const [prayerH, prayerM] = timings[prayer as keyof PrayerTimings].split(":").map(Number);
      const prayerTimeInMinutes = prayerH * 60 + prayerM;

      if (prayerTimeInMinutes > currentTimeInMinutes) {
        const diffInMinutes = prayerTimeInMinutes - currentTimeInMinutes;
        const diffH = Math.floor(diffInMinutes / 60);
        const diffM = diffInMinutes % 60;
        const diffS = 60 - currentTime.getSeconds();

        setNextPrayerName(prayerNamesAr[prayer]);
        setCountdown(`${diffH}:${diffM < 10 ? "0" + diffM : diffM}:${diffS < 10 ? "0" + diffS : diffS}`);
        foundNext = true;
        break;
      }
    }

    // Edge case: Handing the rollover to Fajr on the next day
    if (!foundNext) {
      const [prayerH, prayerM] = timings.Fajr.split(":").map(Number);
      const prayerTimeInMinutes = prayerH * 60 + prayerM;
      const minutesUntilMidnight = 1440 - currentTimeInMinutes;
      const totalMinutes = minutesUntilMidnight + prayerTimeInMinutes;
      
      const diffH = Math.floor(totalMinutes / 60);
      const diffM = totalMinutes % 60;
      const diffS = 60 - currentTime.getSeconds();
      
      setNextPrayerName("الفجر");
      setCountdown(`${diffH}:${diffM < 10 ? "0" + diffM : diffM}:${diffS < 10 ? "0" + diffS : diffS}`);
    }
  };

  const arabicDateFormatter = new Intl.DateTimeFormat("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const [weekday, day, month, year] = arabicDateFormatter.format(currentTime).split(" ");
  const hijriDate = "9 ذو الحجة 1447"; 

  // Window drag handler
  const handleDrag = (e: React.MouseEvent) => {
    if (e.button === 0) invoke('drag_window');
  };
  
  // Custom context menu handler
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowSettings(true);
  };

  return (
    <div className="app-wrapper" dir="rtl" style={{ fontFamily: selectedFont }} onContextMenu={handleRightClick}>
      
      {/* Azan Notification Popup */}
      {showPopup && (
        <div className="apple-popup glass-widget">
          <h3>مِيقَات 🕋</h3>
          <p>حان الآن موعد أذان {showPopup}</p>
          <button onClick={() => setShowPopup(null)} className="mute-btn" style={{ marginTop: '10px' }}>إغلاق ❌</button>
        </div>
      )}

      {/* Glass Modal Settings */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="glass-modal" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, borderBottom: '2px solid var(--primary-color)', paddingBottom: '5px' }}>الإعدادات</h3>
              <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
            </div>

            <div className="setting-group">
              <label>الخط العربي</label>
              <select value={selectedFont} onChange={(e) => {
                  setSelectedFont(e.target.value);
                  localStorage.setItem("widgetFont", e.target.value);
                }}>
                <option value="'Cairo', sans-serif">القاهرة (عصري)</option>
                <option value="'Aref Ruqaa', serif">الرقعة (كلاسيكي)</option>
                <option value="'Amiri', serif">الأميري (نسخ)</option>
              </select>
            </div>

            <div className="setting-group" style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label>لغة الأرقام</label>
                <select value={numeralType} onChange={(e) => {
                    setNumeralType(e.target.value);
                    localStorage.setItem("numeralType", e.target.value);
                  }}>
                  <option value="ar">العربية (١٢٣)</option>
                  <option value="en">الإنجليزية (123)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label>نظام التوقيت</label>
                <select value={timeFormat} onChange={(e) => {
                    setTimeFormat(e.target.value);
                    localStorage.setItem("timeFormat", e.target.value);
                  }}>
                  <option value="12">12 ساعة</option>
                  <option value="24">24 ساعة</option>
                </select>
              </div>
            </div>

            <div className="setting-group">
              <label>لون التطبيق</label>
              <input type="color" value={primaryColor} className="color-picker-input"
                onChange={(e) => {
                  setPrimaryColor(e.target.value);
                  localStorage.setItem("widgetColor", e.target.value);
                }} 
              />
            </div>

            <div className="setting-group">
              <label>حجم الويدجت ({formatNumbers(Math.round(widgetScale * 100))}%)</label>
              <input type="range" min="0.5" max="1.5" step="0.1" value={widgetScale} 
                onChange={(e) => {
                 const newScale = parseFloat(e.target.value);
                 setWidgetScale(newScale);
                 localStorage.setItem("widgetScale", newScale.toString());
                }}
              style={{ width: '100%', cursor: 'pointer' }} />
            </div>

            <div className="setting-group" style={{ marginTop: '15px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={alwaysOnTop} 
                  onChange={(e) => {
                    setAlwaysOnTop(e.target.checked);
                    localStorage.setItem("alwaysOnTop", e.target.checked.toString());
                  }} 
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span>تثبيت الويدجت فوق النوافذ</span>
              </label>
            </div>

            <div className="setting-group" style={{ marginTop: '15px' }}>
              <button onClick={() => {
                  setIsMuted(!isMuted);
                  if (!isMuted) {
                    azanAudioFajr.pause(); azanAudioFajr.currentTime = 0;
                    azanAudio.pause(); azanAudio.currentTime = 0;
                  }
                }} 
                className="mute-btn" style={{ width: '100%', margin: 0, padding: '12px', fontSize: '1rem' }}>
                {isMuted ? "إلغاء الكتم 🔊" : "كتم صوت الأذان 🔇"}
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Main Widget Content */}
      <div className="scalable-content" style={{ transform: `scale(${widgetScale})` }}>
        {timings && !loading && (
          <div className="glass-widget prayers-widget" onMouseDown={handleDrag} style={{ cursor: "grab" }}>
            <div className="prayer-item"><span className="name">فجر</span><span className="time apple-numbers" dir="ltr">{formatPrayerTime(timings.Fajr)}</span></div>
            <div className="prayer-item"><span className="name">شروق</span><span className="time apple-numbers" dir="ltr">{formatPrayerTime(timings.Sunrise)}</span></div>
            <div className="prayer-item"><span className="name">ظهر</span><span className="time apple-numbers" dir="ltr">{formatPrayerTime(timings.Dhuhr)}</span></div>
            <div className="prayer-item"><span className="name">عصر</span><span className="time apple-numbers" dir="ltr">{formatPrayerTime(timings.Asr)}</span></div>
            <div className="prayer-item"><span className="name">مغرب</span><span className="time apple-numbers" dir="ltr">{formatPrayerTime(timings.Maghrib)}</span></div>
            <div className="prayer-item"><span className="name">عشاء</span><span className="time apple-numbers" dir="ltr">{formatPrayerTime(timings.Isha)}</span></div>
          </div>
        )}

        {loading ? (
          <p className="loading">جاري الجلب...</p>
        ) : (
          <div className="glass-widget main-clock-widget" onMouseDown={handleDrag} style={{ cursor: "grab" }}>
            <div className="date-info">
              <h2 className="weekday theme-text">{weekday.replace(",", "")}</h2>
              <p className="hijri">{formatNumbers(hijriDate)}</p>
              <p className="gregorian apple-numbers">{formatNumbers(`${day} ${month} ${year}`)}</p>
            </div>

            <div className="time-info">
              <div className="current-clock apple-numbers" dir="ltr">
               {formatNumbers(currentTime.toLocaleTimeString("en-US", { 
                  hour: "numeric", 
                  minute: "2-digit", 
                  hour12: timeFormat === "12" 
                }).replace(/[AP]M/, match => match === 'AM' ? 'ص' : 'م'))}
              </div>
              <div className="next-prayer-box">
                <span className="next-prayer-label">{nextPrayerName}</span>
                <span className="countdown apple-numbers" dir="ltr">{formatNumbers(countdown)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;