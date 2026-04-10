use serde::{Deserialize, Serialize};
use std::fs;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager};

const HERMES_OFFICE_REPO: &str = "https://github.com/fathah/hermes-office";
const DEFAULT_PORT: u16 = 3000;
const DEFAULT_WS_URL: &str = "ws://localhost:18789";

fn hermes_home() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".hermes")
}

fn office_dir() -> PathBuf {
    hermes_home().join("hermes-office")
}

fn port_file() -> PathBuf {
    hermes_home().join("claw3d-port")
}

fn ws_url_file() -> PathBuf {
    hermes_home().join("claw3d-ws-url")
}

fn dev_pid_file() -> PathBuf {
    hermes_home().join("claw3d-dev.pid")
}

fn adapter_pid_file() -> PathBuf {
    hermes_home().join("claw3d-adapter.pid")
}

pub struct Claw3dState {
    pub dev_process: Option<Child>,
    pub adapter_process: Option<Child>,
    pub dev_logs: String,
    pub adapter_logs: String,
}

impl Default for Claw3dState {
    fn default() -> Self {
        Self {
            dev_process: None,
            adapter_process: None,
            dev_logs: String::new(),
            adapter_logs: String::new(),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claw3dStatus {
    pub cloned: bool,
    pub installed: bool,
    pub dev_server_running: bool,
    pub adapter_running: bool,
    pub running: bool,
    pub port: u16,
    pub port_in_use: bool,
    pub ws_url: String,
    pub error: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claw3dSetupProgress {
    pub step: u32,
    pub total_steps: u32,
    pub title: String,
    pub detail: String,
}

pub fn get_saved_port() -> u16 {
    fs::read_to_string(port_file())
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(DEFAULT_PORT)
}

pub fn set_saved_port(port: u16) {
    let _ = fs::write(port_file(), port.to_string());
    write_claw3d_env();
}

pub fn get_saved_ws_url() -> String {
    fs::read_to_string(ws_url_file())
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_WS_URL.to_string())
}

pub fn set_saved_ws_url(url: &str) {
    let _ = fs::write(ws_url_file(), url);
    write_claw3d_env();
}

fn write_claw3d_env() {
    let dir = office_dir();
    if !dir.exists() {
        return;
    }
    let port = get_saved_port();
    let ws_url = get_saved_ws_url();
    let content = format!(
        "# Auto-configured by OpenOtter\n\
         PORT={port}\n\
         HOST=127.0.0.1\n\
         NEXT_PUBLIC_GATEWAY_URL={ws_url}\n\
         CLAW3D_GATEWAY_URL={ws_url}\n\
         CLAW3D_GATEWAY_TOKEN=\n\
         HERMES_ADAPTER_PORT=18789\n\
         HERMES_MODEL=hermes\n\
         HERMES_AGENT_NAME=Hermes\n"
    );
    let _ = fs::write(dir.join(".env"), content);
}

fn check_port_in_use(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(300),
    )
    .is_ok()
}

fn is_pid_alive(pid: u32) -> bool {
    #[cfg(unix)]
    {
        unsafe { libc::kill(pid as i32, 0) == 0 }
    }
    #[cfg(not(unix))]
    {
        let _ = pid;
        false
    }
}

fn read_pid_file(path: &PathBuf) -> Option<u32> {
    fs::read_to_string(path)
        .ok()
        .and_then(|s| s.trim().parse().ok())
}

fn write_pid_file(path: &PathBuf, pid: u32) {
    let _ = fs::write(path, pid.to_string());
}

fn cleanup_pid_file(path: &PathBuf) {
    let _ = fs::remove_file(path);
}

fn is_dev_running(state: &Claw3dState) -> bool {
    if state.dev_process.is_some() {
        return true;
    }
    if let Some(pid) = read_pid_file(&dev_pid_file()) {
        if is_pid_alive(pid) {
            return true;
        }
        cleanup_pid_file(&dev_pid_file());
    }
    false
}

fn is_adapter_running(state: &Claw3dState) -> bool {
    if state.adapter_process.is_some() {
        return true;
    }
    if let Some(pid) = read_pid_file(&adapter_pid_file()) {
        if is_pid_alive(pid) {
            return true;
        }
        cleanup_pid_file(&adapter_pid_file());
    }
    false
}

pub fn get_status(state: &Claw3dState) -> Claw3dStatus {
    let dir = office_dir();
    let cloned = dir.join("package.json").exists();
    let installed = dir.join("node_modules").exists();
    let port = get_saved_port();
    let dev_running = is_dev_running(state);
    let port_in_use = if dev_running { false } else { check_port_in_use(port) };
    let adapter_up = is_adapter_running(state);

    Claw3dStatus {
        cloned,
        installed,
        dev_server_running: dev_running,
        adapter_running: adapter_up,
        running: dev_running && adapter_up,
        port,
        port_in_use,
        ws_url: get_saved_ws_url(),
        error: String::new(),
    }
}

fn find_npm() -> String {
    let candidates = ["/usr/local/bin/npm", "/opt/homebrew/bin/npm"];
    for c in &candidates {
        if std::path::Path::new(c).exists() {
            return c.to_string();
        }
    }
    if let Ok(output) = Command::new("which").arg("npm").output() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() && std::path::Path::new(&path).exists() {
            return path;
        }
    }
    "npm".to_string()
}

fn enhanced_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let extra = [
        format!("{}/.local/bin", home),
        format!("{}/.cargo/bin", home),
        "/usr/local/bin".to_string(),
        "/opt/homebrew/bin".to_string(),
        "/opt/homebrew/sbin".to_string(),
    ];
    let current = std::env::var("PATH").unwrap_or_default();
    format!("{}:{}", extra.join(":"), current)
}

pub fn setup_claw3d(app: &tauri::AppHandle) -> Result<(), String> {
    let dir = office_dir();
    let cloned = dir.join("package.json").exists();

    let emit_progress = |step: u32, title: &str, detail: &str| {
        let _ = app.emit(
            "claw3d-setup-progress",
            Claw3dSetupProgress {
                step,
                total_steps: 2,
                title: title.to_string(),
                detail: detail.to_string(),
            },
        );
    };

    if !cloned {
        emit_progress(1, "克隆 Claw3D 仓库...", "从 GitHub 下载中...");
        let output = Command::new("git")
            .args(["clone", HERMES_OFFICE_REPO, dir.to_str().unwrap_or("")])
            .env("PATH", enhanced_path())
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("git clone failed: {}", stderr));
        }
        emit_progress(1, "克隆 Claw3D 仓库...", "克隆完成");
    } else {
        emit_progress(1, "更新 Claw3D...", "拉取最新代码...");
        let _ = Command::new("git")
            .args(["pull", "--ff-only"])
            .current_dir(&dir)
            .env("PATH", enhanced_path())
            .output();
    }

    emit_progress(2, "安装依赖...", "运行 npm install...");
    let npm = find_npm();
    let output = Command::new(&npm)
        .arg("install")
        .current_dir(&dir)
        .env("PATH", enhanced_path())
        .env("HOME", std::env::var("HOME").unwrap_or_default())
        .output()
        .map_err(|e| format!("Failed to run npm: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("npm install failed: {}", stderr));
    }

    write_claw3d_env();
    emit_progress(2, "安装依赖...", "依赖安装完成");
    Ok(())
}

pub fn start_dev_server(state: &mut Claw3dState) -> Result<(), String> {
    if is_dev_running(state) {
        return Ok(());
    }

    let dir = office_dir();
    if !dir.join("node_modules").exists() {
        return Err("Claw3D 未安装，请先运行安装".to_string());
    }

    let npm = find_npm();
    let port = get_saved_port();

    let child = Command::new(&npm)
        .args(["run", "dev"])
        .current_dir(&dir)
        .env("PATH", enhanced_path())
        .env("HOME", std::env::var("HOME").unwrap_or_default())
        .env("PORT", port.to_string())
        .env("TERM", "dumb")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start dev server: {}", e))?;

    if let Some(pid) = child.id().into() {
        write_pid_file(&dev_pid_file(), pid);
    }
    state.dev_process = Some(child);
    Ok(())
}

pub fn stop_dev_server(state: &mut Claw3dState) {
    if let Some(mut proc) = state.dev_process.take() {
        let _ = proc.kill();
    }
    if let Some(pid) = read_pid_file(&dev_pid_file()) {
        #[cfg(unix)]
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
    }
    cleanup_pid_file(&dev_pid_file());
}

pub fn start_adapter(state: &mut Claw3dState) -> Result<(), String> {
    if is_adapter_running(state) {
        return Ok(());
    }

    let dir = office_dir();
    if !dir.join("node_modules").exists() {
        return Err("Claw3D 未安装，请先运行安装".to_string());
    }

    let npm = find_npm();
    let child = Command::new(&npm)
        .args(["run", "hermes-adapter"])
        .current_dir(&dir)
        .env("PATH", enhanced_path())
        .env("HOME", std::env::var("HOME").unwrap_or_default())
        .env("TERM", "dumb")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start adapter: {}", e))?;

    if let Some(pid) = child.id().into() {
        write_pid_file(&adapter_pid_file(), pid);
    }
    state.adapter_process = Some(child);
    Ok(())
}

pub fn stop_adapter(state: &mut Claw3dState) {
    if let Some(mut proc) = state.adapter_process.take() {
        let _ = proc.kill();
    }
    if let Some(pid) = read_pid_file(&adapter_pid_file()) {
        #[cfg(unix)]
        unsafe {
            libc::kill(pid as i32, libc::SIGTERM);
        }
    }
    cleanup_pid_file(&adapter_pid_file());
}

pub fn start_all(state: &mut Claw3dState) -> Result<(), String> {
    start_dev_server(state)?;
    start_adapter(state)?;
    Ok(())
}

pub fn stop_all(state: &mut Claw3dState) {
    stop_dev_server(state);
    stop_adapter(state);
}

pub fn init_claw3d_state(app: &tauri::App) {
    app.manage(Mutex::new(Claw3dState::default()));
}
