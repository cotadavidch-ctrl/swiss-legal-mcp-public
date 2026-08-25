# NPM Audit Runtime Assessment

Assessment date: 2026-08-06

## Scope

Reviewed local private-beta installation:

- Install path: `~/.local/share/swiss-legal-mcp`
- Runtime entrypoint: `/usr/local/bin/node ~/.local/share/swiss-legal-mcp/node_modules/swiss-legal-mcp/dist/stdio.js`
- Source tarball: `/workspace/swiss-legal-mcp/swiss-legal-mcp-1.0.0.tgz`
- Expected SHA-256: `71a2948927546db57d39e61a1e83d7e9f7ab4ec1a667cb0bf9c73c4333a22d1e`
- Actual SHA-256: `71a2948927546db57d39e61a1e83d7e9f7ab4ec1a667cb0bf9c73c4333a22d1e`
- Hash verified: yes

No remediation was applied. `npm audit fix` was not executed.

## Commands Run

The following commands were run in `~/.local/share/swiss-legal-mcp`:

- `npm audit --json`
- `npm ls --all`
- `npm explain @hono/node-server`
- `npm explain @modelcontextprotocol/sdk`
- `npm explain swiss-legal-mcp`
- `npm audit --omit=dev --json`
- `npm audit --production --json`
- `npm explain whatwg-encoding`

The following read-only inspections were also run against the installed runtime:

- static import scan of `node_modules/swiss-legal-mcp/dist/stdio.js`
- targeted search for `@hono/node-server`, `serve-static`, `serveStatic`, `StreamableHTTPServerTransport`, and dynamic imports
- targeted inspection of MCP SDK stdio, client streamable HTTP, and server streamable HTTP modules

## Audit Summary

`npm audit --json` reported:

- total vulnerabilities: 3
- moderate vulnerabilities: 3
- high vulnerabilities: 0
- critical vulnerabilities: 0

`npm audit --omit=dev --json` reported the same 3 moderate vulnerabilities. The local install has no dev dependencies installed, so the vulnerabilities are production-tree findings, not dev-only findings.

`npm audit --production --json` was accepted by npm but printed:

```text
npm warn config production Use `--omit=dev` instead.
```

It reported the same 3 moderate vulnerabilities.

## Vulnerability 1: `@hono/node-server`

- Package: `@hono/node-server`
- Installed version: `1.19.17`
- Severity: moderate
- Advisory: `GHSA-frvp-7c67-39w9`
- Title: `Node.js Adapter for Hono: Path traversal in serve-static on Windows via encoded backslash (%5C)`
- CWE: `CWE-22`
- CVSS: `5.9`, `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N`
- Vulnerable range: `<2.0.5`
- Corrected range inferred from advisory: `>=2.0.5`
- `fixAvailable`: `false`
- Direct dependency: no
- Dependency class in installed lockfile: production dependency tree
- Introduced by: `@modelcontextprotocol/sdk@1.29.0`
- Full dependency path:
  - local install root
  - `swiss-legal-mcp@1.0.0`
  - `@modelcontextprotocol/sdk@1.29.0`
  - `@hono/node-server@1.19.17`

### Runtime Reachability

Classification: `PRESENT_BUT_NOT_REACHABLE`

The vulnerable package is present in `node_modules`, but the vulnerable code path is not reached by the private-beta stdio runtime.

Evidence:

- `dist/stdio.js` imports `@modelcontextprotocol/sdk/server/stdio.js`, not `@modelcontextprotocol/sdk/server/streamableHttp.js`.
- `@modelcontextprotocol/sdk/dist/esm/server/stdio.js` uses stdin/stdout buffering and does not import `@hono/node-server`.
- `dist/stdio.js` imports `@modelcontextprotocol/sdk/client/streamableHttp.js` for outbound MCP client calls to the existing aggregator provider; that client module does not import `@hono/node-server`.
- `@hono/node-server` is imported by `@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js`, the server-side HTTP transport wrapper, but that module is not imported by the installed stdio entrypoint.
- No `serveStatic`, `serve-static`, `getRequestListener`, `StreamableHTTPServerTransport`, or dynamic import of the server streamable HTTP module was found in `dist/stdio.js`.
- The vulnerable function is specifically `@hono/node-server/serve-static`, but the stdio runtime does not serve static files.

### Impact Assessment

- Remote code execution: no evidence of reachability.
- SSRF: not the affected issue; no stdio path to Hono static serving.
- Path traversal: theoretically relevant only to Hono static serving, especially Windows encoded backslash handling; not reachable from this stdio runtime.
- Prototype pollution: not applicable to this advisory.
- ReDoS: not applicable to this advisory.
- XSS: not applicable to this stdio runtime.
- DoS: no direct runtime path found.
- Information disclosure: the advisory impact is possible static-file disclosure if vulnerable static serving is exposed; not exposed by the stdio runtime.
- Legal response integrity: no reachable path found.
- Cache: no reachable path found.
- Local filesystem: no reachable static-file server path found.

### Recommendation

- `PRIVATE_PERSONAL_BETA`: accept temporarily with documented risk.
- `PUBLIC_BETA`: remediation required before enabling or distributing an HTTP server runtime that imports MCP SDK server streamable HTTP or Hono static serving.
- `PUBLIC_STABLE_RELEASE`: remediation required or explicit proof that public runtime excludes this dependency/path.

Do not run `npm audit fix` against the validated tarball install. `fixAvailable: false` means npm does not have a safe automatic fix for the current dependency graph. Remediation would require one of:

- a newer `@modelcontextprotocol/sdk` that no longer depends on vulnerable `@hono/node-server`;
- a controlled transitive override after compatibility testing;
- rebuilding, repacking, rehashing, and rerunning release validation.

## Vulnerability 2: `@modelcontextprotocol/sdk`

- Package: `@modelcontextprotocol/sdk`
- Installed version: `1.29.0`
- Severity: moderate
- Advisory: inherited through `@hono/node-server`
- Vulnerable range reported by npm: `1.25.0 - 1.29.0`
- `fixAvailable`: `false`
- Direct dependency of installed package: yes, direct dependency of `swiss-legal-mcp@1.0.0`
- Dependency class: production dependency
- Introduced by: `swiss-legal-mcp@1.0.0`
- Full dependency path:
  - local install root
  - `swiss-legal-mcp@1.0.0`
  - `@modelcontextprotocol/sdk@1.29.0`

### Runtime Reachability

Classification: `PRESENT_BUT_NOT_REACHABLE`

The SDK itself is reachable and required for stdio MCP operation. However, the vulnerable advisory is inherited through the SDK's dependency on `@hono/node-server`, and the affected server-side Hono static-serving module is not imported or invoked by the stdio entrypoint.

The runtime uses:

- `@modelcontextprotocol/sdk/server/stdio.js`
- `@modelcontextprotocol/sdk/server/mcp.js`
- `@modelcontextprotocol/sdk/client/index.js`
- `@modelcontextprotocol/sdk/client/streamableHttp.js`
- `@modelcontextprotocol/sdk/types.js`

The runtime does not use:

- `@modelcontextprotocol/sdk/server/streamableHttp.js`
- `@hono/node-server/serve-static`

### Impact Assessment

The SDK is essential runtime code, but the reported vulnerability is not in the SDK protocol handling used by stdio. No reachable stdio path to the vulnerable Hono static-file handler was found.

### Recommendation

- `PRIVATE_PERSONAL_BETA`: accept temporarily with documented risk.
- `PUBLIC_BETA`: update SDK or prove public runtime excludes server HTTP transport before broader distribution.
- `PUBLIC_STABLE_RELEASE`: remediate by updating SDK or transitive dependency and regenerate the release artifact.

## Vulnerability 3: `swiss-legal-mcp`

- Package: `swiss-legal-mcp`
- Installed version: `1.0.0`
- Severity: moderate
- Advisory: inherited through `@modelcontextprotocol/sdk`, then `@hono/node-server`
- Direct dependency in local install root: yes
- Dependency class: production dependency
- Full dependency path:
  - local install root
  - `swiss-legal-mcp@1.0.0`

### Runtime Reachability

Classification: `PRESENT_BUT_NOT_REACHABLE`

This is npm's root package roll-up vulnerability entry. It does not identify a vulnerability in Swiss Legal MCP application code. The reachable stdio runtime was inspected and no route to the vulnerable Hono static-serving code was found.

### Impact Assessment

No separate application-level vulnerable code path was identified beyond the inherited dependency advisory.

### Recommendation

- `PRIVATE_PERSONAL_BETA`: accept temporarily with documented risk.
- `PUBLIC_BETA`: remediation required before broader release.
- `PUBLIC_STABLE_RELEASE`: remediation required before declaring dependency security clean.

## Deprecated Package: `whatwg-encoding@3.1.1`

- Package: `whatwg-encoding`
- Installed version: `3.1.1`
- Deprecation message: `Use @exodus/bytes instead for a more spec-conformant and faster implementation`
- Introduced by:
  - `swiss-legal-mcp@1.0.0`
  - `cheerio@1.2.0`
  - `encoding-sniffer@0.2.1`
  - `whatwg-encoding@3.1.1`
- Dependency class: production dependency tree
- Vulnerability reported by npm audit: no

Runtime status: `PRESENT_AND_RUNTIME_LOADABLE_AS_CHEERIO_TRANSITIVE_DEPENDENCY`

`dist/stdio.js` imports `cheerio` and uses `cheerio.load(html)` for HTML parsing. Cheerio's ESM entry imports `encoding-sniffer`, which depends on `whatwg-encoding`. The installed application uses `cheerio.load` rather than Cheerio's `decodeStream`, `loadBuffer`, or `fromURL` helpers. The deprecation therefore indicates maintenance debt, not an immediate vulnerability finding in `npm audit`.

Recommendation:

- No immediate private-beta action required.
- Track future Cheerio or encoding stack updates.
- For public stable release, reassess during dependency refresh, but this deprecation alone does not block local private beta.

## Threat Model

Assessed runtime:

- local process launched over MCP stdio;
- personal private beta use;
- no public HTTP port exposed by the assessed command;
- no package publication;
- inputs come from local MCP clients such as Codex or Claude Code;
- provider access goes outbound to legal data providers;
- cache is local;
- no secrets were found embedded in the previously configured MCP entries.

Under this model, the Hono static-file traversal advisory is not exploitable through the assessed stdio command because the affected HTTP static-serving code is not imported or exposed.

## `npm audit fix` Impact

`npm audit fix` was not executed.

Observed `fixAvailable: false` for all three audit entries. A real remediation would require dependency changes and would likely:

- alter the installation lockfile;
- require updating a direct dependency or introducing a tested transitive override;
- require rebuilding the package;
- require regenerating the tarball;
- invalidate the current SHA-256 validation;
- require rerunning release validation.

## Release-Mode Conclusions

- `PRIVATE_PERSONAL_BETA`: `PASS_WITH_ACCEPTED_RISK`
- `PUBLIC_BETA`: `PASS_WITH_REMEDIATION_REQUIRED`
- `PUBLIC_STABLE_RELEASE`: `REMEDIATION_REQUIRED`

No vulnerability was classified as `EXPLOITABLE_IN_RUNTIME` for the assessed stdio command. The moderate advisory should still be remediated before broader public release or any HTTP runtime exposure.
