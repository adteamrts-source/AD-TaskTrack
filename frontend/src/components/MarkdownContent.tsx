import ReactMarkdown, { type Components } from "react-markdown";
import "./markdown.css";

const MARKDOWN_COMPONENTS: Components = {
  a({ node: _node, ...props }) {
    return <a {...props} target="_blank" rel="noreferrer" />;
  },
};

export default function MarkdownContent({ value, compact = false }: { value: string; compact?: boolean }) {
  if (!value.trim()) return null;

  return (
    <div className={`markdown-content${compact ? " markdown-content--compact" : ""}`}>
      <ReactMarkdown skipHtml components={MARKDOWN_COMPONENTS}>{value}</ReactMarkdown>
    </div>
  );
}
