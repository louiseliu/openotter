use std::sync::Mutex;
use tauri::Manager;

pub struct WebServerProcess {
    pub port: u16,
    pub ready: bool,
    pub pid: Option<u32>,
    pub token: Option<String>,
}

pub struct WebServerState {
    pub process: Option<WebServerProcess>,
}

impl Default for WebServerState {
    fn default() -> Self {
        Self { process: None }
    }
}

pub fn init_web_server_state(app: &tauri::App) {
    app.manage(Mutex::new(WebServerState::default()));
}

/// Extract the session token from the web server's index HTML.
/// The server injects: `window.__HERMES_SESSION_TOKEN__="<token>";`
pub fn extract_token_from_html(html: &str) -> Option<String> {
    let marker = r#"__HERMES_SESSION_TOKEN__=""#;
    let start = html.find(marker)? + marker.len();
    let rest = &html[start..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_token() {
        let html = r#"<html><head><script>window.__HERMES_SESSION_TOKEN__="abc123_xyz";</script></head></html>"#;
        assert_eq!(extract_token_from_html(html), Some("abc123_xyz".to_string()));
    }

    #[test]
    fn test_extract_token_missing() {
        let html = "<html><head></head></html>";
        assert_eq!(extract_token_from_html(html), None);
    }
}
