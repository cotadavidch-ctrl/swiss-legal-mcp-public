import { LegislationProviderRegistry, ProviderRegistry, ToolRegistry } from "@swiss-legal-mcp/core";
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

export interface Registries {
  readonly providers: ProviderRegistry;
  readonly legislationProviders: LegislationProviderRegistry;
  readonly tools: ToolRegistry;
}

/**
 * Construccion de registries para el CLI de administracion. Deliberadamente
 * duplica la logica minima de apps/mcp-server/src/registry.ts en vez de
 * compartir un paquete: son dos procesos independientes y en fases
 * posteriores podrian activar proveedores con politicas distintas.
 *
 * Correccion de revision arquitectonica (pre-Fase 4, 2026-07-26): este
 * archivo habia quedado desactualizado tras la Fase 3 -- nunca se registro
 * FedlexProvider aqui, asi que el CLI reportaba un estado incompleto del
 * sistema (invisible a la legislacion federal). Se corrige para que ambos
 * puntos de entrada (mcp-server y admin-cli) reflejen el mismo conjunto de
 * proveedores activos.
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

    // Cierre de cobertura cantonal (SZ/GE/NE/JU) -- ver
    // apps/mcp-server/src/registry.ts para el detalle de por que GE/NE
    // comparten CantonalSilProvider y SZ/JU son adaptadores propios.
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
  }

  return { providers, legislationProviders, tools };
}
