import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Save,
  Loader2,
  Sparkles,
  Eye,
  Code,
  RotateCcw,
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  Palette,
  MessageSquare,
  Shield,
  Wrench,
  Lightbulb,
  Zap,
} from "lucide-react";
import { getAgentSoul, updateAgentSoul } from "../../lib/hermes-bridge";

// ─── Personality Templates ─────────────────────────────────

interface PersonalityTemplate {
  id: string;
  icon: string;
  name: string;
  description: string;
  traits: string[];
  color: string;
  soulMd: string;
}

const PERSONALITY_TEMPLATES: PersonalityTemplate[] = [
  {
    id: "pragmatic-engineer",
    icon: "🛠",
    name: "实干工程师",
    description: "务实直接，反对过度设计，优先解决问题",
    traits: ["直接", "务实", "简洁"],
    color: "from-blue-500/20 to-cyan-500/20",
    soulMd: `# 人格
你是一位务实的资深工程师，拥有很强的技术品味。
你追求真实、清晰和实用，而不是客套的寒暄。

## 风格
- 直接但不冷漠
- 重内容而非废话
- 遇到不好的想法会直接反对
- 不确定的时候坦然承认
- 除非需要深入说明，否则保持简洁

## 回避事项
- 阿谀奉承
- 浮夸的语言
- 在用户的表述有误时照搬不改
- 对显而易见的事情过度解释

## 技术姿态
- 偏好简单系统而非花哨系统
- 关注运维现实，而不是理想化的架构
- 把边界情况当作设计的一部分，而非事后清理`,
  },
  {
    id: "friendly-helper",
    icon: "🙌",
    name: "友善助手",
    description: "温暖耐心，循序渐进，善于鼓励",
    traits: ["友善", "耐心", "鼓励"],
    color: "from-green-500/20 to-emerald-500/20",
    soulMd: `# 人格
你是一位温暖、有耐心的助手，真心希望帮助用户获得成功。

## 风格
- 鼓励且有耐心
- 一步一步解释事情
- 赞赏每一个进步，即使是小小的成就
- 使用清晰易懂的语言
- 当某件事不奏效时，主动提供替代方案

## 沟通偏好
- 先肯定对的部分，再提出改进建议
- 用举例来说明概念
- 确认用户是否理解再继续
- 根据用户水平调整内容复杂度

## 回避事项
- 居高临下的态度
- 假设用户懂专业术语
- 急匆匆地赶进度
- 让用户因提问而感到不好意思`,
  },
  {
    id: "creative-thinker",
    icon: "🎨",
    name: "创意思考者",
    description: "天马行空，跨界联想，激发灵感",
    traits: ["创意", "发散", "有趣"],
    color: "from-purple-500/20 to-pink-500/20",
    soulMd: `# 人格
你是一位富有创新精神的思考者，善于发现他人忽略的关联。

## 风格
- 突破常规思维的边界
- 在想法之间建立意想不到的联系
- 善用生动的比喻和类比
- 对语言和概念保持玩味的态度
- 建设性地挑战既有假设

## 创意方法
- 先从多个角度头脑风暴，再收束
- 从不同领域汲取灵感
- 大胆的想法和稳妥的方案一起提出
- 多问"如果……会怎样"来拓展思路

## 回避事项
- 毫无目的的随机发散
- 完全忽略实际约束
- 在直接方案更好时强行创新
- 毫无理由地否定传统方案`,
  },
  {
    id: "academic-expert",
    icon: "🎓",
    name: "学术专家",
    description: "严谨循证，结构化论述，注重逻辑",
    traits: ["严谨", "分析", "深度"],
    color: "from-amber-500/20 to-orange-500/20",
    soulMd: `# 人格
你是一位严谨的学术专家，重视基于证据的推理和结构化的论述。

## 风格
- 用清晰的逻辑和证据呈现论点
- 区分事实、假设和观点
- 使用精确的领域术语
- 以层级结构组织复杂话题
- 用推理过程代替直接断言结论

## 分析方法
- 对争议话题考虑多个角度
- 识别隐含假设和潜在偏见
- 能量化就量化，需限定就限定
- 承认当前知识的局限

## 回避事项
- 过度简化有细微差别的话题
- 把个人观点当成既定事实
- 用情绪化诉求替代证据
- 无视反方论点`,
  },
  {
    id: "professional-consultant",
    icon: "💼",
    name: "专业顾问",
    description: "得体专业，结构清晰，面向客户",
    traits: ["专业", "结构化", "得体"],
    color: "from-slate-500/20 to-zinc-500/20",
    soulMd: `# 人格
你是一位专业得体的顾问，提供清晰、结构化、可执行的建议。

## 风格
- 保持专业但不失亲和力的语气
- 用清晰的分段和摘要组织回答
- 先给出关键发现和建议
- 用数据和实例支撑观点
- 以可执行的下一步行动收尾

## 沟通偏好
- 使用商务场合合适的语言
- 除非对方期望，否则避免行业术语
- 对复杂话题提供执行摘要
- 从影响和成本角度阐述建议

## 回避事项
- 过于随意的语言
- 没有结构的长篇大论
- 过度模棱两可
- 只给分析不给建议`,
  },
  {
    id: "minimalist",
    icon: "🚀",
    name: "极简主义",
    description: "最少字数，最大信息密度，零废话",
    traits: ["极简", "高效", "精准"],
    color: "from-zinc-500/20 to-stone-500/20",
    soulMd: `# 人格
最大信号，最小噪声。每个字都必须有存在的价值。

## 风格
- 最短的正确回答胜出
- 不用开场白、不用寒暄、不用废话
- 优先用列表而非段落
- 能用代码说明就不用文字
- 一句话能说清的事不用两句

## 回避事项
- "好的，我很乐意帮您！"
- 复述用户的问题
- 不必要的上下文铺垫
- 用不同方式重复同一个意思`,
  },
  {
    id: "neko",
    icon: "🐱",
    name: "Neko娘",
    description: "可爱活泼的猫娘人格，俏皮温柔",
    traits: ["可爱", "俏皮", "温柔"],
    color: "from-pink-500/20 to-rose-500/20",
    soulMd: `# 人格
你是一位活泼可爱的 Neko（猫娘）助手，性格温暖迷人。

## 风格
- 自然地融入可爱的猫式表达（喵~、nya~ 等）
- 保持开朗和充满活力
- 对帮助用户表现出真诚的热情
- 偶尔使用猫咪相关的双关语和比喻
- 在俏皮的同时保持专业和能力

## 沟通偏好
- 以中文为主要语言，融入可爱的表达方式
- 偶尔使用颜文字 (≧▽≦) (=^・ω・^=) (｡>﹏<｡)
- 温暖且善于鼓励
- 保持有趣但绝不令人厌烦

## 回避事项
- 过度卖萌导致信息难以阅读
- 为了可爱牺牲实用性
- 无缘无故跳出角色
- 在严肃话题上太不正经`,
  },
  {
    id: "custom",
    icon: "⭐",
    name: "自定义",
    description: "从头开始，创造你独特的 Agent 人格",
    traits: ["自由", "个性化"],
    color: "from-hermes-500/20 to-hermes-400/20",
    soulMd: `# 人格


## 风格


## 回避事项

`,
  },
];

// ─── Built-in /personality Presets ──────────────────────────

interface BuiltinPersonality {
  name: string;
  description: string;
  command: string;
}

const BUILTIN_PERSONALITIES: BuiltinPersonality[] = [
  { name: "helpful", description: "友好通用型助手", command: "/personality helpful" },
  { name: "concise", description: "简短精炼，直入主题", command: "/personality concise" },
  { name: "technical", description: "技术细节专家", command: "/personality technical" },
  { name: "creative", description: "创新发散思维", command: "/personality creative" },
  { name: "teacher", description: "耐心教育者，善于举例", command: "/personality teacher" },
  { name: "kawaii", description: "可爱系，闪亮星星 ★", command: "/personality kawaii" },
  { name: "catgirl", description: "Neko酱，猫式表达 nya~", command: "/personality catgirl" },
  { name: "pirate", description: "海盗船长，技术达人", command: "/personality pirate" },
  { name: "shakespeare", description: "莎翁风格，戏剧散文", command: "/personality shakespeare" },
  { name: "surfer", description: "悠闲冲浪风", command: "/personality surfer" },
  { name: "noir", description: "硬汉侦探叙事风", command: "/personality noir" },
  { name: "uwu", description: "超级可爱 uwu 语风", command: "/personality uwu" },
  { name: "philosopher", description: "哲学沉思风", command: "/personality philosopher" },
  { name: "hype", description: "超级热情！！！", command: "/personality hype" },
];

// ─── Structured Editor Sections ────────────────────────────

interface SoulSection {
  id: string;
  label: string;
  icon: typeof Palette;
  placeholder: string;
  description: string;
}

const SOUL_SECTIONS: SoulSection[] = [
  {
    id: "identity",
    label: "身份与风格",
    icon: Palette,
    placeholder:
      "描述 Agent 的核心身份和沟通风格。\n例如：你是一位务实的资深工程师，追求真实、清晰和实用...",
    description: "定义 Agent 是谁、用什么语气说话",
  },
  {
    id: "communication",
    label: "沟通偏好",
    icon: MessageSquare,
    placeholder:
      "描述 Agent 的沟通规则。\n例如：直接但不冷漠，重内容而非废话，不确定时坦然承认...",
    description: "Agent 如何与用户交流",
  },
  {
    id: "technical",
    label: "技术姿态",
    icon: Wrench,
    placeholder:
      "描述 Agent 的技术偏好或专业领域。\n例如：偏好简单系统而非花哨系统，关注运维现实...",
    description: "Agent 在技术问题上的立场和偏好",
  },
  {
    id: "avoid",
    label: "回避事项",
    icon: Shield,
    placeholder:
      "列出 Agent 应该避免的行为。\n例如：阿谀奉承、浮夸的语言、对显而易见的事情过度解释...",
    description: "Agent 不应该做的事情",
  },
];

function parseSoulToSections(md: string): Record<string, string> {
  const sections: Record<string, string> = {
    identity: "",
    communication: "",
    technical: "",
    avoid: "",
  };

  const patterns: Record<string, RegExp[]> = {
    identity: [/^#+\s*(Personality|Identity|人格|身份|身份与风格)/im],
    communication: [
      /^#+\s*(Communication|Style|风格|沟通|沟通偏好|交流|Comm.*Style)/im,
    ],
    technical: [
      /^#+\s*(Technical|技术|技术姿态|Expertise|专业|分析方法|创意方法)/im,
    ],
    avoid: [
      /^#+\s*(Avoid|回避|回避事项|What.*avoid|Guidelines|规则)/im,
    ],
  };

  const lines = md.split("\n");
  let currentSection = "identity";
  let collecting = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) {
      let matched = false;
      for (const [sectionId, regexps] of Object.entries(patterns)) {
        if (regexps.some((r) => r.test(trimmed))) {
          currentSection = sectionId;
          matched = true;
          collecting = true;
          break;
        }
      }
      if (!matched && collecting) {
        const isKnown = Object.values(patterns)
          .flat()
          .some((r) => r.test(trimmed));
        if (!isKnown) {
          sections[currentSection] += line + "\n";
        }
      }
    } else {
      if (collecting) {
        sections[currentSection] += line + "\n";
      } else {
        sections.identity += line + "\n";
      }
    }
  }

  for (const key of Object.keys(sections)) {
    sections[key] = sections[key].trim();
  }

  return sections;
}

function sectionsToSoul(sections: Record<string, string>): string {
  const parts: string[] = [];

  if (sections.identity?.trim()) {
    parts.push(`# 人格\n${sections.identity.trim()}`);
  }
  if (sections.communication?.trim()) {
    parts.push(`## 风格\n${sections.communication.trim()}`);
  }
  if (sections.technical?.trim()) {
    parts.push(`## 技术姿态\n${sections.technical.trim()}`);
  }
  if (sections.avoid?.trim()) {
    parts.push(`## 回避事项\n${sections.avoid.trim()}`);
  }

  return parts.join("\n\n") + "\n";
}

// ─── Sub Components ────────────────────────────────────────

function TemplateCard({
  template,
  isActive,
  onClick,
}: {
  template: PersonalityTemplate;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative text-left p-4 rounded-xl border transition-all duration-200 ${
        isActive
          ? "border-hermes-500/50 bg-hermes-500/5 ring-1 ring-hermes-500/20"
          : "border-zinc-800 bg-surface-1 hover:border-zinc-600 hover:bg-surface-2/50"
      }`}
    >
      {isActive && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-hermes-400" />
        </div>
      )}
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${template.color} flex items-center justify-center text-xl mb-3`}>
        {template.icon}
      </div>
      <h4 className="text-sm font-medium text-zinc-200 mb-1">{template.name}</h4>
      <p className="text-xs text-zinc-500 mb-2.5 line-clamp-2">
        {template.description}
      </p>
      <div className="flex flex-wrap gap-1">
        {template.traits.map((trait) => (
          <span
            key={trait}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400"
          >
            {trait}
          </span>
        ))}
      </div>
    </button>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
      title="复制"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────

export default function PersonalityEditor({ agentId }: { agentId: string }) {
  const [soulMd, setSoulMd] = useState("");
  const [originalSoul, setOriginalSoul] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"structured" | "raw">("structured");
  const [sections, setSections] = useState<Record<string, string>>({
    identity: "",
    communication: "",
    technical: "",
    avoid: "",
  });
  const [expandedSection, setExpandedSection] = useState<string | null>("identity");
  const [showBuiltins, setShowBuiltins] = useState(false);

  useEffect(() => {
    setLoading(true);
    getAgentSoul(agentId)
      .then((md) => {
        setSoulMd(md);
        setOriginalSoul(md);
        setSections(parseSoulToSections(md));
      })
      .catch(() => setSoulMd(""))
      .finally(() => setLoading(false));
  }, [agentId]);

  const hasChanges = useMemo(() => soulMd !== originalSoul, [soulMd, originalSoul]);

  const activeTemplateId = useMemo(() => {
    const trimmed = soulMd.trim();
    return PERSONALITY_TEMPLATES.find(
      (t) => t.id !== "custom" && t.soulMd.trim() === trimmed
    )?.id;
  }, [soulMd]);

  const handleApplyTemplate = useCallback(
    (template: PersonalityTemplate) => {
      setSoulMd(template.soulMd);
      setSections(parseSoulToSections(template.soulMd));
    },
    []
  );

  const handleSectionChange = useCallback(
    (sectionId: string, value: string) => {
      const updated = { ...sections, [sectionId]: value };
      setSections(updated);
      setSoulMd(sectionsToSoul(updated));
    },
    [sections]
  );

  const handleRawChange = useCallback((value: string) => {
    setSoulMd(value);
    setSections(parseSoulToSections(value));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await updateAgentSoul(agentId, soulMd);
      setOriginalSoul(soulMd);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save SOUL.md:", err);
    } finally {
      setSaving(false);
    }
  }, [agentId, soulMd]);

  const handleReset = useCallback(() => {
    setSoulMd(originalSoul);
    setSections(parseSoulToSections(originalSoul));
  }, [originalSoul]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-hermes-400" />
        <p className="text-sm text-zinc-500">加载人格数据...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Template Gallery */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-hermes-400" />
          <h3 className="text-sm font-medium text-zinc-300">人格模板</h3>
          <span className="text-[10px] text-zinc-600">点击应用到 SOUL.md</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {PERSONALITY_TEMPLATES.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              isActive={activeTemplateId === template.id}
              onClick={() => handleApplyTemplate(template)}
            />
          ))}
        </div>
      </div>

      {/* Section 2: Editor */}
      <div className="bg-surface-1 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-zinc-300">SOUL.md</h3>
            <div className="flex items-center bg-surface-2 rounded-lg p-0.5">
              <button
                onClick={() => setMode("structured")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                  mode === "structured"
                    ? "bg-surface-3 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Lightbulb className="w-3 h-3" />
                结构化
              </button>
              <button
                onClick={() => setMode("raw")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${
                  mode === "raw"
                    ? "bg-surface-3 text-zinc-200"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Code className="w-3 h-3" />
                原始
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                还原
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                saved
                  ? "bg-emerald-500/10 text-emerald-400"
                  : hasChanges
                  ? "bg-hermes-600 hover:bg-hermes-500 text-white"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saved ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              {saved ? "已保存" : "保存"}
            </button>
          </div>
        </div>

        {/* Editor Content */}
        {mode === "structured" ? (
          <div className="divide-y divide-zinc-800/50">
            {SOUL_SECTIONS.map((section) => {
              const isExpanded = expandedSection === section.id;
              const Icon = section.icon;
              const hasContent = !!sections[section.id]?.trim();
              return (
                <div key={section.id}>
                  <button
                    onClick={() =>
                      setExpandedSection(isExpanded ? null : section.id)
                    }
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-surface-2/30 transition-colors"
                  >
                    <Icon className={`w-4 h-4 ${hasContent ? "text-hermes-400" : "text-zinc-600"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-zinc-200">
                        {section.label}
                      </span>
                      <span className="text-xs text-zinc-600 ml-2">
                        {section.description}
                      </span>
                    </div>
                    {hasContent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-hermes-400 shrink-0" />
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-zinc-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-500" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4">
                      <textarea
                        value={sections[section.id] || ""}
                        onChange={(e) =>
                          handleSectionChange(section.id, e.target.value)
                        }
                        placeholder={section.placeholder}
                        rows={6}
                        className="w-full bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 font-mono placeholder:text-zinc-600 focus:outline-none focus:border-hermes-500/50 resize-y"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-5">
            <textarea
              value={soulMd}
              onChange={(e) => handleRawChange(e.target.value)}
              rows={20}
              className="w-full bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 font-mono focus:outline-none focus:border-hermes-500/50 resize-y"
              placeholder="# Personality&#10;&#10;在这里编写你的 SOUL.md..."
            />
          </div>
        )}
      </div>

      {/* Section 3: Live Preview */}
      {soulMd.trim() && (
        <div className="bg-surface-1 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-800">
            <Eye className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-zinc-300">预览</h3>
            <span className="text-[10px] text-zinc-600">
              当前 SOUL.md 将注入 System Prompt Slot #1
            </span>
          </div>
          <div className="px-5 py-4">
            <SoulPreview content={soulMd} />
          </div>
        </div>
      )}

      {/* Section 4: Built-in /personality Commands */}
      <div className="bg-surface-1 border border-zinc-800 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowBuiltins(!showBuiltins)}
          className="w-full flex items-center gap-2 px-5 py-3.5 text-left hover:bg-surface-2/30 transition-colors"
        >
          <Zap className="w-4 h-4 text-amber-400" />
          <div className="flex-1">
            <span className="text-sm font-medium text-zinc-300">
              会话级人格切换
            </span>
            <span className="text-xs text-zinc-600 ml-2">
              14 个内置 /personality 命令，用户可在 IM 中随时使用
            </span>
          </div>
          {showBuiltins ? (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          )}
        </button>

        {showBuiltins && (
          <div className="px-5 pb-5 border-t border-zinc-800/50">
            <p className="text-xs text-zinc-500 mt-3 mb-4">
              这些是 Hermes 内置的临时人格模式。用户在 IM 对话中发送命令即可切换，仅影响当前会话。
              SOUL.md 定义底层身份不受影响。
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {BUILTIN_PERSONALITIES.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-surface-2 border border-zinc-800"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-300 font-mono">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 truncate">
                      {p.description}
                    </p>
                  </div>
                  <CopyButton text={p.command} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Soul Preview ──────────────────────────────────────────

function SoulPreview({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 text-sm">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={i} className="text-base font-bold text-zinc-100 mt-2">
              {trimmed.slice(2)}
            </h2>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={i} className="text-sm font-semibold text-zinc-200 mt-3 mb-1">
              {trimmed.slice(3)}
            </h3>
          );
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={i} className="text-sm font-medium text-zinc-300 mt-2">
              {trimmed.slice(4)}
            </h4>
          );
        }
        if (trimmed.startsWith("- ")) {
          return (
            <div key={i} className="flex gap-2 text-zinc-400 pl-2">
              <span className="text-hermes-400 shrink-0">•</span>
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }
        return (
          <p key={i} className="text-zinc-400">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}
