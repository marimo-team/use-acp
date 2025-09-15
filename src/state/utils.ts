import type { ToolCallUpdate } from "@zed-industries/agent-client-protocol/typescript/acp.js";
import type { SessionUpdate } from "../client/types.js";
import { invariant } from "../utils/never.js";
import type { NotificationEvent } from "./types.js";

/**
 * Group notifications by their type
 */
export function groupNotifications(notifications: NotificationEvent[]): NotificationEvent[][] {
  const result: NotificationEvent[][] = [];
  for (const notification of notifications) {
    const lastGroup = result[result.length - 1];
    if (lastGroup && isSameType(lastGroup.at(0), notification)) {
      lastGroup.push(notification);
    } else {
      result.push([notification]);
    }
  }
  return result;
}

const TOOL_TYPES: SessionUpdate["sessionUpdate"][] = ["tool_call", "tool_call_update"];

function isSameType(a: NotificationEvent | undefined, b: NotificationEvent): boolean {
  if (!a) return false;
  if (a.type === "session_notification" && b.type === "session_notification") {
    // Group tool calls together (may have multiple tool-ids)
    if (
      TOOL_TYPES.includes(a.data.update.sessionUpdate) &&
      TOOL_TYPES.includes(b.data.update.sessionUpdate)
    ) {
      return true;
    }
    return a.data.update.sessionUpdate === b.data.update.sessionUpdate;
  }
  return a.type === b.type;
}

export function mergeToolCalls(calls: ToolCallUpdate[]): ToolCallUpdate[] {
  const map = new Map<string, ToolCallUpdate[]>();
  for (const call of calls) {
    if (!map.has(call.toolCallId)) {
      map.set(call.toolCallId, []);
    }
    map.get(call.toolCallId)?.push(call);
  }
  return Array.from(map.values()).map((calls) => {
    const first = calls.at(0);
    invariant(!!first?.toolCallId, "Tool call ID is required");
    return {
      ...first,
      toolCallId: first.toolCallId,
      status: calls.at(-1)?.status,
      rawOutput: Object.assign({}, ...calls.map((call) => call.rawOutput)),
      locations: calls.flatMap((call) => call.locations || []),
      content: calls.flatMap((call) => call.content || []),
    } satisfies ToolCallUpdate;
  });
}
