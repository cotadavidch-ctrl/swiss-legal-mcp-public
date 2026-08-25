# Encryption At Rest

The project includes optional object encryption for sensitive local storage.

Implemented format:

- schema version;
- `AES-256-GCM`;
- key ID;
- nonce;
- ciphertext;
- authentication tag;
- creation time.

Keys are supplied externally. The ciphertext does not include key material.
