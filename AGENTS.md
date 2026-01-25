# Agent Notes

Always use `bun` instead of `npm` for all commands.

## Completion Checklist

Before reporting task completion, always run:
1. `bun lint:fix`
2. `bun run build`
3. `bun test`
4. `bun run test:node`

## Git Workflow

- Never commit directly - report completion status and suggest a commit message
- Never add Co-Authored-By or credits to commits
- Never use `git add -A` or `git add .`
- Never push to remote

## Build
```bash
bun build
```

## Testing

```bash
bun test
```

## Linting

```bash
bun run lint
```
```bash
bun run lint:fix
```
```bash
bun run format
```
