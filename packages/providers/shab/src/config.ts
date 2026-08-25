/**
 * Configuracion de SHAB. Deliberadamente sin variables de entorno: el
 * proveedor nunca realiza peticiones de red (ver docs/providers/shab.md),
 * asi que no hay timeout/reintentos/circuit breaker/caché que configurar.
 * Los dominios reales se documentan aqui unicamente como referencia para
 * cuando exista un canal de acceso autorizado -- NO se usan para validar
 * ninguna peticion real todavia.
 */
export interface ShabConfig {
  readonly knownDomains: readonly string[];
  readonly blockReason: string;
}

const BLOCK_REASON =
  "shab.ch y amtsblattportal.ch declaran robots.txt: Disallow: / para todo user-agent, y la API real que alimenta su propio frontend no tiene documentacion publica ni terminos de reutilizacion para terceros. ShabProvider no realiza ninguna peticion de red (ver docs/provider-contracts/shab.md).";

export function loadShabConfig(): ShabConfig {
  return {
    knownDomains: ["shab.ch", "www.shab.ch", "amtsblattportal.ch", "www.amtsblattportal.ch"],
    blockReason: BLOCK_REASON,
  };
}
