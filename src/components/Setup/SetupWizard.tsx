import { useState, useEffect } from "react";
import {
  ChevronRight,
  Check,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import {
  getProviders,
  saveApiConfig,
  getAppStatus,
  type ProviderInfo,
} from "../../lib/hermes-bridge";

type Step = "welcome" | "provider" | "apikey" | "model" | "done";

export default function SetupWizard() {
  const { setView, setAppStatus } = useAppStore();
  const [step, setStep] = useState<Step>("welcome");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(
    null
  );
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    getProviders().then(setProviders).catch(console.error);
  }, []);

  const handleSave = async () => {
    if (!selectedProvider || !selectedModel) return;
    setSaving(true);
    setError(null);
    try {
      await saveApiConfig(selectedProvider.id, apiKey, selectedModel);
      const status = await getAppStatus();
      setAppStatus(status);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center bg-surface-0">
      <div className="w-full max-w-lg px-6">
        {step === "welcome" && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-3xl overflow-hidden mx-auto mb-8 shadow-2xl shadow-hermes-500/30">
              <img
                src="/logo.png"
                alt="OpenOtter"
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-3">
              欢迎使用 OpenOtter
            </h1>
            <p className="text-zinc-400 mb-8 leading-relaxed">
              只需几步即可完成配置。你需要一个 AI 模型提供商的 API Key。
            </p>
            <button
              onClick={() => setStep("provider")}
              className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              开始配置
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {step === "provider" && (
          <div>
            <StepHeader
              number={1}
              title="选择 Provider"
              subtitle="选择你的 AI 模型提供商"
            />
            <div className="space-y-3 mt-6">
              {["china", "international", "custom"].map((group) => {
                const groupProviders = providers.filter((p) => p.group === group);
                if (groupProviders.length === 0) return null;
                const label = group === "china" ? "🇨🇳 中国" : group === "international" ? "🌍 国际" : "🔧 自定义";
                return (
                  <div key={group}>
                    <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-2 mt-3">{label}</h3>
                    {groupProviders.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedProvider(p);
                          setSelectedModel(p.models[0] || "");
                          setStep("apikey");
                        }}
                        className={`w-full text-left p-4 rounded-xl border transition-colors mb-2 ${
                          selectedProvider?.id === p.id
                            ? "border-hermes-500 bg-hermes-500/10"
                            : "border-zinc-800 bg-surface-1 hover:border-zinc-600"
                        }`}
                      >
                        <div className="font-medium text-zinc-200">{p.name}</div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {p.models.length} 个模型
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "apikey" && selectedProvider && (
          <div>
            <StepHeader
              number={2}
              title="输入 API Key"
              subtitle={`${selectedProvider.name} 的 API Key`}
            />
            <div className="mt-6 space-y-4">
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    selectedProvider.placeholder || "Enter your API key"
                  }
                  className="w-full bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {selectedProvider.id === "nous" && (
                <p className="text-xs text-zinc-500">
                  Nous Portal 提供免费额度，可留空使用免费版。
                </p>
              )}

              {selectedProvider.get_key_url && (
                <a
                  href={selectedProvider.get_key_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-hermes-400 hover:text-hermes-300"
                >
                  获取 API Key
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("provider")}
                  className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                >
                  返回
                </button>
                <button
                  onClick={() => setStep("model")}
                  disabled={!apiKey && selectedProvider.id !== "nous"}
                  className="flex-1 bg-hermes-600 hover:bg-hermes-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                >
                  继续
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "model" && selectedProvider && (
          <div>
            <StepHeader
              number={3}
              title="选择模型"
              subtitle="选择默认使用的模型"
            />
            <div className="space-y-2 mt-6">
              {selectedProvider.models.map((model) => (
                <button
                  key={model}
                  onClick={() => setSelectedModel(model)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                    selectedModel === model
                      ? "border-hermes-500 bg-hermes-500/10 text-hermes-300"
                      : "border-zinc-800 bg-surface-1 text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  <code>{model}</code>
                </button>
              ))}
            </div>

            {error && (
              <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep("apikey")}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
              >
                返回
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !selectedModel}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-hermes-600 hover:bg-hermes-500 disabled:opacity-40 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                保存并完成
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-3">
              配置完成！
            </h2>
            <p className="text-zinc-400 mb-8">
              OpenOtter 已就绪，开始创建你的第一个 Agent 吧。
            </p>
            <button
              onClick={() => setView("dashboard")}
              className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-6 py-3 rounded-xl font-medium transition-colors"
            >
              进入总览
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeader({
  number,
  title,
  subtitle,
}: {
  number: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center gap-2 text-xs text-hermes-400 bg-hermes-500/10 px-2.5 py-1 rounded-full mb-3">
        第 {number} 步 / 共 3 步
      </div>
      <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
      <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>
    </div>
  );
}
