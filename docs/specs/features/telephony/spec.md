# Feature Specification: Telephony

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `telephony`
**Branch**: `feat/telephony`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_TELEPHONY` (new, default off); the plugin loads only when `GAUZY_TELEPHONY_ENABLED` is exactly `true`

---

## 1. Overview

The platform has no calling today: no provider, no call log, no click-to-call. Phone numbers sit on contacts, people,
employees and vendors, and a text message gateway setting exists for one kind of provider. This feature adds calls over
phone networks to every record that has a number: **provider accounts** through adapters that are separate plugins,
**agent profiles** with their numbers, device and messages, **routing of incoming calls** by weekly slots and teams with
a **live incoming call card** that shows who is calling, **click-to-call** from any phone field, **notes, tasks, a
summary and an outcome** on each call, a **call log and recordings** linked to every matching record and shown on its
timeline, and **number matching** across the platform. It serves the CRM, the helpdesk and any record type that
registers phone fields. A provider that also carries the organization's email or text messages is one account for all
its channels. Clients: the Angular app (`telephony-ui`, with the call card on every page, installable on phones), the
MCP server and the SDKs.

Advanced capabilities: **one adapter contract** for any provider, with browser calling, calls to the
agent's phone, recording, live audio and voicemail declared as capabilities; **sticky routing** that rings the owner of
the caller's record first; **live transcription with suggested answers** where the adapter streams audio; **after-call
summaries, outcome and next task proposed** from the recording and written only after approval; a **power dialler**
with local-presence numbers, calling windows in the party's local time, consent and do-not-contact checks;
**call time as tracked time** on the linked task, project or ticket, so calls feed billing and cost like any other work;
**transfer to a colleague** and **voicemail with transcription** where the adapter supports them; and **call
analytics**.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `TELEPHONY_SETTINGS_MANAGE`, **when** they add a provider account through an installed adapter with its credentials, switch recording on with the consent announcement and pick two of the account's numbers, **then** the account is verified, the numbers are listed, and the credentials are never shown again.
- **Given** a routing plan "Sales line: weekdays 08:00–18:00 team Sales, ring all at once, otherwise voicemail", **when** a known lead calls at 10:00, **then** the lead's owner's call card rings first for 10 s, then every available member of Sales; each card shows "Lena Park — lead, Park Foods, owner Ana" with the open deal; when Ben answers, the other cards close.
- **Given** a call from a number nobody has, **when** it rings, **then** the card shows the number as "Unknown" with "Create lead" and "Add to existing"; after the call Ben creates a lead and the call is linked to it.
- **Given** a deal page, **when** Ana clicks the person's phone number, **then** the call starts through her default account in the browser, the card shows dialling, ringing and in progress, and a call log exists with her as caller and the deal and person linked.
- **Given** a call in progress, **when** Ana types a note and creates the task "Send pricing by Friday", **then** both are attached to the call and appear on the deal; **when** the call ends, **then** she is asked for a summary and an outcome from the organization's list, and the outcome "Interested – send offer" proposes its follow-up task.
- **Given** a recorded call, **when** a manager with `TELEPHONY_RECORDINGS_LISTEN` opens it on the deal's timeline, **then** the recording plays in place; a colleague who cannot read the deal does not see the call at all.
- **Given** the call logs page, **when** a user filters "missed, incoming, this week, Sales line", **then** they see the missed calls with caller matches and a "Call back" action on each.
- **Given** an agent on a ticket whose contact has no number, **when** they click "Call", **then** they are asked for a number, may save it to the contact, and the call appears on the ticket's timeline.
- **Given** a manager who starts a dialler session over the saved view "Leads to call this week" with a calling window of 09:00–19:00 in the party's local time, **then** calls start one after another as each outcome is set; parties marked "do not contact", without call consent where required, outside their window or called in the last 24 hours are skipped with the reason, and the caller's number is the organization's number in the party's country when one exists.
- **Given** a 12-minute call linked to a project task, **when** the call ends, **then** the user is offered to log 12 minutes of tracked time on the task and, on yes, the time shows in the timesheet.
- **Given** an account whose adapter streams live audio and an organization with live assistance on, **when** a customer asks about delivery times, **then** the transcript runs on the card and a suggested answer from the deal and the knowledge base appears; nothing is said or sent for the user.

### 2.2 Edge cases & failures

- **Given** `FEATURE_TELEPHONY` off, **then** every route answers `404`, call buttons are absent everywhere, and provider callbacks are answered with the provider's "reject" without storing anything.
- **Given** a callback whose signature does not verify, **then** it is refused, logged and has no effect.
- **Given** the provider's callbacks arriving out of order (ended before answered), **then** the log ends in the right final state and each callback is applied once.
- **Given** nobody available in the active slot, **then** the plan's fallback runs (message and hang-up, voicemail where supported, or forwarding) and the call is logged as missed for the slot's team.
- **Given** a user without `TELEPHONY_CALL_MAKE`, **then** phone fields show the number without a call button and the call route answers `403`.
- **Given** a number that matches two people, **then** the card lists both and the call is linked to both.
- **Given** a recording that cannot be fetched (provider down, address refused by the internal-address guard), **then** the call shows "recording pending", retries for 24 hours and then "recording unavailable".
- **Given** a recording past the account's retention, **then** it is deleted and the call log stays with "recording deleted".
- **Given** a browser that loses its connection during a call, **then** the call continues at the provider, the card reconnects to it when possible and the log is completed from the callbacks.
- **Given** two agents accepting the same call at once, **then** one is connected and the other's card says it was taken.
- **Given** no AI provider configured, **then** no transcript, summary or suggestion is offered; outcomes and their follow-up tasks still work.

## 3. Functional Requirements

### 3.1 Presence

- **FR-1** The system MUST load only when `GAUZY_TELEPHONY_ENABLED` is exactly `true` and answer every route with `404` while `FEATURE_TELEPHONY` is off; provider callbacks are then rejected without storing anything.
- **FR-2** The system MUST tell any client whether calling is available to the current user (feature on, an active account or the manual medium, an agent profile, `TELEPHONY_CALL_MAKE`), and clients show call buttons only then.
- **FR-3** The system MUST leave the existing text message gateway settings and the existing provider accounts unchanged, and let one provider account carry every channel of its vendor (email, text, voice), so a vendor's voice channel can be set up on an account where its other channels are; an organization keeps as many accounts per vendor as it may today.

### 3.2 Provider accounts and adapters

- **FR-4** A user with `TELEPHONY_SETTINGS_MANAGE` can add a provider account through a loaded adapter: name, adapter, credentials (stored encrypted, never returned), enabled, recording on or off, recording retention (default 90 days), default region and default flag, with the adapter's settings form taken from its declared schema.
- **FR-5** The system MUST verify an account when it is saved and on demand, and list the account's phone numbers and browser-calling applications from the provider for picking when the adapter can.
- **FR-6** The system MUST check every provider callback with the adapter's signature or token check over the raw request and refuse others without effect, logging the refusal.
- **FR-7** The system MUST accept provider adapters as plugins declaring their capabilities (browser calling, call to the agent's phone first, incoming calls, recording, live audio, voicemail, transfer, number list), and show only actions the account's adapter supports.
- **FR-8** The system MUST ship a manual medium (calls logged by hand; click-to-call opens the device's dialler and logs the call) and a simulated adapter for tests and demonstrations that an administrator must switch on explicitly.

### 3.3 Agents

- **FR-9** A user with `TELEPHONY_SETTINGS_MANAGE` can give a user an agent profile: the account numbers they dial out with and ring on, which of their own phone numbers (the employee's existing phone list) calls ring on, the receiving device (browser or phone) and a default account; a profile with defaults is created on a user's first call.
- **FR-10** A user can choose their default calling account from the call card or their settings when several accounts are enabled.
- **FR-11** A user can choose what their callers hear when greeted, when the user is on another call and when they are away (a text read out or a recorded file), on which device they take calls, and "do not disturb" until a time; users see only their own profile unless they hold `TELEPHONY_SETTINGS_MANAGE`.

### 3.4 Incoming calls

- **FR-12** A user with `TELEPHONY_SETTINGS_MANAGE` can give numbers a routing plan: ring mode (one after another or all at once), ring time per agent, greeting, busy and unavailable messages, weekly time slots each naming a team in the plan's time zone (or open hours and holidays taken from a service calendar of the support desk, each slot still naming its team; without one, the organization's official holidays close the line), and the fallback when nobody answers (message and hang up, voicemail where supported, or forward to a number); slots are refused when they end before they start or overlap within a day.
- **FR-13** The system MUST route an incoming call by the slot active at that moment: candidates are the slot's team members and agents who ring on the dialled number, signed in, available, not on a call and not in "do not disturb", ringing on browser or phone per their device, in the plan's ring mode; with no candidate, the fallback runs.
- **FR-14** (advanced) The system MUST, when the plan's sticky routing is on (default), ring the owner of the matched lead, deal or contact first for one ring period before the others.
- **FR-15** The system MUST answer the provider within its time limit, with the plan's unavailable message when routing cannot finish in time.
- **FR-16** The system MUST show each ringing agent a call card within 1 s of the provider's notice: caller number, matched records with name, kind, organisation and owner, open deals and tickets, accept and decline for browser calls, open record, and for an unknown caller "Unknown" with "Create lead" and "Add to existing".
- **FR-17** The system MUST close the other cards when one agent answers, tell an agent who accepts a taken call that it was taken, and turn an unanswered call into a missed card and one Inbox notice for the slot's team and the matched record's owner.
- **FR-18** The system MUST play ringing and hang-up sounds on the card unless the user muted them, and offer the card on every page of the Angular app, the app installed on a phone included.

### 3.5 Number matching

- **FR-19** The system MUST normalise numbers to the international format using the record's country, else the account's default region, else the organization's country, and match numbers regardless of spaces, punctuation and national prefixes.
- **FR-20** The system MUST look numbers up across contacts, leads, people, deal people, employees, vendors and any record type that registers its phone fields, and link a new call to every record that matches and to the organisation of a matched person.
- **FR-21** The system MUST link earlier calls of the last 90 days (setting) to a record that gains a matching number later.
- **FR-22** A user can create a lead from an unknown caller (through `lead-capture-and-enrichment` when loaded, else a contact) or add the number to an existing record, and the call is linked to it.

### 3.6 Outgoing calls

- **FR-23** A user with `TELEPHONY_CALL_MAKE` can call a number from any phone field of a lead, deal, person, organisation, contact, ticket, employee or vendor, from list rows, from the palette and from a call log ("call back").
- **FR-24** The system MUST place the call through the user's default account, or one they choose, as a browser call with a short-lived token or as a call to the agent's own phone first and then to the party, per their device, and create the call log with the caller at once.
- **FR-25** The system MUST show the call's progress on the card (dialling, ringing, in progress, on hold, ended) with duration and, where the adapter supports them, mute, hold, keypad, transfer and hang up.
- **FR-26** The system MUST ask for a number when the record has none, and offer to save the typed number to the record.

### 3.7 During and after a call

- **FR-27** A user on or after a call can write a note and create tasks that attach to the call and to its linked records.
- **FR-28** The system MUST ask after each answered call for a summary and an outcome from the organization's active outcomes and keep both on the call; an inactive outcome cannot be chosen.
- **FR-29** A user with `TELEPHONY_SETTINGS_MANAGE` can maintain the outcome list (name, description, colour, position, active, optional follow-up task with title and due delay); an outcome in use is deactivated, never deleted; an outcome with a follow-up task proposes it after the call.
- **FR-30** A user can link a call to further records (a deal, a ticket, a project) and unlink records they linked by hand.
- **FR-31** (advanced) A user can transfer a call to a colleague, directly or after speaking to them first, where the adapter supports it; the log keeps both legs.

### 3.8 Call log

- **FR-32** The system MUST keep a log of every call: provider reference, account or manual, direction, from and to numbers, its phase (waiting, ringing, connected, on hold, ended) and, once ended, why (talked, line busy, not answered, missed by the team, went to voicemail, cancelled by the caller, failed), start, answer and end times, ring time and duration, caller and receiver, outcome, summary, note, tasks, recording, transcript and linked records.
- **FR-33** The system MUST apply the provider's state and recording callbacks once each and in a consistent order (a later state never goes back), and push changes to open cards and pages within 1 s.
- **FR-34** A user with `TELEPHONY_CALL_MAKE` can log a call by hand (direction, number, record, time, duration, outcome, note) from a record or the call logs page.
- **FR-35** The system MUST offer a call logs page filtered by account or manual, outcome, phase and end reason, direction, from, to, user, date and linked record, with a detail panel showing linked records, note, tasks, recording and transcript, where a user can edit the note and tasks, set the outcome and create a lead from an unknown caller.
- **FR-36** The system MUST show a person only the calls they made or received or that are linked to a record they may read; holders of `TELEPHONY_CALLS_VIEW_ALL` see every call of the organization.
- **FR-37** The system MUST contribute calls to the timeline of every linked record (leads, deals, people, organisations, contacts, tickets, employees, projects) and to a party's conversation in `email-and-communications`.

### 3.9 Recordings

- **FR-38** The system MUST record calls only on accounts with recording on, after the account's consent announcement (on by default when recording is on), and mark recorded calls.
- **FR-39** The system MUST fetch a recording on the server with the account's credentials through the internal-address guard and keep it in the organization's file storage, or keep only the provider's reference when the account says so.
- **FR-40** The system MUST play recordings in the timeline and the call detail only for people who may read the call and hold `TELEPHONY_RECORDINGS_LISTEN`, and record each listen in the audit trail.
- **FR-41** The system MUST delete recordings and transcripts when the account's retention passes, keep the call log, and retry a failed fetch for 24 hours before marking the recording unavailable.

### 3.10 Helpdesk

- **FR-42** The system MUST offer click-to-call on a ticket's contact, asking for a number and offering to save it to the contact when missing, show the same call card for outgoing and incoming calls in the helpdesk, and show calls linked to a ticket on its timeline.
- **FR-43** The system MUST offer telephony settings (accounts, numbers, routing plans, outcomes, agents) in Settings → Telephony, linked from the helpdesk and CRM settings.

### 3.11 Live assistance and summaries `(advanced)`

- **FR-44** (advanced) The system MUST, where the account's adapter streams live audio and the organization enabled live assistance, show a live transcript on the card and suggest answers and next questions from the linked records and the knowledge base; suggestions are never spoken or sent for the user.
- **FR-45** (advanced) The system MUST, when the organization enabled after-call summaries and an AI provider with speech-to-text is configured, transcribe recorded calls and propose a summary, an outcome and a next task with the sentences they came from; nothing is written until the user approves or edits them.
- **FR-46** (advanced) The system MUST offer voicemail where the adapter supports it, transcribe it when summaries are on, and deliver it as a missed call with the recording and transcript to the matched record's owner, proposing a call-back task.

### 3.12 Power dialler `(advanced)`

- **FR-47** (advanced) A user with `TELEPHONY_DIALLER_RUN` can start a dialler session over a saved view or a selection of leads, people or contacts (up to 2,000), with a calling window in the party's local time (default weekdays 09:00–20:00), maximum attempts per party (default 3), minimum hours between attempts (default 24), and whether call consent is required.
- **FR-48** (advanced) The system MUST place the next call of a session only after the previous call's outcome is set, and skip, with the reason, parties marked "do not contact", without call consent where required, outside their window, called within the minimum interval or without a valid number.
- **FR-49** (advanced) The system MUST choose as caller number the organization's number in the party's country and area when the account has one (local presence), else the user's default, and never show a number the organization does not own.
- **FR-50** (advanced) The system MUST show a session's progress (called, connected, skipped by reason, outcomes) live and let its owner pause, resume and end it.

### 3.13 Call time and analytics `(advanced)`

- **FR-51** (advanced) The system MUST offer, after a call linked to a task, a project or a ticket, to log the call's duration as the user's tracked time on it (setting: offer, always, never; default offer), creating one time entry marked as from a call.
- **FR-52** (advanced) The system MUST give `crm-engagement` the facts it reads from calls: connected outgoing calls as responses, time on calls linked to deals, transcripts for summaries.

### 3.14 API, MCP, events and reports

- **FR-53** The system MUST expose every capability through REST with idempotency keys on creating routes, and synchronous provider callback routes that answer within the provider's limit.
- **FR-54** The system MUST offer MCP tools and in-app assistant tools to look up records by number, list and read calls, log a call by hand (preview first), set a call's outcome and summary, add a note, link a record, read routing plans and propose a call summary; an agent can request a call only as an intent that the user's own call card must confirm.
- **FR-55** The system MUST record changes made by an agent as made by the agent on behalf of the user who confirmed them.
- **FR-56** The system MUST publish, with ids only, as automation triggers and webhook events: call started, answered, ended, missed, outcome set, recording ready, transcript ready, voicemail received, dialler session finished.
- **FR-57** The system MUST register these report definitions (filters period, account, number, team, user, direction, outcome and record type where they apply; table and chart; export and schedules through the report builder, a read-only view without it):

  | Report | Answers |
  | --- | --- |
  | Call volume | calls per day, hour and weekday by direction, account, number and team |
  | Answered and missed | answer rate, missed calls and ring time per number, slot and team |
  | Agent activity | calls, talk time, average handling time and outcomes per user |
  | Outcomes | outcomes per user, record type and number over time |
  | Dialler sessions | attempts, connects, skips by reason and outcomes per session |
  | Recordings and transcripts | recorded minutes, transcribed minutes, listens and deletions per account |

## 4. Non-Functional Requirements

- **Performance**: incoming call card shown < 1 s after the provider's notice P95; routing answer to the provider < 1.5 s P95; number lookup < 50 ms P95 at 5 million numbers per tenant; call log list P95 < 300 ms at 10 million calls per tenant; recording available < 5 min after the provider reports it.
- **Volume and concurrency**: 500 simultaneous calls and 2,000 agents per tenant; one winner per answered call; callbacks idempotent per provider event.
- **Reliability**: callbacks stored before processing; state machine forward-only; recording fetch retried with back-off for 24 hours; jobs catch up after downtime; the call card reconnects after a lost connection.
- **Security & privacy**: credentials encrypted; callbacks verified; recordings and transcripts readable only per FR-40 and deleted at retention; listens audited; fetches guarded against internal addresses. Leaving the platform: call audio and numbers to the account's provider; recordings and transcripts to the organization's AI provider only when summaries or live assistance are enabled.
- **Auditability**: who and when for account, number, plan, outcome and profile changes, manual logs, outcome and summary edits, recording listens and deletions, with before and after.
- **Accessibility and localization**: the call card is keyboard operable (answer, decline, mute, hang up have shortcuts and labels), states are announced to screen readers, sounds have a visual equivalent; numbers shown in the viewer's national or international format; every string in all shipped locales.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted (callbacks need a public address; the plan says how a self-hosted server exposes them); works without the CRM, helpdesk, lead capture or communications plugins (their parts are then absent); OpenAPI and SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Adapter | A plugin that connects one provider and declares its capabilities |
| Provider account | An organization's connection to a provider through an adapter, shared with the provider's other channels |
| Phone number | A number of an account, with country, capabilities and routing plan |
| Agent profile | A user's numbers, device, default account, messages and do-not-disturb |
| Routing plan, slot | How incoming calls on numbers ring, by weekly slots naming teams, with a fallback |
| Call | One call with its states, people, outcome, summary, recording and transcript |
| Call link | A call's link to a record or a task, by number match, by hand or by the calling feature, kept as one of the platform's record links |
| Call event | One provider callback applied to a call |
| Outcome | An organization's call result with an optional follow-up task |
| Dialler session, item | A run of calls over a list with its rules; one party in it |
| Telephony settings | The organization's region, matching, window, consent and assistance settings |

## 6. Out of Scope

- Text messages and messaging apps → `email-and-communications`; audio and video rooms, conferencing → `meetings`.
- CRM timelines, communication status, response times and selling effort views → `crm-engagement`; lead creation rules from calls → `lead-capture-and-enrichment` (FR-22 calls its intake).
- Opening or joining a ticket from a call and ticket routing → `helpdesk-tickets` and `helpdesk-sla-routing-and-analytics`.
- The knowledge base used by suggestions → `helpdesk-portal-and-knowledge-base`; consent records → `email-and-communications`.

## 7. Acceptance Criteria

- [ ] **AC-1** With `FEATURE_TELEPHONY` off every route answers `404`, no call button shows, and callbacks are rejected without storing anything (FR-1).
- [ ] **AC-2** An account added through the simulated adapter verifies, lists its numbers and never returns its credentials; a callback with a bad signature is refused and logged (FR-4–FR-6, FR-8).
- [ ] **AC-3** An incoming call in a slot rings the matched lead's owner first, then the team at once; the card shows the matches within 1 s; when one agent answers the others close (advanced: sticky routing; FR-13, FR-14, FR-16, FR-17).
- [ ] **AC-4** With nobody available the fallback runs and the call is a missed card and one notice; slots that overlap are refused (FR-12, FR-13, FR-17).
- [ ] **AC-5** An unknown caller becomes a lead from the card and the call is linked to it (FR-22).
- [ ] **AC-6** Click-to-call from a deal creates a call log with the deal and person linked; a record without number asks for one and can save it (FR-23, FR-24, FR-26).
- [ ] **AC-7** A note and a task added during a call show on the call and the deal; the outcome is required from active ones and its follow-up task is proposed (FR-27–FR-29).
- [ ] **AC-8** Callbacks delivered out of order and twice end in the right final state with one event each (FR-33).
- [ ] **AC-9** The call logs page filters by every field of FR-35; a user sees only calls they made, received or can read through a linked record; `TELEPHONY_CALLS_VIEW_ALL` sees all.
- [ ] **AC-10** A recording plays only for readers with `TELEPHONY_RECORDINGS_LISTEN`, each listen is audited, and it is deleted at retention while the log stays (FR-40).
- [ ] **AC-11** Numbers written in national, international and punctuated forms match the same person; a record that gains a number gets earlier calls linked (FR-19, FR-21).
- [ ] **AC-12** A ticket's contact can be called from the ticket and the call is on the ticket's timeline (FR-37, FR-42).
- [ ] **AC-13** A dialler session skips "do not contact", out-of-window and recently called parties with reasons and uses a local number when one exists (advanced: dialler; FR-47–FR-50).
- [ ] **AC-14** A recorded call gets a proposed summary, outcome and task with their source sentences, written only after approval; live suggestions appear with the simulated live audio and are never sent (advanced: assistance; FR-44–FR-46).
- [ ] **AC-15** Call time is logged as tracked time on a linked task on confirmation (advanced: call time; FR-51).
- [ ] **AC-16** Transfer and voicemail work with the simulated adapter and are hidden for an adapter without them (advanced: transfer and voicemail; FR-7, FR-31, FR-46).
- [ ] **AC-17** The six report definitions of FR-57 return the expected figures on the demo data set.
- [ ] **AC-18** Every MCP tool of FR-54 answers under the caller's rights; previews write nothing; a call intent rings only after the user's confirmation.
- [ ] **AC-19** The call card passes keyboard and screen-reader checks; works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-16; §4).
- [ ] **AC-20** With the feature off, and with it on before a voice account is added, existing provider accounts (several per vendor included), employee phones and the text message gateway settings behave exactly as today (FR-3).
- [ ] **AC-21** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Which provider adapters to build first. Applied default: the adapter contract, the manual medium and the simulated adapter ship; each provider adapter is a separate plugin.
- Buying and porting numbers, menus of options for callers and call queues with waiting music stay in the provider's own tools. Applied default.
- Recordings are kept in the organization's file storage by default (provider reference as an option). Applied default.
- A consent announcement plays whenever recording is on. Applied default; regional packs may require more.
- Calls are visible to their parties' readers (FR-36). Applied default; an organization wanting calls private to their participants would need a setting.
- Self-hosted servers need a public address for provider callbacks. Applied default: documented, with the callback address shown on the account page.

## 9. Constitution Gates

- [x] I Plugin-first — new `packages/plugins/telephony` and `telephony-ui`; adapters as separate plugins; provider accounts, people's phones and record links in the platform's existing stores.
- [x] II Tenant/organization scoping — every record carries tenant and organization; callbacks resolve the tenant from the account and its token.
- [x] III Both ORMs, additive migrations — new tables and two additive columns on existing tables, three dialects.
- [x] IV Default-off flag; nothing removed — deploy flag and `FEATURE_TELEPHONY` off; the text message gateway settings untouched.
- [x] V Contracts and API first — contracts, REST and the adapter contract before UI; one number lookup contract.
- [x] VI Permissions, privacy, security — five keys; encrypted credentials, verified callbacks, guarded fetches, audited recordings and retention.
- [x] VII Real-time through the event bus — outbox events and call card signals on the platform channel.
- [x] VIII i18n and accessibility — keyboard call card, announced states, keys in every locale.
- [x] IX Tests accompany the change — unit, e2e with the simulated adapter, callback ordering and contract tests.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: `email-and-communications` (conversation, consent)
- Works with: [`../crm-engagement/spec.md`](../crm-engagement/spec.md), [`../crm-leads-and-deals/spec.md`](../crm-leads-and-deals/spec.md), [`../lead-capture-and-enrichment/spec.md`](../lead-capture-and-enrichment/spec.md), [`../helpdesk-tickets/spec.md`](../helpdesk-tickets/spec.md), [`../helpdesk-sla-routing-and-analytics/spec.md`](../helpdesk-sla-routing-and-analytics/spec.md), [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md), [`../report-builder-and-dashboards/spec.md`](../report-builder-and-dashboards/spec.md)
- Code: `packages/plugins/inbox/src/lib/email/entities/inbox-provider-account.entity.ts` (provider accounts, sealed credentials), `packages/core/src/lib/employee-phone/`, `packages/core/src/lib/resource-link/`, `packages/core/src/lib/official-holiday/`, `packages/core/src/lib/organization-contact/organization-contact.entity.ts` (`primaryPhone`), `packages/core/src/lib/core/util/ssrf-safe-agent.ts`, `packages/core/src/lib/core/file-storage/`, `packages/plugins/realtime/src/lib/realtime-signals.service.ts`, `packages/plugins/realtime/src/lib/realtime-presence.store.ts`, `packages/plugins/ai-chat/src/lib/provider.types.ts` (`transcribe`), `packages/contracts/src/lib/sms.model.ts`, `apps/gauzy/src/app/pages/settings/sms-gateway/`
