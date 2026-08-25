# Analisis de plazos

La herramienta no calcula plazos si no existe base legal real y evento inicial confirmado.

Estados:

- `confirmed`: plazo suministrado por el usuario con fecha y marcado como confirmado.
- `uncertain`: plazo suministrado sin confirmacion suficiente.
- `cannot_calculate`: hay fecha de notificacion o posible plazo, pero falta la regla aplicable.

No se aplican reglas de vacaciones judiciales, suspension, restitucion, dies a quo/dies ad quem ni calendario cantonal por heuristica. Esos elementos se reportan como advertencias o informacion faltante hasta que exista una fuente reproducible o una regla codificada y probada.
