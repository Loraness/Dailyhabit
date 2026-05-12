use active_win_pos_rs::get_active_window;
use rusqlite::{params, Connection};
use std::fs;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use sysinfo::{ProcessExt, System, SystemExt};
use tauri::{Manager, State};
use tauri_plugin_autostart::MacosLauncher;
use std::collections::{HashMap, HashSet};
struct AppState {
    conn: Arc<Mutex<Connection>>,
    // Добавляем ссылку на наш кэш в памяти
    cache: Arc<Mutex<HashMap<String, (i32, i32)>>>,
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

#[derive(serde::Serialize)]
struct FocusDayData {
    apps: Vec<FocusApp>,
    focus_time: i32,
    rest_time: i32,
}

fn is_system_process(name: &str) -> bool {
    let lower_name = name.to_lowercase();
    if lower_name.contains("windowsshellexperience")
        || lower_name.contains("shell experience")
        || lower_name.contains("searchapplication")
    {
        return true;
    }
    let exact_matches = [
        "svchost.exe",
        "dllhost.exe",
        "sihost.exe",
        "taskhostw.exe",
        "explorer.exe",
        "searchapp.exe",
        "startmenuexperiencehost.exe",
        "csrss.exe",
        "smss.exe",
        "wininit.exe",
        "services.exe",
        "lsass.exe",
        "winlogon.exe",
        "fontdrvhost.exe",
        "dwm.exe",
        "spoolsv.exe",
        "memory compression",
        "system idle process",
        "system",
        "registry",
        "conhost.exe",
        "runtimebroker.exe",
        "aggregatorhost.exe",
        "applemobiledeviceservice.exe",
        "applicationframehost.exe",
        "searchindexer.exe",
        "ctfmon.exe",
        "smartscreen.exe",
        "securityhealthservice.exe",
        "usocoreworker.exe",
        "unknown",
        "screenclippinghost.exe",
        "winws.exe",
        "searchhost.exe",
    ];
    for sys_app in exact_matches.iter() {
        if lower_name == *sys_app || lower_name == sys_app.replace(".exe", "") {
            return true;
        }
    }
    false
}

fn get_clean_name(app_name: &str, title: &str, rules: &serde_json::Value) -> String {
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
    let mut is_browser = false;

    if let Some(browsers) = rules["browsers"].as_array() {
        for b in browsers {
            if let Some(matches) = b["matches"].as_array() {
                for m in matches {
                    if lower_app.contains(m.as_str().unwrap_or("")) {
                        is_browser = true;
                        final_name = b["name"].as_str().unwrap_or("Browser").to_string();
                        break;
                    }
                }
            }
            if is_browser {
                break;
            }
        }
    }

    if is_browser && !lower_title.is_empty() {
        let mut site_found = false;
        if let Some(sites) = rules["sites"].as_array() {
            for s in sites {
                if let Some(matches) = s["matches"].as_array() {
                    for m in matches {
                        if lower_title.contains(m.as_str().unwrap_or("")) {
                            final_name = s["name"].as_str().unwrap_or("Unknown Site").to_string();
                            site_found = true;
                            break;
                        }
                    }
                }
                if site_found {
                    break;
                }
            }
        }
    } else if !is_browser {
        let mut app_found = false;
        if let Some(apps) = rules["apps"].as_array() {
            for a in apps {
                if let Some(matches) = a["matches"].as_array() {
                    for m in matches {
                        if lower_app.contains(m.as_str().unwrap_or(""))
                            || lower_title.contains(m.as_str().unwrap_or(""))
                        {
                            final_name = a["name"].as_str().unwrap_or("Unknown App").to_string();
                            app_found = true;
                            break;
                        }
                    }
                }
                if app_found {
                    break;
                }
            }
        }
        if !app_found {
            if lower_app.ends_with(".exe") {
                final_name = final_name[..final_name.len() - 4].to_string();
            }
            let mut chars = final_name.chars();
            if let Some(first_char) = chars.next() {
                final_name = format!("{}{}", first_char.to_uppercase(), chars.as_str());
            } else {
                final_name = "Unknown".to_string();
            }
        }
    }
    final_name
}

// 1. Получение статистики за конкретный день (формат YYYY-MM-DD)
// 1. Получение статистики за конкретный день (формат YYYY-MM-DD)
#[tauri::command]
fn get_stats_for_date(state: State<'_, AppState>, date: String) -> Result<Vec<AppUsage>, String> {
    let conn = state.conn.lock().unwrap();
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

    let mut db_apps: std::collections::HashMap<String, AppUsage> = std::collections::HashMap::new();
    for app in app_iter {
        if let Ok(a) = app {
            db_apps.insert(a.name.clone(), a);
        }
    }

    // МАГИЯ ЗДЕСЬ: ДОБАВЛЯЕМ ДАННЫЕ ИЗ ОПЕРАТИВНОЙ ПАМЯТИ (КЭША)
    let cache = state.cache.lock().unwrap();
    for (app_name, (active_time, bg_time)) in cache.iter() {
        if let Some(existing) = db_apps.get_mut(app_name) {
            existing.active_duration += active_time;
            existing.background_duration += bg_time;
        } else {
            db_apps.insert(app_name.clone(), AppUsage {
                name: app_name.clone(),
                active_duration: *active_time,
                background_duration: *bg_time,
            });
        }
    }

    let mut usage = Vec::new();
    for (_, v) in db_apps {
        usage.push(v);
    }
    Ok(usage)
}

// 2. Получение общей статистики за весь месяц для Календаря (формат YYYY-MM)
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
        res.push(item.unwrap());
    }
    Ok(res)
}

// Специальная команда для принудительного показа окна
// Специальная команда для принудительного показа окна
#[tauri::command]
fn show_window(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        // 1. Показываем и разворачиваем из свернутого состояния
        let _ = window.show();
        let _ = window.unminimize();
        
        // 2. Жестко ставим поверх всех окон и запрашиваем фокус
        let _ = window.set_always_on_top(true);
        let _ = window.set_focus();

        // 3. МАГИЯ ЗДЕСЬ: Ждем 400 мс в отдельном потоке, чтобы винда реально 
        // отрисовала окно поверх игры или браузера, и только потом снимаем флаг.
        let window_clone = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(400));
            let _ = window_clone.set_always_on_top(false);
        });
    }
}

// --- КОМАНДЫ ДЛЯ ИСТОРИИ ФОКУСА ---

#[tauri::command]
fn get_focus_stats(state: State<'_, AppState>, date: String) -> Result<FocusDayData, String> {
    let conn = state.conn.lock().unwrap();
    let mut apps = Vec::new();
    
    // Получаем приложения
    if let Ok(mut stmt) = conn.prepare("SELECT app_name, duration FROM focus_apps WHERE date = ?1") {
        if let Ok(app_iter) = stmt.query_map([&date], |row| {
            Ok(FocusApp { name: row.get(0)?, duration: row.get(1)? })
        }) {
            for app in app_iter { if let Ok(a) = app { apps.push(a); } }
        }
    }

    // Получаем общее время
    let mut focus_time = 0;
    let mut rest_time = 0;
    if let Ok(mut stmt_totals) = conn.prepare("SELECT focus_duration, rest_duration FROM focus_totals WHERE date = ?1") {
        if let Ok(mut totals_iter) = stmt_totals.query_map([&date], |row| Ok((row.get::<_, i32>(0)?, row.get::<_, i32>(1)?))) {
            if let Some(Ok((f, r))) = totals_iter.next() {
                focus_time = f;
                rest_time = r;
            }
        }
    }

    Ok(FocusDayData { apps, focus_time, rest_time })
}

#[tauri::command]
fn save_focus_stats(state: State<'_, AppState>, date: String, apps: std::collections::HashMap<String, i32>, focus_time: i32, rest_time: i32) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let _ = conn.execute("INSERT INTO focus_totals (date, focus_duration, rest_duration) VALUES (?1, ?2, ?3) ON CONFLICT(date) DO UPDATE SET focus_duration = ?2, rest_duration = ?3", params![&date, focus_time, rest_time]);
    
    for (name, duration) in apps {
        let _ = conn.execute("INSERT INTO focus_apps (date, app_name, duration) VALUES (?1, ?2, ?3) ON CONFLICT(date, app_name) DO UPDATE SET duration = ?3", params![&date, name, duration]);
    }
    Ok(())
}

#[tauri::command]
fn get_focus_month_stats(state: State<'_, AppState>, month: String) -> Result<Vec<DailyTotal>, String> {
    let conn = state.conn.lock().unwrap();
    let query = "SELECT date, focus_duration FROM focus_totals WHERE date LIKE ?1";
    let mut stmt = conn.prepare(query).map_err(|e| e.to_string())?;
    let iter = stmt.query_map([format!("{}%", month)], |row| {
        Ok(DailyTotal { date: row.get(0)?, total_active: row.get(1)? })
    }).map_err(|e| e.to_string())?;
    
    let mut res = Vec::new();
    for item in iter { res.push(item.unwrap()); }
    Ok(res)
}

#[tauri::command]
fn clear_focus_stats(state: State<'_, AppState>, date: String) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    let _ = conn.execute("DELETE FROM focus_apps WHERE date = ?1", params![&date]);
    let _ = conn.execute("DELETE FROM focus_totals WHERE date = ?1", params![&date]);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        // Инициализируем плагин одного окна
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        // Инициализируем плагин автозапуска (передаем флаг --autostart)
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec!["--autostart"])))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Проверяем, запущен ли апп пользователем или автозапуском
            let args: Vec<String> = std::env::args().collect();
            if !args.contains(&"--autostart".to_string()) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            let app_data_dir = app.path().app_data_dir().unwrap();
            fs::create_dir_all(&app_data_dir).unwrap();
            let db_path = app_data_dir.join("dailyhabit.db");  
            let conn = Connection::open(db_path).unwrap();

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

            let db_conn = Arc::new(Mutex::new(conn));
            let db_conn_for_thread = Arc::clone(&db_conn);
            let rules_str = include_str!("../../src/rules.json");
            let rules: serde_json::Value = serde_json::from_str(rules_str).unwrap();
            let rules_for_thread = Arc::new(rules.clone());

            // СОЗДАЕМ ОБЩИЙ КЭШ
            let app_cache = Arc::new(Mutex::new(HashMap::new()));
            let app_cache_for_thread = Arc::clone(&app_cache);

            app.manage(AppState { conn: db_conn, cache: app_cache });

            thread::spawn(move || {
                let mut sys = System::new();
                let mut flush_counter = 0;

                loop {
                    thread::sleep(Duration::from_secs(5));
                    sys.refresh_processes();
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
                        let name = process.name().to_string();
                        if !is_system_process(&name) && !name.to_lowercase().contains("dailyhabit") {
                            let clean = get_clean_name(&name, "", &rules_for_thread);
                            running_clean_names.insert(clean);
                        }
                    }

                    // 1. НАКАПЛИВАЕМ СТАТИСТИКУ В ОБЩЕМ КЭШЕ
                    {
                        let mut cache_lock = app_cache_for_thread.lock().unwrap();
                        if !active_clean_name.is_empty() {
                            let entry = cache_lock.entry(active_clean_name.clone()).or_insert((0, 0));
                            entry.0 += 5; // active_duration
                        }

                        for app in running_clean_names {
                            if app != active_clean_name {
                                let entry = cache_lock.entry(app).or_insert((0, 0));
                                entry.1 += 5; // background_duration
                            }
                        }
                    } // Блокировка снимается здесь, чтобы React мог в любой момент взять данные

                    // 2. СБРОС В БАЗУ ДАННЫХ РАЗ В 2 МИНУТЫ
                    if flush_counter >= 24 {
                        let conn = db_conn_for_thread.lock().unwrap();
                        let mut cache_lock = app_cache_for_thread.lock().unwrap();
                        
                        for (app_name, (active_time, bg_time)) in cache_lock.drain() {
                            if active_time > 0 {
                                let query = "
                                    INSERT INTO daily_stats (date, app_name, active_duration, background_duration)
                                    VALUES (date('now', 'localtime'), ?1, ?2, 0)
                                    ON CONFLICT(date, app_name) DO UPDATE SET active_duration = active_duration + ?2;
                                ";
                                let _ = conn.execute(query, params![app_name, active_time]);
                            }
                            if bg_time > 0 {
                                let query = "
                                    UPDATE daily_stats 
                                    SET background_duration = background_duration + ?2 
                                    WHERE date = date('now', 'localtime') AND app_name = ?1;
                                ";
                                let _ = conn.execute(query, params![app_name, bg_time]);
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
            get_focus_stats, save_focus_stats, get_focus_month_stats, clear_focus_stats
        ])
        .run(tauri::generate_context!())
        .expect("error");
}
