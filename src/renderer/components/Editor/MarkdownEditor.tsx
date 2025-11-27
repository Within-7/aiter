import React, { useEffect, useState } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
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
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  mode
}) => {
  const [preview, setPreview] = useState('')
  const [toc, setToc] = useState<TocItem[]>([])
  const [showToc, setShowToc] = useState(true)

  useEffect(() => {
    // Configure marked for GitHub Flavored Markdown
    marked.setOptions({
      gfm: true,
      breaks: true
    })

    // Convert markdown to HTML
    const rawHTML = marked(value) as string

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
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      onSave()
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
          <textarea
            className="markdown-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your markdown here..."
            spellCheck={false}
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
