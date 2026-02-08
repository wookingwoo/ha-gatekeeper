# Contributing to ha-gatekeeper

Thanks for your interest in contributing. This project welcomes bug reports, feature requests, documentation improvements, and code contributions.

## Code of Conduct

By participating, you agree to follow `CODE_OF_CONDUCT.md`.

## How to Contribute

1. Search existing issues to avoid duplicates.
1. For bugs, include clear reproduction steps, expected behavior, and logs if relevant.
1. For feature requests, describe the use case and any constraints.
1. For code changes, open a pull request with a focused scope.

## Development Setup

1. Fork the repository and clone your fork.
1. Install dependencies.

```bash
npm install
```

1. Create `packages/server/.env` (see `README.md` for required variables).
1. Initialize the database.

```bash
npm run prisma:generate
npm run prisma:migrate
```

1. Start the dev servers.

```bash
npm run dev
```

## Useful Scripts

- `npm run dev` starts the API server and admin UI.
- `npm run build` builds the web app and server.
- `npm run prisma:generate` generates Prisma client code.
- `npm run prisma:migrate` runs local dev migrations.

## Pull Request Guidelines

1. Keep PRs small and focused on a single change.
1. Update documentation for user-facing changes.
1. Include screenshots or recordings for UI changes.
1. Make sure `npm run build` completes successfully.
1. If you add new endpoints or behavior, update `README.md` or add relevant docs.

## Testing

There are no automated tests yet. If you add tests, include clear instructions to run them.

## Security Issues

Please do not open public issues for security vulnerabilities. Follow `SECURITY.md` for reporting.
