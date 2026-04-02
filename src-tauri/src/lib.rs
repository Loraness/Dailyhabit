use active_win_pos_rs::get_active_window;
use rusqlite::{params, Connection};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use sysinfo::{ProcessExt, System, SystemExt};
use tauri::{Manager, State};
use tauri_plugin_autostart::MacosLauncher;

struct AppState {
    conn: Arc<Mutex<Connection>>,
    rules: serde_json::Value,
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
#[tauri::command]
fn get_stats_for_date(state: State<'_, AppState>, date: String) -> Result<Vec<AppUsage>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT app_name, active_duration, background_duration FROM daily_stats WHERE date = ?1")
        .map_err(|e| e.to_string())?;

    let app_iter = stmt
        .query_map([date], |row| {
            Ok(AppUsage {
                name: row.get(0)?,
                active_duration: row.get(1)?,
                background_duration: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut usage = Vec::new();
    for app in app_iter {
        usage.push(app.unwrap());
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

            let db_conn = Arc::new(Mutex::new(conn));
            let db_conn_for_thread = Arc::clone(&db_conn);
            let rules_str = include_str!("../../src/rules.json");
            let rules: serde_json::Value = serde_json::from_str(rules_str).unwrap();
            let rules_for_thread = Arc::new(rules.clone());

            app.manage(AppState { conn: db_conn, rules });

            thread::spawn(move || {
                let mut sys = System::new();
                loop {
                    thread::sleep(Duration::from_secs(5));
                    sys.refresh_processes();

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

                    let conn = db_conn_for_thread.lock().unwrap();

                    if !active_clean_name.is_empty() {
                        let query = "
                            INSERT INTO daily_stats (date, app_name, active_duration, background_duration)
                            VALUES (date('now', 'localtime'), ?1, 5, 0)
                            ON CONFLICT(date, app_name) DO UPDATE SET active_duration = active_duration + 5;
                        ";
                        let _ = conn.execute(query, params![active_clean_name]);
                    }

                    for app in running_clean_names {
                        if app != active_clean_name {
                            let query = "
                                UPDATE daily_stats 
                                SET background_duration = background_duration + 5 
                                WHERE date = date('now', 'localtime') AND app_name = ?1;
                            ";
                            let _ = conn.execute(query, params![app]);
                        }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_stats_for_date, get_month_stats])
        .run(tauri::generate_context!())
        .expect("error");
}
