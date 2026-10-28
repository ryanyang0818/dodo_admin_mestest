import FileHandler from "@tiptap/extension-file-handler"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import type { Editor, JSONContent } from "@tiptap/react"
import { EditorContent, mergeAttributes, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  ImagePlus,
  Italic,
  Link,
  List,
  ListOrdered,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { OpenAPI } from "@/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type BulletinImageUploadResult = {
  id: string
  url: string
}

type BulletinEditorProps = {
  value: JSONContent
  onChange?: (value: JSONContent) => void
  onUploadImage?: (file: File) => Promise<BulletinImageUploadResult>
  readOnly?: boolean
  className?: string
}

// 將後端相對 URL 轉成目前環境可讀取的完整 URL
function resolveApiUrl(value: unknown) {
  const src = String(value ?? "")
  if (!src.startsWith("/") || !OpenAPI.BASE) return src
  return `${OpenAPI.BASE.replace(/\/$/, "")}${src}`
}

// 擴充 Tiptap 圖片節點，保留後端 asset ID 並解析 API URL
const BulletinImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      assetId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-asset-id"),
        renderHTML: (attributes) => ({
          "data-asset-id": attributes.assetId,
        }),
      },
    }
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        src: resolveApiUrl(HTMLAttributes.src),
      }),
    ]
  },
})

// 建立編輯與唯讀共用的 Tiptap extension 白名單
function buildExtensions(
  uploadImage?: (file: File) => Promise<BulletinImageUploadResult>,
) {
  const extensions = [
    StarterKit.configure({
      link: {
        openOnClick: false,
        autolink: true,
      },
    }),
    BulletinImage.configure({
      allowBase64: false,
      HTMLAttributes: {
        class: "bulletin-image",
      },
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({ placeholder: "輸入公告內容…" }),
  ]

  if (uploadImage) {
    const insertFile = async (
      editor: Editor,
      file: File,
      position?: number,
    ) => {
      const uploaded = await uploadImage(file)
      const chain = editor.chain().focus()
      if (position !== undefined) chain.setTextSelection(position)
      chain
        .insertContent({
          type: "image",
          attrs: {
            src: uploaded.url,
            assetId: uploaded.id,
            alt: file.name,
          },
        })
        .run()
    }

    extensions.push(
      FileHandler.configure({
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        onPaste: (editor, files) => {
          for (const file of files) void insertFile(editor, file)
        },
        onDrop: (editor, files, position) => {
          for (const file of files) void insertFile(editor, file, position)
        },
      }) as (typeof extensions)[number],
    )
  }

  return extensions
}

// 顯示富文字編輯器或唯讀文章內容
export function BulletinEditor({
  value,
  onChange,
  onUploadImage,
  readOnly = false,
  className,
}: BulletinEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const extensions = useMemo(
    () => buildExtensions(readOnly ? undefined : onUploadImage),
    [onUploadImage, readOnly],
  )
  const editor = useEditor({
    extensions,
    content: value,
    editable: !readOnly,
    immediatelyRender: false,
    onUpdate: ({ editor: activeEditor }) => {
      if (!readOnly) onChange?.(activeEditor.getJSON())
    },
  })

  useEffect(() => {
    if (!editor) return
    const nextValue = JSON.stringify(value)
    const currentValue = JSON.stringify(editor.getJSON())
    if (nextValue !== currentValue) {
      editor.commands.setContent(value, { emitUpdate: false })
    }
  }, [editor, value])

  // 從工具列選檔並在目前游標位置插入圖片
  const handleImageSelection = async (file?: File) => {
    if (!file || !editor || !onUploadImage) return
    setIsUploading(true)
    try {
      const uploaded = await onUploadImage(file)
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: {
            src: uploaded.url,
            assetId: uploaded.id,
            alt: file.name,
          },
        })
        .run()
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  if (!editor) return null

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-background",
        readOnly && "border-0",
        className,
      )}
    >
      {!readOnly && (
        <div className="flex flex-wrap gap-1 border-b bg-muted/30 p-2">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBold().run()}
            aria-label="粗體"
          >
            <Bold />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            aria-label="斜體"
          >
            <Italic />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            aria-label="底線"
          >
            <Underline />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            aria-label="標題"
          >
            <Heading2 />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            aria-label="項目清單"
          >
            <List />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            aria-label="編號清單"
          >
            <ListOrdered />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            aria-label="靠左"
          >
            <AlignLeft />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            aria-label="置中"
          >
            <AlignCenter />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            aria-label="靠右"
          >
            <AlignRight />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              const previous = editor.getAttributes("link").href as
                | string
                | undefined
              const href = window.prompt(
                "請輸入連結網址",
                previous ?? "https://",
              )
              if (href === null) return
              if (!href.trim()) editor.chain().focus().unsetLink().run()
              else
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .setLink({ href: href.trim() })
                  .run()
            }}
            aria-label="連結"
          >
            <Link />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().undo().run()}
            aria-label="復原"
          >
            <Undo2 />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={() => editor.chain().focus().redo().run()}
            aria-label="重做"
          >
            <Redo2 />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) =>
              void handleImageSelection(event.target.files?.[0])
            }
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!onUploadImage || isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus />
            {isUploading ? "上傳中" : "插入圖片"}
          </Button>
        </div>
      )}
      <EditorContent
        editor={editor}
        className={cn("bulletin-content", readOnly ? "min-h-0" : "min-h-72")}
      />
    </div>
  )
}

export const EMPTY_BULLETIN_CONTENT: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
}
