import { useState, useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { Project } from '../../types'
import '../styles/ProjectItem.css'

interface ProjectItemProps {
  project: Project
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
}

/**
 * Memoized ProjectItem component
 * Prevents unnecessary re-renders when other projects change
 */
export const ProjectItem = memo(function ProjectItem({
  project,
  isActive,
  onSelect,
  onRemove
}: ProjectItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPosition({ x: e.clientX, y: e.clientY })
    setShowMenu(true)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    if (confirm(`Remove project "${project.name}"?`)) {
      onRemove()
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  return (
    <div
      className={`project-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      onContextMenu={handleContextMenu}
      title={project.path}
    >
      <div className="project-icon">📁</div>
      <div className="project-info">
        <div className="project-name">{project.name}</div>
        <div className="project-path">{project.path}</div>
      </div>
      <button
        className="btn-icon btn-remove"
        onClick={handleRemove}
        title="Remove project"
      >
        ×
      </button>
      {showMenu && createPortal(
        <div
          ref={menuRef}
          className="context-menu"
          style={{ left: menuPosition.x, top: menuPosition.y }}
          onClick={() => setShowMenu(false)}
        >
          <div className="context-menu-item" onClick={handleRemove}>
            Remove
          </div>
        </div>,
        document.body
      )}
    </div>
  )
})
