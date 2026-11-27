---
name: geheimnis-und-anonymisierung
description: "Protocolo de secreto profesional y anonimizacion antes de usar documentos de un asunto con herramientas externas, segun el derecho suizo. Usar con anonimizar, secreto profesional, datos de clientes o proteccion de datos."
---

# Secreto profesional y anonimizacion

## Marco (verifica el texto con `get_article`)

- Art. 321 StGB: revelar un secreto confiado por razon de la profesion es delito para abogados, defensores y otras profesiones, y para sus auxiliares.
- Art. 13 BGFA: los abogados estan sujetos al secreto profesional sin limite de tiempo y frente a cualquiera, y deben velar por que sus auxiliares lo respeten.
- La proteccion de datos (Ley federal de proteccion de datos y normas cantonales) se suma a lo anterior. No cites sus articulos sin verificarlos con la herramienta.

## Antes de subir nada

1. Pregunta si el material es de un cliente. Si lo es, no entra en ninguna herramienta externa sin anonimizar.
2. Usa una carpeta propia del asunto, sin documentos de otros asuntos.
3. Un asistente automatico que lea una carpeta lee todo lo que contiene: separa el trabajo de las carpetas de clientes.

## Protocolo de anonimizacion

1. Sustituye antes de usar el texto: personas por CLIENTE_1, PARTE_CONTRARIA_1; direcciones por DIRECCION_1; empresas por EMPRESA_1; cuentas, matriculas, numeros de AHV y de procedimiento por codigos (CUENTA_1, AHV_1, EXPEDIENTE_1).
2. Guarda la tabla de equivalencias en un fichero aparte, fuera de las carpetas conectadas y de cualquier servicio externo.
3. Trabaja con el texto anonimizado. El razonamiento juridico no pierde calidad.
4. Al final, deshaz la sustitucion en el documento definitivo.
5. Revisa lo que no se anonimiza solo: fechas muy especificas, importes unicos, ocupaciones raras y descripciones que identifican por contexto.

## Comprobacion de 30 segundos

Pregunta: si lo que hay en el texto apareciera manana en un periodico, habria un problema? Si la respuesta es si, no lo uses sin anonimizar.

## Reglas

- Las consultas a swiss-legal-mcp van siempre con datos anonimizados: nombres, direcciones y numeros de procedimiento no salen.
- Esta skill es una ayuda practica, no un dictamen sobre tus obligaciones de secreto; consulta con tu colegio profesional o un abogado si hay dudas.

## Datos que hay que pedir

- Tipo de material.
- Quien lo vera.
- Herramienta destino.

Pide solo lo que falte y marca como `[PENDIENTE]` lo que el usuario no tenga.

## Entregable

Texto anonimizado y tabla separada. Incluye la lista de datos pendientes y de citas verificadas y no verificadas.

## Errores a evitar

- Dejar datos identificables por contexto.

## Texto oficial

El texto literal de los articulos citados esta en `articulos.md`, en la carpeta de esta skill (Fedlex, aleman, descargado el 2026-11-27). Leelo antes de afirmar su contenido y confirma la version vigente con `get_article`.

## Control antes de entregar

- Cada norma citada esta comprobada con `get_article` o aparece en `articulos.md`; lo demas va como `[PENDIENTE DE VERIFICAR]`.
- Cada plazo sale de `compute_legal_deadline` o va marcado `[CALCULO MANUAL, SIN HERRAMIENTA]`, con la fecha de notificacion y su prueba.
- Los hechos conservan su estado (`accepted`, `alleged`, `disputed`, `unknown`) y no se usan como probados si no lo estan.
- Los datos identificables no salen hacia herramientas externas.
- Las sentencias citadas se han leido y comprobado.
- La entrega dice que es un borrador para revision de una persona habilitada y no promete resultado.
