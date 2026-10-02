# @gauzy/plugin-ever-stats-ui: Settings > Anonymous usage statistics

The settings page of `@gauzy/plugin-ever-stats`, at `/pages/settings/usage-statistics`.

- **The operator of the installation** (the API answers `GET /api/ever-stats/status`): the switch, why nothing is sent, the next report, the last attempt, *What is sent* (the report as it would be built now; nothing is stored or sent), *Last payload* (the exact bytes sent last time, with their size, date and HTTP status), *Send now*, and *Reset instance identity* behind a confirmation that says what it does. A warning is shown while `ENCRYPTION_KEY` is not set.
- **Everyone else**, and installations where the statistics module is not loaded (`EVER_STATS_ENABLED=false`): "Managed by the instance operator" with a link to the published schema. Never a payload: the report covers every tenant of the installation.

The menu entry appears under Settings for accounts with the tenant settings permission; what the page shows is decided by the API. Strings are in `src/i18n/en.json` (namespace `EVER_STATS`).

See `packages/plugins/ever-stats/README.md` for what is sent and how to switch it off.
