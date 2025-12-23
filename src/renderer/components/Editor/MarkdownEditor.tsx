import React, { useEffect, useState, useContext, useRef } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import Editor, { OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { AppContext } from '../../context/AppContext'
import './MarkdownEditor.css'

interface TocItem {
  level: number
  text: string
  id: string
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  mode: 'preview' | 'edit'
  currentFilePath: string
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  mode,
  currentFilePath
}) => {
  const { state } = useContext(AppContext)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const [preview, setPreview] = useState('')
  const [toc, setToc] = useState<TocItem[]>([])
  const [showToc, setShowToc] = useState(true)
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())

  // Resolve relative image paths to HTTP Server URLs
  useEffect(() => {
    const resolveImageUrls = async () => {
      if (!currentFilePath || mode !== 'preview') return

      // Find project for this file
      const project = state.projects.find(p => currentFilePath.startsWith(p.path))
      if (!project) return

      // Extract all image sources from markdown
      const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
      const matches = [...value.matchAll(imgRegex)]

      const newUrls = new Map<string, string>()

      for (const match of matches) {
        const src = match[2]

        // Skip if already an absolute URL or data URI
        if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:')) {
          continue
        }

        // Resolve relative path
        const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'))
        let resolvedPath: string

        if (src.startsWith('/')) {
          // Absolute path from project root
          resolvedPath = project.path + src
        } else {
          // Relative path - resolve based on current file's directory
          const parts = src.split('/')
          const dirParts = currentDir.split('/')

          for (const part of parts) {
            if (part === '..') {
              dirParts.pop()
            } else if (part !== '.' && part !== '') {
              dirParts.push(part)
            }
          }

          resolvedPath = dirParts.join('/')
        }

        // Get server URL for this image
        const relativePath = resolvedPath.substring(project.path.length)
        try {
          const result = await window.api.fileServer.getUrl(
            project.id,
            project.path,
            relativePath
          )

          if (result.success && result.url) {
            newUrls.set(src, result.url)
          }
        } catch (error) {
          console.error('Error getting image URL:', error)
        }
      }

      setImageUrls(newUrls)
    }

    resolveImageUrls()
  }, [value, currentFilePath, mode, state.projects])

  useEffect(() => {
    // Configure marked for GitHub Flavored Markdown
    marked.setOptions({
      gfm: true,
      breaks: true
    })

    // Convert markdown to HTML
    let rawHTML = marked(value) as string

    // Replace relative image URLs with HTTP Server URLs
    imageUrls.forEach((serverUrl, originalSrc) => {
      // Escape special regex characters in the original source
      const escapedSrc = originalSrc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const imgSrcRegex = new RegExp(`src=["']${escapedSrc}["']`, 'g')
      rawHTML = rawHTML.replace(imgSrcRegex, `src="${serverUrl}"`)
    })

    // Extract headings for TOC
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi
    const tocItems: TocItem[] = []
    let match
    let headingIndex = 0

    while ((match = headingRegex.exec(rawHTML)) !== null) {
      const level = parseInt(match[1])
      const text = match[2].replace(/<[^>]*>/g, '') // Remove any HTML tags from heading text
      const id = `heading-${headingIndex++}`
      tocItems.push({ level, text, id })
    }

    setToc(tocItems)

    // Add IDs to headings in HTML for anchor navigation
    let htmlWithIds = rawHTML
    headingIndex = 0
    htmlWithIds = htmlWithIds.replace(/<h([1-6])([^>]*)>(.*?)<\/h\1>/gi, (_match, level, attrs, content) => {
      const id = `heading-${headingIndex++}`
      return `<h${level}${attrs} id="${id}">${content}</h${level}>`
    })

    // SECURITY: Sanitize HTML using DOMPurify to prevent XSS attacks
    // Only allow safe HTML tags and attributes
    const cleanHTML = DOMPurify.sanitize(htmlWithIds, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'hr',
        'a', 'img',
        'ul', 'ol', 'li',
        'strong', 'em', 'code', 'pre',
        'blockquote',
        'table', 'thead', 'tbody', 'tr', 'th', 'td'
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'title', 'id']
    })
    setPreview(cleanHTML)
  }, [value, imageUrls])

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor

    // Add save keyboard shortcut
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      onSave()
    })

    // Focus the editor
    editor.focus()
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value)
    }
  }

  const handleTocClick = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="markdown-editor">
      {mode === 'edit' ? (
        <div className="markdown-editor-pane-full">
          <Editor
            height="100%"
            language="markdown"
            value={value}
            theme="vs-dark"
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              renderWhitespace: 'selection'
            }}
          />
        </div>
      ) : (
        <div className="markdown-preview-container">
          {toc.length > 0 && (
            <div className={`markdown-toc ${showToc ? 'show' : 'hide'}`}>
              <div className="markdown-toc-header">
                <span className="markdown-toc-title">目录</span>
                <button
                  className="markdown-toc-toggle"
                  onClick={() => setShowToc(!showToc)}
                  title={showToc ? '隐藏目录' : '显示目录'}
                >
                  {showToc ? '◀' : '▶'}
                </button>
              </div>
              {showToc && (
                <div className="markdown-toc-content">
                  {toc.map((item, index) => (
                    <div
                      key={index}
                      className={`markdown-toc-item toc-level-${item.level}`}
                      onClick={() => handleTocClick(item.id)}
                    >
                      {item.text}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="markdown-preview-pane-full">
            {/* SAFE: HTML is sanitized with DOMPurify above before rendering */}
            <div
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
