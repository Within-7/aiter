import React, { useState, useEffect } from 'react'
import './OfficeViewer.css'

interface OfficeViewerProps {
  filePath: string
  fileName: string
  fileType: 'word' | 'excel' | 'powerpoint'
}

export const OfficeViewer: React.FC<OfficeViewerProps> = ({
  filePath,
  fileName,
  fileType
}) => {
  const [fileSize, setFileSize] = useState<string>('Calculating...')
  const [isOpening, setIsOpening] = useState(false)

  // Get file size
  useEffect(() => {
    const getFileSize = async () => {
      try {
        const result = await window.api.fs.readFile(filePath)
        if (result.success && result.content) {
          // Calculate approximate file size from content length
          const sizeInBytes = new Blob([result.content]).size
          setFileSize(formatFileSize(sizeInBytes))
        } else {
          setFileSize('Unknown')
        }
      } catch (error) {
        setFileSize('Unknown')
      }
    }

    getFileSize()
  }, [filePath])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = () => {
    switch (fileType) {
      case 'word':
        return (
          <svg className="office-icon" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="4" width="32" height="40" rx="2" fill="#2B579A"/>
            <path d="M24 14L18 34h3l1.5-5h5l1.5 5h3L26 14h-2zm-1 11l1.5-5 1.5 5h-3z" fill="white"/>
          </svg>
        )
      case 'excel':
        return (
          <svg className="office-icon" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="4" width="32" height="40" rx="2" fill="#217346"/>
            <path d="M22 18l-4 8 4 8h3l-4-8 4-8h-3zm4 0l4 8-4 8h3l4-8-4-8h-3z" fill="white"/>
            <rect x="16" y="20" width="16" height="2" fill="white"/>
            <rect x="16" y="25" width="16" height="2" fill="white"/>
            <rect x="16" y="30" width="16" height="2" fill="white"/>
          </svg>
        )
      case 'powerpoint':
        return (
          <svg className="office-icon" viewBox="0 0 48 48" fill="none">
            <rect x="8" y="4" width="32" height="40" rx="2" fill="#D24726"/>
            <path d="M18 14v20h3v-7h4c3 0 5-2 5-5v-3c0-3-2-5-5-5h-7zm3 3h4c1 0 2 1 2 2v3c0 1-1 2-2 2h-4v-7z" fill="white"/>
          </svg>
        )
    }
  }

  const getFileTypeName = () => {
    switch (fileType) {
      case 'word':
        return 'Microsoft Word Document'
      case 'excel':
        return 'Microsoft Excel Spreadsheet'
      case 'powerpoint':
        return 'Microsoft PowerPoint Presentation'
    }
  }

  const getFileExtension = () => {
    switch (fileType) {
      case 'word':
        return '.docx / .doc'
      case 'excel':
        return '.xlsx / .xls'
      case 'powerpoint':
        return '.pptx / .ppt'
    }
  }

  const handleOpenInDefaultApp = async () => {
    setIsOpening(true)
    try {
      const result = await window.api.shell.openPath(filePath)
      if (!result.success) {
        console.error('Failed to open file:', result.error)
        alert(`Failed to open file: ${result.error}`)
      }
    } catch (error) {
      console.error('Error opening file:', error)
      alert('An error occurred while opening the file.')
    } finally {
      // Keep the button disabled for a short time to prevent double-clicks
      setTimeout(() => setIsOpening(false), 1000)
    }
  }

  return (
    <div className="office-viewer">
      <div className="office-viewer-content">
        {getFileIcon()}

        <div className="office-info">
          <h2 className="office-filename">{fileName}</h2>
          <p className="office-filetype">{getFileTypeName()}</p>
          <p className="office-extension">{getFileExtension()}</p>
          <p className="office-filesize">{fileSize}</p>
        </div>

        <div className="office-actions">
          <button
            className="office-open-button"
            onClick={handleOpenInDefaultApp}
            disabled={isOpening}
          >
            {isOpening ? 'Opening...' : 'Open in Default Application'}
          </button>

          <p className="office-hint">
            This file will be opened in your system&apos;s default application for {getFileTypeName().toLowerCase()}.
          </p>
        </div>

        <div className="office-features">
          <div className="feature-item">
            <svg className="feature-icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
            </svg>
            <span>Full editing capabilities</span>
          </div>
          <div className="feature-item">
            <svg className="feature-icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
            </svg>
            <span>Native formatting support</span>
          </div>
          <div className="feature-item">
            <svg className="feature-icon" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
            </svg>
            <span>Access to all features and macros</span>
          </div>
        </div>
      </div>
    </div>
  )
}
