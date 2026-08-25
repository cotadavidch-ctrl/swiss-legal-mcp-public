# Day 01 - Swiss Federal Court Style Selection

Status: PARTIAL

## Objective

Create a cautious style profile for Swiss Federal Supreme Court writing using only sources resolved through Swiss Legal MCP. The target was a corpus of 50-70 decisions, preferably 60. The verified corpus available in this run is smaller, so the resulting skill is suitable only as a private-beta drafting aid and not as a complete empirical model.

## Source Policy

Primary sources used:

- Official Swiss Federal Supreme Court pages from `search.bger.ch`, resolved with `resolve_official_swiss_case`.
- Fedlex records for BGG, BV, ZGB and ZPO, resolved with `get_law`.

Rejected or limited sources:

- Aggregator search results were used only for discovery and not as legal authority.
- BGE excerpts with missing dispositive were not used as full-text judgments.
- Metadata-only or identity-not-verifiable candidates were excluded.
- Individual authorship was not inferred from panel composition.

## Candidate Assessment

| Candidate                                                | Evidence available                                                                                                                                    | Decision                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Individual judge style                                   | Official decisions verify panel composition and sometimes the presiding member, but do not verify a drafting judge or individual author.              | Rejected. Attribution would be speculative.          |
| II. zivilrechtliche Abteilung, German-language decisions | Multiple official decisions with identity verified and full text verified. Shared structure, procedural focus and institutional voice are observable. | Selected with PARTIAL confidence.                    |
| Broad civil-law corpus across divisions                  | One official I. civil division comparator was verified, but a mixed corpus would blur division-specific style.                                        | Used only as comparator, not as the primary profile. |

## Selected Scope

Selected model:

`II. zivilrechtliche Abteilung des Schweizerischen Bundesgerichts, German-language institutional style, with emphasis on Beschwerde in Zivilsachen and related simplified civil proceedings.`

This is an institutional style model. It is not an individual judge model.

## Verification Summary

Verified full-text official decisions included in the main corpus: 8.

Official but excluded or limited decisions: 4.

Fedlex statutes verified at law-version level: 4.

Corpus target not reached:

- Target: 50-70 decisions.
- Actual verified full-text corpus: 8 decisions.
- Result: PARTIAL.

## Swiss Legal MCP Tools Used

- `resolve_official_swiss_case`
- `search_cases`
- `get_law`

## Limitation

The style conclusions are stable for high-level institutional drafting patterns visible across the verified decisions, such as structure, concise fact handling, admissibility-first reasoning and restrained dispositive drafting. They are not sufficient for statistical claims about a judge, chamber over time, or all civil-law matters.
