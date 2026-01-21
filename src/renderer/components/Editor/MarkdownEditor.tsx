import React, { useEffect, useState, useContext, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import type { OnMount } from '@monaco-editor/react'
import type * as monaco from 'monaco-editor'
import { AppContext } from '../../context/AppContext'
import { MonacoMarkdownEditor } from './MonacoMarkdownEditor'
import './MarkdownEditor.css'
import './MonacoEditorLazy.css'

interface TocItem {
  level: number
  text: string
  id: string
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  onSave: (content?: string) => void
  mode: 'preview' | 'edit'
  currentFilePath: string
  tabId?: string // Unique ID for this editor instance
}

// Global map to store preview scroll positions per file path
const previewScrollPositionMap = new Map<string, number>()
// Global map to store editor scroll positions per file path
const editorScrollPositionMap = new Map<string, { scrollTop: number; scrollLeft: number }>()

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  onSave,
  mode,
  currentFilePath,
  tabId
}) => {
  const { t } = useTranslation('editor')
  const { state } = useContext(AppContext)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const [preview, setPreview] = useState('')
  const [toc, setToc] = useState<TocItem[]>([])
  const [showToc, setShowToc] = useState(true)
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map())

  // Track previous file path to detect when file changes (for preview tab replacement)
  const prevFilePathRef = useRef<string>(currentFilePath)

  // Generate unique ID prefix for this editor instance to avoid DOM conflicts
  const instanceId = useRef(tabId || `md-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

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

    // Extract headings for TOC with unique IDs per instance
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h\1>/gi
    const tocItems: TocItem[] = []
    let match
    let headingIndex = 0

    while ((match = headingRegex.exec(rawHTML)) !== null) {
      const level = parseInt(match[1])
      const text = match[2].replace(/<[^>]*>/g, '') // Remove any HTML tags from heading text
      // Use instanceId to create unique IDs across multiple editor instances
      const id = `${instanceId.current}-heading-${headingIndex++}`
      tocItems.push({ level, text, id })
    }

    setToc(tocItems)

    // Add IDs to headings in HTML for anchor navigation
    let htmlWithIds = rawHTML
    headingIndex = 0
    htmlWithIds = htmlWithIds.replace(/<h([1-6])([^>]*)>(.*?)<\/h\1>/gi, (_match, level, attrs, content) => {
      const id = `${instanceId.current}-heading-${headingIndex++}`
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

  // Keep onSave ref updated
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  // Focus editor when switching to edit mode
  useEffect(() => {
    if (mode === 'edit' && editorRef.current) {
      editorRef.current.focus()
    }
  }, [mode])

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor

    // Add save keyboard shortcut - get content directly from editor
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      const currentContent = editor.getValue()
      onSaveRef.current(currentContent)
    })

    // Restore editor scroll position if available
    const savedPosition = editorScrollPositionMap.get(currentFilePath)
    if (savedPosition) {
      // Use requestAnimationFrame to ensure editor is fully initialized
      requestAnimationFrame(() => {
        editor.setScrollTop(savedPosition.scrollTop)
        editor.setScrollLeft(savedPosition.scrollLeft)
      })
    }

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

  // Save scroll position when scrolling in preview mode
  const handlePreviewScroll = useCallback(() => {
    if (previewRef.current && currentFilePath) {
      previewScrollPositionMap.set(currentFilePath, previewRef.current.scrollTop)
    }
  }, [currentFilePath])

  // Detect when file path changes (preview tab replaced with new file)
  useEffect(() => {
    if (prevFilePathRef.current !== currentFilePath) {
      // File path changed - this is a different file now
      // Update the ref and don't restore old scroll position
      prevFilePathRef.current = currentFilePath
      // Update instanceId for unique heading IDs
      instanceId.current = tabId || `md-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }, [currentFilePath, tabId])

  // Restore scroll position when component mounts or mode changes
  useEffect(() => {
    if (mode === 'preview' && previewRef.current && currentFilePath) {
      const savedPosition = previewScrollPositionMap.get(currentFilePath)
      if (savedPosition !== undefined) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          if (previewRef.current) {
            previewRef.current.scrollTop = savedPosition
          }
        })
      }
    }
  }, [mode, currentFilePath, preview]) // Also depend on preview to restore after content renders

  // Save editor scroll position before unmounting or switching modes
  useEffect(() => {
    return () => {
      // Save editor scroll position on cleanup
      if (editorRef.current && currentFilePath) {
        const scrollTop = editorRef.current.getScrollTop()
        const scrollLeft = editorRef.current.getScrollLeft()
        editorScrollPositionMap.set(currentFilePath, { scrollTop, scrollLeft })
      }
    }
  }, [currentFilePath, mode])

  return (
    <div className="markdown-editor">
      {mode === 'edit' ? (
        <div className="markdown-editor-pane-full">
          <MonacoMarkdownEditor
            value={value}
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
          />
        </div>
      ) : (
        <div className="markdown-preview-container">
          {toc.length > 0 && (
            <div className={`markdown-toc ${showToc ? 'show' : 'hide'}`}>
              <div className="markdown-toc-header">
                <span className="markdown-toc-title">{t('markdown.toc', 'Table of Contents')}</span>
                <button
                  className="markdown-toc-toggle"
                  onClick={() => setShowToc(!showToc)}
                  title={showToc ? t('markdown.hideToc', 'Hide Table of Contents') : t('markdown.showToc', 'Show Table of Contents')}
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
              ref={previewRef}
              className="markdown-preview"
              dangerouslySetInnerHTML={{ __html: preview }}
              onScroll={handlePreviewScroll}
            />
          </div>
        </div>
      )}
    </div>
  )
}
