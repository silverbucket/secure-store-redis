# Contributing to secure-store-redis

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20 or higher
- Redis server running locally
- Bun package manager (recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/silverbucket/secure-store-redis.git
cd secure-store-redis

# Install dependencies
bun install

# Start Redis (if not already running)
redis-server
```

## Development Workflow

### Running Tests

```bash
# Run all tests
bun test

# Run tests with Node.js (alternative)
bun run test:node
```

### Code Quality

```bash
# Check code formatting and linting
bun run lint

# Fix formatting issues
bun run lint:fix
```

### Building

```bash
# Build for production
bun run build

# Build JavaScript only
bun run build:js

# Build TypeScript types only
bun run build:types
```

## Code Style

This project uses:

- **TypeScript** with strict mode enabled
- **ESLint** with security-focused rules
- **Prettier** for code formatting
- **Bun** as the primary package manager

### Guidelines

- Use TypeScript for all new code
- Follow existing code patterns and naming conventions
- Add JSDoc comments for public methods
- Write tests for new functionality
- Ensure all tests pass before submitting PR

## Pull Request Process

### Before Submitting

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and add tests
4. Run the test suite: `bun test`
5. Check code quality: `bun run lint`
6. Commit your changes with descriptive messages

### Commit Message Format

```
type(scope): description

Examples:
feat(api): add batch operations support
fix(connection): improve error handling
docs(readme): update installation instructions
```

### Submitting PR

1. Push to your fork: `git push origin feature-name`
2. Open a pull request against the `master` branch
3. Fill out the PR template completely
4. Wait for code review and CI checks

## Release Process

Releases are automated via GitHub Actions:

1. Create a new release on GitHub
2. CI runs tests and builds the package
3. Package is automatically published to npm
4. Version is updated in package.json

## Testing

### Test Structure

- Unit tests in `src/index.test.ts`
- Integration tests with Redis
- Cross-runtime testing (Bun + Node.js)

### Running Specific Tests

```bash
# Run tests matching a pattern
bun test --grep "connection"

# Run tests in watch mode
bun test --watch
```

## Getting Help

- Check existing issues for similar problems
- Read the API documentation in README.md
- Ask questions in GitHub Discussions
- Review test files for usage examples

## Security

If you find a security vulnerability:

1. Do not open a public issue
2. Send details to the maintainer privately
3. Follow responsible disclosure practices

Thanks for contributing! 🚀
