import { create } from "zustand";

export type Theme = "dark" | "light";

export type View =
  | "dashboard"
  | "agents"
  | "agent-create"
  | "agent-detail"
  | "chat"
  | "setup"
  | "hermes-install"
  | "settings"
  | "skills"
  | "channels"
  | "memory"
  | "cron"
  | "mcp"
  | "toolset"
  | "models"
  | "credentials"
  | "logs"
  | "plugins"
  | "profiles"
  | "env";

export interface AppStatus {
  install_status: "NotInstalled" | "NeedsSetup" | { Broken: string } | "Ready";
  hermes_version: string | null;
  hermes_home: string;
  sidecar_running: boolean;
  sidecar_port: number | null;
  agent_count: number;
  running_gateways: number;
}

interface AppState {
  currentView: View;
  appStatus: AppStatus | null;
  loading: boolean;
  error: string | null;
  sidecarError: string | null;
  sidecarStarting: boolean;
  selectedAgentId: string | null;
  theme: Theme;

  setView: (view: View) => void;
  setAppStatus: (status: AppStatus) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSidecarError: (error: string | null) => void;
  setSidecarStarting: (starting: boolean) => void;
  setSelectedAgentId: (id: string | null) => void;
  navigateToAgent: (id: string) => void;
  toggleTheme: () => void;
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("openotter-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("light");
  } else {
    root.classList.remove("light");
  }
  localStorage.setItem("openotter-theme", theme);
}

const initialTheme = getInitialTheme();
applyTheme(initialTheme);

export const useAppStore = create<AppState>((set, get) => ({
  currentView: "dashboard",
  appStatus: null,
  loading: true,
  error: null,
  sidecarError: null,
  sidecarStarting: false,
  selectedAgentId: null,
  theme: initialTheme,

  setView: (view) => set({ currentView: view }),
  setAppStatus: (status) => set({ appStatus: status }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSidecarError: (error) => set({ sidecarError: error }),
  setSidecarStarting: (starting) => set({ sidecarStarting: starting }),
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  navigateToAgent: (id) =>
    set({ currentView: "agent-detail", selectedAgentId: id }),
  toggleTheme: () => {
    const newTheme = get().theme === "dark" ? "light" : "dark";
    applyTheme(newTheme);
    set({ theme: newTheme });
  },
}));
