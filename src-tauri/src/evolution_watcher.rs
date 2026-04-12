use notify::{Event, EventKind, RecursiveMode, Watcher};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvolutionLogEntry {
    pub id: i64,
    pub timestamp: i64,
    pub event_type: String,
    pub title: String,
    pub detail: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatcherEvent {
    pub event_type: String,
    pub title: String,
    pub detail: String,
    pub path: String,
    pub timestamp: i64,
}

pub struct EvolutionWatcherState {
    _watcher: Option<notify::RecommendedWatcher>,
}

fn evolution_db_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
        .join(".openotter")
        .join("evolution.db")
}

fn ensure_db() -> Result<Connection, String> {
    let path = evolution_db_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    let conn = Connection::open(&path).map_err(|e| format!("DB error: {}", e))?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS evolution_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            title TEXT NOT NULL,
            detail TEXT NOT NULL DEFAULT '',
            path TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_evo_ts ON evolution_log(timestamp DESC);",
    )
    .map_err(|e| format!("DB schema error: {}", e))?;
    Ok(conn)
}

fn log_event(event_type: &str, title: &str, detail: &str, path: &str) {
    if let Ok(conn) = ensure_db() {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;
        let _ = conn.execute(
            "INSERT INTO evolution_log (timestamp, event_type, title, detail, path) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![ts, event_type, title, detail, path],
        );
    }
}

pub fn get_evolution_log(limit: u32) -> Vec<EvolutionLogEntry> {
    let conn = match ensure_db() {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    let mut stmt = match conn.prepare(
        "SELECT id, timestamp, event_type, title, detail, path FROM evolution_log ORDER BY timestamp DESC LIMIT ?1",
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    stmt.query_map(rusqlite::params![limit], |row| {
        Ok(EvolutionLogEntry {
            id: row.get(0)?,
            timestamp: row.get(1)?,
            event_type: row.get::<_, String>(2).unwrap_or_default(),
            title: row.get::<_, String>(3).unwrap_or_default(),
            detail: row.get::<_, String>(4).unwrap_or_default(),
            path: row.get::<_, String>(5).unwrap_or_default(),
        })
    })
    .ok()
    .map(|rows| rows.filter_map(|r| r.ok()).collect())
    .unwrap_or_default()
}

fn classify_event(event: &Event) -> Option<(String, String, String, String)> {
    let path = event.paths.first()?;
    let path_str = path.to_string_lossy().to_string();

    let is_skills = path_str.contains("/skills/") || path_str.contains("\\skills\\");
    let is_memories = path_str.contains("/memories/") || path_str.contains("\\memories\\");

    if !is_skills && !is_memories {
        return None;
    }

    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");

    if file_name.starts_with('.') || file_name.ends_with(".tmp") {
        return None;
    }

    let domain = if is_skills { "skill" } else { "memory" };

    let parent_name = path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|n| n.to_str())
        .unwrap_or("unknown");

    match event.kind {
        EventKind::Create(_) => {
            if is_skills {
                Some((
                    "skill_added".to_string(),
                    format!("⚡ 新技能: {}", parent_name),
                    format!("检测到新技能文件 {}", file_name),
                    path_str,
                ))
            } else {
                Some((
                    "memory_created".to_string(),
                    format!("🧠 新记忆: {}", file_name),
                    "Agent 形成了新的记忆".to_string(),
                    path_str,
                ))
            }
        }
        EventKind::Modify(_) => Some((
            format!("{}_modified", domain),
            if is_skills {
                format!("📝 技能更新: {}", parent_name)
            } else {
                format!("🧠 记忆更新: {}", file_name)
            },
            format!("文件 {} 已修改", file_name),
            path_str,
        )),
        EventKind::Remove(_) => Some((
            format!("{}_removed", domain),
            if is_skills {
                format!("❌ 技能移除: {}", parent_name)
            } else {
                format!("🗑️ 记忆删除: {}", file_name)
            },
            format!("文件 {} 已删除", file_name),
            path_str,
        )),
        _ => None,
    }
}

pub fn init_watcher(app: &tauri::App) {
    let app_handle = app.handle().clone();

    let (tx, rx) = mpsc::channel();

    let mut watcher = match notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        if let Ok(event) = res {
            let _ = tx.send(event);
        }
    }) {
        Ok(w) => w,
        Err(e) => {
            eprintln!("[evolution_watcher] Failed to create watcher: {}", e);
            app.manage(Mutex::new(EvolutionWatcherState { _watcher: None }));
            return;
        }
    };

    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());

    let skills_dir = PathBuf::from(&home).join(".hermes").join("skills");
    let agents_dir = PathBuf::from(&home).join(".hermes").join("profiles");

    if skills_dir.exists() {
        if let Err(e) = watcher.watch(&skills_dir, RecursiveMode::Recursive) {
            eprintln!("[evolution_watcher] Failed to watch skills: {}", e);
        } else {
            println!("[evolution_watcher] Watching {}", skills_dir.display());
        }
    }

    if agents_dir.exists() {
        if let Err(e) = watcher.watch(&agents_dir, RecursiveMode::Recursive) {
            eprintln!("[evolution_watcher] Failed to watch agents: {}", e);
        } else {
            println!("[evolution_watcher] Watching {}", agents_dir.display());
        }
    }

    std::thread::spawn(move || {
        let mut last_event_time: std::time::Instant = std::time::Instant::now();

        while let Ok(event) = rx.recv() {
            let now = std::time::Instant::now();
            if now.duration_since(last_event_time).as_millis() < 500 {
                continue;
            }
            last_event_time = now;

            if let Some((event_type, title, detail, path)) = classify_event(&event) {
                log_event(&event_type, &title, &detail, &path);

                let ts = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                let watcher_event = WatcherEvent {
                    event_type,
                    title,
                    detail,
                    path,
                    timestamp: ts,
                };

                let _ = app_handle.emit("evolution-event", &watcher_event);
            }
        }
    });

    app.manage(Mutex::new(EvolutionWatcherState {
        _watcher: Some(watcher),
    }));
}
