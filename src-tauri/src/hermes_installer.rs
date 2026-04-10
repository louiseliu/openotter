use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use tauri::Emitter;

const MIN_HERMES_VERSION: &str = "0.8.0";
const GITHUB_REPO: &str = "https://github.com/NousResearch/hermes-agent.git";
const GITHUB_PROXY: &str = "https://ghproxy.com/https://github.com/NousResearch/hermes-agent.git";
const PYPI_MIRROR_CN: &str = "https://pypi.tuna.tsinghua.edu.cn/simple";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HermesInstallSource {
    SystemExisting,
    OpenOtterManaged,
    NotInstalled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HermesInstallInfo {
    pub source: HermesInstallSource,
    pub binary_path: Option<String>,
    pub version: Option<String>,
    pub hermes_home: String,
    pub can_update: bool,
    pub meets_min_version: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Prerequisites {
    pub has_git: bool,
    pub git_version: Option<String>,
    pub has_python: bool,
    pub python_version: Option<String>,
    pub has_uv: bool,
    pub uv_version: Option<String>,
    pub is_china_network: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallProgress {
    pub stage: String,
    pub step: u32,
    pub total_steps: u32,
    pub progress: f32,
    pub message: String,
    pub error: Option<String>,
    pub done: bool,
}

fn user_home() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
}

pub fn openotter_dir() -> PathBuf {
    user_home().join(".openotter")
}

pub fn openotter_hermes_venv() -> PathBuf {
    openotter_dir().join("hermes-venv")
}

pub fn openotter_hermes_bin() -> PathBuf {
    openotter_hermes_venv().join("bin").join("hermes")
}

fn hermes_home() -> PathBuf {
    user_home().join(".hermes")
}

fn official_hermes_bin() -> PathBuf {
    hermes_home().join("hermes-agent").join("venv").join("bin").join("hermes")
}

fn local_bin_hermes() -> PathBuf {
    user_home().join(".local").join("bin").join("hermes")
}

fn run_cmd_output(cmd: &str, args: &[&str]) -> Option<String> {
    Command::new(cmd)
        .args(args)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

fn run_cmd_with_timeout(cmd: &str, args: &[&str], timeout_secs: u64) -> Option<String> {
    let cmd_owned = cmd.to_string();
    let args_owned: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        let result = Command::new(&cmd_owned)
            .args(&args_owned)
            .output();
        let _ = tx.send(result);
    });

    match rx.recv_timeout(std::time::Duration::from_secs(timeout_secs)) {
        Ok(Ok(out)) if out.status.success() => {
            Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
        }
        _ => None,
    }
}

fn parse_version(version_str: &str) -> Option<(u32, u32, u32)> {
    let cleaned = version_str
        .trim()
        .trim_start_matches('v')
        .trim_start_matches('V');
    let parts: Vec<&str> = cleaned.split('.').collect();
    if parts.len() >= 3 {
        let major = parts[0].parse().ok()?;
        let minor = parts[1].parse().ok()?;
        let patch_str: String = parts[2].chars().take_while(|c| c.is_ascii_digit()).collect();
        let patch = patch_str.parse().ok()?;
        Some((major, minor, patch))
    } else if parts.len() == 2 {
        let major = parts[0].parse().ok()?;
        let minor = parts[1].parse().ok()?;
        Some((major, minor, 0))
    } else {
        None
    }
}

fn version_meets_minimum(version: &str) -> bool {
    let current = match parse_version(version) {
        Some(v) => v,
        None => return false,
    };
    let minimum = match parse_version(MIN_HERMES_VERSION) {
        Some(v) => v,
        None => return false,
    };
    current >= minimum
}

fn detect_hermes_version(bin_path: &PathBuf) -> Option<String> {
    let output = run_cmd_with_timeout(
        bin_path.to_str().unwrap_or("hermes"),
        &["--version"],
        5,
    )?;

    output.lines().next().and_then(|l| {
        let trimmed = l.trim();
        if let Some(start) = trimmed.find('v') {
            let version_part = &trimmed[start..];
            let end = version_part
                .find(|c: char| c.is_whitespace() || c == '(')
                .unwrap_or(version_part.len());
            Some(version_part[..end].to_string())
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub fn detect_hermes() -> HermesInstallInfo {
    let home = hermes_home();
    let home_str = home.to_string_lossy().to_string();

    let candidates: Vec<(PathBuf, HermesInstallSource)> = vec![
        (openotter_hermes_bin(), HermesInstallSource::OpenOtterManaged),
        (official_hermes_bin(), HermesInstallSource::SystemExisting),
        (local_bin_hermes(), HermesInstallSource::SystemExisting),
    ];

    for (bin_path, source) in candidates {
        if bin_path.exists() {
            let version = detect_hermes_version(&bin_path);
            let meets_min = version
                .as_ref()
                .map(|v| version_meets_minimum(v))
                .unwrap_or(false);

            let can_update = matches!(source, HermesInstallSource::OpenOtterManaged);

            return HermesInstallInfo {
                source,
                binary_path: Some(bin_path.to_string_lossy().to_string()),
                version,
                hermes_home: home_str,
                can_update,
                meets_min_version: meets_min,
            };
        }
    }

    HermesInstallInfo {
        source: HermesInstallSource::NotInstalled,
        binary_path: None,
        version: None,
        hermes_home: home_str,
        can_update: false,
        meets_min_version: false,
    }
}

pub fn check_prerequisites() -> Prerequisites {
    let git_version = run_cmd_output("git", &["--version"])
        .map(|s| s.replace("git version ", "").trim().to_string());

    let python_version = run_cmd_output("python3", &["--version"])
        .or_else(|| run_cmd_output("python", &["--version"]))
        .map(|s| s.replace("Python ", "").trim().to_string());

    let uv_version = run_cmd_output("uv", &["--version"])
        .map(|s| s.replace("uv ", "").trim().to_string());

    let is_china = detect_china_network();

    Prerequisites {
        has_git: git_version.is_some(),
        git_version,
        has_python: python_version.is_some(),
        python_version,
        has_uv: uv_version.is_some(),
        uv_version,
        is_china_network: is_china,
    }
}

fn detect_china_network() -> bool {
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let result = Command::new("curl")
            .args(["-s", "--connect-timeout", "3", "-o", "/dev/null", "-w", "%{http_code}", "https://raw.githubusercontent.com"])
            .output();
        let _ = tx.send(result);
    });

    match rx.recv_timeout(std::time::Duration::from_secs(5)) {
        Ok(Ok(out)) => {
            let code = String::from_utf8_lossy(&out.stdout).trim().to_string();
            code == "000" || code.is_empty()
        }
        _ => true,
    }
}

fn emit_progress(app: &tauri::AppHandle, progress: &InstallProgress) {
    let _ = app.emit("hermes-install-progress", progress);
}

pub fn install_hermes(app: tauri::AppHandle, use_china_mirror: bool) -> Result<(), String> {
    let total_steps = 5u32;

    emit_progress(&app, &InstallProgress {
        stage: "check".to_string(),
        step: 1,
        total_steps,
        progress: 0.0,
        message: "检查系统环境...".to_string(),
        error: None,
        done: false,
    });

    let prereqs = check_prerequisites();
    if !prereqs.has_git {
        let err = "未检测到 Git。请先安装 Git（macOS 可运行 xcode-select --install）".to_string();
        emit_progress(&app, &InstallProgress {
            stage: "check".to_string(), step: 1, total_steps, progress: 0.0,
            message: err.clone(), error: Some(err.clone()), done: true,
        });
        return Err(err);
    }
    if !prereqs.has_python {
        let err = "未检测到 Python 3。请先安装 Python 3.10+（macOS 可运行 xcode-select --install）".to_string();
        emit_progress(&app, &InstallProgress {
            stage: "check".to_string(), step: 1, total_steps, progress: 0.0,
            message: err.clone(), error: Some(err.clone()), done: true,
        });
        return Err(err);
    }

    emit_progress(&app, &InstallProgress {
        stage: "check".to_string(), step: 1, total_steps, progress: 0.1,
        message: "环境检查通过 ✓".to_string(), error: None, done: false,
    });

    // Step 2: Install uv if needed
    if !prereqs.has_uv {
        emit_progress(&app, &InstallProgress {
            stage: "uv".to_string(), step: 2, total_steps, progress: 0.15,
            message: "正在安装 uv（Python 包管理器）...".to_string(), error: None, done: false,
        });

        let uv_install_result = install_uv(use_china_mirror);
        if let Err(e) = uv_install_result {
            let err = format!("安装 uv 失败: {}", e);
            emit_progress(&app, &InstallProgress {
                stage: "uv".to_string(), step: 2, total_steps, progress: 0.15,
                message: err.clone(), error: Some(err.clone()), done: true,
            });
            return Err(err);
        }
    }

    emit_progress(&app, &InstallProgress {
        stage: "uv".to_string(), step: 2, total_steps, progress: 0.2,
        message: "uv 已就绪 ✓".to_string(), error: None, done: false,
    });

    // Step 3: Create venv
    emit_progress(&app, &InstallProgress {
        stage: "venv".to_string(), step: 3, total_steps, progress: 0.25,
        message: "正在创建 Python 虚拟环境...".to_string(), error: None, done: false,
    });

    let venv_path = openotter_hermes_venv();
    if let Some(parent) = venv_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }

    if venv_path.exists() {
        let _ = std::fs::remove_dir_all(&venv_path);
    }

    let uv_bin = find_uv_binary();
    let venv_output = Command::new(&uv_bin)
        .args(["venv", venv_path.to_str().unwrap_or(""), "--python", "3.10"])
        .output()
        .map_err(|e| format!("创建虚拟环境失败: {}", e))?;

    if !venv_output.status.success() {
        let stderr = String::from_utf8_lossy(&venv_output.stderr);
        let fallback = Command::new(&uv_bin)
            .args(["venv", venv_path.to_str().unwrap_or("")])
            .output()
            .map_err(|e| format!("创建虚拟环境失败: {}", e))?;

        if !fallback.status.success() {
            let err = format!("创建虚拟环境失败: {}", stderr);
            emit_progress(&app, &InstallProgress {
                stage: "venv".to_string(), step: 3, total_steps, progress: 0.25,
                message: err.clone(), error: Some(err.clone()), done: true,
            });
            return Err(err);
        }
    }

    emit_progress(&app, &InstallProgress {
        stage: "venv".to_string(), step: 3, total_steps, progress: 0.35,
        message: "虚拟环境创建成功 ✓".to_string(), error: None, done: false,
    });

    // Step 4: Install Hermes Agent
    emit_progress(&app, &InstallProgress {
        stage: "install".to_string(), step: 4, total_steps, progress: 0.4,
        message: "正在下载并安装 Hermes Agent（这可能需要几分钟）...".to_string(),
        error: None, done: false,
    });

    let python_bin = venv_path.join("bin").join("python");
    let repo_url = if use_china_mirror { GITHUB_PROXY } else { GITHUB_REPO };
    let install_spec = format!("hermes-agent[all] @ git+{}", repo_url);

    let mut pip_args = vec![
        "pip".to_string(),
        "install".to_string(),
        "--python".to_string(),
        python_bin.to_string_lossy().to_string(),
    ];

    if use_china_mirror {
        pip_args.push("-i".to_string());
        pip_args.push(PYPI_MIRROR_CN.to_string());
    }

    pip_args.push(install_spec);

    let pip_args_refs: Vec<&str> = pip_args.iter().map(|s| s.as_str()).collect();

    let install_output = Command::new(&uv_bin)
        .args(&pip_args_refs)
        .env("UV_LINK_MODE", "copy")
        .output()
        .map_err(|e| format!("安装 Hermes Agent 失败: {}", e))?;

    if !install_output.status.success() {
        let stderr = String::from_utf8_lossy(&install_output.stderr);
        let err = format!("安装 Hermes Agent 失败: {}", stderr);
        emit_progress(&app, &InstallProgress {
            stage: "install".to_string(), step: 4, total_steps, progress: 0.4,
            message: err.clone(), error: Some(err.clone()), done: true,
        });
        return Err(err);
    }

    emit_progress(&app, &InstallProgress {
        stage: "install".to_string(), step: 4, total_steps, progress: 0.85,
        message: "Hermes Agent 安装成功 ✓".to_string(), error: None, done: false,
    });

    // Step 5: Verify and initialize
    emit_progress(&app, &InstallProgress {
        stage: "verify".to_string(), step: 5, total_steps, progress: 0.9,
        message: "正在验证安装...".to_string(), error: None, done: false,
    });

    let hermes_bin = openotter_hermes_bin();
    if !hermes_bin.exists() {
        let err = "安装完成但找不到 hermes 可执行文件".to_string();
        emit_progress(&app, &InstallProgress {
            stage: "verify".to_string(), step: 5, total_steps, progress: 0.9,
            message: err.clone(), error: Some(err.clone()), done: true,
        });
        return Err(err);
    }

    let version = detect_hermes_version(&hermes_bin);

    let hermes_home_dir = hermes_home();
    let _ = std::fs::create_dir_all(&hermes_home_dir);
    let _ = std::fs::create_dir_all(hermes_home_dir.join("skills"));
    let _ = std::fs::create_dir_all(hermes_home_dir.join("sessions"));
    let _ = std::fs::create_dir_all(hermes_home_dir.join("memories"));

    let version_display = version.unwrap_or_else(|| "unknown".to_string());
    emit_progress(&app, &InstallProgress {
        stage: "done".to_string(), step: 5, total_steps, progress: 1.0,
        message: format!("Hermes Agent {} 安装完成！", version_display),
        error: None, done: true,
    });

    Ok(())
}

fn install_uv(use_china_mirror: bool) -> Result<(), String> {
    let uv_install_url = if use_china_mirror {
        "https://ghproxy.com/https://astral.sh/uv/install.sh"
    } else {
        "https://astral.sh/uv/install.sh"
    };

    let curl_output = Command::new("curl")
        .args(["-LsSf", uv_install_url])
        .output()
        .map_err(|e| format!("下载 uv 安装脚本失败: {}", e))?;

    if !curl_output.status.success() {
        return Err("下载 uv 安装脚本失败".to_string());
    }

    let install_result = Command::new("sh")
        .arg("-c")
        .arg(String::from_utf8_lossy(&curl_output.stdout).as_ref())
        .env("UV_UNMANAGED_INSTALL", user_home().join(".local").join("bin").to_str().unwrap_or(""))
        .output()
        .map_err(|e| format!("执行 uv 安装脚本失败: {}", e))?;

    if !install_result.status.success() {
        let stderr = String::from_utf8_lossy(&install_result.stderr);
        return Err(format!("uv 安装失败: {}", stderr));
    }

    Ok(())
}

fn find_uv_binary() -> String {
    if let Some(output) = run_cmd_output("which", &["uv"]) {
        return output;
    }

    let home = user_home();
    let candidates = [
        home.join(".local").join("bin").join("uv"),
        home.join(".cargo").join("bin").join("uv"),
        PathBuf::from("/usr/local/bin/uv"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }

    "uv".to_string()
}

pub fn update_hermes(app: tauri::AppHandle, use_china_mirror: bool) -> Result<(), String> {
    let info = detect_hermes();
    if !matches!(info.source, HermesInstallSource::OpenOtterManaged) {
        return Err("只能更新由 OpenOtter 管理的 Hermes 安装".to_string());
    }

    emit_progress(&app, &InstallProgress {
        stage: "update".to_string(), step: 1, total_steps: 2, progress: 0.1,
        message: "正在更新 Hermes Agent...".to_string(), error: None, done: false,
    });

    let venv_path = openotter_hermes_venv();
    let python_bin = venv_path.join("bin").join("python");
    let repo_url = if use_china_mirror { GITHUB_PROXY } else { GITHUB_REPO };
    let install_spec = format!("hermes-agent[all] @ git+{}", repo_url);

    let uv_bin = find_uv_binary();
    let mut pip_args = vec![
        "pip", "install", "--upgrade",
        "--python", python_bin.to_str().unwrap_or(""),
    ];

    let mirror_owned;
    if use_china_mirror {
        mirror_owned = PYPI_MIRROR_CN.to_string();
        pip_args.push("-i");
        pip_args.push(&mirror_owned);
    }

    pip_args.push(&install_spec);

    let output = Command::new(&uv_bin)
        .args(&pip_args)
        .env("UV_LINK_MODE", "copy")
        .output()
        .map_err(|e| format!("更新失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err = format!("更新 Hermes Agent 失败: {}", stderr);
        emit_progress(&app, &InstallProgress {
            stage: "update".to_string(), step: 2, total_steps: 2, progress: 0.5,
            message: err.clone(), error: Some(err.clone()), done: true,
        });
        return Err(err);
    }

    let hermes_bin = openotter_hermes_bin();
    let version = detect_hermes_version(&hermes_bin).unwrap_or_else(|| "unknown".to_string());

    emit_progress(&app, &InstallProgress {
        stage: "done".to_string(), step: 2, total_steps: 2, progress: 1.0,
        message: format!("Hermes Agent 已更新到 {}", version),
        error: None, done: true,
    });

    Ok(())
}

pub fn get_hermes_binary_path() -> Option<PathBuf> {
    let candidates = [
        openotter_hermes_bin(),
        official_hermes_bin(),
        local_bin_hermes(),
    ];

    candidates.into_iter().find(|p| p.exists())
}
