import type {
  AgentCapabilities,
  SessionModeId,
  SessionModeState,
} from "@zed-industries/agent-client-protocol";
import { create } from "zustand";
import type {
  Connection,
  ConnectionState,
  ConnectionUrl,
  NotificationEvent,
  NotificationEventData,
  SessionId,
} from "./types.js";

interface AcpState {
  // Multi-connection support
  connections: Record<ConnectionUrl, Connection>;
  activeConnectionUrl: ConnectionUrl | null;

  // Legacy single-connection interface (for backward compatibility)
  connectionState: ConnectionState;
  agentCapabilities: AgentCapabilities | null;

  // Session management
  activeSessionId: SessionId | null;
  notifications: Record<SessionId, NotificationEvent[]>;
  sessionModes: Record<SessionId, SessionModeState | null | undefined>;

  // Connection management
  setConnection: (
    url: ConnectionUrl,
    state: ConnectionState,
    capabilities?: AgentCapabilities | null,
  ) => void;
  setActiveConnection: (url: ConnectionUrl | null) => void;
  removeConnection: (url: ConnectionUrl) => void;

  // Legacy methods (for backward compatibility)
  setConnectionState: (state: ConnectionState) => void;
  setAgentCapabilities: (capabilities: AgentCapabilities | null) => void;

  // Session methods
  setActiveSessionId: (sessionId: SessionId | null) => void;
  setActiveModeId: (sessionId: SessionId, modeId: SessionModeId | null | undefined) => void;
  setModeState: (sessionId: SessionId, modeState: SessionModeState | null | undefined) => void;
  addNotification: (notification: NotificationEventData) => void;
  clearNotifications: (sessionId?: SessionId) => void;
  getActiveNotifications: () => NotificationEvent[];

  // Getters
  getActiveConnection: () => Connection | null;
  getConnection: (url: ConnectionUrl) => Connection;
}

export const useAcpStore = create<AcpState>((set, get) => ({
  // Multi-connection state
  connections: {},
  activeConnectionUrl: null,

  // Legacy state
  connectionState: { status: "disconnected" },
  agentCapabilities: null,

  // Session state
  activeSessionId: null,
  notifications: {},
  sessionModes: {},

  // Connection management
  setConnection: (
    url: ConnectionUrl,
    state: ConnectionState,
    capabilities?: AgentCapabilities | null,
  ) => {
    set((prev) => ({
      connections: {
        ...prev.connections,
        [url]: {
          url,
          state,
          capabilities: capabilities ?? prev.connections[url]?.capabilities ?? null,
        },
      },
      // Update legacy state if this is the active connection
      ...(prev.activeConnectionUrl === url && {
        connectionState: state,
        agentCapabilities: capabilities ?? prev.connections[url]?.capabilities ?? null,
      }),
    }));
  },

  setActiveConnection: (url: ConnectionUrl | null) => {
    set((prev) => {
      const activeConnection = url ? prev.connections[url] : null;
      return {
        activeConnectionUrl: url,
        connectionState: activeConnection?.state ?? { status: "disconnected" },
        agentCapabilities: activeConnection?.capabilities ?? null,
      };
    });
  },

  removeConnection: (url: ConnectionUrl) => {
    set((prev) => {
      const newConnections = { ...prev.connections };
      delete newConnections[url];
      const newActiveUrl = prev.activeConnectionUrl === url ? null : prev.activeConnectionUrl;
      const activeConnection = newActiveUrl ? newConnections[newActiveUrl] : null;
      return {
        connections: newConnections,
        activeConnectionUrl: newActiveUrl,
        connectionState: activeConnection?.state ?? { status: "disconnected" },
        agentCapabilities: activeConnection?.capabilities ?? null,
      };
    });
  },

  // Legacy methods (for backward compatibility)
  setConnectionState: (connectionState: ConnectionState) => {
    set({ connectionState });
    const { activeConnectionUrl } = get();
    if (activeConnectionUrl) {
      get().setConnection(activeConnectionUrl, connectionState);
    }
  },

  setAgentCapabilities: (agentCapabilities: AgentCapabilities | null) => {
    set({ agentCapabilities });
    const { activeConnectionUrl } = get();
    if (activeConnectionUrl) {
      get().setConnection(activeConnectionUrl, get().connectionState, agentCapabilities);
    }
  },

  setActiveSessionId: (sessionId: SessionId | null) => {
    set({ activeSessionId: sessionId });
  },

  setActiveModeId: (sessionId: SessionId, modeId: SessionModeId | null | undefined) => {
    set((prev) => {
      const prevMode = prev.sessionModes[sessionId];
      return {
        sessionModes: {
          ...prev.sessionModes,
          [sessionId]: { ...prevMode, currentModeId: modeId },
        },
      };
    });
  },

  setModeState: (sessionId: SessionId, modeState: SessionModeState | null | undefined) => {
    set((prev) => {
      return {
        sessionModes: { ...prev.sessionModes, [sessionId]: modeState },
      };
    });
  },

  addNotification: (notification: NotificationEventData) => {
    const current = get().notifications;
    const sessionId = get().activeSessionId;
    if (!sessionId) {
      return;
    }
    const newNotification: NotificationEvent = {
      ...notification,
      id: `${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
    };

    const sessionNotifications = current[sessionId] || [];
    const updated = {
      ...current,
      [sessionId]: [...sessionNotifications, newNotification],
    };
    set({ notifications: updated });
  },

  clearNotifications: (sessionId?: SessionId) => {
    if (sessionId) {
      const current = get().notifications;
      const updated = { ...current };
      delete updated[sessionId];
      set({ notifications: updated });
    } else {
      set({ notifications: {} });
    }
  },

  getActiveNotifications: () => {
    const { activeSessionId, notifications } = get();
    return activeSessionId ? notifications[activeSessionId] || [] : [];
  },

  // Getters
  getActiveConnection: () => {
    const { activeConnectionUrl, connections } = get();
    return activeConnectionUrl ? connections[activeConnectionUrl] || null : null;
  },

  getConnection: (url: string) => {
    const { connections } = get();
    return connections[url] || { url, state: { status: "disconnected" }, capabilities: null };
  },
}));
