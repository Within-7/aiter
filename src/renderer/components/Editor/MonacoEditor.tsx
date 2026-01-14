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

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language,
  onChange,
  onSave
}) => {
  const { state } = useContext(AppContext)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const onSaveRef = useRef(onSave)

  // Get editor settings with defaults
  const wordWrap = state.settings.editorWordWrap ?? true
  const minimap = state.settings.editorMinimap ?? false
  const lineNumbers = state.settings.editorLineNumbers ?? true

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

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor

    // Add save keyboard shortcut - get content directly from editor
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentContent = editor.getValue()
      onSaveRef.current(currentContent)
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

  // Update editor options when settings change
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        wordWrap: wordWrap ? 'on' : 'off',
        minimap: { enabled: minimap },
        lineNumbers: lineNumbers ? 'on' : 'off'
      })
    }
  }, [wordWrap, minimap, lineNumbers])

  return (
    <Editor
      height="100%"
      language={monacoLanguage}
      value={value}
      theme="vs-dark"
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      options={{
        minimap: { enabled: minimap },
        fontSize: 14,
        lineNumbers: lineNumbers ? 'on' : 'off',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 2,
        wordWrap: wordWrap ? 'on' : 'off',
        renderWhitespace: 'selection'
      }}
    />
  )
}
