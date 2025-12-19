import * as pty from 'node-pty'
import * as path from 'path'
import { Terminal, AppSettings, ShellType } from '../types'
import { NodeManager } from './nodejs/manager'
import { ShellDetector } from './shell/ShellDetector'

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
  private nodeManager: NodeManager
  private shellDetector: ShellDetector

  constructor() {
    this.nodeManager = new NodeManager()
    this.shellDetector = new ShellDetector()
  }

  private getDefaultShell(): string {
    return this.shellDetector.getDefaultShell()
  }

  /**
   * Get shell type from shell path
   */
  private getShellType(shellPath: string): ShellType {
    const shellName = path.basename(shellPath).toLowerCase()
    if (shellName.includes('zsh')) return 'zsh'
    if (shellName.includes('bash') && !shellName.includes('git')) return 'bash'
    if (shellName.includes('fish')) return 'fish'
    if (shellName === 'pwsh' || shellName === 'pwsh.exe') return 'pwsh'
    if (shellName.includes('powershell')) return 'powershell'
    if (shellName.includes('cmd')) return 'cmd'
    if (shellName.includes('git') && shellName.includes('bash')) return 'gitbash'
    if (shellName.includes('wsl')) return 'wsl'
    return 'other'
  }

  /**
   * Get shell arguments based on settings
   */
  private getShellArgs(shellPath: string, settings: AppSettings): string[] {
    const args: string[] = []
    const shellType = this.getShellType(shellPath)

    // Handle login shell mode for Unix-like systems
    if (process.platform !== 'win32' && settings.shellLoginMode) {
      if (this.shellDetector.supportsLoginMode(shellType)) {
        args.push('-l')
      }
    }

    // Handle Windows shells
    if (process.platform === 'win32') {
      if (shellType === 'powershell' || shellType === 'pwsh') {
        // -NoLogo reduces startup noise
        args.push('-NoLogo')
      }
      // For CMD with UTF-8, we'll send 'chcp 65001' after spawn
    }

    return args
  }

  create(
    id: string,
    cwd: string,
    projectId: string,
    projectName: string,
    shell?: string,
    settings?: AppSettings,
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

    // Use default settings if not provided
    const effectiveSettings: AppSettings = settings || {
      theme: 'dark',
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      scrollbackLines: 1000,
      cursorBlink: true,
      cursorStyle: 'block',
      terminalTheme: 'homebrew',
      shellLoginMode: true,
      macOptionIsMeta: true,
      nodeSource: 'builtin',
      preserveVersionManagers: false,
      windowsUseUtf8: true
    }

    try {
      // Get Node.js environment variables with settings
      const nodeEnv = this.nodeManager.getTerminalEnv(effectiveSettings)

      // Prepare environment variables to simulate a real TTY
      const ptyEnv = {
        ...nodeEnv, // Include Node.js paths first
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        // Force TTY detection for apps that check isatty()
        FORCE_COLOR: '1',
        // Ensure proper line editing behavior
        TERM_PROGRAM: 'AiTer',
        TERM_PROGRAM_VERSION: '0.1.0',
        // UTF-8 locale settings for proper international character support
        LANG: process.env.LANG || 'en_US.UTF-8',
        LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
        LC_CTYPE: process.env.LC_CTYPE || 'en_US.UTF-8'
      } as { [key: string]: string }

      // Get shell arguments based on settings (login shell mode, etc.)
      const shellArgs = this.getShellArgs(shellPath, effectiveSettings)

      const ptyProcess = pty.spawn(shellPath, shellArgs, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: ptyEnv
      })

      // For Windows CMD with UTF-8 enabled, set code page
      if (process.platform === 'win32' && effectiveSettings.windowsUseUtf8) {
        const shellType = this.getShellType(shellPath)
        if (shellType === 'cmd') {
          // Send command to change code page to UTF-8
          setTimeout(() => {
            ptyProcess.write('chcp 65001 > nul\r')
          }, 100)
        }
      }

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
