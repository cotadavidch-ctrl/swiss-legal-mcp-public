# ADR 0027: Analisis procesal determinista

Fecha: 2026-08-03

## Estado

Aceptada.

## Contexto

Fase 8 requiere una herramienta avanzada de estrategia procesal suiza sin IA, sin proveedores nuevos y sin falsear capacidades. El repositorio ya tiene proveedores de fuentes, resolucion de citas, comparacion de documentos y hardening de release.

## Decision

Se implementa `analyze_procedural_strategy` como herramienta MCP en `apps/mcp-server`, con input Zod estricto, salida estructurada y guardrails explicitos.

La herramienta:

- reutiliza documentos y proveedores existentes;
- usa busqueda lexical limitada para jurisprudencia comparable;
- marca incertidumbre cuando faltan fuentes o hechos;
- no calcula plazos sin base legal;
- no activa `get_transitional_provisions`.

## Consecuencias

La herramienta aporta una capa de coordinacion procesal local, pero no crea una fuente de derecho ni una garantia de asesoramiento. La precision depende de los datos aportados y de las fuentes reales disponibles.

La licencia del proyecto se gestiona en `LICENSE`, `NOTICE` y los metadatos de paquete; la herramienta no altera ese gate.
