import {
  type Agent,
  type AgentCapabilities,
  type AvailableCommand,
  ClientSideConnection,
  type McpServer,
  ndJsonStream,
  type RequestPermissionResponse,
  type SessionModeState,
  type SessionNotification,
} from "@agentclientprotocol/sdk";
import { useEffect, useRef, useState } from "react";
import {
  AcpClient,
  type AcpClientOptions,
  type IdentifiedPermissionRequest,
  ListeningAgent,
} from "../client/acp-client.js";
import { MultiWebSocketManager } from "../connection/websocket-manager.js";
import { useAcpStore } from "../state/atoms.js";
import type {
  ConnectionState,
  ConnectionUrl,
  NotificationEvent,
  SessionId,
} from "../state/types.js";
import { useEventCallback } from "./use-event-callback.js";

export interface UseAcpClientOptions {
  // Connection management
  wsUrl: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;

  // Client options
  clientOptions?: Partial<AcpClientOptions>;

  // Session management
  initialSessionId?: string | null;
  sessionParams?: {
    cwd?: string;
    mcpServers?: McpServer[];
  };
}

export interface UseAcpClientReturn {
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => void;
  connectionState: ConnectionState;

  // State management
  activeSessionId: SessionId | null;
  setActiveSessionId: (sessionId: SessionId | null) => void;
  notifications: NotificationEvent[];
  clearNotifications: () => void;
  isSessionLoading: boolean;

  // Permission handling
  pendingPermission: IdentifiedPermissionRequest | null;
  resolvePermission: (response: RequestPermissionResponse) => void;
  rejectPermission: (error: Error) => void;

  // ACP connection
  agent: Agent | null;
  agentCapabilities: AgentCapabilities | null;

  // Slash commands support
  availableCommands: AvailableCommand[];

  // Session modes
  sessionMode: SessionModeState | null | undefined;
}

export function useAcpClient(options: UseAcpClientOptions): UseAcpClientReturn {
  const {
    wsUrl,
    autoConnect = true,
    reconnectAttempts = 3,
    reconnectDelay = 2000,
    clientOptions = {},
  } = options;

  const {
    getConnection,
    notifications,
    activeSessionId,
    agentCapabilities,
    sessionModes,
    setActiveModeId,
    setModeState,
    setActiveSessionId,
    setConnection,
    setActiveConnection,
    addNotification,
    clearNotifications,
  } = useAcpStore();

  // State
  const [pendingPermission, setPendingPermission] = useState<IdentifiedPermissionRequest | null>(
    null,
  );
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [availableCommands, setAvailableCommands] = useState<AvailableCommand[]>([]);

  // Refs
  const multiWsManagerRef = useRef<MultiWebSocketManager | null>(null);
  const acpClientRef = useRef<AcpClient | null>(null);
  const lastProcessedSessionId = useRef<SessionId | null>(null);
  const sessionCreationInProgress = useRef<boolean>(false);

  // Handlers
  const handleConnectionStateChange = useEventCallback(
    (state: ConnectionState, url: ConnectionUrl) => {
      setConnection(url, state);
      addNotification({
        type: "connection_change",
        data: state,
      });
    },
  );

  const handleError = useEventCallback((error: Error, _url: ConnectionUrl) => {
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

    // Handle available commands updates
    if (notification.update.sessionUpdate === "available_commands_update") {
      setAvailableCommands(notification.update.availableCommands);
    }
  });

  const handleRequestPermission = useEventCallback((params: IdentifiedPermissionRequest) => {
    setPendingPermission(params);
  });

  const connect = useEventCallback(async () => {
    if (!multiWsManagerRef.current) {
      multiWsManagerRef.current = new MultiWebSocketManager({
        onConnectionStateChange: handleConnectionStateChange,
        onError: handleError,
        reconnectAttempts: reconnectAttempts,
        reconnectDelay: reconnectDelay,
      });
    }

    setActiveConnection(wsUrl);
    const { readable, writable } = await multiWsManagerRef.current.connect(wsUrl);

    // Initialize the connection
    const agent = new ClientSideConnection(
      (agent) => {
        // Initialize the ACP client
        const acpClient = new AcpClient(agent, {
          ...clientOptions,
          onRequestPermission: (params) => {
            clientOptions?.onRequestPermission?.(params);
            handleRequestPermission(params);
          },
          onSessionNotification: (params) => {
            clientOptions?.onSessionNotification?.(params);
            handleSessionNotification(params);
          },
          onRpcError: (error) => {
            clientOptions?.onRpcError?.(error);
            handleError(error, wsUrl);
          },
        });
        acpClientRef.current = acpClient;
        return acpClient;
      },
      ndJsonStream(writable, readable as ReadableStream<Uint8Array>),
    );

    const listeningAgent: Agent = new ListeningAgent(agent, {
      on_initialize_response: (response) => {
        const capabilities = response.agentCapabilities;
        console.log("[acp] Agent capabilities", capabilities);
        const connectionState = getConnection(wsUrl);
        setConnection(wsUrl, connectionState.state, capabilities);
      },
      on_newSession_response: (response) => {
        console.log("[acp] New session created", response);
        const sessionId = response.sessionId as SessionId;
        setActiveSessionId(sessionId);
        setModeState(sessionId, response.modes);
      },
      on_loadSession_response: (response, params) => {
        console.log("[acp] Session resumed", params);
        const sessionId = params.sessionId as SessionId;
        setActiveSessionId(sessionId);
        setModeState(sessionId, response.modes);
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
      on_setSessionMode_start: (params) => {
        console.log("[acp] Session mode set", params);
        const sessionId = params.sessionId as SessionId;
        setActiveModeId(sessionId, params.modeId);
      },
      on_rpc_error: (error) => handleError(error, wsUrl),
    });

    setAgent(listeningAgent);
  });

  const disconnect = useEventCallback((url?: ConnectionUrl) => {
    const targetUrl = url || wsUrl;

    if (multiWsManagerRef.current) {
      if (url) {
        multiWsManagerRef.current.disconnect(url);
      } else {
        // Disconnect the current URL specifically instead of all connections
        multiWsManagerRef.current.disconnect(targetUrl);
        multiWsManagerRef.current = null;
        acpClientRef.current = null;
        setAgent(null);
      }
    }

    if (!url) {
      setPendingPermission(null);
      setAvailableCommands([]);
      // Reset session creation safeguards on full disconnect
      sessionCreationInProgress.current = false;
      lastProcessedSessionId.current = null;
      setIsSessionLoading(false);
    }
  });

  const resolvePermission = useEventCallback((response: RequestPermissionResponse) => {
    if (pendingPermission && acpClientRef.current) {
      const permissionId = pendingPermission.deferredId;
      if (permissionId) {
        acpClientRef.current.resolvePermission(permissionId, response);
      }
    }
    setPendingPermission(null);
  });

  const rejectPermissionCallback = useEventCallback((error: Error) => {
    if (pendingPermission && acpClientRef.current) {
      const permissionId = pendingPermission.deferredId;
      if (permissionId) {
        acpClientRef.current.rejectPermission(permissionId, error);
      }
    }
    setPendingPermission(null);
  });

  // Auto-connect on mount if specified
  // biome-ignore lint/correctness/useExhaustiveDependencies: Don't include connect/disconnect to avoid re-connecting on every render
  useEffect(() => {
    // Reset the active session id as the connection is being established
    setActiveSessionId(null);

    if (autoConnect) {
      void connect().catch(console.error);
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, wsUrl]);

  return {
    connect,
    disconnect,
    connectionState: getConnection(wsUrl).state,
    activeSessionId,
    notifications: activeSessionId ? notifications[activeSessionId] || [] : [],
    isSessionLoading,
    clearNotifications,
    pendingPermission,
    setActiveSessionId,
    resolvePermission,
    rejectPermission: rejectPermissionCallback,
    agent: agent,
    agentCapabilities,
    sessionMode: activeSessionId ? sessionModes[activeSessionId] : null,
    availableCommands,
  };
}
