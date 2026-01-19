# Project Context

## Project: {{PROJECT_NAME}}

A web development project created on {{DATE}}.

## Technology Stack

- **Frontend**: React with TypeScript
- **Styling**: CSS Modules / Tailwind CSS
- **State Management**: React Context / Zustand
- **Build Tool**: Vite
- **Testing**: Vitest + Testing Library

## Project Structure

```
src/
├── components/     # Reusable UI components
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
├── services/       # API services
├── types/          # TypeScript type definitions
└── styles/         # Global styles
```

## Conventions

### Naming

- Components: PascalCase (e.g., `UserProfile.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useAuth.ts`)
- Utils: camelCase (e.g., `formatDate.ts`)
- Types: PascalCase (e.g., `User`, `ApiResponse`)

### File Structure

Each component should have:
- `ComponentName.tsx` - Component implementation
- `ComponentName.module.css` - Styles
- `ComponentName.test.tsx` - Tests
- `index.ts` - Exports

### Git Workflow

- Use Conventional Commits
- Keep commits small and focused
- Write meaningful commit messages

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Run linter
- `npm run type-check` - TypeScript type check
