import type { SessionNotification } from "@zed-industries/agent-client-protocol";

export interface ConnectionState {
  status: "disconnected" | "connecting" | "connected" | "error";
  error?: string;
  url?: string;
}

export type NotificationEventData =
  | {
      type: "session_notification";
      data: SessionNotification;
    }
  | {
      type: "connection_change";
      data: ConnectionState;
    }
  | {
      type: "error";
      data: Error;
    };

export type NotificationEvent = {
  id: string;
  timestamp: number;
} & NotificationEventData;
