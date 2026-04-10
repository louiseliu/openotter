import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Globe,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Terminal,
} from "lucide-react";
import {
  checkHermesPrerequisites,
  installHermesAgent,
  onInstallProgress,
  type Prerequisites,
  type InstallProgress,
} from "../../lib/hermes-bridge";

interface HermesInstallerProps {
  onComplete: () => void;
}

type InstallerPhase = "checking" | "ready" | "installing" | "done" | "error";

interface StepState {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
}

export default function HermesInstaller({ onComplete }: HermesInstallerProps) {
  const [phase, setPhase] = useState<InstallerPhase>("checking");
  const [prereqs, setPrereqs] = useState<Prerequisites | null>(null);
  const [useChinaMirror, setUseChinaMirror] = useState(false);
  const [progress, setProgress] = useState<InstallProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [steps, setSteps] = useState<StepState[]>([
    { id: "check", label: "检查系统环境", status: "pending" },
    { id: "uv", label: "准备包管理器 (uv)", status: "pending" },
    { id: "venv", label: "创建虚拟环境", status: "pending" },
    { id: "install", label: "安装 Hermes Agent", status: "pending" },
    { id: "verify", label: "验证安装", status: "pending" },
  ]);

  const checkSystem = useCallback(async () => {
    setPhase("checking");
    setErrorMessage(null);
    try {
      const result = await checkHermesPrerequisites();
      setPrereqs(result);
      setUseChinaMirror(result.is_china_network);

      if (!result.has_git || !result.has_python) {
        setPhase("error");
        const missing: string[] = [];
        if (!result.has_git) missing.push("Git");
        if (!result.has_python) missing.push("Python 3");
        setErrorMessage(
          `缺少必要的系统组件：${missing.join("、")}。请先安装后重试。\n\nmacOS 用户可运行：xcode-select --install`
        );
      } else {
        setPhase("ready");
      }
    } catch (err) {
      setPhase("error");
      setErrorMessage(
        `检查系统环境失败：${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, []);

  useEffect(() => {
    checkSystem();
  }, [checkSystem]);

  useEffect(() => {
    if (phase !== "installing") return;

    const unlistenPromise = onInstallProgress((p) => {
      setProgress(p);

      setSteps((prev) =>
        prev.map((step) => {
          if (step.id === p.stage) {
            return {
              ...step,
              status: p.error ? "error" : p.done && p.stage === "done" ? "done" : "running",
            };
          }
          const stepOrder = ["check", "uv", "venv", "install", "verify"];
          const currentIdx = stepOrder.indexOf(p.stage);
          const stepIdx = stepOrder.indexOf(step.id);
          if (stepIdx < currentIdx) {
            return { ...step, status: "done" };
          }
          return step;
        })
      );

      if (p.done && !p.error) {
        setPhase("done");
        setSteps((prev) => prev.map((s) => ({ ...s, status: "done" as const })));
      } else if (p.error) {
        setPhase("error");
        setErrorMessage(p.error);
      }
    });

    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [phase]);

  const startInstallation = async () => {
    setPhase("installing");
    setErrorMessage(null);
    setProgress(null);
    setSteps((prev) => prev.map((s) => ({ ...s, status: "pending" as const })));

    try {
      await installHermesAgent(useChinaMirror);
    } catch (err) {
      if (phase !== "done") {
        setPhase("error");
        setErrorMessage(
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  };

  const progressPercent = progress ? Math.round(progress.progress * 100) : 0;

  return (
    <div className="h-full flex items-center justify-center bg-surface-0">
      <div className="w-full max-w-lg px-6">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-3xl overflow-hidden mx-auto mb-6 shadow-2xl shadow-hermes-500/30">
            <img
              src="/logo.png"
              alt="OpenOtter"
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
          <h1 className="text-2xl font-bold text-zinc-100 mb-2">
            安装 Hermes Agent
          </h1>
          <p className="text-sm text-zinc-400">
            OpenOtter 需要 Hermes Agent 作为核心引擎
          </p>
        </div>

        {phase === "checking" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="w-8 h-8 text-hermes-400 animate-spin" />
            <p className="text-zinc-400 text-sm">正在检查系统环境...</p>
          </div>
        )}

        {phase === "ready" && prereqs && (
          <div className="space-y-6">
            <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">
                系统环境
              </h3>
              <PrereqItem
                ok={prereqs.has_git}
                label="Git"
                version={prereqs.git_version}
              />
              <PrereqItem
                ok={prereqs.has_python}
                label="Python 3"
                version={prereqs.python_version}
              />
              <PrereqItem
                ok={prereqs.has_uv}
                label="uv (包管理器)"
                version={prereqs.uv_version}
                optional
              />
            </div>

            <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-zinc-400" />
                  <span className="text-sm text-zinc-300">网络模式</span>
                </div>
                <button
                  onClick={() => setUseChinaMirror(!useChinaMirror)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    useChinaMirror
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  }`}
                >
                  {useChinaMirror ? "🇨🇳 中国加速" : "🌍 国际直连"}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                {useChinaMirror
                  ? "使用 GitHub 代理和清华 PyPI 镜像加速下载"
                  : "直接连接 GitHub 和 PyPI（需要稳定的国际网络）"}
              </p>
              {prereqs.is_china_network && !useChinaMirror && (
                <p className="text-xs text-amber-400 mt-1">
                  ⚠️ 检测到中国网络环境，建议使用中国加速模式
                </p>
              )}
            </div>

            {!prereqs.has_uv && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                <p className="text-xs text-blue-300">
                  <Terminal className="w-3.5 h-3.5 inline mr-1" />
                  未检测到 uv，安装过程中将自动安装
                </p>
              </div>
            )}

            <button
              onClick={startInstallation}
              className="w-full flex items-center justify-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              开始安装
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === "installing" && (
          <div className="space-y-6">
            <div className="space-y-2">
              {steps.map((step) => (
                <StepItem key={step.id} step={step} />
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{progress?.message || "准备中..."}</span>
                <span>{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-hermes-600 to-hermes-400 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-zinc-500 text-center">
              安装可能需要几分钟，请耐心等待...
            </p>
          </div>
        )}

        {phase === "done" && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-100 mb-2">
                安装成功！
              </h2>
              <p className="text-sm text-zinc-400">
                {progress?.message || "Hermes Agent 已就绪"}
              </p>
            </div>
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              继续配置
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-6">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-red-300 mb-1">
                    安装遇到问题
                  </h3>
                  <p className="text-xs text-red-300/80 whitespace-pre-wrap">
                    {errorMessage}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={checkSystem}
                className="flex-1 flex items-center justify-center gap-2 bg-surface-1 hover:bg-surface-2 text-zinc-300 px-4 py-2.5 rounded-xl text-sm transition-colors border border-zinc-800"
              >
                <RefreshCw className="w-4 h-4" />
                重新检查
              </button>
              <button
                onClick={startInstallation}
                className="flex-1 flex items-center justify-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                重试安装
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PrereqItem({
  ok,
  label,
  version,
  optional,
}: {
  ok: boolean;
  label: string;
  version: string | null;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        ) : optional ? (
          <div className="w-4 h-4 rounded-full border border-zinc-600" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
        <span className="text-sm text-zinc-300">{label}</span>
        {optional && !ok && (
          <span className="text-[10px] text-zinc-600">(可选)</span>
        )}
      </div>
      {version && (
        <code className="text-xs text-zinc-500 bg-surface-2 px-2 py-0.5 rounded">
          {version}
        </code>
      )}
    </div>
  );
}

function StepItem({ step }: { step: StepState }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-5 h-5 flex items-center justify-center">
        {step.status === "done" && (
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        )}
        {step.status === "running" && (
          <Loader2 className="w-4 h-4 text-hermes-400 animate-spin" />
        )}
        {step.status === "pending" && (
          <div className="w-3 h-3 rounded-full border border-zinc-700" />
        )}
        {step.status === "error" && (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
      </div>
      <span
        className={`text-sm ${
          step.status === "done"
            ? "text-zinc-400"
            : step.status === "running"
              ? "text-zinc-100"
              : step.status === "error"
                ? "text-red-300"
                : "text-zinc-600"
        }`}
      >
        {step.label}
      </span>
    </div>
  );
}
