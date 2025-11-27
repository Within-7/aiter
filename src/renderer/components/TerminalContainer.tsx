import { Terminal as TerminalType, AppSettings } from '../../types'
import { XTerminal } from './XTerminal'
import '../styles/TerminalContainer.css'

interface TerminalContainerProps {
  terminals: TerminalType[]
  activeTerminalId?: string
  settings: AppSettings
}

export function TerminalContainer({
  terminals,
  activeTerminalId,
  settings
}: TerminalContainerProps) {
  return (
    <div className="terminal-container">
      {terminals.map((terminal) => (
        <div
          key={terminal.id}
          className={`terminal-wrapper ${
            terminal.id === activeTerminalId ? 'active' : 'hidden'
          }`}
        >
          <XTerminal terminal={terminal} settings={settings} />
        </div>
      ))}
    </div>
  )
}
