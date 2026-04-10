import { useEffect, useState } from "react";
import {
  Sparkles,
  Search,
  ExternalLink,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Download,
} from "lucide-react";
import {
  listSkills,
  getSkillContent,
  type SkillInfo,
} from "../../lib/hermes-bridge";

export default function SkillsView() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [skillContent, setSkillContent] = useState<Record<string, string>>({});
  const [loadingContent, setLoadingContent] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listSkills();
      setSkills(list);
    } catch (err) {
      console.error("Failed to load skills:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggle = async (name: string) => {
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
  };

  const filtered = skills.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase())
  );

  const builtinSkills = filtered.filter(
    (s) => s.source === "builtin" || s.source === "built-in"
  );
  const userSkills = filtered.filter(
    (s) => s.source !== "builtin" && s.source !== "built-in"
  );

  const sourceLabel = (source: string) => {
    switch (source) {
      case "builtin":
      case "built-in":
        return { text: "内置", cls: "bg-emerald-500/10 text-emerald-400" };
      case "user":
        return { text: "自定义", cls: "bg-blue-500/10 text-blue-400" };
      case "hub":
        return { text: "Hub", cls: "bg-purple-500/10 text-purple-400" };
      default:
        return { text: source, cls: "bg-zinc-800 text-zinc-500" };
    }
  };

  const SkillCard = ({ skill }: { skill: SkillInfo }) => {
    const expanded = expandedSkill === skill.name;
    const badge = sourceLabel(skill.source);

    return (
      <div className="bg-surface-1 border border-zinc-800 rounded-xl overflow-hidden">
        <button
          onClick={() => handleToggle(skill.name)}
          className="w-full text-left p-4 flex items-start gap-3 hover:bg-zinc-800/30 transition-colors"
        >
          <div className="w-9 h-9 rounded-lg bg-hermes-500/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-hermes-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-zinc-200">
                {skill.name}
              </h3>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${badge.cls}`}
              >
                {badge.text}
              </span>
              {skill.category && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                  {skill.category}
                </span>
              )}
            </div>
            {skill.path && (
              <p className="text-[10px] text-zinc-600 mt-0.5 truncate flex items-center gap-1">
                <FolderOpen className="w-3 h-3" />
                {skill.path}
              </p>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0 mt-1" />
          ) : (
            <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0 mt-1" />
          )}
        </button>
        {expanded && (
          <div className="border-t border-zinc-800 p-4">
            {loadingContent === skill.name ? (
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                加载中...
              </div>
            ) : (
              <pre className="text-xs text-zinc-400 whitespace-pre-wrap max-h-64 overflow-y-auto font-mono leading-relaxed">
                {skillContent[skill.name] || "无内容"}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">技能管理</h1>
            <p className="text-base text-zinc-500 mt-1">
              Hermes 的自适应技能系统 — {skills.length} 个技能
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 disabled:opacity-40"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              刷新
            </button>
            <a
              href="https://skills.sh"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-hermes-400 hover:text-hermes-300"
            >
              Skills Hub <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索技能..."
            className="w-full bg-surface-1 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : (
          <>
            {/* Built-in Skills */}
            {builtinSkills.length > 0 && (
              <section className="mb-8">
                <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  内置技能 ({builtinSkills.length})
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {builtinSkills.map((skill) => (
                    <SkillCard key={skill.name} skill={skill} />
                  ))}
                </div>
              </section>
            )}

            {/* User & Hub Skills */}
            {userSkills.length > 0 && (
              <section className="mb-8">
                <h2 className="text-base font-semibold text-zinc-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4" />
                  自定义与社区技能 ({userSkills.length})
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {userSkills.map((skill) => (
                    <SkillCard key={skill.name} skill={skill} />
                  ))}
                </div>
              </section>
            )}

            {/* Empty State */}
            {filtered.length === 0 && (
              <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
                {search ? (
                  <>
                    <Search className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-400">
                      未找到匹配「{search}」的技能
                    </p>
                  </>
                ) : (
                  <>
                    <Download className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-400">暂无技能</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      访问 Skills Hub 或使用{" "}
                      <code className="text-zinc-500">hermes skills install</code>{" "}
                      安装技能
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
