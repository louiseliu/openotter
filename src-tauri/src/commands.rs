use crate::agent_manager::{self, AgentMeta};
use crate::config::{HermesConfig, InstallStatus};
use crate::gateway_manager::{self, GatewayManagerState, GatewayProcess, GatewayStatus};
use crate::hermes_installer;
use crate::sidecar::{HermesProcess, SidecarState};
use crate::web_server::WebServerState;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

// ─── App Status ────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct AppStatus {
    pub install_status: InstallStatus,
    pub hermes_version: Option<String>,
    pub hermes_home: String,
    pub sidecar_running: bool,
    pub sidecar_port: Option<u16>,
    pub agent_count: usize,
    pub running_gateways: usize,
}

#[tauri::command]
pub fn get_app_status(
    sidecar: State<'_, Mutex<SidecarState>>,
    gateways: State<'_, Mutex<GatewayManagerState>>,
) -> AppStatus {
    let install_status = HermesConfig::detect_installation();
    let config = HermesConfig::default();

    let mut sc = sidecar.lock().unwrap();
    let mut sidecar_running = sc.process.as_ref().map_or(false, |p| p.ready);
    let mut sidecar_port = sc.process.as_ref().map(|p| p.port);

    if !sidecar_running {
        if let Some(port) = detect_running_gateway(&config) {
            sc.process = Some(HermesProcess {
                port,
                ready: true,
                pid: None,
            });
            sidecar_running = true;
            sidecar_port = Some(port);
        }
    }
    drop(sc);

    let agents = agent_manager::list_agents();
    let gw = gateways.lock().unwrap();

    AppStatus {
        install_status,
        hermes_version: detect_hermes_version(),
        hermes_home: config.hermes_home.to_string_lossy().to_string(),
        sidecar_running,
        sidecar_port,
        agent_count: agents.len(),
        running_gateways: gw.processes.len(),
    }
}

fn detect_running_gateway(config: &HermesConfig) -> Option<u16> {
    let env_path = config.env_file_path();
    if !env_path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(&env_path).ok()?;
    let port: u16 = content.lines()
        .find(|l| l.starts_with("API_SERVER_PORT="))
        .and_then(|l| l.splitn(2, '=').nth(1))
        .and_then(|v| v.trim().parse().ok())?;

    use std::io::{Read, Write};
    use std::net::TcpStream;
    let addr = format!("127.0.0.1:{}", port);
    let mut stream = TcpStream::connect_timeout(
        &addr.parse().ok()?,
        std::time::Duration::from_secs(2),
    ).ok()?;
    stream.set_read_timeout(Some(std::time::Duration::from_secs(2))).ok()?;
    let request = format!(
        "GET /v1/models HTTP/1.1\r\nHost: 127.0.0.1:{}\r\nConnection: close\r\n\r\n",
        port
    );
    stream.write_all(request.as_bytes()).ok()?;
    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);
    if response.contains("200 OK") || response.contains("hermes-agent") {
        Some(port)
    } else {
        None
    }
}

// ─── Agent CRUD ────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct CreateAgentRequest {
    pub name: String,
    pub description: String,
    pub avatar: String,
    pub soul_md: String,
    pub provider: String,
    pub model: String,
    pub api_key: String,
}

#[tauri::command]
pub fn create_agent(request: CreateAgentRequest) -> Result<AgentMeta, String> {
    agent_manager::create_agent(
        request.name,
        request.description,
        request.avatar,
        request.soul_md,
        request.provider,
        request.model,
        request.api_key,
    )
}

#[tauri::command]
pub fn list_agents() -> Vec<AgentMeta> {
    agent_manager::list_agents()
}

#[tauri::command]
pub fn get_agent(id: String) -> Result<AgentMeta, String> {
    agent_manager::get_agent(&id).ok_or_else(|| "Agent not found".to_string())
}

#[tauri::command]
pub fn delete_agent(
    id: String,
    gateways: State<'_, Mutex<GatewayManagerState>>,
) -> Result<(), String> {
    {
        let mut mgr = gateways.lock().map_err(|e| e.to_string())?;
        if let Some(proc) = mgr.processes.remove(&id) {
            if let Some(pid) = proc.pid {
                let _ = kill_process(pid);
            }
        }
    }
    agent_manager::delete_agent(&id)
}

#[tauri::command]
pub fn get_agent_soul(id: String) -> Result<String, String> {
    agent_manager::get_agent_soul(&id)
}

#[tauri::command]
pub fn update_agent_soul(id: String, soul_md: String) -> Result<(), String> {
    agent_manager::update_agent_soul(&id, &soul_md)
}

// ─── Profile Files ─────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileFileInfo {
    pub name: String,
    pub size: u64,
    pub editable: bool,
}

#[tauri::command]
pub fn list_profile_files(id: String) -> Result<Vec<ProfileFileInfo>, String> {
    let home = agent_manager::agent_home(&id);
    if !home.exists() {
        return Err("Profile not found".to_string());
    }

    let editable_files = [".env", "SOUL.md", "config.yaml"];
    let mut files = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&home) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if name.starts_with('.') && name != ".env" {
                continue;
            }
            let meta = std::fs::metadata(&path).ok();
            let size = meta.map(|m| m.len()).unwrap_or(0);
            let editable = editable_files.contains(&name.as_str());
            files.push(ProfileFileInfo {
                name,
                size,
                editable,
            });
        }
    }

    files.sort_by(|a, b| {
        let order = |n: &str| -> u8 {
            match n {
                ".env" => 0,
                "config.yaml" => 1,
                "SOUL.md" => 2,
                _ => 10,
            }
        };
        order(&a.name).cmp(&order(&b.name))
    });

    Ok(files)
}

#[tauri::command]
pub fn get_profile_file(id: String, filename: String) -> Result<String, String> {
    let home = agent_manager::agent_home(&id);
    let path = home.join(&filename);
    if !path.exists() {
        return Err(format!("File not found: {}", filename));
    }
    if !path.starts_with(&home) {
        return Err("Access denied".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", filename, e))
}

#[tauri::command]
pub fn save_profile_file(id: String, filename: String, content: String) -> Result<(), String> {
    let allowed = [".env", "SOUL.md", "config.yaml"];
    if !allowed.contains(&filename.as_str()) {
        return Err(format!("Cannot edit file: {}", filename));
    }
    let home = agent_manager::agent_home(&id);
    let path = home.join(&filename);
    if !path.starts_with(&home) {
        return Err("Access denied".to_string());
    }
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write {}: {}", filename, e))
}

// ─── Platform Configuration ────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ConfigurePlatformRequest {
    pub agent_id: String,
    pub platform: String,
    pub config: HashMap<String, String>,
}

#[tauri::command]
pub fn configure_platform(request: ConfigurePlatformRequest) -> Result<(), String> {
    agent_manager::configure_platform(&request.agent_id, &request.platform, &request.config)
}

#[derive(Debug, Deserialize)]
pub struct UnconfigurePlatformRequest {
    pub agent_id: String,
    pub platform: String,
}

#[tauri::command]
pub fn unconfigure_platform(request: UnconfigurePlatformRequest) -> Result<(), String> {
    agent_manager::unconfigure_platform(&request.agent_id, &request.platform)
}

#[tauri::command]
pub fn get_platform_templates() -> Vec<PlatformTemplate> {
    vec![
        PlatformTemplate {
            id: "feishu".to_string(),
            name: "飞书 / Lark".to_string(),
            icon: "feishu".to_string(),
            description: "接入飞书/Lark，支持 WebSocket 和 Webhook 两种模式".to_string(),
            fields: vec![
                PlatformField { key: "FEISHU_APP_ID".into(), label: "App ID".into(), placeholder: "cli_xxxxxxxxxx".into(), required: true, secret: false, help: "在飞书开放平台创建应用后获取".into() },
                PlatformField { key: "FEISHU_APP_SECRET".into(), label: "App Secret".into(), placeholder: "".into(), required: true, secret: true, help: "应用的 Secret Key".into() },
                PlatformField { key: "FEISHU_DOMAIN".into(), label: "域名".into(), placeholder: "feishu".into(), required: false, secret: false, help: "feishu（中国）或 lark（国际）".into() },
                PlatformField { key: "FEISHU_CONNECTION_MODE".into(), label: "连接模式".into(), placeholder: "websocket".into(), required: false, secret: false, help: "websocket（推荐）或 webhook".into() },
                PlatformField { key: "FEISHU_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "ou_xxx,ou_yyy".into(), required: false, secret: false, help: "逗号分隔的 Open ID 列表".into() },
            ],
            setup_url: "https://open.feishu.cn/page/openclaw?form=multiAgent".to_string(),
            setup_guide: "1. 打开飞书开放平台\n2. 创建企业自建应用\n3. 启用「机器人」能力\n4. 复制 App ID 和 App Secret".to_string(),
        },
        PlatformTemplate {
            id: "dingtalk".to_string(),
            name: "钉钉 / DingTalk".to_string(),
            icon: "dingtalk".to_string(),
            description: "接入钉钉，使用 Stream Mode 无需公网地址".to_string(),
            fields: vec![
                PlatformField { key: "DINGTALK_CLIENT_ID".into(), label: "Client ID (AppKey)".into(), placeholder: "".into(), required: true, secret: false, help: "钉钉开放平台应用的 AppKey".into() },
                PlatformField { key: "DINGTALK_CLIENT_SECRET".into(), label: "Client Secret".into(), placeholder: "".into(), required: true, secret: true, help: "钉钉开放平台应用的 AppSecret".into() },
                PlatformField { key: "DINGTALK_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "user-id-1,user-id-2".into(), required: false, secret: false, help: "逗号分隔的用户 ID 列表".into() },
            ],
            setup_url: "https://open-dev.dingtalk.com/".to_string(),
            setup_guide: "1. 打开钉钉开放平台\n2. 创建应用，启用机器人\n3. 选择 Stream Mode\n4. 复制 Client ID 和 Secret".to_string(),
        },
        PlatformTemplate {
            id: "wecom".to_string(),
            name: "企业微信 / WeCom".to_string(),
            icon: "wecom".to_string(),
            description: "接入企业微信，使用 AI Bot WebSocket 模式".to_string(),
            fields: vec![
                PlatformField { key: "WECOM_BOT_ID".into(), label: "Bot ID".into(), placeholder: "".into(), required: true, secret: false, help: "企业微信 AI Bot 的 ID".into() },
                PlatformField { key: "WECOM_SECRET".into(), label: "Secret".into(), placeholder: "".into(), required: true, secret: true, help: "企业微信 AI Bot 的 Secret".into() },
                PlatformField { key: "WECOM_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "user_id_1,user_id_2".into(), required: false, secret: false, help: "逗号分隔的用户 ID 列表".into() },
            ],
            setup_url: "https://work.weixin.qq.com/wework_admin/frame".to_string(),
            setup_guide: "1. 登录企业微信管理后台\n2. 应用管理 → 创建 AI Bot\n3. 复制 Bot ID 和 Secret".to_string(),
        },
        PlatformTemplate {
            id: "telegram".to_string(),
            name: "Telegram".to_string(),
            icon: "telegram".to_string(),
            description: "接入 Telegram Bot".to_string(),
            fields: vec![
                PlatformField { key: "TELEGRAM_BOT_TOKEN".into(), label: "Bot Token".into(), placeholder: "123456:ABC-DEF...".into(), required: true, secret: true, help: "从 @BotFather 获取的 Bot Token".into() },
                PlatformField { key: "TELEGRAM_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "123456789".into(), required: false, secret: false, help: "逗号分隔的 Telegram User ID".into() },
            ],
            setup_url: "https://t.me/BotFather".to_string(),
            setup_guide: "1. 在 Telegram 中搜索 @BotFather\n2. 发送 /newbot 创建机器人\n3. 复制 Bot Token".to_string(),
        },
        PlatformTemplate {
            id: "discord".to_string(),
            name: "Discord".to_string(),
            icon: "discord".to_string(),
            description: "接入 Discord Bot，支持语音频道".to_string(),
            fields: vec![
                PlatformField { key: "DISCORD_BOT_TOKEN".into(), label: "Bot Token".into(), placeholder: "".into(), required: true, secret: true, help: "Discord Developer Portal 获取".into() },
                PlatformField { key: "DISCORD_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "123456789012345678".into(), required: false, secret: false, help: "逗号分隔的 Discord User ID".into() },
            ],
            setup_url: "https://discord.com/developers/applications".to_string(),
            setup_guide: "1. 打开 Discord Developer Portal\n2. 创建 Application → Bot\n3. 复制 Bot Token\n4. 邀请 Bot 到服务器".to_string(),
        },
        PlatformTemplate {
            id: "slack".to_string(),
            name: "Slack".to_string(),
            icon: "slack".to_string(),
            description: "接入 Slack Bot".to_string(),
            fields: vec![
                PlatformField { key: "SLACK_BOT_TOKEN".into(), label: "Bot Token".into(), placeholder: "xoxb-...".into(), required: true, secret: true, help: "Slack App 的 Bot User OAuth Token".into() },
                PlatformField { key: "SLACK_APP_TOKEN".into(), label: "App Token".into(), placeholder: "xapp-...".into(), required: true, secret: true, help: "Slack App 的 App-Level Token".into() },
            ],
            setup_url: "https://api.slack.com/apps".to_string(),
            setup_guide: "1. 创建 Slack App\n2. 启用 Socket Mode\n3. 添加 Bot Token Scopes\n4. 安装到 Workspace".to_string(),
        },
        PlatformTemplate {
            id: "whatsapp".to_string(),
            name: "WhatsApp".to_string(),
            icon: "whatsapp".to_string(),
            description: "通过内置 Baileys 桥接接入 WhatsApp，需扫码配对".to_string(),
            fields: vec![
                PlatformField { key: "WHATSAPP_ENABLED".into(), label: "启用".into(), placeholder: "true".into(), required: true, secret: false, help: "设为 true 启用 WhatsApp 桥接".into() },
                PlatformField { key: "WHATSAPP_MODE".into(), label: "模式".into(), placeholder: "bot".into(), required: true, secret: false, help: "bot（独立号码）或 self-chat（自聊模式）".into() },
                PlatformField { key: "WHATSAPP_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "8613800138000".into(), required: false, secret: false, help: "逗号分隔的电话号码（含国家码，不含+）".into() },
            ],
            setup_url: "".to_string(),
            setup_guide: "1. 确保已安装 Node.js v18+\n2. 运行 hermes whatsapp 启动配对向导\n3. 用 WhatsApp 扫描终端中的二维码\n4. 配对成功后启动 gateway".to_string(),
        },
        PlatformTemplate {
            id: "signal".to_string(),
            name: "Signal".to_string(),
            icon: "signal".to_string(),
            description: "通过 signal-cli 守护进程接入 Signal".to_string(),
            fields: vec![
                PlatformField { key: "SIGNAL_HTTP_URL".into(), label: "signal-cli HTTP 地址".into(), placeholder: "http://127.0.0.1:8080".into(), required: true, secret: false, help: "signal-cli 守护进程的 HTTP 端点".into() },
                PlatformField { key: "SIGNAL_ACCOUNT".into(), label: "Bot 手机号".into(), placeholder: "+8613800138000".into(), required: true, secret: false, help: "E.164 格式的手机号码".into() },
                PlatformField { key: "SIGNAL_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "+8613900139000".into(), required: false, secret: false, help: "逗号分隔的 E.164 手机号或 UUID".into() },
            ],
            setup_url: "https://github.com/AsamK/signal-cli".to_string(),
            setup_guide: "1. 安装 signal-cli 并注册手机号\n2. 启动 signal-cli daemon --http\n3. 填写 HTTP 地址和账号\n4. 启动 gateway".to_string(),
        },
        PlatformTemplate {
            id: "sms".to_string(),
            name: "SMS (Twilio)".to_string(),
            icon: "sms".to_string(),
            description: "通过 Twilio 接入短信".to_string(),
            fields: vec![
                PlatformField { key: "TWILIO_ACCOUNT_SID".into(), label: "Account SID".into(), placeholder: "AC...".into(), required: true, secret: false, help: "Twilio 控制台获取".into() },
                PlatformField { key: "TWILIO_AUTH_TOKEN".into(), label: "Auth Token".into(), placeholder: "".into(), required: true, secret: true, help: "Twilio 认证令牌".into() },
                PlatformField { key: "TWILIO_PHONE_NUMBER".into(), label: "Twilio 号码".into(), placeholder: "+15551234567".into(), required: true, secret: false, help: "Twilio 分配的电话号码".into() },
                PlatformField { key: "SMS_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "+8613800138000".into(), required: false, secret: false, help: "逗号分隔的 E.164 手机号".into() },
            ],
            setup_url: "https://www.twilio.com/console".to_string(),
            setup_guide: "1. 注册 Twilio 账号\n2. 获取 Account SID 和 Auth Token\n3. 购买一个电话号码\n4. 配置 Webhook 到 gateway".to_string(),
        },
        PlatformTemplate {
            id: "email".to_string(),
            name: "Email 邮件".to_string(),
            icon: "email".to_string(),
            description: "通过 IMAP/SMTP 接入邮件".to_string(),
            fields: vec![
                PlatformField { key: "EMAIL_ADDRESS".into(), label: "邮箱地址".into(), placeholder: "bot@example.com".into(), required: true, secret: false, help: "用于收发邮件的地址".into() },
                PlatformField { key: "EMAIL_PASSWORD".into(), label: "密码/应用密码".into(), placeholder: "".into(), required: true, secret: true, help: "邮箱密码或应用专用密码".into() },
                PlatformField { key: "EMAIL_IMAP_HOST".into(), label: "IMAP 服务器".into(), placeholder: "imap.gmail.com".into(), required: true, secret: false, help: "IMAP 主机地址".into() },
                PlatformField { key: "EMAIL_SMTP_HOST".into(), label: "SMTP 服务器".into(), placeholder: "smtp.gmail.com".into(), required: true, secret: false, help: "SMTP 主机地址".into() },
                PlatformField { key: "EMAIL_ALLOWED_USERS".into(), label: "允许的发件人".into(), placeholder: "user@example.com".into(), required: false, secret: false, help: "逗号分隔的允许邮箱地址".into() },
            ],
            setup_url: "".to_string(),
            setup_guide: "1. 准备一个邮箱账号\n2. 启用 IMAP 访问\n3. 如使用 Gmail 需生成应用专用密码\n4. 填写 IMAP/SMTP 服务器信息".to_string(),
        },
        PlatformTemplate {
            id: "mattermost".to_string(),
            name: "Mattermost".to_string(),
            icon: "mattermost".to_string(),
            description: "接入 Mattermost 自托管团队协作平台".to_string(),
            fields: vec![
                PlatformField { key: "MATTERMOST_URL".into(), label: "服务器地址".into(), placeholder: "https://mm.example.com".into(), required: true, secret: false, help: "Mattermost 服务器完整 URL".into() },
                PlatformField { key: "MATTERMOST_TOKEN".into(), label: "Bot Token".into(), placeholder: "".into(), required: true, secret: true, help: "Bot 账号或个人访问令牌".into() },
                PlatformField { key: "MATTERMOST_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "user-id-1,user-id-2".into(), required: false, secret: false, help: "逗号分隔的 Mattermost 用户 ID".into() },
            ],
            setup_url: "".to_string(),
            setup_guide: "1. 在 Mattermost 管理后台创建 Bot 账号\n2. 获取 Bot Token\n3. 将 Bot 添加到目标频道".to_string(),
        },
        PlatformTemplate {
            id: "matrix".to_string(),
            name: "Matrix".to_string(),
            icon: "matrix".to_string(),
            description: "接入 Matrix 去中心化通信协议".to_string(),
            fields: vec![
                PlatformField { key: "MATRIX_HOMESERVER".into(), label: "Homeserver URL".into(), placeholder: "https://matrix.org".into(), required: true, secret: false, help: "Matrix homeserver 地址".into() },
                PlatformField { key: "MATRIX_ACCESS_TOKEN".into(), label: "Access Token".into(), placeholder: "".into(), required: true, secret: true, help: "Matrix 访问令牌（或使用密码登录）".into() },
                PlatformField { key: "MATRIX_USER_ID".into(), label: "User ID".into(), placeholder: "@hermes:matrix.org".into(), required: false, secret: false, help: "Matrix 用户 ID（密码登录时必填）".into() },
                PlatformField { key: "MATRIX_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "@alice:matrix.org".into(), required: false, secret: false, help: "逗号分隔的 Matrix 用户 ID".into() },
            ],
            setup_url: "https://app.element.io".to_string(),
            setup_guide: "1. 在 Matrix homeserver 上注册 Bot 账号\n2. 获取 Access Token\n3. 邀请 Bot 到目标房间".to_string(),
        },
        PlatformTemplate {
            id: "homeassistant".to_string(),
            name: "Home Assistant".to_string(),
            icon: "homeassistant".to_string(),
            description: "接入 Home Assistant 智能家居平台".to_string(),
            fields: vec![
                PlatformField { key: "HASS_TOKEN".into(), label: "长期访问令牌".into(), placeholder: "".into(), required: true, secret: true, help: "在 HA 个人资料页面生成长期访问令牌".into() },
                PlatformField { key: "HASS_URL".into(), label: "HA 地址".into(), placeholder: "http://homeassistant.local:8123".into(), required: false, secret: false, help: "Home Assistant 的访问地址".into() },
            ],
            setup_url: "".to_string(),
            setup_guide: "1. 打开 Home Assistant\n2. 个人资料 → 安全 → 长期访问令牌\n3. 创建新令牌并复制".to_string(),
        },
        PlatformTemplate {
            id: "weixin".to_string(),
            name: "微信 / Weixin".to_string(),
            icon: "weixin".to_string(),
            description: "通过 iLink Bot API 接入微信".to_string(),
            fields: vec![
                PlatformField { key: "WEIXIN_ACCOUNT_ID".into(), label: "Account ID".into(), placeholder: "".into(), required: true, secret: false, help: "通过 iLink Bot API 扫码登录获取".into() },
                PlatformField { key: "WEIXIN_TOKEN".into(), label: "Token".into(), placeholder: "".into(), required: true, secret: true, help: "通过 iLink Bot API 扫码登录获取".into() },
                PlatformField { key: "WEIXIN_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "wxid_xxx".into(), required: false, secret: false, help: "逗号分隔的微信用户 ID".into() },
            ],
            setup_url: "https://ilinkai.weixin.qq.com".to_string(),
            setup_guide: "1. 访问 iLink Bot API\n2. 使用微信扫码登录获取凭证\n3. 复制 Account ID 和 Token".to_string(),
        },
        PlatformTemplate {
            id: "bluebubbles".to_string(),
            name: "BlueBubbles (iMessage)".to_string(),
            icon: "bluebubbles".to_string(),
            description: "通过 BlueBubbles 服务器接入 iMessage".to_string(),
            fields: vec![
                PlatformField { key: "BLUEBUBBLES_SERVER_URL".into(), label: "服务器地址".into(), placeholder: "http://192.168.1.10:1234".into(), required: true, secret: false, help: "BlueBubbles 服务器的 URL".into() },
                PlatformField { key: "BLUEBUBBLES_PASSWORD".into(), label: "服务器密码".into(), placeholder: "".into(), required: true, secret: true, help: "BlueBubbles 服务器密码".into() },
                PlatformField { key: "BLUEBUBBLES_ALLOWED_USERS".into(), label: "允许的用户".into(), placeholder: "+8613800138000".into(), required: false, secret: false, help: "逗号分隔的授权用户".into() },
            ],
            setup_url: "https://bluebubbles.app".to_string(),
            setup_guide: "1. 在 Mac 上安装 BlueBubbles 服务器\n2. 配置并启动服务器\n3. 获取服务器地址和密码".to_string(),
        },
    ]
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformTemplate {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub description: String,
    pub fields: Vec<PlatformField>,
    pub setup_url: String,
    pub setup_guide: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformField {
    pub key: String,
    pub label: String,
    pub placeholder: String,
    pub required: bool,
    pub secret: bool,
    pub help: String,
}

// ─── Channel Bots ──────────────────────────────────────────
// Channel bots store UI-level metadata in ~/.openotter/channels.json
// and sync credentials to the target Hermes profile's .env file.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelBot {
    pub id: String,
    pub name: String,
    pub platform_id: String,
    pub config: HashMap<String, String>,
    #[serde(default = "default_agent_id")]
    pub agent_id: String,
    pub created_at: u64,
}

fn default_agent_id() -> String {
    "default".to_string()
}

fn channels_json_path() -> std::path::PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(home)
        .join(".openotter")
        .join("channels.json")
}

fn load_channel_bots() -> Vec<ChannelBot> {
    let path = channels_json_path();
    if !path.exists() {
        return vec![];
    }
    let data = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_channel_bots(bots: &[ChannelBot]) -> Result<(), String> {
    let path = channels_json_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_string_pretty(bots).map_err(|e| e.to_string())?;
    std::fs::write(&path, data).map_err(|e| format!("Failed to write channels.json: {}", e))
}

fn sync_bot_credentials_to_profile(agent_id: &str, config: &HashMap<String, String>) -> Result<(), String> {
    for (key, value) in config {
        agent_manager::update_agent_env(agent_id, key, value)?;
    }
    agent_manager::update_agent_env(agent_id, "GATEWAY_ALLOW_ALL_USERS", "true")?;
    Ok(())
}

#[tauri::command]
pub fn list_channel_bots() -> Vec<ChannelBot> {
    load_channel_bots()
}

#[derive(Debug, Deserialize)]
pub struct AddChannelBotRequest {
    pub name: String,
    pub platform_id: String,
    pub config: HashMap<String, String>,
    pub agent_id: Option<String>,
}

#[tauri::command]
pub fn add_channel_bot(request: AddChannelBotRequest) -> Result<ChannelBot, String> {
    let agent_id = request.agent_id.unwrap_or_else(|| "default".to_string());

    let mut bots = load_channel_bots();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let id = format!("{}-{}", request.platform_id, now);
    let bot = ChannelBot {
        id: id.clone(),
        name: request.name,
        platform_id: request.platform_id,
        config: request.config.clone(),
        agent_id: agent_id.clone(),
        created_at: now,
    };

    sync_bot_credentials_to_profile(&agent_id, &request.config)?;

    bots.push(bot.clone());
    save_channel_bots(&bots)?;
    Ok(bot)
}

#[derive(Debug, Deserialize)]
pub struct UpdateChannelBotRequest {
    pub id: String,
    pub name: Option<String>,
    pub config: Option<HashMap<String, String>>,
    pub agent_id: Option<String>,
}

#[tauri::command]
pub fn update_channel_bot(request: UpdateChannelBotRequest) -> Result<ChannelBot, String> {
    let mut bots = load_channel_bots();
    let bot = bots
        .iter_mut()
        .find(|b| b.id == request.id)
        .ok_or_else(|| format!("Bot not found: {}", request.id))?;

    if let Some(name) = request.name {
        bot.name = name;
    }

    let old_agent_id = bot.agent_id.clone();
    if let Some(ref agent_id) = request.agent_id {
        bot.agent_id = agent_id.clone();
    }

    if let Some(config) = request.config {
        if bot.agent_id != old_agent_id {
            for key in config.keys() {
                let _ = agent_manager::remove_agent_env(&old_agent_id, key);
            }
            let _ = agent_manager::remove_agent_env(&old_agent_id, "GATEWAY_ALLOW_ALL_USERS");
            let _ = agent_manager::unconfigure_platform(&old_agent_id, &bot.platform_id);
        }
        sync_bot_credentials_to_profile(&bot.agent_id, &config)?;
        bot.config = config;
    }

    let result = bot.clone();
    save_channel_bots(&bots)?;
    Ok(result)
}

#[tauri::command]
pub fn remove_channel_bot(id: String) -> Result<(), String> {
    let mut bots = load_channel_bots();
    let len_before = bots.len();
    bots.retain(|b| b.id != id);
    if bots.len() == len_before {
        return Err(format!("Bot not found: {}", id));
    }
    save_channel_bots(&bots)
}

// ─── Gateway Management ────────────────────────────────────

#[tauri::command]
pub async fn start_agent_gateway(
    app: tauri::AppHandle,
    id: String,
    gateways: State<'_, Mutex<GatewayManagerState>>,
) -> Result<GatewayStatus, String> {
    {
        let mgr = gateways.lock().map_err(|e| e.to_string())?;
        if mgr.processes.contains_key(&id) {
            return Ok(gateway_manager::get_gateway_status(&gateways, &id));
        }
    }

    let _agent = agent_manager::get_agent(&id).ok_or("Agent not found")?;

    let hermes_bin = gateway_manager::hermes_bin_path()
        .ok_or("Hermes binary not found. Please install Hermes Agent first.")?;

    use std::process::Command;

    let mut cmd = Command::new(&hermes_bin);

    if id == "default" {
        cmd.args(["gateway", "run", "--replace"]);
    } else {
        cmd.args(["-p", &id, "gateway", "run", "--replace"]);
    }

    cmd.env("GATEWAY_ALLOW_ALL_USERS", "true")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    let child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start gateway: {}", e))?;

    let pid = child.id();

    {
        let mut mgr = gateways.lock().map_err(|e| e.to_string())?;
        mgr.processes.insert(
            id.clone(),
            GatewayProcess {
                agent_id: id.clone(),
                pid: Some(pid),
                started_at: std::time::Instant::now(),
            },
        );
    }

    let _ = app.emit("gateway-started", &id);

    Ok(gateway_manager::get_gateway_status(&gateways, &id))
}

#[tauri::command]
pub fn stop_agent_gateway(
    app: tauri::AppHandle,
    id: String,
    gateways: State<'_, Mutex<GatewayManagerState>>,
) -> Result<(), String> {
    let mut mgr = gateways.lock().map_err(|e| e.to_string())?;
    if let Some(proc) = mgr.processes.remove(&id) {
        if let Some(pid) = proc.pid {
            kill_process(pid)?;
        }
    }
    let _ = app.emit("gateway-stopped", &id);
    Ok(())
}

#[tauri::command]
pub fn get_gateway_status(
    id: String,
    gateways: State<'_, Mutex<GatewayManagerState>>,
) -> GatewayStatus {
    gateway_manager::get_gateway_status(&gateways, &id)
}

#[tauri::command]
pub fn get_all_gateway_statuses(
    gateways: State<'_, Mutex<GatewayManagerState>>,
) -> Vec<GatewayStatus> {
    gateway_manager::get_all_gateway_statuses(&gateways)
}

#[tauri::command]
pub fn get_agent_logs(id: String) -> Result<String, String> {
    agent_manager::get_agent_logs(&id, 200)
}

// ─── IM Messages (via hermes sessions) ─────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ImMessage {
    pub id: Option<u64>,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: f64,
    pub source: String,
    pub user_id: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImSession {
    pub id: String,
    pub source: String,
    pub user_id: Option<String>,
    pub model: Option<String>,
    pub started_at: f64,
    pub message_count: Option<u64>,
    pub title: Option<String>,
    pub messages: Vec<ImMessage>,
}

#[tauri::command]
pub async fn get_agent_messages(id: String, limit: Option<u32>) -> Result<Vec<ImSession>, String> {
    let agent = agent_manager::get_agent(&id).ok_or("Agent not found")?;

    if agent.platforms.is_empty() {
        return Ok(vec![]);
    }

    let hermes_bin = gateway_manager::hermes_bin_path()
        .ok_or("Hermes binary not found")?;

    let max_sessions = limit.unwrap_or(20);
    let mut all_sessions: Vec<ImSession> = Vec::new();

    for platform in &agent.platforms {
        let mut cmd = std::process::Command::new(&hermes_bin);
        if id != "default" {
            cmd.args(["-p", &id]);
        }
        cmd.args(["sessions", "export", "--source", platform, "-"]);
        let output = cmd
            .output()
            .map_err(|e| format!("Failed to run hermes sessions: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            eprintln!("hermes sessions export --source {} failed: {}", platform, stderr);
            continue;
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            match serde_json::from_str::<serde_json::Value>(line) {
                Ok(val) => {
                    let source = val["source"].as_str().unwrap_or(platform).to_string();
                    let session_id = val["id"].as_str().unwrap_or("").to_string();
                    let user_id = val["user_id"].as_str().map(|s| s.to_string());
                    let model = val["model"].as_str().map(|s| s.to_string());
                    let started_at = val["started_at"].as_f64().unwrap_or(0.0);
                    let message_count = val["message_count"].as_u64();
                    let title = val["title"].as_str().map(|s| s.to_string());

                    let messages: Vec<ImMessage> = if let Some(arr) = val["messages"].as_array() {
                        arr.iter()
                            .filter(|m| {
                                let role = m["role"].as_str().unwrap_or("");
                                role == "user" || role == "assistant"
                            })
                            .map(|m| ImMessage {
                                id: m["id"].as_u64(),
                                session_id: session_id.clone(),
                                role: m["role"].as_str().unwrap_or("").to_string(),
                                content: m["content"].as_str().unwrap_or("").to_string(),
                                timestamp: m["timestamp"].as_f64().unwrap_or(0.0),
                                source: source.clone(),
                                user_id: user_id.clone(),
                                model: model.clone(),
                            })
                            .collect()
                    } else {
                        vec![]
                    };

                    if !messages.is_empty() {
                        all_sessions.push(ImSession {
                            id: session_id,
                            source,
                            user_id,
                            model,
                            started_at,
                            message_count,
                            title,
                            messages,
                        });
                    }
                }
                Err(e) => {
                    eprintln!("Failed to parse session JSON: {}", e);
                }
            }
        }
    }

    all_sessions.sort_by(|a, b| b.started_at.partial_cmp(&a.started_at).unwrap_or(std::cmp::Ordering::Equal));
    all_sessions.truncate(max_sessions as usize);

    Ok(all_sessions)
}

// ─── Providers ─────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub env_key: String,
    pub placeholder: String,
    pub models: Vec<String>,
    pub group: String,
    pub get_key_url: String,
}

#[tauri::command]
pub fn get_providers() -> Vec<ProviderInfo> {
    vec![
        // ── 中国 Provider ──
        ProviderInfo {
            id: "zai".into(),
            name: "智谱 Z.AI (GLM)".into(),
            env_key: "GLM_API_KEY".into(),
            placeholder: "".into(),
            group: "china".into(),
            get_key_url: "https://open.bigmodel.cn/usercenter/apikeys".into(),
            models: vec![
                "glm-4.7".into(),
                "glm-4-plus".into(),
                "glm-4-flash".into(),
            ],
        },
        ProviderInfo {
            id: "deepseek".into(),
            name: "DeepSeek".into(),
            env_key: "DEEPSEEK_API_KEY".into(),
            placeholder: "sk-...".into(),
            group: "china".into(),
            get_key_url: "https://platform.deepseek.com/api_keys".into(),
            models: vec![
                "deepseek-chat".into(),
                "deepseek-reasoner".into(),
            ],
        },
        ProviderInfo {
            id: "dashscope".into(),
            name: "阿里云 Qwen (DashScope)".into(),
            env_key: "DASHSCOPE_API_KEY".into(),
            placeholder: "sk-...".into(),
            group: "china".into(),
            get_key_url: "https://dashscope.console.aliyun.com/apiKey".into(),
            models: vec![
                "qwen-max".into(),
                "qwen-plus".into(),
                "qwen-turbo".into(),
            ],
        },
        ProviderInfo {
            id: "kimi".into(),
            name: "Kimi / Moonshot".into(),
            env_key: "KIMI_API_KEY".into(),
            placeholder: "sk-...".into(),
            group: "china".into(),
            get_key_url: "https://platform.moonshot.cn/console/api-keys".into(),
            models: vec![
                "moonshot-v1-128k".into(),
                "moonshot-v1-32k".into(),
                "moonshot-v1-8k".into(),
            ],
        },
        ProviderInfo {
            id: "minimax-cn".into(),
            name: "MiniMax (中国)".into(),
            env_key: "MINIMAX_CN_API_KEY".into(),
            placeholder: "".into(),
            group: "china".into(),
            get_key_url: "https://platform.minimaxi.com/user-center/basic-information/interface-key".into(),
            models: vec![
                "abab7-chat".into(),
                "abab6.5s-chat".into(),
            ],
        },
        // ── 国际 Provider ──
        ProviderInfo {
            id: "openrouter".into(),
            name: "OpenRouter (200+ 模型)".into(),
            env_key: "OPENROUTER_API_KEY".into(),
            placeholder: "sk-or-...".into(),
            group: "international".into(),
            get_key_url: "https://openrouter.ai/keys".into(),
            models: vec![
                "anthropic/claude-sonnet-4".into(),
                "anthropic/claude-opus-4".into(),
                "openai/gpt-4.1".into(),
                "google/gemini-2.5-pro".into(),
                "meta-llama/llama-4-maverick".into(),
                "deepseek/deepseek-chat-v3-0324".into(),
            ],
        },
        ProviderInfo {
            id: "openai".into(),
            name: "OpenAI".into(),
            env_key: "OPENAI_API_KEY".into(),
            placeholder: "sk-...".into(),
            group: "international".into(),
            get_key_url: "https://platform.openai.com/api-keys".into(),
            models: vec![
                "gpt-4.1".into(),
                "gpt-4.1-mini".into(),
                "o3".into(),
                "o4-mini".into(),
            ],
        },
        ProviderInfo {
            id: "anthropic".into(),
            name: "Anthropic (Claude)".into(),
            env_key: "ANTHROPIC_API_KEY".into(),
            placeholder: "sk-ant-...".into(),
            group: "international".into(),
            get_key_url: "https://console.anthropic.com/settings/keys".into(),
            models: vec![
                "claude-sonnet-4-20250514".into(),
                "claude-opus-4-20250514".into(),
            ],
        },
        ProviderInfo {
            id: "nous".into(),
            name: "Nous Portal (免费)".into(),
            env_key: "NOUS_API_KEY".into(),
            placeholder: "".into(),
            group: "international".into(),
            get_key_url: "https://portal.nousresearch.com".into(),
            models: vec![
                "hermes-3-llama-3.1-405b".into(),
                "deephermes-3-llama-3.3-70b".into(),
            ],
        },
        // ── 自定义 ──
        ProviderInfo {
            id: "custom".into(),
            name: "自定义端点 (Ollama/vLLM/其他)".into(),
            env_key: "OPENAI_API_KEY".into(),
            placeholder: "".into(),
            group: "custom".into(),
            get_key_url: "".into(),
            models: vec![],
        },
    ]
}

// ─── Chat (via API Server) ─────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub message: String,
    #[allow(dead_code)]
    pub conversation_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallInfo {
    pub name: String,
    pub status: String,
    pub output_preview: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub content: String,
    pub tool_calls: Vec<ToolCallInfo>,
    pub conversation_id: String,
}

#[tauri::command]
pub async fn send_chat_message(
    state: State<'_, Mutex<SidecarState>>,
    request: ChatRequest,
) -> Result<ChatResponse, String> {
    let port = {
        let sidecar = state.lock().map_err(|e| e.to_string())?;
        sidecar
            .process
            .as_ref()
            .filter(|p| p.ready)
            .map(|p| p.port)
            .ok_or_else(|| "Hermes sidecar is not running".to_string())?
    };

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "hermes-agent",
        "messages": [{ "role": "user", "content": request.message }],
        "stream": false,
    });

    let resp = client
        .post(format!("http://127.0.0.1:{}/v1/chat/completions", port))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to reach Hermes API: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Hermes API returned {}: {}", status, text));
    }

    let body_text = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    let json: serde_json::Value = serde_json::from_str(&body_text)
        .map_err(|e| format!("Invalid JSON response: {} (body: {})", e, &body_text[..body_text.len().min(200)]))?;

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .or_else(|| json["choices"][0]["delta"]["content"].as_str())
        .unwrap_or("")
        .to_string();

    if content.is_empty() {
        eprintln!("[hermes-chat] Empty content from API. Response: {}", &body_text[..body_text.len().min(500)]);
    }

    let conv_id = json["id"].as_str().unwrap_or("default").to_string();

    Ok(ChatResponse {
        content,
        tool_calls: vec![],
        conversation_id: conv_id,
    })
}

// ─── Sidecar Management ────────────────────────────────────

#[tauri::command]
pub async fn start_hermes_sidecar(
    app: tauri::AppHandle,
    state: State<'_, Mutex<SidecarState>>,
) -> Result<u16, String> {
    {
        let sidecar = state.lock().map_err(|e| e.to_string())?;
        if let Some(ref p) = sidecar.process {
            if p.ready {
                return Ok(p.port);
            }
        }
    }

    let config = HermesConfig::default();
    if let Some(existing_port) = detect_running_gateway(&config) {
        let mut sidecar = state.lock().map_err(|e| e.to_string())?;
        sidecar.process = Some(HermesProcess {
            port: existing_port,
            ready: true,
            pid: None,
        });
        let _ = app.emit("hermes-ready", existing_port);
        return Ok(existing_port);
    }

    let port = crate::sidecar::find_available_port();

    let hermes_bin = gateway_manager::hermes_bin_path()
        .ok_or("Hermes binary not found. Please install Hermes Agent first.")?;

    let env_path = config.env_file_path();
    std::fs::create_dir_all(&config.hermes_home).map_err(|e| e.to_string())?;

    let mut env_content = if env_path.exists() {
        std::fs::read_to_string(&env_path).unwrap_or_default()
    } else {
        String::new()
    };

    let port_str = port.to_string();
    let api_vars = [
        ("API_SERVER_ENABLED", "true"),
        ("API_SERVER_PORT", port_str.as_str()),
        ("API_SERVER_HOST", "127.0.0.1"),
        ("API_SERVER_CORS_ORIGINS", "http://localhost:1420,http://tauri.localhost,tauri://localhost"),
        ("GATEWAY_ALLOW_ALL_USERS", "true"),
    ];
    for (key, value) in api_vars {
        let pattern = format!("{}=", key);
        let new_line = format!("{}={}", key, value);
        if env_content.contains(&pattern) {
            let lines: Vec<String> = env_content
                .lines()
                .map(|l| {
                    if l.starts_with(&pattern) && !l.starts_with('#') {
                        new_line.clone()
                    } else {
                        l.to_string()
                    }
                })
                .collect();
            env_content = lines.join("\n");
        } else {
            if !env_content.is_empty() && !env_content.ends_with('\n') {
                env_content.push('\n');
            }
            env_content.push_str(&new_line);
            env_content.push('\n');
        }
    }
    std::fs::write(&env_path, &env_content)
        .map_err(|e| format!("Failed to write .env: {}", e))?;

    let _ = std::process::Command::new(&hermes_bin)
        .args(["gateway", "stop"])
        .output();

    for _ in 0..10 {
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;
        let check = std::process::Command::new("pgrep")
            .args(["-f", "hermes.*gateway.*run"])
            .output();
        match check {
            Ok(out) if out.stdout.is_empty() => break,
            _ => continue,
        }
    }

    use std::process::Command as StdCommand;
    let child = StdCommand::new(&hermes_bin)
        .args(["gateway", "run", "--replace"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn hermes gateway: {}", e))?;

    let child_pid = child.id();

    {
        let mut sidecar = state.lock().map_err(|e| e.to_string())?;
        sidecar.process = Some(HermesProcess {
            port,
            ready: false,
            pid: Some(child_pid),
        });
    }

    let app_handle = app.clone();
    std::thread::spawn(move || {
        let _ = child.wait_with_output();
        let state_ref = app_handle.state::<Mutex<SidecarState>>();
        if let Ok(mut sidecar) = state_ref.lock() {
            if let Some(ref proc) = sidecar.process {
                if proc.pid == Some(child_pid) {
                    sidecar.process = None;
                }
            }
        }
        let _ = app_handle.emit("hermes-terminated", Option::<i32>::None);
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .unwrap();
    let health_url = format!("http://127.0.0.1:{}/v1/models", port);

    tokio::time::sleep(std::time::Duration::from_millis(2000)).await;

    for i in 0..90 {
        let delay = if i < 10 { 500 } else { 1000 };
        tokio::time::sleep(std::time::Duration::from_millis(delay)).await;

        let process_alive = {
            let sidecar = state.lock().map_err(|e| e.to_string())?;
            sidecar.process.is_some()
        };

        if !process_alive {
            if i < 5 {
                continue;
            }
            return Err("Hermes gateway exited unexpectedly. Check your API Key and model configuration.".to_string());
        }

        if let Ok(resp) = client.get(&health_url).send().await {
            if resp.status().is_success() || resp.status().as_u16() == 401 {
                let mut sidecar = state.lock().map_err(|e| e.to_string())?;
                if let Some(ref mut p) = sidecar.process {
                    p.ready = true;
                }
                let _ = app.emit("hermes-ready", port);
                return Ok(port);
            }
        }
    }

    Err("Hermes gateway started but API server did not respond within 90 seconds.".to_string())
}

#[tauri::command]
pub fn stop_hermes_sidecar(state: State<'_, Mutex<SidecarState>>) -> Result<(), String> {
    let mut sidecar = state.lock().map_err(|e| e.to_string())?;
    if let Some(ref proc) = sidecar.process {
        if let Some(pid) = proc.pid {
            let _ = kill_process(pid);
        }
    }

    if let Some(hermes_bin) = gateway_manager::hermes_bin_path() {
        let _ = std::process::Command::new(&hermes_bin)
            .args(["gateway", "stop"])
            .output();
    }

    sidecar.process = None;
    Ok(())
}

// ─── Web Server (Hermes Dashboard API) ──────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct WebServerInfo {
    pub running: bool,
    pub port: Option<u16>,
    pub token: Option<String>,
}

#[tauri::command]
pub fn get_web_server_info(
    state: State<'_, Mutex<WebServerState>>,
) -> WebServerInfo {
    let ws = state.lock().unwrap();
    match &ws.process {
        Some(p) if p.ready => WebServerInfo {
            running: true,
            port: Some(p.port),
            token: p.token.clone(),
        },
        _ => WebServerInfo {
            running: false,
            port: None,
            token: None,
        },
    }
}

#[tauri::command]
pub async fn start_web_server(
    state: State<'_, Mutex<WebServerState>>,
) -> Result<WebServerInfo, String> {
    {
        let ws = state.lock().map_err(|e| e.to_string())?;
        if let Some(ref p) = ws.process {
            if p.ready {
                return Ok(WebServerInfo {
                    running: true,
                    port: Some(p.port),
                    token: p.token.clone(),
                });
            }
        }
    }

    let port: u16 = 9119;

    // Check if web server is already running externally
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .unwrap();
    let index_url = format!("http://127.0.0.1:{}/", port);

    if let Ok(resp) = client.get(&index_url).send().await {
        if resp.status().is_success() {
            if let Ok(html) = resp.text().await {
                let token = crate::web_server::extract_token_from_html(&html);
                let mut ws = state.lock().map_err(|e| e.to_string())?;
                ws.process = Some(crate::web_server::WebServerProcess {
                    port,
                    ready: true,
                    pid: None,
                    token: token.clone(),
                });
                return Ok(WebServerInfo {
                    running: true,
                    port: Some(port),
                    token,
                });
            }
        }
    }

    let hermes_bin = gateway_manager::hermes_bin_path()
        .ok_or("Hermes binary not found")?;

    let child = std::process::Command::new(&hermes_bin)
        .args(["dashboard", "--port", &port.to_string(), "--no-open"])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn hermes dashboard: {}", e))?;

    let child_pid = child.id();
    {
        let mut ws = state.lock().map_err(|e| e.to_string())?;
        ws.process = Some(crate::web_server::WebServerProcess {
            port,
            ready: false,
            pid: Some(child_pid),
            token: None,
        });
    }

    // Wait for the web server to start, then extract the token
    tokio::time::sleep(std::time::Duration::from_millis(2000)).await;

    let mut token: Option<String> = None;
    for i in 0..30 {
        let delay = if i < 5 { 500 } else { 1000 };
        tokio::time::sleep(std::time::Duration::from_millis(delay)).await;

        if let Ok(resp) = client.get(&index_url).send().await {
            if resp.status().is_success() {
                if let Ok(html) = resp.text().await {
                    token = crate::web_server::extract_token_from_html(&html);
                    break;
                }
            }
        }
    }

    if token.is_none() {
        return Err("Web server started but token not retrievable within 30s".to_string());
    }

    {
        let mut ws = state.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut p) = ws.process {
            p.ready = true;
            p.token = token.clone();
        }
    }

    Ok(WebServerInfo {
        running: true,
        port: Some(port),
        token,
    })
}

#[tauri::command]
pub fn stop_web_server(state: State<'_, Mutex<WebServerState>>) -> Result<(), String> {
    let mut ws = state.lock().map_err(|e| e.to_string())?;
    if let Some(ref proc) = ws.process {
        if let Some(pid) = proc.pid {
            let _ = kill_process(pid);
        }
    }
    ws.process = None;
    Ok(())
}

#[tauri::command]
pub fn save_api_config(
    provider: String,
    api_key: String,
    model: String,
) -> Result<(), String> {
    let config = HermesConfig::default();
    let env_path = config.env_file_path();

    std::fs::create_dir_all(&config.hermes_home).map_err(|e| e.to_string())?;

    let providers = get_providers();
    let provider_info = providers
        .iter()
        .find(|p| p.id == provider)
        .ok_or_else(|| format!("Unknown provider: {}", provider))?;

    let mut env_content = if env_path.exists() {
        std::fs::read_to_string(&env_path).unwrap_or_default()
    } else {
        String::new()
    };

    let key_line = format!("{}={}", provider_info.env_key, api_key);
    let model_line = format!("HERMES_MODEL={}", model);

    for line_to_set in [&key_line, &model_line] {
        let key = line_to_set.split('=').next().unwrap();
        let pattern = format!("{}=", key);
        if env_content.contains(&pattern) {
            let lines: Vec<&str> = env_content.lines().collect();
            let new_lines: Vec<String> = lines
                .iter()
                .map(|l| {
                    if l.starts_with(&pattern) {
                        line_to_set.to_string()
                    } else {
                        l.to_string()
                    }
                })
                .collect();
            env_content = new_lines.join("\n");
        } else {
            if !env_content.is_empty() && !env_content.ends_with('\n') {
                env_content.push('\n');
            }
            env_content.push_str(line_to_set);
            env_content.push('\n');
        }
    }

    std::fs::write(&env_path, env_content)
        .map_err(|e| format!("Failed to write .env: {}", e))?;

    let (hermes_provider, base_url) = match provider.as_str() {
        "zai" => ("zai", "https://open.bigmodel.cn/api/paas/v4"),
        "deepseek" => ("deepseek", "https://api.deepseek.com/v1"),
        "dashscope" => ("alibaba", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
        "kimi" => ("kimi", "https://api.moonshot.cn/v1"),
        "minimax-cn" => ("minimax", "https://api.minimax.chat/v1"),
        "openrouter" => ("openrouter", "https://openrouter.ai/api/v1"),
        "openai" => ("openai", "https://api.openai.com/v1"),
        "anthropic" => ("anthropic", "https://api.anthropic.com/v1"),
        "nous" => ("nous", "https://inference-api.nousresearch.com/v1"),
        _ => ("custom", ""),
    };

    let config_path = config.config_yaml_path();
    if config_path.exists() {
        if let Ok(yaml_content) = std::fs::read_to_string(&config_path) {
            let mut lines: Vec<String> = yaml_content.lines().map(|l| l.to_string()).collect();
            let mut in_model_block = false;
            for line in lines.iter_mut() {
                let trimmed = line.trim();
                if trimmed == "model:" {
                    in_model_block = true;
                    continue;
                }
                if in_model_block {
                    if !trimmed.is_empty() && !trimmed.starts_with('#') && !trimmed.starts_with(' ') && !trimmed.starts_with('\t') {
                        in_model_block = false;
                        continue;
                    }
                    if trimmed.starts_with("default:") {
                        *line = format!("  default: {}", model);
                    } else if trimmed.starts_with("provider:") {
                        *line = format!("  provider: {}", hermes_provider);
                    } else if trimmed.starts_with("base_url:") {
                        if !base_url.is_empty() {
                            *line = format!("  base_url: {}", base_url);
                        }
                    }
                }
            }
            let _ = std::fs::write(&config_path, lines.join("\n") + "\n");
        }
    }

    Ok(())
}

// ─── Connectivity Test ─────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectivityResult {
    pub success: bool,
    pub message: String,
    pub latency_ms: Option<u64>,
}

#[tauri::command]
pub async fn test_provider_connectivity(
    provider_id: String,
    api_key: String,
    _model: String,
) -> ConnectivityResult {
    let providers = get_providers();
    let _provider = match providers.iter().find(|p| p.id == provider_id) {
        Some(p) => p,
        None => return ConnectivityResult {
            success: false,
            message: format!("未知的 Provider: {}", provider_id),
            latency_ms: None,
        },
    };

    let base_url = match provider_id.as_str() {
        "zai" => "https://open.bigmodel.cn/api/paas/v4",
        "deepseek" => "https://api.deepseek.com/v1",
        "dashscope" => "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "kimi" => "https://api.moonshot.cn/v1",
        "minimax-cn" => "https://api.minimax.chat/v1",
        "openrouter" => "https://openrouter.ai/api/v1",
        "openai" => "https://api.openai.com/v1",
        "anthropic" => "https://api.anthropic.com/v1",
        "nous" => "https://inference-api.nousresearch.com/v1",
        _ => return ConnectivityResult {
            success: false,
            message: "自定义端点需要手动测试".to_string(),
            latency_ms: None,
        },
    };

    let url = format!("{}/models", base_url);
    let start = std::time::Instant::now();

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap();

    let mut req = client.get(&url);
    if provider_id == "anthropic" {
        req = req.header("x-api-key", &api_key).header("anthropic-version", "2023-06-01");
    } else {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    match req.send().await {
        Ok(resp) => {
            let latency = start.elapsed().as_millis() as u64;
            let status = resp.status();
            if status.is_success() {
                ConnectivityResult {
                    success: true,
                    message: format!("连接成功 ({}ms)", latency),
                    latency_ms: Some(latency),
                }
            } else if status.as_u16() == 401 || status.as_u16() == 403 {
                ConnectivityResult {
                    success: false,
                    message: "API Key 无效或权限不足".to_string(),
                    latency_ms: Some(latency),
                }
            } else {
                ConnectivityResult {
                    success: false,
                    message: format!("服务器返回 {} ({}ms)", status, latency),
                    latency_ms: Some(latency),
                }
            }
        }
        Err(e) => {
            if e.is_timeout() {
                ConnectivityResult {
                    success: false,
                    message: "连接超时 (10s)".to_string(),
                    latency_ms: None,
                }
            } else {
                ConnectivityResult {
                    success: false,
                    message: format!("连接失败: {}", e),
                    latency_ms: None,
                }
            }
        }
    }
}

// ─── Saved Config Connectivity Test ─────────────────────────

#[tauri::command]
pub async fn test_saved_connectivity() -> ConnectivityResult {
    let config = HermesConfig::default();
    let env_path = config.env_file_path();

    if !env_path.exists() {
        return ConnectivityResult {
            success: false,
            message: "未找到配置文件".to_string(),
            latency_ms: None,
        };
    }

    let content = match std::fs::read_to_string(&env_path) {
        Ok(c) => c,
        Err(e) => return ConnectivityResult {
            success: false,
            message: format!("无法读取配置: {}", e),
            latency_ms: None,
        },
    };

    let get_env = |key: &str| -> Option<String> {
        content.lines()
            .find(|l| l.starts_with(&format!("{}=", key)))
            .map(|l| l.splitn(2, '=').nth(1).unwrap_or("").to_string())
            .filter(|v| !v.is_empty())
    };

    let model = get_env("HERMES_MODEL").unwrap_or_default();
    let providers = get_providers();

    let (provider_id, api_key) = match providers.iter().find_map(|p| {
        get_env(&p.env_key).map(|key| (p.id.clone(), key))
    }) {
        Some(pair) => pair,
        None => return ConnectivityResult {
            success: false,
            message: "未配置 API Key".to_string(),
            latency_ms: None,
        },
    };

    test_provider_connectivity(provider_id, api_key, model).await
}

// ─── Read Current Config ───────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CurrentConfig {
    pub model: Option<String>,
    pub provider: Option<String>,
    pub has_api_key: bool,
    pub api_server_enabled: bool,
    pub api_server_port: Option<String>,
}

#[tauri::command]
pub fn get_current_config() -> CurrentConfig {
    let config = HermesConfig::default();
    let env_path = config.env_file_path();

    if !env_path.exists() {
        return CurrentConfig {
            model: None,
            provider: None,
            has_api_key: false,
            api_server_enabled: false,
            api_server_port: None,
        };
    }

    let content = std::fs::read_to_string(&env_path).unwrap_or_default();

    let get_env = |key: &str| -> Option<String> {
        content.lines()
            .find(|l| l.starts_with(&format!("{}=", key)))
            .map(|l| l.splitn(2, '=').nth(1).unwrap_or("").to_string())
            .filter(|v| !v.is_empty())
    };

    let model = get_env("HERMES_MODEL");
    let api_server_enabled = get_env("API_SERVER_ENABLED")
        .map(|v| v.to_lowercase() == "true" || v == "1")
        .unwrap_or(false);
    let api_server_port = get_env("API_SERVER_PORT");

    let providers = get_providers();
    let provider = providers.iter().find(|p| get_env(&p.env_key).is_some()).map(|p| p.id.clone());
    let has_api_key = provider.is_some();

    CurrentConfig {
        model,
        provider,
        has_api_key,
        api_server_enabled,
        api_server_port,
    }
}

// ─── Skills Management ─────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillInfo {
    pub name: String,
    pub category: String,
    pub source: String,
    pub path: Option<String>,
}

#[tauri::command]
pub fn list_skills() -> Vec<SkillInfo> {
    let hermes_bin = match gateway_manager::hermes_bin_path() {
        Some(p) => p,
        None => return vec![],
    };

    let output = std::process::Command::new(&hermes_bin)
        .args(["skills", "list", "--source", "all"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut skills = Vec::new();
            for line in stdout.lines() {
                let trimmed = line.trim().trim_start_matches('│').trim();
                if trimmed.is_empty()
                    || trimmed.starts_with("Name")
                    || trimmed.starts_with('┃')
                    || trimmed.starts_with('┏')
                    || trimmed.starts_with('┡')
                    || trimmed.starts_with('└')
                    || trimmed.starts_with('─')
                    || trimmed.contains("Installed Skills")
                    || trimmed.contains("hub-installed")
                {
                    continue;
                }
                let parts: Vec<&str> = trimmed.split('│').map(|s| s.trim()).collect();
                if parts.len() >= 3 {
                    skills.push(SkillInfo {
                        name: parts[0].to_string(),
                        category: parts[1].to_string(),
                        source: parts[2].to_string(),
                        path: None,
                    });
                }
            }
            skills
        }
        Err(_) => vec![],
    }
}

#[tauri::command]
pub fn get_skill_content(name: String) -> Result<String, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    let skills_dir = std::path::PathBuf::from(&home).join(".hermes").join("skills");

    fn find_skill_md(dir: &std::path::Path, name: &str) -> Option<std::path::PathBuf> {
        if !dir.exists() {
            return None;
        }
        for entry in std::fs::read_dir(dir).ok()? {
            let entry = entry.ok()?;
            let path = entry.path();
            if path.is_dir() {
                let slug = path.file_name()?.to_str()?;
                if slug == name {
                    let skill_md = path.join("SKILL.md");
                    if skill_md.exists() {
                        return Some(skill_md);
                    }
                    let readme = path.join("README.md");
                    if readme.exists() {
                        return Some(readme);
                    }
                }
                if let Some(found) = find_skill_md(&path, name) {
                    return Some(found);
                }
            }
        }
        None
    }

    find_skill_md(&skills_dir, &name)
        .and_then(|p| std::fs::read_to_string(&p).ok())
        .ok_or_else(|| format!("Skill '{}' not found", name))
}

// ─── Skill Installation ──────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillValidation {
    pub valid: bool,
    pub name: String,
    pub description: String,
    pub has_skill_md: bool,
    pub has_frontmatter: bool,
    pub path: String,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub already_installed: bool,
}

fn parse_skill_frontmatter(content: &str) -> (String, String, bool) {
    let trimmed = content.trim();
    if !trimmed.starts_with("---") {
        return (String::new(), String::new(), false);
    }
    let after_first = &trimmed[3..];
    if let Some(end_idx) = after_first.find("---") {
        let yaml_block = &after_first[..end_idx];
        let mut name = String::new();
        let mut description = String::new();
        for line in yaml_block.lines() {
            let line = line.trim();
            if let Some(val) = line.strip_prefix("name:") {
                name = val.trim().trim_matches('"').trim_matches('\'').to_string();
            } else if let Some(val) = line.strip_prefix("description:") {
                description = val.trim().trim_matches('"').trim_matches('\'').to_string();
            }
        }
        (name, description, true)
    } else {
        (String::new(), String::new(), false)
    }
}

fn skills_install_dir() -> std::path::PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(home).join(".hermes").join("skills")
}

#[tauri::command]
pub fn validate_local_skill(path: String) -> SkillValidation {
    let skill_path = std::path::PathBuf::from(&path);
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let mut name = String::new();
    let mut description = String::new();
    let mut has_skill_md = false;
    let mut has_frontmatter = false;

    if !skill_path.exists() {
        errors.push("路径不存在".to_string());
        return SkillValidation {
            valid: false, name, description, has_skill_md, has_frontmatter,
            path: path.clone(), errors, warnings, already_installed: false,
        };
    }

    let (check_dir, md_path) = if skill_path.is_file() {
        let fname = skill_path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if fname == "SKILL.md" || fname == "README.md" {
            (skill_path.parent().map(|p| p.to_path_buf()), Some(skill_path.clone()))
        } else {
            errors.push("文件不是 SKILL.md 或 README.md".to_string());
            return SkillValidation {
                valid: false, name, description, has_skill_md, has_frontmatter,
                path: path.clone(), errors, warnings, already_installed: false,
            };
        }
    } else {
        let skill_md = skill_path.join("SKILL.md");
        let readme_md = skill_path.join("README.md");
        let found = if skill_md.exists() {
            Some(skill_md)
        } else if readme_md.exists() {
            Some(readme_md)
        } else {
            None
        };
        (Some(skill_path.clone()), found)
    };

    let install_dir = check_dir.unwrap_or_else(|| skill_path.clone());

    if let Some(ref md) = md_path {
        has_skill_md = true;
        match std::fs::read_to_string(md) {
            Ok(content) => {
                let (parsed_name, parsed_desc, has_fm) = parse_skill_frontmatter(&content);
                has_frontmatter = has_fm;
                if has_fm {
                    name = parsed_name;
                    description = parsed_desc;
                }

                if name.is_empty() {
                    name = install_dir
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("unknown")
                        .to_string();
                    if has_fm {
                        warnings.push("YAML frontmatter 中缺少 name 字段，将使用目录名".to_string());
                    }
                }
                if description.is_empty() {
                    warnings.push("缺少 description 字段".to_string());
                }
                if !has_fm {
                    warnings.push("缺少 YAML frontmatter（--- 分隔块）".to_string());
                }
                if content.trim().len() < 10 {
                    errors.push("SKILL.md 内容过短".to_string());
                }
            }
            Err(e) => {
                errors.push(format!("无法读取文件: {}", e));
            }
        }
    } else {
        errors.push("目录中未找到 SKILL.md 或 README.md".to_string());
    }

    if name.is_empty() {
        name = install_dir
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
    }

    let target = skills_install_dir().join(&name);
    let already_installed = target.exists();
    if already_installed {
        warnings.push(format!("技能 '{}' 已存在，安装将覆盖", name));
    }

    SkillValidation {
        valid: errors.is_empty() && has_skill_md,
        name,
        description,
        has_skill_md,
        has_frontmatter,
        path: install_dir.to_string_lossy().to_string(),
        errors,
        warnings,
        already_installed,
    }
}

#[tauri::command]
pub fn install_local_skill(path: String) -> Result<String, String> {
    let validation = validate_local_skill(path.clone());
    if !validation.valid {
        return Err(format!("技能验证失败: {}", validation.errors.join("; ")));
    }

    let source = std::path::PathBuf::from(&validation.path);
    let dest = skills_install_dir().join(&validation.name);

    std::fs::create_dir_all(skills_install_dir())
        .map_err(|e| format!("无法创建技能目录: {}", e))?;

    if dest.exists() {
        std::fs::remove_dir_all(&dest)
            .map_err(|e| format!("无法移除已有技能: {}", e))?;
    }

    fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> Result<(), String> {
        std::fs::create_dir_all(dst).map_err(|e| format!("创建目录失败: {}", e))?;
        for entry in std::fs::read_dir(src).map_err(|e| format!("读取目录失败: {}", e))? {
            let entry = entry.map_err(|e| format!("读取条目失败: {}", e))?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());
            if src_path.is_dir() {
                copy_dir_recursive(&src_path, &dst_path)?;
            } else {
                std::fs::copy(&src_path, &dst_path)
                    .map_err(|e| format!("复制文件失败: {}", e))?;
            }
        }
        Ok(())
    }

    if source.is_dir() {
        copy_dir_recursive(&source, &dest)?;
    } else {
        std::fs::create_dir_all(&dest)
            .map_err(|e| format!("创建目录失败: {}", e))?;
        let fname = source.file_name().ok_or("无法获取文件名")?;
        std::fs::copy(&source, dest.join(fname))
            .map_err(|e| format!("复制文件失败: {}", e))?;
    }

    Ok(validation.name)
}

// ─── Agent Evolution ─────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct EvolutionEvent {
    pub timestamp: i64,
    pub event_type: String,
    pub title: String,
    pub detail: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SkillTimeline {
    pub name: String,
    pub installed_at: i64,
    pub modified_at: i64,
    pub size_bytes: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryFileInfo {
    pub name: String,
    pub modified_at: i64,
    pub size_bytes: u64,
    pub preview: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentEvolution {
    pub agent_id: String,
    pub agent_name: String,
    pub created_at: u64,
    pub total_sessions: u64,
    pub total_messages: u64,
    pub total_skills: u64,
    pub total_memories: u64,
    pub level: u32,
    pub xp: u64,
    pub xp_next: u64,
    pub level_title: String,
    pub skills_timeline: Vec<SkillTimeline>,
    pub memory_files: Vec<MemoryFileInfo>,
    pub events: Vec<EvolutionEvent>,
    pub daily_messages: Vec<(String, u64)>,
}

fn compute_level(xp: u64) -> (u32, u64, &'static str) {
    let thresholds: Vec<(u32, u64, &str)> = vec![
        (1, 0, "初生"),
        (2, 50, "新芽"),
        (3, 150, "学徒"),
        (4, 400, "探索者"),
        (5, 800, "助手"),
        (6, 1500, "专家"),
        (7, 3000, "大师"),
        (8, 5000, "贤者"),
        (9, 8000, "先知"),
        (10, 12000, "超越者"),
    ];
    let mut current = (1u32, 50u64, "初生");
    for (level, threshold, title) in &thresholds {
        if xp >= *threshold {
            let next = thresholds
                .iter()
                .find(|(l, _, _)| l > level)
                .map(|(_, t, _)| *t)
                .unwrap_or(*threshold + 5000);
            current = (*level, next, title);
        }
    }
    current
}

fn epoch_secs(meta: &std::fs::Metadata, use_modified: bool) -> i64 {
    let time = if use_modified {
        meta.modified().ok()
    } else {
        meta.created().ok().or_else(|| meta.modified().ok())
    };
    time.and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn get_agent_evolution(id: String) -> Result<AgentEvolution, String> {
    let agent = agent_manager::get_agent(&id).ok_or("Agent not found")?;
    let agent_home = agent_manager::agent_home(&id);

    let mut total_sessions: u64 = 0;
    let mut total_messages: u64 = 0;
    let mut daily_messages: Vec<(String, u64)> = vec![];

    let sessions_dir = agent_home.join("sessions");
    if sessions_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&sessions_dir) {
            let mut daily_map: std::collections::HashMap<String, u64> = std::collections::HashMap::new();
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                total_sessions += 1;
                if let Ok(content) = std::fs::read_to_string(&path) {
                    let msg_count = content.matches("\"role\"").count() as u64;
                    total_messages += msg_count;
                }
                if let Ok(meta) = std::fs::metadata(&path) {
                    let ts = epoch_secs(&meta, false);
                    if ts > 0 {
                        let day = chrono::DateTime::from_timestamp(ts, 0)
                            .map(|dt| dt.format("%Y-%m-%d").to_string())
                            .unwrap_or_default();
                        if !day.is_empty() {
                            *daily_map.entry(day).or_insert(0) += 1;
                        }
                    }
                }
            }
            let mut sorted: Vec<(String, u64)> = daily_map.into_iter().collect();
            sorted.sort_by(|a, b| a.0.cmp(&b.0));
            if sorted.len() > 90 {
                sorted = sorted.split_off(sorted.len() - 90);
            }
            daily_messages = sorted;
        }
    }

    let skills_dir = agent_home.join("skills");

    let mut skills_timeline = Vec::new();
    if skills_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&skills_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    if name.is_empty() || name.starts_with('.') {
                        continue;
                    }
                    let meta = std::fs::metadata(&path).ok();
                    let dir_size: u64 = std::fs::read_dir(&path)
                        .map(|entries| {
                            entries
                                .flatten()
                                .filter_map(|e| e.metadata().ok())
                                .map(|m| m.len())
                                .sum()
                        })
                        .unwrap_or(0);

                    skills_timeline.push(SkillTimeline {
                        name,
                        installed_at: meta.as_ref().map(|m| epoch_secs(m, false)).unwrap_or(0),
                        modified_at: meta.as_ref().map(|m| epoch_secs(m, true)).unwrap_or(0),
                        size_bytes: dir_size,
                    });
                }
            }
        }
    }
    skills_timeline.sort_by(|a, b| b.installed_at.cmp(&a.installed_at));

    let memories_dir = agent_home.join("memories");
    let mut memory_files = Vec::new();
    if memories_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&memories_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let name = path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();
                    let meta = std::fs::metadata(&path).ok();
                    let preview = std::fs::read_to_string(&path)
                        .ok()
                        .map(|c| {
                            let trimmed = c.trim();
                            if trimmed.len() > 200 {
                                format!("{}...", &trimmed[..200])
                            } else {
                                trimmed.to_string()
                            }
                        })
                        .unwrap_or_default();

                    memory_files.push(MemoryFileInfo {
                        name,
                        modified_at: meta.as_ref().map(|m| epoch_secs(m, true)).unwrap_or(0),
                        size_bytes: meta.map(|m| m.len()).unwrap_or(0),
                        preview,
                    });
                }
            }
        }
    }
    memory_files.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));

    let xp = total_messages * 2 + total_sessions * 10 + (skills_timeline.len() as u64) * 50 + (memory_files.len() as u64) * 30;
    let (level, xp_next, level_title) = compute_level(xp);

    let mut events: Vec<EvolutionEvent> = Vec::new();

    events.push(EvolutionEvent {
        timestamp: agent.created_at as i64,
        event_type: "birth".to_string(),
        title: format!("🎉 {} 诞生", agent.name),
        detail: format!("Agent 被创建，使用模型 {}", agent.model),
    });

    for skill in &skills_timeline {
        events.push(EvolutionEvent {
            timestamp: skill.installed_at,
            event_type: "skill".to_string(),
            title: format!("⚡ 习得技能: {}", skill.name),
            detail: format!("安装了新技能，大小 {:.1}KB", skill.size_bytes as f64 / 1024.0),
        });
    }

    for mem in &memory_files {
        events.push(EvolutionEvent {
            timestamp: mem.modified_at,
            event_type: "memory".to_string(),
            title: format!("🧠 记忆更新: {}", mem.name),
            detail: if mem.preview.len() > 80 {
                format!("{}...", &mem.preview[..80])
            } else {
                mem.preview.clone()
            },
        });
    }

    let milestones = [
        (10, "💬 完成第 10 次对话"),
        (50, "💬 完成第 50 次对话"),
        (100, "🏆 完成第 100 次对话"),
        (500, "🌟 完成第 500 次对话"),
        (1000, "👑 完成第 1000 次对话"),
    ];
    for (threshold, label) in milestones {
        if total_sessions >= threshold {
            events.push(EvolutionEvent {
                timestamp: 0,
                event_type: "milestone".to_string(),
                title: label.to_string(),
                detail: format!("累计完成 {} 次对话", total_sessions),
            });
        }
    }

    events.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));

    Ok(AgentEvolution {
        agent_id: id,
        agent_name: agent.name,
        created_at: agent.created_at,
        total_sessions,
        total_messages,
        total_skills: skills_timeline.len() as u64,
        total_memories: memory_files.len() as u64,
        level,
        xp,
        xp_next,
        level_title: level_title.to_string(),
        skills_timeline,
        memory_files,
        events,
        daily_messages,
    })
}

#[tauri::command]
pub fn get_evolution_log(limit: Option<u32>) -> Vec<crate::evolution_watcher::EvolutionLogEntry> {
    crate::evolution_watcher::get_evolution_log(limit.unwrap_or(50))
}

// ─── Memory / Sessions ────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionStats {
    pub total_sessions: u64,
    pub total_messages: u64,
    pub db_size_mb: f64,
    pub platforms: Vec<PlatformSessionInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformSessionInfo {
    pub name: String,
    pub sessions: u64,
}

#[tauri::command]
pub fn get_session_stats() -> SessionStats {
    let hermes_bin = match gateway_manager::hermes_bin_path() {
        Some(p) => p,
        None => return SessionStats { total_sessions: 0, total_messages: 0, db_size_mb: 0.0, platforms: vec![] },
    };

    let output = std::process::Command::new(&hermes_bin)
        .args(["sessions", "stats"])
        .output();

    let mut stats = SessionStats {
        total_sessions: 0,
        total_messages: 0,
        db_size_mb: 0.0,
        platforms: vec![],
    };

    if let Ok(out) = output {
        let stdout = String::from_utf8_lossy(&out.stdout);
        for line in stdout.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("Total sessions:") {
                stats.total_sessions = trimmed
                    .split(':')
                    .nth(1)
                    .and_then(|s| s.trim().parse().ok())
                    .unwrap_or(0);
            } else if trimmed.starts_with("Total messages:") {
                stats.total_messages = trimmed
                    .split(':')
                    .nth(1)
                    .and_then(|s| s.trim().parse().ok())
                    .unwrap_or(0);
            } else if trimmed.starts_with("Database size:") {
                stats.db_size_mb = trimmed
                    .split(':')
                    .nth(1)
                    .and_then(|s| {
                        let s = s.trim().replace("MB", "").trim().to_string();
                        s.parse().ok()
                    })
                    .unwrap_or(0.0);
            } else if trimmed.contains(": ") && trimmed.contains("sessions") {
                let parts: Vec<&str> = trimmed.split(':').collect();
                if parts.len() == 2 {
                    let name = parts[0].trim().to_string();
                    let count: u64 = parts[1]
                        .trim()
                        .split_whitespace()
                        .next()
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0);
                    if !name.is_empty() && count > 0 {
                        stats.platforms.push(PlatformSessionInfo { name, sessions: count });
                    }
                }
            }
        }
    }

    stats
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionListItem {
    pub id: String,
    pub preview: String,
    pub source: String,
    pub last_active: String,
}

#[tauri::command]
pub fn list_recent_sessions(source: Option<String>, limit: Option<u32>) -> Vec<SessionListItem> {
    let hermes_bin = match gateway_manager::hermes_bin_path() {
        Some(p) => p,
        None => return vec![],
    };

    let mut args = vec!["sessions".to_string(), "list".to_string()];
    if let Some(src) = source {
        args.push("--source".to_string());
        args.push(src);
    }
    args.push("--limit".to_string());
    args.push(limit.unwrap_or(30).to_string());

    let output = std::process::Command::new(&hermes_bin)
        .args(&args)
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut sessions = Vec::new();
            for line in stdout.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty()
                    || trimmed.starts_with("Preview")
                    || trimmed.starts_with("─")
                {
                    continue;
                }
                let parts: Vec<&str> = trimmed.splitn(4, char::is_whitespace).collect();
                if parts.len() >= 3 {
                    sessions.push(SessionListItem {
                        id: parts.last().unwrap_or(&"").to_string(),
                        preview: parts[0].to_string(),
                        source: if parts.len() >= 3 { parts[parts.len()-2].to_string() } else { String::new() },
                        last_active: if parts.len() >= 2 { parts[1].to_string() } else { String::new() },
                    });
                }
            }
            sessions
        }
        Err(_) => vec![],
    }
}

// ─── Cron Tasks ────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct CronJobInfo {
    pub id: String,
    pub name: String,
    pub schedule: String,
    pub prompt: String,
    pub status: String,
    pub next_run: String,
    pub last_run: String,
}

#[tauri::command]
pub fn list_cron_jobs() -> Vec<CronJobInfo> {
    let hermes_bin = match gateway_manager::hermes_bin_path() {
        Some(p) => p,
        None => return vec![],
    };

    let output = std::process::Command::new(&hermes_bin)
        .args(["cron", "list"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if stdout.contains("No scheduled jobs") {
                return vec![];
            }
            vec![]
        }
        Err(_) => vec![],
    }
}

#[tauri::command]
pub fn create_cron_job(schedule: String, prompt: String, name: Option<String>) -> Result<String, String> {
    let hermes_bin = gateway_manager::hermes_bin_path()
        .ok_or("Hermes binary not found")?;

    let mut args = vec!["cron".to_string(), "create".to_string()];
    if let Some(n) = name {
        args.push("--name".to_string());
        args.push(n);
    }
    args.push(schedule);
    args.push(prompt);

    let output = std::process::Command::new(&hermes_bin)
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to run cron create: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if output.status.success() {
        Ok(stdout)
    } else {
        Err(format!("Cron create failed: {}{}", stdout, stderr))
    }
}

#[tauri::command]
pub fn delete_cron_job(id: String) -> Result<(), String> {
    let hermes_bin = gateway_manager::hermes_bin_path()
        .ok_or("Hermes binary not found")?;

    let output = std::process::Command::new(&hermes_bin)
        .args(["cron", "remove", &id])
        .output()
        .map_err(|e| format!("Failed to remove cron: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Cron remove failed: {}", stderr))
    }
}

// ─── MCP Servers ───────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct McpServerInfo {
    pub name: String,
    pub transport: String,
    pub tools_count: u32,
    pub status: String,
}

#[tauri::command]
pub fn list_mcp_servers() -> Vec<McpServerInfo> {
    let hermes_bin = match gateway_manager::hermes_bin_path() {
        Some(p) => p,
        None => return vec![],
    };

    let output = std::process::Command::new(&hermes_bin)
        .args(["mcp", "list"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            if stdout.contains("No MCP servers configured") {
                return vec![];
            }
            vec![]
        }
        Err(_) => vec![],
    }
}

// ─── Insights ──────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct HermesInsights {
    pub sessions: u64,
    pub messages: u64,
    pub tool_calls: u64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub total_tokens: u64,
    pub estimated_cost: String,
    pub models: Vec<ModelUsage>,
    pub platforms: Vec<PlatformUsage>,
    pub top_tools: Vec<ToolUsage>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ModelUsage {
    pub model: String,
    pub sessions: u64,
    pub tokens: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlatformUsage {
    pub platform: String,
    pub sessions: u64,
    pub messages: u64,
    pub tokens: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolUsage {
    pub tool: String,
    pub calls: u64,
    pub percentage: f64,
}

#[tauri::command]
pub fn get_hermes_insights(days: Option<u32>) -> HermesInsights {
    let hermes_bin = match gateway_manager::hermes_bin_path() {
        Some(p) => p,
        None => return empty_insights(),
    };

    let days_str = days.unwrap_or(30).to_string();
    let bin = hermes_bin.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let result = std::process::Command::new(&bin)
            .args(["insights", "--days", &days_str])
            .output();
        let _ = tx.send(result);
    });

    match rx.recv_timeout(std::time::Duration::from_secs(5)) {
        Ok(Ok(out)) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            parse_insights(&stdout)
        }
        _ => empty_insights(),
    }
}

fn empty_insights() -> HermesInsights {
    HermesInsights {
        sessions: 0, messages: 0, tool_calls: 0,
        input_tokens: 0, output_tokens: 0, total_tokens: 0,
        estimated_cost: "$0.00".to_string(),
        models: vec![], platforms: vec![], top_tools: vec![],
    }
}

fn parse_insights(raw: &str) -> HermesInsights {
    let mut insights = empty_insights();

    let extract_num = |line: &str, key: &str| -> u64 {
        if line.contains(key) {
            let after = line.split(key).nth(1).unwrap_or("");
            let num_str: String = after.trim().chars()
                .take_while(|c| c.is_ascii_digit() || *c == ',')
                .collect();
            num_str.replace(',', "").parse().unwrap_or(0)
        } else {
            0
        }
    };

    let mut section = "";
    for line in raw.lines() {
        let t = line.trim();
        if t.contains("📋 Overview") { section = "overview"; continue; }
        if t.contains("🤖 Models Used") { section = "models"; continue; }
        if t.contains("📱 Platforms") { section = "platforms"; continue; }
        if t.contains("🔧 Top Tools") { section = "tools"; continue; }

        match section {
            "overview" => {
                if t.starts_with("Sessions:") {
                    insights.sessions = extract_num(t, "Sessions:");
                    if t.contains("Messages:") {
                        insights.messages = extract_num(t, "Messages:");
                    }
                }
                if t.starts_with("Tool calls:") {
                    insights.tool_calls = extract_num(t, "Tool calls:");
                }
                if t.starts_with("Input tokens:") {
                    insights.input_tokens = extract_num(t, "Input tokens:");
                    if t.contains("Output tokens:") {
                        insights.output_tokens = extract_num(t, "Output tokens:");
                    }
                }
                if t.starts_with("Total tokens:") {
                    insights.total_tokens = extract_num(t, "Total tokens:");
                    if let Some(cost_part) = t.split("Est. cost:").nth(1) {
                        insights.estimated_cost = cost_part.trim().split_whitespace().next()
                            .unwrap_or("$0.00").to_string();
                    }
                }
            }
            "models" => {
                let parts: Vec<&str> = t.split_whitespace().collect();
                if parts.len() >= 3 && !t.starts_with("Model") && !t.starts_with("─") && !t.starts_with("*") {
                    let model_name = parts[0].to_string();
                    let sessions: u64 = parts.get(1).and_then(|s| s.replace(',', "").parse().ok()).unwrap_or(0);
                    let tokens: u64 = parts.get(2).and_then(|s| s.replace(',', "").parse().ok()).unwrap_or(0);
                    if !model_name.is_empty() {
                        insights.models.push(ModelUsage { model: model_name, sessions, tokens });
                    }
                }
            }
            "platforms" => {
                let parts: Vec<&str> = t.split_whitespace().collect();
                if parts.len() >= 4 && !t.starts_with("Platform") && !t.starts_with("─") {
                    insights.platforms.push(PlatformUsage {
                        platform: parts[0].to_string(),
                        sessions: parts.get(1).and_then(|s| s.replace(',', "").parse().ok()).unwrap_or(0),
                        messages: parts.get(2).and_then(|s| s.replace(',', "").parse().ok()).unwrap_or(0),
                        tokens: parts.get(3).and_then(|s| s.replace(',', "").parse().ok()).unwrap_or(0),
                    });
                }
            }
            "tools" => {
                let parts: Vec<&str> = t.split_whitespace().collect();
                if parts.len() >= 3 && !t.starts_with("Tool") && !t.starts_with("─") {
                    let calls: u64 = parts.get(1).and_then(|s| s.replace(',', "").parse().ok()).unwrap_or(0);
                    let pct: f64 = parts.get(2).and_then(|s| s.replace('%', "").parse().ok()).unwrap_or(0.0);
                    insights.top_tools.push(ToolUsage {
                        tool: parts[0].to_string(),
                        calls,
                        percentage: pct,
                    });
                }
            }
            _ => {}
        }
    }

    insights
}

// ─── Toolset Management ────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct ToolsetInfo {
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub icon: String,
}

#[tauri::command]
pub fn list_toolsets() -> Vec<ToolsetInfo> {
    let hermes_bin = match gateway_manager::hermes_bin_path() {
        Some(p) => p,
        None => return vec![],
    };

    let output = std::process::Command::new(&hermes_bin)
        .args(["tools", "list"])
        .output();

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let mut toolsets = Vec::new();
            for line in stdout.lines() {
                let t = line.trim();
                if !t.starts_with('✓') && !t.starts_with('✗') {
                    continue;
                }
                let enabled = t.starts_with('✓');
                let rest = t.trim_start_matches('✓').trim_start_matches('✗').trim();
                let rest = rest.trim_start_matches("enabled").trim_start_matches("disabled").trim();
                let parts: Vec<&str> = rest.splitn(2, "  ").collect();
                let name = parts[0].trim().to_string();
                let desc_part = if parts.len() > 1 { parts[1].trim() } else { "" };
                let icon_end = desc_part.find(' ').unwrap_or(desc_part.len());
                let icon = desc_part[..icon_end].to_string();
                let description = desc_part[icon_end..].trim().to_string();

                if !name.is_empty() {
                    toolsets.push(ToolsetInfo { name, description, enabled, icon });
                }
            }
            toolsets
        }
        Err(_) => vec![],
    }
}

#[tauri::command]
pub fn toggle_toolset(name: String, enable: bool) -> Result<(), String> {
    let hermes_bin = gateway_manager::hermes_bin_path()
        .ok_or("Hermes binary not found")?;

    let action = if enable { "enable" } else { "disable" };
    let output = std::process::Command::new(&hermes_bin)
        .args(["tools", action, &name])
        .output()
        .map_err(|e| format!("Failed to toggle toolset: {}", e))?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed to {} {}: {}", action, name, stderr))
    }
}

// ─── Hermes Installation Management ────────────────────────

#[tauri::command]
pub fn check_hermes_prerequisites() -> hermes_installer::Prerequisites {
    hermes_installer::check_prerequisites()
}

#[tauri::command]
pub fn detect_hermes_installation() -> hermes_installer::HermesInstallInfo {
    hermes_installer::detect_hermes()
}

#[tauri::command]
pub async fn install_hermes_agent(
    app: tauri::AppHandle,
    use_china_mirror: bool,
) -> Result<(), String> {
    let handle = app.clone();
    tokio::task::spawn_blocking(move || {
        hermes_installer::install_hermes(handle, use_china_mirror)
    })
    .await
    .map_err(|e| format!("Installation task panicked: {}", e))?
}

#[tauri::command]
pub async fn update_hermes_agent(
    app: tauri::AppHandle,
    use_china_mirror: bool,
) -> Result<(), String> {
    let handle = app.clone();
    tokio::task::spawn_blocking(move || {
        hermes_installer::update_hermes(handle, use_china_mirror)
    })
    .await
    .map_err(|e| format!("Update task panicked: {}", e))?
}

// ─── Session Search ────────────────────────────────────────

#[tauri::command]
pub fn search_sessions_cmd(query: String, limit: Option<u32>) -> Vec<crate::session_search::SearchResult> {
    crate::session_search::search_sessions(&query, limit.unwrap_or(20))
}

// ─── Model Manager ─────────────────────────────────────────

#[tauri::command]
pub fn list_saved_models() -> Vec<crate::model_manager::SavedModel> {
    crate::model_manager::list_models()
}

#[tauri::command]
pub fn add_saved_model(name: String, provider: String, model: String, base_url: String) -> crate::model_manager::SavedModel {
    crate::model_manager::add_model(&name, &provider, &model, &base_url)
}

#[tauri::command]
pub fn remove_saved_model(id: String) -> bool {
    crate::model_manager::remove_model(&id)
}

#[tauri::command]
pub fn update_saved_model(
    id: String,
    name: Option<String>,
    provider: Option<String>,
    model: Option<String>,
    base_url: Option<String>,
) -> bool {
    crate::model_manager::update_model(
        &id,
        name.as_deref(),
        provider.as_deref(),
        model.as_deref(),
        base_url.as_deref(),
    )
}

// ─── Credential Pool ───────────────────────────────────────

#[tauri::command]
pub fn get_credential_pool() -> std::collections::HashMap<String, Vec<crate::credential_pool::CredentialEntry>> {
    crate::credential_pool::get_credential_pool()
}

#[tauri::command]
pub fn set_credential_pool(provider: String, entries: Vec<crate::credential_pool::CredentialEntry>) -> bool {
    crate::credential_pool::set_credential_pool(&provider, entries);
    true
}

// ─── Helpers ───────────────────────────────────────────────

fn detect_hermes_version() -> Option<String> {
    let bin = gateway_manager::hermes_bin_path()?;
    let output = std::process::Command::new(bin).arg("--version").output().ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().next().and_then(|l| {
        let trimmed = l.trim();
        if let Some(start) = trimmed.find('v') {
            let version_part = &trimmed[start..];
            let end = version_part.find(|c: char| c.is_whitespace() || c == '(').unwrap_or(version_part.len());
            Some(version_part[..end].to_string())
        } else {
            Some(trimmed.to_string())
        }
    })
}

// ─── QR Code Pairing (In-App) ────────────────────────────────

pub struct QrSessionState {
    pub child_pid: Option<u32>,
}

impl Default for QrSessionState {
    fn default() -> Self {
        Self { child_pid: None }
    }
}

fn strip_ansi(s: &str) -> String {
    let mut result = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '\x1B' {
            match chars.peek() {
                Some('[') => {
                    chars.next();
                    for sc in chars.by_ref() {
                        if sc.is_ascii_alphabetic() {
                            break;
                        }
                    }
                }
                Some(']') => {
                    chars.next();
                    for sc in chars.by_ref() {
                        if sc == '\x07' || sc == '\\' {
                            break;
                        }
                    }
                }
                _ => {
                    chars.next();
                }
            }
        } else if c == '\r' {
            continue;
        } else {
            result.push(c);
        }
    }
    result
}

#[derive(Debug, Serialize, Clone)]
pub struct QrSessionUpdate {
    pub stage: String,
    pub qr_url: Option<String>,
    pub message: String,
    pub credentials: Option<HashMap<String, String>>,
}

#[tauri::command]
pub fn start_qr_session(
    platform: String,
    qr_state: State<'_, Mutex<QrSessionState>>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    {
        let mut state = qr_state.lock().unwrap();
        if let Some(pid) = state.child_pid.take() {
            let _ = kill_process(pid);
        }
    }

    let hermes_bin = gateway_manager::hermes_bin_path()
        .ok_or("Hermes binary not found")?;
    let hermes_home_dir = {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string());
        std::path::PathBuf::from(&home).join(".hermes")
    };

    match platform.as_str() {
        "weixin" => {
            let py_script = format!(
                r#"
import sys, os, json, asyncio
sys.path.insert(0, os.path.join(os.path.expanduser("~"), ".hermes", "hermes-agent"))
os.environ.setdefault("HERMES_HOME", "{hermes_home}")
from gateway.platforms.weixin import qr_login
async def main():
    result = await qr_login("{hermes_home}", timeout_seconds=300)
    if result:
        print("QR_RESULT:" + json.dumps(result), flush=True)
    else:
        print("QR_RESULT:null", flush=True)
asyncio.run(main())
"#,
                hermes_home = hermes_home_dir.to_string_lossy()
            );

            let child = std::process::Command::new("python3")
                .args(["-u", "-c", &py_script])
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::piped())
                .spawn()
                .map_err(|e| format!("Failed to start Python: {}", e))?;

            let pid = child.id();
            {
                let mut state = qr_state.lock().unwrap();
                state.child_pid = Some(pid);
            }

            let stdout = child.stdout.unwrap();
            let stderr = child.stderr.unwrap();
            let handle = app_handle.clone();

            std::thread::spawn(move || {
                let stderr_handle = handle.clone();
                let stderr_thread = std::thread::spawn(move || {
                    use std::io::{BufRead, BufReader};
                    let reader = BufReader::new(stderr);
                    for line in reader.lines().flatten() {
                        let _ = stderr_handle.emit("qr-session-output", &line);
                    }
                });

                use std::io::{BufRead, BufReader};
                let reader = BufReader::new(stdout);
                for line in reader.lines().flatten() {
                    if line.starts_with("QR_RESULT:") {
                        let json_str = &line["QR_RESULT:".len()..];
                        if json_str != "null" {
                            if let Ok(raw_creds) =
                                serde_json::from_str::<HashMap<String, String>>(json_str)
                            {
                                let mut creds = HashMap::new();
                                if let Some(v) = raw_creds.get("account_id") {
                                    creds.insert("WEIXIN_ACCOUNT_ID".to_string(), v.clone());
                                }
                                if let Some(v) = raw_creds.get("token") {
                                    creds.insert("WEIXIN_TOKEN".to_string(), v.clone());
                                }
                                let update = QrSessionUpdate {
                                    stage: "paired".to_string(),
                                    qr_url: None,
                                    message: "微信连接成功！".to_string(),
                                    credentials: Some(creds),
                                };
                                let _ = handle.emit("qr-session-update", &update);
                            }
                        } else {
                            let update = QrSessionUpdate {
                                stage: "failed".to_string(),
                                qr_url: None,
                                message: "微信登录失败或超时".to_string(),
                                credentials: None,
                            };
                            let _ = handle.emit("qr-session-update", &update);
                        }
                    } else if line.contains("http") && line.contains("qrcode") {
                        let url = line.trim().to_string();
                        let update = QrSessionUpdate {
                            stage: "qr_ready".to_string(),
                            qr_url: Some(url),
                            message: "请使用微信扫描二维码".to_string(),
                            credentials: None,
                        };
                        let _ = handle.emit("qr-session-update", &update);
                    } else {
                        let _ = handle.emit("qr-session-output", &line);
                    }
                }

                let _ = stderr_thread.join();
                let _ = handle.emit("qr-session-ended", "weixin");
            });

            Ok(())
        }
        "whatsapp" => {
            let sub_cmd = format!("{} whatsapp 2>&1", hermes_bin.to_string_lossy());
            let temp_log = std::env::temp_dir().join("hermes-qr-whatsapp.log");
            let _ = std::fs::remove_file(&temp_log);
            let temp_str = temp_log.to_string_lossy().to_string();

            #[cfg(target_os = "macos")]
            let child = {
                std::process::Command::new("script")
                    .args(["-q", &temp_str, "bash", "-c", &sub_cmd])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .spawn()
                    .map_err(|e| format!("Failed to start QR session: {}", e))?
            };

            #[cfg(target_os = "linux")]
            let child = {
                std::process::Command::new("script")
                    .args(["-qc", &sub_cmd, &temp_str])
                    .stdout(std::process::Stdio::null())
                    .stderr(std::process::Stdio::null())
                    .spawn()
                    .map_err(|e| format!("Failed to start QR session: {}", e))?
            };

            #[cfg(target_os = "windows")]
            let child = {
                std::process::Command::new(hermes_bin)
                    .arg("whatsapp")
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .spawn()
                    .map_err(|e| format!("Failed to start QR session: {}", e))?
            };

            let pid = child.id();
            {
                let mut state = qr_state.lock().unwrap();
                state.child_pid = Some(pid);
            }

            let handle = app_handle.clone();
            let log_path = temp_log.clone();

            std::thread::spawn(move || {
                let mut last_size: u64 = 0;
                let interval = std::time::Duration::from_millis(300);
                loop {
                    std::thread::sleep(interval);
                    if let Ok(meta) = std::fs::metadata(&log_path) {
                        let sz = meta.len();
                        if sz > last_size {
                            if let Ok(content) = std::fs::read_to_string(&log_path) {
                                let new = if last_size == 0 {
                                    content.as_str()
                                } else {
                                    &content[last_size as usize..]
                                };
                                let cleaned = strip_ansi(new);
                                if !cleaned.trim().is_empty() {
                                    let _ = handle.emit("qr-session-output", &cleaned);
                                }
                                last_size = sz;
                            }
                        }
                    }
                    #[cfg(unix)]
                    {
                        let check = std::process::Command::new("kill")
                            .args(["-0", &pid.to_string()])
                            .output();
                        if let Ok(o) = check {
                            if !o.status.success() {
                                break;
                            }
                        }
                    }
                }
                let _ = handle.emit("qr-session-ended", "whatsapp");
                let _ = std::fs::remove_file(&log_path);
            });

            Ok(())
        }
        _ => Err(format!("Unsupported platform: {}", platform)),
    }
}

#[tauri::command]
pub fn stop_qr_session(
    qr_state: State<'_, Mutex<QrSessionState>>,
) -> Result<(), String> {
    let mut state = qr_state.lock().unwrap();
    if let Some(pid) = state.child_pid.take() {
        kill_process(pid)?;
    }
    Ok(())
}

#[derive(Debug, Serialize)]
pub struct QrCredentialResult {
    pub found: bool,
    pub credentials: HashMap<String, String>,
    pub message: String,
}

#[tauri::command]
pub fn detect_qr_credentials(platform: String) -> Result<QrCredentialResult, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    let hermes_home = std::path::PathBuf::from(&home).join(".hermes");

    match platform.as_str() {
        "whatsapp" => {
            let creds_path = hermes_home
                .join("whatsapp")
                .join("session")
                .join("creds.json");
            if creds_path.exists() {
                let mut credentials = HashMap::new();
                credentials.insert("WHATSAPP_ENABLED".to_string(), "true".to_string());
                credentials.insert("WHATSAPP_MODE".to_string(), "bot".to_string());
                Ok(QrCredentialResult {
                    found: true,
                    credentials,
                    message: "WhatsApp 配对成功！已检测到有效会话。".to_string(),
                })
            } else {
                Ok(QrCredentialResult {
                    found: false,
                    credentials: HashMap::new(),
                    message: "未检测到 WhatsApp 会话。请等待扫码完成。".to_string(),
                })
            }
        }
        "weixin" => {
            let env_path = hermes_home.join(".env");
            if env_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&env_path) {
                    let mut credentials = HashMap::new();
                    for line in content.lines() {
                        let t = line.trim();
                        if let Some(val) = t.strip_prefix("WEIXIN_ACCOUNT_ID=") {
                            if !val.is_empty() {
                                credentials
                                    .insert("WEIXIN_ACCOUNT_ID".to_string(), val.to_string());
                            }
                        }
                        if let Some(val) = t.strip_prefix("WEIXIN_TOKEN=") {
                            if !val.is_empty() {
                                credentials.insert("WEIXIN_TOKEN".to_string(), val.to_string());
                            }
                        }
                    }
                    if credentials.contains_key("WEIXIN_ACCOUNT_ID")
                        && credentials.contains_key("WEIXIN_TOKEN")
                    {
                        return Ok(QrCredentialResult {
                            found: true,
                            credentials,
                            message: "微信配对成功！已检测到凭证。".to_string(),
                        });
                    }
                }
            }
            Ok(QrCredentialResult {
                found: false,
                credentials: HashMap::new(),
                message: "未检测到微信凭证。请等待扫码完成。".to_string(),
            })
        }
        _ => Err(format!("Unsupported: {}", platform)),
    }
}

#[tauri::command]
pub fn check_qr_platform_support(platform: String) -> Result<bool, String> {
    let hermes_bin = match gateway_manager::hermes_bin_path() {
        Some(p) => p,
        None => return Ok(false),
    };

    match platform.as_str() {
        "whatsapp" => {
            let output = std::process::Command::new(&hermes_bin)
                .args(["whatsapp", "--help"])
                .output();
            Ok(output.map(|o| o.status.success()).unwrap_or(false))
        }
        "weixin" => {
            let output = std::process::Command::new(&hermes_bin)
                .args(["gateway", "setup", "--help"])
                .output();
            Ok(output.map(|o| o.status.success()).unwrap_or(false))
        }
        _ => Ok(false),
    }
}

fn kill_process(pid: u32) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::process::Command;
        Command::new("kill")
            .args(["-TERM", &pid.to_string()])
            .output()
            .map_err(|e| format!("Failed to kill process: {}", e))?;
    }
    #[cfg(windows)]
    {
        use std::process::Command;
        Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/F"])
            .output()
            .map_err(|e| format!("Failed to kill process: {}", e))?;
    }
    Ok(())
}
