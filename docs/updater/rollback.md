# Update Rollback

Rollback restores the last backup and requires `--confirm`.

Automatic rollback is only used during a failed install before the new version is accepted. Accepted installations are not silently rolled back.

The local history records version, channel, release sequence, key ID, artifact hash, result and rollback status.
