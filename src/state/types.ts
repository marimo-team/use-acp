import type {
  AgentCapabilities,
  SessionNotification,
} from "@zed-industries/agent-client-protocol/typescript/acp.js";

export type AgentId = string & { __brand: "AgentId" };
export type SessionId = string & { __brand: "SessionId" };
export type ConnectionUrl = string;

export interface ConnectionState {
  status: "disconnected" | "connecting" | "connected" | "error";
  error?: string;
  url?: string;
}

export interface Connection {
  url: string;
  state: ConnectionState;
  capabilities: AgentCapabilities | null;
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
