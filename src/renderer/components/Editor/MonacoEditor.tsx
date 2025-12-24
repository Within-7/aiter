import React, { useRef, useEffect } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

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
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const onSaveRef = useRef(onSave)

  // Keep onSave ref updated
  useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

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

  return (
    <Editor
      height="100%"
      language={monacoLanguage}
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
  )
}
