import React, { Suspense, lazy, useContext, useMemo } from 'react'
import type { OnMount } from '@monaco-editor/react'
import { AppContext } from '../../context/AppContext'

// Lazy load the Editor component from @monaco-editor/react
const Editor = lazy(() =>
  import('@monaco-editor/react').then(module => ({ default: module.default }))
)

// Helper function to trim trailing whitespace from each line
// This is necessary because terminal output often pads lines with spaces,
// which causes Monaco's word wrap to wrap at unexpected positions
const trimTrailingWhitespace = (text: string): string => {
  return text.split('\n').map(line => line.trimEnd()).join('\n')
}

interface MonacoMarkdownEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  onMount: OnMount
}

// Minimal loading skeleton for markdown editor
const MarkdownEditorSkeleton: React.FC = () => {
  return (
    <div className="monaco-editor-skeleton">
      <div className="monaco-editor-skeleton-body">
        {Array.from({ length: 15 }).map((_, i) => (
          <div key={i} className="monaco-editor-skeleton-line">
            <div className="monaco-editor-skeleton-line-number">{i + 1}</div>
            <div
              className="monaco-editor-skeleton-line-content"
              style={{ width: `${Math.random() * 60 + 30}%` }}
            ></div>
          </div>
        ))}
      </div>
      <div className="monaco-editor-skeleton-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading markdown editor...</div>
      </div>
    </div>
  )
}

// Lazy-loaded Monaco Editor specifically for Markdown
export const MonacoMarkdownEditor: React.FC<MonacoMarkdownEditorProps> = ({
  value,
  onChange,
  onMount
}) => {
  const { state } = useContext(AppContext)

  // Get editor settings with defaults
  const wordWrap = state.settings.editorWordWrap ?? true
  const minimap = state.settings.editorMinimap ?? false
  const lineNumbers = state.settings.editorLineNumbers ?? true

  // Process value to trim trailing whitespace for display
  // This fixes word wrap issues with terminal output that has lines padded with spaces
  const processedValue = useMemo(() => {
    return trimTrailingWhitespace(value)
  }, [value])

  // Monaco editor options - computed from settings
  const editorOptions = {
    minimap: { enabled: minimap },
    fontSize: 14,
    lineNumbers: lineNumbers ? 'on' as const : 'off' as const,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: wordWrap ? 'on' as const : 'off' as const,
    // Word wrap configuration
    wrappingStrategy: 'advanced' as const,
    wrappingIndent: 'same' as const,
    renderWhitespace: 'selection' as const,
    // Improve scroll and layout stability during editing
    smoothScrolling: true,
    cursorSmoothCaretAnimation: 'on' as const
  }

  // Generate a key based on settings to force re-render when settings change
  const editorKey = `markdown-${wordWrap}-${minimap}-${lineNumbers}`

  return (
    <Suspense fallback={<MarkdownEditorSkeleton />}>
      <Editor
        key={editorKey}
        height="100%"
        language="markdown"
        value={processedValue}
        theme="vs-dark"
        onChange={onChange}
        onMount={onMount}
        options={editorOptions}
      />
    </Suspense>
  )
}
