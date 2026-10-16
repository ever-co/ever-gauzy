# Ever Works integration contract v1 — test fixtures

Copied unchanged from ever-works `develop` (`50677f3b1`, contract `v1-draft.1`, merged in ever-works#2604),
`docs/specs/features/integrations-api-v1/contract/`:

| Here | There |
| --- | --- |
| `webhook-signature-vectors.test.json` | `webhook-signature-vectors.json` |
| `whoami.test.json` | `examples/whoami.json` |
| `events-page.test.json` | `examples/events-page.json` |
| `task.updated.test.json` | `examples/events/task.updated.json` |
| `error.version_mismatch.test.json` | `examples/error.version_mismatch.json` |
| `error.transition_blocked.test.json` | `examples/error.transition_blocked.json` |

They carry the `.test.json` suffix because they are test data: the egress audit's static scan does not count the
Ever Works and Gauzy addresses inside them as product code. Refresh them by copying the files again when the
contract version changes; never edit them by hand.
