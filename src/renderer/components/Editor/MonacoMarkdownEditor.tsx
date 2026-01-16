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

  // Wrap the external onMount to add paste trimming behavior
  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    // Override paste action to trim trailing whitespace from pasted content
    editor.addAction({
      id: 'trim-trailing-whitespace-on-paste',
      label: 'Paste with trimmed trailing whitespace',
      keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyV],
      run: async (ed) => {
        try {
          const clipboardText = await navigator.clipboard.readText()
          const trimmedText = trimTrailingWhitespace(clipboardText)
          const selection = ed.getSelection()
          if (selection) {
            ed.executeEdits('paste-trimmed', [{
              range: selection,
              text: trimmedText,
              forceMoveMarkers: true
            }])
          }
        } catch {
          // If clipboard access fails, fallback to default paste behavior
          document.execCommand('paste')
        }
      }
    })

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
    editContext: true
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
