# Contributing

Contributions are welcome through focused pull requests.

1. Fork the repository and create a descriptive branch.
2. Keep infrastructure, business modules, routes, and UI concerns separated.
3. Add English and Chinese messages together when changing user-facing copy.
4. Run `pnpm verify`, `pnpm cf:build`, `pnpm licenses:check`, and
   `pnpm audit --prod --audit-level high`.
5. Explain behavior changes and verification in the pull request.

Do not commit environment files, credentials, local databases, generated build
output, or private provider fixtures.
