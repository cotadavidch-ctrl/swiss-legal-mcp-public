# Swiss Legal MCP Server

Servidor MCP modular para fuentes jurídicas suizas verificadas. El proyecto está preparado para uso local interno; no se publica externamente desde este repositorio.

## Estado

- Versión actual: `1.0.0`.
- Fase 6: completada.
- Fase 7: técnicamente completada en hardening local.
- Fase 8: capa inicial de análisis procesal avanzado implementada con `analyze_procedural_strategy`.
- Fase 9: evaluación jurídica determinista local implementada para `analyze_procedural_strategy`.
- Fase 10: PARCIAL AVANZADA; paquete de revisión humana preparado y live evaluation controlada ejecutada, con revisión humana cualificada y calibración todavía pendientes.
- Fase 11: redacción, revisión y refutación jurídica suiza implementada con ocho herramientas MCP determinísticas; ver `docs/legal-drafting.md`.
- Fase 12: análisis jurídico contradictorio multirrol implementado con `analyze_swiss_legal_positions` y `validate_multirole_legal_analysis`; ver `docs/multirole-legal-analysis.md`.
- Resolvedor oficial de jurisprudencia suiza implementado con `resolve_official_swiss_case`, `fetch_official_swiss_case_full_text`, `verify_swiss_case_identity`, `compare_swiss_case_sources` y `validate_swiss_case_ground_coverage`; ver `docs/official-swiss-case-resolver.md`.
- Jurisprudencia: snippets/headnotes/resultados de búsqueda son solo candidatos; una sentencia parcial no puede usarse como precedente decisivo ni incorporarse silenciosamente a un escrito. Ver `docs/case-full-text-policy.md`.
- Licencia: Apache-2.0.
- Release 1.0: preparada localmente; no publicada externamente.

## Validación Local

```sh
pnpm format:check
pnpm lint
pnpm typecheck
NODE_ENV=test pnpm test
pnpm build
pnpm test:coverage
pnpm test:security
pnpm test:updater
pnpm test:breach-detection
pnpm test:claude-desktop
pnpm test:integration
pnpm benchmark
pnpm eval:procedural-strategy
pnpm review:procedural-strategy --prepare
pnpm release:prepare
pnpm release:check
```

Notas:

- `pnpm sbom` es un comando incorporado de pnpm 11 y requiere `--sbom-format`; el script local debe ejecutarse como `pnpm run sbom`.
- `pnpm ci` también es un comando incorporado de pnpm; el CI local del proyecto se ejecuta con `pnpm run ci`.
- Las pruebas HTTP/shutdown necesitan poder abrir puertos locales.
- La evaluación de estrategia procesal usa un corpus local anonimizado y no equivale a validación profesional humana.
- `pnpm test:claude-desktop` arranca el artefacto compilado real con `/usr/local/bin/node` y `NODE_ENV=production`; no usa `tsx`, fixtures ni token HTTP.
- `pnpm test:updater` valida manifiestos firmados, hash, descarga local controlada, instalación fixture atómica y rollback.
- `pnpm test:breach-detection` valida cifrado AEAD, derivación scrypt, rotación y eventos locales redactados.
- Las revisiones humanas reales se importan con `pnpm review:procedural-strategy --import <path>`;
  el proyecto no contiene revisiones simuladas.
- La live evaluation se ejecuta solo con `RUN_LIVE_PROCEDURAL_STRATEGY_EVAL=true` y usa consultas
  jurídicas abstractas anonimizadas.

## Licencia

Swiss Legal MCP Server se distribuye bajo Apache License 2.0 (`Apache-2.0`). El uso, modificación y distribución están sujetos a `LICENSE`. Los avisos de terceros están en `THIRD_PARTY_NOTICES.md`.

La licencia y esta documentación no constituyen asesoramiento jurídico.

## Release Gate

No se han publicado paquetes, imágenes Docker, tags ni releases.
