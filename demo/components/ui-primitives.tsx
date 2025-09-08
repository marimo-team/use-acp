import type React from "react";

// Reusable Badge component
interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "purple";
  size?: "sm" | "md";
}

export function Badge({ children, variant = "default", size = "sm" }: BadgeProps) {
  const variants = {
    default: "bg-gray-100 text-gray-800 border-gray-200",
    success: "bg-green-100 text-green-800 border-green-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    error: "bg-red-100 text-red-800 border-red-200",
    info: "bg-blue-100 text-blue-800 border-blue-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
  };

  const sizes = {
    sm: "px-1.5 py-0.5 text-xs",
    md: "px-2 py-1 text-xs",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded border ${variants[variant]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
}

// Reusable Icon Label component
interface IconLabelProps {
  icon: string;
  label: string | React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function IconLabel({ icon, label, className = "", size = "md" }: IconLabelProps) {
  const sizes = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={`flex items-center gap-2 ${sizes[size]} ${className}`}>
      <span className="text-lg">{icon}</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}

// Reusable Code Block component
interface CodeBlockProps {
  children: React.ReactNode;
  variant?: "default" | "diff-removed" | "diff-added";
  title?: string;
  className?: string;
}

export function CodeBlock({
  children,
  variant = "default",
  title,
  className = "",
}: CodeBlockProps) {
  const variants = {
    default: "bg-gray-50 border-gray-200 text-gray-800",
    "diff-removed": "bg-red-50 border-red-200 text-red-800",
    "diff-added": "bg-green-50 border-green-200 text-green-800",
  };

  return (
    <div className={className}>
      {title && (
        <div
          className={`text-xs font-medium mb-1 ${
            variant === "diff-removed"
              ? "text-red-700"
              : variant === "diff-added"
                ? "text-green-700"
                : "text-gray-700"
          }`}
        >
          {title}
        </div>
      )}
      <pre
        className={`text-xs border rounded p-2 overflow-x-auto whitespace-pre-wrap ${variants[variant]}`}
      >
        {children}
      </pre>
    </div>
  );
}

// Reusable Section Header component
interface SectionHeaderProps {
  icon: string;
  title: string;
  subtitle?: string;
  badges?: React.ReactNode[];
  className?: string;
}

export function SectionHeader({
  icon,
  title,
  subtitle,
  badges,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between mb-3 ${className}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{icon}</span>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        {subtitle && <div className="text-xs text-gray-500 font-mono ml-7">{subtitle}</div>}
      </div>
      {badges && badges.length > 0 && <div className="flex items-center gap-2 ml-2">{badges}</div>}
    </div>
  );
}

// Reusable Collapsible Details component
interface CollapsibleProps {
  summary: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Collapsible({ summary, children, className = "" }: CollapsibleProps) {
  return (
    <details className={className}>
      <summary className="text-xs text-gray-500 opacity-70 cursor-pointer hover:opacity-100">
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

// Reusable Card component
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div className={`border border-gray-200 rounded-lg p-4 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// Reusable Metadata List component
interface MetadataItem {
  label: string;
  value: string | React.ReactNode;
}

interface MetadataListProps {
  items: MetadataItem[];
  className?: string;
}

export function MetadataList({ items, className = "" }: MetadataListProps) {
  return (
    <div className={`space-y-1 ${className}`}>
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center justify-between text-xs">
          <span className="text-gray-500 opacity-70">{item.label}:</span>
          <span className="text-gray-700 font-mono">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
