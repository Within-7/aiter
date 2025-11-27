import { useState } from 'react'
import { Project } from '../../types'
import '../styles/ProjectItem.css'

interface ProjectItemProps {
  project: Project
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
}

export function ProjectItem({
  project,
  isActive,
  onSelect,
  onRemove
}: ProjectItemProps) {
  const [showMenu, setShowMenu] = useState(false)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowMenu(true)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMenu(false)
    if (confirm(`Remove project "${project.name}"?`)) {
      onRemove()
    }
  }

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
      {showMenu && (
        <div className="context-menu" onClick={() => setShowMenu(false)}>
          <div className="context-menu-item" onClick={handleRemove}>
            Remove
          </div>
        </div>
      )}
    </div>
  )
}
