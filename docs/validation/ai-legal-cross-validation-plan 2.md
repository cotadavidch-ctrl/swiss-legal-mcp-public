# Plan de validación jurídica cruzada asistida por IA (AI_LEGAL_CROSS_VALIDATION)

Estado del documento: `AI_LEGAL_CROSS_VALIDATION` — plan aprobado para ejecución futura.
Estado de ejecución: no ejecutado. Ningún caso de esta batería ha sido corrido todavía.

> Aclaración expresa: este documento describe una validación cruzada entre sistemas de IA
> (Swiss Legal MCP + dos IAs jurídicas independientes) contrastada contra fuentes oficiales.
> **Esto no equivale, no sustituye y no debe presentarse como revisión jurídica humana.**
> `HUMAN_LEGAL_REVIEW_COMPLETED` permanece en `false` durante todo este proceso y solo puede
> cambiar a `true` cuando una persona jurista cualificada complete una revisión independiente
> documentada (ver plantilla equivalente en `docs/procedural-strategy/human-review-template.md`
> para el formato esperado de esa revisión, aplicado a los mismos 30 casos).

## 1. Objetivo

Establecer un procedimiento formal, repetible y auditable para comparar la calidad, exactitud y
comportamiento de abstención de Swiss Legal MCP frente a otros dos sistemas de IA jurídica
independientes, verificando cada respuesta contra fuentes oficiales suizas antes de emitir
cualquier conclusión sobre fiabilidad.

El objetivo no es demostrar que Swiss Legal MCP es "mejor" que otra IA. El objetivo es detectar:

- invenciones (citas, casos, artículos o cifras inexistentes presentadas como reales);
- normas derogadas presentadas como vigentes;
- confusión entre fundamento decisivo (ratio) y obiter dictum;
- omisión de fundamentos autónomos que cambian la conclusión;
- exceso de confianza sin base verificable;
- fallo en abstenerse cuando la evidencia es insuficiente.

## 2. Alcance

- Aplica exclusivamente a los 30 casos definidos en `ai-legal-test-cases.json`.
- Aplica a derecho federal suizo, una muestra de derecho cantonal y procedimiento/plazos.
- Incluye alemán, francés y español como idiomas de prueba.
- No aplica a jurisdicciones no suizas.
- No aplica a áreas de Swiss Legal MCP no relacionadas con búsqueda, verificación o análisis
  jurídico (p. ej. no evalúa infraestructura, empaquetado o publicación).
- No constituye asesoramiento legal para ningún caso real de ningún usuario. Los prompts son
  sintéticos o basados en resoluciones públicas ya identificadas como casos de regresión.

## 3. Modelos a comparar

Exactamente **tres** sistemas por caso:

1. **Swiss Legal MCP** (el sujeto de esta validación).
2. **IA jurídica independiente 2** — un asistente/modelo de IA distinto con capacidad de
   razonamiento jurídico, documentado por nombre y versión exacta en la plantilla de resultados.
3. **IA jurídica independiente 3** — un segundo asistente/modelo distinto de los dos anteriores,
   igualmente documentado por nombre y versión exacta.

Los tres deben ser sistemas realmente distintos (proveedor, modelo o configuración de
herramientas claramente diferenciados). No se acepta que "IA 2" e "IA 3" sean el mismo modelo
subyacente con distinto prompt de sistema.

## 4. Metodología

### 4.1 Prompts idénticos (obligatorio)

Los tres sistemas deben recibir **exactamente el mismo prompt**, en el mismo idioma, con el mismo
contexto adicional (si el caso lo incluye), en la misma sesión de ejecución o en sesiones
equivalentes sin memoria previa contaminada. No se permite reformular, simplificar, traducir de
forma distinta o "ayudar" a un modelo con contexto adicional que no reciban los otros dos.

### 4.2 Aislamiento entre modelos (obligatorio)

Ningún sistema puede ver, recibir o ser informado de la respuesta de otro sistema para el mismo
caso, ni antes ni durante su propia respuesta. Está prohibido:

- pegar la respuesta de un modelo como contexto de otro;
- pedir a un modelo que "mejore" o "corrija" la respuesta de otro;
- ejecutar los modelos en un orden que permita filtración de contexto compartido (p. ej. mismo
  hilo de conversación reutilizado).

Cada respuesta se ejecuta en un contexto limpio e independiente.

### 4.3 Verificación contra fuentes oficiales (obligatorio)

Toda cita legal, número de caso, artículo normativo o cifra que aparezca en cualquiera de las tres
respuestas debe verificarse contra la fuente oficial correspondiente antes de puntuar el caso:

- legislación federal: Fedlex (fedlex.admin.ch) / Recopilación Sistemática (RS);
- jurisprudencia federal: sitio oficial del Tribunal Federal (bger.ch) / entscheidsuche.ch como
  índice, nunca como fuente primaria sustitutiva;
- legislación y jurisprudencia cantonal: publicación oficial del cantón correspondiente;
- publicaciones administrativas: SECO, OFAS/BSV, AFC/ESTV, FOSC/SHAB según corresponda.

Ninguna respuesta se da por correcta porque "suene razonable" o porque los tres sistemas
coincidan entre sí. El consenso entre modelos **no** es prueba de corrección (ver 4.6).

### 4.4 Separación entre fuente primaria, secundaria e inferencia

Cada afirmación evaluada debe clasificarse como una de estas tres categorías, y esa
clasificación debe registrarse en la plantilla de resultados:

- **Fuente primaria**: texto oficial verificado directamente (texto del artículo en Fedlex,
  texto del considerando en la sentencia oficial, publicación oficial cantonal).
- **Fuente secundaria**: resumen, comentario doctrinal, base de datos de terceros o índice
  (p. ej. entscheidsuche.ch como localizador) que no sustituye la verificación primaria pero
  puede orientar la búsqueda.
- **Inferencia del modelo**: razonamiento, extrapolación o síntesis del sistema de IA que no
  está literalmente en ninguna fuente y debe presentarse explícitamente como tal.

Una respuesta que presenta una inferencia como si fuera fuente primaria se trata como un
problema de trazabilidad, no como una simple imprecisión menor.

### 4.5 Tratamiento de discrepancias

Cuando los tres sistemas no coinciden entre sí, o cuando cualquiera de ellos no coincide con la
fuente oficial:

1. Se documenta la discrepancia exacta (qué dijo cada sistema, textualmente o resumido con cita).
2. Se resuelve exclusivamente contra la fuente oficial verificada, nunca por mayoría/voto entre
   los tres sistemas.
3. Si la fuente oficial no permite resolver la discrepancia con confianza razonable, el caso se
   marca `REVIEW_REQUIRED` y se documenta como pendiente de revisión jurídica humana, no como
   "empate" ni como "probablemente correcto".
4. Toda discrepancia se registra en la plantilla de resultados, incluso si al final un sistema
   resulta correcto y los otros dos incorrectos.

### 4.6 El consenso entre modelos no es prueba

Que dos o tres sistemas coincidan en una afirmación no la vuelve correcta. Los tres pueden
compartir el mismo sesgo de entrenamiento o el mismo error de generalización. Toda afirmación se
verifica contra la fuente oficial con independencia de cuántos sistemas la repitan.

### 4.7 Criterios para repetir una prueba

Un caso se repite (con nueva ejecución, no con edición retroactiva de la respuesta ya dada)
únicamente cuando:

- hubo un error técnico verificable (timeout, error de herramienta, respuesta truncada,
  contaminación de contexto entre modelos);
- el prompt se ejecutó con una variación no autorizada respecto al prompt fijado en
  `ai-legal-test-cases.json`;
- la fuente oficial usada para verificar cambió entre el momento de la respuesta y el momento de
  la verificación (p. ej. la norma fue modificada), y debe registrarse la fecha de verificación
  usada.

Toda repetición debe documentar el motivo exacto en `reviewer_notes` antes de repetirse. No se
repite un caso simplemente porque el resultado fue `CRITICAL_FAILURE` o porque el resultado no es
el esperado.

### 4.8 Criterios de suspensión

La ejecución de la batería completa se suspende (no se continúa con los casos restantes) si:

- se detecta que un prompt fue expuesto entre modelos (violación de 4.2), invalidando la
  comparabilidad de todos los casos ya ejecutados en esa sesión;
- se detecta manipulación o edición manual de una respuesta de un modelo antes de su registro;
- más de un tercio de los casos ejecutados hasta ese punto resultan en `CRITICAL_FAILURE` por la
  misma causa raíz, lo que indica un problema sistémico que debe diagnosticarse antes de seguir
  generando datos poco útiles;
- no es posible verificar fuentes oficiales por caída o bloqueo de acceso a Fedlex/BGer/fuentes
  cantonales durante un periodo prolongado — en ese caso se suspende hasta que la verificación
  oficial vuelva a ser posible; no se aceptan verificaciones "aproximadas" como sustituto.

## 5. Flujo obligatorio por caso

```
caso (prompt fijo del JSON)
  → Swiss Legal MCP responde (contexto aislado)
  → IA jurídica 2 responde (contexto aislado, mismo prompt exacto)
  → IA jurídica 3 responde (contexto aislado, mismo prompt exacto)
  → verificación contra fuentes oficiales (por cada afirmación citada)
  → clasificación fuente primaria / secundaria / inferencia
  → evaluación con la rúbrica (ai-legal-evaluation-rubric.md)
  → clasificación final: PASS / REVIEW_REQUIRED / CRITICAL_FAILURE
  → registro de discrepancias entre los tres sistemas y frente a la fuente oficial
  → decisión: cerrar caso, repetir caso (con motivo documentado) o escalar a revisión humana
```

Ningún paso puede omitirse. En particular, la verificación contra fuentes oficiales ocurre
siempre, incluso cuando los tres sistemas coinciden.

## 6. Límites de esta validación

- Esta validación mide comportamiento observable de los tres sistemas frente a 30 casos. No es
  una auditoría exhaustiva de Swiss Legal MCP ni de las otras IAs.
- 30 casos son una muestra, no una cobertura completa del derecho suizo. Un `PASS` en esta
  batería no certifica corrección jurídica general.
- Esta validación no sustituye pruebas unitarias de código, auditoría de seguridad, revisión de
  licencias ni ningún otro control ya cubierto por `FINAL_PREPUBLICATION_VALIDATION`,
  `PACKAGE_INSTALLABILITY` o `CI_GATE`.
- Esta validación no autoriza cambios de código, de proveedor de datos, de herramientas, de
  versión, de licencia ni de visibilidad del paquete. Cualquier hallazgo se documenta como
  entrada para trabajo futuro, no se corrige automáticamente en esta fase.
- Esta validación no constituye, no reemplaza y no debe describirse como revisión jurídica
  humana profesional.

## 7. Riesgos de usar solo IA para validar IA

- **Sesgo compartido**: los tres sistemas pueden fallar exactamente igual si comparten datos de
  entrenamiento similares (p. ej. todos "recuerdan mal" el mismo artículo derogado).
- **Falsa sensación de rigor**: comparar tres IAs puede parecer más objetivo de lo que es si no
  se ancla sistemáticamente en la fuente oficial (por eso 4.3 y 4.6 son obligatorios, no
  opcionales).
- **Alucinación coincidente**: dos modelos pueden inventar el mismo dato falso de forma
  independiente por patrones de lenguaje similares, simulando "confirmación cruzada" falsa.
- **Fuentes oficiales imperfectas o ambiguas**: algunas preguntas de derecho cantonal o de
  interpretación doctrinal no tienen una única fuente oficial que zanje la discrepancia; en esos
  casos el resultado correcto es `REVIEW_REQUIRED`, no un veredicto forzado.
- **Ausencia de responsabilidad profesional**: ninguna IA asume responsabilidad legal por sus
  respuestas. Esta validación no genera ni sustituye esa responsabilidad.
- **Riesgo de sobreconfianza en el estado `PASS`**: un `PASS` en esta batería sintética no
  implica que Swiss Legal MCP sea seguro de usar sin revisión humana en casos reales de alto
  riesgo (expulsión, prisión preventiva, plazos perentorios reales de un usuario concreto).

## 8. Reglas para la fase de ejecución futura (no ejecutar todavía)

Cuando se ejecute esta batería, en una fase posterior y separada, deben respetarse estas reglas:

- ejecutar los 30 casos con Swiss Legal MCP;
- ejecutar exactamente los mismos 30 prompts, en el mismo idioma, con dos IAs jurídicas
  independientes distintas entre sí y distintas de Swiss Legal MCP;
- no compartir la respuesta de un modelo con otro en ningún momento;
- conservar las respuestas completas de los tres sistemas para cada caso (no resúmenes editados);
- verificar cada fuente citada contra la fuente oficial correspondiente antes de puntuar;
- registrar toda discrepancia entre modelos y frente a la fuente oficial, incluso las menores;
- no corregir código, prompts del producto ni comportamiento de Swiss Legal MCP de forma
  automática a partir de los resultados; los hallazgos se documentan como propuestas para
  revisión posterior;
- no aceptar el consenso entre los tres modelos como prueba de corrección;
- priorizar siempre la fuente oficial por encima de cualquier respuesta de IA, incluida la de
  Swiss Legal MCP;
- repetir un caso solo después de documentar el motivo exacto según la sección 4.7;
- no marcar `HUMAN_LEGAL_REVIEW_COMPLETED` como `true` en ningún momento de esta fase; esa marca
  solo puede cambiarla una persona jurista cualificada completando una revisión humana
  independiente y documentada;
- no publicar el paquete, no crear commits ni tags de Git, no cambiar versión ni licencia como
  resultado de esta validación.

## 9. Estado correcto de este documento

`AI_LEGAL_CROSS_VALIDATION` — plan definido, casos definidos, rúbrica definida, plantilla de
resultados definida. Ejecución: pendiente. Ningún resultado real existe todavía en este
repositorio para esta batería.
