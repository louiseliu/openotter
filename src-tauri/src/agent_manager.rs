use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
    pub config: HashMap<String, String>,
}

fn user_home() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
}

pub fn hermes_home() -> PathBuf {
    user_home().join(".hermes")
}

fn profiles_dir() -> PathBuf {
    hermes_home().join("profiles")
}

fn openotter_home() -> PathBuf {
    user_home().join(".openotter")
}

fn agents_meta_path() -> PathBuf {
    openotter_home().join("agents.json")
}

pub fn ensure_dirs() {
    let _ = fs::create_dir_all(openotter_home());
    run_migration_if_needed();
}

pub fn agent_home(id: &str) -> PathBuf {
    if id == "default" {
        hermes_home()
    } else {
        profiles_dir().join(id)
    }
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
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).ok();
    }
    let data = serde_json::to_string_pretty(agents).map_err(|e| e.to_string())?;
    fs::write(&path, data).map_err(|e| format!("Failed to write agents.json: {}", e))
}

pub fn list_agents() -> Vec<AgentMeta> {
    let mut agents = load_agents_meta();
    let known_ids: Vec<String> = agents.iter().map(|a| a.id.clone()).collect();

    if hermes_home().join(".env").exists() && !known_ids.contains(&"default".to_string()) {
        let model = read_profile_model("default").unwrap_or_default();
        let now = now_secs();
        agents.insert(
            0,
            AgentMeta {
                id: "default".to_string(),
                name: "默认 Agent".to_string(),
                description: "Hermes 默认配置".to_string(),
                avatar: "🦦".to_string(),
                provider: String::new(),
                model,
                platforms: detect_profile_platforms("default"),
                created_at: now,
                updated_at: now,
            },
        );
    }

    let profiles = profiles_dir();
    if profiles.is_dir() {
        if let Ok(entries) = fs::read_dir(&profiles) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }
                let profile_name = match path.file_name().and_then(|n| n.to_str()) {
                    Some(n) => n.to_string(),
                    None => continue,
                };
                if known_ids.contains(&profile_name) {
                    continue;
                }
                if !path.join(".env").exists() && !path.join("config.yaml").exists() {
                    continue;
                }
                let model = read_profile_model(&profile_name).unwrap_or_default();
                let now = now_secs();
                agents.push(AgentMeta {
                    id: profile_name.clone(),
                    name: profile_name.clone(),
                    description: String::new(),
                    avatar: "🤖".to_string(),
                    provider: String::new(),
                    model,
                    platforms: detect_profile_platforms(&profile_name),
                    created_at: now,
                    updated_at: now,
                });
            }
        }
    }

    for agent in &mut agents {
        agent.platforms = detect_profile_platforms(&agent.id);
    }

    agents
}

pub fn get_agent(id: &str) -> Option<AgentMeta> {
    list_agents().into_iter().find(|a| a.id == id)
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
    let profile_name = make_profile_name(&name);

    let home = agent_home(&profile_name);
    if home.exists() {
        return Err(format!("Profile '{}' already exists", profile_name));
    }

    let hermes_bin = crate::gateway_manager::hermes_bin_path()
        .ok_or("Hermes binary not found. Please install Hermes first.")?;

    let output = std::process::Command::new(&hermes_bin)
        .args(["profile", "create", &profile_name, "--clone", "--no-alias"])
        .output()
        .map_err(|e| format!("Failed to create profile: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        if !home.exists() {
            return Err(format!(
                "hermes profile create failed: {} {}",
                stderr.trim(),
                stdout.trim()
            ));
        }
    }

    if !home.exists() {
        fs::create_dir_all(&home).map_err(|e| e.to_string())?;
    }

    if !soul_md.is_empty() {
        fs::write(home.join("SOUL.md"), &soul_md)
            .map_err(|e| format!("Failed to write SOUL.md: {}", e))?;
    }

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
        return Err(
            "API Key 未配置。请先在「设置」页面配置全局模型，或在此处输入 API Key。".to_string(),
        );
    }

    let env_content = format!("{}={}\nHERMES_MODEL={}\n", env_key, resolved_api_key, model);
    fs::write(home.join(".env"), &env_content)
        .map_err(|e| format!("Failed to write .env: {}", e))?;

    let config_yaml = generate_default_config(&model);
    fs::write(home.join("config.yaml"), &config_yaml)
        .map_err(|e| format!("Failed to write config.yaml: {}", e))?;

    let now = now_secs();
    let agent = AgentMeta {
        id: profile_name,
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
pub fn update_agent_meta(
    id: &str,
    name: Option<String>,
    description: Option<String>,
    avatar: Option<String>,
) -> Result<AgentMeta, String> {
    let mut agents = load_agents_meta();
    let agent = agents
        .iter_mut()
        .find(|a| a.id == id)
        .ok_or("Agent not found")?;

    if let Some(n) = name {
        agent.name = n;
    }
    if let Some(d) = description {
        agent.description = d;
    }
    if let Some(a) = avatar {
        agent.avatar = a;
    }

    agent.updated_at = now_secs();

    let result = agent.clone();
    save_agents_meta(&agents)?;
    Ok(result)
}

pub fn delete_agent(id: &str) -> Result<(), String> {
    if id == "default" {
        return Err("Cannot delete the default profile".to_string());
    }

    if let Some(hermes_bin) = crate::gateway_manager::hermes_bin_path() {
        let _ = std::process::Command::new(&hermes_bin)
            .args(["profile", "delete", id, "--yes"])
            .output();
    }

    let home = agent_home(id);
    if home.exists() {
        fs::remove_dir_all(&home)
            .map_err(|e| format!("Failed to remove profile dir: {}", e))?;
    }

    let mut agents = load_agents_meta();
    agents.retain(|a| a.id != id);
    save_agents_meta(&agents)?;

    Ok(())
}

pub fn update_agent_soul(id: &str, soul_md: &str) -> Result<(), String> {
    let home = agent_home(id);
    if !home.exists() {
        return Err("Agent profile not found".to_string());
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

pub fn configure_platform(
    id: &str,
    platform: &str,
    config: &HashMap<String, String>,
) -> Result<(), String> {
    for (key, value) in config {
        update_agent_env(id, key, value)?;
    }

    let mut agents = load_agents_meta();
    if let Some(agent) = agents.iter_mut().find(|a| a.id == id) {
        let platform_name = platform.to_string();
        if !agent.platforms.contains(&platform_name) {
            agent.platforms.push(platform_name);
        }
        agent.updated_at = now_secs();
        save_agents_meta(&agents)?;
    }

    Ok(())
}

pub fn unconfigure_platform(id: &str, platform: &str) -> Result<(), String> {
    let platform_env_keys: &[&str] = match platform {
        "telegram" => &["TELEGRAM_BOT_TOKEN", "TELEGRAM_ALLOWED_USERS", "TELEGRAM_HOME_CHANNEL", "TELEGRAM_HOME_CHANNEL_NAME"],
        "discord" => &["DISCORD_BOT_TOKEN", "DISCORD_HOME_CHANNEL", "DISCORD_HOME_CHANNEL_NAME"],
        "slack" => &["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN", "SLACK_ALLOWED_USERS", "SLACK_HOME_CHANNEL"],
        "weixin" => &["WEIXIN_ACCOUNT_ID", "WEIXIN_TOKEN", "WEIXIN_ALLOWED_USERS", "WEIXIN_BASE_URL", "WEIXIN_HOME_CHANNEL"],
        "whatsapp" => &["WHATSAPP_ENABLED", "WHATSAPP_ALLOWED_USERS", "WHATSAPP_MODE"],
        "email" => &["EMAIL_ADDRESS", "EMAIL_PASSWORD", "EMAIL_IMAP_HOST", "EMAIL_SMTP_HOST"],
        "feishu" => &["FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_HOME_CHANNEL"],
        "matrix" => &["MATRIX_HOMESERVER", "MATRIX_USER_ID", "MATRIX_ACCESS_TOKEN", "MATRIX_HOME_ROOM"],
        "mattermost" => &["MATTERMOST_URL", "MATTERMOST_TOKEN", "MATTERMOST_HOME_CHANNEL"],
        "bluebubbles" => &["BLUEBUBBLES_URL", "BLUEBUBBLES_PASSWORD", "BLUEBUBBLES_HOME_CHANNEL"],
        "signal" => &["SIGNAL_PHONE_NUMBER", "SIGNAL_ACCOUNT", "SIGNAL_HOME_CHANNEL"],
        _ => &[],
    };

    for key in platform_env_keys {
        remove_agent_env(id, key)?;
    }

    let mut agents = load_agents_meta();
    if let Some(agent) = agents.iter_mut().find(|a| a.id == id) {
        agent.platforms.retain(|p| p != platform);
        agent.updated_at = now_secs();
        save_agents_meta(&agents)?;
    }

    Ok(())
}

pub fn remove_agent_env(id: &str, key: &str) -> Result<(), String> {
    let home = agent_home(id);
    let env_path = home.join(".env");

    if !env_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&env_path).unwrap_or_default();
    let prefix = format!("{}=", key);
    let new_content: String = content
        .lines()
        .filter(|l| !l.starts_with(&prefix))
        .collect::<Vec<_>>()
        .join("\n");

    let final_content = if new_content.is_empty() || new_content.ends_with('\n') {
        new_content
    } else {
        format!("{}\n", new_content)
    };

    fs::write(&env_path, &final_content).map_err(|e| format!("Failed to write .env: {}", e))
}

pub fn get_agent_logs(id: &str, lines: usize) -> Result<String, String> {
    let log_path = agent_home(id).join("logs").join("gateway.log");
    if !log_path.exists() {
        let alt_path = hermes_home().join("logs").join("gateway.log");
        if id == "default" && alt_path.exists() {
            return read_last_lines(&alt_path, lines);
        }
        return Ok(String::new());
    }
    read_last_lines(&log_path, lines)
}

// ─── Helpers ───────────────────────────────────────────────

fn now_secs() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn read_last_lines(path: &std::path::Path, lines: usize) -> Result<String, String> {
    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read logs: {}", e))?;
    let all_lines: Vec<&str> = content.lines().collect();
    let start = if all_lines.len() > lines {
        all_lines.len() - lines
    } else {
        0
    };
    Ok(all_lines[start..].join("\n"))
}

fn make_profile_name(name: &str) -> String {
    let slug: String = name
        .to_lowercase()
        .chars()
        .filter_map(|c| {
            if c.is_ascii_alphanumeric() {
                Some(c)
            } else if c == '-' || c == '_' || c == ' ' {
                Some('-')
            } else {
                None
            }
        })
        .collect();
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        format!(
            "agent-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
                % 100000
        )
    } else {
        slug
    }
}

fn read_profile_model(id: &str) -> Option<String> {
    let home = agent_home(id);
    let env_path = home.join(".env");
    if let Ok(content) = fs::read_to_string(&env_path) {
        for line in content.lines() {
            let t = line.trim();
            if let Some(val) = t.strip_prefix("HERMES_MODEL=") {
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
    }
    let yaml_path = home.join("config.yaml");
    if let Ok(content) = fs::read_to_string(&yaml_path) {
        for line in content.lines() {
            let t = line.trim();
            if let Some(rest) = t.strip_prefix("default:") {
                let val = rest.trim().trim_matches('"').trim_matches('\'');
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
    }
    None
}

fn detect_profile_platforms(id: &str) -> Vec<String> {
    let home = agent_home(id);
    let env_path = home.join(".env");
    let content = match fs::read_to_string(&env_path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let platform_keys = [
        ("TELEGRAM_BOT_TOKEN", "telegram"),
        ("DISCORD_BOT_TOKEN", "discord"),
        ("SLACK_BOT_TOKEN", "slack"),
        ("WEIXIN_ACCOUNT_ID", "weixin"),
        ("WHATSAPP_ENABLED", "whatsapp"),
        ("EMAIL_ADDRESS", "email"),
        ("FEISHU_APP_ID", "feishu"),
        ("MATRIX_HOMESERVER", "matrix"),
        ("MATTERMOST_URL", "mattermost"),
    ];

    let mut platforms = vec![];
    for (key, name) in &platform_keys {
        let prefix = format!("{}=", key);
        for line in content.lines() {
            let t = line.trim();
            if t.starts_with(&prefix) && !t.starts_with('#') {
                let val = &t[prefix.len()..];
                if !val.is_empty() && val != "false" {
                    platforms.push(name.to_string());
                    break;
                }
            }
        }
    }
    platforms
}

fn read_global_env_key(key: &str) -> Option<String> {
    let env_path = hermes_home().join(".env");
    let content = fs::read_to_string(&env_path).ok()?;
    let prefix = format!("{}=", key);
    content
        .lines()
        .find(|l| {
            let t = l.trim();
            t.starts_with(&prefix) && !t.starts_with('#')
        })
        .map(|l| l.splitn(2, '=').nth(1).unwrap_or("").to_string())
        .filter(|v| !v.is_empty())
}

fn read_default_model_config() -> (String, String) {
    let yaml_path = hermes_home().join("config.yaml");
    let content = match fs::read_to_string(&yaml_path) {
        Ok(c) => c,
        Err(_) => return (String::new(), String::new()),
    };
    let mut provider = String::new();
    let mut base_url = String::new();
    for line in content.lines() {
        let t = line.trim();
        if let Some(v) = t.strip_prefix("provider:") {
            provider = v.trim().trim_matches('"').trim_matches('\'').to_string();
        }
        if let Some(v) = t.strip_prefix("base_url:") {
            base_url = v.trim().trim_matches('"').trim_matches('\'').to_string();
        }
    }
    (provider, base_url)
}

fn generate_default_config(model: &str) -> String {
    let (provider, base_url) = read_default_model_config();
    let mut model_block = format!("  default: \"{model}\"");
    if !provider.is_empty() {
        model_block.push_str(&format!("\n  provider: {provider}"));
    }
    if !base_url.is_empty() {
        model_block.push_str(&format!("\n  base_url: {base_url}"));
    }
    format!(
        r#"# OpenOtter Agent Configuration

model:
{}

terminal:
  backend: local
  cwd: "."
  timeout: 180

memory:
  memory_enabled: true
  user_profile_enabled: true

compression:
  enabled: true
  threshold: 0.50

display:
  tool_progress: all
  streaming: false

agent:
  max_turns: 90
  reasoning_effort: ""

approvals:
  mode: smart
"#,
        model_block
    )
}

// ─── Data Migration ────────────────────────────────────────

fn run_migration_if_needed() {
    let marker = openotter_home().join(".migration-v2-done");
    if marker.exists() {
        return;
    }

    let old_agents_dir = openotter_home().join("agents");
    let old_agents_json = openotter_home().join("agents.json");

    if !old_agents_dir.exists() && !old_agents_json.exists() {
        let _ = fs::write(&marker, "ok");
        return;
    }

    let old_agents: Vec<AgentMeta> = if old_agents_json.exists() {
        let data = fs::read_to_string(&old_agents_json).unwrap_or_default();
        serde_json::from_str(&data).unwrap_or_default()
    } else {
        vec![]
    };

    if old_agents.is_empty() {
        let _ = fs::write(&marker, "ok");
        return;
    }

    eprintln!(
        "[migration] Migrating {} agents from ~/.openotter/agents/ to ~/.hermes/profiles/",
        old_agents.len()
    );

    let profiles = profiles_dir();
    let _ = fs::create_dir_all(&profiles);

    let mut migrated_agents: Vec<AgentMeta> = Vec::new();

    for agent in &old_agents {
        let old_home = old_agents_dir.join(&agent.id);
        if !old_home.exists() {
            continue;
        }

        let profile_name = make_profile_name(&agent.name);
        let new_home = profiles.join(&profile_name);

        if new_home.exists() {
            eprintln!(
                "[migration] Profile '{}' already exists, skipping '{}'",
                profile_name, agent.name
            );
            let mut migrated = agent.clone();
            migrated.id = profile_name;
            migrated_agents.push(migrated);
            continue;
        }

        eprintln!(
            "[migration] {} ({}) -> profiles/{}",
            agent.name, agent.id, profile_name
        );

        if let Err(e) = copy_dir_recursive(&old_home, &new_home) {
            eprintln!("[migration] Failed to copy {}: {}", agent.id, e);
            continue;
        }

        let mut migrated = agent.clone();
        migrated.id = profile_name;
        migrated_agents.push(migrated);
    }

    let old_channels_path = openotter_home().join("channels.json");
    if old_channels_path.exists() {
        if let Ok(data) = fs::read_to_string(&old_channels_path) {
            if let Ok(bots) =
                serde_json::from_str::<Vec<serde_json::Value>>(&data)
            {
                for bot in &bots {
                    if let Some(config) = bot.get("config").and_then(|c| c.as_object()) {
                        for (key, val) in config {
                            if let Some(v) = val.as_str() {
                                let env_line = format!("{}={}", key, v);
                                let default_env = hermes_home().join(".env");
                                if let Ok(mut content) = fs::read_to_string(&default_env) {
                                    let prefix = format!("{}=", key);
                                    if !content.contains(&prefix) {
                                        if !content.ends_with('\n') {
                                            content.push('\n');
                                        }
                                        content.push_str(&env_line);
                                        content.push('\n');
                                        let _ = fs::write(&default_env, &content);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        eprintln!("[migration] Migrated channel bot credentials to ~/.hermes/.env");
    }

    if !migrated_agents.is_empty() {
        let _ = save_agents_meta(&migrated_agents);
    }

    let _ = fs::write(&marker, "ok");
    eprintln!("[migration] Migration complete!");
}

fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if src_path.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
