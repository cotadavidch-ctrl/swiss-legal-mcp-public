# Human review package

This package prepares qualified legal review of `analyze_procedural_strategy`.

It contains five anonymized or synthetic controlled cases. Reviewers assess analysis quality; they do not assume responsibility for any underlying case.

Prepared cases:

- legal-aid-ar: caseHash a7b7b1f01c20dd8d20c051cfa007cff14f4e796ac774576f702f34b8c995f8a3, outputHash 88aa44624269393bab639a81190254ac72a43cd83d796fb32f059350f1106d2f
- cantonal-admin-controlled: caseHash 280995f2cee3c3fb1929737d1b7978e2f9406733f81f6443361e83507869d31a, outputHash 13ea29eaaf1f4dd151cba9848c0e9f72e856055cf6d34dfcf6a9d4510ec8e6b6
- social-insurance-controlled: caseHash 6c3ee43f59f39e25b27a3acbf2d8b43db9a7ab30933d0f762aff2a4de2a6b272, outputHash eeebc8e65f2359ad6f14def2977c1f912a36b9aa5c0f9e6b3061b99bc2487b15
- employment-controlled: caseHash 98c049df532ea379876b68bd7eb39186d7c155f07c66d2914f17cee4a3615062, outputHash aa9043dc506b3f35e23871ec002ea395142fcb94b4a3f71b0449dea8bb0fd1d6
- uncertain-deadline-controlled: caseHash ef88979d77076e3bded2ab6ea497ad77f3db991ead1008980ca24b6e3c5a9989, outputHash c897cb3309f67cd3a964a82a2e1ace614ac3c8d6cd170cbf000d0d9e5967cacb

Import completed reviews with:

```sh
pnpm review:procedural-strategy --import path/to/review.json
```
