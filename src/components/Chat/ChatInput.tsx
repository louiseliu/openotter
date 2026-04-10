import { useRef, useCallback } from "react";
import { Send, Square } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const { inputValue, setInputValue, isStreaming } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInputValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [inputValue, disabled, onSend, setInputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div className="border-t border-zinc-800 bg-surface-0 p-4">
      <div className="max-w-4xl mx-auto flex items-end gap-3">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming ? "Hermes is thinking..." : "Message Hermes..."
            }
            disabled={disabled || isStreaming}
            rows={1}
            className="w-full resize-none bg-surface-2 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-hermes-500/50 focus:ring-1 focus:ring-hermes-500/20 transition-colors disabled:opacity-50"
          />
        </div>

        <button
          onClick={isStreaming ? undefined : handleSend}
          disabled={disabled || (!inputValue.trim() && !isStreaming)}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
            isStreaming
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : inputValue.trim()
              ? "bg-hermes-600 text-white hover:bg-hermes-500"
              : "bg-surface-2 text-zinc-500"
          } disabled:opacity-40`}
        >
          {isStreaming ? (
            <Square className="w-4 h-4" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
