import * as pty from 'node-pty'
import { Terminal } from '../types'

interface PTYInstance {
  terminal: Terminal
  process: pty.IPty
  onData: (data: string) => void
  onExit: (exitCode: number) => void
  commandBuffer: string
  lastCommand: string
}

export class PTYManager {
  private instances: Map<string, PTYInstance> = new Map()

  private getDefaultShell(): string {
    if (process.platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe'
    }
    return process.env.SHELL || '/bin/bash'
  }

  create(
    id: string,
    cwd: string,
    projectId: string,
    projectName: string,
    shell?: string,
    onData?: (data: string) => void,
    onExit?: (exitCode: number) => void
  ): Terminal {
    // Kill existing instance if it exists
    if (this.instances.has(id)) {
      this.kill(id)
    }

    const shellPath = shell || this.getDefaultShell()
    const cols = 80
    const rows = 24

    try {
      // Prepare environment variables to simulate a real TTY
      const ptyEnv = {
        ...process.env,
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        // Force TTY detection for apps that check isatty()
        FORCE_COLOR: '1',
        // Ensure proper line editing behavior
        TERM_PROGRAM: 'AiTer',
        TERM_PROGRAM_VERSION: '0.1.0'
      } as { [key: string]: string }

      const ptyProcess = pty.spawn(shellPath, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: ptyEnv
      })

      const terminal: Terminal = {
        id,
        projectId,
        name: `${projectName} | >`,
        cwd,
        shell: shellPath,
        createdAt: Date.now(),
        pid: ptyProcess.pid
      }

      const instance: PTYInstance = {
        terminal,
        process: ptyProcess,
        onData: onData || (() => {}),
        onExit: onExit || (() => {}),
        commandBuffer: '',
        lastCommand: ''
      }

      // Setup event handlers
      ptyProcess.onData((data) => {
        instance.onData(data)
      })

      ptyProcess.onExit(({ exitCode }) => {
        instance.onExit(exitCode)
        this.instances.delete(id)
      })

      this.instances.set(id, instance)

      console.log(`PTY created: ${id} (PID: ${ptyProcess.pid})`)
      return terminal
    } catch (error) {
      console.error('Failed to create PTY:', error)
      throw error
    }
  }

  write(id: string, data: string): boolean {
    const instance = this.instances.get(id)
    if (!instance) {
      console.warn(`PTY not found: ${id}`)
      return false
    }

    try {
      instance.process.write(data)

      // Track commands (when Enter is pressed)
      if (data === '\r') {
        const command = instance.commandBuffer.trim()
        if (command.length > 0 && command !== instance.lastCommand) {
          instance.lastCommand = command
          // Update terminal name with last command
          const projectName = instance.terminal.name.split(' | ')[0]
          instance.terminal.name = `${projectName} | ${command}`
        }
        instance.commandBuffer = ''
      } else if (data === '\x7f' || data === '\b') {
        // Handle backspace
        instance.commandBuffer = instance.commandBuffer.slice(0, -1)
      } else if (data >= ' ' && data <= '~') {
        // Add printable characters to buffer
        instance.commandBuffer += data
      }

      return true
    } catch (error) {
      console.error(`Failed to write to PTY ${id}:`, error)
      return false
    }
  }

  getTerminalName(id: string): string | null {
    const instance = this.instances.get(id)
    return instance ? instance.terminal.name : null
  }

  resize(id: string, cols: number, rows: number): boolean {
    const instance = this.instances.get(id)
    if (!instance) {
      console.warn(`PTY not found: ${id}`)
      return false
    }

    try {
      instance.process.resize(cols, rows)
      return true
    } catch (error) {
      console.error(`Failed to resize PTY ${id}:`, error)
      return false
    }
  }

  kill(id: string): boolean {
    const instance = this.instances.get(id)
    if (!instance) {
      console.warn(`PTY not found: ${id}`)
      return false
    }

    try {
      instance.process.kill()
      this.instances.delete(id)
      console.log(`PTY killed: ${id}`)
      return true
    } catch (error) {
      console.error(`Failed to kill PTY ${id}:`, error)
      return false
    }
  }

  killAll(): void {
    console.log(`Killing all PTY instances (${this.instances.size})`)
    for (const id of this.instances.keys()) {
      this.kill(id)
    }
  }

  getTerminal(id: string): Terminal | undefined {
    return this.instances.get(id)?.terminal
  }

  getAllTerminals(): Terminal[] {
    return Array.from(this.instances.values()).map((inst) => inst.terminal)
  }

  exists(id: string): boolean {
    return this.instances.has(id)
  }

  getCount(): number {
    return this.instances.size
  }
}
