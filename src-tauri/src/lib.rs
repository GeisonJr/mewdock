mod placement;
mod settings;

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use placement::{cursor_hits, window_origin, HitRect, Side};
use settings::Settings;
use tauri::image::Image;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, State, WebviewWindow};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

const WINDOW_WIDTH: f64 = 240.0;
const WINDOW_HEIGHT: f64 = 64.0;
const POLL_INTERVAL: Duration = Duration::from_millis(50);
// Re-place the window every ~2 s so it follows display or resolution changes.
const PLACE_EVERY_TICKS: u32 = 40;

#[derive(Default)]
struct Shared {
    hit_rect: Mutex<HitRect>,
    side: Mutex<Side>,
}

type SharedState = Arc<Shared>;

#[tauri::command]
fn set_hit_rect(rect: HitRect, state: State<'_, SharedState>) {
    *state.hit_rect.lock().unwrap() = rect;
}

fn place(window: &WebviewWindow, side: Side) {
    let Ok(Some(monitor)) = window.primary_monitor() else {
        return;
    };
    let origin = window_origin(
        *monitor.position(),
        *monitor.size(),
        monitor.scale_factor(),
        (WINDOW_WIDTH, WINDOW_HEIGHT),
        side,
    );
    if window.outer_position().ok() != Some(origin) {
        let _ = window.set_position(origin);
    }
}

// The window is click-through except over the cat, so it never blocks the desktop or the Dock.
fn watch_cursor(app: AppHandle, window: WebviewWindow, shared: SharedState) {
    thread::spawn(move || {
        let mut ignoring: Option<bool> = None;
        let mut ticks: u32 = 0;
        loop {
            if ticks % PLACE_EVERY_TICKS == 0 {
                place(&window, *shared.side.lock().unwrap());
            }
            ticks = ticks.wrapping_add(1);

            let (Ok(cursor), Ok(origin), Ok(scale)) = (
                app.cursor_position(),
                window.outer_position(),
                window.scale_factor(),
            ) else {
                thread::sleep(POLL_INTERVAL);
                continue;
            };
            let rect = *shared.hit_rect.lock().unwrap();
            let ignore = !cursor_hits(
                cursor,
                PhysicalPosition::new(f64::from(origin.x), f64::from(origin.y)),
                scale,
                rect,
            );
            if ignoring != Some(ignore) && window.set_ignore_cursor_events(ignore).is_ok() {
                ignoring = Some(ignore);
            }
            thread::sleep(POLL_INTERVAL);
        }
    });
}

fn build_tray(app: &AppHandle, shared: SharedState, settings: Settings) -> tauri::Result<()> {
    let pause = CheckMenuItem::with_id(app, "pause", "Pause", true, false, None::<&str>)?;
    let left = CheckMenuItem::with_id(
        app,
        "side-left",
        "Left of the Dock",
        true,
        settings.side == Side::Left,
        None::<&str>,
    )?;
    let right = CheckMenuItem::with_id(
        app,
        "side-right",
        "Right of the Dock",
        true,
        settings.side == Side::Right,
        None::<&str>,
    )?;
    let login = CheckMenuItem::with_id(
        app,
        "login",
        "Start at Login",
        true,
        app.autolaunch().is_enabled().unwrap_or(false),
        None::<&str>,
    )?;
    let quit = MenuItem::with_id(app, "quit", "Quit Mewdock", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &pause,
            &PredefinedMenuItem::separator(app)?,
            &left,
            &right,
            &PredefinedMenuItem::separator(app)?,
            &login,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    TrayIconBuilder::with_id("main")
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .icon_as_template(true)
        .tooltip("Mewdock")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "pause" => {
                let paused = pause.is_checked().unwrap_or(false);
                let _ = app.emit_to("main", "paused", paused);
            }
            id @ ("side-left" | "side-right") => {
                let side = if id == "side-left" { Side::Left } else { Side::Right };
                let _ = left.set_checked(side == Side::Left);
                let _ = right.set_checked(side == Side::Right);
                *shared.side.lock().unwrap() = side;
                Settings { side }.save(app);
                if let Some(window) = app.get_webview_window("main") {
                    place(&window, side);
                }
            }
            "login" => {
                let wanted = login.is_checked().unwrap_or(false);
                let autolaunch = app.autolaunch();
                let result = if wanted { autolaunch.enable() } else { autolaunch.disable() };
                if let Err(error) = result {
                    eprintln!("could not change start at login: {error}");
                    let _ = login.set_checked(!wanted);
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![set_hit_rect])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let settings = Settings::load(app.handle());
            let shared = SharedState::default();
            *shared.side.lock().unwrap() = settings.side;
            app.manage(Arc::clone(&shared));

            let window = app
                .get_webview_window("main")
                .expect("main window is defined in tauri.conf.json");
            place(&window, settings.side);
            window.set_ignore_cursor_events(true)?;
            window.show()?;

            build_tray(app.handle(), Arc::clone(&shared), settings)?;
            watch_cursor(app.handle().clone(), window, shared);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Mewdock");
}
