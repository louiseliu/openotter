import { useRef, useEffect, useCallback } from "react";
import { AlertCircle, ChevronDown, Bot } from "lucide-react";
import { useChatStore, generateId } from "../../stores/chatStore";
import { useAppStore } from "../../stores/appStore";
import { useAgentStore } from "../../stores/agentStore";
import {
  sendChatMessage,
  sendChatMessageStreaming,
} from "../../lib/hermes-bridge";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";

export default function ChatView() {
  const {
    messages,
    conversationId,
    activeAgentId,
    addMessage,
    updateMessage,
    setConversationId,
    setStreaming,
    setActiveAgentId,
  } = useChatStore();
  const { appStatus } = useAppStore();
  const { agents } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (agents.length > 0) {
      useAgentStore.getState().fetchAgents();
    }
  }, []);

  const activeAgent = agents.find((a) => a.id === activeAgentId);

  const handleSend = useCallback(
    async (content: string) => {
      const userMsg = {
        id: generateId(),
        role: "user" as const,
        content,
        timestamp: Date.now(),
      };
      addMessage(userMsg);

      const assistantId = generateId();
      addMessage({
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        streaming: true,
      });
      setStreaming(true);

      const sidecarReady = appStatus?.sidecar_running && appStatus?.sidecar_port;

      if (sidecarReady) {
        try {
          await sendChatMessageStreaming(
            content,
            (text) => {
              updateMessage(assistantId, { content: text, streaming: true });
            },
            (fullText) => {
              if (!fullText.trim()) {
                handleNonStreaming(content, assistantId);
              } else {
                updateMessage(assistantId, {
                  content: fullText,
                  streaming: false,
                });
                setStreaming(false);
              }
            },
            (_error) => {
              handleNonStreaming(content, assistantId);
            },
            conversationId
          );
        } catch {
          handleNonStreaming(content, assistantId);
        }
      } else {
        handleNonStreaming(content, assistantId);
      }
    },
    [
      conversationId,
      appStatus,
      addMessage,
      updateMessage,
      setConversationId,
      setStreaming,
    ]
  );

  const handleNonStreaming = useCallback(
    async (content: string, assistantId: string) => {
      try {
        const resp = await sendChatMessage(content, conversationId);
        updateMessage(assistantId, {
          content: resp.content,
          streaming: false,
          toolCalls: resp.tool_calls.map((tc) => ({
            name: tc.name,
            status: tc.status as "running" | "done" | "error",
            output_preview: tc.output_preview ?? undefined,
          })),
        });
        if (resp.conversation_id) {
          setConversationId(resp.conversation_id);
        }
      } catch (err) {
        updateMessage(assistantId, {
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          streaming: false,
        });
      } finally {
        setStreaming(false);
      }
    },
    [conversationId, updateMessage, setConversationId, setStreaming]
  );

  const sidecarReady = appStatus?.sidecar_running;

  return (
    <div className="flex flex-col h-full">
      {/* Agent Selector Header */}
      <div className="border-b border-zinc-800 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative">
            <select
              value={activeAgentId || "default"}
              onChange={(e) => {
                const val = e.target.value;
                setActiveAgentId(val === "default" ? null : val);
              }}
              className="appearance-none bg-surface-1 border border-zinc-700 rounded-lg pl-8 pr-8 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-hermes-500/50 cursor-pointer"
            >
              <option value="default">默认 Agent</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.avatar} {a.name}
                </option>
              ))}
            </select>
            <Bot className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          </div>

          {activeAgent && (
            <span className="text-xs text-zinc-500">
              {activeAgent.model}
            </span>
          )}
        </div>

        {activeAgent && (
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                useAgentStore.getState().gatewayStatuses[activeAgent.id]?.running
                  ? "bg-emerald-500"
                  : "bg-zinc-600"
              }`}
            />
            {useAgentStore.getState().gatewayStatuses[activeAgent.id]?.running
              ? "在线"
              : "离线"}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState agentName={activeAgent?.name} agentAvatar={activeAgent?.avatar} />
        ) : (
          <div className="max-w-4xl mx-auto py-8 px-6 flex flex-col gap-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {!sidecarReady && (
        <div className="px-4 pb-2">
          <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              Hermes API Server 未运行。请先在设置中配置 API Key，或在 Agent 详情页启动 Gateway。
            </span>
          </div>
        </div>
      )}

      <ChatInput onSend={handleSend} disabled={false} />
    </div>
  );
}

function EmptyState({ agentName, agentAvatar }: { agentName?: string; agentAvatar?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-hermes-500/20 overflow-hidden">
        {agentAvatar ? (
          <div className="w-full h-full bg-gradient-to-br from-hermes-500 to-hermes-700 flex items-center justify-center">
            <span className="text-2xl">{agentAvatar}</span>
          </div>
        ) : (
          <img
            src="/logo.png"
            alt="OpenOtter"
            className="w-full h-full object-cover"
            draggable={false}
          />
        )}
      </div>
      <h2 className="text-xl font-semibold text-zinc-100 mb-2">
        {agentName ? `与 ${agentName} 对话` : "与 Agent 对话"}
      </h2>
      <p className="text-sm text-zinc-400 max-w-md leading-relaxed">
        {agentName
          ? `选择了 ${agentName}，开始对话吧。`
          : "Hermes Agent 是一个自我进化的 AI 助手。你可以问任何问题、分配任务、或让它帮你写代码。"}
      </p>
      <div className="mt-8 grid grid-cols-2 gap-3 max-w-sm w-full">
        {[
          "帮我写一个 Python 脚本",
          "解释量子计算",
          "创建一个 Todo 应用",
          "总结一篇论文",
        ].map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => useChatStore.getState().setInputValue(suggestion)}
            className="text-left text-xs text-zinc-400 bg-surface-2 hover:bg-surface-3 border border-zinc-800 rounded-xl px-3 py-2.5 transition-colors hover:text-zinc-300"
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}
