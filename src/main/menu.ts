import { app, Menu, shell, BrowserWindow } from 'electron'
import path from 'path'

export function setupMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.getName(),
            submenu: [
              {
                label: `关于 ${app.getName()}`,
                click: () => {
                  const focusedWindow = BrowserWindow.getFocusedWindow()
                  if (focusedWindow) {
                    focusedWindow.webContents.send('menu:show-about')
                  }
                }
              },
              { type: 'separator' as const },
              {
                label: '服务',
                role: 'services' as const
              },
              { type: 'separator' as const },
              {
                label: `隐藏 ${app.getName()}`,
                role: 'hide' as const
              },
              {
                label: '隐藏其他',
                role: 'hideOthers' as const
              },
              {
                label: '显示全部',
                role: 'unhide' as const
              },
              { type: 'separator' as const },
              {
                label: '退出',
                role: 'quit' as const
              }
            ]
          }
        ]
      : []),

    // File menu
    {
      label: '文件',
      submenu: [
        isMac
          ? {
              label: '关闭窗口',
              role: 'close' as const
            }
          : {
              label: '退出',
              role: 'quit' as const
            }
      ]
    },

    // Edit menu
    {
      label: '编辑',
      submenu: [
        {
          label: '撤销',
          role: 'undo' as const
        },
        {
          label: '重做',
          role: 'redo' as const
        },
        { type: 'separator' as const },
        {
          label: '剪切',
          role: 'cut' as const
        },
        {
          label: '复制',
          role: 'copy' as const
        },
        {
          label: '粘贴',
          role: 'paste' as const
        },
        ...(isMac
          ? [
              {
                label: '粘贴并匹配样式',
                role: 'pasteAndMatchStyle' as const
              },
              {
                label: '删除',
                role: 'delete' as const
              },
              {
                label: '全选',
                role: 'selectAll' as const
              }
            ]
          : [
              {
                label: '删除',
                role: 'delete' as const
              },
              { type: 'separator' as const },
              {
                label: '全选',
                role: 'selectAll' as const
              }
            ])
      ]
    },

    // View menu
    {
      label: '视图',
      submenu: [
        {
          label: '重新加载',
          role: 'reload' as const
        },
        {
          label: '强制重新加载',
          role: 'forceReload' as const
        },
        {
          label: '切换开发者工具',
          role: 'toggleDevTools' as const
        },
        { type: 'separator' as const },
        {
          label: '实际大小',
          role: 'resetZoom' as const
        },
        {
          label: '放大',
          role: 'zoomIn' as const
        },
        {
          label: '缩小',
          role: 'zoomOut' as const
        },
        { type: 'separator' as const },
        {
          label: '切换全屏',
          role: 'togglefullscreen' as const
        }
      ]
    },

    // Window menu
    {
      label: '窗口',
      submenu: [
        {
          label: '最小化',
          role: 'minimize' as const
        },
        {
          label: '缩放',
          role: 'zoom' as const
        },
        ...(isMac
          ? [
              { type: 'separator' as const },
              {
                label: '前置全部窗口',
                role: 'front' as const
              }
            ]
          : [
              {
                label: '关闭',
                role: 'close' as const
              }
            ])
      ]
    },

    // Help menu
    {
      label: '帮助',
      submenu: [
        {
          label: '访问官网',
          click: async () => {
            await shell.openExternal('https://within-7.com')
          }
        },
        {
          label: '文档',
          click: async () => {
            await shell.openExternal('https://within-7.com')
          }
        },
        { type: 'separator' as const },
        {
          label: `${app.getName()} 版本 ${app.getVersion()}`,
          enabled: false
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  // Set About panel info (macOS)
  if (isMac) {
    app.setAboutPanelOptions({
      applicationName: 'AiTer',
      applicationVersion: app.getVersion(),
      version: app.getVersion(),
      copyright: 'Copyright © 2025-2026 Within-7.com\n任小姐出海战略咨询\n开发者: Lib',
      website: 'https://within-7.com',
      iconPath: path.join(app.getAppPath(), 'assets/logo.png')
    })
  }
}
