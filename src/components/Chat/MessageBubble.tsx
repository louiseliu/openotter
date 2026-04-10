import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, Wrench, Loader2 } from "lucide-react";
import type { Message } from "../../stores/chatStore";

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 ${
          isUser
            ? "bg-hermes-600/20 text-hermes-400"
            : "bg-surface-2 text-zinc-400"
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className={`flex flex-col gap-2 max-w-[80%] min-w-0 ${isUser ? "items-end" : ""}`}>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.toolCalls.map((tc, i) => (
              <span
                key={i}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
                  tc.status === "running"
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : tc.status === "error"
                    ? "bg-red-500/10 text-red-400 border border-red-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {tc.status === "running" ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Wrench className="w-3 h-3" />
                )}
                {tc.name}
              </span>
            ))}
          </div>
        )}

        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-hermes-600 text-white rounded-tr-md"
              : "bg-surface-1 border border-zinc-800 text-zinc-200 rounded-tl-md"
          }`}
        >
          {message.streaming && !message.content ? (
            <div className="flex items-center gap-2 text-zinc-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Thinking...</span>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none [&_pre]:bg-surface-0 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_code]:text-hermes-300 [&_a]:text-hermes-400">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <span className="text-[10px] text-zinc-600 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
