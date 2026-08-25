# Key Management

Preferred storage for local encryption keys is the operating-system secret store such as macOS Keychain. Environment managers or KMS/HSM are appropriate for remote deployments.

The repository does not contain real signing secrets or local encryption keys.

Separate keys by purpose: local storage, update verification, HTTP tokens, backups and temporary encrypted data.
