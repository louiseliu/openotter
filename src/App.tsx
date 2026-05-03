import { useEffect } from "react";
import { useAppStore } from "./stores/appStore";
import {
  getAppStatus,
  startHermesSidecar,
  detectHermesInstallation,
  onHermesReady,
  onHermesStdout,
  onHermesTerminated,
  onGatewayStarted,
  onGatewayStopped,
} from "./lib/hermes-bridge";
import { useAgentStore } from "./stores/agentStore";
import Sidebar from "./components/Layout/Sidebar";
import DashboardView from "./components/Dashboard/DashboardView";
import AgentsListView from "./components/Agents/AgentsListView";
import AgentCreateWizard from "./components/Agents/AgentCreateWizard";
import AgentDetailView from "./components/Agents/AgentDetailView";
import ChatView from "./components/Chat/ChatView";
import SetupWizard from "./components/Setup/SetupWizard";
import HermesInstaller from "./components/Setup/HermesInstaller";
import SettingsView from "./components/Settings/SettingsView";
import SkillsView from "./components/Skills/SkillsView";
import ChannelsView from "./components/Channels/ChannelsView";
import MemoryView from "./components/Memory/MemoryView";
import CronView from "./components/Cron/CronView";
import McpView from "./components/MCP/McpView";
import ModelsView from "./components/Models/ModelsView";
import CredentialsView from "./components/Credentials/CredentialsView";
import LogsView from "./components/Logs/LogsView";
import PluginsView from "./components/Plugins/PluginsView";
import ProfilesView from "./components/Profiles/ProfilesView";
import EnvView from "./components/Env/EnvView";
import { Loader2 } from "lucide-react";

export default function App() {
  const {
    currentView,
    loading,
    setAppStatus,
    setLoading,
    setView,
    setSidecarError,
    setSidecarStarting,
  } = useAppStore();
  const refreshAgents = useAgentStore((s) => s.refresh);

  useEffect(() => {
    async function init() {
      try {
        const hermesInfo = await detectHermesInstallation();

        if (
          hermesInfo.source === "NotInstalled" ||
          !hermesInfo.meets_min_version
        ) {
          setView("hermes-install");
          setLoading(false);
          return;
        }

        const status = await getAppStatus();
        setAppStatus(status);

        const isReady = status.install_status === "Ready";
        const needsSetup =
          status.install_status === "NotInstalled" ||
          status.install_status === "NeedsSetup" ||
          (typeof status.install_status === "object" && status.install_status !== null);

        if (needsSetup) {
          setView("setup");
          setLoading(false);
        } else {
          setView("dashboard");
          setLoading(false);

          if (isReady && !status.sidecar_running) {
            setSidecarStarting(true);
            setSidecarError(null);
            try {
              const port = await startHermesSidecar();
              console.log("Sidecar started on port", port);
              const freshStatus = await getAppStatus();
              setAppStatus(freshStatus);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.warn("Failed to start sidecar:", msg);
              setSidecarError(msg);
            } finally {
              setSidecarStarting(false);
            }
          }
        }
      } catch (err) {
        console.error("Failed to get app status:", err);
        setLoading(false);
      }
    }
    init();
  }, [setAppStatus, setLoading, setView, setSidecarError, setSidecarStarting]);

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    onHermesReady((port) => {
      console.log("Hermes ready on port", port);
      getAppStatus().then(setAppStatus).catch(console.error);
    }).then((u) => unlisteners.push(u));

    onHermesStdout((line) => {
      console.log("[hermes]", line);
    }).then((u) => unlisteners.push(u));

    onHermesTerminated((code) => {
      console.warn("Hermes terminated with code", code);
      getAppStatus().then(setAppStatus).catch(console.error);
    }).then((u) => unlisteners.push(u));

    onGatewayStarted(() => {
      refreshAgents();
      getAppStatus().then(setAppStatus).catch(console.error);
    }).then((u) => unlisteners.push(u));

    onGatewayStopped(() => {
      refreshAgents();
      getAppStatus().then(setAppStatus).catch(console.error);
    }).then((u) => unlisteners.push(u));

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, [setAppStatus, refreshAgents]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-0">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-hermes-500 animate-spin" />
          <p className="text-sm text-zinc-400">正在启动 OpenOtter...</p>
        </div>
      </div>
    );
  }

  if (currentView === "hermes-install") {
    return (
      <HermesInstaller
        onComplete={async () => {
          try {
            const status = await getAppStatus();
            setAppStatus(status);
            const needsSetup =
              status.install_status === "NotInstalled" ||
              status.install_status === "NeedsSetup" ||
              (typeof status.install_status === "object" &&
                status.install_status !== null);
            setView(needsSetup ? "setup" : "dashboard");
          } catch {
            setView("setup");
          }
        }}
      />
    );
  }

  if (currentView === "setup") {
    return <SetupWizard />;
  }

  return (
    <div className="h-full flex bg-surface-0">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {currentView === "dashboard" && <DashboardView />}
        {currentView === "agents" && <AgentsListView />}
        {currentView === "agent-create" && <AgentCreateWizard />}
        {currentView === "agent-detail" && <AgentDetailView />}
        {currentView === "chat" && <ChatView />}
        {currentView === "settings" && <SettingsView />}
        {currentView === "skills" && <SkillsView />}
        {currentView === "channels" && <ChannelsView />}
        {currentView === "memory" && <MemoryView />}
        {currentView === "cron" && <CronView />}
        {currentView === "mcp" && <McpView />}
        {currentView === "models" && <ModelsView />}
        {currentView === "credentials" && <CredentialsView />}
        {currentView === "logs" && <LogsView />}
        {currentView === "plugins" && <PluginsView />}
        {currentView === "profiles" && <ProfilesView />}
        {currentView === "env" && <EnvView />}
      </main>
    </div>
  );
}
