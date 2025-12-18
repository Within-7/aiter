import React, { useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy } from 'pdfjs-dist'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

interface PDFViewerProps {
  filePath: string  // PDF文件的绝对路径
  fileName: string
}

const PDFViewer: React.FC<PDFViewerProps> = ({ filePath, fileName }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [scale, setScale] = useState(1.0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pageInputValue, setPageInputValue] = useState('1')

  // Load PDF document
  useEffect(() => {
    let mounted = true

    const loadPDF = async () => {
      try {
        setLoading(true)
        setError(null)

        // Read PDF file via IPC
        const result = await window.api.fs.readFile(filePath)

        if (!result.success || !result.content) {
          throw new Error(result.error || 'Failed to read PDF file')
        }

        // Convert base64 to Uint8Array
        const base64Data = result.content.split(',')[1] || result.content
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ data: bytes })
        const pdf = await loadingTask.promise

        if (mounted) {
          setPdfDoc(pdf)
          setTotalPages(pdf.numPages)
          setCurrentPage(1)
          setPageInputValue('1')
          setLoading(false)
        }
      } catch (err) {
        console.error('Error loading PDF:', err)
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF')
          setLoading(false)
        }
      }
    }

    loadPDF()

    return () => {
      mounted = false
    }
  }, [filePath])

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage)
        const canvas = canvasRef.current!
        const context = canvas.getContext('2d')!

        const viewport = page.getViewport({ scale })

        // Set canvas dimensions
        canvas.height = viewport.height
        canvas.width = viewport.width

        // Render PDF page
        const renderContext = {
          canvasContext: context,
          viewport: viewport
        }

        await page.render(renderContext).promise
      } catch (err) {
        console.error('Error rendering page:', err)
        setError('Failed to render page')
      }
    }

    renderPage()
  }, [pdfDoc, currentPage, scale])

  // Navigation handlers
  const goToFirstPage = () => {
    setCurrentPage(1)
    setPageInputValue('1')
  }

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1
      setCurrentPage(newPage)
      setPageInputValue(String(newPage))
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      const newPage = currentPage + 1
      setCurrentPage(newPage)
      setPageInputValue(String(newPage))
    }
  }

  const goToLastPage = () => {
    setCurrentPage(totalPages)
    setPageInputValue(String(totalPages))
  }

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value)
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const pageNum = parseInt(pageInputValue, 10)
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        setCurrentPage(pageNum)
      } else {
        setPageInputValue(String(currentPage))
      }
    }
  }

  const handlePageInputBlur = () => {
    const pageNum = parseInt(pageInputValue, 10)
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum)
    } else {
      setPageInputValue(String(currentPage))
    }
  }

  // Zoom handlers
  const zoomIn = () => {
    if (scale < 2.0) {
      setScale(Math.min(2.0, scale + 0.25))
    }
  }

  const zoomOut = () => {
    if (scale > 0.5) {
      setScale(Math.max(0.5, scale - 0.25))
    }
  }

  const resetZoom = () => {
    setScale(1.0)
  }

  const zoomToFit = () => {
    setScale(1.0)
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContainer}>
          <div style={styles.spinner}></div>
          <div style={styles.loadingText}>Loading PDF...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorContainer}>
          <div style={styles.errorIcon}>⚠️</div>
          <div style={styles.errorText}>{error}</div>
          <div style={styles.errorHint}>File: {fileName}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarSection}>
          {/* Navigation */}
          <button
            style={styles.toolbarButton}
            onClick={goToFirstPage}
            disabled={currentPage === 1}
            title="First page"
          >
            ⏮
          </button>
          <button
            style={styles.toolbarButton}
            onClick={goToPreviousPage}
            disabled={currentPage === 1}
            title="Previous page"
          >
            ◀
          </button>
          <button
            style={styles.toolbarButton}
            onClick={goToNextPage}
            disabled={currentPage === totalPages}
            title="Next page"
          >
            ▶
          </button>
          <button
            style={styles.toolbarButton}
            onClick={goToLastPage}
            disabled={currentPage === totalPages}
            title="Last page"
          >
            ⏭
          </button>

          {/* Page info */}
          <div style={styles.pageInfo}>
            <input
              type="text"
              value={pageInputValue}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onBlur={handlePageInputBlur}
              style={styles.pageInput}
            />
            <span style={styles.pageTotal}>/ {totalPages}</span>
          </div>
        </div>

        <div style={styles.toolbarSection}>
          {/* Zoom controls */}
          <button
            style={styles.toolbarButton}
            onClick={zoomOut}
            disabled={scale <= 0.5}
            title="Zoom out"
          >
            −
          </button>
          <button
            style={styles.toolbarButton}
            onClick={resetZoom}
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            style={styles.toolbarButton}
            onClick={zoomIn}
            disabled={scale >= 2.0}
            title="Zoom in"
          >
            +
          </button>
          <button
            style={styles.toolbarButton}
            onClick={zoomToFit}
            title="Fit to width"
          >
            ⛶
          </button>
        </div>

        <div style={styles.toolbarSection}>
          <span style={styles.fileName}>{fileName}</span>
        </div>
      </div>

      {/* PDF Canvas */}
      <div style={styles.canvasContainer}>
        <canvas ref={canvasRef} style={styles.canvas} />
      </div>
    </div>
  )
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    backgroundColor: '#1e1e1e',
    color: '#cccccc',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #3c3c3c',
    flexShrink: 0,
    gap: '16px',
  },
  toolbarSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  toolbarButton: {
    padding: '6px 12px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    border: '1px solid #4a4a4a',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    transition: 'background-color 0.2s',
  },
  pageInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: '8px',
  },
  pageInput: {
    width: '50px',
    padding: '4px 8px',
    backgroundColor: '#3c3c3c',
    color: '#cccccc',
    border: '1px solid #4a4a4a',
    borderRadius: '4px',
    textAlign: 'center',
    fontSize: '14px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  pageTotal: {
    fontSize: '14px',
    color: '#cccccc',
  },
  fileName: {
    fontSize: '13px',
    color: '#858585',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '300px',
  },
  canvasContainer: {
    flex: 1,
    overflow: 'auto',
    padding: '20px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  canvas: {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    backgroundColor: 'white',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '4px solid #3c3c3c',
    borderTop: '4px solid #007acc',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '14px',
    color: '#858585',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
    padding: '20px',
  },
  errorIcon: {
    fontSize: '48px',
  },
  errorText: {
    fontSize: '16px',
    color: '#f48771',
    textAlign: 'center',
  },
  errorHint: {
    fontSize: '13px',
    color: '#858585',
    textAlign: 'center',
    marginTop: '8px',
  },
}

// Add keyframes for spinner animation
const styleSheet = document.createElement('style')
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`
document.head.appendChild(styleSheet)

export { PDFViewer }
