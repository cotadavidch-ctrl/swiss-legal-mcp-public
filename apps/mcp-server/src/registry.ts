import { z } from "zod";
import {
  LegislationProviderRegistry,
  ProviderRegistry,
  ProviderUnavailableError,
  ToolRegistry,
} from "@swiss-legal-mcp/core";
import type { Env } from "@swiss-legal-mcp/shared";
import { FixtureProvider } from "@swiss-legal-mcp/provider-fixture";
import {
  EntscheidsucheMcpProvider,
  loadEntscheidsucheConfig,
} from "@swiss-legal-mcp/provider-entscheidsuche";
import { FedlexProvider, loadFedlexConfig } from "@swiss-legal-mcp/provider-fedlex";
import { SecoProvider, loadSecoConfig } from "@swiss-legal-mcp/provider-seco";
import { BsvProvider, loadBsvConfig } from "@swiss-legal-mcp/provider-bsv";
import { EstvProvider, loadEstvConfig } from "@swiss-legal-mcp/provider-estv";
import { ShabProvider, loadShabConfig } from "@swiss-legal-mcp/provider-shab";
import {
  CantonalJuProvider,
  CantonalLexWorkProvider,
  CantonalSilProvider,
  CantonalSzProvider,
  CantonalZhProvider,
  LEXWORK_CANTONS,
  loadCantonalJuConfig,
  loadCantonalLexWorkConfig,
  loadCantonalSilConfig,
  loadCantonalSzConfig,
  loadCantonalZhConfig,
} from "@swiss-legal-mcp/provider-cantonal";
import { registerEntscheidsucheTools } from "./tools/entscheidsucheTools.js";
import { registerFedlexTools } from "./tools/fedlexTools.js";
import { registerAdministrativeTools } from "./tools/administrativeTools.js";
import { registerShabTools } from "./tools/shabTools.js";
import { registerCantonalTools } from "./tools/cantonalTools.js";
import { registerCitationTools } from "./tools/citationTools.js";
import { registerSearchAcrossSourcesTools } from "./tools/searchAcrossSourcesTools.js";
import { registerExtractPassagesTools } from "./tools/extractPassagesTools.js";
import { registerCompareDocumentsTools } from "./tools/compareDocumentsTools.js";
import { registerCitationNetworkTools } from "./tools/citationNetworkTools.js";
import { registerProceduralStrategyTools } from "./tools/proceduralStrategyTools.js";
import { registerLegalDraftingTools } from "./tools/legalDraftingTools.js";
import { registerMultiroleLegalAnalysisTools } from "./tools/multiroleLegalAnalysisTools.js";
import { registerOfficialSwissCaseTools } from "./tools/officialSwissCaseTools.js";
import { registerMatterRuntimeTools } from "./tools/matterRuntimeTools.js";

export interface Registries {
  readonly providers: ProviderRegistry;
  readonly legislationProviders: LegislationProviderRegistry;
  readonly tools: ToolRegistry;
}

/**
 * Construye ProviderRegistry y ToolRegistry para el proceso actual.
 *
 * - `FixtureProvider`: solo en NODE_ENV='test' (ver Fase 1). Fuera de test,
 *   ProviderRegistry.register lo marca 'disabled' y ademas el propio
 *   FixtureProvider se niega a instanciarse.
 * - `EntscheidsucheMcpProvider` (Fase 2): proveedor real de jurisprudencia,
 *   sin credenciales necesarias. Se registra en 'development'/'production'
 *   pero deliberadamente NO en 'test', para que la suite de pruebas de
 *   apps/mcp-server (Fase 1) siga sin depender de Internet. Las pruebas
 *   propias de las herramientas de entscheidsuche (Fase 2) construyen su
 *   propio registro con un proveedor falso -- ver
 *   apps/mcp-server/tests/entscheidsucheTools.test.ts.
 *
 * - `FedlexProvider` (Fase 3): proveedor real de legislacion federal, sin
 *   credenciales necesarias. Registrado en un `LegislationProviderRegistry`
 *   separado (jurisprudencia y legislacion tienen interfaces distintas, ver
 *   packages/core/src/legislationProvider.ts), activo en
 *   'development'/'production' pero NO en 'test', siguiendo el mismo patron
 *   que EntscheidsucheMcpProvider.
 *
 * - `SecoProvider`/`BsvProvider`/`EstvProvider` (Fase 4): documentacion
 *   administrativa federal (SECO, BSV/OFAS, ESTV/AFC). Fuentes de primera
 *   parte -> `officialCharacter: 'official'`, registradas en el mismo
 *   `ProviderRegistry` que entscheidsuche.ch (implementan la misma interfaz
 *   `LegalSourceProvider`), activas en 'development'/'production' pero NO en
 *   'test', siguiendo el mismo patron.
 *
 * - `ShabProvider` (Fase 5): registrado pero deliberadamente `unhealthy` de
 *   forma permanente -- shab.ch/amtsblattportal.ch declaran `robots.txt:
 *   Disallow: /` para todo user-agent y no publican una API pensada para
 *   reutilizacion por terceros (ver docs/providers/shab.md). Sus dos
 *   herramientas quedan visibles en el catalogo con estado `blocked`, nunca
 *   `active`.
 * - `CantonalLexWorkProvider`/`CantonalZhProvider` (Fase 5B): legislacion
 *   cantonal. 19 cantones LexWork (ver LEXWORK_CANTONS en
 *   @swiss-legal-mcp/provider-cantonal) + Zurich (ZH-Lex, sistema propio)
 *   estan activos y verificados en vivo -- ver
 *   docs/providers/cantonal-legislation.md para la matriz completa de los
 *   26 cantones (auditados/implementados/bloqueados con evidencia).
 *
 * Zefix y la jurisprudencia cantonal por canton individual (cubierta hoy
 * solo de forma agregada por `entscheidsuche.ch`, Fase 2) no se registran
 * todavia: eso pertenece a una fase posterior (ver IMPLEMENTATION_STATUS.md).
 */
export function buildRegistries(env: Env): Registries {
  const providers = new ProviderRegistry();
  const legislationProviders = new LegislationProviderRegistry();
  const tools = new ToolRegistry(providers, legislationProviders);

  if (env.NODE_ENV === "test") {
    providers.register(
      {
        id: "fixture",
        provider: new FixtureProvider(env.NODE_ENV),
        officialCharacter: "unofficial_aggregator",
        aggregatorName: "fixture-test-provider",
        capabilities: ["search", "getDocument"],
        languages: ["de"],
        jurisdictions: ["federal", "cantonal"],
        enabledInEnv: ["test"],
      },
      env.NODE_ENV,
    );

    tools.register({
      name: "fixture_search_cases",
      description:
        "Herramienta exclusiva de pruebas de infraestructura: busca en los documentos sinteticos de FixtureProvider. No representa jurisprudencia real y solo esta disponible con NODE_ENV=test.",
      inputSchema: { query: z.string().min(1) },
      requiredProviderIds: ["fixture"],
      handler: async (input, context) => {
        const provider = context.providers.get("fixture");
        if (!provider) {
          throw new ProviderUnavailableError("fixture");
        }
        return provider.search({ text: input.query });
      },
    });
  } else {
    providers.register(
      {
        id: "entscheidsuche",
        provider: new EntscheidsucheMcpProvider(loadEntscheidsucheConfig()),
        officialCharacter: "unofficial_aggregator",
        aggregatorName: "entscheidsuche.ch",
        capabilities: ["search", "getDocument", "getMetadata"],
        languages: ["de", "fr", "it"],
        jurisdictions: ["federal", "cantonal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );

    registerEntscheidsucheTools(tools);

    legislationProviders.register(
      {
        id: "fedlex",
        provider: new FedlexProvider(loadFedlexConfig()),
        officialCharacter: "official",
        jurisdictions: ["federal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );

    registerFedlexTools(tools);

    // Fase 4: documentacion administrativa federal (SECO, BSV/OFAS, ESTV/AFC).
    // Fuentes de primera parte -> officialCharacter: 'official' (no
    // 'unofficial_aggregator' como entscheidsuche.ch). Registrados en el
    // mismo ProviderRegistry que entscheidsuche.ch porque ambos implementan
    // LegalSourceProvider (ver packages/core/src/provider.ts) -- no se crea
    // un tercer registro solo para estos tres.
    providers.register(
      {
        id: "seco",
        provider: new SecoProvider(loadSecoConfig()),
        officialCharacter: "official",
        capabilities: ["search", "getDocument", "getMetadata"],
        languages: ["de", "fr"],
        jurisdictions: ["federal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );
    providers.register(
      {
        id: "bsv",
        provider: new BsvProvider(loadBsvConfig()),
        officialCharacter: "official",
        capabilities: ["search", "getDocument", "getMetadata"],
        languages: ["de"],
        jurisdictions: ["federal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );
    providers.register(
      {
        id: "estv",
        provider: new EstvProvider(loadEstvConfig()),
        officialCharacter: "official",
        capabilities: ["search", "getDocument", "getMetadata"],
        languages: ["de"],
        jurisdictions: ["federal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );

    registerAdministrativeTools(tools);

    // Fase 5: SHAB (bloqueado por robots.txt, ver docs/providers/shab.md) y
    // legislacion cantonal (muestra Berna/LexWork + Zurich/ZH-Lex, ver
    // docs/providers/cantonal-legislation.md).
    providers.register(
      {
        id: "shab",
        provider: new ShabProvider(loadShabConfig()),
        officialCharacter: "official",
        capabilities: [],
        languages: ["de", "fr", "it"],
        jurisdictions: ["federal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );
    registerShabTools(tools);

    // Los 19 cantones LexWork confirmados en vivo (Fase 5B, ver
    // docs/providers/cantonal-legislation.md): un CantonalLexWorkProvider
    // por canton, parametrizado por LEXWORK_CANTONS. Anadir un canton nuevo
    // aqui requiere haberlo verificado en vivo antes (nunca por analogia).
    for (const descriptor of LEXWORK_CANTONS) {
      providers.register(
        {
          id: `cantonal-${descriptor.cantonCode.toLowerCase()}`,
          provider: new CantonalLexWorkProvider(
            loadCantonalLexWorkConfig({
              cantonCode: descriptor.cantonCode,
              baseUrl: descriptor.baseUrl,
              domains: descriptor.domains,
              language: descriptor.language,
            }),
          ),
          officialCharacter: "official",
          capabilities: ["search", "getDocument", "getArticle"],
          languages: [descriptor.language],
          jurisdictions: ["cantonal"],
          enabledInEnv: ["development", "production"],
        },
        env.NODE_ENV,
      );
    }
    providers.register(
      {
        id: "cantonal-zh",
        provider: new CantonalZhProvider(loadCantonalZhConfig()),
        officialCharacter: "official",
        capabilities: ["search", "getDocument"],
        languages: ["de"],
        jurisdictions: ["cantonal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );

    // Cierre de cobertura cantonal (SZ/GE/NE/JU): verificados en vivo, ver
    // docs/providers/cantonal-legislation.md. GE y NE comparten la
    // plataforma real "SIL" (ARCHILEXMP) -> CantonalSilProvider
    // parametrizado; SZ y JU son productos distintos, cada uno con su
    // propio adaptador.
    providers.register(
      {
        id: "cantonal-sz",
        provider: new CantonalSzProvider(loadCantonalSzConfig()),
        officialCharacter: "official",
        capabilities: ["search", "getDocument"],
        languages: ["de"],
        jurisdictions: ["cantonal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );
    providers.register(
      {
        id: "cantonal-ge",
        provider: new CantonalSilProvider(
          loadCantonalSilConfig({
            cantonCode: "GE",
            cantonName: "Geneve",
            baseUrl: "https://silgeneve.ch",
            bookPath: "legis/program/books/RSG",
            language: "fr",
            domains: ["silgeneve.ch"],
          }),
        ),
        officialCharacter: "official",
        capabilities: ["search", "getDocument"],
        languages: ["fr"],
        jurisdictions: ["cantonal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );
    providers.register(
      {
        id: "cantonal-ne",
        provider: new CantonalSilProvider(
          loadCantonalSilConfig({
            cantonCode: "NE",
            cantonName: "Neuchatel",
            baseUrl: "https://rsn.ne.ch",
            bookPath: "DATA/program/books/rsne",
            language: "fr",
            domains: ["rsn.ne.ch"],
          }),
        ),
        officialCharacter: "official",
        capabilities: ["search", "getDocument"],
        languages: ["fr"],
        jurisdictions: ["cantonal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );
    providers.register(
      {
        id: "cantonal-ju",
        provider: new CantonalJuProvider(loadCantonalJuConfig()),
        officialCharacter: "official",
        capabilities: ["getDocument"],
        languages: ["fr"],
        jurisdictions: ["cantonal"],
        enabledInEnv: ["development", "production"],
      },
      env.NODE_ENV,
    );

    registerCantonalTools(tools);

    // Fase 6 (funciones juridicas avanzadas, "cierre de cobertura cantonal"
    // ya completo): reutiliza exclusivamente los proveedores ya integrados
    // arriba, ninguna fuente nueva -- ver docs/providers/advanced-legal-functions.md.
    registerCitationTools(tools);
    registerSearchAcrossSourcesTools(tools);
    registerExtractPassagesTools(tools);
    registerCompareDocumentsTools(tools);
    registerCitationNetworkTools(tools);
  }

  // Fase 8: analisis procesal avanzado. La herramienta principal opera de
  // forma conservadora y tambien funciona en test con FixtureProvider; no
  // registra proveedores nuevos ni inventa fuentes cuando no hay corpus.
  registerProceduralStrategyTools(tools);

  // Capa de redaccion/revision juridica suiza. Funciona de forma determinista
  // con datos estructurados del expediente y no requiere proveedores sanos
  // para no inventar sustitutos cuando una fuente externa no esta disponible.
  registerLegalDraftingTools(tools);

  // Analisis contradictorio multirrol. Es deliberadamente local y
  // conservador: no registra proveedores nuevos ni convierte argumentos de
  // parte en hallazgos judiciales.
  registerMultiroleLegalAnalysisTools(tools);

  // Resolvedor oficial de jurisprudencia suiza. Es una capa local de
  // orquestacion/guardrails con adaptadores extensibles; no convierte
  // agregadores en fuentes oficiales ni rebaja la politica de lectura completa.
  registerOfficialSwissCaseTools(tools);

  // Fase 9: memoria operacional de Matter, pipeline parcial/completo,
  // orquestacion de investigacion juridica y QA de borradores. Herramientas
  // aditivas y locales: no sustituyen ni relajan proveedores oficiales.
  registerMatterRuntimeTools(tools);

  return { providers, legislationProviders, tools };
}
