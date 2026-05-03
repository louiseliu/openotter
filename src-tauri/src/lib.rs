mod agent_manager;
mod commands;
mod config;
mod credential_pool;
mod evolution_watcher;
mod gateway_manager;
mod hermes_installer;
mod model_manager;
mod session_search;
mod sidecar;
mod web_server;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(std::sync::Mutex::new(commands::QrSessionState::default()))
        .setup(|app| {
            sidecar::init_sidecar_state(app);
            gateway_manager::init_gateway_state(app);
            web_server::init_web_server_state(app);
            agent_manager::ensure_dirs();
            evolution_watcher::init_watcher(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // App status
            get_app_status,
            // Agent CRUD
            create_agent,
            list_agents,
            get_agent,
            delete_agent,
            get_agent_soul,
            update_agent_soul,
            // Profile Files
            list_profile_files,
            get_profile_file,
            save_profile_file,
            // Platform configuration
            configure_platform,
            unconfigure_platform,
            get_platform_templates,
            // Channel Bots
            list_channel_bots,
            add_channel_bot,
            update_channel_bot,
            remove_channel_bot,
            // Gateway management
            start_agent_gateway,
            stop_agent_gateway,
            get_gateway_status,
            get_all_gateway_statuses,
            get_agent_logs,
            get_agent_messages,
            // Providers
            get_providers,
            save_api_config,
            // Chat
            send_chat_message,
            // Sidecar
            start_hermes_sidecar,
            stop_hermes_sidecar,
            // Web Server (Dashboard API)
            start_web_server,
            get_web_server_info,
            stop_web_server,
            // Connectivity & Config
            test_provider_connectivity,
            test_saved_connectivity,
            get_current_config,
            // Skills
            list_skills,
            get_skill_content,
            // Memory / Sessions
            get_session_stats,
            list_recent_sessions,
            // Cron
            list_cron_jobs,
            create_cron_job,
            delete_cron_job,
            // MCP
            list_mcp_servers,
            // Insights
            get_hermes_insights,
            // Toolset
            list_toolsets,
            toggle_toolset,
            // Hermes Installation
            check_hermes_prerequisites,
            detect_hermes_installation,
            install_hermes_agent,
            update_hermes_agent,
            // Session Search
            search_sessions_cmd,
            // Model Manager
            list_saved_models,
            add_saved_model,
            remove_saved_model,
            update_saved_model,
            // Credential Pool
            get_credential_pool,
            set_credential_pool,
            // Skill Installation
            validate_local_skill,
            install_local_skill,
            // Agent Evolution
            get_agent_evolution,
            get_evolution_log,
            // QR Code Pairing
            start_qr_session,
            stop_qr_session,
            detect_qr_credentials,
            check_qr_platform_support,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
