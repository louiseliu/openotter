import { useEffect, useState, useRef, useCallback } from "react";
import {
  Brain,
  Database,
  MessageSquare,
  RefreshCw,
  BarChart3,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Clock,
  Terminal,
  Globe,
  Hash,
  Trash2,
  ChevronDown,
  X,
  Wrench,
} from "lucide-react";
import {
  getSessionStats,
  type SessionStats,
} from "../../lib/hermes-bridge";
import * as api from "../../lib/hermes-api";
import type {
  SessionInfo,
  SessionMessage,
  SessionSearchResult,
} from "../../lib/hermes-api";

const SOURCE_CONFIG: Record<string, { icon: typeof Terminal; color: string }> = {
  cli: { icon: Terminal, color: "text-hermes-400" },
  telegram: { icon: MessageSquare, color: "text-blue-400" },
  discord: { icon: Hash, color: "text-indigo-400" },
  slack: { icon: MessageSquare, color: "text-emerald-400" },
  whatsapp: { icon: Globe, color: "text-green-400" },
  cron: { icon: Clock, color: "text-amber-400" },
  feishu: { icon: MessageSquare, color: "text-blue-400" },
  dingtalk: { icon: MessageSquare, color: "text-blue-400" },
  wecom: { icon: MessageSquare, color: "text-green-400" },
};

const PAGE_SIZE = 20;

export default function MemoryView() {
  const [stats, setStats] = useState<SessionStats | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [webReady, setWebReady] = useState(false);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SessionSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const initAndLoad = useCallback(async () => {
    setLoading(true);
    try {
      const statsPromise = getSessionStats().catch(() => null);
      const webInfo = await api.initWebServer();
      setWebReady(webInfo.running);

      if (webInfo.running) {
        const paginated = await api.getSessions(PAGE_SIZE, 0);
        setSessions(paginated.sessions);
        setTotal(paginated.total);
      }

      const s = await statsPromise;
      if (s) setStats(s);
    } catch (err) {
      console.error("Failed to init memory view:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initAndLoad();
  }, [initAndLoad]);

  const loadPage = useCallback(async (p: number) => {
    if (!webReady) return;
    setLoading(true);
    try {
      const paginated = await api.getSessions(PAGE_SIZE, p * PAGE_SIZE);
      setSessions(paginated.sessions);
      setTotal(paginated.total);
    } catch (err) {
      console.error("Failed to load sessions page:", err);
    } finally {
      setLoading(false);
    }
  }, [webReady]);

  useEffect(() => {
    if (page > 0) loadPage(page);
  }, [page, loadPage]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await api.searchSessions(search.trim());
        setSearchResults(resp.results);
      } catch {
        setSearchResults(null);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const handleDelete = async (id: string) => {
    try {
      await api.deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setTotal((prev) => prev - 1);
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error("Failed to delete session:", err);
    }
  };

  const snippetMap = new Map<string, string>();
  if (searchResults) {
    for (const r of searchResults) {
      snippetMap.set(r.session_id, r.snippet);
    }
  }

  const filtered = searchResults
    ? sessions.filter((s) => snippetMap.has(s.id))
    : sessions;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">记忆系统</h1>
            <p className="text-base text-zinc-500 mt-1">
              完整的会话历史 · 消息详情 · 全文搜索
            </p>
          </div>
          <button
            onClick={initAndLoad}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={<MessageSquare className="w-5 h-5 text-blue-400" />}
              label="总会话"
              value={String(stats.total_sessions ?? total)}
            />
            <StatCard
              icon={<BarChart3 className="w-5 h-5 text-hermes-400" />}
              label="总消息"
              value={String(stats.total_messages ?? 0)}
            />
            <StatCard
              icon={<Database className="w-5 h-5 text-emerald-400" />}
              label="数据库"
              value={`${stats.db_size_mb?.toFixed(1) ?? "0"} MB`}
            />
            <StatCard
              icon={<Brain className="w-5 h-5 text-purple-400" />}
              label="平台数"
              value={String(stats.platforms?.length ?? 0)}
            />
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          {searching ? (
            <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-hermes-400 animate-spin" />
          ) : (
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索会话内容 (FTS5 全文检索)..."
            className="w-full pl-10 pr-8 py-2.5 bg-surface-1 border border-zinc-800 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-hermes-500/50"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {!webReady && !loading && (
          <div className="text-center py-12 bg-surface-1 border border-zinc-800 rounded-xl mb-6">
            <Globe className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400 mb-1">Hermes Web Server 未就绪</p>
            <p className="text-xs text-zinc-600">正在连接或启动中...</p>
          </div>
        )}

        {/* Session List */}
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-surface-1 border border-zinc-800 rounded-xl">
            <Clock className="w-8 h-8 text-zinc-600 mx-auto mb-3 opacity-40" />
            <p className="text-sm text-zinc-400">
              {search ? "没有匹配的会话" : "暂无会话记录"}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {filtered.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  snippet={snippetMap.get(s.id)}
                  searchQuery={search || undefined}
                  isExpanded={expandedId === s.id}
                  onToggle={() =>
                    setExpandedId((prev) => (prev === s.id ? null : s.id))
                  }
                  onDelete={() => handleDelete(s.id)}
                />
              ))}
            </div>

            {!searchResults && total > PAGE_SIZE && (
              <div className="flex items-center justify-between pt-5">
                <span className="text-xs text-zinc-500">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-zinc-500 px-2">
                    第 {page + 1} / {Math.ceil(total / PAGE_SIZE)} 页
                  </span>
                  <button
                    disabled={(page + 1) * PAGE_SIZE >= total}
                    onClick={() => setPage((p) => p + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 disabled:opacity-30"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-1 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-xl font-bold text-zinc-100">{value}</p>
    </div>
  );
}

function timeAgo(ts: number): string {
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(ts * 1000).toLocaleDateString("zh-CN");
}

function SnippetHighlight({ snippet }: { snippet: string }) {
  const parts: React.ReactNode[] = [];
  const regex = />>>(.*?)<<</g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = regex.exec(snippet)) !== null) {
    if (match.index > last) parts.push(snippet.slice(last, match.index));
    parts.push(
      <mark key={i++} className="bg-amber-500/30 text-amber-300 px-0.5 rounded">
        {match[1]}
      </mark>
    );
    last = regex.lastIndex;
  }
  if (last < snippet.length) parts.push(snippet.slice(last));
  return (
    <p className="text-xs text-zinc-500 truncate max-w-lg mt-0.5">{parts}</p>
  );
}

function SessionRow({
  session,
  snippet,
  searchQuery,
  isExpanded,
  onToggle,
  onDelete,
}: {
  session: SessionInfo;
  snippet?: string;
  searchQuery?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [messages, setMessages] = useState<SessionMessage[] | null>(null);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isExpanded && messages === null && !loadingMsgs) {
      setLoadingMsgs(true);
      api
        .getSessionMessages(session.id)
        .then((resp) => setMessages(resp.messages))
        .catch((err) => setError(String(err)))
        .finally(() => setLoadingMsgs(false));
    }
  }, [isExpanded, session.id, messages, loadingMsgs]);

  const sourceInfo = session.source
    ? SOURCE_CONFIG[session.source] ?? { icon: Globe, color: "text-zinc-500" }
    : { icon: Globe, color: "text-zinc-500" };
  const SourceIcon = sourceInfo.icon;
  const hasTitle = session.title && session.title !== "Untitled";

  return (
    <div
      className={`bg-surface-1 border rounded-xl overflow-hidden transition-colors ${
        session.is_active
          ? "border-emerald-500/30"
          : "border-zinc-800"
      }`}
    >
      {/* Row Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-surface-2/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`shrink-0 ${sourceInfo.color}`}>
            <SourceIcon className="w-4 h-4" />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-sm truncate pr-2 ${
                  hasTitle ? "font-medium text-zinc-200" : "text-zinc-400 italic"
                }`}
              >
                {hasTitle
                  ? session.title
                  : session.preview
                    ? session.preview.slice(0, 60)
                    : "无标题会话"}
              </span>
              {session.is_active && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/30 text-emerald-400 shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  活跃
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="truncate max-w-[140px]">
                {(session.model ?? "unknown").split("/").pop()}
              </span>
              <span className="text-zinc-700">·</span>
              <span>{session.message_count} 条</span>
              {session.tool_call_count > 0 && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="flex items-center gap-0.5">
                    <Wrench className="w-3 h-3" />
                    {session.tool_call_count}
                  </span>
                </>
              )}
              <span className="text-zinc-700">·</span>
              <span>{timeAgo(session.last_active)}</span>
            </div>
            {snippet && <SnippetHighlight snippet={snippet} />}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
            {session.source ?? "local"}
          </span>
          <button
            className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="删除会话"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <ChevronDown
            className={`w-4 h-4 text-zinc-500 transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Expanded Messages */}
      {isExpanded && (
        <div className="border-t border-zinc-800 bg-zinc-900/40 p-4">
          {loadingMsgs && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          )}
          {error && (
            <p className="text-sm text-red-400 py-4 text-center">{error}</p>
          )}
          {messages && messages.length === 0 && (
            <p className="text-sm text-zinc-500 py-4 text-center">
              该会话无消息
            </p>
          )}
          {messages && messages.length > 0 && (
            <MessageList messages={messages} highlight={searchQuery} />
          )}
        </div>
      )}
    </div>
  );
}

function MessageList({
  messages,
  highlight,
}: {
  messages: SessionMessage[];
  highlight?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!highlight || !containerRef.current) return;
    const timer = setTimeout(() => {
      const hit = containerRef.current?.querySelector("[data-search-hit]");
      if (hit) hit.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return () => clearTimeout(timer);
  }, [messages, highlight]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-1"
    >
      {messages.map((msg, i) => (
        <MessageBubbleInline key={i} msg={msg} highlight={highlight} />
      ))}
    </div>
  );
}

function MessageBubbleInline({
  msg,
  highlight,
}: {
  msg: SessionMessage;
  highlight?: string;
}) {
  const ROLE_STYLES: Record<
    string,
    { bg: string; text: string; label: string }
  > = {
    user: { bg: "bg-blue-500/10", text: "text-blue-400", label: "用户" },
    assistant: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      label: "助手",
    },
    system: {
      bg: "bg-zinc-800",
      text: "text-zinc-400",
      label: "系统",
    },
    tool: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      label: "工具",
    },
  };

  const style = ROLE_STYLES[msg.role] ?? ROLE_STYLES.system;
  const label = msg.tool_name ? `工具: ${msg.tool_name}` : style.label;

  const isHit = (() => {
    if (!highlight || !msg.content) return false;
    const content = msg.content.toLowerCase();
    const terms = highlight.toLowerCase().split(/\s+/).filter(Boolean);
    return terms.some((t) => content.includes(t));
  })();

  const [showTool, setShowTool] = useState(false);

  return (
    <div
      className={`${style.bg} rounded-lg p-3 ${
        isHit ? "ring-1 ring-amber-500/40" : ""
      }`}
      data-search-hit={isHit || undefined}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-semibold ${style.text}`}>{label}</span>
        {isHit && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
            匹配
          </span>
        )}
        {msg.timestamp && (
          <span className="text-[10px] text-zinc-600">
            {timeAgo(msg.timestamp)}
          </span>
        )}
      </div>
      {msg.content && (
        <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed wrap-break-word">
          {msg.content.length > 2000
            ? msg.content.slice(0, 2000) + "..."
            : msg.content}
        </div>
      )}
      {msg.tool_calls && msg.tool_calls.length > 0 && (
        <div className="mt-2 space-y-1">
          {msg.tool_calls.map((tc) => (
            <div
              key={tc.id}
              className="border border-amber-500/20 rounded-lg overflow-hidden"
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-amber-400 cursor-pointer hover:bg-amber-500/10 transition-colors"
                onClick={() => setShowTool(!showTool)}
              >
                <ChevronDown
                  className={`w-3 h-3 transition-transform ${
                    showTool ? "rotate-180" : ""
                  }`}
                />
                <span className="font-mono font-medium">
                  {tc.function.name}
                </span>
              </button>
              {showTool && (
                <pre className="border-t border-amber-500/20 px-3 py-2 text-xs text-amber-400/70 overflow-x-auto whitespace-pre-wrap font-mono max-h-40">
                  {(() => {
                    try {
                      return JSON.stringify(
                        JSON.parse(tc.function.arguments),
                        null,
                        2
                      );
                    } catch {
                      return tc.function.arguments;
                    }
                  })()}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
