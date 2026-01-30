import React, { Suspense, lazy, useContext, useRef, useEffect } from 'react'
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

  // Track the last value we received from props to detect external changes
  const lastExternalValueRef = useRef<string>(value)
  // Track if we've done initial trim for this content
  const hasInitiallyTrimmedRef = useRef(false)

  // Get editor settings with defaults
  const wordWrap = state.settings.editorWordWrap ?? true
  const minimap = state.settings.editorMinimap ?? false
  const lineNumbers = state.settings.editorLineNumbers ?? true

  // Handle paste in Monaco Editor's Find Widget
  // Electron 34+ dropped support for document.execCommand('paste'), which Monaco relies on.
  // We intercept Ctrl/Cmd+V when the Find Widget input is focused and manually insert clipboard text.
  // See: https://github.com/microsoft/monaco-editor/issues/4855
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if Ctrl+V or Cmd+V
      const isPasteShortcut = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v'
      if (!isPasteShortcut) return

      // Check if the active element is inside Monaco's Find Widget
      const activeElement = document.activeElement
      if (!activeElement) return

      // Find Widget inputs have class 'input' inside '.find-widget'
      const findWidget = activeElement.closest('.find-widget')
      if (!findWidget) return

      // It's a paste in Find Widget - handle it manually
      e.preventDefault()
      e.stopPropagation()

      try {
        const clipboardText = window.api.clipboard.readText()
        if (clipboardText && (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement)) {
          // Insert text at cursor position in the input field
          const start = activeElement.selectionStart ?? 0
          const end = activeElement.selectionEnd ?? 0
          const currentValue = activeElement.value
          const newValue = currentValue.slice(0, start) + clipboardText + currentValue.slice(end)

          // Set the value and trigger input event for Monaco to pick up the change
          activeElement.value = newValue
          activeElement.setSelectionRange(start + clipboardText.length, start + clipboardText.length)

          // Dispatch input event to notify Monaco of the change
          activeElement.dispatchEvent(new Event('input', { bubbles: true }))
        }
      } catch (error) {
        console.error('Failed to paste in Find Widget:', error)
      }
    }

    // Use capture phase to intercept before Monaco handles it
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  // Trim trailing whitespace on initial load only
  // This fixes word wrap issues without causing cursor jumping during editing
  useEffect(() => {
    // Check if this is a new/different file (external value changed significantly)
    const isNewFile = lastExternalValueRef.current !== value &&
                      Math.abs(lastExternalValueRef.current.length - value.length) > 10

    if (!hasInitiallyTrimmedRef.current || isNewFile) {
      const trimmed = trimTrailingWhitespace(value)
      if (trimmed !== value) {
        // Only trigger onChange if we actually trimmed something
        onChange(trimmed)
      }
      hasInitiallyTrimmedRef.current = true
      lastExternalValueRef.current = trimmed
    } else {
      // Track the value for comparison
      lastExternalValueRef.current = value
    }
  }, [value, onChange])

  // Wrap the external onMount to add additional behavior
  // Note: We no longer override Ctrl+V because it interferes with paste in Find Widget.
  // Trailing whitespace trimming is handled on initial file load instead.
  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    // Call the external onMount handler
    onMount(editor, monacoInstance)
  }

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
    // Fix for horizontal scroll flickering when typing in word wrap mode
    // See: https://github.com/microsoft/monaco-editor/issues/4444
    scrollBeyondLastColumn: 0,
    // Disable horizontal scrollbar when word wrap is enabled
    scrollbar: {
      horizontal: wordWrap ? 'hidden' as const : 'auto' as const,
      horizontalScrollbarSize: wordWrap ? 0 : 10,
      alwaysConsumeMouseWheel: false
    },
    // Enable EditContext API to fix IME (Chinese/Japanese/Korean input) flickering
    // when using word wrap. This is the same fix VSCode uses (editor.editContext setting).
    // See: https://github.com/microsoft/monaco-editor/issues/4592
    // See: https://code.visualstudio.com/updates/v1_101#_edit-context
    editContext: true,
    // Fix Find Widget tooltips appearing outside visible area
    fixedOverflowWidgets: true
  }

  // Generate a key based on settings to force re-render when settings change
  const editorKey = `markdown-${wordWrap}-${minimap}-${lineNumbers}`

  return (
    <Suspense fallback={<MarkdownEditorSkeleton />}>
      <Editor
        key={editorKey}
        height="100%"
        language="markdown"
        value={value}
        theme="vs-dark"
        onChange={onChange}
        onMount={handleEditorMount}
        options={editorOptions}
      />
    </Suspense>
  )
}
