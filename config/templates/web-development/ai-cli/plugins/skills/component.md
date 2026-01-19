# Skill: /component

## Trigger

```
/component <name> [options]
```

## Description

Generate a new React component with TypeScript types, styles, and optional test file.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Component name (PascalCase) |
| `--dir` | string | No | Target directory (default: src/components) |
| `--style` | string | No | Style type: css, scss, tailwind, styled (default: css) |
| `--test` | boolean | No | Generate test file (default: true) |

## Examples

```bash
# Basic component
/component Button

# With options
/component UserProfile --dir=src/features/user --style=tailwind --test

# Without test
/component Icon --test=false
```

## Workflow

1. **Parse Arguments**
   - Extract component name
   - Parse options

2. **Validate**
   - Check if component already exists
   - Verify target directory exists

3. **Generate Files**
   - Create component file
   - Create styles file (if applicable)
   - Create test file (if --test)
   - Create index.ts for exports

4. **Output**
   - List created files
   - Show usage example

## Output Template

### Component File: `{Name}.tsx`

```tsx
import React from 'react'
import styles from './{Name}.module.css'

export interface {Name}Props {
  /** Add prop descriptions */
  className?: string
}

/**
 * {Name} component
 *
 * @example
 * <{Name} />
 */
export const {Name}: React.FC<{Name}Props> = ({
  className = ''
}) => {
  return (
    <div className={`${styles.container} ${className}`}>
      {/* Component content */}
    </div>
  )
}

{Name}.displayName = '{Name}'
```

### Styles File: `{Name}.module.css`

```css
.container {
  /* Base styles */
}
```

### Test File: `{Name}.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { {Name} } from './{Name}'

describe('{Name}', () => {
  it('renders without crashing', () => {
    render(<{Name} />)
    // Add assertions
  })
})
```

### Index File: `index.ts`

```typescript
export { {Name} } from './{Name}'
export type { {Name}Props } from './{Name}'
```

## Success Message

```
✅ Component created: {Name}

Files created:
  - src/components/{Name}/{Name}.tsx
  - src/components/{Name}/{Name}.module.css
  - src/components/{Name}/{Name}.test.tsx
  - src/components/{Name}/index.ts

Usage:
  import { {Name} } from '@/components/{Name}'

  <{Name} />
```
