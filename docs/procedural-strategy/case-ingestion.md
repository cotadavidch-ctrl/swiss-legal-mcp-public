# Ingestion de expediente

La herramienta ingiere solo datos estructurados. No intenta extraer hechos de documentos privados ni transformar escritos completos en posiciones procesales.

Reglas:

- Los documentos se cargan solo si ya pertenecen a un proveedor registrado.
- Un documento ausente queda en `trace.loadedDocuments` como `not_found` o `provider_unavailable`.
- Los hechos se ordenan cronologicamente cuando tienen fecha.
- Las contradicciones de fecha obvias se reportan, por ejemplo notificacion anterior a decision.
- La falta de parte contraria, peticiones, decision impugnada, prueba o fecha de notificacion se devuelve como informacion faltante.

Esto evita convertir texto libre no verificado en hechos probados.
