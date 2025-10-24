import type { ContentBlock } from "@agentclientprotocol/sdk";
import type React from "react";
import { Streamdown } from "streamdown";
import { logNever } from "../../src/utils/never.js";
import { IconLabel } from "./ui-primitives.js";

export function ContentBlockComponent({
  content,
  className = "",
}: {
  content: ContentBlock;
  className?: string;
}) {
  const renderContent = (text: string) => (
    <div className={`whitespace-pre-wrap text-sm mt-2 ${className}`}>
      <Streamdown>{text}</Streamdown>
    </div>
  );

  const renderWithHeader = (
    icon: string,
    label: string,
    children: React.ReactNode,
    dataType: string,
  ) => (
    <div data-type={dataType} className="space-y-2">
      <IconLabel icon={icon} label={label} size="sm" className="opacity-70" />
      {children}
    </div>
  );

  switch (content.type) {
    case "text":
      return <span data-type="text">{renderContent(content.text)}</span>;

    case "image":
      return renderWithHeader("🖼️", "Image", renderContent(content.data), "image");

    case "audio":
      return renderWithHeader("🎧", "Audio", renderContent(content.data), "audio");

    case "resource_link":
      return renderWithHeader(
        "🔗",
        content.name || "Resource Link",
        <a
          href={content.uri}
          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors text-sm break-all"
          target="_blank"
          rel="noopener noreferrer"
        >
          {content.uri}
        </a>,
        "resource_link",
      );

    case "resource": {
      const resourceText =
        "text" in content.resource
          ? content.resource.text
          : "blob" in content.resource
            ? content.resource.blob
            : JSON.stringify(content.resource, null, 2);
      return renderWithHeader("💾", "Resource", renderContent(resourceText), "resource");
    }

    default:
      logNever(content);
      return (
        <div data-type="unknown" className="space-y-2">
          <IconLabel icon="❓" label="Unknown Content" size="sm" className="opacity-70" />
          <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-x-auto">
            {JSON.stringify(content, null, 2)}
          </pre>
        </div>
      );
  }
}
