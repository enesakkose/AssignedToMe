use std::collections::HashSet;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::image::Image;
use tauri::ipc::CapabilityBuilder;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_positioner::{Position, WindowExt};
use tauri_plugin_store::StoreExt;

// A non-activating panel so the popover can float over other apps — including one in full screen — without
// switching Spaces or stealing the active app's focus. It can still become key, so search typing works.
tauri_nspanel::tauri_panel! {
    panel!(PopoverPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false
        }
    })
}

// Used by release builds; dev builds use the file store above.
#[cfg_attr(debug_assertions, allow(dead_code))]
const KEYCHAIN_SERVICE: &str = "com.mytask.desktop";

/// https origins the user connected (e.g. a self-hosted Jira) that the http plugin may reach.
struct AllowedOrigins(Mutex<HashSet<String>>);

/// When the popover last hid itself on blur. A tray click right after that is the
/// same click that caused the blur, so it must not reopen the popover.
struct LastBlurHide(Mutex<Option<Instant>>);

// shortcut: in `tauri dev` secrets live in a plaintext file under the app-data dir, not the Keychain, because every
// rebuild is a new unsigned binary and macOS re-prompts for Keychain access on each one. Release builds (stable code
// signature) use the Keychain below. Upgrade: drop this once dev builds are signed with a stable identity.
#[cfg(debug_assertions)]
mod dev_secrets {
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;
    use tauri::{AppHandle, Manager};

    fn file(app: &AppHandle) -> Result<PathBuf, String> {
        let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(dir.join("dev-secrets.json"))
    }

    fn read(app: &AppHandle) -> HashMap<String, String> {
        file(app)
            .ok()
            .and_then(|p| fs::read_to_string(p).ok())
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    fn write(app: &AppHandle, map: &HashMap<String, String>) -> Result<(), String> {
        let json = serde_json::to_string(map).map_err(|e| e.to_string())?;
        fs::write(file(app)?, json).map_err(|e| e.to_string())
    }

    pub fn get(app: &AppHandle, account: &str) -> Result<Option<String>, String> {
        Ok(read(app).get(account).cloned())
    }

    pub fn set(app: &AppHandle, account: String, value: String) -> Result<(), String> {
        let mut map = read(app);
        map.insert(account, value);
        write(app, &map)
    }

    pub fn delete(app: &AppHandle, account: &str) -> Result<(), String> {
        let mut map = read(app);
        map.remove(account);
        write(app, &map)
    }
}

#[tauri::command]
fn secret_get(app: AppHandle, account: String) -> Result<Option<String>, String> {
    #[cfg(debug_assertions)]
    return dev_secrets::get(&app, &account);
    #[cfg(not(debug_assertions))]
    {
        let _ = app;
        match keyring::Entry::new(KEYCHAIN_SERVICE, &account).and_then(|e| e.get_password()) {
            Ok(value) => Ok(Some(value)),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
}

#[tauri::command]
fn secret_set(app: AppHandle, account: String, value: String) -> Result<(), String> {
    #[cfg(debug_assertions)]
    return dev_secrets::set(&app, account, value);
    #[cfg(not(debug_assertions))]
    {
        let _ = app;
        keyring::Entry::new(KEYCHAIN_SERVICE, &account)
            .and_then(|e| e.set_password(&value))
            .map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn secret_delete(app: AppHandle, account: String) -> Result<(), String> {
    #[cfg(debug_assertions)]
    return dev_secrets::delete(&app, &account);
    #[cfg(not(debug_assertions))]
    {
        let _ = app;
        match keyring::Entry::new(KEYCHAIN_SERVICE, &account).and_then(|e| e.delete_credential()) {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(e.to_string()),
        }
    }
}

/// Places the popover just below the menubar tray icon. The positioner plugin only learns the tray
/// rect from a tray click, so on first launch (no click yet) it would drop the window dead-centre;
/// reading the tray rect directly avoids that. Falls back to the plugin's TrayBottomCenter.
fn position_popover(app: &AppHandle, window: &tauri::WebviewWindow) {
    if let Some(tray) = app.tray_by_id("main") {
        if let (Ok(Some(rect)), Ok(win), Ok(scale)) = (tray.rect(), window.outer_size(), window.scale_factor()) {
            let pos = rect.position.to_physical::<i32>(scale);
            let size = rect.size.to_physical::<i32>(scale);
            let mut x = pos.x + size.width / 2 - win.width as i32 / 2;
            let y = pos.y + size.height;
            // Keep the window on screen when the tray icon sits near the right edge.
            if let Ok(Some(monitor)) = window.current_monitor() {
                let max_x = (monitor.size().width as i32 - win.width as i32 - 8).max(8);
                x = x.clamp(8, max_x);
            }
            if window.set_position(PhysicalPosition::new(x, y)).is_ok() {
                return;
            }
        }
    }
    let _ = window.move_window(Position::TrayBottomCenter);
}

/// Shows the popover programmatically (first launch, or when a notification is clicked).
#[tauri::command]
fn show_popover(app: AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    position_popover(&app, &window);
    let _ = window.show();
    let _ = window.set_focus();
}

/// Brings the app window forward if it's open; false when there is none.
fn focus_existing_app_window(app: &AppHandle) -> bool {
    let Some(window) = app.get_webview_window("app") else { return false };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    true
}

/// The regular app window, next to the menubar popover. Built on demand and destroyed on close: while it exists the app
/// sits in the Dock and ⌘Tab, once it closes the app goes back to living in the menubar only (see on_window_event).
fn open_app_window(app: &AppHandle) {
    if focus_existing_app_window(app) {
        return;
    }
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    #[cfg(target_os = "macos")]
    {
        let _ = app.run_on_main_thread(restore_dock_icon);
        // The Dock can build its tile late (at login, or when the window never takes focus), after both other calls; once
        // more a moment later so the tile isn't left blank.
        let app = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(600));
            let _ = app.run_on_main_thread(restore_dock_icon);
        });
    }
    // Built in the theme the popover already has (it follows Settings → Theme) so the splash comes up in the right colours.
    let theme = app.get_webview_window("main").and_then(|w| w.theme().ok());
    // The same native material as the popover (tauri.conf.json), so both read as one surface. It also fixes the white
    // flash: a WKWebView paints its own white until its page draws, but this webview is transparent over the material,
    // which macOS draws from the window's first frame — then index.html's splash, then the app.
    let builder = WebviewWindowBuilder::new(app, "app", WebviewUrl::default())
        .title("AssignedToMe")
        .inner_size(900.0, 640.0)
        .min_inner_size(420.0, 480.0)
        .center()
        .theme(theme)
        .transparent(true)
        .effects(
            tauri::window::EffectsBuilder::new()
                .effect(tauri::window::Effect::Popover)
                // Active even when unfocused, like the popover, so the window doesn't turn flat grey in the background.
                .state(tauri::window::EffectState::Active)
                .build(),
        );
    // No title-bar strip: the traffic lights sit inside the app's own 44px header, vertically centred on it.
    #[cfg(target_os = "macos")]
    let builder = builder
        .title_bar_style(tauri::TitleBarStyle::Overlay)
        .hidden_title(true)
        // y is an inset, not the centre: 24 puts the lights' centre on the header's 22px midline (measured on screen).
        .traffic_light_position(tauri::LogicalPosition::new(16.0, 24.0));
    if let Ok(window) = builder.build() {
        let _ = window.set_focus();
    }
}

/// The app starts out of the Dock (Accessory) and joins it when the window opens. On that switch macOS builds the Dock
/// tile without an icon: blank in a release .app (its icon.icns is ignored here), the generic "exec" one in `tauri dev`.
/// So set the icon ourselves, in every build. Must run on the main thread.
#[cfg(target_os = "macos")]
fn restore_dock_icon() {
    use objc2::{AllocAnyThread, MainThreadMarker};
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;
    let Some(mtm) = MainThreadMarker::new() else { return };
    let data = NSData::with_bytes(include_bytes!("../icons/icon.png"));
    if let Some(icon) = NSImage::initWithData(NSImage::alloc(), &data) {
        unsafe { NSApplication::sharedApplication(mtm).setApplicationIconImage(Some(&icon)) };
    }
}

/// Async on purpose: building a window from a synchronous command can deadlock.
#[tauri::command]
async fn show_app_window(app: AppHandle) {
    open_app_window(&app);
}

/// For a notification click: true when the app window was open and is now in front, false to fall back to the popover.
#[tauri::command]
fn focus_app_window(app: AppHandle) -> bool {
    focus_existing_app_window(&app)
}

/// Launch at login starts out on: the first run of a packaged app registers it, once. From then on it's the user's
/// switch in Settings, and turning it off is never undone. Not in `tauri dev`, which would register the debug binary.
#[cfg(not(debug_assertions))]
fn enable_launch_at_login_once(app: &AppHandle) {
    use tauri_plugin_autostart::ManagerExt as _;
    const KEY: &str = "launchAtLoginDefaulted";
    let Ok(store) = app.store("mytask.json") else { return };
    if store.get(KEY).is_some() {
        return;
    }
    if app.autolaunch().enable().is_ok() {
        store.set(KEY, true);
        let _ = store.save();
    }
}

/// Settings → "Open the window at launch" (also chosen in onboarding); on unless the user picked menubar only.
fn opens_window_at_launch(app: &AppHandle) -> bool {
    app.store("mytask.json")
        .ok()
        .and_then(|store| store.get("openWindow"))
        .and_then(|value| value.as_bool())
        .unwrap_or(true)
}

/// Notifications through macOS's current API (UNUserNotificationCenter). The notification plugin asks for nothing
/// on desktop and posts through the retired NSUserNotification API, which this macOS drops without a trace: that's
/// why new-task alerts never appeared. Only inside a real .app: for a bare `tauri dev` binary the notification center
/// throws (crashing the app), so dev falls back to the plugin.
#[cfg(target_os = "macos")]
mod native_notifications {
    use std::sync::OnceLock;

    use objc2::rc::Retained;
    use objc2::runtime::{NSObject, NSObjectProtocol, ProtocolObject};
    use objc2::{define_class, msg_send, AllocAnyThread};
    use objc2_foundation::{NSBundle, NSError, NSString};
    use objc2_user_notifications::{
        UNAuthorizationOptions, UNMutableNotificationContent, UNNotification, UNNotificationPresentationOptions,
        UNNotificationRequest, UNNotificationResponse, UNNotificationSound, UNUserNotificationCenter,
        UNUserNotificationCenterDelegate,
    };
    use tauri::{AppHandle, Emitter};

    static APP: OnceLock<AppHandle> = OnceLock::new();

    pub fn available() -> bool {
        NSBundle::mainBundle().bundlePath().to_string().ends_with(".app")
    }

    define_class!(
        // SAFETY: NSObject has no subclassing requirements and this class doesn't implement Drop.
        #[unsafe(super(NSObject))]
        #[name = "AssignedToMeNotificationDelegate"]
        struct Delegate;

        unsafe impl NSObjectProtocol for Delegate {}

        unsafe impl UNUserNotificationCenterDelegate for Delegate {
            // Show the banner even while the app is in front; the center hides it then by default.
            #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
            fn will_present(
                &self,
                _center: &UNUserNotificationCenter,
                _notification: &UNNotification,
                done: &block2::DynBlock<dyn Fn(UNNotificationPresentationOptions)>,
            ) {
                done.call((UNNotificationPresentationOptions::Banner
                    | UNNotificationPresentationOptions::List
                    | UNNotificationPresentationOptions::Sound,));
            }

            // A click: tell the app which board and task it was about (packed into the request id by `show`).
            #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
            fn did_receive(
                &self,
                _center: &UNUserNotificationCenter,
                response: &UNNotificationResponse,
                done: &block2::DynBlock<dyn Fn()>,
            ) {
                let id = response.notification().request().identifier().to_string();
                let mut parts = id.split('\n');
                let board = parts.next().unwrap_or_default().to_string();
                let task = parts.next().unwrap_or_default().to_string();
                if let Some(app) = APP.get() {
                    let _ = app.emit("notification-clicked", (board, task));
                }
                done.call(());
            }
        }
    );

    /// Shows the "Allow notifications from AssignedToMe?" prompt; once answered, it does nothing visible.
    pub fn request_permission() {
        let done = block2::RcBlock::new(|_granted: objc2::runtime::Bool, _error: *mut NSError| {});
        UNUserNotificationCenter::currentNotificationCenter()
            .requestAuthorizationWithOptions_completionHandler(UNAuthorizationOptions::Alert | UNAuthorizationOptions::Sound, &done);
    }

    /// Becomes the notification center's delegate (clicks, banners while in front). Once, at startup, on the main thread.
    pub fn install(app: &AppHandle) {
        let _ = APP.set(app.clone());
        let delegate: Retained<Delegate> = unsafe { msg_send![Delegate::alloc(), init] };
        UNUserNotificationCenter::currentNotificationCenter().setDelegate(Some(ProtocolObject::from_ref(&*delegate)));
        // The center only holds its delegate weakly; this one has to live as long as the app.
        std::mem::forget(delegate);
    }

    pub fn show(title: &str, body: &str, board: &str, task: &str) {
        let content = UNMutableNotificationContent::new();
        content.setTitle(&NSString::from_str(title));
        content.setBody(&NSString::from_str(body));
        content.setSound(Some(&UNNotificationSound::defaultSound()));
        // Unique per notification; the click handler reads the board and task back out of it.
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or_default();
        let id = NSString::from_str(&format!("{board}\n{task}\n{nanos}"));
        let request = UNNotificationRequest::requestWithIdentifier_content_trigger(&id, &content, None);
        UNUserNotificationCenter::currentNotificationCenter().addNotificationRequest_withCompletionHandler(&request, None);
    }
}

/// Shows macOS's "Allow notifications from AssignedToMe?" prompt (from onboarding); once answered, does nothing visible.
#[tauri::command]
fn request_notification_permission() {
    #[cfg(target_os = "macos")]
    if native_notifications::available() {
        native_notifications::request_permission();
    }
}

/// Posts a task notification; empty board and task for the "several new tasks" summary. A click arrives as the
/// "notification-clicked" event with (board, task).
#[tauri::command]
fn notify_task(app: AppHandle, title: String, body: String, board: String, task: String) {
    #[cfg(target_os = "macos")]
    if native_notifications::available() {
        native_notifications::show(&title, &body, &board, &task);
        return;
    }
    // `tauri dev`: the plugin (macOS shows these as from Terminal), without click-through.
    let _ = (&board, &task);
    use tauri_plugin_notification::NotificationExt;
    let _ = app.notification().builder().title(title).body(body).show();
}

/// Opens macOS System Settings at the Notifications pane so the user manages this app's alerts where the OS owns them.
#[tauri::command]
fn open_notification_settings() {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=com.mytask.desktop")
        .spawn();
}

/// Lets the main window's http plugin reach one more https origin, chosen by the user as a connection address.
/// Cloud hosts are already allowed statically in capabilities/default.json.
#[tauri::command]
fn allow_http_origin(app: AppHandle, origin: String) -> Result<(), String> {
    let url = tauri::Url::parse(&origin).map_err(|_| "invalid origin".to_string())?;
    let host = url.host_str().ok_or("origin has no host")?;
    if url.scheme() != "https" || !url.username().is_empty() || url.password().is_some() || url.path() != "/" || url.query().is_some() {
        return Err("only a bare https origin is allowed".into());
    }
    let canonical = match url.port() {
        Some(port) => format!("https://{host}:{port}"),
        None => format!("https://{host}"),
    };
    let state = app.state::<AllowedOrigins>();
    let mut allowed = state.0.lock().unwrap();
    if allowed.contains(&canonical) {
        return Ok(());
    }
    let id: String = format!("http-{canonical}")
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let capability = CapabilityBuilder::new(id).windows(["main", "app"]).permission_scoped(
        "http:default",
        vec![serde_json::json!({ "url": format!("{canonical}/*") })],
        Vec::<serde_json::Value>::new(),
    );
    app.add_capability(capability).map_err(|e| e.to_string())?;
    allowed.insert(canonical);
    Ok(())
}

fn toggle_popover(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else { return };
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
        return;
    }
    let just_hidden = app
        .state::<LastBlurHide>()
        .0
        .lock()
        .unwrap()
        .is_some_and(|t| t.elapsed() < Duration::from_millis(300));
    if just_hidden {
        return;
    }
    position_popover(app, &window);
    let _ = window.show();
    let _ = window.set_focus();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(LastBlurHide(Mutex::new(None)))
        .manage(AllowedOrigins(Mutex::new(HashSet::new())))
        .plugin(tauri_plugin_autostart::Builder::new().arg("--autostart").build())
        .plugin(tauri_plugin_positioner::init())
        // In-app updates from GitHub Releases (latest.json), verified against the pubkey in tauri.conf.json.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_nspanel::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            secret_get,
            secret_set,
            secret_delete,
            allow_http_origin,
            open_notification_settings,
            request_notification_permission,
            notify_task,
            show_popover,
            show_app_window,
            focus_app_window
        ])
        .setup(|app| {
            // Menubar-only app: no Dock icon, no app switcher entry.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            // Turn the popover window into a panel that can appear over full-screen apps.
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                use tauri_nspanel::{CollectionBehavior, PanelLevel, StyleMask, WebviewWindowExt};
                if let Ok(panel) = window.to_panel::<PopoverPanel>() {
                    panel.set_level(PanelLevel::Floating.value());
                    let _ = panel.add_style_mask(StyleMask::empty().nonactivating_panel().into());
                    // move_to_active_space (not can_join_all_spaces): the popover comes to the current Space when opened — over a
                    // full-screen app too — but doesn't linger on every Space, which would flicker as you switch Spaces.
                    panel.set_collection_behavior(CollectionBehavior::new().full_screen_auxiliary().move_to_active_space().into());
                }
            }

            let open = MenuItem::with_id(app, "open", "Open Window", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit AssignedToMe", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true)
                .tooltip("AssignedToMe")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => open_app_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    tauri_plugin_positioner::on_tray_event(tray.app_handle(), &event);
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popover(tray.app_handle());
                    }
                })
                .build(app)?;

            #[cfg(not(debug_assertions))]
            enable_launch_at_login_once(app.handle());

            // Notifications go through macOS's own API: the delegate (clicks, banners while in front) must be in place
            // before any arrives. Whoever finished onboarding before it asked (0.1.2 and older) is asked once here;
            // anyone who already answered sees nothing.
            #[cfg(target_os = "macos")]
            if native_notifications::available() {
                native_notifications::install(app.handle());
                let onboarded = app.store("mytask.json").ok().and_then(|s| s.get("onboarded")).and_then(|v| v.as_bool());
                if onboarded == Some(true) {
                    native_notifications::request_permission();
                }
            }

            // Launched by the user (Finder/Launchpad), not at login: open the window, or the popover for menubar-only users.
            if !std::env::args().any(|a| a == "--autostart") {
                if opens_window_at_launch(app.handle()) {
                    open_app_window(app.handle());
                } else {
                    show_popover(app.handle().clone());
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            // Only the popover hides when it loses focus; the app window behaves like any other window.
            WindowEvent::Focused(false) if window.label() == "main" => {
                let _ = window.hide();
                *window.state::<LastBlurHide>().0.lock().unwrap() = Some(Instant::now());
            }
            // Again once the window is up: the Dock may only build its tile after the switch above has returned.
            #[cfg(target_os = "macos")]
            WindowEvent::Focused(true) if window.label() == "app" => restore_dock_icon(),
            // App window closed: leave the Dock and keep running in the menubar. ⌘Q / Dock → Quit still quits.
            #[cfg(target_os = "macos")]
            WindowEvent::Destroyed if window.label() == "app" => {
                let _ = window.app_handle().set_activation_policy(tauri::ActivationPolicy::Accessory);
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Clicking the Dock icon or launching the app again from Finder brings the window back.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                open_app_window(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
