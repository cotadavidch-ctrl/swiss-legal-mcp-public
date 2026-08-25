import type { ProviderRegistry } from "@swiss-legal-mcp/core";
import type { EntscheidsucheMcpProvider } from "@swiss-legal-mcp/provider-entscheidsuche";
import type {
  CantonalCitationLookupPort,
  CaseLawCitationLookupPort,
} from "@swiss-legal-mcp/citations";
import { resolveCantonalProvider } from "./cantonalTools.js";

/**
 * Adaptadores reales que conectan packages/citations (generico, sin
 * dependencias de proveedores concretos) con los proveedores ya registrados
 * en apps/mcp-server. No se implementan aqui nuevos mecanismos de busqueda:
 * cada adaptador reusa exactamente el metodo real ya probado del proveedor
 * correspondiente (mismo despacho por familia que cantonalTools.ts, misma
 * herramienta search_by_case_number de entscheidsuche.ch).
 */

/**
 * Resuelve una cita cantonal por numero sistematico. Requiere `cantonCode`
 * explicito: un numero sistematico cantonal (ej. "100.100") es indistinguible
 * de otro cantón por texto solo, y consultar los 26 proveedores cantonales
 * reales por cada cita sin pista de canton seria una busqueda de fuerza
 * bruta contra 26 fuentes reales -- se prefiere declarar la limitacion
 * explicitamente (ver resolver.ts) antes que hacerlo.
 */
export function makeCantonalCitationLookup(
  providers: ProviderRegistry,
): CantonalCitationLookupPort {
  return {
    async resolveBySystematicNumber(systematicNumber, cantonCode) {
      if (!cantonCode) return [];
      let resolved;
      try {
        resolved = resolveCantonalProvider(providers, cantonCode);
      } catch {
        return [];
      }
      const { family, provider } = resolved;
      const providerId = provider.id;
      switch (family) {
        case "lexwork": {
          const outcome = await provider.searchDocuments({ systematicNumber });
          return outcome.results.map((document) => ({ document, providerId }));
        }
        case "zh-own": {
          const outcome = await provider.searchDocuments({ referenceNumber: systematicNumber });
          return outcome.results.map((document) => ({ document, providerId }));
        }
        case "sz":
        case "sil": {
          const outcome = await provider.searchDocuments({ systematicNumber });
          return outcome.results.map((document) => ({ document, providerId }));
        }
        case "ju":
          // Jura no tiene mecanismo de busqueda real verificado (ver
          // docs/provider-contracts/cantonal-ju.md) -- nunca se simula uno.
          return [];
        default:
          return [];
      }
    },
  };
}

/**
 * Resuelve una referencia BGE/ATF/DTF o un numero de expediente contra
 * entscheidsuche.ch, via la herramienta real `search_by_case_number`
 * (busqueda de frase exacta, ya activa como `search_cases_by_reference`).
 */
export function makeCaseLawCitationLookup(
  entscheidsuche: EntscheidsucheMcpProvider,
): CaseLawCitationLookupPort {
  return {
    async resolveByReference(reference) {
      const outcome = await entscheidsuche.searchByCaseNumber({ caseNumber: reference });
      return outcome.results.map((document) => ({ document, providerId: "entscheidsuche" }));
    },
  };
}
