/**
 * ProjectTemplateManager
 *
 * Manages project templates for AiTer.
 * Loads template configurations and applies templates to new projects.
 * Supports both v1 (simple) and v2 (enhanced with AI CLI config) formats.
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import type {
  TemplateAICliConfig,
  TemplateKnowledgeConfig,
  TemplateDependencies,
  TemplateVariable
} from '../../types/initConfig';

/**
 * Project template configuration (v1 format)
 */
export interface ProjectTemplateConfig {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: 'basic' | 'work' | 'development' | 'enterprise';
  order: number;
  templateDir: string;
  requiredLicense?: string;
}

/**
 * Enhanced template configuration (v2 format)
 * Loaded from template.json within the template directory
 */
export interface EnhancedTemplateConfig extends ProjectTemplateConfig {
  version: '2.0.0';
  author?: string;
  license?: string;
  tags?: string[];
  targetCLI?: ('claude-code' | 'minto' | 'gemini')[];

  files?: {
    include?: string[];
    exclude?: string[];
    rename?: Record<string, string>;
  };

  variables?: TemplateVariable[];
  aiCli?: TemplateAICliConfig;
  knowledge?: TemplateKnowledgeConfig;
  dependencies?: TemplateDependencies;

  postApply?: {
    scripts?: PostApplyScript[];
    messages?: PostApplyMessage[];
  };
}

/**
 * Post-apply script configuration
 */
export interface PostApplyScript {
  type: 'shell' | 'node';
  command: string;
  condition?: string;
  platforms?: NodeJS.Platform[];
  timeout?: number;
}

/**
 * Post-apply message configuration
 */
export interface PostApplyMessage {
  type: 'info' | 'warning' | 'success';
  message: string;
}

/**
 * Templates configuration file structure
 */
export interface ProjectTemplatesConfig {
  version: string;
  description?: string;
  templates: ProjectTemplateConfig[];
}

/**
 * Template application result
 */
export interface TemplateApplicationResult {
  success: boolean;
  filesCreated: string[];
  aiCliConfigured?: boolean;
  knowledgeConfigured?: boolean;
  postApplyMessages?: PostApplyMessage[];
  error?: string;
}

/**
 * Variables context for template substitution
 */
export interface TemplateVariablesContext {
  PROJECT_NAME: string;
  PROJECT_PATH: string;
  TIMESTAMP: string;
  DATE: string;
  [key: string]: string | boolean | number;
}

export class ProjectTemplateManager {
  private static instance: ProjectTemplateManager | null = null;
  private config: ProjectTemplatesConfig | null = null;
  private configPath: string | null = null;
  private templatesBasePath: string | null = null;

  private constructor() {
    this.loadConfig();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ProjectTemplateManager {
    if (!ProjectTemplateManager.instance) {
      ProjectTemplateManager.instance = new ProjectTemplateManager();
    }
    return ProjectTemplateManager.instance;
  }

  /**
   * Load templates configuration from JSON file
   */
  private loadConfig(): void {
    const configFileName = 'project-templates.json';

    // Possible config paths
    const possiblePaths = [
      // Production: inside app.asar or unpacked
      path.join(app.getAppPath(), 'config', configFileName),
      // Development: project root
      path.join(process.cwd(), 'config', configFileName),
      // Alternative: relative to __dirname
      path.join(__dirname, '..', '..', '..', 'config', configFileName),
    ];

    let configContent: string | null = null;

    for (const tryPath of possiblePaths) {
      try {
        if (fs.existsSync(tryPath)) {
          configContent = fs.readFileSync(tryPath, 'utf-8');
          this.configPath = tryPath;
          this.templatesBasePath = path.join(path.dirname(tryPath), 'templates');
          console.log(`[ProjectTemplateManager] Found config at: ${tryPath}`);
          break;
        }
      } catch (error) {
        console.log(`[ProjectTemplateManager] Config not found at: ${tryPath}`);
      }
    }

    if (!configContent) {
      console.warn('[ProjectTemplateManager] No config file found, using default templates');
      this.config = {
        version: '1.0.0',
        description: 'Default templates',
        templates: [
          {
            id: 'blank',
            name: 'Blank Project',
            description: 'Empty project with basic AI CLI configuration',
            icon: '📁',
            category: 'basic',
            order: 1,
            templateDir: 'blank',
          },
        ],
      };
      return;
    }

    try {
      this.config = JSON.parse(configContent) as ProjectTemplatesConfig;
      console.log(
        `[ProjectTemplateManager] Loaded ${this.config.templates.length} templates`
      );
    } catch (error) {
      console.error('[ProjectTemplateManager] Failed to parse config:', error);
      this.config = {
        version: '1.0.0',
        description: 'Default templates (parse error)',
        templates: [],
      };
    }
  }

  /**
   * Get list of available templates
   */
  public getTemplates(): ProjectTemplateConfig[] {
    if (!this.config) {
      return [];
    }

    // Sort by order
    return [...this.config.templates].sort((a, b) => a.order - b.order);
  }

  /**
   * Get a specific template by ID
   */
  public getTemplate(templateId: string): ProjectTemplateConfig | null {
    if (!this.config) {
      return null;
    }

    return this.config.templates.find((t) => t.id === templateId) || null;
  }

  /**
   * Apply a template to a project directory
   */
  public async applyTemplate(
    templateId: string,
    projectPath: string,
    projectName: string
  ): Promise<TemplateApplicationResult> {
    const template = this.getTemplate(templateId);

    if (!template) {
      return {
        success: false,
        filesCreated: [],
        error: `Template not found: ${templateId}`,
      };
    }

    if (!this.templatesBasePath) {
      return {
        success: false,
        filesCreated: [],
        error: 'Templates base path not configured',
      };
    }

    const templatePath = path.join(this.templatesBasePath, template.templateDir);

    if (!fs.existsSync(templatePath)) {
      console.warn(`[ProjectTemplateManager] Template directory not found: ${templatePath}`);
      // Return success with empty files if template dir doesn't exist
      // This allows the "blank" template to work even without files
      return {
        success: true,
        filesCreated: [],
      };
    }

    const filesCreated: string[] = [];
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const dateOnly = now.toISOString().substring(0, 10);

    try {
      // Copy all files from template directory
      await this.copyTemplateFiles(
        templatePath,
        projectPath,
        projectName,
        timestamp,
        dateOnly,
        filesCreated
      );

      console.log(
        `[ProjectTemplateManager] Applied template '${templateId}' to ${projectPath}, created ${filesCreated.length} files`
      );

      return {
        success: true,
        filesCreated,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ProjectTemplateManager] Failed to apply template:', error);
      return {
        success: false,
        filesCreated,
        error: message,
      };
    }
  }

  /**
   * Recursively copy template files with variable substitution
   */
  private async copyTemplateFiles(
    srcDir: string,
    destDir: string,
    projectName: string,
    timestamp: string,
    dateOnly: string,
    filesCreated: string[]
  ): Promise<void> {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        // Create directory if it doesn't exist
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        // Recursively copy contents
        await this.copyTemplateFiles(
          srcPath,
          destPath,
          projectName,
          timestamp,
          dateOnly,
          filesCreated
        );
      } else {
        // Read file content
        let content = fs.readFileSync(srcPath, 'utf-8');

        // Replace template variables
        content = this.replaceTemplateVariables(
          content,
          projectName,
          timestamp,
          dateOnly
        );

        // Write file
        fs.writeFileSync(destPath, content, 'utf-8');
        filesCreated.push(destPath);
      }
    }
  }

  /**
   * Replace template variables in content
   */
  private replaceTemplateVariables(
    content: string,
    projectName: string,
    timestamp: string,
    dateOnly: string
  ): string {
    return content
      .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
      .replace(/\{\{TIMESTAMP\}\}/g, timestamp)
      .replace(/\{\{DATE\}\}/g, dateOnly);
  }

  /**
   * Replace template variables using context object
   */
  private replaceVariablesWithContext(
    content: string,
    context: TemplateVariablesContext
  ): string {
    let result = content;
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, String(value));
    }
    return result;
  }

  /**
   * Check if a template exists and has files
   */
  public templateExists(templateId: string): boolean {
    const template = this.getTemplate(templateId);
    if (!template || !this.templatesBasePath) {
      return false;
    }

    const templatePath = path.join(this.templatesBasePath, template.templateDir);
    return fs.existsSync(templatePath);
  }

  /**
   * Check if a template is enhanced (v2 format)
   */
  public isEnhancedTemplate(templateId: string): boolean {
    const template = this.getTemplate(templateId);
    if (!template || !this.templatesBasePath) {
      return false;
    }

    const templateJsonPath = path.join(
      this.templatesBasePath,
      template.templateDir,
      'template.json'
    );
    return fs.existsSync(templateJsonPath);
  }

  /**
   * Load enhanced template configuration
   */
  public loadEnhancedConfig(templateId: string): EnhancedTemplateConfig | null {
    const template = this.getTemplate(templateId);
    if (!template || !this.templatesBasePath) {
      return null;
    }

    const templateJsonPath = path.join(
      this.templatesBasePath,
      template.templateDir,
      'template.json'
    );

    if (!fs.existsSync(templateJsonPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(templateJsonPath, 'utf-8');
      const enhancedConfig = JSON.parse(content) as EnhancedTemplateConfig;
      // Merge with base template config
      return {
        ...template,
        ...enhancedConfig,
      };
    } catch (error) {
      console.error('[ProjectTemplateManager] Failed to load enhanced config:', error);
      return null;
    }
  }

  /**
   * Apply enhanced template (v2 format)
   */
  public async applyEnhancedTemplate(
    templateId: string,
    projectPath: string,
    projectName: string,
    customVariables?: Record<string, string | boolean | number>
  ): Promise<TemplateApplicationResult> {
    const enhancedConfig = this.loadEnhancedConfig(templateId);

    if (!enhancedConfig) {
      // Fall back to v1 template application
      return this.applyTemplate(templateId, projectPath, projectName);
    }

    if (!this.templatesBasePath) {
      return {
        success: false,
        filesCreated: [],
        error: 'Templates base path not configured',
      };
    }

    const templatePath = path.join(this.templatesBasePath, enhancedConfig.templateDir);
    const filesCreated: string[] = [];
    const postApplyMessages: PostApplyMessage[] = [];

    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const dateOnly = now.toISOString().substring(0, 10);

    // Build variables context
    const context: TemplateVariablesContext = {
      PROJECT_NAME: projectName,
      PROJECT_PATH: projectPath,
      TIMESTAMP: timestamp,
      DATE: dateOnly,
      ...customVariables,
    };

    try {
      // 1. Copy project files
      const filesDir = path.join(templatePath, 'files');
      if (fs.existsSync(filesDir)) {
        await this.copyEnhancedTemplateFiles(
          filesDir,
          projectPath,
          context,
          enhancedConfig.files,
          filesCreated
        );
      } else {
        // Fallback: copy all files except special directories
        await this.copyTemplateFilesExcluding(
          templatePath,
          projectPath,
          context,
          ['ai-cli', 'knowledge', 'scripts', 'template.json'],
          filesCreated
        );
      }

      // 2. Apply AI CLI configuration
      let aiCliConfigured = false;
      if (enhancedConfig.aiCli) {
        aiCliConfigured = await this.applyAICliConfig(
          templatePath,
          projectPath,
          enhancedConfig.aiCli,
          context
        );
      }

      // 3. Copy knowledge base
      let knowledgeConfigured = false;
      if (enhancedConfig.knowledge?.enabled) {
        knowledgeConfigured = await this.applyKnowledgeConfig(
          templatePath,
          projectPath,
          enhancedConfig.knowledge,
          context
        );
      }

      // 4. Run post-apply scripts
      if (enhancedConfig.postApply?.scripts) {
        await this.runPostApplyScripts(
          projectPath,
          enhancedConfig.postApply.scripts,
          context
        );
      }

      // 5. Collect post-apply messages
      if (enhancedConfig.postApply?.messages) {
        postApplyMessages.push(...enhancedConfig.postApply.messages);
      }

      console.log(
        `[ProjectTemplateManager] Applied enhanced template '${templateId}' to ${projectPath}`
      );

      return {
        success: true,
        filesCreated,
        aiCliConfigured,
        knowledgeConfigured,
        postApplyMessages,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ProjectTemplateManager] Failed to apply enhanced template:', error);
      return {
        success: false,
        filesCreated,
        error: message,
      };
    }
  }

  /**
   * Copy enhanced template files with include/exclude/rename support
   */
  private async copyEnhancedTemplateFiles(
    srcDir: string,
    destDir: string,
    context: TemplateVariablesContext,
    filesConfig: EnhancedTemplateConfig['files'],
    filesCreated: string[]
  ): Promise<void> {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });
    const renameMap = filesConfig?.rename || {};

    for (const entry of entries) {
      let destName = entry.name;

      // Check rename map
      if (renameMap[entry.name]) {
        destName = renameMap[entry.name];
      }

      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, destName);

      // Check exclude patterns (simple matching)
      if (filesConfig?.exclude) {
        const shouldExclude = filesConfig.exclude.some((pattern) => {
          if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));
            return regex.test(entry.name);
          }
          return entry.name === pattern;
        });
        if (shouldExclude) continue;
      }

      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        await this.copyEnhancedTemplateFiles(
          srcPath,
          destPath,
          context,
          filesConfig,
          filesCreated
        );
      } else {
        let content = fs.readFileSync(srcPath, 'utf-8');
        content = this.replaceVariablesWithContext(content, context);
        fs.writeFileSync(destPath, content, 'utf-8');
        filesCreated.push(destPath);
      }
    }
  }

  /**
   * Copy template files excluding specific directories
   */
  private async copyTemplateFilesExcluding(
    srcDir: string,
    destDir: string,
    context: TemplateVariablesContext,
    excludeDirs: string[],
    filesCreated: string[]
  ): Promise<void> {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      if (excludeDirs.includes(entry.name)) continue;

      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        await this.copyTemplateFilesExcluding(
          srcPath,
          destPath,
          context,
          [],
          filesCreated
        );
      } else {
        let content = fs.readFileSync(srcPath, 'utf-8');
        content = this.replaceVariablesWithContext(content, context);
        fs.writeFileSync(destPath, content, 'utf-8');
        filesCreated.push(destPath);
      }
    }
  }

  /**
   * Apply AI CLI configuration from template
   */
  private async applyAICliConfig(
    templatePath: string,
    projectPath: string,
    aiCliConfig: TemplateAICliConfig,
    context: TemplateVariablesContext
  ): Promise<boolean> {
    try {
      const aiCliDir = path.join(templatePath, 'ai-cli');
      if (!fs.existsSync(aiCliDir)) {
        console.log('[ProjectTemplateManager] No ai-cli directory found');
        return false;
      }

      // Create .claude directory for Claude Code CLI plugins
      const claudeDir = path.join(projectPath, '.claude');
      if (!fs.existsSync(claudeDir)) {
        fs.mkdirSync(claudeDir, { recursive: true });
      }

      // Copy plugins
      if (aiCliConfig.plugins) {
        const pluginsSourceDir = path.join(aiCliDir, 'plugins');
        if (fs.existsSync(pluginsSourceDir)) {
          await this.copyPluginsToProject(pluginsSourceDir, claudeDir, context);
        }
      }

      // Copy MCP configuration
      if (aiCliConfig.mcp) {
        const mcpConfigPath = path.join(aiCliDir, 'mcp', 'mcp-config.json');
        if (fs.existsSync(mcpConfigPath)) {
          let mcpContent = fs.readFileSync(mcpConfigPath, 'utf-8');
          mcpContent = this.replaceVariablesWithContext(mcpContent, context);
          const destMcpPath = path.join(claudeDir, 'mcp-config.json');
          fs.writeFileSync(destMcpPath, mcpContent, 'utf-8');
        }
      }

      // Copy prompts
      if (aiCliConfig.prompts) {
        const promptsDir = path.join(aiCliDir, 'prompts');
        if (fs.existsSync(promptsDir)) {
          const destPromptsDir = path.join(claudeDir, 'prompts');
          if (!fs.existsSync(destPromptsDir)) {
            fs.mkdirSync(destPromptsDir, { recursive: true });
          }
          await this.copyDirectoryWithVariables(promptsDir, destPromptsDir, context);
        }
      }

      console.log('[ProjectTemplateManager] AI CLI configuration applied');
      return true;
    } catch (error) {
      console.error('[ProjectTemplateManager] Failed to apply AI CLI config:', error);
      return false;
    }
  }

  /**
   * Copy plugins to project
   */
  private async copyPluginsToProject(
    srcDir: string,
    destDir: string,
    context: TemplateVariablesContext
  ): Promise<void> {
    const pluginTypes = ['agents', 'skills', 'commands', 'hooks'];

    for (const pluginType of pluginTypes) {
      const srcPluginDir = path.join(srcDir, pluginType);
      if (!fs.existsSync(srcPluginDir)) continue;

      const destPluginDir = path.join(destDir, pluginType);
      if (!fs.existsSync(destPluginDir)) {
        fs.mkdirSync(destPluginDir, { recursive: true });
      }

      await this.copyDirectoryWithVariables(srcPluginDir, destPluginDir, context);
    }
  }

  /**
   * Copy directory with variable substitution
   */
  private async copyDirectoryWithVariables(
    srcDir: string,
    destDir: string,
    context: TemplateVariablesContext
  ): Promise<void> {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);

      if (entry.isDirectory()) {
        if (!fs.existsSync(destPath)) {
          fs.mkdirSync(destPath, { recursive: true });
        }
        await this.copyDirectoryWithVariables(srcPath, destPath, context);
      } else {
        // Only process text files
        const ext = path.extname(entry.name).toLowerCase();
        const textExtensions = ['.md', '.json', '.js', '.ts', '.sh', '.yaml', '.yml', '.txt'];

        if (textExtensions.includes(ext)) {
          let content = fs.readFileSync(srcPath, 'utf-8');
          content = this.replaceVariablesWithContext(content, context);
          fs.writeFileSync(destPath, content, 'utf-8');
        } else {
          // Copy binary files as-is
          fs.copyFileSync(srcPath, destPath);
        }
      }
    }
  }

  /**
   * Apply knowledge configuration from template
   */
  private async applyKnowledgeConfig(
    templatePath: string,
    projectPath: string,
    knowledgeConfig: TemplateKnowledgeConfig,
    context: TemplateVariablesContext
  ): Promise<boolean> {
    try {
      const knowledgeSourceDir = path.join(templatePath, 'knowledge');
      if (!fs.existsSync(knowledgeSourceDir)) {
        return false;
      }

      const knowledgeDestDir = path.join(projectPath, '.knowledge');
      if (!fs.existsSync(knowledgeDestDir)) {
        fs.mkdirSync(knowledgeDestDir, { recursive: true });
      }

      // Copy local knowledge sources
      for (const source of knowledgeConfig.sources) {
        if (source.type === 'local' && source.path) {
          // Simple directory copy for now
          const sourcePath = path.join(knowledgeSourceDir, source.path.split('/')[0]);
          if (fs.existsSync(sourcePath)) {
            const destPath = path.join(knowledgeDestDir, path.basename(sourcePath));
            await this.copyDirectoryWithVariables(sourcePath, destPath, context);
          }
        }
      }

      // Write knowledge config
      const configPath = path.join(knowledgeDestDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(knowledgeConfig, null, 2), 'utf-8');

      console.log('[ProjectTemplateManager] Knowledge configuration applied');
      return true;
    } catch (error) {
      console.error('[ProjectTemplateManager] Failed to apply knowledge config:', error);
      return false;
    }
  }

  /**
   * Run post-apply scripts
   */
  private async runPostApplyScripts(
    projectPath: string,
    scripts: PostApplyScript[],
    context: TemplateVariablesContext
  ): Promise<void> {
    const execAsync = promisify(exec);

    for (const script of scripts) {
      // Check platform
      if (script.platforms && !script.platforms.includes(process.platform)) {
        continue;
      }

      // Check condition
      if (script.condition) {
        if (script.condition.startsWith('file:')) {
          const filePath = path.join(projectPath, script.condition.substring(5));
          if (!fs.existsSync(filePath)) continue;
        } else if (script.condition.startsWith('not:dir:')) {
          const dirPath = path.join(projectPath, script.condition.substring(8));
          if (fs.existsSync(dirPath)) continue;
        }
      }

      try {
        const command = this.replaceVariablesWithContext(script.command, context);
        console.log(`[ProjectTemplateManager] Running post-apply script: ${command}`);

        await execAsync(command, {
          cwd: projectPath,
          timeout: (script.timeout || 120) * 1000,
        });
      } catch (error) {
        console.error('[ProjectTemplateManager] Post-apply script failed:', error);
        // Continue with other scripts
      }
    }
  }

  /**
   * Get template variables definition (for UI)
   */
  public getTemplateVariables(templateId: string): TemplateVariable[] {
    const enhancedConfig = this.loadEnhancedConfig(templateId);
    if (!enhancedConfig?.variables) {
      return [];
    }
    return enhancedConfig.variables;
  }

  /**
   * Get template AI CLI configuration summary (for UI)
   */
  public getTemplateAICliSummary(templateId: string): {
    hasAgents: boolean;
    hasSkills: boolean;
    hasMCP: boolean;
    hasHooks: boolean;
    agentCount: number;
    skillCount: number;
    mcpServerCount: number;
  } | null {
    const enhancedConfig = this.loadEnhancedConfig(templateId);
    if (!enhancedConfig?.aiCli) {
      return null;
    }

    const { plugins, mcp } = enhancedConfig.aiCli;
    return {
      hasAgents: Boolean(plugins?.agents?.length),
      hasSkills: Boolean(plugins?.skills?.length),
      hasMCP: Boolean(mcp?.servers?.length),
      hasHooks: Boolean(plugins?.hooks?.length),
      agentCount: plugins?.agents?.length || 0,
      skillCount: plugins?.skills?.length || 0,
      mcpServerCount: mcp?.servers?.length || 0,
    };
  }
}
