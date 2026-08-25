# Document Prompt Injection

Legal documents and provider responses are untrusted source content.

The system treats extracted text as data, not instructions. Suspicious patterns include requests to ignore policy, execute commands, exfiltrate data, hidden HTML comments, tracking URLs and invisible text.

Content should be labelled `untrusted_source_content` when passed to model-facing consumers.
