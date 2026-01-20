import React, { Suspense, lazy } from 'react'
import './MonacoEditorLazy.css'

// Lazy load Monaco Editor component
const MonacoEditor = lazy(() =>
  import('./MonacoEditor').then(module => ({ default: module.MonacoEditor }))
)

interface MonacoEditorProps {
  value: string
  language: string
  onChange: (value: string) => void
  onSave: (content: string) => void
  isActive?: boolean
}

// Loading skeleton that mimics Monaco Editor appearance
const MonacoEditorSkeleton: React.FC = () => {
  return (
    <div className="monaco-editor-skeleton">
      <div className="monaco-editor-skeleton-header">
        <div className="monaco-editor-skeleton-gutter"></div>
        <div className="monaco-editor-skeleton-toolbar">
          <div className="monaco-editor-skeleton-toolbar-item"></div>
          <div className="monaco-editor-skeleton-toolbar-item"></div>
          <div className="monaco-editor-skeleton-toolbar-item"></div>
        </div>
      </div>
      <div className="monaco-editor-skeleton-body">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="monaco-editor-skeleton-line">
            <div className="monaco-editor-skeleton-line-number">{i + 1}</div>
            <div
              className="monaco-editor-skeleton-line-content"
              style={{ width: `${Math.random() * 60 + 20}%` }}
            ></div>
          </div>
        ))}
      </div>
      <div className="monaco-editor-skeleton-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading editor...</div>
      </div>
    </div>
  )
}

// Lazy-loaded Monaco Editor with Suspense boundary
export const MonacoEditorLazy: React.FC<MonacoEditorProps> = (props) => {
  return (
    <Suspense fallback={<MonacoEditorSkeleton />}>
      <MonacoEditor {...props} />
    </Suspense>
  )
}
