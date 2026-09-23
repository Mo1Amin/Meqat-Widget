use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    window::Color,
    AppHandle, Manager, Theme, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

const MAIN: &str = "main";
const SETTINGS: &str = "settings";

#[tauri::command]
fn drag_window(window: tauri::Window) {
    let _ = window.start_dragging();
}

/// Opens the settings window, or brings it forward if it is already open.
/// Settings live in their own window so the widget can stay exactly the size
/// of its content instead of reserving room for a modal.
///
/// Must stay `async`: on Windows, building a webview window inside a
/// synchronous command deadlocks and the new window stays blank.
#[tauri::command]
async fn open_settings(app: AppHandle) -> Result<(), String> {
    open_settings_window(&app)
}

fn open_settings_window(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(SETTINGS) {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }
    WebviewWindowBuilder::new(app, SETTINGS, WebviewUrl::App("index.html".into()))
        .title("إعدادات مِيقَات")
        // Matches --bg in settings.css so the window never flashes white.
        .background_color(Color(27, 28, 31, 255))
        .inner_size(500.0, 720.0)
        .min_inner_size(440.0, 520.0)
        .resizable(true)
        .maximizable(false)
        .theme(Some(Theme::Dark))
        .center()
        .focused(true)
        .build()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

/// The optional desktop widgets, each its own transparent window.
const EXTRA_WIDGETS: [&str; 2] = ["azkar", "ayah"];

/// Opens an extra widget. It starts hidden and shows itself once its content
/// has been measured, like the main widget, so it never flashes at the wrong size.
#[tauri::command]
async fn open_widget(app: AppHandle, label: String) -> Result<(), String> {
    if !EXTRA_WIDGETS.contains(&label.as_str()) {
        return Err(format!("unknown widget {label}"));
    }
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }
    let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("index.html".into()))
        .title("مِيقَات")
        .inner_size(420.0, 200.0)
        .transparent(true)
        .decorations(false)
        .shadow(false)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .visible(false)
        .focused(false);
    // First time only: start just under the prayer widget instead of on top of
    // it. A remembered position is restored over this by the window-state plugin.
    if let Some(main) = app.get_webview_window(MAIN) {
        if let (Ok(pos), Ok(size), Ok(scale)) = (main.outer_position(), main.outer_size(), main.scale_factor()) {
            let offset = if label == "azkar" { 16.0 } else { 236.0 };
            builder = builder.position(pos.x as f64 / scale, (pos.y + size.height as i32) as f64 / scale + offset);
        }
    }
    builder.build().map(|_| ()).map_err(|e| e.to_string())
}

/// Shows a widget without activating it. A plain `show()` takes the focus, so a
/// widget opened from the settings window swallowed the next click there, and
/// the widget appearing at login pulled focus from whatever the user was doing.
#[tauri::command]
fn reveal_widget(window: tauri::WebviewWindow) {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_SHOWNOACTIVATE};
        if let Ok(hwnd) = window.hwnd() {
            // SAFETY: the handle belongs to a live window owned by this process.
            unsafe { ShowWindow(hwnd.0 as _, SW_SHOWNOACTIVATE) };
            return;
        }
    }
    let _ = window.show();
}

#[tauri::command]
fn close_widget(app: AppHandle, label: String) {
    if EXTRA_WIDGETS.contains(&label.as_str()) {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.close();
        }
    }
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window(MAIN) {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Shows or hides every widget together, following the prayer widget.
fn toggle_main(app: &AppHandle) {
    let Some(main) = app.get_webview_window(MAIN) else { return };
    let show = !main.is_visible().unwrap_or(false);
    for label in std::iter::once(MAIN).chain(EXTRA_WIDGETS) {
        if let Some(window) = app.get_webview_window(label) {
            let _ = if show { window.show() } else { window.hide() };
        }
    }
    if show {
        let _ = main.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // A second launch (e.g. autostart plus a manual click) just surfaces the
    // running widget instead of stacking two copies on the desktop.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main(app);
        }));
    }

    builder
        // Only the position is remembered: the size always follows the content.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION)
                .with_denylist(&[SETTINGS])
                .build(),
        )
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "toggle", "إظهار / إخفاء الويدجتس", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "الإعدادات…", true, None::<&str>)?;
            let center_i = MenuItem::with_id(app, "center", "إعادة الويدجت للمنتصف", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "إغلاق مِيقَات", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&show_i, &settings_i, &center_i, &sep, &quit_i])?;

            TrayIconBuilder::with_id("miqat-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("مِيقَات")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "toggle" => toggle_main(app),
                    "settings" => {
                        let _ = open_settings_window(app);
                    }
                    "center" => {
                        if let Some(window) = app.get_webview_window(MAIN) {
                            let _ = window.center();
                        }
                        show_main(app);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![drag_window, open_settings, open_widget, close_widget, reveal_widget])
        .on_window_event(|window, event| {
            // Closing the widget hides it to the tray; the settings window
            // closes normally.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == MAIN {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
