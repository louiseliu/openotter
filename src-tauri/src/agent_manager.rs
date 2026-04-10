use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMeta {
    pub id: String,
    pub name: String,
    pub description: String,
    pub avatar: String,
    pub provider: String,
    pub model: String,
    pub platforms: Vec<String>,
    pub created_at: u64,
    pub updated_at: u64,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformConfig {
    pub platform: String,
    pub enabled: bool,
    pub config: std::collections::HashMap<String, String>,
}

fn openotter_home() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".openotter")
}

fn agents_dir() -> PathBuf {
    openotter_home().join("agents")
}

fn agents_meta_path() -> PathBuf {
    openotter_home().join("agents.json")
}

pub fn ensure_dirs() {
    let home = openotter_home();
    let _ = fs::create_dir_all(&home);
    let _ = fs::create_dir_all(agents_dir());
}

fn load_agents_meta() -> Vec<AgentMeta> {
    let path = agents_meta_path();
    if !path.exists() {
        return vec![];
    }
    let data = fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_agents_meta(agents: &[AgentMeta]) -> Result<(), String> {
    let path = agents_meta_path();
    let data = serde_json::to_string_pretty(agents).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| format!("Failed to write agents.json: {}", e))
}

pub fn list_agents() -> Vec<AgentMeta> {
    ensure_dirs();
    load_agents_meta()
}

pub fn get_agent(id: &str) -> Option<AgentMeta> {
    load_agents_meta().into_iter().find(|a| a.id == id)
}

pub fn agent_home(id: &str) -> PathBuf {
    agents_dir().join(id)
}

pub fn create_agent(
    name: String,
    description: String,
    avatar: String,
    soul_md: String,
    provider: String,
    model: String,
    api_key: String,
) -> Result<AgentMeta, String> {
    ensure_dirs();

    let id = slug_from_name(&name);
    let home = agent_home(&id);

    if home.exists() {
        return Err(format!("Agent '{}' already exists", id));
    }

    fs::create_dir_all(&home).map_err(|e| e.to_string())?;
    for sub in &[
        "skills", "sessions", "logs", "memories", "cron", "hooks",
        "image_cache", "audio_cache",
    ] {
        let _ = fs::create_dir_all(home.join(sub));
    }

    fs::write(home.join("SOUL.md"), &soul_md)
        .map_err(|e| format!("Failed to write SOUL.md: {}", e))?;

    let provider_info = super::commands::get_providers()
        .into_iter()
        .find(|p| p.id == provider);

    let env_key = provider_info
        .as_ref()
        .map(|p| p.env_key.clone())
        .unwrap_or_else(|| format!("{}_API_KEY", provider.to_uppercase()));

    let resolved_api_key = if api_key.is_empty() {
        read_global_env_key(&env_key).unwrap_or_default()
    } else {
        api_key
    };

    if resolved_api_key.is_empty() {
        return Err("API Key 未配置。请先在「设置」页面配置全局模型，或在此处输入 API Key。".to_string());
    }

    let env_content = format!(
        "{}={}\nHERMES_MODEL={}\n",
        env_key, resolved_api_key, model
    );
    fs::write(home.join(".env"), &env_content)
        .map_err(|e| format!("Failed to write .env: {}", e))?;

    let config_yaml = generate_default_config(&model);
    fs::write(home.join("config.yaml"), &config_yaml)
        .map_err(|e| format!("Failed to write config.yaml: {}", e))?;

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let agent = AgentMeta {
        id: id.clone(),
        name,
        description,
        avatar,
        provider,
        model,
        platforms: vec![],
        created_at: now,
        updated_at: now,
    };

    let mut agents = load_agents_meta();
    agents.push(agent.clone());
    save_agents_meta(&agents)?;

    Ok(agent)
}

#[allow(dead_code)]
pub fn update_agent_meta(id: &str, name: Option<String>, description: Option<String>, avatar: Option<String>) -> Result<AgentMeta, String> {
    let mut agents = load_agents_meta();
    let agent = agents.iter_mut().find(|a| a.id == id).ok_or("Agent not found")?;

    if let Some(n) = name { agent.name = n; }
    if let Some(d) = description { agent.description = d; }
    if let Some(a) = avatar { agent.avatar = a; }

    agent.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let result = agent.clone();
    save_agents_meta(&agents)?;
    Ok(result)
}

pub fn delete_agent(id: &str) -> Result<(), String> {
    let home = agent_home(id);
    if home.exists() {
        fs::remove_dir_all(&home).map_err(|e| format!("Failed to remove agent dir: {}", e))?;
    }

    let mut agents = load_agents_meta();
    agents.retain(|a| a.id != id);
    save_agents_meta(&agents)?;

    Ok(())
}

pub fn update_agent_soul(id: &str, soul_md: &str) -> Result<(), String> {
    let home = agent_home(id);
    if !home.exists() {
        return Err("Agent not found".to_string());
    }
    fs::write(home.join("SOUL.md"), soul_md)
        .map_err(|e| format!("Failed to write SOUL.md: {}", e))
}

pub fn get_agent_soul(id: &str) -> Result<String, String> {
    let path = agent_home(id).join("SOUL.md");
    fs::read_to_string(&path).map_err(|e| format!("Failed to read SOUL.md: {}", e))
}

pub fn update_agent_env(id: &str, key: &str, value: &str) -> Result<(), String> {
    let home = agent_home(id);
    let env_path = home.join(".env");

    let mut content = if env_path.exists() {
        fs::read_to_string(&env_path).unwrap_or_default()
    } else {
        String::new()
    };

    let pattern = format!("{}=", key);
    let new_line = format!("{}={}", key, value);

    if content.contains(&pattern) {
        let lines: Vec<String> = content
            .lines()
            .map(|l| {
                if l.starts_with(&pattern) {
                    new_line.clone()
                } else {
                    l.to_string()
                }
            })
            .collect();
        content = lines.join("\n");
    } else {
        if !content.is_empty() && !content.ends_with('\n') {
            content.push('\n');
        }
        content.push_str(&new_line);
        content.push('\n');
    }

    fs::write(&env_path, &content).map_err(|e| format!("Failed to write .env: {}", e))
}

pub fn configure_platform(id: &str, platform: &str, config: &std::collections::HashMap<String, String>) -> Result<(), String> {
    for (key, value) in config {
        update_agent_env(id, key, value)?;
    }

    let mut agents = load_agents_meta();
    if let Some(agent) = agents.iter_mut().find(|a| a.id == id) {
        let platform_name = platform.to_string();
        if !agent.platforms.contains(&platform_name) {
            agent.platforms.push(platform_name);
        }
        agent.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        save_agents_meta(&agents)?;
    }

    Ok(())
}

pub fn get_agent_logs(id: &str, lines: usize) -> Result<String, String> {
    let log_path = agent_home(id).join("logs").join("gateway.log");
    if !log_path.exists() {
        return Ok(String::new());
    }
    let content = fs::read_to_string(&log_path)
        .map_err(|e| format!("Failed to read logs: {}", e))?;
    let all_lines: Vec<&str> = content.lines().collect();
    let start = if all_lines.len() > lines { all_lines.len() - lines } else { 0 };
    Ok(all_lines[start..].join("\n"))
}

fn slug_from_name(name: &str) -> String {
    let slug: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect();
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        format!("agent-{}", std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis())
    } else {
        slug
    }
}

fn read_global_env_key(key: &str) -> Option<String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    let env_path = std::path::PathBuf::from(home).join(".hermes").join(".env");
    let content = fs::read_to_string(&env_path).ok()?;
    let prefix = format!("{}=", key);
    content
        .lines()
        .find(|l| l.starts_with(&prefix))
        .map(|l| l.splitn(2, '=').nth(1).unwrap_or("").to_string())
        .filter(|v| !v.is_empty())
}

fn generate_default_config(model: &str) -> String {
    format!(
r#"# OpenOtter Agent Configuration
# Generated by OpenOtter

# Model
model: "{model}"

# Terminal
terminal:
  backend: local
  cwd: "."
  timeout: 180

# Memory
memory:
  memory_enabled: true
  user_profile_enabled: true

# Compression
compression:
  enabled: true
  threshold: 0.50

# Display
display:
  tool_progress: all
  streaming: false

# Agent
agent:
  max_turns: 90
  reasoning_effort: ""

# Approvals
approvals:
  mode: smart
"#,
        model = model
    )
}
