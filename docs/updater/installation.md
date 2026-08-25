# Update Installation

Installation is manual and requires `--confirm`.

The updater downloads to a private state directory, verifies the artifact, stages files in a temporary directory, rejects path traversal and symlink output, creates a backup, then swaps the installation directory.

The implemented artifact format is data-only JSON. It does not run commands, scripts or package hooks.
