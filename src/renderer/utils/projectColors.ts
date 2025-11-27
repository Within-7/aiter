// Predefined vibrant colors for project identification
const PROJECT_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#84cc16', // Lime
]

// Store assigned colors
const colorAssignments = new Map<string, string>()
let nextColorIndex = 0

/**
 * Get or assign a color for a project
 */
export function getProjectColor(projectId: string, existingColor?: string): string {
  // If project already has a color stored in the data, use it
  if (existingColor) {
    colorAssignments.set(projectId, existingColor)
    return existingColor
  }

  // Check if we already assigned a color to this project
  const assigned = colorAssignments.get(projectId)
  if (assigned) {
    return assigned
  }

  // Assign a new color
  const color = PROJECT_COLORS[nextColorIndex % PROJECT_COLORS.length]
  nextColorIndex++
  colorAssignments.set(projectId, color)

  return color
}

/**
 * Clear color assignment for a removed project
 */
export function clearProjectColor(projectId: string): void {
  colorAssignments.delete(projectId)
}

/**
 * Get all project colors (useful for persistence)
 */
export function getAllColorAssignments(): Map<string, string> {
  return new Map(colorAssignments)
}
