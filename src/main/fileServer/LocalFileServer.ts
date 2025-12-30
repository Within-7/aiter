import express, { Application } from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import { Server } from 'http'
import session from 'express-session'
import cookieParser from 'cookie-parser'

/**
 * Extend Express session data to include authentication flag
 */
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean
  }
}

/**
 * Local HTTP file server for a single project
 * Serves static files from the project directory
 */
export class LocalFileServer {
  private app: Application
  private server: Server | null = null
  private port: number = 0
  private projectPath: string
  private projectId: string
  private accessToken: string
  private lastAccessed: number = Date.now()

  constructor(projectId: string, projectPath: string, accessToken: string) {
    this.projectId = projectId
    this.projectPath = projectPath
    this.accessToken = accessToken
    this.app = express()
    this.setupMiddlewares()
    this.setupRoutes()
  }

  private setupMiddlewares() {
    // CORS support with credentials
    this.app.use(cors({
      origin: true,
      credentials: true
    }))

    // Cookie parser
    this.app.use(cookieParser())

    // Session management
    this.app.use(session({
      secret: this.accessToken, // Use access token as session secret
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax' // Required for session to work in nested iframes
      }
    }))

    // Security and cache headers
    this.app.use((req, res, next) => {
      // Disable caching for development
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')

      // Security headers
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('X-XSS-Protection', '1; mode=block')
      // Note: We intentionally don't set X-Frame-Options because:
      // 1. AiTer's HTML preview uses iframes to display content
      // 2. The iframe loads from localhost:{port} into Electron's renderer
      // 3. SAMEORIGIN would block this cross-origin iframe embedding
      // Security is maintained through token authentication instead

      next()
    })

    // Token validation with session and same-origin Referer support
    this.app.use((req, res, next) => {
      // Check if already authenticated in this session
      if (req.session.authenticated) {
        this.lastAccessed = Date.now()
        return next()
      }

      // Check for token in headers or query
      const token = req.headers['x-access-token'] || req.query.token

      // Use timing-safe comparison to prevent timing attacks
      if (token && typeof token === 'string' && this.isValidToken(token)) {
        // Token is valid, mark session as authenticated
        req.session.authenticated = true
        this.lastAccessed = Date.now()
        return next()
      }

      // SECURITY: Allow same-origin requests (including nested iframes)
      // This enables resources and nested HTML files to load properly when referenced
      // from HTML files that were initially accessed with a valid token.
      //
      // The Referer header cannot be spoofed by JavaScript in browsers (enforced by browser security).
      // If the Referer comes from our own server (same host:port), the request originates
      // from a page that was already authenticated (either by token or by this same mechanism).
      //
      // This is safe because:
      // 1. External attackers cannot forge Referer headers (browser security policy)
      // 2. Only pages already loaded from our server will have the correct Referer
      // 3. This enables legitimate use cases like html-viewer.html embedding other HTML files
      const referer = req.headers.referer
      if (referer) {
        try {
          const refererUrl = new URL(referer)
          const serverOrigin = `localhost:${this.port}`

          // Check if the referer is from the same server (same host and port)
          if (refererUrl.host === serverOrigin) {
            // Allow all same-origin requests (including nested HTML iframes)
            this.lastAccessed = Date.now()
            return next()
          }
        } catch {
          // Invalid referer URL, continue to deny
        }
      }

      // No valid authentication found
      return res.status(403).json({ error: 'Forbidden: Invalid access token' })
    })
  }

  private setupRoutes() {
    // Intercept HTML files to inject link interception script
    this.app.use(async (req, res, next) => {
      // Only process GET requests for HTML files
      if (req.method !== 'GET' || !req.path.endsWith('.html')) {
        return next()
      }

      try {
        const filePath = path.join(this.projectPath, req.path)
        const content = await fs.readFile(filePath, 'utf-8')

        // Inject script to intercept target="_blank" links
        const injectedScript = `
<script>
(function() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', interceptLinks);
  } else {
    interceptLinks();
  }

  function interceptLinks() {
    document.addEventListener('click', function(e) {
      var target = e.target;
      var link = target.closest('a');

      if (!link) return;

      var href = link.getAttribute('href');
      var linkTarget = link.getAttribute('target');

      if (!href || linkTarget !== '_blank') return;

      // Only intercept relative URLs
      if (href.match(/^(https?:\\/\\/|mailto:|tel:)/)) return;

      e.preventDefault();
      e.stopPropagation();

      // Send message to parent window to open in new tab
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({
          type: 'OPEN_IN_TAB',
          href: href,
          baseUrl: window.location.pathname
        }, '*');
      }
    }, true);
  }
})();
</script>
`

        // Inject before closing </body> tag, or before </html> if no body
        let modifiedContent = content
        if (content.includes('</body>')) {
          modifiedContent = content.replace('</body>', injectedScript + '</body>')
        } else if (content.includes('</html>')) {
          modifiedContent = content.replace('</html>', injectedScript + '</html>')
        } else {
          modifiedContent = content + injectedScript
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.send(modifiedContent)
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          next() // File not found, let express.static handle it
        } else {
          next(error)
        }
      }
    })

    // Serve static files from project directory
    // SECURITY: Deny dotfiles to prevent exposure of sensitive files (.env, .ssh/id_rsa, .git/config)
    this.app.use(express.static(this.projectPath, {
      dotfiles: 'deny', // Prevent access to hidden files for security
      index: false // Don't serve index.html automatically
    }))

    // Fallback error handler for 404
    this.app.use((req, res) => {
      res.status(404).json({ error: 'File not found' })
    })
  }

  /**
   * Start the server on the specified port
   */
  public start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(port, () => {
          this.port = port
          console.log(`[LocalFileServer] Project "${this.projectId}" started on port ${port}`)
          resolve()
        })

        this.server.on('error', (error) => {
          reject(error)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Stop the server
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log(`[LocalFileServer] Project "${this.projectId}" stopped`)
          this.server = null
          this.port = 0
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Get the server URL for a specific file path
   */
  public getUrl(filePath: string = '/'): string {
    // Ensure filePath starts with /
    const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
    return `http://localhost:${this.port}${normalizedPath}?token=${this.accessToken}`
  }

  public getPort(): number {
    return this.port
  }

  public getProjectId(): string {
    return this.projectId
  }

  public getLastAccessed(): number {
    return this.lastAccessed
  }

  public isRunning(): boolean {
    return this.server !== null && this.port > 0
  }

  /**
   * Timing-safe token comparison to prevent timing attacks
   */
  private isValidToken(token: string): boolean {
    try {
      // Both tokens must be the same length for timing-safe comparison
      const tokenBuffer = Buffer.from(token, 'utf-8')
      const expectedBuffer = Buffer.from(this.accessToken, 'utf-8')

      // If lengths differ, still do a comparison to maintain constant time
      if (tokenBuffer.length !== expectedBuffer.length) {
        // Create a dummy buffer of matching length
        const dummyBuffer = Buffer.alloc(tokenBuffer.length)
        crypto.timingSafeEqual(tokenBuffer, dummyBuffer)
        return false
      }

      return crypto.timingSafeEqual(tokenBuffer, expectedBuffer)
    } catch {
      return false
    }
  }
}
