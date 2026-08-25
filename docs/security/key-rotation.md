# Key Rotation

Encrypted objects include `keyId`. Rotation reads with the old key and writes a new object with a new key ID.

Interrupted rotation must keep the previous object readable until replacement is complete. Tests cover object re-encryption and authentication failure.
