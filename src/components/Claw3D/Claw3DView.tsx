import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Play,
  Square,
  Download,
  RefreshCw,
  ExternalLink,
  Settings2,
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  Wifi,
} from "lucide-react";
import {
  claw3dGetStatus,
  claw3dSetup,
  claw3dStartAll,
  claw3dStopAll,
  claw3dGetPort,
  claw3dSetPort,
  claw3dGetWsUrl,
  claw3dSetWsUrl,
  onClaw3dSetupProgress,
  type Claw3dStatus,
  type Claw3dSetupProgress,
} from "../../lib/hermes-bridge";

export default function Claw3DView() {
  const [status, setStatus] = useState<Claw3dStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<Claw3dSetupProgress | null>(null);
  const [starting, setStarting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [port, setPort] = useState(3000);
  const [wsUrl, setWsUrl] = useState("ws://localhost:18789");

  const refresh = useCallback(async () => {
    try {
      const s = await claw3dGetStatus();
      setStatus(s);
      const p = await claw3dGetPort();
      setPort(p);
      const ws = await claw3dGetWsUrl();
      setWsUrl(ws);
    } catch (err) {
      console.error("Failed to get Claw3D status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onClaw3dSetupProgress((p) => setProgress(p)).then((u) => {
      unlisten = u;
    });
    return () => unlisten?.();
  }, []);

  async function handleInstall() {
    setInstalling(true);
    setProgress(null);
    try {
      await claw3dSetup();
      await refresh();
    } catch (err) {
      console.error("Claw3D setup failed:", err);
    } finally {
      setInstalling(false);
      setProgress(null);
    }
  }

  async function handleStart() {
    setStarting(true);
    try {
      await claw3dStartAll();
      await new Promise((r) => setTimeout(r, 2000));
      await refresh();
    } catch (err) {
      console.error("Failed to start Claw3D:", err);
    } finally {
      setStarting(false);
    }
  }

  async function handleStop() {
    try {
      await claw3dStopAll();
      await refresh();
    } catch (err) {
      console.error("Failed to stop Claw3D:", err);
    }
  }

  async function handleSaveSettings() {
    await claw3dSetPort(port);
    await claw3dSetWsUrl(wsUrl);
    setShowSettings(false);
    await refresh();
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-hermes-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-5 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Box className="w-5 h-5 text-hermes-400" />
            Claw3D
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Hermes 3D 可视化伴侣 — 基于 Three.js 的交互式 AI 形象
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 rounded-lg transition-colors"
          >
            <Settings2 className="w-5 h-5" />
          </button>
          <button
            onClick={refresh}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 rounded-lg transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {showSettings && (
          <div className="mb-6 p-4 bg-surface-1 border border-zinc-800/50 rounded-xl space-y-3">
            <h3 className="text-sm font-medium text-zinc-200">设置</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">
                  Dev Server 端口
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">
                  WebSocket URL
                </label>
                <input
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-2 border border-zinc-700/50 rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50"
                />
              </div>
            </div>
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 text-xs bg-hermes-600 hover:bg-hermes-500 text-white rounded-lg transition-colors"
            >
              保存设置
            </button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6">
          <StatusCard
            label="仓库"
            ok={status?.cloned ?? false}
            detail={status?.cloned ? "已克隆" : "未克隆"}
          />
          <StatusCard
            label="依赖"
            ok={status?.installed ?? false}
            detail={status?.installed ? "已安装" : "未安装"}
          />
          <StatusCard
            label="Dev Server"
            ok={status?.dev_server_running ?? false}
            detail={
              status?.dev_server_running
                ? `运行中 (端口 ${status?.port})`
                : "未运行"
            }
          />
          <StatusCard
            label="Hermes Adapter"
            ok={status?.adapter_running ?? false}
            detail={status?.adapter_running ? "运行中" : "未运行"}
          />
        </div>

        {!status?.cloned || !status?.installed ? (
          <div className="text-center py-8">
            <Box className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
            <h2 className="text-base font-medium text-zinc-200 mb-2">
              安装 Claw3D
            </h2>
            <p className="text-sm text-zinc-500 mb-6 max-w-md mx-auto">
              Claw3D 是 Hermes 的 3D 可视化伴侣应用。安装后，你可以在浏览器中看到一个交互式的 Hermes 3D 形象。
            </p>
            {installing ? (
              <div className="max-w-sm mx-auto">
                {progress && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>{progress.title}</span>
                      <span>
                        {progress.step}/{progress.total_steps}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-hermes-500 rounded-full transition-all duration-300"
                        style={{
                          width: `${(progress.step / progress.total_steps) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-zinc-500 truncate">
                      {progress.detail}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleInstall}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-hermes-600 hover:bg-hermes-500 text-white text-sm rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                安装 Claw3D
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {status?.running ? (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-xl transition-colors"
                >
                  <Square className="w-4 h-4" />
                  停止
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={starting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-hermes-600 hover:bg-hermes-500 text-white text-sm rounded-xl transition-colors disabled:opacity-50"
                >
                  {starting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {starting ? "启动中..." : "启动"}
                </button>
              )}

              {status?.running && (
                <a
                  href={`http://localhost:${status.port}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 bg-surface-2 hover:bg-zinc-700 text-zinc-300 text-sm rounded-xl transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  在浏览器中打开
                </a>
              )}
            </div>

            {status?.running && (
              <div className="mt-6 rounded-xl overflow-hidden border border-zinc-800/50 bg-black">
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-1 border-b border-zinc-800/50">
                  <Globe className="w-3.5 h-3.5 text-hermes-400" />
                  <span className="text-xs text-zinc-400">
                    localhost:{status.port}
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <Wifi className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400">
                      已连接
                    </span>
                  </div>
                </div>
                <iframe
                  src={`http://localhost:${status.port}`}
                  className="w-full h-[500px] border-0"
                  title="Claw3D"
                />
              </div>
            )}

            {status?.error && (
              <div className="p-3 bg-red-900/20 border border-red-800/30 rounded-xl">
                <p className="text-xs text-red-400">{status.error}</p>
              </div>
            )}

            {status?.port_in_use && !status?.dev_server_running && (
              <div className="p-3 bg-amber-900/20 border border-amber-800/30 rounded-xl">
                <p className="text-xs text-amber-400">
                  端口 {status.port} 已被占用，请在设置中更换端口
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusCard({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 bg-surface-1 border border-zinc-800/50 rounded-xl">
      {ok ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      ) : (
        <XCircle className="w-5 h-5 text-zinc-600 shrink-0" />
      )}
      <div>
        <div className="text-sm font-medium text-zinc-200">{label}</div>
        <div className="text-xs text-zinc-500">{detail}</div>
      </div>
    </div>
  );
}
