# Feature Specification: Meetings

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `meetings`
**Branch**: `feat/meetings`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_MEETINGS` (new tenant feature, default off); the plugin loads only when `GAUZY_MEETINGS_ENABLED` is exactly `true`; recording, transcripts and summaries are further organization switches, off by default.

---

## 1. Overview

Video meetings exist today only inside Ever Teams, for signed-in members of a tenant, on one of two open media servers
the deployment runs, with rooms scoped to the tenant and one-hour join tokens signed by the Ever Teams web server. The
platform keeps no record of a meeting: a scheduled meeting is an employee appointment whose place is the link, nobody
outside the tenant can join, nothing is recorded, and chat, reactions and the people list vanish with the call. This
feature makes meetings a platform capability: **rooms** (instant, scheduled, persistent per team or record) with access
rules and roles; **join tokens** issued by the platform through **media server adapters**; a **join flow** with device
check, lobby and **guests** by link; **in-room features** (audio, video, screen share, layouts, host controls, chat,
reactions, raised hands, polls, effects, diagnostics); **sessions and attendance**; **recording** with consent notices,
isolated recorders and a library; **live captions, transcripts and summaries**; **scheduling from the calendar**; and
**meetings on records** (deals, tickets, tasks, interviews, live classes). Clients: the Angular app (`meetings-ui` with
the room from `meetings-react-ui`), Ever Teams through the same API, public guest pages, the MCP server and the SDKs.

Advanced capabilities: an **agenda drafted from the linked records** (open tasks, deal stage, ticket
state, last meeting's open actions); **summaries with decisions and action items** proposed with their transcript
sources and written to the linked records and tasks only after approval; **live captions translated** into each
participant's language; a **recording library with search inside transcripts and shareable clips** with expiry; a
**recording queue** instead of a refusal when recorders are busy; **attendance that becomes tracked time** on the linked
task and a live **person-hours meter** for the organizer; and **agent tools** that read transcripts and propose
follow-ups under the caller's rights.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee with `MEETINGS_HOST`, **when** they start an instant meeting from the meetings page, **then** a room opens after a device check with camera, microphone and speaker test, and the copied link lets colleagues join directly.
- **Given** a link created earlier by Ever Teams for a team meeting, **when** a colleague opens it after the feature is switched on, **then** they reach the same media room as people still joining from the old client.
- **Given** a persistent room for the team "Platform", **when** a member opens it any day, **then** it keeps its name, members, roles and settings, and each time it goes live a new session with its own attendance is recorded.
- **Given** a calendar event with a meeting room and an outside guest, **when** the guest opens the personal link in the invitation, **then** they type their name, wait in the lobby, and the host admits them; uninvited guests with the public link wait until a host admits or rejects them.
- **Given** a host in a session, **when** they mute everyone, lower all hands, remove a participant and ban them from the room, **then** the media server enforces each action where the adapter supports it and the banned person cannot rejoin.
- **Given** a session in progress, **when** a host starts recording, **then** a preflight shows the expected length and storage, every participant sees a notice and an indicator, and new joiners are told before they enter.
- **Given** the session ends, **when** the recording is processed, **then** the host gets "recording available" with duration and size, the file sits in the room's folder of `drive`, and readers of the linked deal see it on the deal's timeline.
- **Given** transcripts on for the organization, **when** the recording is available, **then** a transcript with speakers and times follows, and the host is offered a summary with decisions and action items, each showing the sentences it came from (advanced).
- **Given** the host approves the summary after editing one action item, **then** two tasks are created with assignees and due dates on the linked project, the summary is written as a note on the linked deal, and both are marked as generated and approved by the host (advanced).
- **Given** a meeting linked to a deal and a ticket, **when** the organizer opens the meeting a day before, **then** a proposed agenda lists the deal's stage and next step, the ticket's state and the open action items of the last meeting on the same deal (advanced).
- **Given** captions on and a participant who reads Spanish, **when** others speak English, **then** that participant reads captions in Spanish while others read English (advanced).
- **Given** the recording library, **when** a manager searches "pricing tier", **then** sessions whose transcripts contain it are listed with the moments it was said; they share a two-minute clip with a link that expires in 7 days (advanced).
- **Given** a live class of a cohort held in a room, **when** it ends, **then** learning reads each learner's join, leave and attended minutes.
- **Given** a 50-minute session linked to a task, **when** it ends, **then** each attending employee is offered to log their attended minutes on the task (advanced).

### 2.2 Edge cases & failures

- **Given** `FEATURE_MEETINGS` off, **then** every new route answers `404`, no meetings menu shows, and Ever Teams meetings and appointment-based scheduled meetings work as today.
- **Given** no media server configured for the organization or the deployment, **then** meetings pages explain that a media server is needed, and no room can go live.
- **Given** a user of another tenant with a leaked link, **then** the token request is refused and the media room name never resolves across tenants.
- **Given** a room with guests off, **then** the public page refuses guest joins with a clear message, also for links shared before the switch changed.
- **Given** the participant limit reached, **then** the next person is told the room is full; the host may raise the room limit up to the organization's limit.
- **Given** a person already in a session joining from a second device, **then** they are asked whether to move the call there; on yes the first connection closes.
- **Given** a dropped network, **then** the client reconnects with the same identity and replaces the stale connection, without a second entry in attendance.
- **Given** recorders all busy, **then** the recording request waits in a queue with its position shown to the host and starts when one frees, or the host cancels it (advanced).
- **Given** a recorder that fails mid-session and recovers, **then** the recording continues, the gap is recorded and the result is marked incomplete with the gap list; if it never recovers, the parts recorded are kept and the host is told.
- **Given** an end-to-end encrypted room, **then** recording, server captions and transcripts are unavailable, and encryption cannot be switched on while a recording runs.
- **Given** no AI provider with speech-to-text, **then** captions, transcripts and summaries are not offered; recording still works.
- **Given** an organization that set a retention period and a recording past it without a legal hold, **then** it and its transcript are deleted and the session keeps its attendance and a "recording deleted" mark.
- **Given** two hosts editing the agenda at once, **then** both edits appear; conflicting edits of one item keep the later and show who changed it.

## 3. Functional Requirements

### 3.1 Presence and existing meetings

- **FR-1** The system MUST load only when `GAUZY_MEETINGS_ENABLED` is exactly `true` and answer every new route with `404` while `FEATURE_MEETINGS` is off for the tenant.
- **FR-2** The system MUST keep Ever Teams meetings, its token routes and scheduled meetings stored as employee appointments working as today with the feature on or off; the platform's token routes are added beside Ever Teams' own, which stay; a tenant that has not switched the feature on keeps it off, also after any later change of the default for new tenants.
- **FR-3** The system MUST name media rooms so that a room reached by an existing Ever Teams link and the same room reached through the platform meet in the same media room, scoped to the tenant.
- **FR-4** The system MUST tell any client which meeting capabilities exist for the current user and room (media adapter, guests, lobby, server-side host controls, recording, captions, transcripts, summaries, encryption).

### 3.2 Media servers

- **FR-5** The system MUST reach media servers only through adapters that declare their capabilities (join tokens, participant events, server-side mute and removal, lobby, recording, per-speaker audio, live audio stream, end-to-end encryption), and offer only what the room's adapter supports.
- **FR-6** The system MUST ship adapters for the two open media servers Ever Teams already uses, configured per deployment from its settings and optionally per organization by a user with `MEETINGS_SETTINGS_MANAGE` (address, credentials stored encrypted and never returned, default flag, test connection).
- **FR-7** The system MUST issue join tokens only for one room, one identity and a role, valid for at most one hour (the session continues after expiry; reconnection asks for a new one), and never sign tokens in a client; the existing Ever Teams token routes keep their own lifetime and behaviour (FR-2).
- **FR-8** The system MUST verify every adapter notice (participant joined or left, room started or finished, recording states) with the adapter's signature and apply each once.

### 3.3 Rooms

- **FR-9** A user with `MEETINGS_HOST` can start an instant room (optional title) and copy its link; the room stays reachable by that link until its owner closes it.
- **FR-10** A user with `MEETINGS_ROOMS_MANAGE` can create persistent rooms for a team or the organization with a name, members and settings, and every team can have one team room.
- **FR-11** The system MUST create a room for a calendar event, a record or a chat conversation when asked by those features, and reuse one room for all occurrences of a repeating event.
- **FR-12** A room's owner or host can set who enters directly: anyone of the organization, only room members and invited participants (others ask to join), or nobody but hosts (everyone else waits in the lobby); and whether guests may join (organization setting first).
- **FR-13** A room's owner can set its defaults: microphones or cameras off on entry, chat for everyone or hosts only, screen share for everyone or hosts only, recording allowed, record automatically, captions allowed, transcript language, participant limit and duration limit within the organization's limits, and end-to-end encryption where supported.
- **FR-14** The system MUST give rooms the roles owner, host, co-host, member and guest; an owner or host can promote co-hosts, and hosts and co-hosts share every host control.
- **FR-15** An owner can close a room; links then show "closed"; a closed room can be reopened within 30 days.

### 3.4 Joining

- **FR-16** The system MUST show a device check before joining: camera preview, microphone level, speaker test, device choice, starting muted or with camera off, and who is already in the room for members.
- **FR-17** The system MUST admit directly the people FR-12 lets in, put others in the lobby, and notify hosts of every lobby request with admit and reject; a rejected person sees why and cannot ask again for 5 minutes.
- **FR-18** A guest can join by link with a name (and an optional address) without an account, when guests are allowed; guests always wait in the lobby unless they hold a personal link from an invitation, are shown as guests to everyone, and their tokens last at most one hour like every join token (FR-7); a guest who stays longer keeps the session, and a reconnection asks for a new token through the guest's pass.
- **FR-19** A host can ban a participant from the room; banned members and banned guest addresses are refused at the token request.
- **FR-20** The system MUST ask a person already connected who joins from another device whether to move the call there, close the first connection on yes, and replace a stale connection on reconnection without a second attendance entry.
- **FR-21** The system MUST refuse joins above the room's participant limit with "room full" and end a session at the duration limit after a warning 5 minutes before.
- **FR-22** The system MUST list on the meetings page the user's upcoming meetings from the calendar (or their appointments when calendars are off), live rooms they may join, their persistent rooms and recent sessions.

### 3.5 In the room

- **FR-23** A participant can mute and unmute, switch camera on and off, choose devices during the call, use push-to-talk, and see a network quality indicator per participant.
- **FR-24** A participant can share a screen or a window with its sound where the browser allows; a shared screen becomes the main view with participants beside it.
- **FR-25** A participant can choose grid (with overflow pages), speaker and pinned layouts, pin a participant for themselves, and hide self view; controls hide when idle and return on any key or movement.
- **FR-26** A host can mute one or all, stop someone's camera or screen share, lower one or all hands, remove a participant, end the session for everyone, and lock the room so nobody else joins; actions are enforced by the media server where the adapter supports them, otherwise asked of the participant's client.
- **FR-27** A participant can chat with everyone in the room (links, mentions, emoji); a host can restrict chat to hosts; when chat is loaded, the messages are kept in a conversation linked to the room and readable afterwards by participants, otherwise they last for the call.
- **FR-28** A participant can send reactions that float over the video and raise or lower a hand; hosts see the hands in raise order.
- **FR-29** A host can run polls (single or multiple choice, anonymous or named); participants vote once and change their vote while the poll is open; results show when the host closes it and stay with the session; they are the platform's polls, hosted by the session.
- **FR-30** A participant can blur their background, replace it with an image the organization provides or one they upload, and suppress background noise, processed on their device where it can.
- **FR-31** A participant can open a statistics panel (bit rates, packet loss, resolution, codec, server region) and report a problem, which stores the panel's figures and their note for administrators.
- **FR-32** A participant can choose sounds for joins, leaves, hands and chat, and these preferences follow them across devices as part of their user preferences (device choices stay on each device).
- **FR-33** The system MUST show a person-hours meter to hosts: participants present multiplied by elapsed time (advanced).

### 3.6 Scheduling and the calendar

- **FR-34** A user can schedule a meeting from the meetings page, a calendar event, a record or a team page: the room is created with the event of `calendar-and-scheduling`, the join link is on the event, in invitations and reminders, and calendar participants are the room's invited participants.
- **FR-35** The system MUST fall back, when calendars are off, to an employee appointment with the room link as its place and the invited colleagues as appointment invitees, so the existing notices and reminders apply.
- **FR-36** The system MUST open the join from an event at most 15 minutes before its start (room setting) for participants, and at any time for hosts.
- **FR-37** The system MUST follow changes of the event: a cancelled event closes its room for that occurrence; new participants become invited participants.

### 3.7 Meetings on records and other features

- **FR-38** A user can start or schedule a meeting from a deal, contact, ticket, task, project, candidate interview or any registered record type they may read; the room is linked to the record.
- **FR-39** The system MUST show sessions of rooms linked to a record (date, attendees, length, recording, transcript, summary) on its timeline only to viewers who may read the record and the meeting.
- **FR-40** The system MUST offer other features one contract to create a room for their record or event, get its join link, read attendance of a session or occurrence and read its transcript, so live classes, interview rounds, one-to-ones, calendar events and CRM summaries use the same rooms.
- **FR-41** The system MUST offer chat a contract to start a room for a conversation and post its link, and to end it when the conversation's call ends; a conversation has one room, and a room one live session at a time, which is chat's call (an audio-only session for a quick call).

### 3.8 Recording

- **FR-42** A host or co-host with `MEETINGS_RECORD` can start and stop a recording of the shared view (active speaker, screen share and participant strip in a fixed layout) where the organization and room allow it.
- **FR-43** The system MUST show a preflight before recording with the expected length (the time left in the scheduled event plus a margin, setting default 30 minutes; two hours without an event) and the storage it may use, and refuse when the room's storage quota of `drive` cannot hold it.
- **FR-44** The system MUST tell every participant when recording starts and stops with a notice and a lasting indicator, tell people in the lobby and the device check before they join, and record who started and stopped it.
- **FR-45** The system MUST stop a recording at its maximum length (organization setting, default 6 hours), warning hosts 5 minutes before; a host may then start a new recording, kept as the next part of the session.
- **FR-46** The system MUST let only an isolated recorder that is not a participant record the room, authorised by a single-use grant bound to one recording and a deadline, uploading in checked parts that can resume.
- **FR-47** The system MUST continue a recording after a recorder interruption when it recovers within 2 minutes, record each gap, and mark the result incomplete with its gaps; parts recorded before a failure are kept.
- **FR-48** (advanced) The system MUST queue recording requests when no recorder is free, show the position to hosts, start in order, and let a host cancel a queued request.
- **FR-49** The system MUST store the recording as a file of `drive` in the room's folder (record's folder when linked, else the owner's), readable by the session's participants, the room's members, readers of linked records and holders of `MEETINGS_RECORDINGS_VIEW_ALL`, never by guests.
- **FR-50** The system MUST tell the host and the room owner when a recording is available, incomplete or failed, with duration, size and gaps, and keep each recording's state, duration, size, gaps and checksum.
- **FR-51** The system MUST refuse recording, server captions and transcripts in an end-to-end encrypted room and refuse turning encryption on while a recording runs.

### 3.9 Captions and transcripts

- **FR-52** A participant can switch on live captions in a room that allows them where the adapter streams audio and an AI provider transcribes live; captions show the speaker's name and appear within 2 seconds.
- **FR-53** (advanced) A participant can read captions translated into their language, chosen in the room, while others keep the original.
- **FR-54** The system MUST, when transcripts are on for the organization, transcribe each available recording with the speakers attributed per participant where the adapter records separate audio, else per detected voice, with times, in the room's language or detected language.
- **FR-55** The system MUST let the organization keep live captions as the transcript of an unrecorded session (setting, default off), telling participants when captions start that they are kept.
- **FR-56** A reader of a recording can read and search its transcript, jump the player to any sentence, correct sentences (corrections kept with who and when), and download it as text or captions file.

### 3.10 Agenda, notes and summaries

- **FR-57** An organizer can keep an agenda of items with owner and minutes on the meeting; participants see it before and during the session and tick items off; a scheduled meeting's existing agenda text becomes its first items and its later edits update them; the text is kept as people wrote it (items added in the meeting are appended to it, nothing written there is removed or reformatted), so every client that shows the appointment's agenda keeps showing it.
- **FR-58** (advanced) The system MUST propose an agenda from the linked records (deal stage and next step, ticket state and last reply, open tasks of a linked project, open action items of the last session with the same record or series), which the organizer edits before it is shown.
- **FR-59** A participant can open shared notes for the session as a document of the documents hub linked to the meeting, edited together during the call.
- **FR-60** (advanced) The system MUST propose after a transcript a summary, decisions and action items (title, assignee, due date) each with its source sentences, and write nothing until a host approves, edits or discards it.
- **FR-61** (advanced) On approval, the system MUST write the summary and decisions as a note on each linked record, create the action items as tasks on the linked project or the assignee's list, mark them "generated, approved by" the approver, and carry unfinished action items to the next agenda of the series.
- **FR-62** The system MUST send participants who are members the approved summary and the link to the recording per their preferences.

### 3.11 Recording library and clips `(advanced)`

- **FR-63** (advanced) A user can browse the recordings they may read by room, record, participant, date and length, and search inside transcripts with results at the moments the words were said.
- **FR-64** (advanced) A reader of a recording can create a clip (start, end, title) and share it with room members, the organization or a link with an expiry (default 7 days, at most 90) and an optional sign-in requirement; clip links are the platform's public record links, reveal nothing beyond the clip and can be revoked.

### 3.12 Attendance and time

- **FR-65** The system MUST record per session each participant's joins and leaves, attended minutes, role and device count, and the session's start, end and peak count.
- **FR-66** (advanced) The system MUST offer each attending employee, when a session linked to a task or project ends, to log their attended minutes as tracked time on it, through the calendar's tracked-time offer, which this feature feeds with attendance, once per person and session or occurrence; without the calendar no offer is made.

### 3.13 Privacy and retention

- **FR-67** A user with `MEETINGS_SETTINGS_MANAGE` can set the organization's switches (guests, recording, automatic recording allowed, captions, transcripts, summaries, keeping captions), limits (participants, duration, recording length), retention of recordings and transcripts (default: kept until the organization sets a period; the platform's retention policies for meeting recordings and transcripts, listed with the other retention policies where `access-control-and-security` is loaded), consent notice text, and whether participants must acknowledge the recording notice before media is sent.
- **FR-68** Where the organization has set a retention period (default: none, everything is kept), the system MUST delete recordings, clips and transcripts at the end of that period unless a legal hold is set by a holder of `MEETINGS_SETTINGS_MANAGE` (an entry of the platform's hold register, offered where that register is loaded), keeping attendance and a deletion mark, and record every listen, download and clip share in the audit trail.
- **FR-69** The system MUST never send media, captions or transcripts outside the media server and the organization's chosen AI provider, and name both on the settings page.

### 3.14 API, agents, events and reports

- **FR-70** The system MUST expose every capability through REST with idempotency keys on creating routes, public routes only for guest joins, lobby state and clip links, and GraphQL reads of rooms, sessions and recordings.
- **FR-71** (advanced) The system MUST offer MCP and in-app assistant tools to list rooms and sessions, create a room or schedule a meeting (preview first), read attendance, search transcripts, read a transcript, propose a summary and propose follow-up tasks; agents act within the caller's rights, and nothing an agent proposes is written before a person approves.
- **FR-72** The system MUST publish, with ids only, as automation triggers and webhook events: room created and closed, session started and ended, participant joined and left, recording started, available, incomplete and failed, transcript ready, summary approved.
- **FR-73** The system MUST register these report definitions (filters period, room, team, host, record type; table and chart; export and schedules through the report builder, a read-only view without it):

  | Report | Answers |
  | --- | --- |
  | Recordings | per session: state, gaps, length, size, checksum, who started it |
  | Sessions and attendance | sessions, attendees, attended minutes, guests and peak per room and team |
  | Meeting time | person-hours in meetings per team and week, by room kind and linked record type |
  | Summaries | summaries proposed, approved and discarded; action items created and completed |
  | Media quality | reported problems, reconnections and quality figures per adapter and region |

## 4. Non-Functional Requirements

- **Performance**: join token P95 < 300 ms; lobby admission visible to the guest < 1 s after the host's click; captions < 2 s behind speech; a recording available < 10 minutes after the end of a one-hour session on a deployment sized for the media server; transcript < 15 minutes and summary proposal < 2 minutes after that; library search P95 < 500 ms over 100,000 hours of transcripts per tenant.
- **Volume and concurrency**: rooms up to the adapter's capacity with an organization default of 100 participants; 1,000 concurrent sessions per deployment subject to media server sizing; one recording per session at a time; adapter notices idempotent.
- **Reliability**: notices stored before processing; attendance rebuilt from notices after downtime; recording parts checked and resumable; queued recordings survive a restart.
- **Security & privacy**: tenant-scoped room names; short-lived single-room tokens; guest proof never logged; recorder grants single-use; recordings readable per FR-49; listens audited; retention per FR-68. Leaving the platform: audio and video to the media server; audio and text to the organization's AI provider only with captions, transcripts or summaries on; invitation emails through the calendar.
- **Auditability**: who and when for room, role, ban, setting and adapter changes, recording starts and stops, listens, downloads, clips, corrections and summary approvals.
- **Accessibility and localization**: every control keyboard operable with labels and shortcuts (mute, camera, hand, leave), captions for people who do not hear, visual equivalents of sounds, announcements of joins and hands for screen readers; every string in all shipped locales; captions and summaries in the session language.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted (media server and recorders run by the deployment; notices need an address the media server reaches); works without calendar, chat, drive, CRM and AI providers, whose parts are then absent; OpenAPI and SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Media adapter, media account | A plugin connecting a media server; the deployment's or organization's connection to one |
| Room, room member | A meeting place with access rules, settings and roles; a person with a role in it |
| Session | One live period of a room, with its attendance and results |
| Participant | A member or guest in a session, with joins, leaves and minutes |
| Guest pass, lobby entry | A guest's admission by link; a wait for a host's decision |
| Recording, recording part | A recorded session with its state, gaps and file; one uploaded part |
| Transcript, segment | The text of a session; one timed sentence with its speaker |
| Agenda item, summary | A planned topic; proposed or approved summary, decisions and action items |
| Poll (platform), clip, meeting link | A vote hosted by a session; a shared excerpt of a recording; a room's link to a record |
| Meeting settings (platform settings), diagnostics | The organization's switches and limits; a stored problem report |

## 6. Out of Scope

- Calls over phone networks → `telephony`; starting a call from a chat conversation and quick calls → `chat-administration-and-clients` (FR-41 is its contract).
- Ever Teams meeting screens → the Ever Teams spec `workspace-collaboration-clients`.
- Events, invitations, answers and reminders → `calendar-and-scheduling` (FR-34 uses them); files, folders and quotas → `drive`; notes documents and co-editing → `documents-and-wiki`; conversations and their messages → `chat-messaging`.
- AI provider configuration, agent definitions and cost limits → `ai-agents-and-assistants`; notification preferences → `automation-and-notifications`.

## 7. Acceptance Criteria

- [ ] **AC-1** With `FEATURE_MEETINGS` off every new route answers `404` and Ever Teams meetings, its token routes and appointment-based scheduling pass their tests unchanged (FR-1, FR-2).
- [ ] **AC-2** A link created by Ever Teams and the same room opened in the Angular app meet in one media room with each shipped adapter; a user of another tenant is refused a token (FR-3).
- [ ] **AC-3** A token issued by the platform's join routes is single-room, single-identity, at most one hour, while the existing Ever Teams token routes keep today's lifetime (AC-1); adapter notices with a bad signature are refused; duplicates apply once (FR-2, FR-7, FR-8).
- [ ] **AC-4** Each of the three entry rules of FR-12 admits and holds the right people; a guest with the public link waits and is admitted; a banned guest address is refused.
- [ ] **AC-5** Joining from a second device moves the call on confirmation; a reconnection does not add an attendance entry; the participant limit refuses the next joiner (FR-20).
- [ ] **AC-6** Host controls (mute all, lower hands, remove, lock, end) are enforced server-side with an adapter that supports them and asked of clients otherwise (FR-26).
- [ ] **AC-7** Chat kept in a linked conversation when chat is loaded; polls record one vote per participant and keep results with the session (FR-27, FR-29, FR-41).
- [ ] **AC-8** A scheduled meeting creates the calendar event with the join link; with calendars off, an appointment with the link and invitees is created and notices go as today (FR-34–FR-36).
- [ ] **AC-9** Recording shows the preflight, notices and indicator; a recorder interruption under 2 minutes yields an incomplete recording with its gap; a busy recorder queues the request (advanced: queue; FR-43, FR-44, FR-47, FR-48).
- [ ] **AC-10** A recording lands in `drive` and is readable by participants, members and linked-record readers, not by guests; listens are audited; retention deletes it unless on hold (FR-49, FR-68).
- [ ] **AC-11** An encrypted room refuses recording and captions; encryption cannot start during a recording (FR-51).
- [ ] **AC-12** Captions appear within 2 s with the simulated adapter and a test speech provider; a translated caption stream reaches one participant (advanced: translation; FR-52, FR-53).
- [ ] **AC-13** A transcript with speakers and times is produced from a recording; corrections are kept; search jumps to the sentence (FR-54, FR-56).
- [ ] **AC-14** A proposed summary shows source sentences; approval creates tasks and a note on the linked deal and nothing is written before approval (advanced: summaries; FR-58, FR-60, FR-61).
- [ ] **AC-15** A proposed agenda lists the linked deal's stage, the ticket's state and open action items of the last session (advanced: agenda; FR-58).
- [ ] **AC-16** Library search finds a phrase at its moment; a clip link expires and reveals nothing beyond the clip (advanced: library; FR-63, FR-64).
- [ ] **AC-17** Attendance gives learning join, leave and minutes; attended minutes are offered as tracked time once (advanced: time; FR-65, FR-66).
- [ ] **AC-18** Every MCP tool of FR-71 answers within the caller's rights; previews write nothing.
- [ ] **AC-19** The five report definitions of FR-73 return the expected figures on the demo data set.
- [ ] **AC-20** Room controls pass keyboard and screen-reader checks; works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (§4).
- [ ] **AC-21** With `FEATURE_MEETINGS` on, an agenda typed in the appointment form keeps its text as written after items are ticked and added in the meeting (added items appended), and Ever Teams' own token routes still issue tokens (FR-2, FR-57).
- [ ] **AC-22** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-2).

## 8. Open Questions

- Breakout rooms, webinars with an audience mode and a shared whiteboard are not in this spec. Applied default: left out.
- Which media adapter is the default for new deployments. Applied default: the one the deployment's settings name; Ever Teams' current default is kept for its own client.
- Recording maximum of 6 hours, release of room joins 15 minutes before events, recordings and transcripts kept until the organization sets a retention period. Applied defaults, all settings.
- Guests always wait in the lobby unless invited personally (FR-18). Applied default.
- Keeping captions as a transcript is off by default and announced (FR-55). Applied default.
- In-meeting chat is kept only when chat is loaded (FR-27). Applied default.

## 9. Constitution Gates

- [x] I Plugin-first — new `packages/plugins/meetings`, `meetings-ui`, `meetings-react-ui`; media adapters as plugins.
- [x] II Tenant/organization scoping — every record carries tenant and organization; media room names include the tenant; public routes resolve the tenant from hashed tokens.
- [x] III Both ORMs, additive migrations — new tables only, three dialects.
- [x] IV Default-off flag; nothing removed — deploy flag and `FEATURE_MEETINGS` off; Ever Teams meetings and appointment scheduling untouched.
- [x] V Contracts and API first — contracts, adapter contract and REST before UI; one room contract for other features.
- [x] VI Permissions, privacy, security — new keys; single-room tokens, single-use recorder grants, encrypted credentials, audited listens, retention, verified notices.
- [x] VII Real-time through the event bus — outbox events; lobby, hands and captions as platform signals; media through the media server only.
- [x] VIII i18n and accessibility — keyboard room controls, captions, announced events, keys in every locale.
- [x] IX Tests accompany the change — unit, adapter contract suite, e2e with the simulated adapter, recording and transcript pipeline tests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../calendar-and-scheduling/spec.md`](../calendar-and-scheduling/spec.md)
- Used by: [`../learning-management/spec.md`](../learning-management/spec.md), [`../recruitment/spec.md`](../recruitment/spec.md), [`../crm-engagement/spec.md`](../crm-engagement/spec.md), [`../performance-management/spec.md`](../performance-management/spec.md), `chat-administration-and-clients`, the Ever Teams spec `workspace-collaboration-clients`
- Works with: [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md), [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md), [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md), [`../telephony/spec.md`](../telephony/spec.md), `drive`, `documents-and-wiki`, `chat-messaging`, `ai-agents-and-assistants`
- Code: `packages/core/src/lib/employee-appointment/` (incl. `meeting-notifications/`), `packages/plugins/ai-chat/src/lib/provider.types.ts` (`transcribe`), `packages/plugins/realtime/src/lib/realtime-signals.service.ts`, `packages/plugins/docs/`, `packages/plugins/public-layout-ui/`; Ever Teams: the meeting token routes under `apps/web/app/api/`, `apps/web/core/components/pages/meet/`, `apps/web/core/services/client/api/meetings/scheduled-meeting.service.ts`
