# Task Breakdown: Chat administration and client capabilities

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `chat-administration-and-clients`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the chat flags (and `GAUZY_CHAT_SHARED_CHANNELS_ENABLED` for shared channels): the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths starting with `chat/`, `chat-ui/`, `docs/`, `inbox/` or `realtime/` are under `packages/plugins/`; a bare
  `services/…` or `link-preview/…` path is under `packages/plugins/chat/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/chat-admin.model.ts` (plan §3), permission keys as contributions in `chat/src/lib/chat.permissions.ts` (`defaultFor` of plan §9), setting keys in `chat/src/lib/chat.settings.ts`, error codes; exported from `index.ts`. Test: `chat-admin.model.spec.ts`; contribution catalogue spec; settings declaration spec (types, defaults, scope).
- [ ] **T2**. Shared-channel switch `chat/src/lib/chat-shared-enabled.ts` (exactly `true`) and `.env.sample`. Test: `chat-shared-enabled.spec.ts`.
- [ ] **T3**. Entity changes (`chat-conversation`, `chat-member`, `chat-message`) and the six new entities with repositories, added to `CHAT_ENTITIES`. Files: `chat/src/lib/entities/{chat-conversation,chat-member,chat-message}.entity.ts`, `chat/src/lib/entities/{chat-guest-access,chat-shared-channel-link,chat-message-copy,chat-dlp-rule,chat-dlp-match,chat-usage-daily}.entity.ts`, `chat/src/lib/entities/chat.repositories.ts`, `chat/src/lib/entities/index.ts`, `chat/src/lib/chat.plugin.ts`. Test: registration spec on both ORMs.
- [ ] **T4**. Migrations `1791000067800-AddChatAdministrationColumns` and `1791000067810-CreateChatAdministrationTables`. Files: `chat/src/lib/database/migrations/1791000067800-AddChatAdministrationColumns.ts`, `chat/src/lib/database/migrations/1791000067810-CreateChatAdministrationTables.ts`, `chat/src/lib/database/chat-migrations.ts`. Test: SQLite up twice no-op; dialect spec. Migration timestamps: `1791000067800` to `1791000067899` (`packages/plugins/chat`).
- [ ] **T5** (parallel). Default grants through the contribution reload (plan §9; no seed migration): `CHAT_CHANNEL_CREATE_*` to every role holding `CHAT_SEND`. Files: `chat/src/lib/chat.permissions.ts`. Test: creation keys follow `CHAT_SEND` holders; nothing changes for an existing tenant; a second boot inserts nothing.

## Phase 2 — Services, endpoints, events

- [ ] **T6**. Rule engine `services/chat-rules.service.ts` (spec §3.3 matrix) called by `ChatAccessService`; `GET /conversations/:id/rights`. Files: `services/chat-rules.service.ts`, `services/chat-access.service.ts`, `chat/src/lib/controllers/chat-conversation.controller.ts`. Test: generated truth-table spec over person kinds, roles, kinds and policies; existing access specs unchanged; a `CHAT_MANAGE` holder reads a channel without joining, as today.
- [ ] **T7**. Settings: `services/chat-settings.service.ts` reading and writing the `chat.*` keys through `PluginSettingRegistry` and the platform settings store, `GET|PATCH /settings`, audit events with before and after through `AUDIT_EVENT_SINK` (activity log fallback), `chat_settings.changed`. Files: `services/chat-settings.service.ts`, `chat/src/lib/controllers/chat-settings.controller.ts`, `chat/src/lib/dto/chat-admin.dto.ts`. Test: client-relevant keys readable by members only; history recorded; a missing value answers the declared default.
- [ ] **T8**. Link preview block list enforced in `link-preview/chat-link-preview.service.ts` and shipped in the settings answer. Test: blocked subdomain never fetched.
- [ ] **T9**. Set-up checklist and help items: register checklist `chat.setup` (`ownerPlugin = chat`, steps completed by chat events or by hand) and chat's help items through `ADMIN_CHECKLISTS` of `platform-administration`. Files: `chat/src/lib/admin/chat-setup.checklist.ts`, `chat/src/lib/admin/chat-help-items.ts`, `chat/src/lib/chat.module.ts`. Test: once per organization; skip; a created team channel ticks its step.
- [ ] **T10**. Chat users lifecycle: permission removal ending live delivery at once; with `members.followDeactivation` on, consumers of employee deactivation and organization leave ending memberships and live delivery, and reactivation restore. Files: `services/chat-user-lifecycle.service.ts`, `chat/src/lib/realtime/chat-realtime-audience.ts`, `services/chat-access.service.ts`. Test: events stop at once; restore skips deleted channels; with the setting off a deactivation leaves every membership as it was.
- [ ] **T11**. People administration routes with access preview and apply; invitation channels via the core `invite` DTO field and acceptance consumer. Files: `chat/src/lib/controllers/chat-admin-people.controller.ts`, `services/chat-admin-people.service.ts`, `services/chat-invite-acceptance.service.ts`, `chat/src/lib/dto/chat-admin.dto.ts`, `packages/core/src/lib/invite/dto/create-invite.dto.ts`. Test: diff preview equals the applied change.
- [ ] **T12**. Channel browser, bulk actions, admin join announcement, move between organizations. Files: `chat/src/lib/controllers/chat-admin-channels.controller.ts`, `services/chat-admin-channels.service.ts`, `services/chat-channel-move.service.ts`. Test: no content in answers; move keeps id and threads; clash refused.
- [ ] **T13**. Retention: the kinds `chat.channel`, `chat.group`, `chat.direct` declared through `RETENTION_SOURCES` (default keep forever) with chat's purge handler, channel periods within the bounds settings, dry run, `chat.retention.run` only where the access feature is not loaded, hold check in the transaction, a `job_execution` row per run with report and cursor in its metadata, drive trash for files. Files: `chat/src/lib/retention/chat-retention.sources.ts`, `chat/src/lib/retention/chat-retention.handler.ts`, `chat/src/lib/retention/chat-retention.scheduler.ts`, `chat/src/lib/controllers/chat-retention.controller.ts`. Test: held messages kept; resumable after a simulated crash; report counts equal deletions; one live run per organization.
- [ ] **T14**. Legal holds as hold register rows: routes creating and releasing `privacy_legal_hold` entries for conversations, people and periods, `CHAT_LEGAL_HOLDS` bound to the register, `heldDeletedAt` on user deletion, revisions forced while held. Files: `chat/src/lib/retention/chat-legal-holds.service.ts`, `chat/src/lib/controllers/chat-holds.controller.ts`, `services/chat-message.service.ts`, `apps/api/src/plugin-composition.ts`. Test: held delete hidden yet exported; release lifts; a hold on the person placed elsewhere also holds their chat messages.
- [ ] **T15**. Compliance exports as data-export runs (`targetKey = chat.compliance`): filters, four-eyes (run unstarted until approved), chat's archive writer streaming JSON lines and HTML into a zip, 7-day link from the run, audit. Files: `chat/src/lib/compliance/chat-compliance-export.service.ts`, `chat/src/lib/compliance/chat-archive.writer.ts`, `chat/src/lib/controllers/chat-exports.controller.ts`. Test: direct conversations only with a named member; held deletions and revisions included; an unapproved run never starts.
- [ ] **T16**. Privacy registry declaration (`PRIVACY_DATA_REGISTRY`): copy and erasure handlers per setting. Files: `chat/src/lib/compliance/chat-privacy.registry.ts`, `chat/src/lib/chat.module.ts`. Test: erasure keeps or deletes messages by setting; held items untouched.
- [ ] **T17**. Data-loss rules: detectors (check digits, token entropy, country identifiers through the regional packs port, custom patterns), send-path enforcement for people, bots, agents and webhooks, `POST /dlp/check`, matches without text. Files: `chat/src/lib/dlp/chat-dlp.detectors.ts`, `chat/src/lib/dlp/chat-dlp.service.ts`, `chat/src/lib/controllers/chat-dlp.controller.ts`, `services/chat-message.service.ts`, `chat/src/lib/webhooks/chat-app-message.writer.ts`. Test: warn, block and mask; Luhn and mod-97 cases; send-anyway reason stored.
- [ ] **T18**. Guests: core `invite` rows (guest role through `ACCESS_USER_TYPES`, contact through `invite_organization_contact`) with `chat_guest_access`, acceptance through the invite flow, rule-engine limits, domain list, channel policy, `chat.guests.expiry` over `accessUntil`. Files: `chat/src/lib/guests/chat-guest.service.ts`, `chat/src/lib/guests/chat-guests-expiry.scheduler.ts`, `chat/src/lib/controllers/chat-guests.controller.ts`, `services/chat-rules.service.ts`. Test: guest cannot browse or open other direct conversations; expiry warning and end; the invitation shows in the organization's invitations.
- [ ] **T19**. Calls over meeting rooms: the conversation's `CHAT` room and its sessions through `MEETING_ROOMS`, call routes, the call card as a message with a call `systemEvent` (room and session ids) whose id the session keeps, ringing push kind, `chat.calls` consumer posting artefacts and action items. Files: `chat/src/lib/calls/chat-call.service.ts`, `chat/src/lib/calls/chat-calls.consumer.ts`, `chat/src/lib/controllers/chat-calls.controller.ts`. Test: second start refused with `CHAT_CALL_LIVE` from the room's live session; artefacts only to readers.
- [ ] **T20**. Client capabilities: `POST /share-in`, `GET /messages/:id/share-out`, `GET /sync` with tombstones and resync, offline time rule, `GET /client-status` with minimum versions and maintenance, `CLIENT_TOO_OLD` guard. Files: `chat/src/lib/controllers/chat-client.controller.ts`, `services/chat-sync.service.ts`, `services/chat-share.service.ts`, `chat/src/lib/client/client-version.guard.ts`. Test: deletions in the delta; old cursor resync; outdated client refused writes.
- [ ] **T21** (parallel). Media: range and validator support on the Documents hub download route, `GET /files/:documentId/url` signed addresses. Files: `docs/src/lib/controllers/document-upload.controller.ts`, `docs/src/lib/services/document-signed-url.service.ts`, `chat/src/lib/controllers/chat-file-url.controller.ts`. Test: partial content answers; expired signature refused.
- [ ] **T22** (parallel). Push: `collapseKey`, kinds and silent clear through `PUSH_DEVICES` in `packages/plugins/inbox/src/lib/delivery/push/` over the existing `inbox_push_subscription` (browsers) and the communications devices (phones, desktop apps); clear on read consumer. Files: `inbox/src/lib/delivery/push/inbox-delivery-pusher.ts`, `inbox/src/lib/delivery/push/inbox-push.constants.ts`, `services/chat-notifier.service.ts`. Test: grouped sends; clear after a read on another device; the existing browser push opt-in unchanged.
- [ ] **T23**. Realtime: client kind on token connections and in `/api/realtime/status`, re-check cadence unchanged. Files: `realtime/src/lib/realtime.controller.ts`, `realtime/src/lib/realtime-audience.ts`. Test: token connection without a browser origin receives chat events.
- [ ] **T24**. Import as the chat profile `chat.archive` of the data-import engine (`registerImportProfiles`): upload, archive reader (`unzipper`), mapping step, dry run, run with one engine row per item keyed by outside ids, files through the egress guard, no notifications, undo within 7 days through the engine, report; core `import-history` and `import-record` with a core operation where the engine is absent. Files: `chat/src/lib/import/chat-archive.import-profile.ts`, `chat/src/lib/import/chat-archive.reader.ts`, `chat/src/lib/controllers/chat-imports.controller.ts`, `chat/src/lib/import/fixtures/`. Test: sample archive fixture; re-run creates nothing; undo removes only created items.
- [ ] **T25**. Usage aggregation `chat.usage.aggregate`, `GET /analytics`, `GET /health` (no text). Files: `chat/src/lib/analytics/chat-usage.aggregator.ts`, `chat/src/lib/analytics/chat-usage-aggregate.scheduler.ts`, `chat/src/lib/controllers/chat-analytics.controller.ts`. Test: aggregates equal raw counts on fixtures; private conversations only in totals.
- [ ] **T26**. Shared channels: invitation codes, accept, `chat.shared.copy` consumer in partner context with versions, pause and disconnect, external author display. Files: `chat/src/lib/shared/chat-shared-channel.service.ts`, `chat/src/lib/shared/chat-shared-copy.consumer.ts`, `chat/src/lib/controllers/chat-shared.controller.ts`. Test: post, edit, delete copied both ways; disconnect keeps copies; no cross-tenant read in the code path (spec asserts repository calls carry the partner tenant).
- [ ] **T43**. Audit of administrative acts (spec FR-24): channel creation, rename, visibility, policy, archive, delete, restore and move; member additions, removals and role changes; administrators joining private channels; guest invitations and removals; bot and token changes; exports, holds, retention runs and imports, each sent through `AUDIT_EVENT_SINK` with actor, time and before and after (activity log where the access feature is not loaded); message edits and deletions as events without their text. Files: `services/chat-audit.service.ts`, `services/chat-conversation.service.ts`, `services/chat-message.service.ts`. Test: one audit event per act with before and after; message events carry no text; falls back to the activity log when the sink is unbound.
- [ ] **T44**. Sign-in of native clients (spec FR-27): chat routes and realtime token connections accept access tokens issued to the platform's native-client applications (proof key flow of `access-control-and-security`) beside today's sign-in, and a revoked session loses chat routes and live delivery at once. Files: `services/chat-access.service.ts`, `realtime/src/lib/realtime-audience.ts`. Test: a native-client token reads and posts; after revoking its session the next call is refused and the live connection is closed at the next re-check.
- [ ] **T45**. Content safety on the new write paths (spec FR-28): share-in, imported messages, shared-channel copies and call cards pass through the existing sanitiser, unsafe-scheme links are dropped from text and cards, every outbound fetch goes through the egress guard (`chat/src/lib/egress/egress-guard.ts`) and uploads are checked by content. Files: `services/chat-share.service.ts`, `chat/src/lib/import/chat-archive.import-profile.ts`, `chat/src/lib/shared/chat-shared-copy.consumer.ts`, `chat/src/lib/calls/chat-call.service.ts`. Test: a `javascript:` link and a script tag are removed on each path; a file whose content does not match its type is refused; an archive file address outside the egress rules is not fetched.

## Phase 3 — UI surfaces

- [ ] **T27**. Settings → Chat pages (General, Channels, Messages, Files and previews) over the platform settings store, and the platform checklist card fed with `chat.setup`. Files: `chat-ui/src/lib/settings/chat-settings-page.component.ts`, `chat-ui/src/lib/settings/chat-settings-sections.ts`, `chat-ui/src/lib/services/chat-settings.service.ts`, `chat-ui/src/lib/chat-ui.plugin.ts`. Test: changes saved and reflected in the create action.
- [ ] **T28**. People administration and access diff dialog; channel browser with filters and bulk actions; move dialog. Files: `chat-ui/src/lib/settings/chat-people-admin-page.component.ts`, `chat-ui/src/lib/settings/chat-channel-browser-page.component.ts`, `chat-ui/src/lib/dialogs/chat-access-diff-dialog.component.ts`, `chat-ui/src/lib/dialogs/chat-move-channel-dialog.component.ts`. Test: diff dialog lists additions and removals.
- [ ] **T29**. Every chat client action reads the rights route (create, add, remove, pin, delete, export, call). Files: `chat-ui/src/lib/services/chat-rights.service.ts`, `chat-ui/src/lib/components/conversation-view/conversation-view.component.ts`, `chat-ui/src/lib/components/message-item/message-item.component.ts`, `chat-ui/src/lib/components/conversation-list/conversation-list.component.ts`. Test: buttons follow rights for a guest, a member and a manager.
- [ ] **T30**. Retention and holds pages (chat view of the platform policies and hold register) with dry run and deletion reports from `job_execution`; exports page over the export runs with approval. Files: `chat-ui/src/lib/settings/chat-retention-page.component.ts`, `chat-ui/src/lib/settings/chat-holds-page.component.ts`, `chat-ui/src/lib/settings/chat-exports-page.component.ts`. Test: report rendering; approval flow.
- [ ] **T31**. Data-loss rules page and composer warning with "send anyway" and reason. Files: `chat-ui/src/lib/settings/chat-dlp-rules-page.component.ts`, `chat-ui/src/lib/components/message-composer/message-composer.component.ts`. Test: warning shown before send; block message.
- [ ] **T32**. Guests: invitation dialog, guest badges and channel banner. Files: `chat-ui/src/lib/dialogs/chat-guest-invite-dialog.component.ts`, `chat-ui/src/lib/components/guest-badge/guest-badge.component.ts`, `chat-ui/src/lib/components/conversation-view/conversation-view.component.ts`. Test: badge everywhere a guest name appears.
- [ ] **T33**. Calls: header button, call card, ringing toast, artefact thread. Files: `chat-ui/src/lib/components/call-button/call-button.component.ts`, `chat-ui/src/lib/components/call-card/call-card.component.ts`, `chat-ui/src/lib/components/call-ringing-toast/call-ringing-toast.component.ts`. Test: card states live and ended.
- [ ] **T34**. Installable app on the existing pieces: icons, shortcuts and `share_target` added to `apps/gauzy/src/manifest.json`; the production worker registration loads an extension script importing `ngsw-worker.js` with the share-target handler (the `ngsw-config*.json` caching unchanged); badge on push in `assets/inbox-push-sw.js`; `/pages/chat/share` route, "reload to update", offline, maintenance and outdated banners. Test: manifest validation spec; only one worker controls the root scope; share route posts once.
- [ ] **T35**. Virtualised message list in `conversation-view` and `thread-pane`; chat help items in the platform's help panel. Files: `chat-ui/src/lib/components/conversation-view/conversation-view.component.ts`, `chat-ui/src/lib/components/thread-pane/thread-pane.component.ts`, `chat-ui/src/lib/chat-ui.plugin.ts`. Test: 10,000-message fixture renders a window only.
- [ ] **T36**. Import wizard (upload, chat mapping step, then the data-import run views for dry run, progress, report and undo). Files: `chat-ui/src/lib/settings/chat-import-wizard.component.ts`, `chat-ui/src/lib/settings/chat-import-mapping-step.component.ts`. Test: mapping step with unmatched people.
- [ ] **T37**. Analytics and health pages; shared channel connect and accept dialogs. Files: `chat-ui/src/lib/settings/chat-analytics-page.component.ts`, `chat-ui/src/lib/settings/chat-health-page.component.ts`, `chat-ui/src/lib/dialogs/chat-shared-channel-dialogs.component.ts`. Test: counts only; partner badge.
- [ ] **T38**. i18n keys in `chat-ui/src/i18n/*.json` for every new string and right-to-left checks. Test: key parity spec; right-to-left snapshot.
- [ ] **T46**. Organization identity in chat (spec FR-10): the chat header and the organization switcher show the organization's name, logo and description read from its existing record; chat stores none of them. Files: `chat-ui/src/lib/components/chat-page/chat-page.component.ts`, `chat-ui/src/lib/components/conversation-list/conversation-list.component.ts`. Test: header and switcher render the organization store's name and logo and follow a rename without reload; no chat entity gains an organization name column.
- [ ] **T47**. Meeting links (spec FR-32): a link to a platform meeting room renders as a call card with join; a link to an outside meeting service gets a "meeting link" label on its preview; "schedule a meeting" in a conversation opens the calendar with the conversation's members invited. Files: `link-preview/link-preview-parser.ts`, `chat-ui/src/lib/components/link-cards/link-cards.component.ts`, `chat-ui/src/lib/components/conversation-view/conversation-view.component.ts`. Test: room link shows a call card; outside link shows the label; schedule action opens the calendar with every member as attendee.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T39**. MCP `chat:admin` scope and tools of plan §7. Files: `packages/mcp-server/src/lib/tools/collaboration/scopes.ts`, `packages/mcp-server/src/lib/tools/collaboration/chat-admin.ts`. Test: unscoped calls not found; retention apply needs a preview token.
- [ ] **T40**. Report definitions of spec FR-55 registered with the report registry when loaded. Files: `chat/src/lib/reports/chat-report.definitions.ts`, `chat/src/lib/chat.module.ts`. Test: figures match the tables.
- [ ] **T41**. Import format documentation (platform JSON lines) and administrator guide on the docs site; OpenAPI regenerated; SDK regeneration noted; `chat/README.md` and `chat-ui/README.md` updated. Test: OpenAPI diff is additive; docs build.
- [ ] **T42**. Defaults equal today's behaviour (spec FR-57): every `chat.settings.ts` default and channel policy reproduces today's rules; an organization with no value set behaves as before. Test: the existing chat test suites run with this feature's settings unset and pass unchanged; no minimum client version is set by default.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and what stays | T5, T6, T42 |
| FR-2 | §3.1 Scope and what stays | T2, T18, T19 |
| FR-3 | §3.2 Organization settings and administration | T7, T27 |
| FR-4 | §3.2 Organization settings and administration | T8 |
| FR-5 | §3.2 Organization settings and administration | T9, T27 |
| FR-6 | §3.2 Organization settings and administration | T10 |
| FR-7 | §3.2 Organization settings and administration | T11, T28 |
| FR-8 | §3.2 Organization settings and administration | T11 |
| FR-9 | §3.2 Organization settings and administration | T10 |
| FR-10 | §3.2 Organization settings and administration | T46 |
| FR-11–FR-12 | §3.2 Organization settings and administration | T12, T28 |
| FR-13 | §3.3 Roles and rules | T1, T5 |
| FR-14 | §3.3 Roles and rules | T6 |
| FR-15 | §3.3 Roles and rules | T6, T29 |
| FR-16 | §3.4 Guests and shared channels | T18, T32 |
| FR-17 | §3.4 Guests and shared channels | T18, T32 |
| FR-18 | §3.4 Guests and shared channels | T18 |
| FR-19 | §3.4 Guests and shared channels | T26, T37 |
| FR-20–FR-21 | §3.5 Retention, legal holds, export, audit and privacy | T13, T30 |
| FR-22 | §3.5 Retention, legal holds, export, audit and privacy | T14, T30 |
| FR-23 | §3.5 Retention, legal holds, export, audit and privacy | T15, T30 |
| FR-24 | §3.5 Retention, legal holds, export, audit and privacy | T7, T43 |
| FR-25 | §3.5 Retention, legal holds, export, audit and privacy | T16 |
| FR-26 | §3.5 Retention, legal holds, export, audit and privacy | T17, T31 |
| FR-27 | §3.6 Sign-in and content safety | T44 |
| FR-28 | §3.6 Sign-in and content safety | T45 |
| FR-29–FR-31 | §3.7 Calls and quick calls | T19, T33 |
| FR-32 | §3.7 Calls and quick calls | T47 |
| FR-33 | §3.8 Client capabilities | T34 |
| FR-34–FR-35 | §3.8 Client capabilities | T20 |
| FR-36 | §3.8 Client capabilities | T22 |
| FR-37 | §3.8 Client capabilities | T20 |
| FR-38 | §3.8 Client capabilities | T20 |
| FR-39 | §3.8 Client capabilities | T23 |
| FR-40 | §3.8 Client capabilities | T21 |
| FR-41 | §3.8 Client capabilities | T20, T34 |
| FR-42 | §3.8 Client capabilities | T20, T23 |
| FR-43 | §3.8 Client capabilities | T34 |
| FR-44 | §3.8 Client capabilities | T20, T22, T23 |
| FR-45 | §3.8 Client capabilities | T9, T35 |
| FR-46 | §3.8 Client capabilities | T38 |
| FR-47 | §3.8 Client capabilities | T25 |
| FR-48 | §3.8 Client capabilities | T35 |
| FR-49 | §3.9 Import | T24, T36 |
| FR-50 | §3.9 Import | T24, T36 |
| FR-51 | §3.9 Import | T24 |
| FR-52 | §3.9 Import | T4 |
| FR-53 | §3.10 Analytics, health and reports | T25, T37 |
| FR-54 | §3.10 Analytics, health and reports | T25, T37 |
| FR-55 | §3.10 Analytics, health and reports | T40 |
| FR-56 | §3.10 Analytics, health and reports | T39 |
| FR-57 | §3.11 Defaults | T42 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Chat flags and the shared-channel switch stay off by default; enabling them in dev shows each phase end to end.
- Existing chat permission, access and realtime tests pass unchanged; the rule engine's truth table covers every action of the three chat specs.
- Constitution gates in `spec.md` §9 confirmed; every acceptance criterion of `spec.md` §7 demonstrated.
