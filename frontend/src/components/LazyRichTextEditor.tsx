import { Suspense, lazy, type ComponentProps } from "react";

// TipTap (+prosemirror) is heavy — keep it out of the main bundle.
const RichTextEditor = lazy(() => import("./RichTextEditor"));

export default function LazyRichTextEditor(props: ComponentProps<typeof RichTextEditor>) {
  return (
    <Suspense
      fallback={<div className="richtext-editor p-3 text-sm text-txt-faint">กำลังโหลด editor…</div>}
    >
      <RichTextEditor {...props} />
    </Suspense>
  );
}
