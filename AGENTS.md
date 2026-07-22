# use-acp

React hooks for the [Agent Client Protocol](https://agentclientprotocol.com/) (ACP) over WebSockets. Published to npm as `use-acp`.

## Development

```bash
pnpm install
pnpm test        # vitest
pnpm lint        # biome check --write (autofix.ci runs this on PRs)
pnpm lint:ci     # biome check, no writes
pnpm typecheck   # tsc --noEmit
pnpm build       # tsc -> dist/
```
