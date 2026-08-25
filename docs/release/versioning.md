# Versioning And Deprecation

This project follows SemVer from Release 1.0.0 onward.

- Patch: backwards-compatible bug fixes and hardening.
- Minor: backwards-compatible tools, provider capabilities or optional fields.
- Major: breaking changes to package exports, MCP tool schemas, CLI output, provider contracts, cache formats or documented data models.
- Alpha: incomplete feature slices.
- Beta: feature-complete but still under validation.
- RC: release candidate with no known critical blockers.

Deprecation policy:

- Keep aliases or old fields through at least one minor release when feasible.
- Document replacement paths in `CHANGELOG.md` and affected docs.
- Remove deprecated public surfaces only in a major release.
- Never silently change MCP schemas or CLI JSON shapes.
