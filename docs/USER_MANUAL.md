# AiTer 用户手册

> **版本**: v0.1.0
> **更新时间**: 2025年12月
> **适用对象**: 跨境电商战略咨询团队全体成员

---

## 目录

1. [快速开始](#快速开始)
2. [核心概念](#核心概念)
3. [基础操作](#基础操作)
4. [高级功能](#高级功能)
5. [AI协作实践](#ai协作实践)
6. [项目管理](#项目管理)
7. [文件编辑器](#文件编辑器)
8. [快捷键参考](#快捷键参考)
9. [常见问题](#常见问题)
10. [故障排除](#故障排除)

---

## 快速开始

### 安装

#### macOS
1. 下载 `AiTer-{version}.dmg` 文件
2. 双击打开DMG文件
3. 拖动AiTer图标到Applications文件夹
4. 在应用程序中找到AiTer并启动

**首次运行提示**: 如遇到"无法打开,因为Apple无法检查恶意软件"的提示:
- 打开系统偏好设置 → 安全性与隐私
- 点击"仍然打开"按钮
- 或在终端运行: `xattr -cr /Applications/AiTer.app`

#### Windows
1. 下载 `AiTer-Setup-{version}.exe` 文件
2. 双击运行安装程序
3. 按照安装向导完成安装
4. 从开始菜单启动AiTer

### 初次使用

1. **创建第一个项目**
   - 点击左侧边栏的"添加项目"按钮 (+)
   - 选择项目文件夹(建议选择Git仓库根目录)
   - 输入项目名称(可选,默认使用文件夹名)
   - 点击"确定"完成创建

2. **打开终端**
   - 项目创建后自动打开第一个终端
   - 或点击工作区顶部的 "+ 新建终端"

3. **开始AI协作**
   - 在终端中输入AI CLI命令,例如:
     ```bash
     minto "帮我分析这个项目的结构"
     claude-code "优化这段代码"
     ```

---

## 核心概念

### 项目 (Project)

**定义**: 项目是AiTer中的基本工作单元,对应一个文件系统目录。

**特性**:
- 每个项目有独立的工作空间
- 支持多个终端标签
- 独立的文件服务器(用于HTML预览)
- 项目配置持久化存储

**典型项目类型**:
- 咨询报告项目
- 战略研究项目
- 客户交付项目
- 知识库项目

### 终端 (Terminal)

**定义**: 基于xterm.js的完整终端模拟器,支持所有标准Shell操作。

**特性**:
- 完整的Shell环境(bash/zsh等)
- 命令历史记录
- 智能标签命名(自动显示最后执行的命令)
- 支持颜色、Unicode字符
- 可调整字体大小

### 编辑器标签 (Editor Tab)

**定义**: 用于查看和编辑项目文件的内置编辑器。

**支持的文件类型**:
- **代码文件**: JavaScript, TypeScript, Python, CSS, JSON等
  - Monaco编辑器
  - 语法高亮
  - 代码补全
- **Markdown文件**:
  - 编辑/预览双模式
  - 实时预览
  - GitHub Flavored Markdown支持
- **HTML文件**:
  - 实时预览
  - 自动启动文件服务器
  - 支持相对路径引用

### 文件服务器 (File Server)

**定义**: 每个项目的独立HTTP服务器,用于预览HTML文件和访问静态资源。

**工作原理**:
1. 打开HTML文件时自动启动
2. 分配随机端口(3000-4000范围)
3. 生成访问令牌(安全性)
4. LRU缓存管理(最多10个活跃服务器)
5. 5分钟无活动自动关闭

**使用场景**:
- 预览HTML报告
- 测试静态网站
- 查看Web应用Demo

---

## 基础操作

### 项目管理

#### 添加项目

**方法1: 通过UI添加**
```
1. 点击左侧边栏顶部的 "+" 按钮
2. 在文件选择器中选择项目文件夹
3. (可选)修改项目名称
4. 点击确定
```

**方法2: 拖拽添加**
```
1. 从文件管理器拖拽文件夹到AiTer窗口
2. 自动识别为新项目
```

**建议**:
- ✅ 选择Git仓库根目录作为项目路径
- ✅ 使用描述性的项目名称(例如:"客户A-市场分析-2025Q1")
- ✅ 保持项目路径稳定(避免频繁移动)

#### 切换项目

**方法1: 侧边栏点击**
```
在左侧项目列表中点击项目名称
```

**方法2: 键盘导航**
```
Cmd/Ctrl + 数字键 (1-9) - 快速切换到对应项目
```

#### 移除项目

```
1. 在项目上右键点击
2. 选择"移除项目"
3. 确认操作
```

**注意**: 移除项目只是从AiTer中移除引用,不会删除文件系统中的文件。

### 终端操作

#### 创建新终端

**方法1: 工作区按钮**
```
点击工作区顶部的 "+ 新建终端" 按钮
```

**方法2: 快捷键**
```
Cmd/Ctrl + T - 新建终端标签
```

**方法3: 菜单栏**
```
终端 → 新建终端
```

#### 终端输入输出

**基本使用**:
- 直接输入命令并回车执行
- 支持所有标准Shell命令
- 支持复制粘贴(Cmd+C / Cmd+V 或 Ctrl+C / Ctrl+V)
- 支持上下箭头浏览命令历史

**颜色支持**:
```bash
# 支持ANSI颜色代码
echo -e "\033[31m红色文本\033[0m"
echo -e "\033[32m绿色文本\033[0m"
```

**Unicode支持**:
```bash
# 支持中文和特殊字符
echo "支持中文 ✓ ✗ → ←"
```

#### 关闭终端

**方法1: 标签关闭按钮**
```
点击终端标签右侧的 "×" 按钮
```

**方法2: 快捷键**
```
Cmd/Ctrl + W - 关闭当前标签
```

**方法3: Shell命令**
```bash
exit  # 退出Shell,自动关闭终端
```

### 文件树导航

#### 浏览文件

**展开/折叠目录**:
- 点击文件夹图标或名称
- 双击快速展开/折叠所有子目录

**文件类型识别**:
- 📁 文件夹
- 📄 普通文本文件
- 🔧 配置文件(.json, .yml等)
- 📝 Markdown文件
- 🌐 HTML文件
- 🎨 CSS文件
- ⚙️ JavaScript/TypeScript文件

#### 打开文件

**双击文件**:
- 在编辑器标签中打开
- 自动选择合适的编辑器类型

**支持的操作**:
- 双击: 打开文件
- 右键: 上下文菜单(即将推出)

---

## 高级功能

### 编辑器功能

#### Monaco编辑器 (代码文件)

**功能特性**:
- ✅ 语法高亮
- ✅ 代码补全
- ✅ 智能缩进
- ✅ 括号匹配
- ✅ 查找替换
- ✅ 多光标编辑

**快捷键**:
```
Cmd/Ctrl + F       - 查找
Cmd/Ctrl + H       - 替换
Cmd/Ctrl + /       - 注释/取消注释
Cmd/Ctrl + D       - 选择下一个相同内容
Cmd/Ctrl + Shift + K - 删除行
Alt + ↑/↓          - 移动行
```

**保存文件**:
```
Cmd/Ctrl + S - 保存当前文件
```

#### Markdown编辑器

**编辑模式**:
- 左侧: Markdown源码编辑
- 实时同步滚动

**预览模式**:
- 点击顶部"预览"按钮切换
- 支持GitHub Flavored Markdown
- 支持表格、代码块、任务列表等

**切换编辑/预览**:
```
1. 点击编辑器顶部的"编辑"/"预览"按钮
2. 或使用快捷键: Cmd/Ctrl + Shift + V
```

**支持的Markdown语法**:
```markdown
# 标题
## 二级标题

**粗体** *斜体* ~~删除线~~

- 无序列表
1. 有序列表

[链接](https://example.com)
![图片](./image.png)

| 表头1 | 表头2 |
|------|------|
| 内容1 | 内容2 |

​```javascript
代码块
​```

> 引用

- [ ] 任务列表
- [x] 已完成任务
```

#### HTML预览

**自动启动文件服务器**:
1. 双击HTML文件
2. 自动启动项目文件服务器
3. 在iframe中渲染HTML内容

**刷新预览**:
```
点击预览窗口右上角的刷新按钮
```

**优势**:
- ✅ 支持相对路径资源引用
- ✅ 支持JavaScript执行
- ✅ 支持CSS样式
- ✅ 沙箱隔离安全

**示例HTML文件**:
```html
<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="./style.css">
</head>
<body>
    <h1>测试页面</h1>
    <script src="./script.js"></script>
</body>
</html>
```

### 标签管理

#### 统一标签栏

**特性**:
- 编辑器标签和终端标签共享同一个标签栏
- 可拖拽重新排序
- 支持快速切换

**标签标识**:
- 🖥️ 终端标签: 显示项目名 | 最后执行的命令
- 📄 编辑器标签: 显示文件名

#### 标签切换

**方法1: 鼠标点击**
```
点击标签标题
```

**方法2: 快捷键**
```
Cmd/Ctrl + Tab       - 下一个标签
Cmd/Ctrl + Shift + Tab - 上一个标签
Cmd/Ctrl + 数字(1-9)   - 跳转到指定标签
```

#### 标签关闭

**关闭单个**:
```
点击标签右侧的 × 按钮
或 Cmd/Ctrl + W
```

**关闭所有**:
```
右键标签 → 关闭所有标签(即将推出)
```

### 文件服务器管理

#### 查看服务器状态

**方法1: 状态栏**
```
底部状态栏显示活跃服务器数量
```

**方法2: 开发者工具**
```
菜单 → 查看 → 开发者工具
在Console中查看服务器日志
```

#### 手动停止服务器

**当前版本**: 自动管理,无需手动操作
- 5分钟无活动自动关闭
- 最多保留10个活跃服务器(LRU淘汰)

**未来版本**: 将提供手动控制界面

---

## AI协作实践

### 支持的AI CLI工具

#### Minto CLI

**安装**:
```bash
npm install -g minto-cli
```

**常用命令**:
```bash
# 代码分析
minto "分析这个项目的架构"

# 代码生成
minto "创建一个React组件用于显示用户列表"

# 代码优化
minto "优化这个函数的性能"

# 调试帮助
minto "这个错误是什么原因导致的?"
```

#### Claude Code CLI

**安装**:
```bash
npm install -g @anthropic-ai/claude-code
```

**常用命令**:
```bash
# 项目初始化
claude-code init

# 交互式编程
claude-code chat

# 代码审查
claude-code review ./src

# 生成文档
claude-code docs
```

#### Gemini CLI

**安装**:
```bash
npm install -g @google/gemini-cli
```

**常用命令**:
```bash
# 多模态分析
gemini analyze ./screenshot.png

# 代码生成
gemini code "创建API服务"

# 内容生成
gemini write "商业计划书大纲"
```

### AI协作最佳实践

#### 1. 项目上下文管理

**为AI提供完整上下文**:

```bash
# 方法1: 使用项目README
# 在项目根目录创建 CLAUDE.md 或 MINTO.md
# 描述项目结构、技术栈、规范等

# 方法2: 使用 .ai 目录
mkdir .ai
echo "项目规范和上下文" > .ai/context.md
```

**示例 CLAUDE.md**:
```markdown
# 项目上下文

## 项目概述
这是一个跨境电商战略分析项目,目标是为客户A制定东南亚市场进入策略。

## 技术栈
- 数据分析: Python + Pandas
- 可视化: Matplotlib, Plotly
- 报告生成: Markdown → PDF

## 目录结构
- /data: 原始数据
- /analysis: 分析脚本
- /reports: 生成的报告
- /templates: 报告模板

## 规范
- 使用PEP 8代码风格
- 所有分析脚本需包含注释
- 报告使用统一模板
```

#### 2. 多终端并行工作

**场景**: 同时进行数据分析和报告撰写

**终端1: 数据处理**
```bash
# 重命名终端: "数据分析"
cd analysis
python process_data.py

# AI协作
minto "优化这个数据处理脚本的性能"
```

**终端2: AI协作**
```bash
# 重命名终端: "AI助手"
claude-code chat

# 在AI会话中工作
> 帮我分析 data/sales.csv 中的趋势
> 生成一个销售预测模型
```

**终端3: 报告撰写**
```bash
# 重命名终端: "文档"
cd reports

# 实时预览Markdown
# 在AiTer中打开 report.md 文件
# 边写边预览
```

#### 3. AI辅助代码审查

**工作流**:

```bash
# 1. 创建功能分支
git checkout -b feature/market-analysis

# 2. 编写代码
# 在AiTer编辑器中编写分析脚本

# 3. AI审查
claude-code review ./analysis/market_analysis.py

# 4. 应用建议
# 根据AI反馈修改代码

# 5. 提交
git add .
git commit -m "完成市场分析模块"
```

#### 4. AI辅助知识提取

**从对话中提取可复用知识**:

```bash
# 终端1: AI对话
minto "如何分析竞争对手定价策略?"

# AI给出详细方法后...

# 终端2: 保存到知识库
mkdir -p knowledge/pricing-analysis
minto "将刚才的方法整理成Markdown文档" > knowledge/pricing-analysis/methodology.md
```

#### 5. 批量任务处理

**使用AI批量生成内容**:

```bash
# 生成多个市场的分析模板
for market in "日本" "韩国" "新加坡" "泰国"; do
  minto "创建${market}市场分析报告模板,包含:市场规模、竞争格局、进入壁垒、机会分析" > "reports/${market}_analysis_template.md"
done
```

---

## 项目管理

### 项目组织最佳实践

#### 推荐目录结构

**咨询项目标准结构**:

```
project-name/
├── README.md              # 项目概述
├── CLAUDE.md             # AI上下文配置
├── .gitignore
├── data/                 # 数据文件
│   ├── raw/             # 原始数据
│   ├── processed/       # 处理后数据
│   └── external/        # 外部数据源
├── analysis/            # 分析脚本
│   ├── exploratory/    # 探索性分析
│   ├── models/         # 模型代码
│   └── visualization/  # 可视化脚本
├── reports/             # 报告输出
│   ├── drafts/         # 草稿
│   ├── final/          # 最终版本
│   └── presentations/  # 演示文稿
├── knowledge/           # 知识库
│   ├── best-practices/ # 最佳实践
│   ├── templates/      # 模板
│   └── references/     # 参考资料
└── tools/               # 辅助工具
    └── scripts/        # 自动化脚本
```

#### 项目命名规范

**建议格式**:
```
{客户}-{项目类型}-{日期}

示例:
- ClientA-MarketEntry-2025Q1
- ClientB-SupplyChain-202501
- Internal-KnowledgeBase-2025
```

**优势**:
- 易于识别和查找
- 按时间排序
- 清晰的项目归属

### 多项目协作

#### 场景1: 并行处理多个客户项目

**工作流**:

1. **项目1: 客户A - 市场分析**
   ```
   - 终端1: 运行数据分析脚本
   - 终端2: AI协作生成洞察
   - 编辑器: 撰写分析报告
   ```

2. **项目2: 客户B - 战略规划**
   ```
   - 终端1: AI协作头脑风暴
   - 编辑器: 整理战略框架
   ```

3. **项目3: 内部 - 知识库**
   ```
   - 编辑器: 沉淀最佳实践文档
   ```

**快速切换**:
```
Cmd/Ctrl + 1  # 切换到项目1
Cmd/Ctrl + 2  # 切换到项目2
Cmd/Ctrl + 3  # 切换到项目3
```

#### 场景2: 知识复用

**从项目A复用到项目B**:

```bash
# 项目A (已完成的市场分析项目)
cd ~/projects/ClientA-MarketEntry-2025Q1
ls templates/

# 项目B (新项目)
cd ~/projects/ClientC-MarketEntry-2025Q2

# 复用模板
cp ~/projects/ClientA-MarketEntry-2025Q1/templates/market-analysis-template.md ./

# AI辅助定制
minto "将这个模板适配到越南市场,保留结构,更新数据要求"
```

---

## 文件编辑器

### 代码编辑

#### 支持的语言

**完整语法高亮支持**:
- JavaScript / TypeScript
- Python
- Java
- C / C++
- Go
- Rust
- CSS / SCSS / Less
- HTML
- JSON / YAML
- Markdown
- Shell Script

#### 编辑功能

**智能补全**:
```javascript
// 输入 "func" 后自动建议
function myFunction() {
  // ...
}
```

**多光标编辑**:
```
1. Alt + Click - 添加光标
2. Cmd/Ctrl + D - 选择下一个相同内容
3. Cmd/Ctrl + Shift + L - 选择所有相同内容
```

**代码格式化**:
```
Shift + Alt + F - 格式化文档
```

### Markdown编辑

#### 实时预览

**工作流**:
1. 在左侧编辑器中撰写Markdown
2. 右侧实时预览渲染效果
3. 滚动同步

**预览样式**:
- GitHub Flavored Markdown风格
- 代码块语法高亮
- 表格、任务列表支持

#### 导出选项

**当前版本**:
- 直接复制Markdown文本
- 在预览模式下复制HTML

**未来版本**:
- 导出为PDF
- 导出为HTML
- 导出为Word文档

### HTML预览

#### 实时渲染

**特性**:
- 修改HTML文件后自动刷新预览
- 支持JavaScript交互
- 支持CSS样式
- 支持相对路径资源

**调试工具**:
```
右键预览窗口 → 检查元素
打开Chrome DevTools进行调试
```

#### 静态网站开发

**示例项目结构**:
```
website/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── script.js
└── images/
    └── logo.png
```

**工作流**:
1. 在AiTer中打开 index.html
2. 自动启动文件服务器
3. 实时预览网站效果
4. 编辑文件,刷新预览

---

## 快捷键参考

### 全局快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Cmd/Ctrl + N` | 新建项目 | 打开项目选择器 |
| `Cmd/Ctrl + T` | 新建终端 | 在当前项目创建终端 |
| `Cmd/Ctrl + W` | 关闭标签 | 关闭当前活跃标签 |
| `Cmd/Ctrl + Tab` | 下一个标签 | 循环切换标签 |
| `Cmd/Ctrl + Shift + Tab` | 上一个标签 | 反向循环 |
| `Cmd/Ctrl + 1-9` | 跳转标签 | 快速跳转到指定标签 |
| `Cmd/Ctrl + ,` | 打开设置 | (即将推出) |
| `Cmd/Ctrl + Q` | 退出应用 | 关闭AiTer |

### 编辑器快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Cmd/Ctrl + S` | 保存文件 | 保存当前编辑器内容 |
| `Cmd/Ctrl + F` | 查找 | 在当前文件查找 |
| `Cmd/Ctrl + H` | 替换 | 查找并替换 |
| `Cmd/Ctrl + /` | 注释 | 切换行注释 |
| `Cmd/Ctrl + D` | 选择下一个 | 多光标编辑 |
| `Alt + ↑/↓` | 移动行 | 上下移动当前行 |
| `Cmd/Ctrl + Shift + K` | 删除行 | 删除当前行 |
| `Shift + Alt + F` | 格式化 | 格式化代码 |
| `Cmd/Ctrl + Shift + V` | 切换预览 | Markdown预览 |

### 终端快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Cmd/Ctrl + C` | 复制 | 复制选中文本 |
| `Cmd/Ctrl + V` | 粘贴 | 粘贴文本 |
| `Ctrl + C` | 中断 | 中断当前命令 |
| `Ctrl + D` | EOF | 发送EOF信号 |
| `↑/↓` | 历史记录 | 浏览命令历史 |
| `Tab` | 自动补全 | Shell自动补全 |
| `Ctrl + L` | 清屏 | 清空终端显示 |

---

## 常见问题

### 1. 如何在AiTer中使用特定版本的Node.js?

**问题**: 项目需要特定Node.js版本。

**解决方案**:

**方法1: 使用nvm (推荐)**
```bash
# 在AiTer终端中
nvm install 18
nvm use 18
node --version  # 验证版本
```

**方法2: 修改系统PATH**
```bash
# 临时修改
export PATH="/path/to/node/18/bin:$PATH"

# 永久修改(添加到 ~/.zshrc 或 ~/.bashrc)
echo 'export PATH="/path/to/node/18/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### 2. 如何在多个项目间共享配置?

**问题**: 多个项目需要相同的Shell配置、环境变量等。

**解决方案**:

**方法1: 使用符号链接**
```bash
# 创建共享配置文件
mkdir ~/shared-config
cat > ~/shared-config/common.sh << 'EOF'
export API_KEY="xxx"
alias ll="ls -la"
EOF

# 在每个项目的启动脚本中引用
echo "source ~/shared-config/common.sh" >> ~/.zshrc
```

**方法2: 使用dotfiles仓库**
```bash
# 创建dotfiles仓库
cd ~
git clone https://github.com/yourname/dotfiles.git
ln -s ~/dotfiles/.zshrc ~/.zshrc
ln -s ~/dotfiles/.gitconfig ~/.gitconfig
```

### 3. 如何提高大型项目的文件树加载速度?

**问题**: 项目文件很多,文件树加载慢。

**解决方案**:

**方法1: 使用 .gitignore 排除无关文件**
```gitignore
# .gitignore
node_modules/
.venv/
dist/
build/
*.log
.DS_Store
```

**方法2: 分模块管理**
```
# 不要将整个monorepo作为一个项目
# 而是分成多个子项目
project/
  ├── module-a/  (单独的AiTer项目)
  ├── module-b/  (单独的AiTer项目)
  └── module-c/  (单独的AiTer项目)
```

### 4. 如何备份AiTer的项目配置?

**问题**: 换电脑或重装系统后如何恢复项目列表?

**解决方案**:

**配置文件位置**:
- macOS: `~/Library/Application Support/airter/config.json`
- Windows: `%APPDATA%\airter\config.json`

**备份方法**:
```bash
# macOS
cp ~/Library/Application\ Support/airter/config.json ~/Dropbox/airter-backup.json

# 恢复
cp ~/Dropbox/airter-backup.json ~/Library/Application\ Support/airter/config.json
```

### 5. 如何在AiTer中使用Python虚拟环境?

**问题**: 不同项目需要不同的Python包。

**解决方案**:

**创建虚拟环境**:
```bash
# 项目1
cd ~/projects/project-a
python -m venv .venv
source .venv/bin/activate
pip install pandas numpy

# 项目2
cd ~/projects/project-b
python -m venv .venv
source .venv/bin/activate
pip install flask requests
```

**自动激活虚拟环境**:
```bash
# 在项目根目录创建 .envrc 文件
echo "source .venv/bin/activate" > .envrc

# 使用direnv自动加载(需要先安装direnv)
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
direnv allow .
```

### 6. 如何处理终端中文显示问题?

**问题**: 终端显示中文乱码。

**解决方案**:

**检查locale设置**:
```bash
locale

# 应该看到:
# LANG=zh_CN.UTF-8
# LC_ALL=zh_CN.UTF-8
```

**设置正确的locale**:
```bash
# 添加到 ~/.zshrc
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8
```

---

## 故障排除

### 终端无响应

**症状**: 终端不接受输入或输出卡住。

**原因**:
1. Shell进程崩溃
2. 后台进程占用
3. 命令执行时间过长

**解决方法**:

**方法1: 中断当前命令**
```
按 Ctrl + C
```

**方法2: 关闭并重新打开终端**
```
点击标签的 × 按钮
点击 "+ 新建终端"
```

**方法3: 检查后台进程**
```bash
# 查看所有进程
ps aux | grep [进程名]

# 杀死卡住的进程
kill -9 [PID]
```

### 文件服务器启动失败

**症状**: HTML文件无法预览,提示"服务器启动失败"。

**原因**:
1. 端口被占用
2. 权限不足
3. 文件路径无效

**解决方法**:

**方法1: 检查端口占用**
```bash
# macOS/Linux
lsof -i :3000-4000

# Windows
netstat -ano | findstr "3000"

# 杀死占用端口的进程
kill -9 [PID]
```

**方法2: 检查文件权限**
```bash
# 确保项目目录可读
ls -la [项目路径]

# 修复权限
chmod -R 755 [项目路径]
```

**方法3: 重启AiTer**
```
完全退出AiTer
重新启动应用
```

### 编辑器无法保存文件

**症状**: 按 Cmd+S 后提示保存失败。

**原因**:
1. 文件只读
2. 磁盘空间不足
3. 权限不足

**解决方法**:

**方法1: 检查文件权限**
```bash
ls -l [文件路径]

# 添加写权限
chmod u+w [文件路径]
```

**方法2: 检查磁盘空间**
```bash
df -h

# 如果空间不足,清理磁盘
```

**方法3: 另存为**
```
尝试保存到其他位置
然后移动文件
```

### AI CLI工具无法使用

**症状**: 在AiTer终端中运行AI命令提示"command not found"。

**原因**:
1. AI CLI未安装
2. PATH环境变量未设置
3. npm全局安装路径问题

**解决方法**:

**方法1: 检查是否安装**
```bash
which minto
which claude-code

# 如果没有输出,需要安装
npm install -g minto-cli
npm install -g @anthropic-ai/claude-code
```

**方法2: 检查npm全局路径**
```bash
npm config get prefix
# 应该是 /usr/local 或 ~/.npm-global

# 确保在PATH中
echo $PATH | grep npm
```

**方法3: 修复npm全局路径**
```bash
# 创建全局目录
mkdir ~/.npm-global

# 配置npm
npm config set prefix '~/.npm-global'

# 添加到PATH
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.zshrc
source ~/.zshrc

# 重新安装全局包
npm install -g minto-cli
```

### 应用启动缓慢

**症状**: AiTer启动需要很长时间。

**原因**:
1. 项目过多
2. 大型项目文件树加载
3. 系统资源不足

**解决方法**:

**方法1: 减少项目数量**
```
移除不常用的项目
保留常用项目(建议<10个)
```

**方法2: 优化项目大小**
```
确保 .gitignore 排除了 node_modules/, dist/ 等大型目录
```

**方法3: 清理缓存**
```bash
# macOS
rm -rf ~/Library/Application\ Support/airter/cache

# Windows
del /s /q %APPDATA%\airter\cache
```

---

## 附录

### 推荐工具集成

#### Shell增强

**Oh My Zsh**:
```bash
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"
```

**常用插件**:
```bash
# ~/.zshrc
plugins=(
  git
  zsh-autosuggestions
  zsh-syntax-highlighting
  docker
  npm
)
```

#### 命令行工具

**推荐安装**:
```bash
# 现代化的 ls
brew install exa
alias ls="exa"

# 现代化的 cat
brew install bat
alias cat="bat"

# 模糊查找
brew install fzf

# JSON处理
brew install jq

# HTTP客户端
brew install httpie
```

### 配置文件示例

#### .zshrc 配置

```bash
# AiTer优化配置

# 路径
export PATH="$HOME/.npm-global/bin:$PATH"
export PATH="$HOME/.local/bin:$PATH"

# 别名
alias ll="ls -la"
alias gs="git status"
alias gp="git pull"
alias minto="minto-cli"

# AI工具API密钥(不要提交到Git!)
export OPENAI_API_KEY="your-key-here"
export ANTHROPIC_API_KEY="your-key-here"

# Python虚拟环境自动激活
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

# Node版本管理
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

#### 项目 CLAUDE.md 模板

```markdown
# 项目上下文

## 项目信息
- **项目名称**: [项目名称]
- **客户**: [客户名称]
- **项目类型**: [市场分析/战略规划/其他]
- **时间范围**: [开始日期] - [结束日期]

## 项目目标
[简要描述项目目标]

## 技术栈
- **语言**: Python 3.9
- **数据分析**: Pandas, NumPy
- **可视化**: Matplotlib, Plotly
- **报告**: Markdown, LaTeX

## 目录结构
```
project/
├── data/          # 数据文件
├── analysis/      # 分析脚本
├── reports/       # 报告输出
└── knowledge/     # 知识库
```

## 代码规范
- 遵循PEP 8
- 函数需要docstring
- 变量使用描述性命名
- 所有分析需要注释说明

## AI协作指南
- 在生成代码时,始终包含注释
- 报告使用规范的Markdown格式
- 数据分析需要包含可视化
- 建议需要包含数据支撑

## 参考资料
- [相关文档链接]
- [行业报告链接]
```

---

## 更新日志

### v0.1.0 (2025-12)
- ✨ 首次发布
- ✨ 多项目管理
- ✨ 多终端标签
- ✨ 代码编辑器(Monaco)
- ✨ Markdown编辑预览
- ✨ HTML预览
- ✨ 文件服务器
- ✨ 文件树导航

---

## 支持与反馈

**技术支持**: dev@within-7.com
**公司网站**: [Within-7.com](https://within-7.com)
**开发者**: Lib

**问题反馈**:
1. 发送邮件到 dev@within-7.com
2. 包含以下信息:
   - 操作系统版本
   - AiTer版本
   - 问题描述
   - 复现步骤
   - 截图(如有)

---

**© 2025-2026 Within-7.com - 任小姐出海战略咨询**
**Developed by Lib**
