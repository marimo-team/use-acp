import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useAcpClient } from "../src/hooks/use-acp-client.js";
import { NotificationTimeline } from "./components/timeline-components.js";
import { ToolCall } from "./components/tool-call.js";

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
  const [wsUrl, setWsUrl] = useState("ws://localhost:8000/message");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [promptText, setPromptText] = useState("");

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
  } = useAcpClient({
    wsUrl,
    reconnectAttempts: 3,
    reconnectDelay: 2000,
  });

  useEffect(() => {
    console.warn(notifications);
  }, [notifications]);

  const [executeNewSession, isCreatingSession, newSessionError] = useAsync(
    useCallback(async () => {
      if (!acp) throw new Error("ACP not connected");
      return acp
        .newSession({
          cwd: ".",
          mcpServers: [],
        })
        .then((response) => {
          console.log("New session response:", response);
          return response;
        })
        .catch((error) => {
          console.error("New session error:", error);
          throw error;
        });
    }, [acp]),
  );

  const [executePrompt, isPrompting, promptError] = useAsync(
    useCallback(
      async (sessionId: string, text: string) => {
        if (!acp) throw new Error("ACP not connected");
        return acp.prompt({
          sessionId,
          prompt: [
            {
              type: "text",
              text,
            },
          ],
        });
      },
      [acp],
    ),
  );

  const [executeCancel, isCancelling, cancelError] = useAsync(
    useCallback(
      async (sessionId: string) => {
        if (!acp) throw new Error("ACP not connected");
        return acp.cancel({ sessionId });
      },
      [acp],
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
    const response = await executeNewSession();
    if (response) {
      setSessionId(response.sessionId);
      console.log("New session created:", response);
    }
  };

  const handlePrompt = async () => {
    if (!sessionId || !promptText.trim()) return;

    const response = await executePrompt(sessionId, promptText);
    if (response) {
      console.log("Prompt response:", response);
      setPromptText(""); // Clear the input after successful prompt
    }
  };

  const handleCancel = async () => {
    if (!sessionId) return;

    const response = await executeCancel(sessionId);
    if (response) {
      console.log("Cancel response:", response);
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2">ACP Client Demo</h1>
            <p className="text-sm text-gray-600">Connect to an Agent Client Protocol server</p>
            <p className="text-sm text-gray-600">
              built by{" "}
              <a href="https://github.com/marimo-team/marimo" className="text-blue-500">
                marimo
              </a>
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="wsUrl" className="block text-sm font-medium text-gray-700 mb-2">
                WebSocket URL
              </label>
              <input
                type="text"
                value={wsUrl}
                id="wsUrl"
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder="ws://localhost:8000/message"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={connectionState.status === "connected" ? disconnect : handleConnect}
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
                  {sessionId ? `Active Session: ${sessionId}` : "No active session"}
                </div>

                {(newSessionError || promptError || cancelError) && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-3">
                    <h4 className="font-medium text-red-800 text-sm mb-1">Error</h4>
                    <p className="text-sm text-red-700">
                      {newSessionError?.message || promptError?.message || cancelError?.message}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={handleNewSession}
                    disabled={isCreatingSession}
                    className="flex-1 px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
                  >
                    {isCreatingSession ? "Creating..." : "New Session"}
                  </button>

                  {sessionId && (
                    <button
                      type="button"
                      onClick={() => setSessionId(null)}
                      className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 text-sm"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {sessionId && (
                  <div className="space-y-2">
                    <label htmlFor="promptText" className="block text-sm font-medium text-gray-700">
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
                )}
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
            <p className="mb-2">For example, try running:</p>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              npx -y supergateway --stdio "npx @google/gemini-cli --experimental-acp"
              --outputTransport ws
            </pre>
            <i>or</i>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto">
              npx -y supergateway --stdio "npx @zed-industries/claude-code-acp" --outputTransport ws
            </pre>
          </div>
        </div>
      </div>

      {/* Right side - Chat Timeline */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        <div className="border-b border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              Agent Conversation ({notifications.length})
            </h2>
            <button
              onClick={clearNotifications}
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

