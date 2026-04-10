import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, MessageSquare, Clock } from "lucide-react";
import { searchSessions, type SearchResult } from "../../lib/hermes-bridge";

interface SessionSearchProps {
  onSelectSession?: (sessionId: string) => void;
}

export default function SessionSearch({ onSelectSession }: SessionSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await searchSessions(q, 15);
      setResults(res);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value);
      setOpen(true);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch]
  );

  const handleSelect = useCallback(
    (sessionId: string) => {
      setOpen(false);
      setQuery("");
      setResults([]);
      onSelectSession?.(sessionId);
    },
    [onSelectSession]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  function formatTime(ts: number): string {
    const d = new Date(ts * 1000);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) {
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    if (diff < 604800000) {
      return d.toLocaleDateString("zh-CN", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  }

  function highlightSnippet(snippet: string): React.ReactNode {
    const parts = snippet.split(/<<|>>/);
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <mark key={i} className="bg-hermes-500/30 text-hermes-300 rounded px-0.5">
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="搜索会话... ⌘K"
          className="w-full pl-10 pr-10 py-2.5 bg-surface-1 border border-zinc-700/50 rounded-xl text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50 focus:ring-1 focus:ring-hermes-500/20 transition-colors"
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              setOpen(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (query || results.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-surface-1 border border-zinc-700/50 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-sm text-zinc-500">搜索中...</div>
          )}
          {!loading && results.length === 0 && query.trim() && (
            <div className="px-4 py-3 text-sm text-zinc-500">
              未找到匹配的会话
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.session_id}
              onClick={() => handleSelect(r.session_id)}
              className="w-full px-4 py-3 text-left hover:bg-surface-2 transition-colors border-b border-zinc-800/50 last:border-0"
            >
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-3.5 h-3.5 text-hermes-400 shrink-0" />
                <span className="text-sm font-medium text-zinc-200 truncate">
                  {r.title || "未命名会话"}
                </span>
                <span className="ml-auto flex items-center gap-1 text-[11px] text-zinc-500 shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatTime(r.started_at)}
                </span>
              </div>
              {r.snippet && (
                <p className="text-xs text-zinc-400 line-clamp-2 pl-5.5">
                  {highlightSnippet(r.snippet)}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1 pl-5.5">
                <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-500">
                  {r.source || "desktop"}
                </span>
                {r.model && (
                  <span className="text-[10px] text-zinc-600">{r.model}</span>
                )}
                <span className="text-[10px] text-zinc-600">
                  {r.message_count} 条消息
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
