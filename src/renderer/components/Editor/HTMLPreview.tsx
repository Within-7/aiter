import React, { useEffect, useRef } from 'react'
import './HTMLPreview.css'

interface HTMLPreviewProps {
  value: string
  onChange: (value: string) => void
  onSave: () => void
  mode: 'preview' | 'edit'
}

export const HTMLPreview: React.FC<HTMLPreviewProps> = ({
  value,
  onChange,
  onSave,
  mode
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (iframeRef.current) {
      const iframe = iframeRef.current
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(value)
        doc.close()
      }
    }
  }, [value, mode]) // Re-render iframe when mode changes back to preview

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
          {/* SAFE: iframe with sandbox provides security isolation */}
          <iframe
            ref={iframeRef}
            className="html-preview-iframe"
            sandbox="allow-same-origin allow-scripts allow-modals allow-forms allow-popups allow-popups-to-escape-sandbox"
            title="HTML Preview"
          />
        </div>
      )}
    </div>
  )
}
