# Contributing

## Setup

```bash
git clone https://github.com/silverbucket/secure-store-redis.git
cd secure-store-redis
bun install
```

Requires Bun and a running Redis server.

## Commands

```bash
bun test              # Run tests
bun run test:node     # Run tests with Node.js
bun run lint          # Check formatting and linting
bun run lint:fix      # Fix formatting
bun run build         # Build for production
```

## Code Style

- TypeScript with strict mode
- ESLint with security rules
- Prettier for formatting
- Add tests for new functionality

## Pull Requests

1. Fork and create a feature branch
2. Make changes with tests
3. Run `bun test` and `bun run lint`
4. Submit PR against `master`

### Commit Format

```
type(scope): description

feat(api): add batch operations
fix(connection): handle timeout errors
docs(readme): update examples
```

## Security Issues

Report vulnerabilities privately to the maintainer. Do not open public issues.
