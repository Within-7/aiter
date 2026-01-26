import React, { memo } from 'react'

interface Tab {
  id: string
  type: 'editor' | 'terminal'
  title: string
  projectColor?: string
  isPreview?: boolean
}

interface TabItemProps {
  tab: Tab
  isActive: boolean
  isDragging: boolean
  isDragOver: boolean
  isSelected: boolean
  isMultiSelected: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: () => void
  onClose: (e: React.MouseEvent) => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDrop: (e: React.DragEvent) => void
}

/**
 * Individual tab item component for the WorkArea tab bar.
 * Memoized to prevent unnecessary re-renders when other tabs change.
 */
export const TabItem = memo(function TabItem({
  tab,
  isActive,
  isDragging,
  isDragOver,
  isSelected,
  isMultiSelected,
  onClick,
  onDoubleClick,
  onClose,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop
}: TabItemProps) {
  const classNames = [
    'work-area-tab',
    isActive && 'active',
    isDragging && 'dragging',
    isDragOver && 'drag-over',
    isSelected && 'selected',
    isMultiSelected && 'multi-selected',
    tab.isPreview && 'preview'
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classNames}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      style={{
        borderTopColor: tab.projectColor || 'transparent',
        background: isActive && tab.projectColor
          ? `linear-gradient(to bottom, ${tab.projectColor}40, #1e1e1e)`
          : undefined
      }}
    >
      <span className="tab-icon">
        {tab.type === 'editor' ? '📄' : '⌨️'}
      </span>
      <span className="tab-title">{tab.title}</span>
      <button
        className="tab-close"
        onClick={onClose}
        title="Close"
      >
        ×
      </button>
    </div>
  )
})
