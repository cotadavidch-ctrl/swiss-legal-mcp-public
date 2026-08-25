# Contrato técnico — SHAB / Amtsblattportal (FOSC/FUSC)

Verificado en vivo el 2026-07-27 contra `https://www.shab.ch` y `https://www.amtsblattportal.ch`. Capturas en [`tests/fixtures/shab/`](../../tests/fixtures/shab/) con su README (datos personales redactados).

## Veredicto operativo

**`ShabProvider` no realiza ninguna petición de red real.** Ambos dominios reales declaran `robots.txt: Disallow: /` para todo user-agent (bloqueo total, verificado en los dos dominios de forma independiente). La API real que alimenta el frontend Angular de SHAB no tiene documentación pública (Swagger/OpenAPI) ni términos de uso explícitos para reutilización por terceros. Se trata como bloqueado con la misma seriedad que un proveedor sin credenciales — ver ADR correspondiente.

## Endpoint y estructura real (observados, no utilizados en producción)

- Frontend: SPA Angular con rutas hash (`#!/gazette`, `#!/search/publications`, `#!/search/archive`) — el contenido real se sirve por una API JSON interna, no HTML server-renderizado.
- API real confirmada por inspección de red: `GET https://www.shab.ch/api/v1/publications?rubrics={códigos}&publicationStates=PUBLISHED,CANCELLED&pageRequest.page=N&pageRequest.size=N&includeContent=true|false`. Sin autenticación, HTTP 200 directo.
- Endpoints auxiliares reales: `/api/v1/rubrics` (categorías, con sub-rúbricas por tenant), `/api/v1/tenants` (lista de "mandantes": SHAB federal + Amtsblätter cantonales), `/api/v1/municipalities`, `/api/v1/configurations`.
- Búsqueda de archivo histórico (1999 – 02.09.2018) señalizada como ruta separada (`Archiv durchsuchen` / `#!/search/archive`) — no se llegó a inspeccionar su endpoint real por network dado el bloqueo de robots.txt.
- Sin Swagger/OpenAPI público: `/swagger-ui/index.html`, `/api/v1/api-docs`, `/v3/api-docs`, `/api/v1/openapi.json` devuelven 404 en `shab.ch`.
- `robots.txt` real de **ambos** dominios (`shab.ch` y `amtsblattportal.ch`): `User-agent: * / Disallow: /`.

## Estructura de datos real (confirmada por API, no inventada)

Cada publicación (`meta` + `content` + `attachments` + `links`):

- `meta.id` (UUID), `meta.publicationNumber` (p. ej. `"HR02-1006716804"`, `"KK04-0000059057"`), `meta.rubric`/`meta.subRubric` (p. ej. `HR`/`HR02`, `KK`/`KK04`), `meta.language`, `meta.publicationState` (`PUBLISHED`/`CANCELLED`), `meta.publicationDate`, `meta.expirationDate`, `meta.cantons` (array), `meta.registrationOffice` (autoridad emisora con dirección completa), `meta.legalRemedy` (texto libre con base legal citada, p. ej. "Publikation nach HRegV Art. 9 und Art. 35"), `meta.title` en **4 idiomas simultáneos** (`de`/`en`/`it`/`fr`) para la misma publicación (no una URL por idioma como SECO/BSV).
- `content` (solo con `includeContent=true`): estructura variable por rúbrica. Verificado real para `KK04` (quiebra/sucesión): incluye `debtor.person` con **nombre, fecha de nacimiento, fecha de defunción y domicilio real de una persona física** — dato personal sensible verificado, no hipotético.
- Rúbricas reales observadas en el filtro por defecto de la página de inicio: `AB, AW, AZ, BB, BH, EK, ES, FM, HR, KK, LS, NA, SB, SR, UP, UV`. Solo `HR` (Handelsregister) se confirmó cubierta por Zefix según fuentes externas.
- `total` en la respuesta paginada: solo para la rúbrica `KK` se observó `total: 213826` publicaciones históricas — volumen real considerable.

## Multi-tenencia real

La misma plataforma aloja, como "tenants" (`GET /api/v1/tenants`, 29 reales observados): el SHAB federal (`code: "shab"`, alias de dominio `fosc.ch`/`fusc.ch` para francés/italiano — **no sistemas separados**) y múltiples Amtsblätter/FAO cantonales (`kabzh` Zúrich, `kabge` Ginebra, `kabtg` Turgovia, `kabzg` Zug, etc.) — cada canton con su propia gaceta oficial en la misma infraestructura técnica, pero como fuente jurídicamente distinta (no forma parte del alcance de `ShabProvider`).

## Formatos

Confirmado JSON estructurado real. No se confirmó descarga de PDF individual por publicación en esta auditoría (bloqueada por el mismo robots.txt antes de explorar `attachments`); las respuestas capturadas muestran `"attachments": []` en los ejemplos obtenidos.

## Licencia y términos de uso

- Base legal citada en el propio tenant: "Verordnung über das Schweizerische Handelsamtsblatt vom 15. Februar 2006" (ordenanza federal que rige SHAB).
- El AGB (Allgemeine Geschäftsbedingungen) del Amtsblattportal se referencia pero no se localizó su texto completo navegable en esta auditoría; rige el USO del portal (principalmente para publicantes), no se encontró una sección específica de reutilización de datos para terceros.
- `robots.txt: Disallow: /` en ambos dominios es la señal más fuerte y no ambigua encontrada: se interpreta como "no reutilizable por agentes automatizados sin autorización explícita".

## Relación con Zefix

Confirmado por fuente externa (opendata.swiss): "Über Zefix sind die Daten von sämtlichen im Handelsregister eingetragenen Rechtseinheiten sowie die täglichen Handelsregisterpublikationen im Schweizerischen Handelsamtsblatt (SHAB) abrufbar" — Zefix es el canal oficial designado para las publicaciones SHAB de rúbrica `HR` ligadas a una entidad inscrita. **Ninguna otra rúbrica de SHAB (bloqueos judiciales, quiebras, sucesiones, convocatorias, etc.) tiene una vía de acceso alternativa confirmada** — no asumir que Zefix cubre SHAB en su totalidad.

## Riesgos de privacidad verificados

La rúbrica `KK` (quiebras/sucesiones) expone datos personales reales completos de individuos (nombre, fecha de nacimiento, fecha de defunción, domicilio) dentro de `content.debtor.person`. Cualquier implementación futura debe: nunca indexar en bloque, nunca cruzar con otras fuentes para construir perfiles, y limitar la recuperación a consultas puntuales explícitamente solicitadas por el usuario.

## Nivel de confianza

Alto para la existencia y forma real de la API (verificada por inspección de red directa, múltiples rúbricas). Alto para el bloqueo de `robots.txt` (verificado en los dos dominios). Medio/bajo para la cobertura de PDF/archivo histórico (no explorados en profundidad tras confirmar el bloqueo).
