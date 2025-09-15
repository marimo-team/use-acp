/** biome-ignore-all lint/suspicious/noArrayIndexKey: just a demo */

import type {
  ToolCallContent,
  ToolCallUpdate,
} from "@zed-industries/agent-client-protocol/typescript/acp.js";
import type React from "react";
import { useEffect, useRef } from "react";
import type {
  AgentMessageChunkNotification,
  AgentThoughtChunkNotification,
  PlanNotification,
  SessionUpdate,
  ToolCallStart,
  UserMessageChunkNotification,
} from "../../src/client/types.js";
import type { NotificationEvent } from "../../src/state/types.js";
import { groupNotifications, mergeToolCalls } from "../../src/state/utils.js";
import { logNever } from "../../src/utils/never.js";
import { ContentBlockComponent } from "./content-block.js";
import { DiffContent } from "./tool-call.js";
import { Badge, CodeBlock, Collapsible, IconLabel, MetadataList } from "./ui-primitives.js";

// Individual notification renderers
function ConnectionNotification({
  notification,
}: {
  notification: Extract<NotificationEvent, { type: "connection_change" }>;
}) {
  const { status, error } = notification.data;
  const getStatusIcon = () => {
    switch (status) {
      case "connected":
        return "🟢";
      case "connecting":
        return "🟡";
      case "error":
        return "🔴";
      case "disconnected":
        return "⚫";
      default:
        return "❓";
    }
  };

  return (
    <div className="space-y-2">
      <IconLabel icon={getStatusIcon()} label={`Connection ${status}`} />
      {error && (
        <div className="text-xs text-red-600 bg-red-50 rounded p-2 border border-red-200">
          {error}
        </div>
      )}
    </div>
  );
}

function ErrorNotification({
  notification,
}: {
  notification: Extract<NotificationEvent, { type: "error" }>;
}) {
  return (
    <div className="space-y-2">
      <IconLabel icon="❌" label="Error" />
      <div className="text-sm text-gray-700">{notification.data.message}</div>
      {notification.data.stack && (
        <Collapsible summary="Stack trace">
          <CodeBlock>{notification.data.stack}</CodeBlock>
        </Collapsible>
      )}
    </div>
  );
}

function AgentMessageChunkNotificationComponent({
  sessionUpdate,
}: {
  sessionUpdate: AgentMessageChunkNotification;
}) {
  return <ContentBlockComponent content={sessionUpdate.content} />;
}

function AgentThoughtChunkNotificationComponent({
  sessionUpdate,
}: {
  sessionUpdate: AgentThoughtChunkNotification;
}) {
  return (
    <div className="max-h-40 overflow-y-auto bg-gray-50 rounded-lg p-3 border border-gray-200">
      <ContentBlockComponent
        content={sessionUpdate.content}
        className="text-sm text-gray-600 opacity-80"
      />
    </div>
  );
}

function ToolCallNotificationComponent({ toolCall }: { toolCall: ToolCallStart | ToolCallUpdate }) {
  const metadata = [
    { label: "Kind", value: toolCall.kind || "-" },
    { label: "Tool Call ID", value: toolCall.toolCallId || "-" },
    { label: "Status", value: toolCall.status || "-" },
  ];

  return (
    <div className="space-y-3">
      <IconLabel icon="🔧" label={`Tool Call: ${toolCall.title || "Untitled"}`} />

      <MetadataList items={metadata} />

      {toolCall.locations && toolCall.locations.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">📍 Locations</div>
          <div className="flex flex-wrap gap-1">
            {toolCall.locations.map((location, index) => (
              <Badge key={index} variant="default" size="sm">
                <code className="text-xs">
                  {location.line ? `${location.path}:${location.line}` : location.path}
                </code>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {toolCall.content && toolCall.content.length > 0 && (
        <Collapsible summary="Content">
          <div className="space-y-2">
            {toolCall.content.map((content, index) => (
              <ToolCallContentBlockComponent key={index} content={content} />
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  );
}

function ToolCallUpdateNotificationComponent({ sessionUpdate }: { sessionUpdate: ToolCallUpdate }) {
  const icon =
    sessionUpdate.status === "completed" ? "✅" : sessionUpdate.status === "failed" ? "❌" : "🔧";
  const label = `Tool ${sessionUpdate.status === "completed" ? "Completed" : sessionUpdate.status === "failed" ? "Failed" : "Updated"}: ${sessionUpdate.title || "Untitled"}`;

  const metadata = [
    { label: "Kind", value: sessionUpdate.kind || "-" },
    { label: "Tool Call ID", value: sessionUpdate.toolCallId || "-" },
    { label: "Status", value: sessionUpdate.status || "-" },
  ];

  return (
    <div className="space-y-3">
      <IconLabel icon={icon} label={label} />

      <MetadataList items={metadata} />

      {sessionUpdate.locations && sessionUpdate.locations.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-700 mb-1">📍 Locations</div>
          <div className="flex flex-wrap gap-1">
            {sessionUpdate.locations.map((location, index) => (
              <Badge key={index} variant="default" size="sm">
                <code className="text-xs">
                  {location.line ? `${location.path}:${location.line}` : location.path}
                </code>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {sessionUpdate.content && sessionUpdate.content.length > 0 && (
        <div className="space-y-2">
          {sessionUpdate.content.map((content, index) => (
            <ToolCallContentBlockComponent key={index} content={content} />
          ))}
        </div>
      )}
    </div>
  );
}

function UserMessageChunkNotificationComponent({
  sessionUpdate,
}: {
  sessionUpdate: UserMessageChunkNotification;
}) {
  return <ContentBlockComponent content={sessionUpdate.content} />;
}

function PlanNotificationComponent({ sessionUpdate }: { sessionUpdate: PlanNotification }) {
  return (
    <div className="space-y-2">
      <IconLabel icon="📋" label="Plan" size="sm" />
      <div className="space-y-2">
        {sessionUpdate.entries.map((entry, index) => (
          <div
            key={index}
            className="flex items-start gap-2 p-2 bg-blue-50 rounded border border-blue-200"
          >
            <Badge
              variant={
                entry.status === "completed"
                  ? "success"
                  : entry.status === "in_progress"
                    ? "warning"
                    : "default"
              }
              size="sm"
            >
              {entry.status}
            </Badge>
            <div className="flex-1 text-sm">{entry.content}</div>
            {entry.priority && (
              <Badge variant="info" size="sm">
                P{entry.priority}
              </Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ToolCallContentBlockComponent({ content }: { content: ToolCallContent }) {
  if (!content) {
    return <div className="text-xs text-gray-500 italic">No content</div>;
  }

  switch (content.type) {
    case "content":
      return <ContentBlockComponent content={content.content} />;
    case "diff":
      return <DiffContent diff={content} />;
    default:
      logNever(content);
      return (
        <div className="text-xs text-gray-500">
          <div className="font-medium mb-1">Unknown content type</div>
          <CodeBlock>{JSON.stringify(content, null, 2)}</CodeBlock>
        </div>
      );
  }
}

function SessionNotificationRenderer({ sessionData }: { sessionData: SessionUpdate }) {
  // Exhaustive switch on session update types
  switch (sessionData.sessionUpdate) {
    case "agent_message_chunk":
      return <AgentMessageChunkNotificationComponent sessionUpdate={sessionData} />;

    case "agent_thought_chunk":
      return <AgentThoughtChunkNotificationComponent sessionUpdate={sessionData} />;

    case "tool_call":
      return <ToolCallNotificationComponent toolCall={sessionData} />;

    case "tool_call_update":
      return <ToolCallUpdateNotificationComponent sessionUpdate={sessionData} />;

    case "user_message_chunk":
      return <UserMessageChunkNotificationComponent sessionUpdate={sessionData} />;

    case "plan":
      return <PlanNotificationComponent sessionUpdate={sessionData} />;

    default:
      logNever(sessionData);
      return (
        <div className="space-y-2">
          <IconLabel icon="❓" label="Unhandled Session Update" />
          <div className="text-sm text-gray-600">
            Type: {(sessionData as SessionUpdate).sessionUpdate}
          </div>
          <CodeBlock>{JSON.stringify(sessionData, null, 2)}</CodeBlock>
        </div>
      );
  }
}

// Common message container for DRY pattern
function MessageContainer({
  children,
  type,
  timestamp,
}: {
  children: React.ReactNode;
  type: "user" | "agent" | "system" | "connection" | "error";
  timestamp: string;
}) {
  const getAlignment = () => {
    switch (type) {
      case "user":
        return "ml-8 mr-0";
      case "agent":
        return "ml-0 mr-8";
      case "system":
        return "ml-4 mr-4";
      case "connection":
        return "ml-4 mr-4";
      case "error":
        return "ml-4 mr-4";
      default:
        return "ml-4 mr-4";
    }
  };

  const getBgColor = () => {
    switch (type) {
      case "user":
        return "bg-blue-500 text-white";
      case "agent":
        return "bg-gray-100 text-gray-900";
      case "system":
        return "bg-orange-50 border border-orange-200";
      case "connection":
        return "bg-green-50 border border-green-200";
      case "error":
        return "bg-red-50 border border-red-200";
      default:
        return "bg-gray-50 border border-gray-200";
    }
  };

  return (
    <div className={`mb-4 ${getAlignment()}`}>
      <div className="text-xs text-gray-500 mb-1 px-3">{timestamp}</div>
      <div className={`rounded-2xl px-4 py-3 max-w-none ${getBgColor()}`}>{children}</div>
    </div>
  );
}

// Main timeline component
export function TimelineNotification({ notification }: { notification: NotificationEvent[] }) {
  const first = notification[0];
  if (!first) return null;
  const timestamp = new Date(first.timestamp).toLocaleTimeString();

  const getMessageType = (): "user" | "agent" | "system" | "connection" | "error" => {
    switch (first.type) {
      case "connection_change":
        return "connection";
      case "error":
        return "error";
      case "session_notification": {
        const sessionData = first.data;
        if (sessionData.update.sessionUpdate === "user_message_chunk") return "user";
        if (sessionData.update.sessionUpdate === "agent_message_chunk") return "agent";
        if (sessionData.update.sessionUpdate === "agent_thought_chunk") return "agent";
        if (sessionData.update.sessionUpdate === "tool_call") return "agent";
        if (sessionData.update.sessionUpdate === "tool_call_update") return "agent";
        return "system";
      }
      default:
        return "system";
    }
  };

  if (
    first.type === "session_notification" &&
    ["tool_call", "tool_call_update"].includes(first.data.update.sessionUpdate)
  ) {
    const toolCalls = mergeToolCalls(
      notification.flatMap((n) =>
        n.type === "session_notification" ? (n.data.update as ToolCallUpdate) : [],
      ),
    );
    return (
      <MessageContainer type={getMessageType()} timestamp={timestamp}>
        {toolCalls.map((toolCall) => (
          <ToolCallNotificationComponent key={toolCall.toolCallId} toolCall={toolCall} />
        ))}
      </MessageContainer>
    );
  }

  const renderNotification = (notification: NotificationEvent) => {
    switch (notification.type) {
      case "connection_change":
        return <ConnectionNotification notification={notification} />;
      case "error":
        return <ErrorNotification notification={notification} />;
      case "session_notification":
        return <SessionNotificationRenderer sessionData={notification.data.update} />;
      default:
        return (
          <div className="space-y-2">
            <IconLabel icon="❓" label="Unknown Notification" />
            <CodeBlock>{JSON.stringify(notification, null, 2)}</CodeBlock>
          </div>
        );
    }
  };

  return (
    <MessageContainer type={getMessageType()} timestamp={timestamp}>
      {notification.map(renderNotification)}
    </MessageContainer>
  );
}

// Timeline container component
export function NotificationTimeline({
  notifications,
  maxItems = 20,
}: {
  notifications: NotificationEvent[];
  maxItems?: number;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const groupedNotifications = groupNotifications(notifications).slice(-maxItems);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current && notifications.length > 0) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [notifications.length]);

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">📭</div>
        <div>No notifications yet</div>
        <div className="text-sm">Connect to start seeing activity</div>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {groupedNotifications.length > maxItems && (
        <div className="text-center py-2 text-sm text-gray-500">
          {groupedNotifications.length - maxItems} earlier messages...
        </div>
      )}

      {groupedNotifications.map((notification) => (
        <TimelineNotification key={notification.at(0)?.id} notification={notification} />
      ))}

      {/* Invisible element to scroll to */}
      <div ref={bottomRef} />
    </div>
  );
}
