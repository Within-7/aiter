import { VscTerminal } from 'react-icons/vsc'
import { Terminal } from '../../types'
import { Tab } from './Tab'
import '../styles/TabBar.css'

interface TabBarProps {
  terminals: Terminal[]
  activeTerminalId?: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export function TabBar({
  terminals,
  activeTerminalId,
  onSelect,
  onClose,
  onNew
}: TabBarProps) {
  return (
    <div className="tab-bar">
      <div className="tabs">
        {terminals.map((terminal) => (
          <Tab
            key={terminal.id}
            terminal={terminal}
            isActive={terminal.id === activeTerminalId}
            onSelect={() => onSelect(terminal.id)}
            onClose={() => onClose(terminal.id)}
          />
        ))}
      </div>
      <button className="btn-icon btn-new-tab" onClick={onNew} title="New Terminal">
        <VscTerminal />
      </button>
    </div>
  )
}
