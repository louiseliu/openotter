use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

fn auth_file_path() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".hermes").join("auth.json")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CredentialEntry {
    pub key: String,
    pub label: String,
}

fn read_auth_store() -> serde_json::Value {
    let path = auth_file_path();
    if !path.exists() {
        return serde_json::json!({});
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn write_auth_store(store: &serde_json::Value) {
    let path = auth_file_path();
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(store).unwrap_or_default();
    let _ = fs::write(path, json);
}

pub fn get_credential_pool() -> HashMap<String, Vec<CredentialEntry>> {
    let store = read_auth_store();
    let pool = store.get("credential_pool");

    match pool {
        Some(serde_json::Value::Object(map)) => {
            let mut result = HashMap::new();
            for (provider, entries) in map {
                if let Ok(creds) = serde_json::from_value::<Vec<CredentialEntry>>(entries.clone()) {
                    result.insert(provider.clone(), creds);
                }
            }
            result
        }
        _ => HashMap::new(),
    }
}

pub fn set_credential_pool(provider: &str, entries: Vec<CredentialEntry>) {
    let mut store = read_auth_store();

    if !store.get("credential_pool").map_or(false, |v| v.is_object()) {
        store["credential_pool"] = serde_json::json!({});
    }

    store["credential_pool"][provider] = serde_json::to_value(&entries).unwrap_or_default();
    write_auth_store(&store);
}
