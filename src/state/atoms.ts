import { create } from "zustand";
import type { ConnectionState, NotificationEvent, NotificationEventData } from "./types.js";

interface AcpState {
  connectionState: ConnectionState;
  activeSessionId: string | null;
  notifications: Record<string, NotificationEvent[]>;
  setConnectionState: (state: ConnectionState) => void;
  setActiveSessionId: (sessionId: string | null) => void;
  addNotification: (notification: NotificationEventData) => void;
  clearNotifications: (sessionId?: string) => void;
  getActiveNotifications: () => NotificationEvent[];
}

export const useAcpStore = create<AcpState>((set, get) => ({
  connectionState: {
    status: "disconnected",
  },
  activeSessionId: null,
  notifications: {},

  setConnectionState: (connectionState: ConnectionState) => {
    set({ connectionState });
  },

  setActiveSessionId: (sessionId: string | null) => {
    set({ activeSessionId: sessionId });
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

  clearNotifications: (sessionId?: string) => {
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
}));
