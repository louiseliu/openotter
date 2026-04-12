use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewayStatus {
    pub agent_id: String,
    pub running: bool,
    pub pid: Option<u32>,
    pub platforms: Vec<PlatformStatus>,
    pub uptime_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformStatus {
    pub name: String,
    pub connected: bool,
}

pub struct GatewayProcess {
    pub agent_id: String,
    pub pid: Option<u32>,
    pub started_at: std::time::Instant,
}

pub struct GatewayManagerState {
    pub processes: HashMap<String, GatewayProcess>,
}

impl Default for GatewayManagerState {
    fn default() -> Self {
        Self {
            processes: HashMap::new(),
        }
    }
}

pub fn init_gateway_state(app: &tauri::App) {
    app.manage(Mutex::new(GatewayManagerState::default()));
}

pub fn hermes_bin_path() -> Option<std::path::PathBuf> {
    crate::hermes_installer::get_hermes_binary_path()
}

#[derive(Debug)]
pub struct GlobalGatewayInfo {
    pub running: bool,
    pub pid: Option<u32>,
}

pub fn check_global_gateway() -> GlobalGatewayInfo {
    let hermes_bin = match hermes_bin_path() {
        Some(p) => p,
        None => return GlobalGatewayInfo { running: false, pid: None },
    };

    let bin = hermes_bin.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let result = std::process::Command::new(&bin)
            .args(["gateway", "status"])
            .output();
        let _ = tx.send(result);
    });

    let output = match rx.recv_timeout(std::time::Duration::from_secs(1)) {
        Ok(result) => result,
        Err(_) => return GlobalGatewayInfo { running: false, pid: None },
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let is_running = stdout.contains("Gateway is running");
            let pid = if is_running {
                stdout
                    .lines()
                    .find(|l| l.contains("PID:"))
                    .and_then(|l| {
                        l.split("PID:")
                            .nth(1)
                            .and_then(|s| {
                                let cleaned: String = s.chars()
                                    .skip_while(|c| c.is_whitespace())
                                    .take_while(|c| c.is_ascii_digit())
                                    .collect();
                                cleaned.parse::<u32>().ok()
                            })
                    })
            } else {
                None
            };
            GlobalGatewayInfo { running: is_running, pid }
        }
        Err(_) => GlobalGatewayInfo { running: false, pid: None },
    }
}

pub fn get_gateway_status(
    state: &Mutex<GatewayManagerState>,
    agent_id: &str,
) -> GatewayStatus {
    let mgr = state.lock().unwrap();
    if let Some(proc) = mgr.processes.get(agent_id) {
        let uptime = proc.started_at.elapsed().as_secs();
        return GatewayStatus {
            agent_id: agent_id.to_string(),
            running: true,
            pid: proc.pid,
            platforms: vec![],
            uptime_secs: Some(uptime),
        };
    }
    drop(mgr);

    let agent = crate::agent_manager::get_agent(agent_id);
    if let Some(agent) = agent {
        if !agent.platforms.is_empty() {
            let global = check_global_gateway();
            if global.running {
                return GatewayStatus {
                    agent_id: agent_id.to_string(),
                    running: true,
                    pid: global.pid,
                    platforms: agent
                        .platforms
                        .iter()
                        .map(|p| PlatformStatus {
                            name: p.clone(),
                            connected: true,
                        })
                        .collect(),
                    uptime_secs: None,
                };
            }
        }
    }

    GatewayStatus {
        agent_id: agent_id.to_string(),
        running: false,
        pid: None,
        platforms: vec![],
        uptime_secs: None,
    }
}

pub fn get_all_gateway_statuses(
    state: &Mutex<GatewayManagerState>,
) -> Vec<GatewayStatus> {
    let mgr = state.lock().unwrap();
    let mut results: Vec<GatewayStatus> = mgr
        .processes
        .values()
        .map(|proc| {
            let uptime = proc.started_at.elapsed().as_secs();
            GatewayStatus {
                agent_id: proc.agent_id.clone(),
                running: true,
                pid: proc.pid,
                platforms: vec![],
                uptime_secs: Some(uptime),
            }
        })
        .collect();

    let tracked_ids: Vec<String> = mgr.processes.keys().cloned().collect();
    drop(mgr);

    let global = check_global_gateway();
    if global.running {
        let agents = crate::agent_manager::list_agents();
        for agent in agents {
            if !agent.platforms.is_empty() && !tracked_ids.contains(&agent.id) {
                results.push(GatewayStatus {
                    agent_id: agent.id.clone(),
                    running: true,
                    pid: global.pid,
                    platforms: agent
                        .platforms
                        .iter()
                        .map(|p| PlatformStatus {
                            name: p.clone(),
                            connected: true,
                        })
                        .collect(),
                    uptime_secs: None,
                });
            }
        }
    }

    results
}
