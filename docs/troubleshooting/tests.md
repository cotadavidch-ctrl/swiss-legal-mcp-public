# Test Troubleshooting

`listen EPERM` under sandboxed execution is an environment restriction, not a project failure. Run local HTTP/shutdown tests outside the sandbox when validating the full suite.

Known Fase 7 stabilization record:

- Initial sandboxed run failed 16 tests because Supertest and spawned HTTP tests could not bind `0.0.0.0`.
- Unsandboxed full run initially showed one intermittent stdio shutdown assertion where the child exit code was `null`.
- Re-running the focused shutdown test passed 2/2, and the full unsandboxed suite passed 502/502 executed tests.

The shutdown tests keep specific 60 second per-test timeouts because their goal is graceful signal handling under real process startup, not unit-level latency.
