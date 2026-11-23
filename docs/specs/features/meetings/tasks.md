# Task Breakdown: Meetings

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `meetings`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_MEETINGS_ENABLED` and `FEATURE_MEETINGS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Plan phase 1 = T1–T14, T27, T28, T30; phase 2 = T15–T23, T29, T31, T47, T48; phase 3 = T24, T25, T32, T33, T49;
  phase 4 = T26, T34, T35; phase 5 = T36–T44, T50.
- Depends on, each behind a port with the fallback of plan §7: events (`calendar-and-scheduling`), files
  (`drive`), notes pages (`documents-and-wiki`), conversations (`chat-messaging`), providers (`ai-agents-and-assistants`),
  record rules (`access-control-and-security`), timelines and record notes (`record-views-and-search`).
- Paths: `mt/` = `packages/plugins/meetings/src/lib/`, and a bare folder (`rooms/`, `access/`, `recordings/`, …) is
  under it; `meetings-ui/`, `meetings-react-ui/` and `public-layout-ui/` are under `packages/plugins/`.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/meetings.model.ts` (plan §3, adapter server and browser contracts,
  ports, agenda source registry); optional `transcribeSegments` and `transcribeStream` on the `ai-chat` provider
  definition. Test: enum and capability guard specs.
- [ ] **T2**. Plugin scaffold `packages/plugins/meetings` (package, project, tsconfig, jest, eslint), `meetings.plugin.ts`,
  `meetings-schedule.plugin.ts`, `meetings-enabled.ts` (exact `true`), `meetings.features.ts` (`FEATURE_MEETINGS`, default
  off), deployment settings with the Ever Teams fallbacks in `.env.sample` and `@gauzy/config`; conditional entries in
  `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts`. Test: plugin lists; settings fallback table.
- [ ] **T3**. Entities and migration `1791000062100-CreateMeetingRoomTables` (media account, room with one room per
  conversation, member, ban, link); migrations on the shared core migration helpers of `procurement` T4 (`@gauzy/core`).
  Files: `mt/database/migrations/1791000062100-CreateMeetingRoomTables.ts`,
  `mt/entities/{meeting-media-account,meeting-room,meeting-room-member,meeting-ban}.entity.ts`. Test: migration spec on
  SQLite; PostgreSQL and MySQL in the suite. Migration timestamps: `1791000062100` to `1791000062199` (`packages/plugins/meetings`).
- [ ] **T4** (parallel). Entities and migration `1791000062110-CreateMeetingSessionTables` (session with call message,
  audio-only flag and one live session per room, participant, guest pass, lobby, agenda, diagnostic, notice); polls are
  the core polls of [`discussions`](../discussions/spec.md) T42, nothing of them built here. Files:
  `mt/database/migrations/1791000062110-CreateMeetingSessionTables.ts`,
  `mt/entities/{meeting-session,meeting-participant,meeting-guest-pass,meeting-lobby-entry,meeting-agenda-item,meeting-diagnostic,meeting-notice}.entity.ts`.
  Test: migration spec.
- [ ] **T5** (parallel). Entities and migration `1791000062120-CreateMeetingRecordingTables`. Files:
  `mt/database/migrations/1791000062120-CreateMeetingRecordingTables.ts`,
  `mt/entities/{meeting-recording,meeting-recording-part,meeting-clip}.entity.ts`. Test: migration spec.
- [ ] **T6** (parallel). Entities and migration `1791000062130-CreateMeetingTranscriptTables`. Files:
  `mt/database/migrations/1791000062130-CreateMeetingTranscriptTables.ts`,
  `mt/entities/{meeting-transcript,meeting-transcript-segment,meeting-summary}.entity.ts`. Test: migration spec.
- [ ] **T7**. Permissions `meetings.permissions.ts` as plugin contributions with `defaultFor` (no seed migration);
  organization settings declared in `meetings.settings.ts` (platform settings store); retention kinds declared through
  `RETENTION_SOURCES`. Test: grants for a new and an existing tenant; declared defaults answered without stored values.

## Phase 2 — Services, endpoints, events

- [ ] **T8**. Adapter registry `adapters/meeting-adapter.registry.ts` (`registerMeetingMediaAdapters`), simulated adapter
  (scripted notices, recorder, audio stream), shared adapter contract suite. Test: suite green for the simulated adapter.
- [ ] **T9**. Adapter plugin `packages/plugins/meetings-media-livekit` (tokens, room names as today's client, notices,
  moderation, recording, audio streams, browser module). Test: contract suite; room name table against today's client.
- [ ] **T10** (parallel). Adapter plugin `packages/plugins/meetings-media-jitsi` (tokens with the moderator claim, room
  names as today's client, notices where available, frame browser module, declared limits). Test: contract suite; room
  name table.
- [ ] **T11**. Media accounts `accounts/*` (deployment default, organization accounts, encrypted credentials, verify,
  notice token) and status route. Files: `mt/accounts/meeting-media-account.service.ts`,
  `mt/accounts/meeting-media-account.controller.ts`, `mt/accounts/meetings-status.controller.ts`. Test: secrets never
  returned; capability answer per account.
- [ ] **T12**. Rooms and access `rooms/*`, `access/meeting-access.service.ts` (kinds, access modes, roles, bans, lock,
  close and reopen, team rooms, by-key lookup creating rooms for existing links). Files:
  `mt/rooms/meeting-room.service.ts`, `mt/rooms/meeting-room.controller.ts`, `mt/access/meeting-access.service.ts`.
  Test: access matrix; tenant isolation.
- [ ] **T13**. Join and lobby `access/join.service.ts`, `lobby/*` (tokens ≤ 1 h, guests ≤ 2 h, limits, rejections with
  retry delay, guest passes, guest lobby subscription with polling fallback) and public guest routes with throttling.
  Files: `mt/access/join.service.ts`, `mt/lobby/meeting-lobby.service.ts`, `mt/lobby/meeting-lobby.controller.ts`,
  `mt/lobby/public-guest.controller.ts`. Test: AC-4 and AC-5 cases.
- [ ] **T14**. Notices intake `sessions/notice.controller.ts` and queue (signature, store, sessions, attendance segments,
  peak, second device, reconnection without duplicates). Files: `mt/sessions/notice.controller.ts`,
  `mt/sessions/meetings-notices.worker.ts`, `mt/sessions/meeting-session.service.ts`. Test: out-of-order and duplicate
  notices.
- [ ] **T15**. Host controls `controls/*` (server-side where supported, client request otherwise). Files:
  `mt/controls/host-controls.service.ts`, `mt/controls/host-controls.controller.ts`. Test: AC-6 with the simulated
  adapter in both modes.
- [ ] **T16**. Polls as core polls hosted by the session (`polls/meeting-session-poll-host.policy.ts`,
  `@PollHostAccessPolicy()` for `MeetingSession`) and chat link through `MEETINGS_CHAT` with the data-channel fallback.
  Test: one vote per participant; results kept; a guest who left cannot vote.
- [ ] **T17**. Limits and sweeps (participant and duration limits, warnings, empty-room end). Files:
  `mt/sessions/meeting-limits.service.ts`, `mt/sessions/sessions-sweep.scheduler.ts`. Test: room full; warning 5 minutes
  before the limit.
- [ ] **T18**. Scheduling `schedule/*` through `MEETINGS_CALENDAR` with the appointment fallback (`inviteeEmployeeIds`),
  join opening before the start, event changes followed. Files: `mt/schedule/meeting-schedule.service.ts`,
  `mt/schedule/meeting-schedule.controller.ts`, `mt/schedule/calendar-event.consumer.ts`. Test: AC-8 both ways.
- [ ] **T19**. Links and timelines `links/*` (record links, record sessions route, `RECORD_TIMELINE_SOURCES` entry).
  Files: `mt/links/meeting-links.service.ts`, `mt/links/meeting-links.controller.ts`, `mt/links/meeting-timeline.source.ts`.
  Test: unreadable record hides the session.
- [ ] **T20**. `MEETINGS_ROOMS` service and bindings (calendar conferencing, learning, recruitment with today's
  candidate interviews as a record type, CRM transcripts, chat calls with one room per conversation and one live session
  per room). Files: `mt/rooms/meeting-rooms.port.ts`, `apps/api/src/plugin-composition.ts`. Test: attendance answered
  for an event occurrence; a second chat call start answers the live session.
- [ ] **T21**. Agenda items seeded from the appointment's `agenda` text and updated on its edits, items added in the
  meeting appended to the text (never rewritten), and shared notes through `MEETINGS_NOTES`. Files:
  `mt/agenda/agenda-items.service.ts`, `mt/agenda/appointment-agenda.sync.ts`, `mt/agenda/agenda.controller.ts`,
  `mt/notes/meeting-notes.service.ts`. Test: concurrent edits keep the later one with author; an agenda typed in the
  appointment form shows as items; an item added in the meeting shows in the appointment; the typed text is unchanged
  after items are ticked.
- [ ] **T22**. Diagnostics routes; personal choices in `uiPreferences.meetings` (`IMeetingsUiPreferences`) through
  `PUT /user/ui-preferences`, devices kept in the browser. Files: `mt/diagnostics/meeting-diagnostics.service.ts`,
  `mt/diagnostics/meeting-diagnostics.controller.ts`, `packages/contracts/src/lib/user.model.ts`. Test: report stored
  with figures; preferences follow the user; another feature's preference key unchanged.
- [ ] **T23**. Outbox events, signals and notification categories (plan §5). Files: `mt/events/meetings-outbox.ts`,
  `mt/events/meetings-signals.ts`, `mt/events/meetings-notification-categories.ts`. Test: signals reach targeted users
  only.
- [ ] **T24**. Recordings `recordings/*` (preflight, grants, starts and stops, notices to participants and lobby,
  maximum length, parts with checksums, resume, gaps, finalise into `drive` through `MEETINGS_FILES`, readers). Files:
  `mt/recordings/meeting-recording.service.ts`, `mt/recordings/meeting-recording.controller.ts`,
  `mt/recordings/recorder-upload.controller.ts`, `mt/recordings/meetings-recordings.worker.ts`,
  `mt/recordings/recording-monitor.scheduler.ts`. Test: interruption under 2 minutes yields an incomplete recording;
  grant reuse refused. Holds and retention are T49.
- [ ] **T25**. Encryption rules (no recording, captions or transcripts; no encryption during recording). Files:
  `mt/access/encryption-rules.ts`, `mt/recordings/meeting-recording.service.ts`. Test: AC-11.
- [ ] **T26**. Transcripts `transcripts/*` (per-speaker or chunked transcription through `MEETINGS_SPEECH`, segments,
  corrections, downloads, kept captions with notice, retention). Files: `mt/transcripts/meeting-transcript.service.ts`,
  `mt/transcripts/meeting-transcript.controller.ts`, `mt/transcripts/meetings-transcripts.worker.ts`. Test: segments
  timed; corrections audited.
- [ ] **T47**. Room defaults (spec FR-13): a room owner sets microphones or cameras off on entry, chat and screen share for
  everyone or hosts only, recording allowed, record automatically, captions allowed, transcript language, participant and
  duration limits within the organization's limits, and end-to-end encryption where the adapter supports it; the join
  answer carries them to the client and the adapter. Files: `mt/rooms/room-settings.ts`, `mt/rooms/meeting-room.service.ts`,
  `mt/access/join.service.ts`. Test: a limit above the organization's refused; encryption refused on an adapter without
  it; a member joining a "cameras off" room gets a token whose grants start with the camera off.
- [ ] **T48**. GraphQL reads (spec FR-70): `meetingRooms`, `meetingSessions`, `meetingRecordings` beside the REST reads,
  under the same access checks. Files: `mt/graphql/meetings.resolver.ts`, `mt/graphql/schema-extensions.ts`. Test:
  resolver spec mirrors REST; a non-reader of a recording gets nothing.
- [ ] **T49**. Retention, holds and listen audit (spec FR-68): holds as hold register rows through
  `MEETINGS_LEGAL_HOLDS`; the retention handler of the declared kinds deletes recordings, clips and transcripts past
  retention unless held, keeping attendance and a deletion mark, with a `job_execution` row per run; every listen,
  download and clip share in the audit trail. Files: `mt/retention/meetings-retention.handler.ts`,
  `mt/retention/meetings-retention.scheduler.ts`, `mt/recordings/recording-hold.service.ts`. Test: a held recording
  survives its retention; a deleted one keeps attendance and its mark; a stream request writes one audit entry.

## Phase 3 — UI surfaces

- [ ] **T27**. `packages/plugins/meetings-react-ui`: `DeviceCheck`, `Lobby`, `MeetingRoom` (layouts, controls, screen share,
  participants panel), `JoinButton`; keyboard shortcuts and announcements. Files:
  `meetings-react-ui/src/lib/components/{DeviceCheck,Lobby,MeetingRoom,JoinButton}.tsx`,
  `meetings-react-ui/src/lib/meetings-react-ui.plugin.ts`. Test: component and keyboard tests.
- [ ] **T28**. `packages/plugins/meetings-ui`: meetings page, room route, rooms page, menu entry and guards, Settings →
  Meetings. Files: `meetings-ui/src/lib/meetings-ui.plugin.ts`, `meetings-ui/src/lib/pages/meetings/meetings-page.component.ts`,
  `meetings-ui/src/lib/pages/room/meeting-room-page.component.ts`, `meetings-ui/src/lib/pages/rooms/meeting-rooms-page.component.ts`,
  `meetings-ui/src/lib/pages/settings/meetings-settings-page.component.ts`. Test: rendering specs.
- [ ] **T29**. In-room panels: host controls, chat, reactions, hands, polls, effects, statistics, sounds. Files:
  `meetings-react-ui/src/lib/components/panels/{HostControlsPanel,ChatPanel,ReactionsBar,HandsPanel,PollsPanel,EffectsPanel,StatisticsPanel,SoundsSettings}.tsx`.
  Test: rendering specs; hands in raise order.
- [ ] **T30** (parallel). `public-layout-ui` guest route `/share/meet/:roomKey` and clip route. Files:
  `public-layout-ui/src/lib/components/meeting-guest/meeting-guest-page.component.ts`,
  `public-layout-ui/src/lib/components/meeting-clip/meeting-clip-page.component.ts`,
  `public-layout-ui/src/lib/public-layout.routes.ts`. Test: rendering specs; existing public routes unchanged.
- [ ] **T31**. Session page (attendance, player, transcript, agenda, notes, polls) and i18n keys `MEETINGS.*` and email
  templates in every locale. Files: `meetings-ui/src/lib/pages/session/meeting-session-page.component.ts`,
  `packages/ui-core/i18n/assets/i18n/en.json` (and every other locale file there),
  `mt/email-templates/meeting-recording-available/`, `mt/email-templates/meeting-summary/`. Test: key presence check.
- [ ] **T32**. Recording notice, preflight dialog and indicator in the room; library page. Files:
  `meetings-react-ui/src/lib/components/{RecordingNotice,RecordingPreflightDialog,RecordingIndicator}.tsx`,
  `meetings-ui/src/lib/pages/library/meeting-library-page.component.ts`. Test: rendering specs.
- [ ] **T33**. Recording readers on record timelines and the recording report definition. Files:
  `mt/links/meeting-timeline.source.ts`, `mt/reports/meetings-report.definitions.ts`. Test: guest never reads.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T34**. Captions worker (adapter audio streams, `transcribeStream`, caption signals or data channel). Files:
  `mt/captions/captions.worker.ts`, `mt/captions/caption-signals.ts`. Test: delay under 2 s with the simulated stream.
- [ ] **T35**. Transcript search (global search source over segments, `/meetings/search`, jump to sentence). Files:
  `mt/transcripts/transcript-search.source.ts`, `mt/transcripts/transcript-search.controller.ts`. Test: phrase found at
  its moment within reader rights.
- [ ] **T36**. MCP tools `packages/mcp-server/src/lib/tools/meetings.ts` (plan §7) with previews; registration with
  `AiChatToolRegistry`. Test: previews write nothing; rights respected.
- [ ] **T37**. Report definitions of spec FR-73 with the read-only fallback viewer; OpenAPI regenerated; SDK regeneration
  noted; adapter author guide and self-hosting notes (notice address, recorder) in the plugin README. Files:
  `mt/reports/meetings-report.definitions.ts`, `mt/reports/meetings-report-viewer.ts`, `packages/plugins/meetings/README.md`,
  `packages/core/src/lib/bootstrap/swagger.ts`. Test: figures on the demo data set. Personal data handlers are T50.

## Phase 5 — Advanced capabilities

- [ ] **T38**. Recording queue (positions, order, cancel, restart safety). Files: `mt/recordings/recording-queue.service.ts`,
  `mt/recordings/meetings-recordings.worker.ts`. Test: queued request starts when a recorder frees.
- [ ] **T39**. Agenda proposals `agenda/agenda-proposals.service.ts` over `registerMeetingAgendaSources` (crm deals,
  helpdesk tickets, core tasks, carried action items). Test: AC-15.
- [ ] **T40**. Summaries `summaries/*` (proposal with sources through `MEETINGS_TEXT_GENERATION`, review UI, approval
  writes notes through `MEETINGS_RECORD_NOTES` and tasks, carried items, mail to members). Files:
  `mt/summaries/meeting-summary.service.ts`, `mt/summaries/meeting-summary.controller.ts`,
  `meetings-ui/src/lib/pages/session/summary-review.component.ts`. Test: nothing written before approval; marks on
  written items.
- [ ] **T41**. Translated captions per participant language. Files: `mt/captions/caption-translation.ts`,
  `mt/captions/captions.worker.ts`. Test: one participant receives translated captions.
- [ ] **T42**. Clips (create, audiences, link audience as a core `shared_entity` link with expiry and revocation, sign-in
  option, views audited). Files: `mt/clips/meeting-clip.service.ts`, `mt/clips/meeting-clip.controller.ts`,
  `mt/clips/public-clip.controller.ts`. Test: expired link refused; nothing beyond the clip served; revoking deletes the
  link.
- [ ] **T43**. Attended minutes handed to the calendar's tracked-time offers (`CALENDAR_TIME_OFFERS`) on session end, and
  the person-hours meter. Files: `mt/attendance/calendar-time-offers.handler.ts`,
  `meetings-react-ui/src/lib/components/PersonHoursMeter.tsx`. Test: one offer per person and session; no offer without
  the calendar.
- [ ] **T44**. Demo data: rooms, a team room, sessions with attendance, a recording with transcript and an approved
  summary on the simulated adapter; user docs and `docs/specs/README.md` row; spec status `Implemented` when phase 5 lands.
  Test: demo seed on SQLite.
- [ ] **T45**. Compatibility guarantees (spec FR-2, AC-21): Ever Teams' own token routes keep issuing tokens beside the
  platform's; for `FEATURE_MEETINGS`, the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. Files:
  `mt/meetings.features.ts`; in Ever Teams `apps/web/app/api/livekit/route.ts` and `apps/web/app/api/auth/meet/jwt/route.ts`
  stay unchanged. Test: Ever Teams token route specs pass with the feature on; a tenant created before the change keeps
  the feature off.
- [ ] **T46**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `PERFORMANCE_MEETINGS`, `RECRUITMENT_MEETINGS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.
- [ ] **T50**. Personal data handlers: copy and erasure handlers for participants, guest passes, transcript
  speakers and diagnostics, declared to the privacy registry; erasure replaces names and addresses, keeping attendance
  counts. Files: `mt/privacy/meetings-privacy.registry.ts`. Test: erasure removes names; a copy request lists the
  person's sessions, recordings and transcript segments.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence and existing meetings | T2 |
| FR-2 | §3.1 Presence and existing meetings | T45 |
| FR-3 | §3.1 Presence and existing meetings | T9, T10, T12 |
| FR-4 | §3.1 Presence and existing meetings | T11 |
| FR-5 | §3.2 Media servers | T1, T8 |
| FR-6 | §3.2 Media servers | T9, T10, T11 |
| FR-7 | §3.2 Media servers | T13 |
| FR-8 | §3.2 Media servers | T8, T14 |
| FR-9–FR-10 | §3.3 Rooms | T12 |
| FR-11 | §3.3 Rooms | T20 |
| FR-12 | §3.3 Rooms | T12, T13 |
| FR-13 | §3.3 Rooms | T47 |
| FR-14 | §3.3 Rooms | T12, T15 |
| FR-15 | §3.3 Rooms | T12 |
| FR-16 | §3.4 Joining | T27 |
| FR-17–FR-19 | §3.4 Joining | T13 |
| FR-20 | §3.4 Joining | T13, T14 |
| FR-21 | §3.4 Joining | T17 |
| FR-22 | §3.4 Joining | T18, T28 |
| FR-23–FR-25 | §3.5 In the room | T27 |
| FR-26 | §3.5 In the room | T15 |
| FR-27 | §3.5 In the room | T16, T29 |
| FR-28 | §3.5 In the room | T29 |
| FR-29 | §3.5 In the room | T16 |
| FR-30 | §3.5 In the room | T29 |
| FR-31 | §3.5 In the room | T22, T29 |
| FR-32 | §3.5 In the room | T22 |
| FR-33 | §3.5 In the room | T43 |
| FR-34–FR-37 | §3.6 Scheduling and the calendar | T18 |
| FR-38 | §3.7 Meetings on records and other features | T19, T20 |
| FR-39 | §3.7 Meetings on records and other features | T19 |
| FR-40–FR-41 | §3.7 Meetings on records and other features | T20 |
| FR-42–FR-43 | §3.8 Recording | T24 |
| FR-44 | §3.8 Recording | T24, T32 |
| FR-45–FR-47 | §3.8 Recording | T24 |
| FR-48 | §3.8 Recording | T38 |
| FR-49 | §3.8 Recording | T24, T33 |
| FR-50 | §3.8 Recording | T24 |
| FR-51 | §3.8 Recording | T25 |
| FR-52 | §3.9 Captions and transcripts | T34 |
| FR-53 | §3.9 Captions and transcripts | T41 |
| FR-54 | §3.9 Captions and transcripts | T26 |
| FR-55 | §3.9 Captions and transcripts | T26, T34 |
| FR-56 | §3.9 Captions and transcripts | T26, T35 |
| FR-57 | §3.10 Agenda, notes and summaries | T21 |
| FR-58 | §3.10 Agenda, notes and summaries | T39 |
| FR-59 | §3.10 Agenda, notes and summaries | T21 |
| FR-60–FR-62 | §3.10 Agenda, notes and summaries | T40 |
| FR-63 | §3.11 Recording library and clips (advanced) | T32, T35 |
| FR-64 | §3.11 Recording library and clips (advanced) | T42 |
| FR-65 | §3.12 Attendance and time | T14 |
| FR-66 | §3.12 Attendance and time | T43 |
| FR-67 | §3.13 Privacy and retention | T7, T28 |
| FR-68 | §3.13 Privacy and retention | T49 |
| FR-69 | §3.13 Privacy and retention | T11, T28 |
| FR-70 | §3.14 API, agents, events and reports | T13, T30, T48 |
| FR-71 | §3.14 API, agents, events and reports | T36 |
| FR-72 | §3.14 API, agents, events and reports | T23 |
| FR-73 | §3.14 API, agents, events and reports | T33, T37 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flags default off; enabling them in dev with the simulated adapter shows the feature end to end; with them off,
  Ever Teams meetings and appointment scheduling behave as before.
- Constitution gates in `spec.md` §9 confirmed.
- The adapter contract suite passes for the simulated adapter and both shipped adapters; room names match today's client.
- Every acceptance criterion of `spec.md` §7 demonstrated on the demo data set.
