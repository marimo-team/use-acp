import type { ToolCallUpdate } from "@zed-industries/agent-client-protocol/typescript/acp.js";
import type { ToolCallDiff, ToolCallStart } from "../../src/client/types.js";
import { ContentBlockComponent } from "./content-block.js";
import { Badge, Card, CodeBlock, IconLabel, SectionHeader } from "./ui-primitives.js";

interface ToolCallProps {
  toolCall: Omit<ToolCallUpdate, "sessionUpdate">;
}

function getStatusVariant(status: ToolCallStart["status"] | null) {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "in_progress":
    case "pending":
      return "warning";
    default:
      return "default";
  }
}

function getStatusIcon(status: ToolCallStart["status"] | null) {
  switch (status) {
    case "completed":
      return "✅";
    case "failed":
      return "❌";
    case "in_progress":
    case "pending":
      return "⏳";
    default:
      return "❓";
  }
}

export function DiffContent({ diff }: { diff: ToolCallDiff }) {
  const hasOldText = !!diff.oldText?.trim().length;
  const hasNewText = !!diff.newText?.trim().length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <IconLabel icon="📄" label={diff.path} size="sm" />
        <Badge variant="purple">{diff.type}</Badge>
      </div>

      {hasOldText && (
        <CodeBlock variant="diff-removed" title="- Removed">
          {diff.oldText}
        </CodeBlock>
      )}

      {hasNewText && (
        <CodeBlock variant="diff-added" title="+ Added">
          {diff.newText}
        </CodeBlock>
      )}
    </div>
  );
}

export function ToolCall({ toolCall }: ToolCallProps) {
  const badges = [
    toolCall.kind && (
      <Badge key="kind" variant="info">
        🔧 {toolCall.kind}
      </Badge>
    ),
    toolCall.status && (
      <Badge key="status" variant={getStatusVariant(toolCall.status)}>
        {getStatusIcon(toolCall.status)} {toolCall.status}
      </Badge>
    ),
  ].filter(Boolean);

  return (
    <Card>
      <SectionHeader
        icon="🔧"
        title={toolCall.title || "Tool Call"}
        subtitle={toolCall.toolCallId}
        badges={badges}
      />

      {/* Locations */}
      {toolCall.locations?.length && toolCall.locations.length > 0 && (
        <div className="mb-4">
          <IconLabel icon="📍" label="Locations" size="sm" className="mb-2 text-gray-700" />
          <div className="flex flex-wrap gap-1">
            {toolCall.locations?.map((location, index) => (
              <Badge key={`${location.path}-${index}`} variant="default" size="md">
                <code className="text-xs">
                  {location.line ? `${location.path}:${location.line}` : location.path}
                </code>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {toolCall.content?.length && toolCall.content.length > 0 && (
        <div>
          <IconLabel icon="📝" label="Changes" size="sm" className="mb-3 text-gray-700" />
          <div className="space-y-4">
            {toolCall.content?.map((item, index) => {
              if (item.type === "diff") {
                return <DiffContent key={`${item.type}-${index}`} diff={item} />;
              }
              if (item.type === "content") {
                return (
                  <ContentBlockComponent key={`${item.type}-${index}`} content={item.content} />
                );
              }
              return null;
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
