# Task Breakdown: Discussions

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `discussions`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_DISCUSSIONS_ENABLED` and `FEATURE_DISCUSSIONS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `ds/` means
  `packages/plugins/discussions/src/lib/`, `ui/` means `packages/plugins/discussions-ui/src/lib/`, `core/` means
  `packages/core/src/lib/`. Each new service, controller or component ships with a `.spec.ts` beside it.
- Phases 1 to 4 deliver plan phase 1; Phase 5 plan phase 2 (depth); Phase 6 plan phase 3 (advanced).
- Needs: `NOTIFICATION_DISPATCHER` (automation-and-notifications) is optional (fallback the Inbox writer); guests need
  `access-control-and-security`, reply by email needs `email-and-communications`, pages need the documents hub.
  The core polls and custom emoji (T42, T43) also serve `chat-messaging`, `meetings` and `presentations`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/discussions.model.ts`, `poll.model.ts`, `custom-emoji.model.ts`;
  `BaseEntityEnum.Discussion`, `BaseEntityEnum.DiscussionSpace` (`packages/contracts/src/lib/base-entity.model.ts`),
  `ReactionEntityEnum.Discussion` (`reaction.model.ts`); `EntitySubscriptionTypeEnum.MUTED`
  (`entity-subscription.model.ts`); `digestFrequency` and `digestDay` in `IEmployeeNotificationPreferences`
  (`employee-notification-setting.model.ts`); `discussions` and `changelog` keys in `IUserUiPreferences`
  (`user.model.ts`); export from `packages/contracts/src/index.ts`. Test: enum specs; existing comment, reaction and
  subscription DTO validation accepts the new values.
- [ ] **T2**. Plugin scaffold `packages/plugins/discussions` (`package.json`, `project.json`, `tsconfig.json`,
  `jest.config.ts`, `eslint.config.cjs`), `ds/discussions-enabled.ts` (exact `true`), `ds/discussions.features.ts`
  (`FEATURE_DISCUSSIONS` contribution, default off), `ds/discussions.permissions.ts` (permission contributions with
  `defaultFor` of plan §9), `ds/discussions.settings.ts`, `ds/discussions.plugin.ts`, `ds/discussions.module.ts`,
  `apps/api/src/plugins.ts`, `apps/worker/src/plugins.ts` (`DiscussionsSchedulePlugin` in
  `ds/schedule/discussions-schedule.plugin.ts`), `.env.sample` (`GAUZY_DISCUSSIONS_ENABLED`,
  `GAUZY_MCP_TOOLS_DISCUSSIONS`). Test: flag spec; plugin list specs; contributions listed.
- [ ] **T3**. On the shared core migration helpers of `procurement` T4 (`@gauzy/core`), the space and discussion
  entities (`ds/entities/discussion-space-group.entity.ts`, `discussion-space.entity.ts`, `discussion-member.entity.ts`,
  `discussion-space-state.entity.ts`, `discussion-invite.entity.ts`, `discussion.entity.ts`,
  `discussion-revision.entity.ts`, `discussion-draft.entity.ts`, `discussion-read-state.entity.ts`,
  `discussion-tag-link.entity.ts`, with MikroORM repositories in `ds/entities/discussions.repositories.ts`) and
  migrations `ds/database/migrations/1791000064300-CreateDiscussionSpaceTables.ts`,
  `ds/database/migrations/1791000064310-CreateDiscussionTables.ts`, listed in `ds/database/migrations/index.ts`. Test:
  migration specs on SQLite (up twice); mapping under both ORMs. Migration timestamps: `1791000064300` to `1791000064389` (`packages/plugins/discussions`); `1791000064390` to `1791000064399` (`packages/core`).
- [ ] **T4**. Default grants through the contribution reload (no seed migration); core migrations
  `core/database/migrations/1791000064393-CreateCommentRevisionTable.ts` (`core/comment/comment-revision.entity.ts`)
  and `core/database/migrations/1791000064394-AddMutedUntilToEntitySubscription.ts`
  (`core/entity-subscription/entity-subscription.entity.ts`). Test: grants as plan §9 for a new and an existing tenant;
  migrations up twice on SQLite.
- [ ] **T42**. Core polls `packages/core/src/lib/poll/` (`poll.entity.ts`, `poll-option.entity.ts`, `poll-vote.entity.ts`,
  `poll.service.ts`, `/api/polls` in `poll.controller.ts`, `@PollHostAccessPolicy()` in `poll-host-access.policy.ts`),
  migration `core/database/migrations/1791000064390-CreatePollTables.ts`, no dependency on this plugin or its flag
  (FR-25, FR-26). Test: one vote per voter, change and withdraw, anonymous results hide voters, closed poll refuses
  votes.
- [ ] **T43**. Core custom emoji `packages/core/src/lib/reaction/custom-emoji/` (`custom-emoji.entity.ts`,
  `custom-emoji.service.ts`, routes `/api/custom-emoji` in `custom-emoji.controller.ts`), migration
  `core/database/migrations/1791000064391-CreateCustomEmojiTable.ts`, no dependency on this plugin or its flag (FR-23).
  Test: shortcode unique per organization; an archived emoji stays on old reactions.
- [ ] **T45**. Decision, receipt, summary and search feedback entities (`ds/entities/discussion-decision.entity.ts`,
  `discussion-receipt.entity.ts`, `discussion-summary.entity.ts`, `discussion-search-feedback.entity.ts`, with their
  repositories in `ds/entities/discussions.repositories.ts`) and migrations
  `ds/database/migrations/1791000064320-CreateDiscussionDecisionTables.ts`,
  `ds/database/migrations/1791000064330-CreateDiscussionSearchTables.ts`. Test: migration specs on SQLite (up twice);
  mapping under both ORMs.

## Phase 2 — Services, endpoints, events

- [ ] **T5**. `ds/access/space-access.service.ts` (open, private, guest, archived, `DISCUSSIONS_MANAGE` listing, audited
  self-join) and `@CommentParentAccessPolicy()` for `Discussion` in `ds/access/discussion-comment-parent.policy.ts`
  (write refused when closed or archived). Test: access matrix spec; comment API refuses a non-member and a closed
  discussion.
- [ ] **T6**. Space service and controller: create, update, archive, unarchive, merge, link record, members, join, leave,
  follow and mute as `entity_subscription` rows on `DiscussionSpace` (type `muted` with `mutedUntil`), pin and position in
  `discussion_space_state`, membership sources `TEAM` and `PROJECT` (on the same team membership fact chat consumes).
  Files: `ds/space/discussion-space.service.ts`, `ds/space/discussion-space.controller.ts`,
  `ds/space/dto/create-discussion-space.dto.ts`, `ds/space/dto/update-discussion-space.dto.ts`,
  `ds/space/space-membership-sync.service.ts`. Test: e2e (permissions, `404` for private spaces, `404` with the feature
  off); merge keeps old links; a muted space sends nothing until `mutedUntil`.
- [ ] **T7**. Discussion service and controller: publish, list per space and across spaces, read with replies, edit with
  `If-Match` and revisions, delete, close, reopen, move, pin scopes; sanitiser against the editor schema; readable slugs.
  Files: `ds/discussion/discussion.service.ts`, `ds/discussion/discussion.controller.ts`,
  `ds/discussion/discussion-body.sanitizer.ts`, `ds/discussion/dto/create-discussion.dto.ts`. Test: e2e; stale edit
  `409`; script stripped from a body.
- [ ] **T8**. Replies over core comments (`CommentCreateCommand`, `CommentUpdateCommand`), quotes with source ids,
  removal and 30-day restore by space admins, accepted answers; core `comment_revision` written by
  `CommentUpdateCommand` (`core/comment/commands/handlers/comment.update.handler.ts`) for comments on `Discussion`
  (other comments only with the tenant setting `comments.keepRevisions`, default off) with
  `GET /api/comment/:id/revisions` (`core/comment/comment.controller.ts`). Files: `ds/reply/discussion-reply.service.ts`,
  `ds/reply/discussion-reply.controller.ts`. Test: reply through `/api/discussions` and `/api/comment` behave alike and
  both keep a revision; quoted author told; a task comment edit keeps no revision until the tenant switches the setting
  on, and keeps one after.
- [ ] **T9**. Reactions, mentions, followers, bookmarks on core: `@FavoriteService()` providers, implicit following on
  start, reply and mention, muted follows skipped by the core fan-out (`core/entity-subscription/fan-out/`), space-wide
  mentions rule. Files: `ds/social/discussion-favorite.service.ts`, `ds/social/discussion-following.service.ts`,
  `ds/social/discussion-mentions.ts`. Test: a non-member mention is not told; bookmarks list; a muted discussion
  notifies nobody who muted it.
- [ ] **T10**. Unread tracking: read states, `activityVersion` and cached counts, first unread reply, mark read, unread,
  space and all read; `GET /me/unread` in one call. Files: `ds/unread/discussion-read-state.service.ts`,
  `ds/unread/discussion-unread.controller.ts`. Test: counts with 1,000 discussions under the budget; mark unread.
- [ ] **T11**. Counters subscriber `subscriber:discussions-counters` on `CommentEvent` and reaction events; bundled
  reaction notices; nightly counter rebuild. Files: `ds/events/discussions-counters.subscriber.ts`,
  `ds/schedule/discussions-counters-rebuild.scheduler.ts`. Test: counts after create, edit, remove; one bundled notice
  per hour.
- [ ] **T12**. Announcements: `BROADCAST_AUDIENCE_RESOLVERS` port in `core/broadcast/` (`broadcast-audience-resolvers.ts`,
  consulted by `broadcast.service.ts`) with the space resolver (`ds/announcements/space-audience.resolver.ts`), comment
  access for broadcasts in spaces where none exists, `POST /announcements` and the space feed with broadcasts of linked
  records (`ds/announcements/discussion-announcement.controller.ts`, `ds/announcements/space-feed.service.ts`). Test:
  broadcast service specs for the four known types unchanged; a space broadcast is visible to members only.
- [ ] **T13**. Events and notifications: outbox `discussions.*`, realtime hints, notification categories through
  `NOTIFICATION_DISPATCHER` (fallback `INBOX_ITEM_WRITER`), immediate email and push through the Inbox delivery choices.
  Files: `ds/events/discussions.events.ts`, `ds/notifications/discussions-notifier.service.ts`. Test: an entry per event
  of spec FR-35; fallback path without the dispatcher.
- [ ] **T44**. GraphQL reads `discussionSpaces`, `discussions`, `discussion`, `discussionUnread`, each behind
  `FEATURE_DISCUSSIONS` and filtered by `SpaceAccessService`. Files: `ds/graphql/schema-extensions.ts`,
  `ds/graphql/discussions.resolver.ts`. Test: `ds/graphql/discussions.resolver.spec.ts`: results equal the REST lists;
  a private space is absent for a non-member; the fields answer not found with the feature off (FR-1, FR-63).

## Phase 3 — UI surfaces

- [ ] **T14**. Angular `packages/plugins/discussions-ui`: registration (`ui/discussions-ui.plugin.ts`), menu, home
  (`ui/components/discussions-home/discussions-home.component.ts`), space page (feed, discussions, members, settings with
  the cover picker: `ui/components/space-page/space-page.component.ts`), sidebar pinned spaces with badges (dot or count
  from `uiPreferences.discussions`: `ui/components/discussions-sidebar/discussions-sidebar.component.ts`), i18n
  `DISCUSSIONS.*` in every locale (`packages/ui-core/i18n/assets/i18n/*.json`). Test: rendering specs; keyboard
  navigation of lists.
- [ ] **T15**. Discussion page: thread from the first unread reply, reply composer on the hub editor in reduced
  configuration, quotes, reactions with quick set, bookmarks, follow and mute, revisions dialog, moderation menu,
  live replies over realtime hints. Files: `ui/components/discussion-page/discussion-page.component.ts`,
  `ui/components/reply-composer/reply-composer.component.ts`, `ui/dialogs/revisions-dialog.component.ts`. Test: component
  specs; a reply from another session appears.
- [ ] **T16**. Record panels: `RecordDiscussions` for project, team, client and deal pages, "Start a discussion" over
  `/records/:recordType/:recordId/space` (`ds/records/record-space.controller.ts`); profile tab on the employee page.
  Files: `ui/components/record-discussions/record-discussions.component.ts`,
  `ui/components/profile-discussions-tab/profile-discussions-tab.component.ts`. Test: panel lists the record space's
  latest items.
- [ ] **T17** (parallel). Record panel exported by `discussions-ui` (`RecordDiscussions` standalone component) and its
  registration in the page extension slots of project, team, client and deal pages and in the record timeline shell
  (`ui/discussions-ui.plugin.ts`, `packages/plugins/discussions-ui/src/index.ts`). Test: rendering tests; the panel
  appears through the slot only with the feature on.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T18**. MCP group `discussions` (`packages/mcp-server/src/lib/tools/collaboration/discussions.ts`, switch, scopes
  in `packages/mcp-server/src/lib/tools/collaboration/scopes.ts`): list, get, search, post, reply, react, mark read with
  `preview` defaults; broadcast tools for announcements. Test: tool specs (scopes, preview writes nothing, private
  spaces hidden).
- [ ] **T19**. Search: index definitions for discussions and replies in `packages/plugins/search` (registered from
  `ds/search/discussions-search.definitions.ts` through `packages/plugins/search/src/lib/registry/search-index.registry.ts`),
  space access filter, filters and ranking; command palette entries. Test: a private space's discussion never appears
  for a non-member.
- [ ] **T20**. OpenAPI regenerated; SDK regeneration noted; user docs page for discussions; plugin README
  (`packages/plugins/discussions/README.md`). Files: `packages/core/src/lib/bootstrap/swagger.ts`. Test: OpenAPI
  snapshot includes the new routes.

## Phase 5 — Depth

- [ ] **T21**. Polls in discussions on the core polls of T42: host policies for `Discussion`, replies and space
  broadcasts (`ds/polls/discussion-poll-host.policy.ts`); poll UI (`ui/components/discussion-poll/discussion-poll.component.ts`).
  Test: a member votes on a discussion poll; a reader without access to the space cannot vote.
- [ ] **T22**. Custom emoji settings page and picker integration on the core custom emoji of T43
  (`ui/components/custom-emoji-settings/custom-emoji-settings.component.ts`,
  `ui/components/reaction-picker/reaction-picker.component.ts`). Test: archived emoji stays on old reactions, hidden
  from the picker.
- [ ] **T23**. Space groups: CRUD, admins, private flag, archive, merge; group pins. Files:
  `ds/space-group/discussion-space-group.service.ts`, `ds/space-group/discussion-space-group.controller.ts`. Test: group
  admin cannot read a private space they are not in.
- [ ] **T24**. Tags on discussions and replies (`discussion_tag_link`), filters; accepted answers in lists. Files:
  `ds/tags/discussion-tag.service.ts`, `ds/discussion/discussion.controller.ts`. Test: tag filter spec.
- [ ] **T25**. Drafts and scheduling: autosave, restore, schedule in the author's time zone, `discussions.publish-due`,
  blocked drafts with notice. Files: `ds/drafts/discussion-draft.service.ts`, `ds/drafts/discussion-draft.controller.ts`,
  `ds/schedule/discussions-publish-due.scheduler.ts`. Test: a draft publishes within a minute of its time; an archived
  space blocks it.
- [ ] **T26**. Digests: the digest section registry in `packages/plugins/inbox/src/lib/delivery/`
  (`inbox-digest-sections.ts`, used by `inbox-delivery-mailer.ts`; existing content as its first section, rendered as
  today when no other section has items; `digestFrequency` (default daily, as today) and `digestDay` honoured in
  `inbox-delivery-rules.ts`), the `discussions` section (`ds/digest/discussions-digest.section.ts`: FR-40 items, ranking,
  nothing when empty), preview route `/me/digest/preview` (`ds/digest/discussions-digest.controller.ts`), section
  template in every locale (`ds/digest/templates/`); digest choices on the existing notification settings page. Test:
  two members in different time zones receive one digest each at their 08:00 with the discussions section; no second
  send for a period; an empty section is left out.
- [ ] **T27**. Activity feed over the core activity log; search feedback (`discussion_search_feedback`) and its ranking
  effect; administrators' feedback view. Files: `ds/activity/discussion-activity.service.ts`,
  `ds/search/discussion-search-feedback.service.ts`, `ds/search/discussion-search.controller.ts`. Test: three "not
  useful" marks lower a result for that query.
- [ ] **T28**. Pages in a space through `DISCUSSIONS_PAGES` (folder, team or member shares kept in sync). Files:
  `ds/pages/discussion-pages.service.ts`. Test: a non-member cannot open a space page; a member can edit it.
- [ ] **T29**. Tasks from discussions and replies (record links of `record-views-and-search` from the discussion, reply or decision to the task, core task create command, project of the
  space). Files: `ds/tasks/discussion-tasks.service.ts`, `ds/tasks/discussion-tasks.controller.ts`. Test: task links
  both ways; no permission shows the reason.
- [ ] **T30**. Invitations and guests: `discussion_invite` over core invites, `DISCUSSIONS_GUESTS` provisioning,
  `discussions.invitation-expiry`, guest views limited to their spaces. Files: `ds/invitations/discussion-invite.service.ts`,
  `ds/invitations/discussion-invite.controller.ts`, `ds/schedule/discussions-invitation-expiry.scheduler.ts`. Test: guest
  sees one space, posts only where allowed, loses access at expiry.
- [ ] **T31** (parallel). Discussion import: `registerImportProfiles` profile `discussions.file_import` and toolkit
  `discussions.import`, outside ids mapped through the engine's run rows (core `import_record` without the engine), dry
  run, report. Files: `ds/import/discussions-import.profile.ts`. Test: a repeated import updates without duplicates.
- [ ] **T32** (parallel). What's new marker: `GET /changelog/unseen-count` in `packages/plugins/changelog`
  (`packages/plugins/changelog/src/lib/changelog.controller.ts`, `changelog.service.ts`) over
  `uiPreferences.changelog.seenAt`, written by the theme sidebar panel
  (`packages/ui-core/theme/src/lib/components/theme-sidebar/changelog/changelog.component.ts`) through
  `PUT /user/ui-preferences` when opened, only for tenants with `FEATURE_DISCUSSIONS` on; no table. Test: marker clears
  after opening; no marker with the feature off; existing changelog specs unchanged.
- [ ] **T33**. Onboarding start with suggested spaces from teams and projects; phone-width layouts of every page. Files:
  `ui/components/discussions-onboarding/discussions-onboarding.component.ts`, the `.scss` of every page component in
  `ui/components/`. Test: suggestions list the user's teams; layout specs at 360 px.

## Phase 6 — Advanced capabilities

- [ ] **T34**. Decisions: resolve with decision, tasks for owners, decision log, announce as a decision broadcast,
  supersede; automation triggers. Files: `ds/decisions/discussion-decision.service.ts`,
  `ds/decisions/discussion-decision.controller.ts`. Test: e2e from resolve to task; failed task creation recorded on the
  decision.
- [ ] **T35**. Must-read: audience, pinning until confirmed, receipts, `discussions.must-read-reminders`, confirmations
  view. Files: `ds/must-read/discussion-must-read.service.ts`, `ds/must-read/discussion-must-read.controller.ts`,
  `ds/schedule/discussions-must-read-reminders.scheduler.ts`. Test: reminder after three days, at most three; author sees
  unconfirmed members.
- [ ] **T36**. Assistant: `DISCUSSIONS_ASSISTANT` port, summary and changes since the last visit with source reply ids, proposed decisions,
  draft reply; queue `discussions.assistant`; summaries hidden from readers who lost access. Files:
  `ds/assistant/discussions-assistant.service.ts`, `ds/assistant/discussions-assistant.controller.ts`,
  `ds/assistant/discussions-assistant.worker.ts`. Test: the provider request holds only that discussion's readable text;
  proposals record nothing until confirmed.
- [ ] **T37**. Reply by email: reference token in notification emails, `registerMailIntakes` for `Discussion`, verified
  member address, closed discussion refusal, attachments as hub files. Files: `ds/email/discussions-mail-intake.ts`.
  Test: an email reply posts once; an unknown sender gets one explanation.
- [ ] **T38**. Record spaces created on first use with the record's members (`RECORD` source, `RECORD_VIEWS_QUERY` for
  member lists), `RECORD_TIMELINE_SOURCES` entry. Files: `ds/records/record-space.service.ts`,
  `ds/records/discussions-timeline.source.ts`. Test: a discussion started from a deal lands in its space and timeline.
- [ ] **T39**. MCP tools `summarize_discussion`, `propose_decisions`, `record_decision`, `vote_poll`; reports FR-67 to
  FR-69 with CSV. Files: `packages/mcp-server/src/lib/tools/collaboration/discussions.ts`,
  `ds/reports/discussions-reports.controller.ts`, `ds/reports/discussions-reports.service.ts`. Test: report rows on
  seeded data; tool previews write nothing.
- [ ] **T40**. Settings → Discussions page (defaults from `ds/discussions.settings.ts` in the platform settings store,
  custom emoji, import: `ui/components/discussions-settings-page/discussions-settings-page.component.ts`) and spec
  status `Implemented` after the checks below. Test: settings saved per organization.
- [ ] **T41**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `CALENDAR_DISCUSSIONS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope and compatibility | T2, T6, T44 |
| FR-2 | §3.1 Scope and compatibility | T8, T9, T12 |
| FR-3 | §3.1 Scope and compatibility | T8, T12, T32 |
| FR-4–FR-6 | §3.2 Spaces and space groups | T6 |
| FR-7 | §3.2 Spaces and space groups | T23 |
| FR-8 | §3.2 Spaces and space groups | T6, T7, T23 |
| FR-9 | §3.2 Spaces and space groups | T5, T6 |
| FR-10 | §3.2 Spaces and space groups | T6, T14 |
| FR-11 | §3.2 Spaces and space groups | T6, T14 |
| FR-12 | §3.2 Spaces and space groups | T33 |
| FR-13 | §3.3 Discussions and replies | T7 |
| FR-14 | §3.3 Discussions and replies | T7, T10, T11 |
| FR-15 | §3.3 Discussions and replies | T7, T8 |
| FR-16 | §3.3 Discussions and replies | T8 |
| FR-17 | §3.3 Discussions and replies | T7, T23 |
| FR-18 | §3.3 Discussions and replies | T5, T7 |
| FR-19 | §3.3 Discussions and replies | T8, T24 |
| FR-20 | §3.3 Discussions and replies | T24 |
| FR-21 | §3.3 Discussions and replies | T9 |
| FR-22 | §3.3 Discussions and replies | T25 |
| FR-23 | §3.4 Reactions, polls and bookmarks | T9, T11, T22, T43 |
| FR-24 | §3.4 Reactions, polls and bookmarks | T22, T43 |
| FR-25–FR-26 | §3.4 Reactions, polls and bookmarks | T21, T42 |
| FR-27 | §3.4 Reactions, polls and bookmarks | T9 |
| FR-28–FR-29 | §3.5 Announcements and must-read | T12 |
| FR-30–FR-31 | §3.5 Announcements and must-read | T35 |
| FR-32 | §3.6 Unread, following and notifications | T10 |
| FR-33 | §3.6 Unread, following and notifications | T14 |
| FR-34 | §3.6 Unread, following and notifications | T9, T15 |
| FR-35–FR-36 | §3.6 Unread, following and notifications | T13 |
| FR-37 | §3.6 Unread, following and notifications | T37 |
| FR-38 | §3.6 Unread, following and notifications | T32 |
| FR-39–FR-41 | §3.7 Digests | T26 |
| FR-42 | §3.8 Decisions, tasks and pages | T29 |
| FR-43–FR-45 | §3.8 Decisions, tasks and pages | T34 |
| FR-46 | §3.8 Decisions, tasks and pages | T28 |
| FR-47–FR-50 | §3.9 Summaries and assistant (advanced) | T36 |
| FR-51 | §3.10 People, guests and permissions | T6, T16 |
| FR-52–FR-53 | §3.10 People, guests and permissions | T30 |
| FR-54 | §3.10 People, guests and permissions | T2, T5, T23 |
| FR-55 | §3.10 People, guests and permissions | T8 |
| FR-56 | §3.11 Search, activity and migration | T19 |
| FR-57–FR-58 | §3.11 Search, activity and migration | T27 |
| FR-59 | §3.11 Search, activity and migration | T31 |
| FR-60 | §3.12 Records, clients and API | T6, T16, T17 |
| FR-61 | §3.12 Records, clients and API | T38 |
| FR-62 | §3.12 Records, clients and API | T33 |
| FR-63 | §3.12 Records, clients and API | T6, T7, T20, T44 |
| FR-64 | §3.12 Records, clients and API | T18, T39 |
| FR-65 | §3.12 Records, clients and API | T13, T15 |
| FR-66 | §3.13 Reports | T26 |
| FR-67–FR-69 | §3.13 Reports | T39 |
| FR-70 | §3.13 Reports | T26, T39 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Existing comment, reaction, favourite, follower, broadcast, changelog and Inbox digest specs pass unchanged; with the
  feature off, AC-15 holds.
- A private space's content is absent for a non-member in lists, search, notifications, digests, polls and summaries.
- Two members in different time zones receive their digest at their own hour; an email reply posts a reply.
