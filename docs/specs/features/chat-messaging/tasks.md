# Task Breakdown: Chat messaging

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `chat-messaging`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind the chat flags (and `GAUZY_CHAT_AI_ENABLED` for phase 5): the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Paths starting with `chat/` or `chat-ui/` are under `packages/plugins/`; a bare `services/…`, `controllers/…`,
  `link-preview/…`, `realtime/…` or `graphql/…` path is under `packages/plugins/chat/src/lib/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts in `packages/contracts/src/lib/chat.model.ts`: new enums, fields, inputs, pages, event names and error codes of plan §3; exported from `index.ts`; `IChatUiPreferences` and `IChatPlacesUiPreferences` in `user.model.ts`; `unreadEmailDelayMinutes` and `dndDuringMeetings` in `employee-notification-setting.model.ts`; `ChatReply`, `ChatQuote`, `ChatReaction` in `EmployeeNotificationTypeEnum` with their stored values in `employee-notification-type-transform.ts`. Test: `chat.model.spec.ts` (existing enum values unchanged, new ones present); the type transform spec keeps every existing stored value.
- [ ] **T2**. AI switch `packages/plugins/chat/src/lib/chat-ai-enabled.ts` (exactly `true`, warn once otherwise) and `.env.sample` entry. Test: `chat-ai-enabled.spec.ts`.
- [ ] **T3**. Entity changes in `chat/src/lib/entities/chat-conversation.entity.ts`, `chat-member.entity.ts`, `chat-message.entity.ts`, `chat-category.entity.ts`, `chat-attachment-draft.entity.ts` (plan §3 columns), and the presence columns in `packages/plugins/realtime/src/lib/realtime.entities.ts`. Test: entity registration specs of both plugins list the columns on both ORMs.
- [ ] **T4**. New entities and MikroORM repositories (`chat-message-revision`, `chat-draft`, `chat-scheduled-message`, `chat-message-link`, `chat-reaction-notice`, `chat-translation`, `chat-digest`) in `chat/src/lib/entities/` and `chat.repositories.ts`, added to `CHAT_ENTITIES`. Test: registration spec.
- [ ] **T5** (parallel). Chat hosts on the core polls and custom emoji of [`discussions`](../discussions/spec.md) T42 and T43: `@PollHostAccessPolicy()` for chat messages in `packages/plugins/chat/src/lib/polls/`; nothing of those modules is built here. Test: a channel member votes on a message poll; a non-member is refused. Migration timestamps: `1791000067100` to `1791000067199` (`packages/plugins/chat`); `1791000067200` to `1791000067299` (`packages/plugins/realtime`).
- [ ] **T6**. Migration `1791000067100-AddChatMessagingColumns` with the `nameKey` column (filled per organization only when it switches `channels.uniqueNames` on: oldest first, duplicates left null), default channel `everyone`, and the `chat_category` and `chat_attachment_draft` columns; realtime migration `1791000067200-AddRealtimePresenceStatusColumns`. Files: `chat/src/lib/database/migrations/1791000067100-AddChatMessagingColumns.ts`, `chat/src/lib/database/chat-migrations.ts`, `packages/plugins/realtime/src/lib/database/migrations/1791000067200-AddRealtimePresenceStatusColumns.ts`. Test: migration specs on SQLite with duplicate names; up twice is a no-op; existing categories keep `userId` null.
- [ ] **T7** (parallel). Migration `1791000067110-CreateChatMessagingTables` (the seven tables of plan §3). Files: `chat/src/lib/database/migrations/1791000067110-CreateChatMessagingTables.ts`. Test: tables and unique keys on SQLite; MySQL and PostgreSQL branches in the dialect spec.
- [ ] **T8** (parallel). Migration `1791000067120-AddChatSearchAttributes` and the search declaration version bump in `chat.constants.ts`. Files: `chat/src/lib/database/migrations/1791000067120-AddChatSearchAttributes.ts`, `chat/src/lib/chat.constants.ts`. Test: declaration spec lists the attributes.

## Phase 2 — Services, endpoints, events

- [ ] **T9**. Preferences and last place in the platform user preferences: the `chat` and `chatPlaces` keys of `User.uiPreferences` through the existing `PUT /user/ui-preferences` and `GET /user/me`, defaults in `chat-ui/src/lib/preferences/chat-preferences.ts`, last place written by the clients on conversation open, time format from `User.timeFormat`; no chat route or table. Test: writing `chatPlaces` leaves `chat` and every other feature key unchanged; defaults applied when a key is missing.
- [ ] **T10**. Organization totals: `GET /organizations/states` in `chat-conversation.controller.ts`, reading memberships across the caller's organizations. Test: two-organization spec, no foreign organization leaks.
- [ ] **T11**. Personal sections on `chat_category`: `userId` and `sort` in the existing category service and `/categories` routes (personal rows need `CHAT_VIEW`, organization rows keep `CHAT_MANAGE`), `PUT /conversations/:id/category/me` writing `chat_member.personalCategoryId`, personal categories ordered above the organization's. Files: `services/chat-conversation.service.ts`, `controllers/chat-conversation.controller.ts`, `chat/src/lib/dto/chat-messaging.dto.ts`. Test: unique names per person, one section per conversation, reorder, another person never sees them; existing category specs unchanged.
- [ ] **T12**. Channel modes and policies: `chat-conversation.service.ts` (everyone mode, announcement posting, broadcast, pin and member-add policies, description); posting checks in `chat-message.service.ts` (`CHAT_POSTING_RESTRICTED`). Test: rule-matrix spec per role and policy.
- [ ] **T13**. Name uniqueness behind `channels.uniqueNames` (default off): `nameKey` fill on switch-on and maintenance on create, rename, archive, unarchive, delete, restore, with the key handed to the oldest open duplicate when its holder closes or is renamed (plan §3 Backfill); `CHAT_CHANNEL_NAME_TAKEN`. Files: `services/chat-channel-name.service.ts`, `services/chat-conversation.service.ts`. Test: with the setting off a duplicate name is accepted as today; with it on, concurrent creates (unique index decides), unarchive into a clash refused; with two existing `Release` channels, deleting the keyed one moves the key to the other and a new `Release` is refused, and after both are closed a new `Release` is accepted.
- [ ] **T14**. System events: `services/chat-system-events.ts` writing `kind: system` messages with `systemEvent` for each FR-31 type, excluded from counters, notices and last activity. Test: counters unchanged spec, combined "added" text.
- [ ] **T15**. Managers and succession: promote and demote routes; succession on leave, removal and deactivation (`chat.membership.sync` consumer) only where `members.managerSuccession` is on. Files: `services/chat-managers.service.ts`, `controllers/chat-conversation.controller.ts`, `chat/src/lib/membership/chat-membership-sync.consumer.ts`. Test: last manager leaves, deactivation; with the setting off nobody is promoted.
- [ ] **T16**. Delete and restore: `DELETE /conversations/:id`, `POST /restore`, `purgeAfter`, `CHAT_LEGAL_HOLDS` port check (bound to the hold register of `access-control-and-security`; inert when unbound). Files: `services/chat-conversation-delete.service.ts`, `controllers/chat-conversation.controller.ts`, `chat/src/lib/maintenance/chat-purge.worker.ts`, `chat/src/lib/maintenance/chat-purge.scheduler.ts`. Test: hidden at once, restore, purge cascade incl. polls, scheduled messages and pending reminders on its messages.
- [ ] **T17**. Membership sync: everyone channels on hire, team and department "keep a channel" sync (`syncSource`), synced flag. Files: `chat/src/lib/membership/chat-membership-sync.consumer.ts`, `chat/src/lib/membership/chat-everyone-channels.ts`, `chat/src/lib/membership/chat-team-channel-sync.ts`. Test: hire, transfer, removal from team.
- [ ] **T18** (parallel). Record link on channels and `GET /conversations/:id/links`, `/threads`; notes conversation `POST /notes`. Files: `services/chat-record-link.service.ts`, `services/chat-notes.service.ts`, `controllers/chat-conversation.controller.ts`. Test: link per record type, notes never notifies.
- [ ] **T19**. People profile route `GET /people/:employeeId/profile` (job title, department, teams, local time, time off, shared conversations and files filtered to the caller). Files: `services/chat-people-profile.service.ts`, `controllers/chat-conversation.controller.ts`. Test: fields hidden when the viewer may not see them.
- [ ] **T20**. Quote and forward: quote snapshot on `replyToId`, `POST /messages/:id/forward` with per-target results and file links. Files: `services/chat-forward.service.ts`, `services/chat-message.service.ts`, `controllers/chat-message.controller.ts`. Test: original deleted keeps quote; one failing target.
- [ ] **T21**. Revisions and edit window: `chat_message_revision` writes in `edit`, `GET /messages/:id/revisions`, `CHAT_EDIT_WINDOW_PASSED`; delete-batch route. Files: `services/chat-message.service.ts`, `controllers/chat-message.controller.ts`. Test: concurrent edits keep both bodies; batch per-row results.
- [ ] **T22**. Drafts: `services/chat-draft.service.ts`, routes, `chat_draft.changed` event, clean on send; place keys of `draftKeyOf`; attachment drafts held through `chat_attachment_draft.draftId` and skipped by the upload sweep in `chat-draft-uploads.ts`. Test: one row per place, cleared on send, 50-row cap; a held upload survives the 24 h sweep and is released on send.
- [ ] **T23**. Message flags and links: `silent`, `urgent`, `previewHidden`, `chat_message_link` extraction at send and edit with `urlHash` from `previewUrlHash(normalizePreviewUrl(…))` of `link-preview/link-preview-url.ts`, title and site joined from `chat_link_preview`, block list check before preview fetch in `link-preview/chat-link-preview.service.ts`. Test: silent sends no notification; blocked host never fetched; a link with a cached preview gets its title without a fetch.
- [ ] **T24**. Mentions: `@team` token in `chat-mentions.ts`, broadcast policy, thread auto-follow for repliers and mentioned people. Test: team members outside the conversation not notified.
- [ ] **T25**. Polls host: `@PollHostAccessPolicy()` for `ChatMessage`, `POST /conversations/:id/polls`, `poll.*` → `chat_message.updated` mapping, "poll closed" system event, CSV export. Files: `chat/src/lib/polls/chat-poll-host.policy.ts`, `chat/src/lib/polls/chat-poll.service.ts`, `controllers/chat-conversation.controller.ts`. Test: anonymous ballots unreadable, concurrent votes, closed refusal.
- [ ] **T26**. Saved messages over core favourites: `POST|DELETE /messages/:id/save`, `GET /saved`. Files: `services/chat-saved.service.ts`, `controllers/chat-message.controller.ts`. Test: lost membership hides the item.
- [ ] **T27**. Read receipts: `GET /messages/:id/readers` from read positions, member cap, two-way hide. Files: `services/chat-read-receipts.service.ts`, `controllers/chat-message.controller.ts`. Test: hidden reader cannot see others; anonymous poll refused.
- [ ] **T28**. Reminders on the platform reminders: register `ChatMessage` in the core record type registry (read check, snippet as title, permalink) for the `reminder` sweep of `automation-and-notifications`; the message menu and the Saved page call `/api/reminders` of the reminder core of `automation-and-notifications` T60; without it the Remind action is hidden. Files: `chat/src/lib/reminders/chat-message.record-type.ts`, `chat/src/lib/chat.module.ts`, `chat-ui/src/lib/services/chat-reminders.service.ts`. Test: fires once under two workers, skipped after access lost, late firing; the reminder shows in the person's platform reminder list.
- [ ] **T29**. Scheduled messages: `services/chat-scheduled.service.ts`, routes, suggestions (working schedule, official holidays, time off), `chat.scheduled.sweep` with nonce `scheduled:<id>` for a one-time row and `scheduled:<id>:<occurrence>` for each occurrence of a recurring row (the occurrence's planned time, the same on every retry of that occurrence); the `botId`, `kind`, `rule`, `pausedAt` and `lastRunAt` columns with recurring next times from the core recurrence module, so the bot posts of `chat-agents-and-record-actions` use the same table and sweep. Test: weekend and holiday skip, failure reasons, exactly once under two workers; a recurring row sends once per occurrence, its second occurrence is sent (not deduplicated against the first), and a retried occurrence keeps its nonce and sends once.
- [ ] **T30**. Activity: `ChatReply` and `ChatQuote` notifications filed by `services/chat-notifier.service.ts` beside `Mention` and `Message`; `chat_reaction_notice` writer in the reaction path (bundled per message, optional `ChatReaction` notification); `GET /activity` over the person's notifications about chat messages plus reaction bundles, `POST /activity/read` marking the notifications (the Inbox mirror follows), `GET /saved/counts`. Test: bundle merge and removal, unread filter; an entry read in Activity is read in the Inbox and the reverse.
- [ ] **T31**. Notification levels and delivery: `muteUntil` in `PATCH /conversations/:id/state`, `chat.mute.expiry`; `priority` on chat notifications; in `packages/plugins/inbox/src/lib/delivery/inbox-delivery-rules.ts` the unread wait of the timer reminder generalized to a per-kind wait (`unreadEmailDelayMinutes`, set by the person, for notifications about chat messages; unset keeps today's delivery) and the `dnd` window extended by a manual do-not-disturb status until `statusClearsAt`; chat kinds added to the notification settings page of `inbox-ui`. Test: read before the delay sends no email; a person without a wait is emailed at once as today; timer reminder timing unchanged; do not disturb holds push; urgent passes when allowed.
- [ ] **T32**. Status on the platform presence: availability and status columns written by `PUT|DELETE /api/realtime/presence/status`, returned by the presence merge in `realtime-presence.store.ts` and `GET /api/realtime/presence`, `realtime.presence.status-expiry` job; chat renders it. Test: clear-after, appear offline hides presence, another plugin reading presence sees the status.
- [ ] **T33**. Files: type, name and cursor filters on files; attach to record, save to drive, grant view, zip through drive ports (inert without `drive`). Files: `services/chat-file-actions.service.ts`, `controllers/chat-message.controller.ts`, `controllers/chat-conversation.controller.ts`, `chat/src/lib/chat-files.ts`. Test: per-file access on zip, record edit required.
- [ ] **T34**. Search filters: attributes in the declaration, filter mapping in `services/chat-search.service.ts`, `tab`, `GET /search/quick`, `GET /links`; index on outbox facts with lag metric. Test: each filter, deletion removed within the window (fake clock).
- [ ] **T35**. Group conversion: `POST /conversations/:id/convert`; deactivated-peer refusal `CHAT_RECIPIENT_INACTIVE` where `direct.readOnlyWithInactive` is on. Files: `services/chat-conversation.service.ts`, `services/chat-message.service.ts`, `controllers/chat-conversation.controller.ts`. Test: history kept, direct conversation unchanged; with the setting off a send to a deactivated peer is accepted as today.
- [ ] **T36**. Outbox events and realtime declarations for every new fact in `realtime/chat-realtime.ts` and `chat-realtime-audience.ts`. Test: audience spec (person-only facts never reach others).
- [ ] **T37**. GraphQL read twins for activity, saved and scheduled in `graphql/chat.schema.ts`, `chat.resolver.ts`, personal categories in the existing categories read, field-binding gate updated. Test: resolver spec mirrors REST.
- [ ] **T65**. Archived channels (spec FR-20): posts, reactions and votes in an archived conversation are refused with `CHAT_CONVERSATION_ARCHIVED`; Browse lists open channels as today and adds archived ones only with `includeArchived`; a private channel whose last member leaves is archived automatically where `channels.archiveWhenEmpty` is on (default off: it stays as today); unarchive restores it unchanged. Files: `services/chat-message.service.ts`, `services/chat-conversation.service.ts`, `controllers/chat-conversation.controller.ts`. Test: each write refused with the code; Browse without the flag answers as today and with it adds archived channels; with the setting off the last leave changes nothing; with it on the last leave archives a private channel and never a public one.
- [ ] **T66**. File groups on send (spec FR-37): the new `fileGroup` input takes up to 20 files with one caption in one send, all or nothing; the files stored as one group shown above the caption; a retry with the same nonce answers the same message; a send with `attachmentIds` keeps today's path and its limit of 10. Files: `services/chat-message.service.ts`, `chat/src/lib/chat-files.ts`, `chat/src/lib/dto/chat-messaging.dto.ts`. Test: a 21st file in a group refused; one failing file stores nothing; a repeated send with the same key returns the first message; a send with attachments answers as today.
- [ ] **T67**. Message context (spec FR-43, FR-46): `GET /messages/:id/context?before=&after=` answers the window around a message (permalink, search hit, pin) or a date, never splitting a file group, and `404` to non-members of a private channel, direct or group conversation (a person who may read a public channel gets its window, spec FR-66). Files: `controllers/chat-message.controller.ts`, `services/chat-message.service.ts`. Test: window around a target; a file group at the edge is kept whole; a non-member of a private channel gets `404` and a non-member who may read a public channel gets the window; a date resolves to the first message of that day.
- [ ] **T68**. Links to the platform's own records, pages and meeting rooms (spec FR-52): such links skip the fetched preview and carry the record or call card of `chat-agents-and-record-actions` and `chat-administration-and-clients` (task cards always, other records only with `FEATURE_CHAT_RECORD_CARDS`; without it the link shows as today). Files: `link-preview/chat-link-preview.service.ts`, `link-preview/link-preview-url.ts`, `services/chat-task-card.service.ts`. Test: an own-host task link is never fetched and gets a task card; a record link with the flag off renders as today.
- [ ] **T69**. Spoiler-safe teasers and highlighted snippets (spec FR-58): one teaser builder used by pushes, emails, list teasers and search snippets hides spoiler text; search highlighting marks matched words inside text, mentions, links and code alike. Files: `chat/src/lib/chat-teaser.ts`, `services/chat-notifier.service.ts`, `services/chat-search.service.ts`. Test: a spoiler never appears in a push, an email or a snippet; a match inside a code span and inside a mention is highlighted.
- [ ] **T70**. Purge pass (spec FR-87, FR-112): the daily `chat.purge` pass also removes sent scheduled messages, drafts and read reaction notices older than the organization's retention period for their kind (`chat.scheduled-sent`, `chat.draft`, `chat.reaction-notice`, declared through `RETENTION_SOURCES` with the default keep), and expired digests and translations of deleted messages; pending reminders on purged messages are cancelled through the shared `REMINDERS` port. Files: `chat/src/lib/maintenance/chat-purge.worker.ts`, `chat/src/lib/retention/chat-retention.sources.ts`. Test: with no period set no row of the three kinds is removed; with periods set, rows past them are removed and younger ones kept (fake clock); re-running the pass deletes nothing more.
- [ ] **T71**. Uploads through drive and picture processing (spec FR-88, FR-89): where `drive` is on, chat uploads use its resumable upload with type, size and quota checks before any byte is stored and report progress; pictures are turned upright, stripped of metadata when the organization asks, and get a thumbnail, a placeholder colour and their size. Files: `services/chat-draft-upload.service.ts`, `chat/src/lib/chat-files.ts`, `chat/src/lib/media/chat-picture.processor.ts`. Test: over-quota file refused before storage; a rotated picture stored upright; metadata removed only with the setting; without `drive` uploads behave as today.
- [ ] **T72**. Threads of public channels for non-members (spec FR-66): a person who may read a public channel opens its threads from a link or a search hit without being a member, and the thread's composer gate offers "join". Files: `services/chat-access.service.ts`, `controllers/chat-message.controller.ts`, `chat-ui/src/lib/components/thread-pane/thread-pane.component.ts`. Test: a non-member reads a public thread and joins from the gate; a private channel's thread answers `404`.
- [ ] **T75**. Access-loss cleanup (spec FR-87): a consumer of chat access loss cancels the person's pending reminders on messages through the shared `REMINDERS` port and deletes their pending scheduled messages and drafts. Files: `chat/src/lib/membership/chat-access-loss.consumer.ts`, `chat/src/lib/chat.module.ts`. Test: a person losing `CHAT_VIEW` keeps no pending reminder, scheduled message or draft; a person who keeps access loses nothing.

## Phase 3 — UI surfaces

- [ ] **T38**. Rollout phase 1 screens: `search-page` over the existing route, link preview icon in `link-cards`, presence in every list and card, notification level in the list menu, permalink route. Test: component rendering specs; `chat-ui.plugin.spec.ts` routes.
- [ ] **T39**. Navigation rail, organization badges in the header slot, phone-width bottom bar, last place restore. Files: `chat-ui/src/lib/components/nav-rail/nav-rail.component.ts`, `chat-ui/src/lib/components/org-switch-badges/org-switch-badges.component.ts`, `chat-ui/src/lib/components/chat-page/chat-page.component.ts`, `chat-ui/src/lib/chat-ui.plugin.ts`. Test: rail counts, phone layout spec.
- [ ] **T40**. Conversation list: sections dialog, sort and filters, icons per mode, draft and mute markers. Files: `chat-ui/src/lib/components/conversation-list/conversation-list.component.ts`, `chat-ui/src/lib/components/list-filters/list-filters.component.ts`, `chat-ui/src/lib/dialogs/sections-dialog.component.ts`. Test: filters never hide favourites or mentions.
- [ ] **T41**. Channel panel (info, description, members with bulk add from teams, files, links, pins, threads), create dialog with members and policies, delete and restore dialogs. Files: `chat-ui/src/lib/components/channel-panel/channel-panel.component.ts`, `chat-ui/src/lib/dialogs/chat-dialogs.component.ts`. Test: buttons follow the caller's rights.
- [ ] **T42**. People page and profile panel. Files: `chat-ui/src/lib/components/people-page/people-page.component.ts`, `chat-ui/src/lib/components/profile-panel/profile-panel.component.ts`. Test: rendering with hidden fields.
- [ ] **T43**. Composer: toolbar, shortcuts, Enter preference, tables and spoilers in the renderer, mention warnings, emoji picker with custom emoji and recents, phone action row, drop anywhere. Files: `chat-ui/src/lib/components/message-composer/message-composer.component.ts`, `chat-ui/src/lib/components/composer-toolbar/composer-toolbar.component.ts`, `chat-ui/src/lib/components/emoji-picker/emoji-picker.component.ts`, `chat-ui/src/lib/chat-emoji.ts`. Test: composer spec (warnings, toolbar output equals Markdown subset).
- [ ] **T44**. Outbox service (IndexedDB with memory fallback), sending states, retry and discard; synced drafts. Files: `chat-ui/src/lib/services/chat-outbox.service.ts`, `chat-ui/src/lib/services/chat-drafts.service.ts`. Test: reload keeps unsent, order kept on reconnect.
- [ ] **T45**. Message actions: quote, forward dialog, revisions dialog, reactions dialog, readers dialog, bulk delete selection, copy text and link, save, remind. Files: `chat-ui/src/lib/components/message-item/message-item.component.ts`, `chat-ui/src/lib/dialogs/forward-dialog.component.ts`, `chat-ui/src/lib/dialogs/revisions-dialog.component.ts`, `chat-ui/src/lib/dialogs/reactions-dialog.component.ts`, `chat-ui/src/lib/dialogs/readers-dialog.component.ts`. Test: menu items per rights.
- [ ] **T46**. Message list: system event rendering in the reader's language, day separators, grouping, gallery, lightbox, inline players, jump to date. Files: `chat-ui/src/lib/components/conversation-view/conversation-view.component.ts`, `chat-ui/src/lib/components/gallery/gallery.component.ts`, `chat-ui/src/lib/components/lightbox/lightbox.component.ts`, `chat-ui/src/lib/chat-system-events.ts`. Test: system event i18n spec in two locales.
- [ ] **T47**. Polls: composer and card with live tallies, close and export. Files: `chat-ui/src/lib/components/poll-composer/poll-composer.component.ts`, `chat-ui/src/lib/components/poll-card/poll-card.component.ts`. Test: anonymous poll shows no voters.
- [ ] **T48**. Threads page tabs and filters; thread auto-follow reflected. Files: `chat-ui/src/lib/components/threads-page/threads-page.component.ts`, `chat-ui/src/lib/components/thread-pane/thread-pane.component.ts`. Test: server filters, unread only tab.
- [ ] **T49**. Activity, Saved, Scheduled pages, reminder dialog, schedule menu with suggestions, scheduled banner. Files: `chat-ui/src/lib/components/activity-page/activity-page.component.ts`, `chat-ui/src/lib/components/saved-page/saved-page.component.ts`, `chat-ui/src/lib/components/scheduled-page/scheduled-page.component.ts`, `chat-ui/src/lib/components/schedule-menu/schedule-menu.component.ts`, `chat-ui/src/lib/dialogs/reminder-dialog.component.ts`. Test: badges, failed scheduled retry.
- [ ] **T50**. Status dialog (platform presence), custom status in lists and composer, mute until, sounds and appearance in `uiPreferences.chat`, chat kinds on the existing notification settings page, shortcut panel (`?`), tab title count. Files: `chat-ui/src/lib/dialogs/status-dialog.component.ts`, `chat-ui/src/lib/components/shortcut-panel/shortcut-panel.component.ts`, `chat-ui/src/lib/preferences/chat-preferences.ts`, `packages/plugins/inbox-ui/src/lib/settings/notification-settings-page.component.ts`. Test: status clears, shortcut panel keyboard spec, appearance follows the person to another device.
- [ ] **T51**. Voice recorder with preview and waveform. Files: `chat-ui/src/lib/components/voice-recorder/voice-recorder.component.ts`. Test: recorder state spec with a fake media stream.
- [ ] **T52**. i18n keys for every new string in `chat-ui/src/i18n/*.json` (every shipped locale). Test: key parity spec.
- [ ] **T73**. Command palette and header quick search (spec FR-11, FR-12): chat commands (go to a conversation or person, start a direct message, create a channel, set status, search messages, open Activity, Threads or Saved) registered in the platform's command palette registry when loaded, each shown only when allowed; the header search box shows conversations, people and the five best messages from `GET /search/quick` and opens the search page with the query. Files: `chat-ui/src/lib/chat-commands.ts`, `chat-ui/src/lib/components/header-search/header-search.component.ts`, `chat-ui/src/lib/chat-ui.plugin.ts`. Test: a person without `CHAT_SEND` sees no "create a channel" command; typing shows the three groups and Enter opens the search page.
- [ ] **T74**. Kept behaviour and route gates (spec FR-1, FR-2): every route this spec adds carries the `FEATURE_CHAT` guard and answers `404` with the feature off or the plugin unloaded; the existing chat, incoming-webhook and realtime suites run unchanged. Files: `chat/src/lib/chat-routes.gate.spec.ts`. Test: the gate spec lists every new route; the existing suites pass unchanged.
- [ ] **T76**. End-to-end checks of kept behaviour (spec FR-48, FR-64, FR-80): in the Angular chat, typing in conversations and threads, thread follow and "also send to the conversation", mark unread and the read position across two sessions. Files: `apps/gauzy-e2e/tests/chat-kept-behaviour.spec.ts` (Playwright). Test: the e2e checks pass in two sessions.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T53**. MCP chat tools of plan §7 in `packages/mcp-server/src/lib/tools/collaboration/chat.ts` (preview on `schedule_chat_message`). Test: tool specs mirror REST for one user; unscoped calls not found.
- [ ] **T54**. Report definitions (poll results, most used reactions, messages and active members per conversation and day) registered with the report registry when loaded. Files: `chat/src/lib/reports/chat-report.definitions.ts`, `chat/src/lib/chat.module.ts`. Test: definitions return counts equal to the tables.
- [ ] **T55** (parallel). GIF source connector type declaration for `integration-hub` and picker behind it. Files: `chat/src/lib/gif/chat-gif-source.connector.ts`, `chat-ui/src/lib/components/gif-picker/gif-picker.component.ts`. Test: no source, no picker; fetch through the egress guard.
- [ ] **T56**. OpenAPI regenerated; SDK regeneration noted; `packages/plugins/chat/README.md` and `chat-ui/README.md` updated; docs site page. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Advanced capabilities (rollout phase 4)

- [ ] **T57**. Summary and record summary: `services/chat-digest.service.ts` (prompt from membership-filtered messages, source ids kept, 24 h expiry, `ai_run` and usage recorded through `ai-agents-and-assistants` where loaded), routes, `summary-panel`. Test: no unreadable message in the prompt; provider down answers "not available"; one run with its usage per request.
- [ ] **T58**. Translation: `services/chat-translation.service.ts`, route, automatic translation setting, `translate-toggle`. Test: dropped on edit; original always shown.
- [ ] **T59**. Transcripts: `chat.transcribe` job through the provider registry's `transcribe`, transcript into search. Files: `chat/src/lib/ai/chat-transcribe.worker.ts`, `services/chat-search.service.ts`. Test: found by a transcript word; no job with AI off.
- [ ] **T60**. Relevance sort: `services/chat-relevance.ts` (mentions, manager and reports, assigned tasks, tracked projects in 14 days, followed records, writing frequency) on `GET /states?sort=relevance`, reasons in the answer, Unreads toggle. Test: ranking spec with fixtures.
- [ ] **T61**. Work signals: the employee's `isTrackingTime` and running timer, calendar busy and time off in the presence answer with consent (`shareWorkSignals`) and project-member audience; do not disturb during meetings from `dndDuringMeetings` of the notification preferences. Files: `chat/src/lib/chat-presence.ts`, `packages/plugins/realtime/src/lib/realtime-presence.store.ts`, `packages/plugins/inbox/src/lib/delivery/inbox-delivery-rules.ts`. Test: non-member never sees the project.
- [ ] **T62**. Delivery in the recipient's hours: composer offer, `origin: their_hours` scheduled messages, time zone display. Files: `services/chat-scheduled.service.ts`, `chat-ui/src/lib/components/schedule-menu/schedule-menu.component.ts`, `chat-ui/src/lib/components/message-composer/message-composer.component.ts`. Test: across time zones and a holiday.
- [ ] **T63**. Defaults keep today's behaviour (spec FR-129): `channels.uniqueNames`, `members.managerSuccession`, `direct.readOnlyWithInactive`, `channels.archiveWhenEmpty` off, no retention period for sent scheduled messages, drafts and reaction notices, `pins.max` 0, `broadcastPolicy` and `pinPolicy` `all`, archived conversations in the list, `unreadEmailDelayMinutes` unset; Ever Teams' local drafts kept beside the server copy. Files: `chat/src/lib/chat.settings.ts` (declared by `chat-administration-and-clients` T1). Test: spec AC-24 end to end with no setting written; the existing chat suites pass unchanged.
- [ ] **T64**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `HELPDESK_CHAT`, `LEARNING_CHAT`, `MEETINGS_CHAT`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and what stays | T1, T63, T74 |
| FR-2 | §3.1 Scope and what stays | T74 |
| FR-3 | §3.1 Scope and what stays | T2, T57 |
| FR-4 | §3.1 Scope and what stays | T38 |
| FR-5 | §3.2 Organizations, navigation and the conversation list | T10, T39 |
| FR-6 | §3.2 Organizations, navigation and the conversation list | T9, T39 |
| FR-7 | §3.2 Organizations, navigation and the conversation list | T39 |
| FR-8 | §3.2 Organizations, navigation and the conversation list | T40 |
| FR-9 | §3.2 Organizations, navigation and the conversation list | T11, T40 |
| FR-10 | §3.2 Organizations, navigation and the conversation list | T40 |
| FR-11–FR-12 | §3.2 Organizations, navigation and the conversation list | T73 |
| FR-13 | §3.3 Channels and membership | T12, T17 |
| FR-14 | §3.3 Channels and membership | T12 |
| FR-15 | §3.3 Channels and membership | T13 |
| FR-16 | §3.3 Channels and membership | T12, T14, T41 |
| FR-17 | §3.3 Channels and membership | T12, T41 |
| FR-18 | §3.3 Channels and membership | T12, T17 |
| FR-19 | §3.3 Channels and membership | T15 |
| FR-20 | §3.3 Channels and membership | T40, T65 |
| FR-21 | §3.3 Channels and membership | T16 |
| FR-22 | §3.3 Channels and membership | T18, T41 |
| FR-23 | §3.3 Channels and membership | T14, T41 |
| FR-24 | §3.3 Channels and membership | T17, T18 |
| FR-25 | §3.3 Channels and membership | T18 |
| FR-26 | §3.3 Channels and membership | T36, T40 |
| FR-27 | §3.3 Channels and membership | T19, T42 |
| FR-28 | §3.3 Channels and membership | T41 |
| FR-29–FR-30 | §3.4 Messages and composer | T43 |
| FR-31 | §3.4 Messages and composer | T14 |
| FR-32 | §3.4 Messages and composer | T24 |
| FR-33 | §3.4 Messages and composer | T43 |
| FR-34 | §3.4 Messages and composer | T24, T48 |
| FR-35 | §3.4 Messages and composer | T5, T43 |
| FR-36 | §3.4 Messages and composer | T55 |
| FR-37 | §3.4 Messages and composer | T66 |
| FR-38 | §3.4 Messages and composer | T44 |
| FR-39 | §3.4 Messages and composer | T21 |
| FR-40 | §3.4 Messages and composer | T21, T45 |
| FR-41–FR-42 | §3.4 Messages and composer | T20 |
| FR-43 | §3.4 Messages and composer | T38, T45, T67 |
| FR-44 | §3.4 Messages and composer | T45 |
| FR-45 | §3.4 Messages and composer | T46 |
| FR-46 | §3.4 Messages and composer | T46, T67 |
| FR-47 | §3.4 Messages and composer | T22 |
| FR-48 | §3.4 Messages and composer | T76 |
| FR-49 | §3.4 Messages and composer | T23 |
| FR-50 | §3.4 Messages and composer | T19 |
| FR-51 | §3.4 Messages and composer | T23, T38 |
| FR-52 | §3.4 Messages and composer | T68 |
| FR-53 | §3.4 Messages and composer | T46 |
| FR-54 | §3.4 Messages and composer | T12, T35 |
| FR-55 | §3.4 Messages and composer | T43, T49 |
| FR-56 | §3.4 Messages and composer | T39, T43 |
| FR-57 | §3.4 Messages and composer | T43 |
| FR-58 | §3.4 Messages and composer | T69 |
| FR-59 | §3.4 Messages and composer | T45 |
| FR-60 | §3.4 Messages and composer | T50 |
| FR-61 | §3.4 Messages and composer | T9, T50 |
| FR-62 | §3.4 Messages and composer | T50 |
| FR-63 | §3.4 Messages and composer | T44 |
| FR-64 | §3.5 Threads | T48, T76 |
| FR-65 | §3.5 Threads | T24, T48 |
| FR-66 | §3.5 Threads | T72 |
| FR-67 | §3.5 Threads | T48 |
| FR-68 | §3.5 Threads | T14, T24, T48 |
| FR-69 | §3.5 Threads | T48 |
| FR-70 | §3.5 Threads | T30, T48 |
| FR-71 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T5, T9 |
| FR-72 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T30, T49 |
| FR-73 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T5 |
| FR-74 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T25, T47 |
| FR-75 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T25, T47 |
| FR-76 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T25, T47 |
| FR-77 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T12, T14 |
| FR-78 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T26 |
| FR-79 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T27 |
| FR-80 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T76 |
| FR-81 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T28, T49 |
| FR-82 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T28 |
| FR-83 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T29, T49 |
| FR-84 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T29, T49 |
| FR-85 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T49 |
| FR-86 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T26, T30, T49 |
| FR-87 | §3.6 Reactions, polls, pins, saved messages, read receipts, reminders, scheduled messages | T70, T75 |
| FR-88–FR-89 | §3.7 Files and media | T71 |
| FR-90 | §3.7 Files and media | T51 |
| FR-91 | §3.7 Files and media | T46 |
| FR-92 | §3.7 Files and media | T33, T41 |
| FR-93–FR-95 | §3.7 Files and media | T33 |
| FR-96 | §3.8 Search | T38 |
| FR-97 | §3.8 Search | T34 |
| FR-98 | §3.8 Search | T8, T34 |
| FR-99 | §3.8 Search | T23, T34 |
| FR-100 | §3.8 Search | T34, T38 |
| FR-101 | §3.8 Search | T8, T34 |
| FR-102 | §3.8 Search | T43 |
| FR-103 | §3.8 Search | T30, T49 |
| FR-104 | §3.9 Activity, unread and notifications | T30 |
| FR-105 | §3.9 Activity, unread and notifications | T10, T14 |
| FR-106–FR-108 | §3.9 Activity, unread and notifications | T30, T31 |
| FR-109 | §3.9 Activity, unread and notifications | T31 |
| FR-110 | §3.9 Activity, unread and notifications | T50 |
| FR-111 | §3.9 Activity, unread and notifications | T30 |
| FR-112 | §3.9 Activity, unread and notifications | T30, T70 |
| FR-113 | §3.10 Presence and status | T32, T38 |
| FR-114 | §3.10 Presence and status | T32 |
| FR-115 | §3.10 Presence and status | T36 |
| FR-116 | §3.11 Direct and group conversations | T35 |
| FR-117 | §3.11 Direct and group conversations | T40 |
| FR-118 | §3.11 Direct and group conversations | T19 |
| FR-119 | §3.11 Direct and group conversations | T35 |
| FR-120–FR-121 | §3.12 Advanced capabilities | T57 |
| FR-122 | §3.12 Advanced capabilities | T58 |
| FR-123 | §3.12 Advanced capabilities | T60 |
| FR-124 | §3.12 Advanced capabilities | T61 |
| FR-125 | §3.12 Advanced capabilities | T62 |
| FR-126 | §3.12 Advanced capabilities | T59 |
| FR-127 | §3.13 MCP tools and reports | T53 |
| FR-128 | §3.13 MCP tools and reports | T54 |
| FR-129 | §3.14 Defaults | T63 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Chat flags and `GAUZY_CHAT_AI_ENABLED` stay off by default; enabling them in dev shows each phase end to end.
- Every existing chat, incoming-webhook and realtime test still passes unchanged.
- Constitution gates in `spec.md` §9 confirmed; every acceptance criterion of `spec.md` §7 demonstrated.
