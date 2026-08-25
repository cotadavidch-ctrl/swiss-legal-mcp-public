# Limitaciones

Limitaciones deliberadas de Fase 8:

- No calcula plazos legales no modelados.
- No activa `get_transitional_provisions`.
- No anade proveedores juridicos nuevos.
- No ingiere documentos privados completos como blobs.
- No usa OCR.
- No usa IA ni modelos estadisticos.
- No resuelve ECLI de forma sistematica.
- No afirma aplicacion juridica cuando solo detecta una cita.
- No garantiza competencia, admisibilidad, exito ni resultado.
- La jurisprudencia comparable depende del corpus recuperado por proveedores existentes y puede ser insuficiente.
- La evaluacion de Fase 9 usa un corpus pequeno y controlado; no permite porcentajes generalizables
  sobre expedientes reales.
- El caso piloto de Appenzell Ausserrhoden se evalua desde una fixture local anonimizada. No se
  afirma que documentos privados externos hayan sido revisados por el sistema.
- No existe validacion profesional humana hasta que se complete una revision cualificada con la
  plantilla de revision humana.
- Fase 10 prepara el paquete de revision humana y ya contiene una live evaluation controlada con
  consultas anonimizadas, pero no contiene revisiones humanas importadas ni calibracion profesional.
  El warning del release gate debe permanecer hasta que exista revision cualificada real.

Estas limitaciones son parte del contrato de seguridad y exactitud, no deuda oculta.
