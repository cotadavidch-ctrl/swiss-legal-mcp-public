# {{displayName}}

{{description}}

Autoria: texto propio, escrito para este proyecto. No deriva de ningun plugin de terceros.

## Principios comunes a todas las skills

1. Todo dato juridico (articulo, plazo, sentencia) sale de una herramienta de swiss-legal-mcp. Si la herramienta no responde o no encuentra el dato, se dice y se marca `[PENDIENTE DE VERIFICAR]`. Nunca se completa de memoria.
2. Los hechos llevan estado: `accepted`, `alleged`, `disputed` o `unknown`. Un hecho `unknown` o `alleged` no se usa como establecido.
3. Nada de datos identificables en consultas a servicios externos: nombres, direcciones y numeros de expediente se sustituyen por CLIENTE_1, PARTE_CONTRARIA_1, etc. La tabla de equivalencias queda fuera de las carpetas conectadas.
4. El resultado es un borrador para revision de una persona habilitada. No es asesoramiento juridico ni garantia de resultado.
