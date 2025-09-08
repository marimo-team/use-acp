import {
  type Agent,
  ClientSideConnection,
  type RequestPermissionResponse,
  type SessionNotification,
} from "@zed-industries/agent-client-protocol";
import { useEffect, useRef, useState } from "react";
import {
  AcpClient,
  type IdentifiedPermissionRequest,
  ListeningAgent,
} from "../client/acp-client.js";
import { WebSocketManager } from "../connection/websocket-manager.js";
import { useAcpStore } from "../state/atoms.js";
import type { ConnectionState, NotificationEvent } from "../state/types.js";
import { useEventCallback } from "./use-event-callback.js";

export interface UseAcpClientOptions {
  // Connection management
  wsUrl: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;

  // Defaults
  initialSessionId?: string | null;
}

export interface UseAcpClientReturn {
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => void;
  connectionState: ConnectionState;

  // State management
  notifications: NotificationEvent[];
  clearNotifications: () => void;

  // Permission handling
  pendingPermission: IdentifiedPermissionRequest | null;
  resolvePermission: (response: RequestPermissionResponse) => void;
  rejectPermission: (error: Error) => void;

  // ACP connection
  agent: Agent | null;
}

export function useAcpClient(options: UseAcpClientOptions): UseAcpClientReturn {
  const {
    connectionState,
    notifications,
    activeSessionId,
    setActiveSessionId,
    setConnectionState,
    addNotification,
    clearNotifications,
  } = useAcpStore();

  // State
  const [pendingPermission, setPendingPermission] = useState<IdentifiedPermissionRequest | null>(
    null,
  );
  const [agent, setAgent] = useState<Agent | null>(null);

  // Refs
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  const acpClientRef = useRef<AcpClient | null>(null);

  // Handlers
  const handleConnectionStateChange = useEventCallback((state: ConnectionState) => {
    setConnectionState(state);
    addNotification({
      type: "connection_change",
      data: state,
    });
  });

  const handleError = useEventCallback((error: Error) => {
    addNotification({
      type: "error",
      data: error,
    });
  });

  const handleSessionNotification = useEventCallback((notification: SessionNotification) => {
    addNotification({
      type: "session_notification",
      data: notification,
    });
  });

  const handleRequestPermission = useEventCallback((params: IdentifiedPermissionRequest) => {
    setPendingPermission(params);
  });

  const connect = useEventCallback(async () => {
    if (
      wsManagerRef.current ||
      connectionState.status === "connecting" ||
      connectionState.status === "connected"
    ) {
      return;
    }

    const wsManager = new WebSocketManager({
      url: options.wsUrl,
      onConnectionStateChange: handleConnectionStateChange,
      onError: handleError,
      reconnectAttempts: options.reconnectAttempts,
      reconnectDelay: options.reconnectDelay,
    });

    wsManagerRef.current = wsManager;

    try {
      const { readable, writable } = await wsManager.connect();

      // Initialize the connection
      const agent = new ClientSideConnection(
        (agent) => {
          // Initialize the ACP client
          const acpClient = new AcpClient(agent, {
            onRequestPermission: handleRequestPermission,
            onSessionNotification: handleSessionNotification,
          });
          acpClientRef.current = acpClient;
          return acpClient;
        },
        writable,
        readable,
      );

      const listeningAgent: Agent = new ListeningAgent(agent, {
        on_newSession_response: (response) => {
          setActiveSessionId(response.sessionId);
        },
        on_prompt_start: (params) => {
          for (const prompt of params.prompt) {
            addNotification({
              type: "session_notification",
              data: {
                sessionId: params.sessionId,
                update: {
                  sessionUpdate: "user_message_chunk",
                  content: prompt,
                },
              },
            });
          }
        },
      });

      setAgent(listeningAgent);
    } catch (error) {
      wsManagerRef.current = null;
      throw error;
    }
  });

  const disconnect = useEventCallback(() => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
      wsManagerRef.current = null;
    }

    acpClientRef.current = null;
    setAgent(null);
    setPendingPermission(null);
  });

  const resolvePermission = useEventCallback((response: RequestPermissionResponse) => {
    if (pendingPermission && acpClientRef.current) {
      const permissionId = pendingPermission.id;
      if (permissionId) {
        acpClientRef.current.resolvePermission(permissionId, response);
      }
    }
    setPendingPermission(null);
  });

  const rejectPermissionCallback = useEventCallback((error: Error) => {
    if (pendingPermission && acpClientRef.current) {
      const permissionId = pendingPermission.id;
      if (permissionId) {
        acpClientRef.current.rejectPermission(permissionId, error);
      }
    }
    setPendingPermission(null);
  });

  // Effects

  // Update active session id if it changes externally
  useEffect(() => {
    if (options.initialSessionId) {
      setActiveSessionId(options.initialSessionId);
    }
  }, [options.initialSessionId, setActiveSessionId]);

  // Auto-connect on mount if specified
  // biome-ignore lint/correctness/useExhaustiveDependencies: Don't include connect/disconnect to avoid re-connecting on every render
  useEffect(() => {
    if (options.autoConnect) {
      connect().catch(console.error);
    }

    return () => {
      disconnect();
    };
  }, [options.autoConnect]);

  return {
    connect,
    disconnect,
    connectionState,
    notifications: activeSessionId ? notifications[activeSessionId] || [] : [],
    clearNotifications,
    pendingPermission,
    resolvePermission,
    rejectPermission: rejectPermissionCallback,
    agent: agent,
  };
}
