# Getting Started Guide

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher (or pnpm/yarn)
- **Git** for version control

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### 3. Create Your First Component

Use the `/component` command:

```
/component Button
```

This creates:
- `src/components/Button/Button.tsx`
- `src/components/Button/Button.module.css`
- `src/components/Button/Button.test.tsx`
- `src/components/Button/index.ts`

## Project Structure

```
project/
├── src/
│   ├── components/     # UI components
│   ├── hooks/          # Custom hooks
│   ├── utils/          # Helper functions
│   ├── services/       # API calls
│   ├── types/          # TypeScript types
│   └── App.tsx         # Root component
├── public/             # Static assets
├── tests/              # Test configuration
└── package.json
```

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/my-feature
```

### 2. Make Changes

Edit files, create components, etc.

### 3. Test Your Changes

```bash
npm run test
npm run lint
npm run type-check
```

### 4. Commit

```
/commit
```

Or manually:

```bash
git add -A
git commit -m "feat: add my feature"
```

### 5. Push & Create PR

```bash
git push -u origin feature/my-feature
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript check |

## AI CLI Commands

| Command | Description |
|---------|-------------|
| `/component <name>` | Generate component |
| `/commit` | Smart git commit |

## Best Practices

1. **Keep components small** - One component, one responsibility
2. **Use TypeScript** - Type everything for safety
3. **Write tests** - Test critical paths
4. **Follow conventions** - Check CLAUDE.md for guidelines
5. **Commit often** - Small, focused commits
