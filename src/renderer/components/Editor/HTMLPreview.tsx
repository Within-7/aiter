import React, { useEffect, useRef, useState, useContext } from 'react'
import { AppContext } from '../../context/AppContext'
import './HTMLPreview.css'

interface HTMLPreviewProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
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
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [isLoadingUrl, setIsLoadingUrl] = useState(false)

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

      const { type, href, baseUrl } = event.data

      if (type !== 'OPEN_IN_TAB' || !href) return

      // Find which project this file belongs to
      const project = state.projects.find(p =>
        currentFilePath.startsWith(p.path)
      )

      if (!project) return

      // Parse the href to handle query parameters and relative paths
      const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'))
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
          // Generate unique ID for each tab
          const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

          dispatch({
            type: 'ADD_EDITOR_TAB',
            payload: {
              id: tabId,
              filePath: targetPath,
              fileName: displayFileName,
              fileType: (fileResult.fileType || 'html') as any,
              content: fileResult.content || '',
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      onSave()
    }
  }

  return (
    <div className="html-preview">
      {mode === 'edit' ? (
        <div className="html-editor-pane-full">
          <textarea
            className="html-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your HTML here..."
            spellCheck={false}
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
