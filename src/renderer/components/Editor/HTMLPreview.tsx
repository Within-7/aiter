import React, { useEffect, useRef, useState, useContext } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { AppContext } from '../../context/AppContext'
import { getParentDir, generateTabId } from '../../utils'
import './HTMLPreview.css'

// Helper function to trim trailing whitespace from each line
// This fixes word wrap issues with terminal output that has lines padded with spaces
const trimTrailingWhitespace = (text: string): string => {
  return text.split('\n').map(line => line.trimEnd()).join('\n')
}

interface HTMLPreviewProps {
  value: string
  onChange: (value: string) => void
  onSave: (content?: string) => void
  mode: 'preview' | 'edit'
  currentFilePath: string
  serverUrl?: string
}

export const HTMLPreview: React.FC<HTMLPreviewProps> = ({
  value,
  onChange,
  onSave,
  mode,
  currentFilePath,
  serverUrl
}) => {
  const { state, dispatch } = useContext(AppContext)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)

  // Track the last value we received from props to detect external changes
  const lastExternalValueRef = useRef<string>(value)
  // Track if we've done initial trim for this content
  const hasInitiallyTrimmedRef = useRef(false)

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
        if (clipboardText && activeElement instanceof HTMLInputElement) {
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
        } else if (clipboardText && activeElement instanceof HTMLTextAreaElement) {
          // Handle textarea (e.g., replace field)
          const start = activeElement.selectionStart ?? 0
          const end = activeElement.selectionEnd ?? 0
          const currentValue = activeElement.value
          const newValue = currentValue.slice(0, start) + clipboardText + currentValue.slice(end)

          activeElement.value = newValue
          activeElement.setSelectionRange(start + clipboardText.length, start + clipboardText.length)
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

  // Get server URL for current file when in preview mode
  useEffect(() => {
    const getServerUrl = async () => {
      if (mode === 'preview' && currentFilePath) {
        // Use provided serverUrl if available
        if (serverUrl) {
          setPreviewUrl(serverUrl)
          return
        }

        // Otherwise generate URL from file server
        setIsLoadingUrl(true)
        try {
          // Find which project this file belongs to
          const project = state.projects.find(p =>
            currentFilePath.startsWith(p.path)
          )

          if (project) {
            // Get relative path within project
            const relativePath = currentFilePath.substring(project.path.length)

            // Request server URL from main process
            const result = await window.api.fileServer.getUrl(
              project.id,
              project.path,
              relativePath
            )

            if (result.success && result.url) {
              setPreviewUrl(result.url)
            } else {
              console.error('Failed to get server URL:', result.error)
            }
          }
        } catch (error) {
          console.error('Error getting server URL:', error)
        } finally {
          setIsLoadingUrl(false)
        }
      }
    }

    getServerUrl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentFilePath, serverUrl])

  // Listen for postMessage from iframe to open links in new tabs
  useEffect(() => {
    if (mode !== 'preview') return

    const handleMessage = async (event: MessageEvent) => {
      // Only accept messages from our local file server
      if (!event.origin.startsWith('http://localhost:')) return

      const { type, href } = event.data

      if (type !== 'OPEN_IN_TAB' || !href) return

      // Find which project this file belongs to
      const project = state.projects.find(p =>
        currentFilePath.startsWith(p.path)
      )

      if (!project) return

      // Parse the href to handle query parameters and relative paths
      const currentDir = getParentDir(currentFilePath)
      let targetPath: string

      if (href.startsWith('/')) {
        // Absolute path from project root
        targetPath = project.path + href.split('?')[0]
      } else {
        // Relative path - resolve based on the current file's directory
        const baseDir = currentDir
        const hrefWithoutQuery = href.split('?')[0]

        // Resolve relative path
        const parts = hrefWithoutQuery.split('/')
        const dirParts = baseDir.split('/')

        for (const part of parts) {
          if (part === '..') {
            dirParts.pop()
          } else if (part !== '.' && part !== '') {
            dirParts.push(part)
          }
        }

        targetPath = dirParts.join('/')
      }

      // Get server URL for the target file (with query parameters preserved)
      const relativePath = targetPath.substring(project.path.length)
      const result = await window.api.fileServer.getUrl(
        project.id,
        project.path,
        relativePath
      )

      if (result.success && result.url) {
        // Extract query parameters from href
        const queryString = href.includes('?') ? href.substring(href.indexOf('?')) : ''
        const fullUrl = result.url + queryString

        // Try to extract the actual file name from query parameters
        // For example: html-viewer.html?file=./document.html -> display as "document.html"
        let displayFileName = targetPath.split('/').pop() || 'untitled'

        // Parse query params to find the actual target file
        if (queryString) {
          const params = new URLSearchParams(queryString)
          const fileParam = params.get('file')
          if (fileParam) {
            // Extract filename from the file parameter
            const actualFileName = fileParam.split('/').pop()
            if (actualFileName) {
              displayFileName = decodeURIComponent(actualFileName)
            }
          }
        }

        // Read file content to determine type
        const fileResult = await window.api.fs.readFile(targetPath)

        if (fileResult.success) {
          // Create a new editor tab with server URL (including query params)
          const tabId = generateTabId()
          const content = fileResult.content || ''

          dispatch({
            type: 'ADD_EDITOR_TAB',
            payload: {
              id: tabId,
              filePath: targetPath,
              fileName: displayFileName,
              fileType: (fileResult.fileType || 'html') as any,
              content,
              originalContent: content,  // Store original for dirty detection
              isDirty: false,
              serverUrl: fullUrl
            }
          })
        }
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentFilePath, dispatch])

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

  // Get editor settings with defaults
  const wordWrap = state.settings.editorWordWrap ?? true
  const minimap = state.settings.editorMinimap ?? false
  const lineNumbers = state.settings.editorLineNumbers ?? true

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
  const editorKey = `html-${wordWrap}-${minimap}-${lineNumbers}`

  return (
    <div className="html-preview">
      {mode === 'edit' ? (
        <div className="html-editor-pane-full">
          <Editor
            key={editorKey}
            height="100%"
            language="html"
            value={value}
            theme="vs-dark"
            onChange={handleEditorChange}
            onMount={handleEditorDidMount}
            options={editorOptions}
          />
        </div>
      ) : (
        <div className="html-preview-pane-full">
          {isLoadingUrl ? (
            <div className="html-preview-loading">
              Loading preview...
            </div>
          ) : previewUrl ? (
            <iframe
              ref={iframeRef}
              key={previewUrl} // Force reload when URL changes
              className="html-preview-iframe"
              src={previewUrl}
              sandbox="allow-same-origin allow-scripts allow-modals allow-forms allow-popups"
              title="HTML Preview"
            />
          ) : (
            <div className="html-preview-error">
              Failed to load preview. Please check the file path.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
