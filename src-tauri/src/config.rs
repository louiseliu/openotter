use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HermesConfig {
    pub hermes_home: PathBuf,
    pub api_provider: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub is_configured: bool,
}

impl Default for HermesConfig {
    fn default() -> Self {
        let home = dirs_home();
        let is_configured = home.join(".env").exists();
        Self {
            hermes_home: home,
            api_provider: None,
            api_key: None,
            model: None,
            is_configured,
        }
    }
}

fn dirs_home() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".hermes")
}

impl HermesConfig {
    pub fn env_file_path(&self) -> PathBuf {
        self.hermes_home.join(".env")
    }

    #[allow(dead_code)]
    pub fn config_yaml_path(&self) -> PathBuf {
        self.hermes_home.join("config.yaml")
    }

    pub fn detect_installation() -> InstallStatus {
        let home = dirs_home();
        let agent_dir = home.join("hermes-agent");

        if !agent_dir.exists() {
            return InstallStatus::NotInstalled;
        }

        let venv = agent_dir.join("venv").join("bin").join("python");
        if !venv.exists() {
            return InstallStatus::Broken("venv not found".to_string());
        }

        let env_file = home.join(".env");
        if !env_file.exists() {
            return InstallStatus::NeedsSetup;
        }

        InstallStatus::Ready
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum InstallStatus {
    NotInstalled,
    NeedsSetup,
    Broken(String),
    Ready,
}
