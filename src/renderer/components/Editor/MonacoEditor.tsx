import React, { useRef, useEffect, useContext } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { AppContext } from '../../context/AppContext'

interface MonacoEditorProps {
  value: string
  language: string
  onChange: (value: string) => void
  onSave: (content: string) => void
}

const languageMap: Record<string, string> = {
  // Web languages
  javascript: 'javascript',
  typescript: 'typescript',
  html: 'html',
  css: 'css',
  json: 'json',
  markdown: 'markdown',
  // Programming languages
  python: 'python',
  java: 'java',
  c: 'c',
  cpp: 'cpp',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
  shell: 'shell',
  sql: 'sql',
  // Config formats
  yaml: 'yaml',
  xml: 'xml',
  dockerfile: 'dockerfile',
  // Fallback
  text: 'plaintext',
  other: 'plaintext'
}

// Helper function to trim trailing whitespace from each line
// This is necessary because terminal output often pads lines with spaces,
// which causes Monaco's word wrap to wrap at unexpected positions
const trimTrailingWhitespace = (text: string): string => {
  return text.split('\n').map(line => line.trimEnd()).join('\n')
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language,
  onChange,
  onSave
}) => {
  const { state } = useContext(AppContext)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const onSaveRef = useRef(onSave)

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

  // Keep onSave ref updated
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  // Listen for voice input text insertion events
  useEffect(() => {
    const handleVoiceInsert = (event: CustomEvent<{ text: string }>) => {
      const editor = editorRef.current
      if (!editor) return

      const selection = editor.getSelection()
      if (!selection) return

      // Insert text at cursor position
      editor.executeEdits('voice-input', [{
        range: selection,
        text: event.detail.text,
        forceMoveMarkers: true
      }])

      // Update the content through onChange
      const newContent = editor.getValue()
      onChange(newContent)

      // Focus the editor after insertion
      editor.focus()
    }

    window.addEventListener('voice-input-insert', handleVoiceInsert as EventListener)
    return () => {
      window.removeEventListener('voice-input-insert', handleVoiceInsert as EventListener)
    }
  }, [onChange])

  const handleEditorDidMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor

    // Add save keyboard shortcut - get content directly from editor
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      const currentContent = editor.getValue()
      onSaveRef.current(currentContent)
    })

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

    // Focus the editor
    editor.focus()
  }

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value)
    }
  }

  const monacoLanguage = languageMap[language] || 'plaintext'

  // Monaco editor options - computed from settings
  //
  // Note: We trim trailing whitespace on initial file load to fix word wrap issues
  // with terminal output that has lines padded with spaces
  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    minimap: { enabled: minimap },
    fontSize: 14,
    lineNumbers: lineNumbers ? 'on' : 'off',
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: wordWrap ? 'on' : 'off',
    // Word wrap configuration:
    // - wrappingStrategy: 'advanced' uses a smarter algorithm that considers word boundaries
    // - wrappingIndent: 'same' keeps wrapped lines aligned with the original line
    wrappingStrategy: 'advanced',
    wrappingIndent: 'same',
    renderWhitespace: 'selection',
    // Fix for horizontal scroll flickering when typing in word wrap mode
    // See: https://github.com/microsoft/monaco-editor/issues/4444
    // Setting scrollBeyondLastColumn to 0 prevents the editor from scrolling
    // horizontally when the cursor is at the end of a wrapped line
    scrollBeyondLastColumn: 0,
    // Disable horizontal scrollbar when word wrap is enabled
    scrollbar: {
      horizontal: wordWrap ? 'hidden' : 'auto',
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
  // This ensures Monaco Editor picks up the new options reliably
  const editorKey = `editor-${wordWrap}-${minimap}-${lineNumbers}`

  return (
    <Editor
      key={editorKey}
      height="100%"
      language={monacoLanguage}
      value={value}
      theme="vs-dark"
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      options={editorOptions}
    />
  )
}
