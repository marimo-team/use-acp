import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useAcpClient } from "../src/hooks/use-acp-client.js";
import type { SessionId } from "../src/state/types.js";
import { JsonRpcError } from "../src/utils/jsonrpc-error.js";
import { NotificationTimeline } from "./components/timeline-components.js";
import { ToolCall } from "./components/tool-call.js";

interface AgentConfig {
  id: string;
  name: string;
  wsUrl: string;
  command: string;
}

interface Session {
  id: string;
  agentId: string;
  agentName: string;
  createdAt: Date;
  lastActiveAt: Date;
}

const AGENT_CONFIGS: [AgentConfig, AgentConfig, AgentConfig, AgentConfig] = [
  {
    id: "claude",
    name: "Claude Code ACP",
    wsUrl: "ws://localhost:3003/message",
    command: 'npx -y stdio-to-ws "npx @zed-industries/claude-code-acp" --port 3003',
  },
  {
    id: "gemini",
    name: "Gemini CLI ACP",
    wsUrl: "ws://localhost:3004/message",
    command: 'npx -y stdio-to-ws "npx @google/gemini-cli --experimental-acp" --port 3004',
  },
  {
    id: "codex",
    name: "Codex ACP",
    wsUrl: "ws://localhost:3005/message",
    command: 'npx -y stdio-to-ws "npx @zed-industries/codex-acp" --port 3005',
  },
  {
    id: "custom",
    name: "Custom Agent",
    wsUrl: "ws://localhost:8000/message",
    command: "Your custom agent command here",
  },
];

function useAsync<T extends unknown[], R>(
  asyncFn: (...args: T) => Promise<R>,
): [(...args: T) => Promise<R | undefined>, boolean, Error | null] {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(
    async (...args: T): Promise<R | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await asyncFn(...args);
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        console.error("Async operation failed:", error);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [asyncFn],
  );

  return [execute, loading, error];
}

function AcpDemo() {
  // Multi-agent state
  const [selectedAgentId, setSelectedAgentId] = useState<string>(AGENT_CONFIGS[0].id);
  const [customWsUrl, setCustomWsUrl] = useState("ws://localhost:8000/message");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");

  // Get current agent config
  const selectedAgent = AGENT_CONFIGS.find((a) => a.id === selectedAgentId) || AGENT_CONFIGS[0];
  const wsUrl = selectedAgent?.id === "custom" ? customWsUrl : selectedAgent?.wsUrl;

  const {
    connect,
    disconnect,
    connectionState,
    notifications,
    clearNotifications,
    pendingPermission,
    resolvePermission,
    rejectPermission,
    agent: acp,
    availableCommands,
    sessionMode,
  } = useAcpClient({
    wsUrl,
    reconnectAttempts: 3,
    reconnectDelay: 2000,
    initialSessionId: activeSessionId,
    sessionParams: {
      cwd: "/tmp",
      mcpServers: [],
    },
  });

  useEffect(() => {
    if (notifications.length > 0) {
      console.log("Notifications:", notifications);
    }
  }, [notifications]);

  const agentName = selectedAgent?.name || "";
  const [executeNewSession, isCreatingSession, newSessionError] = useAsync(
    useCallback(async () => {
      if (!acp) throw new Error("ACP not connected");
      return acp
        .newSession({
          cwd: "/tmp",
          mcpServers: [],
        })
        .then((response) => {
          // Add session to our tracking
          const newSession: Session = {
            id: response.sessionId,
            agentId: selectedAgentId,
            agentName: agentName,
            createdAt: new Date(),
            lastActiveAt: new Date(),
          };
          setSessions((prev) => [...prev, newSession]);
          setActiveSessionId(response.sessionId);
          return response;
        })
        .catch((error) => {
          console.error("New session error:", error);
          throw error;
        });
    }, [acp, selectedAgentId, agentName]),
  );

  const [executePrompt, isPrompting, promptError] = useAsync(
    useCallback(
      async (text: string) => {
        if (!acp || !activeSessionId) throw new Error("ACP not connected or no active session");
        return acp.prompt({
          sessionId: activeSessionId,
          prompt: [
            {
              type: "text",
              text,
            },
          ],
        });
      },
      [acp, activeSessionId],
    ),
  );

  const [executeCancel, isCancelling, cancelError] = useAsync(
    useCallback(async () => {
      if (!acp || !activeSessionId) throw new Error("ACP not connected or no active session");
      return acp.cancel({ sessionId: activeSessionId });
    }, [acp, activeSessionId]),
  );

  const [executeSetMode, isSettingMode, setModeError] = useAsync(
    useCallback(
      async (modeId: string) => {
        if (!acp || !activeSessionId) throw new Error("ACP not connected or no active session");
        if (!("setSessionMode" in acp) || typeof acp.setSessionMode !== "function") {
          throw new Error("Agent does not support session modes");
        }
        return acp.setSessionMode({ sessionId: activeSessionId, modeId });
      },
      [acp, activeSessionId],
    ),
  );

  const handleConnect = async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  const handlePermissionAccept = (opts: { optionId: string }) => {
    if (pendingPermission) {
      resolvePermission({ outcome: { outcome: "selected", optionId: opts.optionId } });
    }
  };

  const _handlePermissionReject = () => {
    if (pendingPermission) {
      rejectPermission(new Error("Permission denied by user"));
    }
  };

  const handleNewSession = async () => {
    await executeNewSession();
  };

  const handlePrompt = async () => {
    if (!activeSessionId || !promptText.trim()) return;

    const response = await executePrompt(promptText);
    if (response) {
      console.log("Prompt response:", response);
      setPromptText(""); // Clear the input after successful prompt
    }
  };

  const handleCancel = async () => {
    if (!activeSessionId) return;

    const response = await executeCancel();
    if (response) {
      console.log("Cancel response:", response);
    }
  };

  const handleResumeSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, lastActiveAt: new Date() } : s)),
    );
    setActiveSessionId(sessionId);
  };

  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    // Clear active session when changing agents unless it belongs to the new agent
    const currentSession = sessions.find((s) => s.id === activeSessionId);
    if (currentSession?.agentId !== agentId) {
      setActiveSessionId(null);
    }
  };

  const handleClearAllSessions = () => {
    setSessions([]);
    setActiveSessionId(null);
  };

  const handleSlashCommand = (commandName: string) => {
    setPromptText((prev) => `${prev}/${commandName} `);
  };

  const handleSetSessionMode = async (modeId: string) => {
    const response = await executeSetMode(modeId);
    if (response) {
      console.log("Session mode changed:", response);
    }
  };

  const getStatusColor = () => {
    switch (connectionState.status) {
      case "connected":
        return "text-green-600";
      case "connecting":
        return "text-yellow-600";
      case "error":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left sidebar - Controls */}
      <div className="w-96 bg-white border-r border-gray-200 p-6 overflow-y-auto">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Multi-Agent ACP Demo</h1>
            <p className="text-sm text-gray-600">
              Connect to multiple Agent Client Protocol servers
            </p>
            <p className="text-sm text-gray-600">
              built by{" "}
              <a href="https://github.com/marimo-team/marimo" className="text-blue-500">
                marimo
              </a>
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="agentSelect" className="block text-sm font-medium text-gray-700 mb-2">
                Select Agent
              </label>
              <select
                id="agentSelect"
                value={selectedAgentId}
                onChange={(e) => handleAgentChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AGENT_CONFIGS.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedAgent?.id === "custom" && (
              <div>
                <label htmlFor="wsUrl" className="block text-sm font-medium text-gray-700 mb-2">
                  WebSocket URL
                </label>
                <input
                  type="text"
                  value={customWsUrl}
                  id="wsUrl"
                  onChange={(e) => setCustomWsUrl(e.target.value)}
                  placeholder="ws://localhost:8000/message"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div className="text-xs text-gray-500 bg-gray-100 p-2 rounded">
              <strong>Current:</strong> {agentName}
              <br />
              <strong>URL:</strong> {wsUrl}
            </div>

            <button
              type="button"
              onClick={connectionState.status === "connected" ? () => disconnect() : handleConnect}
              disabled={connectionState.status === "connecting"}
              className={`w-full px-4 py-2 rounded-md font-medium ${
                connectionState.status === "connected"
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-400"
              }`}
            >
              {connectionState.status === "connecting" && "Connecting..."}
              {connectionState.status === "connected" && "Disconnect"}
              {connectionState.status === "disconnected" && "Connect"}
              {connectionState.status === "error" && "Retry"}
            </button>

            <div className={`text-sm font-medium ${getStatusColor()}`}>
              Status: {connectionState.status}
              {connectionState.error && (
                <div className="text-red-600 text-xs mt-1">{connectionState.error}</div>
              )}
            </div>
          </div>

          {connectionState.status === "connected" && acp && (
            <div className="space-y-4 border-t pt-4">
              <div>
                <h3 className="font-medium text-gray-800 mb-2">Session Management</h3>
                <div className="text-sm text-gray-500 mb-3">
                  {activeSessionId ? (
                    <span>
                      Active Session: {activeSessionId.slice(0, 12)}...
                      <br />
                      Agent: {sessions.find((s) => s.id === activeSessionId)?.agentName}
                    </span>
                  ) : (
                    "No active session"
                  )}
                </div>

                {(newSessionError || promptError || cancelError || setModeError) && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                    <h4 className="font-medium text-red-800 text-sm mb-1">Error</h4>
                    <p className="text-sm text-red-700">
                      {prettyError(newSessionError || promptError || cancelError || setModeError)}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleNewSession}
                    disabled={isCreatingSession}
                    className="w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                  >
                    {isCreatingSession ? "Creating..." : `New Session (${agentName})`}
                  </button>

                  {sessions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label
                          htmlFor="clearAllSessions"
                          className="text-sm font-medium text-gray-700"
                        >
                          Resume Session
                        </label>
                        <button
                          type="button"
                          onClick={handleClearAllSessions}
                          id="clearAllSessions"
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Clear All
                        </button>
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {sessions.map((session) => (
                          <button
                            key={session.id}
                            type="button"
                            className={`text-xs p-2 border rounded cursor-pointer hover:bg-gray-50 ${
                              session.id === activeSessionId
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200"
                            }`}
                            onClick={() => handleResumeSession(session.id)}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{session.agentName}</span>
                              {session.id === activeSessionId && (
                                <span className="text-blue-600">●</span>
                              )}
                            </div>
                            <div className="text-gray-600">{session.id.slice(0, 16)}...</div>
                            <div className="text-gray-500">
                              {session.lastActiveAt.toLocaleTimeString()}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSessionId && (
                    <div className="space-y-3 pt-2 border-t">
                      {/* Slash Commands */}
                      {availableCommands.length > 0 && (
                        <div>
                          <label
                            htmlFor="slashCommands"
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Slash Commands
                          </label>
                          <select
                            id="slashCommands"
                            onChange={(e) => {
                              if (e.target.value) {
                                handleSlashCommand(e.target.value);
                                e.target.value = "";
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          >
                            <option value="">Insert slash command...</option>
                            {availableCommands.map((command) => (
                              <option key={command.name} value={command.name}>
                                /{command.name} - {command.description}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Session Modes */}
                      {sessionMode && sessionMode.availableModes.length > 1 && (
                        <div>
                          <label
                            htmlFor="sessionModes"
                            className="block text-sm font-medium text-gray-700 mb-2"
                          >
                            Session Mode
                          </label>
                          <select
                            id="sessionModes"
                            value={sessionMode.currentModeId}
                            onChange={(e) => handleSetSessionMode(e.target.value)}
                            disabled={isSettingMode}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:bg-gray-100"
                          >
                            {sessionMode.availableModes.map((mode) => (
                              <option key={mode.id} value={mode.id}>
                                {mode.name} {mode.description ? `- ${mode.description}` : ""}
                              </option>
                            ))}
                          </select>
                          {isSettingMode && (
                            <div className="text-xs text-blue-600 mt-1">Changing mode...</div>
                          )}
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="promptText"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          Send Message to Agent
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="promptText"
                            type="text"
                            value={promptText}
                            onChange={(e) => setPromptText(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && !isPrompting && handlePrompt()}
                            placeholder="Type your message..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            disabled={isPrompting}
                          />
                          <button
                            type="button"
                            onClick={handlePrompt}
                            disabled={isPrompting || !promptText.trim()}
                            className="px-3 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                          >
                            {isPrompting ? "..." : "Send"}
                          </button>
                          {isPrompting && (
                            <button
                              type="button"
                              onClick={handleCancel}
                              disabled={isCancelling}
                              className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                            >
                              {isCancelling ? "..." : "Cancel"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {pendingPermission && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h3 className="font-medium text-yellow-800 mb-2">Permission Request</h3>
              <p className="text-sm text-yellow-700 mb-3">
                <ToolCall toolCall={pendingPermission.toolCall} />
              </p>
              <div className="flex gap-2">
                {pendingPermission.options.map((option) => (
                  <button
                    key={option.optionId}
                    type="button"
                    onClick={() => handlePermissionAccept(option)}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    {option.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500 border-t pt-4">
            <p className="mb-2">Commands for {selectedAgent.name}:</p>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto whitespace-pre-wrap">
              {selectedAgent.command}
            </pre>
            {selectedAgent.id !== "custom" && (
              <p className="mt-2 text-xs text-orange-600">
                ⚠️ Make sure to use the correct port: {selectedAgent.wsUrl.match(/:(\d+)/)?.[1]}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Chat Timeline */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <div className="border-b border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {selectedAgent.name} Conversation ({notifications.length})
              </h2>
              {activeSessionId && (
                <p className="text-sm text-gray-600">Session: {activeSessionId.slice(0, 16)}...</p>
              )}
            </div>
            <button
              onClick={() => activeSessionId && clearNotifications(activeSessionId as SessionId)}
              type="button"
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-100"
            >
              Clear Chat
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <NotificationTimeline notifications={notifications} maxItems={200} />
        </div>
      </div>
    </div>
  );
}

export function renderAcpDemo() {
  const container = document.getElementById("acp-demo");
  if (container) {
    const root = createRoot(container);
    root.render(<AcpDemo />);
  }
}

function prettyError(error: unknown): string {
  if (error instanceof JsonRpcError) {
    return typeof error.data === "string" ? error.data : String(error.data);
  }
  return error instanceof Error ? error.message : String(error);
}
