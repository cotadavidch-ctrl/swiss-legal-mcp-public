# Swiss Legal MCP confidence policy

calibration_id: CONFIDENCE-CALIBRATION-2026-08-06-PRIVATE-BETA-001
scope: PRIVATE_PERSONAL_BETA
human_review_completed: false

## Core rule

A high quality score cannot compensate for an unverified official source in a high-risk legal question.

## Bands

### VERY_HIGH

- Numeric range: 90-100, only when PASS and official verification or correct abstention against fabricated/high-risk request is present
- Meaning: Strong operational confidence in the bounded answer, not a guarantee of legal outcome.
- Permitted use: Direct answer with concise source trace and normal caveats.
- Verification need: Official source already verified or response is a safe abstention to an unverifiable/fabricated request.
- Expected behavior: Answer narrowly; preserve citations and limits.
- Can answer directly: true
- Must warn: true
- Must abstain: false

### HIGH

- Numeric range: 80-89, PASS with verified source, safe methodology, or correct conservative abstention
- Meaning: Usable for private beta with warnings; still not legal advice.
- Permitted use: Answer with source caveats and invite official review for downstream reliance.
- Verification need: Official source should be present for legal assertions; if absent, demote to MEDIUM or ABSTAIN_REQUIRED.
- Expected behavior: Answer but expose uncertainty and source boundaries.
- Can answer directly: true
- Must warn: true
- Must abstain: false

### MEDIUM

- Numeric range: 70-79 or REVIEW_REQUIRED without critical failure
- Meaning: Potentially useful but not release-calibrated for reliance without review.
- Permitted use: Use as research lead or methodological note, not as final legal answer.
- Verification need: Requires official-source or human verification before reliance.
- Expected behavior: Warn prominently; avoid firm conclusions.
- Can answer directly: false
- Must warn: true
- Must abstain: false

### LOW

- Numeric range: 50-69 or unresolved source/capability gap with partial answer
- Meaning: Insufficient for legal reliance.
- Permitted use: Internal diagnostic only.
- Verification need: Requires new evidence or tool/source fix.
- Expected behavior: Explain limitation and ask for source/document.
- Can answer directly: false
- Must warn: true
- Must abstain: false

### ABSTAIN_REQUIRED

- Numeric range: Override band independent of score when source is unavailable, citation is unverified, request is high-risk/incomplete/fabricated, provider returns unavailable, or identity mismatch occurs
- Meaning: The safe response is refusal to assert the requested legal fact/outcome.
- Permitted use: State what cannot be verified and what evidence is needed.
- Verification need: Official source or human review required before any affirmative legal claim.
- Expected behavior: Abstain from unsupported assertion; give next verification step.
- Can answer directly: false
- Must warn: true
- Must abstain: true

## Operational rules

1. Respond normally only in VERY_HIGH or HIGH when the required source is verified or the task is purely methodological.
2. Include a warning for all legal outputs, even high-confidence ones, because the system is not a lawyer and facts may change.
3. Require official verification for citations, legislation versions, deadlines, sanctions, remedies, procedural admissibility, case identity, and cantonal authority questions.
4. Abstain when the source is secondary-only, unavailable, unsupported, identity-mismatched, fabricated, or when facts/documents are incomplete for a high-risk outcome.
5. State source unavailability plainly when providers return documented gaps, HTTP 204, unsupported canton, robots policy, or historical manifest gaps.
6. Escalate to human review for all REVIEW_REQUIRED cases, all P2 debt effects, and all outputs intended for external/public reliance.
7. Treat deadlines, appeals, sanctions and procedural consequences as high-risk: cite exact law, date/version, notification assumptions and exceptions, or abstain.
8. Treat metadata_only as a degraded route. It may support discovery, but not final identity if it conflicts with another route.
9. Treat identity_mismatch as inconclusive until a full official identity check resolves the conflict.
10. Treat HTTP 204 and unsupported cantonal providers as source unavailability, not as legal absence of content.

## Release scopes

- PRIVATE_PERSONAL_BETA: calibration completed for personal use under this policy.
- PUBLIC_BETA: not completed; requires human review and empirical calibration against reviewer decisions.
- PUBLIC_STABLE_RELEASE: not completed; requires public-beta evidence, governance approval, and closure/acceptance of relevant P2 debts.
