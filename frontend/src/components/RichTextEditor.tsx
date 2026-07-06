import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Heading3, Italic, List, ListOrdered } from "lucide-react";
import "./richtext.css";

/**
 * WYSIWYG editor (TipTap) — formatting shows live while typing, no preview
 * toggle. Emits HTML via onChange; parent guards empty docs with isRichTextEmpty.
 */
export default function RichTextEditor({
  value,
  onChange,
  placeholder = "",
  onSubmit,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [3] } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && onSubmit) {
          onSubmit();
          return true;
        }
        return false;
      },
    },
  });

  // External resets (e.g. composer cleared after save, or range change):
  // only push content in when the prop differs and the user isn't typing.
  useEffect(() => {
    if (editor && !editor.isFocused && editor.getHTML() !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const tools = [
    { label: "ตัวหนา", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "ตัวเอียง", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "หัวข้อ", icon: Heading3, active: editor.isActive("heading", { level: 3 }), run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: "รายการหัวข้อ", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "รายการลำดับเลข", icon: ListOrdered, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div className="richtext-editor">
      <div className="richtext-toolbar" role="toolbar" aria-label="เครื่องมือจัดรูปแบบ">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            className={"richtext-tool" + (t.active ? " is-active" : "")}
            onClick={t.run}
            aria-label={t.label}
            title={t.label}
          >
            <t.icon size={15} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
