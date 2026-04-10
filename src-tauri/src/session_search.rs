use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

fn state_db_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".hermes").join("state.db")
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
    pub session_id: String,
    pub title: Option<String>,
    pub started_at: i64,
    pub source: String,
    pub message_count: i64,
    pub model: String,
    pub snippet: String,
}

fn has_fts_table(conn: &Connection) -> bool {
    conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='messages_fts'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(())))
        .is_ok()
}

pub fn search_sessions(query: &str, limit: u32) -> Vec<SearchResult> {
    let db_path = state_db_path();
    if !db_path.exists() {
        return vec![];
    }

    let conn = match Connection::open_with_flags(
        &db_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
    ) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    if !has_fts_table(&conn) {
        return search_sessions_fallback(&conn, query, limit);
    }

    let sanitized = query
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .map(|w| format!("\"{}\"*", w.replace('"', "")))
        .collect::<Vec<_>>()
        .join(" ");

    if sanitized.is_empty() {
        return vec![];
    }

    let sql = r#"
        SELECT DISTINCT
            m.session_id,
            s.title,
            s.started_at,
            s.source,
            s.message_count,
            s.model,
            snippet(messages_fts, 0, '<<', '>>', '...', 40) as snippet
        FROM messages_fts
        JOIN messages m ON m.id = messages_fts.rowid
        JOIN sessions s ON s.id = m.session_id
        WHERE messages_fts MATCH ?1
        ORDER BY rank
        LIMIT ?2
    "#;

    let mut stmt = match conn.prepare(sql) {
        Ok(s) => s,
        Err(_) => return search_sessions_fallback(&conn, query, limit),
    };

    let results = stmt
        .query_map(rusqlite::params![sanitized, limit], |row| {
            Ok(SearchResult {
                session_id: row.get(0)?,
                title: row.get(1)?,
                started_at: row.get(2)?,
                source: row.get::<_, String>(3).unwrap_or_default(),
                message_count: row.get(4).unwrap_or(0),
                model: row.get::<_, String>(5).unwrap_or_default(),
                snippet: row.get::<_, String>(6).unwrap_or_default(),
            })
        })
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    results
}

fn search_sessions_fallback(conn: &Connection, query: &str, limit: u32) -> Vec<SearchResult> {
    let pattern = format!("%{}%", query);
    let sql = r#"
        SELECT DISTINCT
            m.session_id,
            s.title,
            s.started_at,
            s.source,
            s.message_count,
            s.model,
            substr(m.content, 1, 120) as snippet
        FROM messages m
        JOIN sessions s ON s.id = m.session_id
        WHERE m.content LIKE ?1
        ORDER BY s.started_at DESC
        LIMIT ?2
    "#;

    let mut stmt = match conn.prepare(sql) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    stmt.query_map(rusqlite::params![pattern, limit], |row| {
        Ok(SearchResult {
            session_id: row.get(0)?,
            title: row.get(1)?,
            started_at: row.get(2)?,
            source: row.get::<_, String>(3).unwrap_or_default(),
            message_count: row.get(4).unwrap_or(0),
            model: row.get::<_, String>(5).unwrap_or_default(),
            snippet: row.get::<_, String>(6).unwrap_or_default(),
        })
    })
    .ok()
    .map(|rows| rows.filter_map(|r| r.ok()).collect())
    .unwrap_or_default()
}
