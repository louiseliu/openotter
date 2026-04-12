import { useEffect, useState, useMemo, useCallback } from "react";
import {
  Sparkles,
  Search,
  ExternalLink,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Download,
  Package,
  Users,
  X,
  Star,
  Store,
  Zap,
  Globe,
  Code2,
  MessageSquare,
  FileSearch,
  Shield,
  Palette,
  Terminal,
  Copy,
  Check,
  FolderPlus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
} from "lucide-react";
import {
  listSkills,
  getSkillContent,
  validateLocalSkill,
  installLocalSkill,
  type SkillInfo,
  type SkillValidation,
} from "../../lib/hermes-bridge";

type TabId = "installed" | "marketplace" | "recommended";

const TABS: { id: TabId; label: string; icon: typeof Package }[] = [
  { id: "installed", label: "已安装", icon: Package },
  { id: "marketplace", label: "市场", icon: Store },
  { id: "recommended", label: "推荐", icon: Star },
];

const SOURCE_CONFIG: Record<
  string,
  { text: string; cls: string }
> = {
  builtin: {
    text: "内置",
    cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  },
  "built-in": {
    text: "内置",
    cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  },
  user: {
    text: "自定义",
    cls: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  },
  hub: {
    text: "Hub",
    cls: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
  },
};

const DEFAULT_SOURCE = {
  text: "其他",
  cls: "bg-zinc-800 text-zinc-500 ring-zinc-700",
};

function getSourceConfig(source: string) {
  return SOURCE_CONFIG[source] ?? DEFAULT_SOURCE;
}

interface RecommendedSkill {
  name: string;
  description: string;
  icon: typeof Code2;
  category: string;
  installCmd: string;
  stars: number;
  accentCls: string;
}

const RECOMMENDED_SKILLS: RecommendedSkill[] = [
  {
    name: "web-search",
    description: "让 Agent 具备实时搜索互联网的能力，获取最新信息和上下文",
    icon: Globe,
    category: "搜索",
    installCmd: "hermes skills install web-search",
    stars: 4820,
    accentCls: "from-blue-500/20 to-cyan-500/20 text-blue-400",
  },
  {
    name: "code-interpreter",
    description: "安全的代码沙箱执行环境，支持 Python、Node.js 等主流语言",
    icon: Code2,
    category: "开发",
    installCmd: "hermes skills install code-interpreter",
    stars: 3650,
    accentCls: "from-emerald-500/20 to-teal-500/20 text-emerald-400",
  },
  {
    name: "file-manager",
    description: "文件读写、目录管理、文档解析，支持 PDF/Excel/CSV 等格式",
    icon: FileSearch,
    category: "文件",
    installCmd: "hermes skills install file-manager",
    stars: 2940,
    accentCls: "from-amber-500/20 to-orange-500/20 text-amber-400",
  },
  {
    name: "chat-platform",
    description: "多平台消息接入（飞书、企微、Slack、Discord）统一管理",
    icon: MessageSquare,
    category: "通讯",
    installCmd: "hermes skills install chat-platform",
    stars: 2180,
    accentCls: "from-violet-500/20 to-purple-500/20 text-violet-400",
  },
  {
    name: "image-gen",
    description: "AI 图像生成与编辑，支持 DALL·E、Midjourney 风格和 Stable Diffusion",
    icon: Palette,
    category: "创作",
    installCmd: "hermes skills install image-gen",
    stars: 1870,
    accentCls: "from-pink-500/20 to-rose-500/20 text-pink-400",
  },
  {
    name: "security-audit",
    description: "代码安全审计、漏洞扫描、依赖检查和安全建议生成",
    icon: Shield,
    category: "安全",
    installCmd: "hermes skills install security-audit",
    stars: 1520,
    accentCls: "from-red-500/20 to-orange-500/20 text-red-400",
  },
  {
    name: "terminal",
    description: "安全的终端命令执行环境，带审批机制和沙箱隔离",
    icon: Terminal,
    category: "系统",
    installCmd: "hermes skills install terminal",
    stars: 3100,
    accentCls: "from-zinc-500/20 to-zinc-400/20 text-zinc-300",
  },
  {
    name: "workflow",
    description: "可视化工作流编排，支持条件分支、并行执行和定时触发",
    icon: Zap,
    category: "自动化",
    installCmd: "hermes skills install workflow",
    stars: 1340,
    accentCls: "from-yellow-500/20 to-amber-500/20 text-yellow-400",
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 transition-colors"
      title="复制安装命令"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  search: "from-blue-500/20 to-cyan-500/20",
  development: "from-emerald-500/20 to-teal-500/20",
  dev: "from-emerald-500/20 to-teal-500/20",
  file: "from-amber-500/20 to-orange-500/20",
  communication: "from-violet-500/20 to-purple-500/20",
  creative: "from-pink-500/20 to-rose-500/20",
  security: "from-red-500/20 to-orange-500/20",
  system: "from-zinc-500/20 to-zinc-400/20",
  automation: "from-yellow-500/20 to-amber-500/20",
};

function getCategoryGradient(category: string) {
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(k)) return v;
  }
  return "from-hermes-500/20 to-hermes-700/20";
}

function SkillCard({
  skill,
  expanded,
  onToggle,
  content,
  loadingContent,
}: {
  skill: SkillInfo;
  expanded: boolean;
  onToggle: () => void;
  content: string | undefined;
  loadingContent: boolean;
}) {
  const badge = getSourceConfig(skill.source);
  const gradientCls = getCategoryGradient(skill.category);

  const firstLine = useMemo(() => {
    if (!content) return null;
    const lines = content.split("\n").filter((l) => {
      const trimmed = l.trim();
      return trimmed && !trimmed.startsWith("---") && !trimmed.startsWith("#");
    });
    return lines[0]?.trim().slice(0, 120) || null;
  }, [content]);

  return (
    <div
      className={`group bg-surface-1 border rounded-xl overflow-hidden transition-all duration-200 flex flex-col ${
        expanded
          ? "border-hermes-500/30 shadow-lg shadow-hermes-500/5"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Card header accent */}
      <div className={`h-1 bg-gradient-to-r ${gradientCls}`} />

      <div className="p-4 flex flex-col flex-1">
        {/* Top section */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientCls} flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105`}
          >
            <Sparkles className="w-5 h-5 text-hermes-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-200 truncate">
              {skill.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <span
                className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-md ring-1 ring-inset ${badge.cls}`}
              >
                {badge.text}
              </span>
              {skill.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-zinc-500 ring-1 ring-inset ring-zinc-700/50">
                  {skill.category}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Preview or path */}
        {firstLine ? (
          <p className="text-xs text-zinc-500 leading-relaxed mb-3 line-clamp-2 flex-1">
            {firstLine}
          </p>
        ) : content === undefined ? (
          <p className="text-xs text-zinc-600 italic mb-3 flex-1">
            点击查看详情...
          </p>
        ) : (
          <div className="mb-3 flex-1" />
        )}

        {skill.path && (
          <p className="text-[10px] text-zinc-600 truncate flex items-center gap-1 mb-3">
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span className="truncate">{skill.path}</span>
          </p>
        )}

        {/* Action bar */}
        <button
          onClick={onToggle}
          className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
            expanded
              ? "bg-hermes-500/10 text-hermes-400"
              : "bg-surface-2 text-zinc-500 hover:text-zinc-300 hover:bg-surface-3"
          }`}
        >
          {expanded ? (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              收起内容
            </>
          ) : (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              查看内容
            </>
          )}
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-800/80">
          {loadingContent ? (
            <div className="flex items-center gap-2 text-zinc-500 text-xs p-4">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              加载中...
            </div>
          ) : (
            <div className="relative max-h-72 overflow-y-auto">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-hermes-500/40 via-hermes-500/10 to-transparent" />
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed p-4 pl-5">
                {content || "无内容"}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendedCard({ skill }: { skill: RecommendedSkill }) {
  const Icon = skill.icon;

  return (
    <div className="group bg-surface-1 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-all duration-200 flex flex-col">
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${skill.accentCls} flex items-center justify-center shrink-0`}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">{skill.name}</h3>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-800/80 text-zinc-500 ring-1 ring-inset ring-zinc-700/50">
              {skill.category}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="text-[10px] text-zinc-500 tabular-nums">
              {skill.stars.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed mb-3 flex-1">
        {skill.description}
      </p>

      <div className="flex items-center gap-2 bg-surface-0 rounded-lg px-3 py-2">
        <Terminal className="w-3 h-3 text-zinc-600 shrink-0" />
        <code className="text-[11px] text-zinc-500 flex-1 truncate font-mono">
          {skill.installCmd}
        </code>
        <CopyButton text={skill.installCmd} />
      </div>
    </div>
  );
}

function MarketplaceTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-hermes-500/20 to-violet-500/20 flex items-center justify-center">
          <Store className="w-10 h-10 text-hermes-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-amber-400" />
        </div>
      </div>

      <h2 className="text-xl font-bold text-zinc-100 mb-2">Skills 市场</h2>
      <p className="text-sm text-zinc-500 text-center max-w-md mb-2">
        浏览社区共享的数百个技能，一键安装为你的 Agent 赋能。
      </p>
      <p className="text-xs text-zinc-600 mb-8">应用内市场即将上线</p>

      <div className="flex items-center gap-3">
        <a
          href="https://skills.sh"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 bg-hermes-600 hover:bg-hermes-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Globe className="w-4 h-4" />
          访问 Skills Hub
          <ExternalLink className="w-3.5 h-3.5 opacity-60" />
        </a>
        <a
          href="https://github.com/NousResearch/hermes-skills"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 bg-surface-1 border border-zinc-800 hover:border-zinc-700 text-zinc-300 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Code2 className="w-4 h-4" />
          GitHub
        </a>
      </div>

      <div className="mt-12 w-full max-w-lg">
        <p className="text-xs text-zinc-600 text-center mb-4">
          你也可以使用命令行安装技能
        </p>
        <div className="flex items-center gap-2 bg-surface-1 border border-zinc-800 rounded-xl px-4 py-3">
          <Terminal className="w-4 h-4 text-zinc-600 shrink-0" />
          <code className="text-sm text-zinc-400 flex-1 font-mono">
            hermes skills install &lt;skill-name&gt;
          </code>
          <CopyButton text="hermes skills install " />
        </div>
      </div>
    </div>
  );
}

function LocalInstallDialog({
  open,
  onClose,
  onInstalled,
}: {
  open: boolean;
  onClose: () => void;
  onInstalled: () => void;
}) {
  const [path, setPath] = useState("");
  const [validation, setValidation] = useState<SkillValidation | null>(null);
  const [validating, setValidating] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleBrowse = useCallback(async () => {
    try {
      const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "选择技能目录",
      });
      if (selected) {
        setPath(selected as string);
        setValidation(null);
        setInstallResult(null);
      }
    } catch (err) {
      console.error("Dialog error:", err);
    }
  }, []);

  const handleValidate = useCallback(async () => {
    if (!path.trim()) return;
    setValidating(true);
    setInstallResult(null);
    try {
      const result = await validateLocalSkill(path.trim());
      setValidation(result);
    } catch (err) {
      setValidation(null);
      console.error("Validate error:", err);
    } finally {
      setValidating(false);
    }
  }, [path]);

  const handleInstall = useCallback(async () => {
    if (!validation?.valid) return;
    setInstalling(true);
    try {
      const name = await installLocalSkill(validation.path);
      setInstallResult({ success: true, message: `技能 "${name}" 安装成功` });
      onInstalled();
    } catch (err) {
      setInstallResult({
        success: false,
        message: String(err),
      });
    } finally {
      setInstalling(false);
    }
  }, [validation, onInstalled]);

  const handleClose = useCallback(() => {
    setPath("");
    setValidation(null);
    setInstallResult(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (path.trim()) {
      const timer = setTimeout(() => handleValidate(), 500);
      return () => clearTimeout(timer);
    } else {
      setValidation(null);
    }
  }, [path, handleValidate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-surface-1 border border-zinc-800 rounded-2xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-hermes-500/10 flex items-center justify-center">
              <FolderPlus className="w-4 h-4 text-hermes-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100">
                从本地安装技能
              </h2>
              <p className="text-xs text-zinc-500">
                选择包含 SKILL.md 的技能目录
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-surface-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Path input */}
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">
              技能路径
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/skill-directory"
                className="flex-1 bg-surface-0 border border-zinc-800 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-hermes-500/50 font-mono transition-colors"
              />
              <button
                onClick={handleBrowse}
                className="px-3 py-2.5 bg-surface-2 border border-zinc-800 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors shrink-0"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Validation result */}
          {validating && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              正在验证...
            </div>
          )}

          {validation && !validating && (
            <div className="space-y-3">
              {/* Status */}
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  validation.valid
                    ? "bg-emerald-500/5 border border-emerald-500/20"
                    : "bg-red-500/5 border border-red-500/20"
                }`}
              >
                {validation.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    validation.valid ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {validation.valid ? "验证通过" : "验证失败"}
                </span>
              </div>

              {/* Skill Info */}
              {validation.valid && (
                <div className="bg-surface-0 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-14 shrink-0">
                      名称
                    </span>
                    <span className="text-sm text-zinc-200 font-medium">
                      {validation.name}
                    </span>
                  </div>
                  {validation.description && (
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-zinc-500 w-14 shrink-0 mt-0.5">
                        描述
                      </span>
                      <span className="text-xs text-zinc-400 leading-relaxed">
                        {validation.description}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 w-14 shrink-0">
                      格式
                    </span>
                    <div className="flex items-center gap-1.5">
                      {validation.has_skill_md && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                          SKILL.md
                        </span>
                      )}
                      {validation.has_frontmatter && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-hermes-500/10 text-hermes-400 ring-1 ring-inset ring-hermes-500/20">
                          Frontmatter
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {validation.errors.length > 0 && (
                <div className="space-y-1.5">
                  {validation.errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-red-400"
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      {err}
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div className="space-y-1.5">
                  {validation.warnings.map((warn, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-amber-400"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      {warn}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Install result */}
          {installResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                installResult.success
                  ? "bg-emerald-500/5 border border-emerald-500/20"
                  : "bg-red-500/5 border border-red-500/20"
              }`}
            >
              {installResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span
                className={`text-sm ${
                  installResult.success ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {installResult.message}
              </span>
            </div>
          )}

          {/* Format hint */}
          <div className="flex items-start gap-2 p-3 bg-surface-0 rounded-lg">
            <Info className="w-3.5 h-3.5 text-zinc-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              有效的技能目录应包含 <code className="text-zinc-500">SKILL.md</code>{" "}
              文件，且使用 YAML frontmatter 声明{" "}
              <code className="text-zinc-500">name</code> 和{" "}
              <code className="text-zinc-500">description</code> 字段。
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-zinc-800">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
          >
            {installResult?.success ? "完成" : "取消"}
          </button>
          {!installResult?.success && (
            <button
              onClick={handleInstall}
              disabled={!validation?.valid || installing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-hermes-600 hover:bg-hermes-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
            >
              {installing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  安装中...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  安装技能
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("installed");
  const [showInstallDialog, setShowInstallDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listSkills();
      setSkills(list);
    } catch (err) {
      console.error("Failed to load skills:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = useCallback(
    async (name: string) => {
      if (expandedSkill === name) {
        setExpandedSkill(null);
        return;
      }
      setExpandedSkill(name);
      if (!skillContent[name]) {
        setLoadingContent(name);
        try {
          const content = await getSkillContent(name);
          setSkillContent((prev) => ({ ...prev, [name]: content }));
        } catch (err) {
          setSkillContent((prev) => ({
            ...prev,
            [name]: "无法加载内容: " + String(err),
          }));
        } finally {
          setLoadingContent(null);
        }
      }
    },
    [expandedSkill, skillContent]
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of skills) {
      if (s.category) cats.add(s.category);
    }
    return Array.from(cats).sort();
  }, [skills]);

  const filtered = useMemo(
    () =>
      skills.filter((s) => {
        const matchSearch =
          !search ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.category.toLowerCase().includes(search.toLowerCase());
        const matchCategory = !activeCategory || s.category === activeCategory;
        return matchSearch && matchCategory;
      }),
    [skills, search, activeCategory]
  );

  const builtinSkills = useMemo(
    () => filtered.filter((s) => s.source === "builtin" || s.source === "built-in"),
    [filtered]
  );
  const userSkills = useMemo(
    () => filtered.filter((s) => s.source !== "builtin" && s.source !== "built-in"),
    [filtered]
  );

  const builtinCount = skills.filter(
    (s) => s.source === "builtin" || s.source === "built-in"
  ).length;
  const userCount = skills.length - builtinCount;

  const installedSkillNames = useMemo(
    () => new Set(skills.map((s) => s.name)),
    [skills]
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">技能管理</h1>
            <p className="text-base text-zinc-500 mt-1">
              Hermes 的自适应技能系统
            </p>
          </div>
          <div className="flex items-center gap-3">
            {activeTab === "installed" && (
              <>
                <button
                  onClick={() => setShowInstallDialog(true)}
                  className="inline-flex items-center gap-1.5 text-sm text-hermes-400 hover:text-hermes-300 transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  本地安装
                </button>
                <button
                  onClick={load}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 disabled:opacity-40 transition-colors"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                  />
                  刷新
                </button>
              </>
            )}
            <a
              href="https://skills.sh"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-hermes-400 hover:text-hermes-300 transition-colors"
            >
              Skills Hub <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-surface-1 border border-zinc-800 rounded-xl p-1 mb-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-hermes-600 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-surface-2"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === "installed" && skills.length > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md tabular-nums ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-surface-2 text-zinc-500"
                    }`}
                  >
                    {skills.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab: Installed */}
        {activeTab === "installed" && (
          <>
            {/* Stats */}
            {!loading && skills.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-hermes-500/10 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-hermes-400" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-zinc-100 tabular-nums">
                      {skills.length}
                    </p>
                    <p className="text-xs text-zinc-500">总技能</p>
                  </div>
                </div>
                <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Package className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-zinc-100 tabular-nums">
                      {builtinCount}
                    </p>
                    <p className="text-xs text-zinc-500">内置</p>
                  </div>
                </div>
                <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-sky-500/10 flex items-center justify-center">
                    <Users className="w-4 h-4 text-sky-400" />
                  </div>
                  <div>
                    <p className="text-xl font-semibold text-zinc-100 tabular-nums">
                      {userCount}
                    </p>
                    <p className="text-xs text-zinc-500">自定义 / 社区</p>
                  </div>
                </div>
              </div>
            )}

            {/* Search + Category filter */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索技能名称或分类..."
                  className="w-full bg-surface-1 border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50 transition-colors"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeCategory && (
                    <button
                      onClick={() => setActiveCategory(null)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-hermes-500/15 text-hermes-400 ring-1 ring-inset ring-hermes-500/25 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      清除
                    </button>
                  )}
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() =>
                        setActiveCategory(activeCategory === cat ? null : cat)
                      }
                      className={`text-xs px-2.5 py-1.5 rounded-lg transition-all ${
                        activeCategory === cat
                          ? "bg-hermes-500/15 text-hermes-300 ring-1 ring-inset ring-hermes-500/25"
                          : "bg-surface-2 text-zinc-500 hover:text-zinc-400 ring-1 ring-inset ring-zinc-700/40 hover:ring-zinc-600/50"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-hermes-400" />
                <p className="text-sm text-zinc-500">加载技能列表...</p>
              </div>
            ) : (
              <>
                {builtinSkills.length > 0 && (
                  <section className="mb-8">
                    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Package className="w-3.5 h-3.5" />
                      内置技能
                      <span className="text-zinc-600">
                        ({builtinSkills.length})
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {builtinSkills.map((skill) => (
                        <SkillCard
                          key={skill.name}
                          skill={skill}
                          expanded={expandedSkill === skill.name}
                          onToggle={() => handleToggle(skill.name)}
                          content={skillContent[skill.name]}
                          loadingContent={loadingContent === skill.name}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {userSkills.length > 0 && (
                  <section className="mb-8">
                    <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <FolderOpen className="w-3.5 h-3.5" />
                      自定义与社区技能
                      <span className="text-zinc-600">
                        ({userSkills.length})
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {userSkills.map((skill) => (
                        <SkillCard
                          key={skill.name}
                          skill={skill}
                          expanded={expandedSkill === skill.name}
                          onToggle={() => handleToggle(skill.name)}
                          content={skillContent[skill.name]}
                          loadingContent={loadingContent === skill.name}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {filtered.length === 0 && (
                  <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
                    {search || activeCategory ? (
                      <>
                        <Search className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                        <p className="text-sm text-zinc-400">
                          未找到匹配
                          {search && `「${search}」`}
                          {activeCategory && ` [${activeCategory}]`}
                          的技能
                        </p>
                        <button
                          onClick={() => {
                            setSearch("");
                            setActiveCategory(null);
                          }}
                          className="text-xs text-hermes-400 hover:text-hermes-300 mt-2 transition-colors"
                        >
                          清除筛选条件
                        </button>
                      </>
                    ) : (
                      <>
                        <Download className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                        <p className="text-sm text-zinc-400">暂无技能</p>
                        <p className="text-xs text-zinc-600 mt-1">
                          访问{" "}
                          <a
                            href="https://skills.sh"
                            target="_blank"
                            rel="noreferrer"
                            className="text-hermes-400 hover:underline"
                          >
                            Skills Hub
                          </a>{" "}
                          或使用{" "}
                          <code className="text-zinc-500">
                            hermes skills install
                          </code>{" "}
                          安装技能
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Tab: Marketplace */}
        {activeTab === "marketplace" && <MarketplaceTab />}

        {/* Tab: Recommended */}
        {activeTab === "recommended" && (
          <div>
            <p className="text-sm text-zinc-500 mb-6">
              社区精选的高质量技能，为你的 Agent 赋予强大能力
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {RECOMMENDED_SKILLS.map((skill) => (
                <div key={skill.name} className="relative">
                  <RecommendedCard skill={skill} />
                  {installedSkillNames.has(skill.name) && (
                    <div className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                      <Check className="w-3 h-3" />
                      已安装
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <LocalInstallDialog
        open={showInstallDialog}
        onClose={() => setShowInstallDialog(false)}
        onInstalled={() => {
          load();
        }}
      />
    </div>
  );
}
