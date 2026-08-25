export { FedlexProvider, FEDLEX_CAPABILITIES } from "./fedlexProvider.js";
export { loadFedlexConfig, type FedlexConfig } from "./config.js";
export {
  FedlexSparqlClient,
  assertSafeIri,
  assertSafeIsoDate,
  assertSafeSystematicNumber,
  buildDescribeQuery,
  buildFindWorksBySystematicNumberQuery,
  buildListConsolidationsQuery,
  buildSearchByTitleQuery,
  sparqlEscapeString,
  JOLUX,
} from "./sparqlClient.js";
export { FedlexSourceResolver, type FedlexSourceResolution } from "./officialSourceResolver.js";
export {
  mapFedlexLawToNormalizedDocument,
  mapFedlexArticleToNormalizedDocument,
  FedlexMappingError,
  type FedlexLawMappingInput,
  type FedlexArticleMappingInput,
  type FedlexConsolidationVersion,
  type FedlexManifestationInfo,
} from "./mapper.js";
export {
  parseLanguageUri,
  parseInForceStatusUri,
  parseUserFormatUri,
  FedlexVocabularyError,
} from "./vocabulary.js";
export {
  parseAkomaNtosoXml,
  findArticleByNumber,
  findNodeByEId,
  extractText,
  listArticleEIds,
  articleNumberToEId,
  XmlSecurityError,
  type AkomaNtosoArticle,
} from "./xml/akomaNtosoParser.js";
export {
  sparqlBindingValueSchema,
  sparqlJsonResultSchema,
  sparqlAskResultSchema,
  groupPredicateObjectBindings,
  extractColumn,
  type SparqlBindingValue,
  type SparqlJsonResult,
  type SparqlAskResult,
} from "./remoteTypes.js";
