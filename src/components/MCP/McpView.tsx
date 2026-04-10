import { useEffect, useState } from "react";
import {
  Plug,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Wrench,
} from "lucide-react";
import { listMcpServers, type McpServerInfo } from "../../lib/hermes-bridge";

export default function McpView() {
  const [servers, setServers] = useState<McpServerInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const list = await listMcpServers();
      setServers(list);
    } catch (err) {
      console.error("Failed to load MCP servers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto py-10 px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100">MCP Servers</h1>
            <p className="text-base text-zinc-500 mt-1">
              Model Context Protocol — 连接外部工具与服务
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-300 disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            刷新
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-20 bg-surface-1 border border-zinc-800 rounded-xl">
            <Plug className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
            <p className="text-zinc-400 mb-1">暂无 MCP Server</p>
            <p className="text-xs text-zinc-600">
              通过 <code className="text-zinc-500">hermes mcp add</code> 添加新服务
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {servers.map((s) => (
              <div
                key={s.name}
                className="bg-surface-1 border border-zinc-800 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Plug className="w-4 h-4 text-hermes-400" />
                    <span className="font-medium text-zinc-200 text-sm">
                      {s.name}
                    </span>
                  </div>
                  {s.status === "connected" || s.status === "active" ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-zinc-600" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 rounded">
                    {s.transport}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Wrench className="w-3 h-3" />
                    {s.tools_count} 工具
                  </span>
                  <span
                    className={`${
                      s.status === "connected" || s.status === "active"
                        ? "text-emerald-500"
                        : "text-zinc-600"
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Guide */}
        <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <div className="text-xs text-zinc-500 space-y-2">
            <p className="text-zinc-400 font-medium">MCP 管理命令</p>
            <ul className="space-y-1 ml-2">
              <li>
                <code className="text-zinc-400">hermes mcp add &lt;name&gt; --stdio "cmd"</code>
                {" "}— 添加 stdio 类型
              </li>
              <li>
                <code className="text-zinc-400">hermes mcp add &lt;name&gt; --sse "url"</code>
                {" "}— 添加 SSE 类型
              </li>
              <li>
                <code className="text-zinc-400">hermes mcp remove &lt;name&gt;</code>
                {" "}— 移除
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
