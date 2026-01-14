import * as pty from 'node-pty'
import * as path from 'path'
import * as fs from 'fs'
import { Terminal, AppSettings, ShellType } from '../types'
import { NodeManager } from './nodejs/manager'
import { ShellDetector } from './shell/ShellDetector'
import { logger } from './utils/logger'

interface PTYInstance {
  terminal: Terminal
  process: pty.IPty
  onData: (data: string) => void
  onExit: (exitCode: number) => void
  commandBuffer: string
  lastCommand: string
  isKilling: boolean  // Track if kill is in progress
}

// Kill timeout constants
const GRACEFUL_KILL_TIMEOUT = 2000  // Wait 2 seconds for graceful shutdown
const FORCE_KILL_TIMEOUT = 3000     // Wait 3 seconds for force kill
const KILL_ALL_TIMEOUT = 5000       // Total timeout for killAll()

export class PTYManager {
  private instances: Map<string, PTYInstance> = new Map()
  private nodeManager: NodeManager
  private shellDetector: ShellDetector

  // Whitelist of allowed shells (security)
  private static readonly ALLOWED_SHELLS: Set<string> = new Set([
    // macOS/Linux shells
    '/bin/zsh',
    '/bin/bash',
    '/bin/sh',
    '/usr/bin/zsh',
    '/usr/bin/bash',
    '/usr/bin/sh',
    '/usr/local/bin/zsh',
    '/usr/local/bin/bash',
    '/usr/local/bin/fish',
    '/opt/homebrew/bin/zsh',
    '/opt/homebrew/bin/bash',
    '/opt/homebrew/bin/fish',
    // Windows shells
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    'C:\\Windows\\System32\\cmd.exe',
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
    'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
  ])

  constructor() {
    this.nodeManager = new NodeManager()
    this.shellDetector = new ShellDetector()
  }

  private getDefaultShell(): string {
    return this.shellDetector.getDefaultShell()
  }

  /**
   * Validate shell path against whitelist (security)
   * Checks both static whitelist and that the shell exists and is executable
   */
  private isValidShell(shellPath: string): boolean {
    // Check against static whitelist first (fast path)
    if (PTYManager.ALLOWED_SHELLS.has(shellPath)) {
      return true
    }

    // For shells not in whitelist, verify they:
    // 1. Exist as a file
    // 2. Are in standard shell directories
    // 3. Have a shell-like name
    try {
      // Check if file exists
      if (!fs.existsSync(shellPath)) {
        return false
      }

      // Must be in a standard shell location
      const validDirs = [
        '/bin/',
        '/usr/bin/',
        '/usr/local/bin/',
        '/opt/homebrew/bin/',
        'C:\\Windows\\System32\\',
        'C:\\Program Files\\PowerShell\\',
        'C:\\Program Files (x86)\\PowerShell\\'
      ]

      const isInValidDir = validDirs.some(dir =>
        shellPath.startsWith(dir) ||
        shellPath.toLowerCase().startsWith(dir.toLowerCase())
      )

      if (!isInValidDir) {
        return false
      }

      // Must have a shell-like basename
      const basename = path.basename(shellPath).toLowerCase()
      const validShellNames = ['sh', 'bash', 'zsh', 'fish', 'csh', 'tcsh', 'ksh', 'dash',
                               'powershell.exe', 'pwsh.exe', 'cmd.exe']
      const isValidName = validShellNames.some(name =>
        basename === name || basename.startsWith(name.replace('.exe', ''))
      )

      return isValidName
    } catch {
      return false
    }
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

    // SECURITY: Validate shell path against whitelist
    if (!this.isValidShell(shellPath)) {
      throw new Error(`Security error: Shell "${shellPath}" is not in the allowed list`)
    }

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
      language: 'en',
      shellLoginMode: true,
      macOptionIsMeta: true,
      nodeSource: 'builtin',
      preserveVersionManagers: false,
      windowsUseUtf8: true,
      enableStartupCommand: true,
      startupCommand: 'minto',
      proxyMode: 'off',
      proxyHost: '127.0.0.1',
      proxyPort: 1087,
      proxyProtocol: 'http',
      // Terminal behavior
      confirmTerminalClose: true,
      // Editor settings
      editorWordWrap: true,
      editorMinimap: false,
      editorLineNumbers: true
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
        lastCommand: '',
        isKilling: false
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

      logger.info('PTYManager', 'PTY created', { id, pid: ptyProcess.pid, cwd, shell: shellPath })
      return terminal
    } catch (error) {
      logger.error('PTYManager', 'Failed to create PTY', { id, cwd, error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }

  write(id: string, data: string): boolean {
    const instance = this.instances.get(id)
    if (!instance) {
      logger.warn('PTYManager', 'PTY not found', { id })
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
          logger.debug('PTYManager', 'Command executed', { id, command })
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
      logger.error('PTYManager', 'Failed to write to PTY', { id, error: error instanceof Error ? error.message : String(error) })
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
      logger.warn('PTYManager', 'PTY not found for resize', { id })
      return false
    }

    try {
      instance.process.resize(cols, rows)
      logger.debug('PTYManager', 'PTY resized', { id, cols, rows })
      return true
    } catch (error) {
      logger.error('PTYManager', 'Failed to resize PTY', { id, cols, rows, error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * Kill a PTY instance with graceful shutdown
   * First sends SIGTERM, waits for graceful exit, then forces SIGKILL if needed
   * @param id - Terminal ID
   * @param force - If true, skip graceful shutdown and force kill immediately
   * @returns Promise that resolves when the process is killed
   */
  async kill(id: string, force: boolean = false): Promise<boolean> {
    const instance = this.instances.get(id)
    if (!instance) {
      logger.warn('PTYManager', 'PTY not found for kill', { id })
      return false
    }

    // Prevent duplicate kill attempts
    if (instance.isKilling) {
      logger.debug('PTYManager', 'PTY already being killed, skipping', { id })
      return true
    }
    instance.isKilling = true

    const pid = instance.process.pid
    logger.info('PTYManager', 'Killing PTY', { id, pid, force })

    return new Promise((resolve) => {
      let resolved = false
      let forceKillTimer: NodeJS.Timeout | null = null

      const cleanup = () => {
        if (forceKillTimer) {
          clearTimeout(forceKillTimer)
          forceKillTimer = null
        }
        this.instances.delete(id)
      }

      const done = (success: boolean, method: string) => {
        if (resolved) return
        resolved = true
        cleanup()
        logger.info('PTYManager', 'PTY killed', { id, method })
        resolve(success)
      }

      // Listen for process exit
      const exitHandler = () => {
        done(true, 'graceful exit')
      }

      try {
        // Check if process is still alive
        if (pid === undefined || pid <= 0) {
          done(true, 'already dead')
          return
        }

        // On Windows, we can only use the default kill
        if (process.platform === 'win32' || force) {
          instance.process.kill()
          // Give it a moment to clean up
          setTimeout(() => done(true, force ? 'force kill' : 'windows kill'), 100)
          return
        }

        // Unix: Graceful shutdown with SIGTERM first
        try {
          instance.process.kill('SIGTERM')
        } catch {
          // Process might already be dead
          done(true, 'already terminated')
          return
        }

        // Set up force kill timer
        forceKillTimer = setTimeout(() => {
          if (resolved) return
          logger.warn('PTYManager', 'PTY did not exit gracefully, sending SIGKILL', { id })
          try {
            instance.process.kill('SIGKILL')
          } catch {
            // Process might be dead by now
          }
          // Give SIGKILL a moment to work
          setTimeout(() => {
            if (!resolved) {
              done(true, 'SIGKILL timeout')
            }
          }, 500)
        }, GRACEFUL_KILL_TIMEOUT)

        // Also listen for the process exit event
        instance.process.onExit(exitHandler)

      } catch (error) {
        logger.error('PTYManager', 'Error killing PTY', { id, error: error instanceof Error ? error.message : String(error) })
        cleanup()
        resolve(false)
      }
    })
  }

  /**
   * Synchronous kill for backwards compatibility
   * Used internally when async is not needed
   */
  killSync(id: string): boolean {
    const instance = this.instances.get(id)
    if (!instance) {
      logger.warn('PTYManager', 'PTY not found for killSync', { id })
      return false
    }

    try {
      instance.process.kill()
      this.instances.delete(id)
      logger.info('PTYManager', 'PTY killed (sync)', { id })
      return true
    } catch (error) {
      logger.error('PTYManager', 'Failed to kill PTY (sync)', { id, error: error instanceof Error ? error.message : String(error) })
      return false
    }
  }

  /**
   * Kill all PTY instances with timeout protection
   * Runs kills in parallel for faster shutdown
   * @returns Promise that resolves when all processes are killed or timeout
   */
  async killAll(): Promise<{ success: number; failed: number; timeout: boolean }> {
    const count = this.instances.size
    logger.info('PTYManager', 'Killing all PTY instances', { count })

    if (count === 0) {
      return { success: 0, failed: 0, timeout: false }
    }

    const ids = Array.from(this.instances.keys())
    let success = 0
    let failed = 0
    let timedOut = false

    // Create a promise that rejects after timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error('killAll timeout'))
      }, KILL_ALL_TIMEOUT)
    })

    try {
      // Kill all instances in parallel with timeout
      const killPromises = ids.map(async (id) => {
        try {
          const result = await this.kill(id, false)
          return { id, success: result }
        } catch {
          return { id, success: false }
        }
      })

      const results = await Promise.race([
        Promise.all(killPromises),
        timeoutPromise
      ])

      // Count results
      for (const result of results) {
        if (result.success) {
          success++
        } else {
          failed++
        }
      }
    } catch (error) {
      // Timeout occurred, force kill remaining instances
      timedOut = true
      logger.warn('PTYManager', 'killAll timeout, force killing remaining instances', {
        timeoutMs: KILL_ALL_TIMEOUT,
        remaining: this.instances.size
      })

      // Force kill any remaining instances
      for (const id of this.instances.keys()) {
        try {
          this.killSync(id)
          success++
        } catch {
          failed++
        }
      }
    }

    // Final cleanup - ensure the map is empty
    if (this.instances.size > 0) {
      logger.warn('PTYManager', 'Instances remaining after killAll, clearing', { remaining: this.instances.size })
      this.instances.clear()
    }

    logger.info('PTYManager', 'killAll complete', { success, failed, timeout: timedOut })
    return { success, failed, timeout: timedOut }
  }

  /**
   * Synchronous version of killAll for backwards compatibility
   * @deprecated Use killAll() instead for proper cleanup
   */
  killAllSync(): void {
    logger.info('PTYManager', 'Killing all PTY instances (sync)', { count: this.instances.size })
    for (const id of this.instances.keys()) {
      this.killSync(id)
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
