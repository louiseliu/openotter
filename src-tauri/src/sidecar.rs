use std::sync::Mutex;
use tauri::Manager;

pub struct HermesProcess {
    pub port: u16,
    pub ready: bool,
    pub pid: Option<u32>,
}

pub struct SidecarState {
    pub process: Option<HermesProcess>,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self { process: None }
    }
}

pub fn find_available_port() -> u16 {
    portpicker::pick_unused_port().expect("no free port available")
}

pub fn init_sidecar_state(app: &tauri::App) {
    app.manage(Mutex::new(SidecarState::default()));
}
