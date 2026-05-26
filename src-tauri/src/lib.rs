use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[tauri::command]
fn drag_window(window: tauri::Window) {
    let _ = window.start_dragging();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Window State 
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // 1 Menu Items
            let show_i = MenuItem::with_id(app, "show", "إظهار مِيقَات", true, None::<&str>)?;
            let center_i = MenuItem::with_id(app, "center", "توسيط النافذة (إعادة ضبط)", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "إغلاق التطبيق ❌", true, None::<&str>)?;
            
            // 2 app Menu
            let menu = Menu::with_items(app, &[&show_i, &center_i, &quit_i])?;

            // 3 Tray Icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu) // السطر ده هو اللي بيظهر القائمة لما تعمل كليك يمين
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0); 
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "center" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.center(); 
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![drag_window])
       
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}