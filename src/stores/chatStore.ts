import { create } from "zustand";

export interface ToolCall {
  name: string;
  status: "running" | "done" | "error";
  output_preview?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  streaming?: boolean;
}

interface ChatState {
  messages: Message[];
  conversationId: string | null;
  isStreaming: boolean;
  inputValue: string;
  activeAgentId: string | null;

  addMessage: (msg: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setConversationId: (id: string) => void;
  setStreaming: (streaming: boolean) => void;
  setInputValue: (value: string) => void;
  setActiveAgentId: (id: string | null) => void;
  clearMessages: () => void;
}

let msgCounter = 0;
export function generateId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  conversationId: null,
  isStreaming: false,
  inputValue: "",
  activeAgentId: null,

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),

  setConversationId: (id) => set({ conversationId: id }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  setInputValue: (value) => set({ inputValue: value }),
  setActiveAgentId: (id) => set({ activeAgentId: id, messages: [], conversationId: null }),
  clearMessages: () => set({ messages: [], conversationId: null }),
}));
