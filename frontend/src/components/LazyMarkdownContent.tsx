import { lazy, Suspense } from "react";

const MarkdownContent = lazy(() => import("./MarkdownContent"));

export default function LazyMarkdownContent({ value, compact = false }: { value: string; compact?: boolean }) {
  if (!value.trim()) return null;

  return (
    <Suspense fallback={<p className={compact ? "markdown-placeholder text-xs" : "markdown-placeholder"}>{value}</p>}>
      <MarkdownContent value={value} compact={compact} />
    </Suspense>
  );
}
