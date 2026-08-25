# ADR 0022 — Legislación cantonal: muestra representativa por familia técnica, adaptadores reutilizables

## Estado

Aceptado e implementado (Fase 5, 2026-07-27).

## Contexto

Auditar en vivo, documentar el contrato observado, implementar, normalizar y probar los 26 cantones suizos con el mismo estándar exigido en Fases 2-4 es un trabajo de una magnitud comparable a varias fases completas — mayor que cualquier fase anterior. Se consultó explícitamente con el usuario antes de empezar cómo abordar esto, con dos opciones: auditar los 26 cantones en vivo ahora, o auditar una muestra representativa por familia técnica e implementar adaptadores reutilizables sobre esa muestra, documentando el resto como inventario. Se eligió la segunda opción.

## Decisión

1. Se auditaron en vivo 5 cantones como muestra: Berna (LexWork), Zúrich (ZH-Lex, sistema propio), Ticino (Raccolta Leggi), Vaud (BLV) y Ginebra (SIL) — cubriendo las familias identificadas en la auditoría de Fase 0 ("LexWork ~23 cantones" + 3 outliers con sistema propio).
2. Se implementaron adaptadores **solo** para las dos familias donde la auditoría confirmó acceso real y estable:
   - `CantonalLexWorkProvider` (parametrizado por `cantonCode`/`baseUrl`, ver `packages/providers/cantonal/src/cantonalLexWorkProvider.ts`): reutilizable para cualquier cantón LexWork, pero **solo Berna está verificada en vivo** — activar otro cantón LexWork requiere su propia verificación antes de registrarlo, nunca por analogía sin comprobar (mismo principio que "no infieras sin verificar" aplicado a nivel de infraestructura, no solo de datos).
   - `CantonalZhProvider` (`packages/providers/cantonal/src/cantonalZhProvider.ts`): específico de Zúrich, dado que su esquema de URL (número sistemático + fechas de vigencia codificadas literalmente) es propio de ese sistema, no reutilizable directamente para otro cantón.
3. Ticino, Vaud y Ginebra se documentan (`docs/providers/cantonal-legislation.md`, `tests/fixtures/cantonal/README.md`) pero **no se implementan**, cada uno con un motivo real y distinto: Ticino devolvió HTTP 403 a peticiones automatizadas (curl con UA realista y navegación real por navegador, sin intentar eludir la protección); Vaud devolvió "Accès non autorisé" de forma consistente incluso para su propio `robots.txt`; Ginebra usa una interfaz legada basada en frames/JavaScript que requeriría exploración adicional sustancial.
4. El resto de los 26 cantones (24 restantes, asumidos como LexWork por Fase 0 pero no verificados individualmente) se deja explícitamente como inventario pendiente en `docs/providers/cantonal-legislation.md`, con una tabla que distingue claramente "verificado en vivo" de "asumido por Fase 0, no confirmado".

## Consecuencias

- Berna y Zúrich tienen cobertura real y probada (incluidas 4 pruebas de integración real, `RUN_LIVE_CANTONAL_TESTS=true`, ejecutadas y pasando durante esta fase).
- Activar un tercer cantón LexWork (de los ~22 restantes asumidos) es, en principio, tan simple como añadir una nueva entrada de configuración a `CantonalLexWorkProvider` — pero solo después de auditarlo en vivo, no antes.
- Un futuro cantón con sistema propio (como Zúrich) requerirá su propio adaptador dedicado, siguiendo el patrón de `CantonalZhProvider` como referencia, no una generalización forzada.
- La cobertura de legislación cantonal queda honestamente parcial (2 de 26 cantones) — documentado sin ambigüedad en `IMPLEMENTATION_STATUS.md` y en la propuesta de fase siguiente, no presentado como "legislación cantonal completa".
