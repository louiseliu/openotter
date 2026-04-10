import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Eye,
  EyeOff,
  Zap,
  Bot,
  Brain,
  Plug,
  Wrench,
  Rocket,
} from "lucide-react";
import { useAppStore } from "../../stores/appStore";
import { useAgentStore } from "../../stores/agentStore";
import {
  getProviders,
  getCurrentConfig,
  listChannelBots,
  createAgent,
  configurePlatform,
  type ProviderInfo,
  type CurrentConfig,
  type ChannelBot,
} from "../../lib/hermes-bridge";
import { AGENT_TEMPLATES, type AgentTemplate } from "../../lib/agent-templates";

type Step = "template" | "info" | "soul" | "model" | "platform" | "tools" | "done";

const STEPS: { id: Step; label: string; icon: typeof Bot }[] = [
  { id: "template", label: "选择模板", icon: Rocket },
  { id: "info", label: "基本信息", icon: Bot },
  { id: "soul", label: "人格设定", icon: Brain },
  { id: "model", label: "模型配置", icon: Zap },
  { id: "platform", label: "IM 接入", icon: Plug },
  { id: "tools", label: "工具配置", icon: Wrench },
  { id: "done", label: "完成", icon: Rocket },
];

const AVATARS = ["🤖", "🧠", "💬", "🎯", "🔥", "⚡", "🌟", "🎨", "📊", "🛡️", "🎵", "📝"];

// Templates are now in src/lib/agent-templates.ts

export default function AgentCreateWizard() {
  const { setView } = useAppStore();
  const { refresh } = useAgentStore();

  const [step, setStep] = useState<Step>("template");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [avatar, setAvatar] = useState("🤖");
  const [soulMd, setSoulMd] = useState(AGENT_TEMPLATES[0].soulMd);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderInfo | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("http://localhost:11434/v1");
  const [customModelName, setCustomModelName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelMode, setModelMode] = useState<"global" | "custom">("global");
  const [globalConfig, setGlobalConfig] = useState<CurrentConfig | null>(null);
  const [channelBots, setChannelBots] = useState<ChannelBot[]>([]);
  const [selectedBotIds, setSelectedBotIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getProviders().then((p) => {
      setProviders(p);
      const defaultProvider = p.find((pr) => pr.id === "deepseek") || p[0];
      if (defaultProvider) {
        setSelectedProvider(defaultProvider);
        setSelectedModel(defaultProvider.models[0] || "");
      }
    });
    getCurrentConfig().then(setGlobalConfig).catch(console.error);
    listChannelBots().then((bots) => {
      setChannelBots(bots);
      setSelectedBotIds(new Set(bots.map((b) => b.id)));
    }).catch(console.error);
  }, []);

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  const globalProvider = globalConfig?.provider
    ? providers.find((p) => p.id === globalConfig.provider)
    : null;

  const canProceed = () => {
    switch (step) {
      case "template":
        return true;
      case "info":
        return name.trim().length > 0;
      case "soul":
        return soulMd.trim().length > 0;
      case "model":
        if (modelMode === "global") {
          return !!globalConfig?.has_api_key && !!globalConfig?.provider;
        }
        return !!selectedProvider && !!selectedModel;
      case "platform":
        return true;
      case "tools":
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const idx = currentStepIndex;
    if (idx < STEPS.length - 2) {
      setStep(STEPS[idx + 1].id);
    } else if (step === "tools") {
      handleCreate();
    }
  };

  const handleBack = () => {
    const idx = currentStepIndex;
    if (idx > 0) {
      setStep(STEPS[idx - 1].id);
    }
  };

  const handleCreate = async () => {
    const isGlobal = modelMode === "global";
    const finalProvider = isGlobal ? (globalConfig?.provider || "") : (selectedProvider?.id || "");
    const finalModel = isGlobal ? (globalConfig?.model || "") : selectedModel;
    const finalApiKey = isGlobal ? "" : apiKey;

    if (!finalProvider || !finalModel) return;
    setSaving(true);
    setError(null);

    try {
      const agent = await createAgent({
        name,
        description,
        avatar,
        soul_md: soulMd,
        provider: finalProvider,
        model: finalModel,
        api_key: finalApiKey,
      });

      for (const botId of selectedBotIds) {
        const bot = channelBots.find((b) => b.id === botId);
        if (bot) {
          await configurePlatform({
            agent_id: agent.id,
            platform: bot.platform_id,
            config: bot.config,
          });
        }
      }

      await refresh();
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto py-10 px-8">
        {/* Progress */}
        {step !== "done" && (
          <div className="flex items-center gap-1 mb-8">
            {STEPS.slice(0, -1).map((s, i) => {
              const active = i === currentStepIndex;
              const completed = i < currentStepIndex;
              return (
                <div key={s.id} className="flex items-center gap-1 flex-1">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0 ${
                      completed
                        ? "bg-hermes-600 text-white"
                        : active
                        ? "bg-hermes-600/30 text-hermes-400 ring-2 ring-hermes-500"
                        : "bg-surface-2 text-zinc-500"
                    }`}
                  >
                    {completed ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  {i < STEPS.length - 2 && (
                    <div
                      className={`flex-1 h-0.5 rounded ${
                        completed ? "bg-hermes-600" : "bg-zinc-800"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step: Template */}
        {step === "template" && (
          <div>
            <StepHeader title="选择模板" subtitle="从预制模板快速开始，或从空白创建" />
            <div className="grid grid-cols-2 gap-3 mt-6">
              {AGENT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTemplate(t);
                    setName(t.id === "blank" ? "" : t.name);
                    setAvatar(t.avatar);
                    setDescription(t.description);
                    setSoulMd(t.soulMd);
                    if (t.suggestedModel && selectedProvider) {
                      const hasModel = selectedProvider.models.includes(t.suggestedModel);
                      if (hasModel) setSelectedModel(t.suggestedModel);
                    }
                    handleNext();
                  }}
                  className="text-left p-4 rounded-xl border border-zinc-800 bg-surface-1 hover:border-hermes-500/50 hover:bg-hermes-500/5 transition-colors"
                >
                  <div className="text-2xl mb-2">{t.avatar}</div>
                  <div className="text-sm font-medium text-zinc-200">{t.name}</div>
                  <div className="text-xs text-zinc-500 mt-1 line-clamp-2">{t.description}</div>
                  <div className="text-[10px] text-zinc-600 mt-2 px-1.5 py-0.5 rounded bg-surface-2 inline-block">
                    {t.category}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: Info */}
        {step === "info" && (
          <div>
            <StepHeader title="基本信息" subtitle="给你的 Agent 起个名字" />
            <div className="space-y-5 mt-6">
              <div>
                <label className="block text-sm text-zinc-300 mb-2">头像</label>
                <div className="flex gap-2 flex-wrap">
                  {AVATARS.map((a) => (
                    <button
                      key={a}
                      onClick={() => setAvatar(a)}
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg transition-all ${
                        avatar === a
                          ? "bg-hermes-600/20 ring-2 ring-hermes-500 scale-110"
                          : "bg-surface-2 hover:bg-surface-3"
                      }`}
                    >
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-1.5">名称 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：客服助手、编程助手"
                  className="w-full bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-300 mb-1.5">描述</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="简单描述这个 Agent 的用途"
                  rows={2}
                  className="w-full bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50 resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step: Soul */}
        {step === "soul" && (
          <div>
            <StepHeader title="人格设定" subtitle="定义 Agent 的性格和行为方式（SOUL.md）" />
            <div className="mt-6">
              {selectedTemplate && selectedTemplate.id !== "blank" && (
                <div className="mb-4 p-3 bg-hermes-500/5 border border-hermes-500/20 rounded-xl">
                  <p className="text-xs text-hermes-400">
                    已从「{selectedTemplate.name}」模板加载人格设定，你可以自由编辑。
                  </p>
                </div>
              )}

              <label className="block text-sm text-zinc-300 mb-1.5">
                SOUL.md（Markdown 格式）
              </label>
              <textarea
                value={soulMd}
                onChange={(e) => setSoulMd(e.target.value)}
                rows={14}
                className="w-full bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 font-mono placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50 resize-y"
              />
            </div>
          </div>
        )}

        {/* Step: Model */}
        {step === "model" && (
          <div>
            <StepHeader title="模型配置" subtitle="选择 Agent 使用的 AI 模型" />
            <div className="mt-6 space-y-4">
              {/* Mode Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setModelMode("global")}
                  className={`flex-1 p-3 rounded-xl border text-sm font-medium transition-colors ${
                    modelMode === "global"
                      ? "border-hermes-500 bg-hermes-500/10 text-hermes-300"
                      : "border-zinc-800 bg-surface-1 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  使用全局配置
                </button>
                <button
                  onClick={() => setModelMode("custom")}
                  className={`flex-1 p-3 rounded-xl border text-sm font-medium transition-colors ${
                    modelMode === "custom"
                      ? "border-hermes-500 bg-hermes-500/10 text-hermes-300"
                      : "border-zinc-800 bg-surface-1 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  独立配置模型
                </button>
              </div>

              {/* Global Config */}
              {modelMode === "global" && (
                <div className="space-y-4">
                  {globalConfig?.has_api_key && globalProvider ? (
                    <div className="bg-surface-1 border border-emerald-500/30 rounded-xl p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-200">
                            {globalProvider.name}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            模型: <code className="text-emerald-300">{globalConfig.model || "未设置"}</code>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-xs text-emerald-400">已配置</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-3">
                        将使用「设置」页面中已配置的全局 API Key 和模型
                      </p>
                    </div>
                  ) : (
                    <div className="bg-surface-1 border border-amber-500/30 rounded-xl p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Zap className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-200">
                            全局模型未配置
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            请先到「设置」页面配置 API Key 和模型
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setView("settings")}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-hermes-400 hover:text-hermes-300"
                      >
                        前往设置 <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Custom Config */}
              {modelMode === "custom" && (
                <div className="space-y-5">
                  {["china", "international", "custom"].map((group) => {
                    const groupProviders = providers.filter((p) => p.group === group);
                    if (groupProviders.length === 0) return null;
                    const groupLabel =
                      group === "china" ? "🇨🇳 中国" : group === "international" ? "🌍 国际" : "🔧 自定义";
                    return (
                      <div key={group}>
                        <h3 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
                          {groupLabel}
                        </h3>
                        <div className="space-y-2">
                          {groupProviders.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                setSelectedProvider(p);
                                setSelectedModel(p.models[0] || "");
                              }}
                              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                                selectedProvider?.id === p.id
                                  ? "border-hermes-500 bg-hermes-500/10"
                                  : "border-zinc-800 bg-surface-1 hover:border-zinc-600"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-zinc-200">{p.name}</span>
                                <span className="text-xs text-zinc-500">{p.models.length} 模型</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {selectedProvider && (
                    <>
                      <div>
                        <label className="block text-sm text-zinc-300 mb-1.5">API Key</label>
                        <div className="relative">
                          <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder={selectedProvider.placeholder || "输入 API Key"}
                            className="w-full bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 pr-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50"
                          />
                          <button
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                          >
                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {selectedProvider.get_key_url && (
                          <a
                            href={selectedProvider.get_key_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-hermes-400 hover:text-hermes-300 mt-1.5"
                          >
                            获取 API Key <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      {selectedProvider.id === "custom" && (
                        <>
                          <div>
                            <label className="block text-sm text-zinc-300 mb-1.5">API Base URL</label>
                            <input
                              type="text"
                              value={customBaseUrl}
                              onChange={(e) => setCustomBaseUrl(e.target.value)}
                              placeholder="http://localhost:11434/v1"
                              className="w-full bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50"
                            />
                            <p className="text-[10px] text-zinc-600 mt-1">
                              支持 Ollama、vLLM、LM Studio 等 OpenAI 兼容端点
                            </p>
                          </div>
                          <div>
                            <label className="block text-sm text-zinc-300 mb-1.5">模型名称</label>
                            <input
                              type="text"
                              value={customModelName}
                              onChange={(e) => {
                                setCustomModelName(e.target.value);
                                setSelectedModel(e.target.value);
                              }}
                              placeholder="例如：llama3.3、qwen2.5:72b"
                              className="w-full bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50"
                            />
                          </div>
                        </>
                      )}

                      {selectedProvider.id !== "custom" && selectedProvider.models.length > 0 && (
                        <div>
                          <label className="block text-sm text-zinc-300 mb-1.5">模型</label>
                          <div className="space-y-1.5">
                            {selectedProvider.models.map((m) => (
                              <button
                                key={m}
                                onClick={() => setSelectedModel(m)}
                                className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                                  selectedModel === m
                                    ? "border-hermes-500 bg-hermes-500/10 text-hermes-300"
                                    : "border-zinc-800 bg-surface-1 text-zinc-300 hover:border-zinc-600"
                                }`}
                              >
                                <code>{m}</code>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Platform */}
        {step === "platform" && (
          <div>
            <StepHeader
              title="IM 接入"
              subtitle="选择要绑定的 Bot（可跳过，稍后配置）"
            />
            <div className="mt-6 space-y-4">
              {channelBots.length > 0 ? (
                <div className="space-y-2">
                  {channelBots.map((bot) => {
                    const isSelected = selectedBotIds.has(bot.id);
                    const platformIcons: Record<string, string> = {
                      feishu: "🐦", dingtalk: "🔔", wecom: "💼",
                      telegram: "✈️", discord: "🎮", slack: "💬",
                    };
                    return (
                      <button
                        key={bot.id}
                        onClick={() => {
                          setSelectedBotIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(bot.id)) {
                              next.delete(bot.id);
                            } else {
                              next.add(bot.id);
                            }
                            return next;
                          });
                        }}
                        className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-colors text-left ${
                          isSelected
                            ? "border-hermes-500/50 bg-hermes-500/5"
                            : "border-zinc-800 bg-surface-1 hover:border-zinc-600"
                        }`}
                      >
                        <span className="text-xl">{platformIcons[bot.platform_id] || "🔌"}</span>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-zinc-200">{bot.name}</div>
                          <div className="text-xs text-zinc-500">
                            {bot.platform_id} · {Object.keys(bot.config).length} 项配置
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isSelected ? "border-hermes-500 bg-hermes-600" : "border-zinc-600"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-surface-1 border border-zinc-800 rounded-xl p-5 text-center">
                  <Plug className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-400">暂无已配置的 Bot</p>
                  <button
                    onClick={() => setView("channels")}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-hermes-400 hover:text-hermes-300"
                  >
                    前往渠道页添加 Bot <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step: Tools */}
        {step === "tools" && (
          <div>
            <StepHeader
              title="工具配置"
              subtitle="Agent 默认启用所有工具，你可以稍后在设置中调整"
            />
            <div className="mt-6 space-y-3">
              {[
                { name: "终端命令", desc: "执行 Shell 命令", enabled: true },
                { name: "文件操作", desc: "读写文件", enabled: true },
                { name: "网页搜索", desc: "搜索互联网", enabled: true },
                { name: "浏览器", desc: "自动化浏览器操作", enabled: true },
                { name: "代码执行", desc: "运行 Python 代码", enabled: true },
                { name: "图片生成", desc: "AI 生成图片", enabled: true },
                { name: "语音", desc: "TTS 语音合成", enabled: true },
                { name: "记忆", desc: "跨会话持久记忆", enabled: true },
                { name: "定时任务", desc: "Cron 定时执行", enabled: true },
              ].map((tool) => (
                <div
                  key={tool.name}
                  className="flex items-center justify-between p-3 bg-surface-1 border border-zinc-800 rounded-xl"
                >
                  <div>
                    <div className="text-sm text-zinc-200">{tool.name}</div>
                    <div className="text-xs text-zinc-500">{tool.desc}</div>
                  </div>
                  <div className="w-9 h-5 rounded-full bg-hermes-600 flex items-center justify-end px-0.5">
                    <div className="w-4 h-4 rounded-full bg-white" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-3">
              Agent 创建成功！
            </h2>
            <p className="text-zinc-400 mb-2">
              <span className="text-lg">{avatar}</span> <strong>{name}</strong> 已准备就绪
            </p>
            <p className="text-sm text-zinc-500 mb-8">
              你可以在 Agent 详情页启动 Gateway 来上线 IM 平台
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setView("agents")}
                className="px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-zinc-100 text-sm transition-colors"
              >
                查看所有 Agent
              </button>
              <button
                onClick={() => setView("dashboard")}
                className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                返回总览
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Navigation */}
        {step !== "done" && (
          <div className="flex gap-3 mt-8">
            {currentStepIndex > 0 && (
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                上一步
              </button>
            )}
            {currentStepIndex === 0 && (
              <button
                onClick={() => setView("dashboard")}
                className="px-4 py-2.5 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
              >
                取消
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleNext}
              disabled={!canProceed() || saving}
              className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 disabled:opacity-40 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : step === "tools" ? (
                <>
                  创建 Agent
                  <Rocket className="w-4 h-4" />
                </>
              ) : (
                <>
                  下一步
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
      <p className="text-sm text-zinc-400 mt-1">{subtitle}</p>
    </div>
  );
}

