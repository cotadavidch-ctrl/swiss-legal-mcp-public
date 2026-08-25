# Input schema

`analyze_procedural_strategy` acepta un objeto Zod estricto con estos bloques:

- `jurisdiction`: `country: "CH"`, canton opcional, municipio opcional.
- `matter`: area cerrada (`civil`, `criminal`, `administrative`, `social-insurance`, `tax`, `employment`, `tenancy`, `debt-enforcement`, `constitutional`, `other`), subarea y descripcion.
- `parties`: partes pseudonimizadas con rol, tipo y descripcion.
- `facts`: hechos con id, fecha opcional, estado y documentos fuente.
- `proceduralHistory`: eventos procesales fechados.
- `challengedDecision`: autoridad, fechas, referencia, resumen y documento.
- `claims`: peticiones y prioridad.
- `availableEvidence`: inventario probatorio.
- `deadlines`: plazos suministrados por el usuario, marcados como confirmados o no.
- `objectives`: objetivos procesales cerrados.
- `constraints`: urgencia, representacion, tolerancia al riesgo, idioma y presupuesto opcional.
- `documents`: referencias a documentos ya existentes en proveedores registrados.
- `analysisDate`: fecha ISO del analisis.

Los objetos anidados rechazan claves no declaradas. Los textos estan acotados para evitar cargas excesivas y no se aceptan blobs documentales en el input de esta herramienta.
