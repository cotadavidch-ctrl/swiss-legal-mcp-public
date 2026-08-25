# Contrato técnico — BSV/OFAS (sozialversicherungen.admin.ch)

Verificado en vivo el 2026-07-26. Capturas en [`tests/fixtures/bsv/`](../../tests/fixtures/bsv/) con su README.

## Endpoint y estructura real

- `www.bsv.admin.ch` (sitio institucional) declara explícitamente en `/de/vollzug` que Weisungen/Rundschreiben/Mitteilungen viven en "einer eigenen Website" (una web propia), enlazada a `https://sozialversicherungen.admin.ch/de/`.
- El portal real es DotNetNuke (DNN) con el módulo "2sxc" — CMS distinto y más antiguo que el Nuxt de SECO.
- `robots.txt` real permite crawling salvo `/Login/`, `*login*`, `/Documentation/`, `/Install/`, `/Activity-Feed/userId/` — ninguna ruta relevante para documentos públicos está bloqueada.
- Estructura de navegación confirmada por rama de seguro social: AHV, IV, EL, ÜL, BV (2ª pilar/BVG-LPP), KV (KVG/LAMal), UV (UVG), EO (APG), FamZ, International. Cada rama tiene subcategorías propias (Kreisschreiben, Kreisschreiben (Archiv), Rundschreiben, Rundschreiben (Archiv), Mitteilungen, Weisungen, Informationsschreiben, Nachträge zu Weisungen, Verträge, Formulare). **Solo se auditó en profundidad la rama IV** (Individuelle Leistungen); se asume el mismo mecanismo de URL en el resto por ser la misma plataforma, pero no se verificó rama por rama.

## URLs reales confirmadas

- Listado de carpeta: `https://sozialversicherungen.admin.ch/de/f/{folderId}` (verificado: `f/5661` = Kreisschreiben de IV). Tabla HTML real con columnas Titel/Geändert/Version/Sprachen, 19 documentos en esta carpeta.
- Detalle/historial de versiones de un documento: `https://sozialversicherungen.admin.ch/de/d/{docId}` (verificado: `d/18452` = KSIR, con **6 versiones históricas reales**, cada una con fecha "Geändert", número de versión, "Dokumentennummer" y tamaño).
- Descarga: `https://sozialversicherungen.admin.ch/de/d/{docId}/download` (última versión) o `.../download?version=N` (versión histórica específica, confirmado funcional para N=5 en el mismo documento).
- Multilingüe real por parámetro de query (`?lang=fr`, `?lang=it`) sobre el mismo `documentId`.

## Formatos y contenido

- **Solo PDF**, verificado real y textual: `ksir_de_v6_current.pdf`, 136 páginas, ~2MB, descargado sin autenticación.
- Portada con dos fechas reales distintas: "Gültig ab 1. Januar 2022" (entrada en vigor) y "Stand 1. Januar 2026" (última actualización) — ambas deben mapearse a campos separados (`effectiveDate` vs. fecha de versión), nunca fusionarse.
- **Discrepancia real de numeración observada y documentada, no reconciliada**: el pie de página del PDF dice "318.507.13 d KSIR"; la página de versiones muestra "Dokumentennummer" 318.507.31. `BsvProvider` usa el "Dokumentennummer" de la página de versiones como `referenceNumber` canónico (es el campo estructurado del portal) y preserva el valor del PDF solo en `rawMetadata`.
- Cabeceras de descarga reales: `Content-Type: application/pdf`, `Content-Disposition: inline; filename*=utf-8''KSIR%206.pdf` (el nombre incluye el número de versión), cookies de sesión DNN/GA anónimas — el proveedor debe descartar cookies entre peticiones, no persistir estado.

## Cobertura histórica

**Real y descargable por versión** — a diferencia de SECO. `ProviderCapabilities.getHistoricalVersion: true` para BSV, con soporte honesto solo hasta donde el portal expone `?version=N` (verificado hasta 6 versiones en el caso auditado). "Kreisschreiben (Archiv)" es una categoría de navegación separada (posible carpeta adicional para documentos completamente retirados de la lista vigente) — no explorada en detalle, documentada como límite conocido.

## Relaciones de sustitución

Declaradas únicamente en prosa libre dentro del propio PDF (el prefacio del KSIR real declara sustituir partes del KSIH, un documento distinto con nombre diferente). **No se implementa extracción automática de esta relación** — requeriría NLP sobre texto libre, poco fiable y explícitamente prohibido por la regla "no infieras sustitución por títulos parecidos". `supersedesDocuments`/`supersededByDocument` quedan ausentes salvo que el portal exponga en el futuro un campo verdaderamente estructurado para ello.

## Errores y límites observados

- Sin API JSON pública — todo el contenido se obtiene parseando HTML real servido por DNN/2sxc.
- Sin rate limit explícito observado en cabeceras.
- Solo una rama (IV) fue auditada en profundidad; el resto se asume estructuralmente idéntica pero no verificada.

## Licencia

No se confirmó texto de licencia explícito. Documentos de una autoridad federal suiza: obra oficial de dominio público (Art. 5 LDA/URG), consistente con el resto de fuentes auditadas.

## Nivel de confianza

Alto para la mecánica de listado/versión/descarga en la rama IV (verificada con peticiones HTTP reales). Medio para la generalización de la misma estructura de URL al resto de ramas (AHV, EL, BV, KV, UV, EO, FamZ, International) — no verificadas una por una en esta fase.
