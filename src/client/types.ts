import type {
  SessionNotification,
  ToolCallContent,
} from "@zed-industries/agent-client-protocol/typescript/acp.js";

export type SessionUpdate = SessionNotification["update"];

export type AgentMessageChunkNotification = Extract<
  SessionUpdate,
  { sessionUpdate: "agent_message_chunk" }
>;
export type AgentThoughtChunkNotification = Extract<
  SessionUpdate,
  { sessionUpdate: "agent_thought_chunk" }
>;
export type ToolCallStart = Extract<SessionUpdate, { sessionUpdate: "tool_call" }>;
export type ToolCallUpdate = Extract<SessionUpdate, { sessionUpdate: "tool_call_update" }>;
export type UserMessageChunkNotification = Extract<
  SessionUpdate,
  { sessionUpdate: "user_message_chunk" }
>;
export type PlanNotification = Extract<SessionUpdate, { sessionUpdate: "plan" }>;
export type NotificationContent = AgentMessageChunkNotification["content"];
export type ToolCallDiff = Extract<ToolCallContent, { type: "diff" }>;
