# Secure Updater Architecture

The updater is separate from the MCP server. Legal tool calls never install updates.

Components:

- `update check`: validates a signed manifest and policy.
- `update download`: downloads one allowlisted artifact.
- `update verify`: checks size, SHA-256 and Ed25519 signature.
- `update install`: requires `--confirm`, stages files, backs up the current install and swaps atomically.
- `update rollback`: requires `--confirm` and restores the last backup.
- `update status`: reads local update state.

No remote scripts, shell commands, `eval`, arbitrary URLs or automatic installs are supported.
