use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

fn desktop_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".hermes").join("desktop")
}

fn models_file() -> PathBuf {
    desktop_dir().join("models.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SavedModel {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub model: String,
    pub base_url: String,
    pub created_at: i64,
}

fn read_models() -> Vec<SavedModel> {
    let path = models_file();
    if !path.exists() {
        return vec![];
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_models(models: &[SavedModel]) {
    let dir = desktop_dir();
    let _ = fs::create_dir_all(&dir);
    let json = serde_json::to_string_pretty(models).unwrap_or_default();
    let _ = fs::write(models_file(), json);
}

fn now_ts() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn seed_defaults() -> Vec<SavedModel> {
    let defaults = vec![
        // Chinese providers
        ("智谱 GLM-4-Plus", "zai", "glm-4-plus", "https://open.bigmodel.cn/api/paas/v4"),
        ("DeepSeek R1", "deepseek", "deepseek-reasoner", "https://api.deepseek.com/v1"),
        ("DeepSeek V3", "deepseek", "deepseek-chat", "https://api.deepseek.com/v1"),
        ("通义千问 Max", "dashscope", "qwen-max", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        ("通义千问 Plus", "dashscope", "qwen-plus", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        ("Kimi (Moonshot)", "kimi", "moonshot-v1-auto", "https://api.moonshot.cn/v1"),
        ("MiniMax abab7", "minimax-cn", "abab7-chat-preview", "https://api.minimax.chat/v1"),
        // OpenRouter
        ("Claude Sonnet 4", "openrouter", "anthropic/claude-sonnet-4-20250514", "https://openrouter.ai/api/v1"),
        ("Claude Opus 4", "openrouter", "anthropic/claude-opus-4-20250918", "https://openrouter.ai/api/v1"),
        ("GPT-4o", "openrouter", "openai/gpt-4o", "https://openrouter.ai/api/v1"),
        ("Gemini 2.5 Pro", "openrouter", "google/gemini-2.5-pro-preview", "https://openrouter.ai/api/v1"),
        ("Gemini 2.5 Flash", "openrouter", "google/gemini-2.5-flash-preview", "https://openrouter.ai/api/v1"),
        ("Llama 4 Maverick", "openrouter", "meta-llama/llama-4-maverick", "https://openrouter.ai/api/v1"),
        // Direct providers
        ("Claude Sonnet 4", "anthropic", "claude-sonnet-4-20250514", "https://api.anthropic.com/v1"),
        ("GPT-4o", "openai", "gpt-4o", "https://api.openai.com/v1"),
        ("GPT-4.1", "openai", "gpt-4.1", "https://api.openai.com/v1"),
    ];

    let models: Vec<SavedModel> = defaults
        .into_iter()
        .map(|(name, provider, model, base_url)| SavedModel {
            id: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            provider: provider.to_string(),
            model: model.to_string(),
            base_url: base_url.to_string(),
            created_at: now_ts(),
        })
        .collect();

    write_models(&models);
    models
}

pub fn list_models() -> Vec<SavedModel> {
    let models = read_models();
    if models.is_empty() {
        return seed_defaults();
    }
    models
}

pub fn add_model(name: &str, provider: &str, model: &str, base_url: &str) -> SavedModel {
    let mut models = read_models();

    if let Some(existing) = models.iter().find(|m| m.model == model && m.provider == provider) {
        return existing.clone();
    }

    let entry = SavedModel {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.to_string(),
        provider: provider.to_string(),
        model: model.to_string(),
        base_url: base_url.to_string(),
        created_at: now_ts(),
    };
    models.push(entry.clone());
    write_models(&models);
    entry
}

pub fn remove_model(id: &str) -> bool {
    let mut models = read_models();
    let before = models.len();
    models.retain(|m| m.id != id);
    if models.len() < before {
        write_models(&models);
        true
    } else {
        false
    }
}

pub fn update_model(id: &str, name: Option<&str>, provider: Option<&str>, model: Option<&str>, base_url: Option<&str>) -> bool {
    let mut models = read_models();
    if let Some(entry) = models.iter_mut().find(|m| m.id == id) {
        if let Some(n) = name { entry.name = n.to_string(); }
        if let Some(p) = provider { entry.provider = p.to_string(); }
        if let Some(m) = model { entry.model = m.to_string(); }
        if let Some(b) = base_url { entry.base_url = b.to_string(); }
        write_models(&models);
        true
    } else {
        false
    }
}
