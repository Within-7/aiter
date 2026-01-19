# Skill: /commit

## Trigger

```
/commit [message]
```

## Description

Create a git commit with a conventional commit message. Analyzes staged changes and generates an appropriate commit message if not provided.

## Arguments

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `message` | string | No | Custom commit message (if not provided, will be auto-generated) |

## Examples

```bash
# Auto-generate commit message
/commit

# With custom message
/commit "feat: add user authentication"

# With scope
/commit "fix(auth): resolve token expiration issue"
```

## Workflow

1. **Check Git Status**
   ```bash
   git status --porcelain
   ```
   - Identify staged and unstaged changes
   - Warn if nothing staged

2. **Analyze Changes**
   ```bash
   git diff --cached --stat
   git diff --cached
   ```
   - Determine change type (feat, fix, refactor, etc.)
   - Identify affected scope/area
   - Count files and lines changed

3. **Generate Commit Message** (if not provided)
   - Follow Conventional Commits format
   - Include scope when applicable
   - Keep subject under 72 characters

4. **Execute Commit**
   ```bash
   git commit -m "$(cat <<'EOF'
   type(scope): description

   - Detail 1
   - Detail 2

   🤖 Generated with AI CLI
   EOF
   )"
   ```

5. **Output Summary**
   - Show commit hash
   - Display commit message
   - List changed files

## Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | feat: add user login |
| `fix` | Bug fix | fix: resolve crash on startup |
| `refactor` | Code refactoring | refactor: simplify auth logic |
| `docs` | Documentation | docs: update README |
| `style` | Code style | style: fix indentation |
| `test` | Tests | test: add unit tests for utils |
| `chore` | Maintenance | chore: update dependencies |
| `perf` | Performance | perf: optimize image loading |

## Commit Message Format

```
type(scope): short description

- Detailed change 1
- Detailed change 2

🤖 Generated with AI CLI
```

### Rules

1. **Subject line**
   - Use imperative mood ("add" not "added")
   - Don't capitalize first letter
   - No period at the end
   - Max 72 characters

2. **Body** (optional)
   - Explain what and why, not how
   - Wrap at 72 characters
   - Use bullet points for multiple changes

3. **Scope** (optional)
   - Component or area affected
   - Examples: auth, api, ui, db

## Success Output

```
✅ Commit created

Commit: abc1234
Message: feat(auth): add user login functionality

Files changed:
  M src/components/Login.tsx
  A src/hooks/useAuth.ts
  M src/services/api.ts

Stats: 3 files changed, 142 insertions(+), 12 deletions(-)
```

## Error Handling

### No staged changes
```
⚠️ No staged changes found.

Stage your changes first:
  git add <files>
  git add -A

Then run /commit again.
```

### Working directory not clean
```
⚠️ You have unstaged changes that won't be committed:
  - src/utils/helpers.ts (modified)

Would you like to:
1. Stage all changes: git add -A
2. Continue with current staged changes
3. Cancel
```
