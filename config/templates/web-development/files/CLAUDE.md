# CLAUDE.md

This file provides guidance to Claude Code CLI and Minto CLI when working in this project.

## Project Overview

**{{PROJECT_NAME}}** - Web Development Project

A modern web development project with AI-assisted coding capabilities.

## Core Rules

### Rule 1: Code Quality Standards

All code must follow these standards:

1. **TypeScript**: Use strict type checking
2. **ESLint**: Fix all linting errors before committing
3. **Components**: Follow atomic design principles
4. **Testing**: Write tests for all business logic

### Rule 2: Git Workflow

**Every task must end with a git commit.**

1. Stage all changes: `git add -A`
2. Create descriptive commit message using Conventional Commits format
3. Commit types: `feat`, `fix`, `refactor`, `docs`, `style`, `test`, `chore`

## Project Structure

```
{{PROJECT_NAME}}/
├── CLAUDE.md              # AI CLI configuration (this file)
├── README.md              # Project documentation
├── package.json           # Dependencies
├── src/                   # Source code
│   ├── components/        # React/Vue components
│   ├── hooks/             # Custom hooks
│   ├── utils/             # Utility functions
│   ├── services/          # API services
│   └── types/             # TypeScript types
├── tests/                 # Test files
├── public/                # Static assets
└── .claude/               # AI CLI plugins
    ├── agents/            # Custom agents
    ├── skills/            # Custom skills
    └── prompts/           # Custom prompts
```

## Available Commands

### Slash Commands

| Command | Description |
|---------|-------------|
| `/component <name>` | Create a new component |
| `/commit [message]` | Smart git commit |

### Agents

| Agent | Description |
|-------|-------------|
| `frontend-developer` | Expert in React/Vue components |
| `code-reviewer` | Reviews code quality and security |

## Code Style

### Component Template

```tsx
import React from 'react'

interface {{ComponentName}}Props {
  // Props definition
}

export const {{ComponentName}}: React.FC<{{ComponentName}}Props> = (props) => {
  return (
    <div>
      {/* Component content */}
    </div>
  )
}
```

### Best Practices

1. **Small components**: Each component should do one thing well
2. **Props validation**: Always define TypeScript interfaces for props
3. **Custom hooks**: Extract reusable logic into custom hooks
4. **Error boundaries**: Wrap components with error boundaries
5. **Accessibility**: Follow WCAG guidelines

## Testing

Run tests with:
```bash
npm test
```

Write tests for:
- Component rendering
- User interactions
- Business logic
- API integrations

## Environment Variables

```env
# API Configuration
VITE_API_URL=http://localhost:3000

# Feature Flags
VITE_ENABLE_ANALYTICS=false
```

## Tools Integration

This project includes AI CLI plugins for:

- **Component Generation**: Quickly scaffold new components
- **Code Review**: Automated code quality checks
- **Smart Commits**: Conventional commit message generation

---

*This project was created with AiTer - AI CLI Collaboration Platform*
