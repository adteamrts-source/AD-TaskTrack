import { useMemo } from "react";
import DOMPurify from "dompurify";
import "./richtext.css";

/**
 * Sanitized rich-text renderer for TipTap HTML (WorkSummaryNote bodies).
 * Legacy rows written before the WYSIWYG editor are plain/markdown text —
 * anything not starting with a tag renders as pre-wrapped plain text.
 */
export default function RichText({ html }: { html: string }) {
  const isHtml = /^\s*</.test(html);
  const clean = useMemo(
    () => (isHtml ? DOMPurify.sanitize(html, { USE_PROFILES: { html: true } }) : ""),
    [html, isHtml],
  );
  if (!isHtml) {
    return <p className="richtext whitespace-pre-wrap break-words">{html}</p>;
  }
  return <div className="richtext break-words" dangerouslySetInnerHTML={{ __html: clean }} />;
}

/** True when the HTML has no visible text (TipTap's empty doc is "<p></p>"). */
export function isRichTextEmpty(html: string): boolean {
  return !html.replace(/<[^>]*>/g, "").trim();
}
