export {
  type CitationType,
  type CitationMatchStatus,
  type ParsedCitationLocation,
  type ParsedCitation,
  type CitationEvidenceEntry,
  type CitationCandidate,
  type CitationResolution,
} from "./citationTypes.js";
export { parseCitations, classifyCitation } from "./parser.js";
export { normalizeCitation } from "./normalizer.js";
export {
  resolveCitation,
  type CitationResolutionContext,
  type CantonalCitationLookupPort,
  type CaseLawCitationLookupPort,
} from "./resolver.js";
