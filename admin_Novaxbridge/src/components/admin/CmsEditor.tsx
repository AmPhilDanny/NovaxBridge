import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import {
  Bold, Italic, Underline as UnderlineIcon, Heading2, Heading3,
  List, ListOrdered, Link as LinkIcon, Image as ImageIcon,
  AlignLeft, AlignCenter, AlignRight, Undo2, Redo2, Unlink,
} from 'lucide-react';
import { useState, useCallback } from 'react';

interface CmsEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function CmsEditor({ content, onChange, placeholder }: CmsEditorProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false }),
      Image.configure({ inline: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: placeholder || 'Start writing...' }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const handleSetLink = useCallback(() => {
    if (!editor) return;
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    setLinkUrl('');
    setShowLinkInput(false);
  }, [editor, linkUrl]);

  const handleAddImage = useCallback(() => {
    if (!editor || !imageUrl) return;
    editor.chain().focus().setImage({ src: imageUrl }).run();
    setImageUrl('');
    setShowImageInput(false);
  }, [editor, imageUrl]);

  const handleUnlink = useCallback(() => {
    editor?.chain().focus().unsetLink().run();
  }, [editor]);

  if (!editor) return null;

  const ToolButton = ({ active, onClick, children, title }: {
    active?: boolean; onClick: () => void; children: React.ReactNode; title?: string;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded hover:bg-muted transition-colors ${active ? 'bg-muted text-primary' : 'text-muted-foreground'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        <ToolButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="w-4 h-4" />
        </ToolButton>

        <span className="w-px h-5 bg-border mx-1" />

        <ToolButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="w-4 h-4" />
        </ToolButton>

        <span className="w-px h-5 bg-border mx-1" />

        <ToolButton title="Bullet List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Ordered List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="w-4 h-4" />
        </ToolButton>

        <span className="w-px h-5 bg-border mx-1" />

        <ToolButton title="Align Left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <AlignLeft className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Align Center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <AlignCenter className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Align Right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <AlignRight className="w-4 h-4" />
        </ToolButton>

        <span className="w-px h-5 bg-border mx-1" />

        <ToolButton title="Link" active={editor.isActive('link')} onClick={() => {
          if (editor.isActive('link')) {
            handleUnlink();
          } else {
            const prev = editor.getAttributes('link').href as string || '';
            setLinkUrl(prev);
            setShowLinkInput(true);
          }
        }}>
          <LinkIcon className="w-4 h-4" />
        </ToolButton>
        {editor.isActive('link') && (
          <ToolButton title="Remove Link" onClick={handleUnlink}>
            <Unlink className="w-4 h-4" />
          </ToolButton>
        )}
        <ToolButton title="Image" active={showImageInput} onClick={() => setShowImageInput(!showImageInput)}>
          <ImageIcon className="w-4 h-4" />
        </ToolButton>

        <span className="w-px h-5 bg-border mx-1" />

        <ToolButton title="Undo" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="w-4 h-4" />
        </ToolButton>
        <ToolButton title="Redo" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="w-4 h-4" />
        </ToolButton>
      </div>

      {/* Link Input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="flex-1 text-sm border rounded px-2 py-1 bg-background"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSetLink(); }}
          />
          <Button size="sm" type="button" onClick={handleSetLink}>Apply</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setShowLinkInput(false)}>Cancel</Button>
        </div>
      )}

      {/* Image Input */}
      {showImageInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/20">
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://...image.jpg"
            className="flex-1 text-sm border rounded px-2 py-1 bg-background"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddImage(); }}
          />
          <Button size="sm" type="button" onClick={handleAddImage}>Add</Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setShowImageInput(false)}>Cancel</Button>
        </div>
      )}

      {/* Editor Content */}
      <div className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none cms-editor-content">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
