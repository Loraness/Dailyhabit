use active_win_pos_rs::get_active_window;
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::sync::atomic::{AtomicBool, AtomicU8, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use sysinfo::{ProcessExt, System, SystemExt};
use tauri::{Manager, State};
use tauri_plugin_autostart::MacosLauncher;

struct Rules {
    browsers: Vec<(String, Vec<String>)>,
    sites: Vec<(String, Vec<String>)>,
    apps: Vec<(String, Vec<String>)>,
}

impl Rules {
    fn from_json(json: &serde_json::Value) -> Self {
        let mut browsers = Vec::new();
        if let Some(arr) = json["browsers"].as_array() {
            for b in arr {
                let name = b["name"].as_str().unwrap_or("Browser").to_string();
                let matches = b["matches"]
                    .as_array()
                    .map(|m| {
                        m.iter()
                            .filter_map(|s| s.as_str().map(|v| v.to_lowercase()))
                            .collect()
                    })
                    .unwrap_or_default();
                browsers.push((name, matches));
            }
        }

        let mut sites = Vec::new();
        if let Some(arr) = json["sites"].as_array() {
            for s in arr {
                let name = s["name"].as_str().unwrap_or("Unknown Site").to_string();
                let matches = s["matches"]
                    .as_array()
                    .map(|m| {
                        m.iter()
                            .filter_map(|s| s.as_str().map(|v| v.to_lowercase()))
                            .collect()
                    })
                    .unwrap_or_default();
                sites.push((name, matches));
            }
        }

        let mut apps = Vec::new();
        if let Some(arr) = json["apps"].as_array() {
            for a in arr {
                let name = a["name"].as_str().unwrap_or("Unknown App").to_string();
                let matches = a["matches"]
                    .as_array()
                    .map(|m| {
                        m.iter()
                            .filter_map(|s| s.as_str().map(|v| v.to_lowercase()))
                            .collect()
                    })
                    .unwrap_or_default();
                apps.push((name, matches));
            }
        }

        Rules {
            browsers,
            sites,
            apps,
        }
    }
}

struct AppState {
    conn: Arc<Mutex<Connection>>,
    cache: Arc<Mutex<HashMap<String, (i32, i32)>>>,
    timer_state: Arc<AtomicU8>,
    ignored_apps: Arc<Mutex<HashSet<String>>>,
    force_flush: Arc<AtomicBool>,
    current_session_id: Arc<AtomicUsize>,
}

#[derive(serde::Serialize)]
struct AppUsage {
    name: String,
    active_duration: i32,
    background_duration: i32,
}

#[derive(serde::Serialize)]
struct DailyTotal {
    date: String,
    total_active: i32,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct FocusApp {
    name: String,
    duration: i32,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct FocusSession {
    id: usize,
    duration: i32,
    apps: Vec<FocusApp>,
}

#[derive(serde::Serialize)]
struct FocusDayData {
    apps: Vec<FocusApp>,
    focus_time: i32,
    rest_time: i32,
    sessions: Vec<FocusSession>,
}

fn is_system_process(name: &str) -> bool {
    let lower_name = name.to_lowercase();
    if lower_name.contains("windowsshellexperience")
        || lower_name.contains("shell experience")
        || lower_name.contains("searchapplication")
        || lower_name.contains("setup")
        || lower_name.contains("uninstall")
    {
        return true;
    }

    let base_name = lower_name.trim_end_matches(".exe");
    let exact_matches_bases = [
        "svchost",
        "dllhost",
        "sihost",
        "taskhostw",
        "explorer",
        "searchapp",
        "startmenuexperiencehost",
        "csrss",
        "smss",
        "wininit",
        "services",
        "lsass",
        "winlogon",
        "fontdrvhost",
        "dwm",
        "spoolsv",
        "memory compression",
        "system idle process",
        "system",
        "registry",
        "conhost",
        "runtimebroker",
        "aggregatorhost",
        "applemobiledeviceservice",
        "applicationframehost",
        "searchindexer",
        "ctfmon",
        "smartscreen",
        "securityhealthservice",
        "usocoreworker",
        "unknown",
        "screenclippinghost",
        "winws",
        "searchhost",
        "searchfilterhost",
        "taskmgr",
        "wudfhost",
        "rtkauduservice64",
        "rundll32",
        "lockapp",
        "wsnativepushservice",
        "wstoastnotification",
        "updater",
        "msmpeng",
        "nisssrv",
    ];

    exact_matches_bases.contains(&base_name)
}

fn get_clean_name(app_name: &str, title: &str, rules: &Rules) -> String {
    let clean_app_name: String = app_name
        .chars()
        .filter(|c| c.is_alphanumeric() || c.is_ascii_punctuation() || *c == ' ')
        .collect();
    let lower_app = clean_app_name.to_lowercase();
    let lower_title = title.to_lowercase();

    if lower_app.contains("spotify") {
        return "Spotify".to_string();
    }
    if lower_app.contains("discord") {
        return "Discord".to_string();
    }

    let mut final_name = clean_app_name.clone();

    let browser_match = rules
        .browsers
        .iter()
        .find(|(_, matches)| matches.iter().any(|m| lower_app.contains(m)));

    if let Some((b_name, _)) = browser_match {
        final_name = b_name.clone();
        if !lower_title.is_empty() {
            if let Some((s_name, _)) = rules
                .sites
                .iter()
                .find(|(_, matches)| matches.iter().any(|m| lower_title.contains(m)))
            {
                final_name = s_name.clone();
            }
        }
    } else {
        if let Some((a_name, _)) = rules.apps.iter().find(|(_, matches)| {
            matches
                .iter()
                .any(|m| lower_app.contains(m) || lower_title.contains(m))
        }) {
            final_name = a_name.clone();
        } else {
            if lower_app.ends_with(".exe") {
                final_name = final_name[..final_name.len() - 4].to_string();
            }
            let mut chars = final_name.chars();
            final_name = if let Some(first_char) = chars.next() {
                format!("{}{}", first_char.to_uppercase(), chars.as_str())
            } else {
                "Unknown".to_string()
            };
        }
    }
    final_name
}

#[tauri::command]
fn get_stats_for_date(state: State<'_, AppState>, date: String) -> Result<Vec<AppUsage>, String> {
    let conn = state.conn.lock().unwrap();

    // Get current date string from DB to check if we should add cache
    let today: String = conn
        .query_row("SELECT date('now', 'localtime')", [], |row| row.get(0))
        .unwrap_or_default();

    let mut stmt = conn
        .prepare("SELECT app_name, active_duration, background_duration FROM daily_stats WHERE date = ?1")
        .map_err(|e| e.to_string())?;

    let app_iter = stmt
        .query_map([&date], |row| {
            Ok(AppUsage {
                name: row.get(0)?,
                active_duration: row.get(1)?,
                background_duration: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut db_apps: HashMap<String, AppUsage> = HashMap::new();
    for app in app_iter {
        if let Ok(a) = app {
            db_apps.insert(a.name.clone(), a);
        }
    }

    if date == today {
        let cache = state.cache.lock().unwrap();
        for (app_name, (active_time, bg_time)) in cache.iter() {
            if let Some(existing) = db_apps.get_mut(app_name) {
                existing.active_duration += active_time;
                existing.background_duration += bg_time;
            } else {
                db_apps.insert(
                    app_name.clone(),
                    AppUsage {
                        name: app_name.clone(),
                        active_duration: *active_time,
                        background_duration: *bg_time,
                    },
                );
            }
        }
    }

    Ok(db_apps.into_values().collect())
}

#[tauri::command]
fn get_month_stats(state: State<'_, AppState>, month: String) -> Result<Vec<DailyTotal>, String> {
    let conn = state.conn.lock().unwrap();
    let query =
        "SELECT date, SUM(active_duration) FROM daily_stats WHERE date LIKE ?1 GROUP BY date";
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([format!("{}%", month)], |row| {
            Ok(DailyTotal {
                date: row.get(0)?,
                total_active: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut res = Vec::new();
    for item in iter {
        if let Ok(i) = item {
            res.push(i);
        }
    }
    Ok(res)
}

#[tauri::command]
fn show_window(window: tauri::Window) {
    // 1. Разворачиваем окно, если оно было свернуто
    let _ = window.unminimize();
    // 2. Делаем окно видимым
    let _ = window.show();
    // 3. Пытаемся передать фокус
    let _ = window.set_focus();

    // 4. ХАК для принудительного вывода на передний план в Windows
    // Включаем режим "поверх всех" и сразу выключаем — это заставляет ОС выдвинуть окно вперед.
    let _ = window.set_always_on_top(true);
    let _ = window.set_always_on_top(false);
}

#[tauri::command]
fn get_focus_stats(state: State<'_, AppState>, date: String) -> Result<FocusDayData, String> {
    let conn = state.conn.lock().unwrap();
    let mut apps = Vec::new();

    if let Ok(mut stmt) = conn.prepare("SELECT app_name, duration FROM focus_apps WHERE date = ?1")
    {
        if let Ok(app_iter) = stmt.query_map([&date], |row| {
            Ok(FocusApp {
                name: row.get(0)?,
                duration: row.get(1)?,
            })
        }) {
            for app in app_iter {
                if let Ok(a) = app {
                    apps.push(a);
                }
            }
        }
    }

    let mut focus_time = 0;
    let mut rest_time = 0;
    if let Ok(mut stmt_totals) =
        conn.prepare("SELECT focus_duration, rest_duration FROM focus_totals WHERE date = ?1")
    {
        if let Ok(mut totals_iter) = stmt_totals.query_map([&date], |row| {
            Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?))
        }) {
            if let Some(Ok((f, r))) = totals_iter.next() {
                focus_time = f;
                rest_time = r;
            }
        }
    }

    let mut sessions = Vec::new();
    if let Ok(mut stmt_sessions) = conn.prepare("SELECT id, duration FROM focus_sessions WHERE date = ?1 ORDER BY id ASC") {
        if let Ok(session_iter) = stmt_sessions.query_map([&date], |row| {
            let id: usize = row.get(0)?;
            let duration: i32 = row.get(1)?;
            Ok((id, duration))
        }) {
            for s in session_iter {
                if let Ok((id, duration)) = s {
                    if duration > 0 {
                        let mut session_apps = Vec::new();
                        if let Ok(mut stmt_apps) = conn.prepare("SELECT app_name, duration FROM focus_session_apps WHERE session_id = ?1") {
                            if let Ok(app_iter) = stmt_apps.query_map([id], |row| {
                                Ok(FocusApp {
                                    name: row.get(0)?,
                                    duration: row.get(1)?,
                                })
                            }) {
                                for app in app_iter {
                                    if let Ok(a) = app {
                                        session_apps.push(a);
                                    }
                                }
                            }
                        }
                        sessions.push(FocusSession {
                            id,
                            duration,
                            apps: session_apps,
                        });
                    }
                }
            }
        }
    }

    Ok(FocusDayData {
        apps,
        focus_time,
        rest_time,
        sessions,
    })
}

#[tauri::command]
fn start_new_focus_session(state: State<'_, AppState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let _ = conn.execute("INSERT INTO focus_sessions (date, duration) VALUES (date('now', 'localtime'), 0)", []);
    let id = conn.last_insert_rowid() as usize;
    state.current_session_id.store(id, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
fn set_timer_state(state: State<'_, AppState>, timer_state: u8) -> Result<(), String> {
    state.timer_state.store(timer_state, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
fn flush_timer_stats(state: State<'_, AppState>) -> Result<(), String> {
    state.force_flush.store(true, Ordering::Relaxed);
    for _ in 0..15 {
        if !state.force_flush.load(Ordering::Relaxed) {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    Ok(())
}

#[tauri::command]
fn save_focus_stats(
    state: State<'_, AppState>,
    date: String,
    apps: HashMap<String, i32>,
    focus_time: i32,
    rest_time: i32,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let _ = conn.execute("INSERT INTO focus_totals (date, focus_duration, rest_duration) VALUES (?1, ?2, ?3) ON CONFLICT(date) DO UPDATE SET focus_duration = ?2, rest_duration = ?3", params![&date, focus_time, rest_time]);

    for (name, duration) in apps {
        let _ = conn.execute("INSERT INTO focus_apps (date, app_name, duration) VALUES (?1, ?2, ?3) ON CONFLICT(date, app_name) DO UPDATE SET duration = ?3", params![&date, name, duration]);
    }
    Ok(())
}

#[tauri::command]
fn get_focus_month_stats(
    state: State<'_, AppState>,
    month: String,
) -> Result<Vec<DailyTotal>, String> {
    let conn = state.conn.lock().unwrap();
    let query = "SELECT date, focus_duration FROM focus_totals WHERE date LIKE ?1";
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([format!("{}%", month)], |row| {
            Ok(DailyTotal {
                date: row.get(0)?,
                total_active: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut res = Vec::new();
    for item in iter {
        if let Ok(i) = item {
            res.push(i);
        }
    }
    Ok(res)
}

#[tauri::command]
fn clear_focus_stats(state: State<'_, AppState>, date: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let _ = conn.execute("DELETE FROM focus_session_apps WHERE session_id IN (SELECT id FROM focus_sessions WHERE date = ?1)", params![&date]);
    let _ = conn.execute("DELETE FROM focus_sessions WHERE date = ?1", params![&date]);
    let _ = conn.execute("DELETE FROM focus_apps WHERE date = ?1", params![&date]);
    let _ = conn.execute("DELETE FROM focus_totals WHERE date = ?1", params![&date]);
    Ok(())
}

#[tauri::command]
fn ignore_app(state: State<'_, AppState>, app_name: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let _ = conn.execute("INSERT OR IGNORE INTO ignored_apps (app_name) VALUES (?1)", params![&app_name]);
    let mut ignored = state.ignored_apps.lock().unwrap();
    ignored.insert(app_name);
    Ok(())
}

#[tauri::command]
fn unignore_app(state: State<'_, AppState>, app_name: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let _ = conn.execute("DELETE FROM ignored_apps WHERE app_name = ?1", params![&app_name]);
    let mut ignored = state.ignored_apps.lock().unwrap();
    ignored.remove(&app_name);
    Ok(())
}

#[tauri::command]
fn get_ignored_apps(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let ignored = state.ignored_apps.lock().unwrap();
    Ok(ignored.iter().cloned().collect())
}

#[tauri::command]
fn delete_app_records(state: State<'_, AppState>, app_name: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let _ = conn.execute("DELETE FROM daily_stats WHERE app_name = ?1", params![&app_name]);
    let _ = conn.execute("DELETE FROM focus_apps WHERE app_name = ?1", params![&app_name]);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--autostart"])))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            if !args.contains(&"--autostart".to_string()) {
                let handle = app.handle().clone();
                thread::spawn(move || {
                    thread::sleep(Duration::from_millis(300));
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.unminimize();
                    }
                });
            }

            let app_data_dir = app.path().app_data_dir().unwrap();
            fs::create_dir_all(&app_data_dir).unwrap();
            let db_path = app_data_dir.join("dailyhabit.db");  
            let conn = Connection::open(db_path).unwrap();

            // Включаем WAL для лучшей производительности
            conn.execute_batch("
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
            ").unwrap();

            conn.execute(
                "CREATE TABLE IF NOT EXISTS daily_stats (
                    date TEXT NOT NULL,
                    app_name TEXT NOT NULL,
                    active_duration INTEGER NOT NULL DEFAULT 0,
                    background_duration INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(date, app_name)
                )",
                [],
            ).unwrap();

            conn.execute("CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)", []).unwrap();

            conn.execute(
                "CREATE TABLE IF NOT EXISTS focus_apps (
                    date TEXT NOT NULL,
                    app_name TEXT NOT NULL,
                    duration INTEGER NOT NULL DEFAULT 0,
                    UNIQUE(date, app_name)
                )",
                [],
            ).unwrap();

            conn.execute(
                "CREATE TABLE IF NOT EXISTS focus_totals (
                    date TEXT NOT NULL UNIQUE,
                    focus_duration INTEGER NOT NULL DEFAULT 0,
                    rest_duration INTEGER NOT NULL DEFAULT 0
                )",
                [],
            ).unwrap();

            conn.execute(
                "CREATE TABLE IF NOT EXISTS focus_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    duration INTEGER NOT NULL DEFAULT 0
                )",
                [],
            ).unwrap();

            conn.execute(
                "CREATE TABLE IF NOT EXISTS focus_session_apps (
                    session_id INTEGER NOT NULL,
                    app_name TEXT NOT NULL,
                    duration INTEGER NOT NULL DEFAULT 0,
                    FOREIGN KEY(session_id) REFERENCES focus_sessions(id),
                    UNIQUE(session_id, app_name)
                )",
                [],
            ).unwrap();

            conn.execute(
                "CREATE TABLE IF NOT EXISTS ignored_apps (
                    app_name TEXT NOT NULL UNIQUE
                )",
                [],
            ).unwrap();

            let mut ignored_set = HashSet::new();
            if let Ok(mut stmt) = conn.prepare("SELECT app_name FROM ignored_apps") {
                if let Ok(iter) = stmt.query_map([], |row| row.get::<_, String>(0)) {
                    for name in iter.flatten() {
                        ignored_set.insert(name);
                    }
                }
            }
            let ignored_apps = Arc::new(Mutex::new(ignored_set));
            let ignored_apps_for_thread = Arc::clone(&ignored_apps);

            let db_conn = Arc::new(Mutex::new(conn));
            let db_conn_for_thread = Arc::clone(&db_conn);
            
            let rules_str = include_str!("../../src/rules.json");
            let rules_json: serde_json::Value = serde_json::from_str(rules_str).unwrap();
            let rules = Rules::from_json(&rules_json);
            let rules_for_thread = Arc::new(rules);

            let app_cache = Arc::new(Mutex::new(HashMap::new()));
            let app_cache_for_thread = Arc::clone(&app_cache);

            let timer_state = Arc::new(AtomicU8::new(0));
            let timer_state_for_thread = Arc::clone(&timer_state);

            let force_flush = Arc::new(AtomicBool::new(false));
            let force_flush_for_thread = Arc::clone(&force_flush);

            let current_session_id = Arc::new(AtomicUsize::new(0));
            let current_session_id_for_thread = Arc::clone(&current_session_id);

            app.manage(AppState { 
                conn: db_conn, 
                cache: app_cache, 
                timer_state, 
                ignored_apps,
                force_flush,
                current_session_id,
            });

            thread::spawn(move || {
                let mut sys = System::new();
                let mut flush_counter = 0;
                let mut name_cache: HashMap<String, String> = HashMap::new();
                let mut known_active_apps: HashSet<String> = HashSet::new();

                let mut focus_time_cache = 0;
                let mut rest_time_cache = 0;
                let mut focus_apps_cache: HashMap<String, i32> = HashMap::new();
                
                let mut session_focus_time_cache = 0;
                let mut focus_session_apps_cache: HashMap<String, i32> = HashMap::new();

                if let Ok(conn) = db_conn_for_thread.lock() {
                    if let Ok(mut stmt) = conn.prepare("SELECT DISTINCT app_name FROM daily_stats WHERE active_duration > 0") {
                        if let Ok(iter) = stmt.query_map([], |row| row.get::<_, String>(0)) {
                            for name in iter.flatten() {
                                known_active_apps.insert(name);
                            }
                        }
                    }
                }

                let mut last_tick = std::time::Instant::now();
                let mut tick_accumulator = 0;
                let mut sys_refresh_accumulator = 60000;

                loop {
                    thread::sleep(Duration::from_millis(1000));
                    let now = std::time::Instant::now();
                    let delta = now.duration_since(last_tick).as_millis() as u64;
                    last_tick = now;

                    tick_accumulator += delta;
                    sys_refresh_accumulator += delta;

                    if sys_refresh_accumulator >= 60000 {
                        sys.refresh_processes();
                        sys_refresh_accumulator %= 60000;
                    }

                    while tick_accumulator >= 5000 {
                        tick_accumulator -= 5000;
                        flush_counter += 1;

                        let mut active_clean_name = String::new();
                        if let Ok(active_window) = get_active_window() {
                            let app_name = active_window.app_name;
                            let title = active_window.title;
                            if !app_name.is_empty() && !is_system_process(&app_name) && !app_name.to_lowercase().contains("dailyhabit") {
                                active_clean_name = get_clean_name(&app_name, &title, &rules_for_thread);
                            }
                        }

                        let mut running_clean_names = HashSet::new();
                        for (_pid, process) in sys.processes() {
                            let name = process.name();
                            if !is_system_process(name) && !name.to_lowercase().contains("dailyhabit") {
                                let clean = if let Some(cached) = name_cache.get(name) {
                                    cached.clone()
                                } else {
                                    let cleaned = get_clean_name(name, "", &rules_for_thread);
                                    name_cache.insert(name.to_string(), cleaned.clone());
                                    cleaned
                                };
                                running_clean_names.insert(clean);
                            }
                        }

                        {
                            let ignored = ignored_apps_for_thread.lock().unwrap();
                            if ignored.contains(&active_clean_name) {
                                active_clean_name.clear();
                            }
                            running_clean_names.retain(|x| !ignored.contains(x));
                        }

                        // Чистим кэш имен изредка
                        if flush_counter % 120 == 0 {
                            name_cache.clear();
                        }

                        {
                            let mut cache_lock = app_cache_for_thread.lock().unwrap();
                            if !active_clean_name.is_empty() {
                                known_active_apps.insert(active_clean_name.clone());
                                let entry = cache_lock.entry(active_clean_name.clone()).or_insert((0, 0));
                                entry.0 += 5;
                            }

                            for app in running_clean_names {
                                if app != active_clean_name && known_active_apps.contains(&app) {
                                    let entry = cache_lock.entry(app).or_insert((0, 0));
                                    entry.1 += 5;
                                }
                            }
                        }

                        let current_state = timer_state_for_thread.load(Ordering::Relaxed);
                        if current_state == 1 {
                            focus_time_cache += 5;
                            session_focus_time_cache += 5;
                            if !active_clean_name.is_empty() {
                                *focus_apps_cache.entry(active_clean_name.clone()).or_insert(0) += 5;
                                *focus_session_apps_cache.entry(active_clean_name.clone()).or_insert(0) += 5;
                            }
                        } else if current_state == 2 {
                            rest_time_cache += 5;
                        }
                    }

                    let force = force_flush_for_thread.swap(false, Ordering::Relaxed);
                    if flush_counter >= 24 || force {
                            if let Ok(conn) = db_conn_for_thread.lock() {
                                let mut cache_lock = app_cache_for_thread.lock().unwrap();
                                
                                for (app_name, (active_time, bg_time)) in cache_lock.drain() {
                                    if active_time > 0 {
                                        let _ = conn.execute("
                                            INSERT INTO daily_stats (date, app_name, active_duration, background_duration)
                                            VALUES (date('now', 'localtime'), ?1, ?2, 0)
                                            ON CONFLICT(date, app_name) DO UPDATE SET active_duration = active_duration + ?2;
                                        ", params![app_name, active_time]);
                                    }
                                    if bg_time > 0 {
                                        let _ = conn.execute("
                                            INSERT INTO daily_stats (date, app_name, active_duration, background_duration)
                                            VALUES (date('now', 'localtime'), ?1, 0, ?2)
                                            ON CONFLICT(date, app_name) DO UPDATE SET background_duration = background_duration + ?2;
                                        ", params![app_name, bg_time]);
                                    }
                                }

                                if focus_time_cache > 0 || rest_time_cache > 0 {
                                    let _ = conn.execute("
                                        INSERT INTO focus_totals (date, focus_duration, rest_duration)
                                        VALUES (date('now', 'localtime'), ?1, ?2)
                                        ON CONFLICT(date) DO UPDATE SET focus_duration = focus_duration + ?1, rest_duration = rest_duration + ?2;
                                    ", params![focus_time_cache, rest_time_cache]);
                                    focus_time_cache = 0;
                                    rest_time_cache = 0;
                                }

                                for (app_name, duration) in focus_apps_cache.drain() {
                                    if duration > 0 {
                                        let _ = conn.execute("
                                            INSERT INTO focus_apps (date, app_name, duration)
                                            VALUES (date('now', 'localtime'), ?1, ?2)
                                            ON CONFLICT(date, app_name) DO UPDATE SET duration = duration + ?2;
                                        ", params![app_name, duration]);
                                    }
                                }
                                
                                let sid = current_session_id_for_thread.load(Ordering::Relaxed);
                                if sid != 0 && (session_focus_time_cache > 0 || !focus_session_apps_cache.is_empty()) {
                                    if session_focus_time_cache > 0 {
                                        let _ = conn.execute("
                                            UPDATE focus_sessions SET duration = duration + ?1 WHERE id = ?2;
                                        ", params![session_focus_time_cache, sid]);
                                        session_focus_time_cache = 0;
                                    }
                                    for (app_name, duration) in focus_session_apps_cache.drain() {
                                        if duration > 0 {
                                            let _ = conn.execute("
                                                INSERT INTO focus_session_apps (session_id, app_name, duration)
                                                VALUES (?1, ?2, ?3)
                                                ON CONFLICT(session_id, app_name) DO UPDATE SET duration = duration + ?3;
                                            ", params![sid, app_name, duration]);
                                        }
                                    }
                                } else {
                                    session_focus_time_cache = 0;
                                    focus_session_apps_cache.clear();
                                }
                            }
                            flush_counter = 0;
                        }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_stats_for_date, get_month_stats, show_window,
            get_focus_stats, save_focus_stats, get_focus_month_stats, clear_focus_stats, set_timer_state, start_new_focus_session,
            flush_timer_stats, ignore_app, unignore_app, get_ignored_apps, delete_app_records
        ])
        .run(tauri::generate_context!())
        .expect("error");
}
