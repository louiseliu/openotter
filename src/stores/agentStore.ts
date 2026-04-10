import { create } from "zustand";
import type { AgentMeta, GatewayStatus } from "../lib/hermes-bridge";
import {
  listAgents,
  getAllGatewayStatuses,
  startAgentGateway,
  stopAgentGateway,
  deleteAgent as deleteAgentApi,
} from "../lib/hermes-bridge";

interface AgentState {
  agents: AgentMeta[];
  gatewayStatuses: Record<string, GatewayStatus>;
  loading: boolean;

  fetchAgents: () => Promise<void>;
  fetchGatewayStatuses: () => Promise<void>;
  refresh: () => Promise<void>;
  startGateway: (id: string) => Promise<void>;
  stopGateway: (id: string) => Promise<void>;
  removeAgent: (id: string) => Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  gatewayStatuses: {},
  loading: false,

  fetchAgents: async () => {
    set({ loading: true });
    try {
      const agents = await listAgents();
      set({ agents });
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    } finally {
      set({ loading: false });
    }
  },

  fetchGatewayStatuses: async () => {
    try {
      const statuses = await getAllGatewayStatuses();
      const map: Record<string, GatewayStatus> = {};
      for (const s of statuses) {
        map[s.agent_id] = s;
      }
      set({ gatewayStatuses: map });
    } catch (err) {
      console.error("Failed to fetch gateway statuses:", err);
    }
  },

  refresh: async () => {
    await Promise.all([get().fetchAgents(), get().fetchGatewayStatuses()]);
  },

  startGateway: async (id: string) => {
    try {
      const status = await startAgentGateway(id);
      set((state) => ({
        gatewayStatuses: { ...state.gatewayStatuses, [id]: status },
      }));
    } catch (err) {
      console.error("Failed to start gateway:", err);
      throw err;
    }
  },

  stopGateway: async (id: string) => {
    try {
      await stopAgentGateway(id);
      set((state) => {
        const next = { ...state.gatewayStatuses };
        delete next[id];
        return { gatewayStatuses: next };
      });
    } catch (err) {
      console.error("Failed to stop gateway:", err);
      throw err;
    }
  },

  removeAgent: async (id: string) => {
    try {
      await deleteAgentApi(id);
      set((state) => ({
        agents: state.agents.filter((a) => a.id !== id),
      }));
    } catch (err) {
      console.error("Failed to delete agent:", err);
      throw err;
    }
  },
}));
