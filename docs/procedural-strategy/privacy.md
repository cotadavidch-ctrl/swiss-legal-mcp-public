# Privacidad

La herramienta esta disenada para expedientes pseudonimizados.

Practicas:

- El input debe describir partes y hechos sin nombres innecesarios.
- No se registran cuerpos completos ni documentos privados.
- Los logs usan la redaccion central de `packages/shared/src/logger.ts`.
- Las advertencias recuerdan no destruir, ocultar ni falsear prueba.
- Los documentos se referencian por `documentId`, no se envian como archivos crudos.

No debe usarse para almacenar datos personales sensibles salvo que el despliegue local tenga una base juridica y controles operativos propios.
