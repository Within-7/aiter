import { Project } from '../../types'
import { ProjectItem } from './ProjectItem'
import '../styles/ProjectList.css'

interface ProjectListProps {
  projects: Project[]
  activeProjectId?: string
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export function ProjectList({
  projects,
  activeProjectId,
  onSelect,
  onRemove
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="project-list-empty">
        <p>No projects yet</p>
        <p className="hint">Click + to add a project</p>
      </div>
    )
  }

  return (
    <div className="project-list">
      {projects.map((project) => (
        <ProjectItem
          key={project.id}
          project={project}
          isActive={project.id === activeProjectId}
          onSelect={() => onSelect(project.id)}
          onRemove={() => onRemove(project.id)}
        />
      ))}
    </div>
  )
}
