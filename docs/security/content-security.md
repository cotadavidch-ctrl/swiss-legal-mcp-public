# Content Security

Phase 7 status: hardened locally for implemented content paths, with offline tests for PDF and RDF guards.

## JSON

- MCP tool inputs use Zod schemas.
- Provider remote models use Zod where structured remote payloads exist.
- JSON is never used to execute code.
- Secret scanning skips generated lock/JSON artifacts to avoid false positives, but source and docs are scanned.

Known limitation: there is no single central JSON depth sanitizer for every possible future parser. Existing provider JSON contracts remain schema-validated.

## XML

- Fedlex Akoma Ntoso parsing rejects `DOCTYPE`.
- Entity processing is disabled in the parser configuration.
- XML is validated for well-formedness before mapping.
- XML size is bounded.
- Malicious DTD/entity fixtures are covered by tests.

Known limitation: node-depth/node-count budgets are parser-specific; the current Fedlex XML path is limited by size and schema-shaped extraction rather than a generic XML tree budget.

## HTML

- The shared HTML parser uses Cheerio, not a browser.
- `script` and `style` nodes are removed before text extraction.
- No JavaScript is executed.
- No subresources are loaded.
- Network response size is enforced by `SecureHttpClient` before HTML parsing.

## PDF

`inspectPdfSecurity` performs passive byte inspection before extraction:

- MIME is checked by the HTTP caller.
- `%PDF-` magic bytes are required.
- Maximum size, object count and stream count are supported.
- Original SHA-256 hash is returned.
- Encrypted PDFs are rejected before text extraction.
- Malformed PDFs are rejected before text extraction.
- JavaScript, OpenAction, Additional Actions, Launch actions, embedded files, forms, XFA and URI actions are detected without execution.
- Incremental updates and trailing data produce warnings.
- Extraction is passive through `pdf-parse`.
- No OCR is attempted.
- Actions, attachments, links and binaries are never opened or executed.

Structured PDF statuses:

- `safe`
- `safe_with_warnings`
- `active_content_detected`
- `encrypted`
- `malformed`
- `too_large`
- `unsupported`
- `extraction_failed`

PDFs with active content are not automatically treated as unusable if passive text extraction can proceed safely, but the security status and warnings are preserved in the extraction result.

## RDF

`inspectRdfSecurity` provides offline guards for RDF/XML, Turtle, N-Triples and JSON-LD inputs:

- Maximum byte size.
- Estimated triple limit.
- Blank node limit.
- Depth limit.
- Oversized literal detection.
- RDF/XML DTD/entity blocking.
- `owl:imports` detection.
- Remote JSON-LD context blocking.
- Remote URL/reference warnings.
- No imports, contexts or remote resources are downloaded.
- No transformations are executed.

The current Fedlex production path uses SPARQL JSON, not arbitrary RDF graph parsing. RDF hardening is therefore implemented as a reusable content guard, not as a new provider capability.

Release gate impact:

PDF and RDF hardening are no longer technical blockers.
