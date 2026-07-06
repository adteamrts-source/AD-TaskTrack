import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Bold, Eye, Italic, Link, List, ListOrdered, PencilLine } from "lucide-react";
import LazyMarkdownContent from "./LazyMarkdownContent";
import "./markdown.css";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  id?: string;
  rows?: number;
}

export default function MarkdownEditor({
  value, onChange, onSubmit, placeholder, id = "daily-detail", rows = 4,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");

  const restoreSelection = (start: number, end: number) => {
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start, end);
    });
  };

  const wrapSelection = (before: string, after: string, fallback: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const selection = value.slice(start, end) || fallback;
    onChange(`${value.slice(0, start)}${before}${selection}${after}${value.slice(end)}`);
    restoreSelection(start + before.length, start + before.length + selection.length);
  };

  const formatList = (ordered: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd } = textarea;
    const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
    const nextBreak = value.indexOf("\n", selectionEnd);
    const lineEnd = nextBreak === -1 ? value.length : nextBreak;
    const block = value.slice(lineStart, lineEnd) || "รายการ";
    const formatted = block
      .split("\n")
      .map((line, index) => `${ordered ? `${index + 1}.` : "-"} ${line || "รายการ"}`)
      .join("\n");
    onChange(`${value.slice(0, lineStart)}${formatted}${value.slice(lineEnd)}`);
    restoreSelection(lineStart, lineStart + formatted.length);
  };

  const insertLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const label = value.slice(start, end) || "ข้อความลิงก์";
    const markdown = `[${label}](https://)`;
    onChange(`${value.slice(0, start)}${markdown}${value.slice(end)}`);
    const urlStart = start + label.length + 3;
    restoreSelection(urlStart, urlStart + "https://".length);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(event.metaKey || event.ctrlKey)) return;
    const key = event.key.toLowerCase();
    if (key === "enter" && onSubmit) {
      event.preventDefault();
      onSubmit();
    } else if (key === "b") {
      event.preventDefault();
      wrapSelection("**", "**", "ข้อความตัวหนา");
    } else if (key === "i") {
      event.preventDefault();
      wrapSelection("_", "_", "ข้อความตัวเอียง");
    } else if (key === "k") {
      event.preventDefault();
      insertLink();
    }
  };

  return (
    <div className="markdown-editor">
      <div className="markdown-toolbar" role="toolbar" aria-label="เครื่องมือจัดรูปแบบรายละเอียดงาน">
        <div className="markdown-tools">
          <EditorTool label="ตัวหนา" disabled={mode === "preview"} onClick={() => wrapSelection("**", "**", "ข้อความตัวหนา")}>
            <Bold size={16} />
          </EditorTool>
          <EditorTool label="ตัวเอียง" disabled={mode === "preview"} onClick={() => wrapSelection("_", "_", "ข้อความตัวเอียง")}>
            <Italic size={16} />
          </EditorTool>
          <EditorTool label="รายการหัวข้อ" disabled={mode === "preview"} onClick={() => formatList(false)}>
            <List size={16} />
          </EditorTool>
          <EditorTool label="รายการลำดับเลข" disabled={mode === "preview"} onClick={() => formatList(true)}>
            <ListOrdered size={16} />
          </EditorTool>
          <EditorTool label="แทรกลิงก์" disabled={mode === "preview"} onClick={insertLink}>
            <Link size={16} />
          </EditorTool>
        </div>
        <div className="markdown-mode" aria-label="โหมด editor">
          <button type="button" className={mode === "write" ? "active" : ""} onClick={() => setMode("write")}>
            <PencilLine size={14} /> เขียน
          </button>
          <button type="button" className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>
            <Eye size={14} /> ตัวอย่าง
          </button>
        </div>
      </div>

      {mode === "write" ? (
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="รายละเอียดงาน"
          rows={rows}
        />
      ) : (
        <div className="markdown-preview" aria-label="ตัวอย่างรายละเอียดงาน">
          {value.trim() ? <LazyMarkdownContent value={value} /> : <p className="markdown-placeholder">ยังไม่มีรายละเอียด</p>}
        </div>
      )}
    </div>
  );
}

function EditorTool({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="markdown-tool" disabled={disabled} onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  );
}
