# Reviewer schema

The import schema is enforced by `pnpm review:procedural-strategy --import <path>`.

Dimensions: fact_reconstruction, chronology, fact_classification, competence, authority, procedural_route, admissibility, standing, deadlines, applicable_law, burden_of_proof, evidence_assessment, comparable_case_law, adverse_case_law, primary_strategy, alternatives, counteranalysis, risks, confidence, traceability, clarity, practical_utility.

Finding severities: critical, major, minor, stylistic, missing_context, unsupported_inference, excessive_confidence, insufficient_confidence, missed_adverse_authority, wrong_procedural_route, deadline_issue, evidence_overstatement, strategy_weakness, privacy_issue, traceability_issue.

Reviewer IDs must be pseudonymous and match `reviewer-[a-z0-9-]+`.
