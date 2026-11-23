# Feature Specification: Chat administration and client capabilities

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `chat-administration-and-clients`
**Branch**: `feat/chat-administration-and-clients`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: evereq
**Feature flag**: the existing chat flags, `GAUZY_CHAT_ENABLED` (deployment, exactly `true`) and tenant `FEATURE_CHAT` (both default off). Guests also need the portal user type of `access-control-and-security` (`FEATURE_ADVANCED_ACCESS`); channels shared between tenants need the deployment switch `GAUZY_CHAT_SHARED_CHANNELS_ENABLED` (exactly `true`, default off); calls need the `meetings` feature.

---

## 1. Overview

Chat today ([`chat`](../chat/spec.md)) is administered through three permissions (`CHAT_VIEW`, `CHAT_SEND`, `CHAT_MANAGE`) with default role grants, conversation managers, sidebar categories, a per-channel webhooks panel with an activity log, a tenant feature toggle, server-side safety (sanitised bodies, the egress guard for every outbound fetch, membership on every read) and clients on the web: the Angular page with a docked direct-message window and Ever Teams web, with live delivery and catch-up over the [real-time channel](../realtime-channel/spec.md) and web push through the [Inbox](../inbox/spec.md). This feature adds what administrators and clients still lack: an **organization chat settings page** and first-run set-up, people and channel administration (including a browser of every channel, bulk access changes and moving a channel between organizations), finer **permission keys and one rule matrix** that every client reads through one rights call, **guests** from outside the organization, **retention** per organization and channel, **legal holds**, **compliance export**, an **audit** of every administrative act, privacy requests, **import from an archive in the documented import format (JSON lines)**, **calls and quick calls handed off to meetings** from a conversation, and the **server capabilities clients need**: an installable Angular app, share in and out, push to phones and desktops, a sync route for offline reading and on-device search, offline outbox rules, token-based live connections and media, version and maintenance signals. Ever Teams screens on web, desktop and mobile are specified in the Ever Teams spec `workspace-collaboration-clients`.

**Advanced capabilities.** Retention can be set **per channel** within the organization's bounds, every run produces a **deletion report**, and **legal holds** on people, conversations or periods keep held messages (edits and deletions included) out of any purge; **data-loss rules warn before a secret or a personal number is posted**, or block or mask it, in channels with guests or everywhere; two tenants can **share a channel** with each side keeping its own copy under its own retention; administrators get **usage and health analytics without reading a single message**; and after a call, the meeting's summary and action items land **in the call card's thread**, ready to become tasks.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator who switches chat on for an organization, **when** they open Chat, **then** a set-up checklist offers to review the default channel, create channels for the teams, choose who may create channels, invite people with the channels they will join, and set notification defaults; another administrator later sees it done.
- **Given** a chat administrator, **when** they set "only managers create public channels" and add `example.com` to the link preview block list, **then** employees no longer see the create action for public channels, the server refuses it if called, and links to that domain show as plain links without any fetch.
- **Given** a person changing teams, **when** an administrator opens their access, picks four channels to add and two to remove and saves after reviewing the change list, **then** the person is added and removed in one step, each change recorded in the audit.
- **Given** an administrator, **when** they browse channels filtered by "no manager" and "inactive 90 days", **then** they see private channels' names, sizes and last activity but no message, and archive five of them in one action.
- **Given** a project manager allowed to invite guests, **when** they invite `lea@partner.example` to #project-apollo with an expiry in 60 days, **then** Lea signs in with a one-time code, sees only that channel and its members with a guest badge, and members see a banner saying the channel has guests.
- **Given** a retention of 365 days for channels and 90 days for #random, **when** the daily run passes, **then** older messages are removed, the administrators' deletion report lists counts per conversation, and messages under a hold are listed as kept. `(advanced)`
- **Given** a legal hold on Ben for a matter, **when** Ben deletes a message and edits another, **then** both disappear or change for readers as usual, but a compliance export for Ben includes the deleted message and both versions of the edited one. `(advanced)`
- **Given** a compliance officer, **when** they export all conversations of two people for March including files, **then** the archive is built in the background, offered for 7 days and the export itself is recorded in the audit trail.
- **Given** a data-loss rule "block payment card numbers in channels with guests", **when** an employee pastes a card number into such a channel, **then** the composer warns before sending, the server refuses the message, and the audit records the rule and the conversation without the number. `(advanced)`
- **Given** two tenants of the same cloud whose administrators agreed to share #joint-launch, **when** a member of either side posts, **then** the other side sees it with the author's organization badge, and when one side disconnects, both keep what they have and copying stops. `(advanced)`
- **Given** an administrator with the analytics permission, **when** they open Chat analytics, **then** they see messages per day, active members, busiest channels and median first reply time in direct conversations for the last 30 days, without any message text. `(advanced)`
- **Given** a group conversation, **when** a member starts a quick call, **then** the others' phones ring, a live call card shows who joined, and after the call its card shows duration and participants; the meeting summary and action items arrive in the card's thread with "create task" on each. `(advanced)`
- **Given** an administrator, **when** they upload an archive in the documented import format (JSON lines), map its people by email and run a dry run, **then** they see counts of channels, messages, threads, files and problems; the run keeps original times and threads, notifies nobody, and a second run creates nothing twice.
- **Given** an employee on a phone, **when** they share a photo from the gallery to a chosen channel, **then** it arrives with their caption as one message; when someone reads the conversation on the desktop, the phone's notification for it disappears.
- **Given** a phone that was offline for a day, **when** it reconnects, **then** it receives only what changed since its cursor, including deletions, and its local search finds yesterday's messages.

### 2.2 Edge cases & failures

- **Given** an organization where chat follows deactivation (FR-6) and an employee who is deactivated, **when** the deactivation is saved, **then** their live connections stop receiving chat events at once and they leave every conversation's member list; managers lost this way are replaced as `chat-messaging` FR-19 says where the organization switched that on. With the setting off (the default), the deactivation changes nothing in chat, as today.
- **Given** a guest whose invitation expired, **when** they sign in, **then** they are told access ended and their inviter was told 7 days before.
- **Given** a guest, **when** they try to start a direct conversation with an employee they share no channel with, or to browse channels, **then** it is refused with `403`.
- **Given** a retention setting shorter than a channel's own longer period, **when** the organization lowers its maximum, **then** the channel's period is capped and its managers are told.
- **Given** a compliance export that names a direct conversation without naming a person in it, **when** submitted, **then** it is refused unless the exporter holds the right to export direct conversations.
- **Given** a moved channel whose name exists in the target organization, **when** the move is requested, **then** it is refused with the clash named.
- **Given** an import whose archive holds files by address, **when** a file host is private or unreachable, **then** that file is skipped and listed in the report; the message keeps a "file not imported" note.
- **Given** a shared channel whose partner tenant switched chat off, **when** a member posts, **then** the post stays on this side, the channel shows "partner unavailable", and copying resumes when the partner returns.
- **Given** a client older than the minimum version, **when** it connects, **then** the status answer tells it to update and the API refuses chat writes from it with `CLIENT_TOO_OLD`.
- **Given** the platform in maintenance with reads allowed, **when** a client opens chat, **then** it shows a maintenance banner, reads work and writes are refused with a retry time.
- **Given** a phone that was offline longer than the sync window, **when** it asks for changes, **then** it is told to resynchronise and receives a fresh recent window.
- **Given** a data-loss rule in "warn" mode, **when** the author sends anyway, **then** the message is posted and the reason they gave is recorded.

## 3. Functional Requirements

### 3.1 Scope and what stays

- **FR-1** The system keeps the existing chat permissions, default grants, conversation roles, categories, activity-log entries, sanitising, egress guard and clients unchanged; the rule that chat is for employees of the organization (chat FR-24) stays, with guests (§3.4) as the only exception where an organization enables them.
- **FR-2** The system serves the routes of this spec only under the chat flags; guests also need the portal user type of `access-control-and-security`, shared channels the deployment switch `GAUZY_CHAT_SHARED_CHANNELS_ENABLED`, calls the `meetings` feature, and holds and privacy requests use that access feature's registries where loaded.

### 3.2 Organization settings and administration

- **FR-3** A user with `CHAT_ADMIN_SETTINGS` can set per organization: who may create public and private channels, who may use `@channel` and `@here`, the edit window and whether edit history shows, who may delete others' messages, read receipts' member cap, the time-off badge, link previews and their block list, the GIF source, who manages custom emoji, allowed file types and size within the platform's limits, the channels new members join, team and department channels, the chat AI switch and automatic translation, whether agents may be mentioned in every public channel (their limits are the agents' own in `ai-agents-and-assistants`), content in outgoing events, guests and data-loss rules; every change is recorded with before and after, and every default is today's behaviour (FR-57).
- **FR-4** The link preview block list holds domains (with their subdomains) and exact links; a blocked link is never fetched, renders as a plain link, and the list is given to clients so they do not ask for it.
- **FR-5** When chat is first used in an organization, a user with `CHAT_ADMIN_SETTINGS` sees a set-up checklist (review the default channel, create channels for teams and departments, choose who creates channels, invite people with channels to join, set notification defaults) that can be skipped and is marked done once for the organization; it is chat's checklist in the platform's administration checklists, shown with the others.
- **FR-6** Every active employee holding `CHAT_VIEW` is a chat user of their organizations; removing the permission ends their chat access at once, live connections included. An organization can switch on "chat follows deactivation" (setting, default off: a deactivation changes nothing in chat, as today); then deactivating the employee also ends their chat access at once, live connections included, takes them off every conversation's member list, and reactivation restores their memberships except in channels deleted meanwhile.
- **FR-7** A user with `CHAT_ADMIN_SETTINGS` can list the organization's chat users with type (employee, guest, bot), conversation count, last activity and status, open a person's conversations, add them to and remove them from several channels in one step after reviewing the list of changes, and switch chat off for that person.
- **FR-8** An employee invitation can name channels the person joins when they accept.
- **FR-9** The system shows a person only the organizations they are employed in (or invited to as a guest); where the organization switched on the setting of FR-6, leaving an organization also ends their memberships in all its conversations, private ones included (with it off, memberships stay as today).
- **FR-10** The organization's name, logo and description from its existing record show in the chat header and switcher; nothing about them is kept twice.
- **FR-11** A user with `CHAT_ADMIN_SETTINGS` can browse every channel of the organization, private ones included, with name, visibility, mode, members, managers, guests, linked record, creation, last activity and size, never message content; filter by visibility, mode, archived, deleted, membership, inactivity of 90 days, no manager and guests; archive, assign a manager or delete in bulk with one result per channel; joining a private channel this way is recorded and announced in it.
- **FR-12** A user with `CHAT_ADMIN_SETTINGS` in two organizations of a tenant can move a public or private channel between them, keeping its id, threads and history: members employed in the target stay, the others are removed after confirmation; direct, group, everyone and default channels and name clashes are refused; the move is recorded.

### 3.3 Roles and rules

- **FR-13** The system adds the permissions `CHAT_ADMIN_SETTINGS`, `CHAT_CHANNEL_CREATE_PUBLIC`, `CHAT_CHANNEL_CREATE_PRIVATE`, `CHAT_GUESTS_INVITE`, `CHAT_RETENTION_MANAGE`, `CHAT_COMPLIANCE_EXPORT`, `CHAT_IMPORT` and `CHAT_ANALYTICS_VIEW`, granted to roles by default as §8 states, available in the role bundles of `access-control-and-security`, and keeps `CHAT_VIEW`, `CHAT_SEND` and `CHAT_MANAGE` unchanged.
- **FR-14** The system decides every chat action by one rule matrix of person kind (member, conversation manager, holder of `CHAT_MANAGE`, guest, bot), conversation kind and the conversation's policies, as below, on every route of every chat spec.
- **FR-15** The system answers, in one call per conversation, the caller's effective rights there, and every client shows only the actions it allows.

| Action | Member | Manager | `CHAT_MANAGE` | Guest | Bot |
| --- | --- | --- | --- | --- | --- |
| Read, react, reply in thread | yes | yes | yes; reads channels without joining, as today | yes, invited channels | yes, member conversations |
| Post at top level | yes unless announcement-only | yes | yes | yes unless announcement-only | with its token scope |
| `@channel`, `@here` | by channel policy | yes | yes | no | no |
| Add members | public: yes; private: by policy | yes | yes | no | itself only |
| Remove others, rename, change policies | no | yes | yes | no | no |
| Pin | by policy | yes | yes | no | no |
| Archive, delete channel | no | yes | yes | no | no |
| Delete others' messages | no | app, bot and agent messages | yes | no | its own only |
| Export | no | no | with `CHAT_COMPLIANCE_EXPORT` | no | no |

### 3.4 Guests and shared channels

- **FR-16** A user with `CHAT_GUESTS_INVITE` can invite a person from outside the organization by email to one or more channels whose policy allows guests, bound to a customer or supplier contact (picked or created), with an expiry (default 90 days, at most 365); the invitation is a platform invitation accepted through the platform's invitation flow, and the guest is a portal user of `access-control-and-security` who signs in by one-time code or by the sign-in policy for portal users.
- **FR-17** A guest reads and posts only in the channels they are invited to, sees their members' names and pictures without contact details, uploads within the organization's limits, and cannot browse channels, create channels, open the people directory, mention `@channel` or `@here`, or start a direct conversation with someone they share no channel with; every client shows a guest badge, and channels with guests show a banner to members.
- **FR-18** An organization can limit guest invitations to listed email domains and a channel manager can allow or forbid guests per channel; removing a guest's last channel or reaching the expiry ends their access, and the inviter is told 7 days before expiry.
- **FR-19** With `GAUZY_CHAT_SHARED_CHANNELS_ENABLED`, an administrator can share a channel with another tenant of the same deployment by an invitation code that the other tenant's administrator accepts into one of their channels; posts, edits, deletions, reactions and files are copied both ways by the platform, each tenant keeps its own copy under its own retention and holds, the other side's people show with their organization badge, data-loss rules and guest limits apply to the connected side, and either side can disconnect, which stops copying and keeps what each has. `(advanced)`

### 3.5 Retention, legal holds, export, audit and privacy

- **FR-20** A user with `CHAT_RETENTION_MANAGE` can set per organization how long messages are kept (forever by default, or a number of days of at least 1) separately for channels, group and direct conversations, and the bounds within which channel managers may set a channel's own period; a dry run shows what a setting would remove per conversation. The organization periods are the platform's retention policies for chat messages, listed with the other retention policies of `access-control-and-security`; without that feature, messages are kept forever unless a channel has its own period. `(advanced)`
- **FR-21** The daily retention run removes message bodies, their files' links (files go to the drive trash unless used elsewhere), reactions, link records, revisions and translations older than the period, keeps a thread's root as "removed by retention" while replies remain, skips held messages and writes a deletion report per run (counts per conversation and kind, held items kept) that administrators can read and export. `(advanced)`
- **FR-22** A user with `CHAT_RETENTION_MANAGE` (or the privacy policies permission of `access-control-and-security`) can place a legal hold on people (every conversation they took part in), conversations or a period, with a matter name and reason; a held message is never purged, its deletion by a user hides it from readers but keeps it for export, its edits keep every revision whatever the history setting, and releasing the hold lifts all this; holds are listed with scope and counts. Holds are entries of the platform's hold register, so a hold placed for another purpose on the same person also keeps their chat messages, and holds are offered where `access-control-and-security` is loaded. `(advanced)`
- **FR-23** A user with `CHAT_COMPLIANCE_EXPORT` can export messages by people, conversations, period and words, with edits, deletions under hold and files, as a machine-readable archive with a readable page per conversation; it runs in the background as a run of the platform's data export, is offered for 7 days, is recorded in the audit trail, includes direct and group conversations only when the export names one of their members, and can require a second approver by setting.
- **FR-24** The system records in the audit trail of `access-control-and-security` (or the activity log where it is not loaded): settings changes, channel creation, rename, visibility, policy, archive, delete, restore and move, member additions, removals and role changes, administrators joining private channels, guest invitations and removals, bot and token changes, exports, holds, retention runs and imports; message edits and deletions are recorded as events without their text.
- **FR-25** Chat declares its personal data in the privacy registry: a copy request includes the person's messages, files, reactions and named votes; erasure deletes their drafts, reminders, scheduled messages, saved messages, statuses and preferences and, by organization setting, deletes their messages or keeps them with the author shown as "former member"; nothing held is erased.
- **FR-26** A user with `CHAT_ADMIN_SETTINGS` can define data-loss rules: detectors (access keys and tokens, private keys, payment card and bank account numbers with their check digits, national identifiers of the organization's country pack, custom patterns), the conversations they apply to (all, with guests, shared with another tenant, direct) and an action (warn the author before sending with "send anyway" and a reason, block, or send with the match masked); posts of bots, agents and webhooks are checked too; matches are recorded without the matched text. `(advanced)`

### 3.6 Sign-in and content safety

- **FR-27** Chat uses the platform's sign-in (passwords, second factor, directory and social sign-in, one-time codes by policy); mobile and desktop clients can also sign in through the platform's applications for native clients with a proof key, beside the sign-in they use today, refresh their tokens before expiry, and lose access at once when a session is revoked.
- **FR-28** The system keeps sanitising message text and card content, drops links with unsafe schemes from messages and cards, makes every outbound fetch through the egress guard and checks uploads by their content.

### 3.7 Calls and quick calls

- **FR-29** A member can start a call or an audio-only quick call from a conversation where its policy allows: the system asks `meetings` for a room for the conversation, posts a live call card (who is in, duration, join), rings the members of a direct or group conversation by push with the call kind and tells a channel's members quietly; ending the call updates the card with duration and participants.
- **FR-30** A conversation has at most one live call (the live session of the conversation's meeting room); a channel manager chooses whether members or only managers start calls; guests join under the rules of `meetings`.
- **FR-31** After a call, the links to its recording, transcript and summary (when `meetings` produced them and the person may read them) post in the call card's thread, with each action item of the summary offered as a task to create. `(advanced)`
- **FR-32** Links to the platform's meeting rooms show as call cards with join; links to outside meeting services get a "meeting link" label on their preview; "schedule a meeting" in a conversation opens the calendar with its members invited.

### 3.8 Client capabilities

- **FR-33** The Angular app, already installable as a web app, gains its own icons, opens to chat when chosen, registers as a share target for title, text, links and files, shows the unread count on its icon and starts with a cached shell when offline, through its existing manifest and offline worker.
- **FR-34** One call shares text and files from another app into a chosen conversation or person as one message, with the usual upload checks; only files the client hands over are accepted.
- **FR-35** A client can hand a message's text, permalink and files to the device's share sheet; files through a download link valid one hour.
- **FR-36** Chat notifications reach registered browsers through the Inbox's existing web push and registered phones and desktop clients through the device registry and push adapters of `email-and-communications`, with a kind per notification (message, mention, reply, call), a grouping key per conversation so a later push replaces the earlier one, a link to the message, the conversation's title and the author's picture, and a silent clear when the person reads the conversation elsewhere; self-hosted deployments use their own push credentials and send nothing unless configured.
- **FR-37** A sync route gives a client, from its cursor, the conversations, memberships, the newest messages of each conversation (default 200, setting), read positions and deletions since then, so clients read offline and search on the device; a cursor older than the sync window answers "resync".
- **FR-38** Messages sent from an offline client carry their client time and key; the server orders them by arrival, shows "sent while offline at <time>" when the gap is over 5 minutes, and refuses a send to a conversation the person has left meanwhile with a reason the client shows.
- **FR-39** The real-time channel accepts token connections from mobile and desktop clients with the same re-checks of authorisation as browser sessions.
- **FR-40** Chat files are served to clients with tokens or short-lived signed addresses, byte ranges, length and validators, so clients stream media, resume downloads, show progress and cache files.
- **FR-41** A status route answers the API version, the minimum client version per client kind (none unless an administrator sets one), the chat capabilities on for the tenant (AI, guests, calls, shared channels) and the maintenance state (reads allowed or not); clients show distinct states for offline, server unreachable, maintenance, signed out and outdated, and chat writes from a client below the minimum are refused with `CLIENT_TOO_OLD`.
- **FR-42** A light route tells clients whether the API answers while live delivery is down, so they show the right state and fall back to polling.
- **FR-43** The Angular app notices a newer deployed build and offers "reload to update".
- **FR-44** The Gauzy desktop apps and Ever Teams desktop and mobile reach chat through the capabilities of FR-33 to FR-43.
- **FR-45** The platform's help panel offers, on chat pages, chat's help items: the keyboard shortcuts, a link to the user guide and the platform version.
- **FR-46** Chat screens ship in every locale of the platform with right-to-left layout for right-to-left languages, system events in the reader's language and dates in the person's locale and 12- or 24-hour choice.
- **FR-47** Chat sends no usage data outside the platform; any product analytics follow the platform's telemetry controls, and administrator analytics (§3.10) stay inside the tenant.
- **FR-48** The Angular chat renders long conversations in a virtualised list, loads history in windows and redraws only the messages that change.

### 3.9 Import

- **FR-49** A user with `CHAT_IMPORT` can upload an archive in the documented import format (JSON lines: people, conversations, messages, reactions, files); the system reads it in the background and offers a mapping: people to employees by email (unmatched ones as guests, as an "imported author" name, or skipped), channels to new or existing channels with their visibility, direct and group conversations, and integrations to bots; the import is a run of the platform's data import, listed with the organization's other imports.
- **FR-50** A dry run reports the counts of conversations, messages, threads, files, reactions and pins and every problem found; the run keeps original times, authors, threads, reactions, pins, edits as revisions and files (from the archive, or fetched by address through the egress guard), marks messages as imported, notifies nobody and leaves nothing unread.
- **FR-51** Running an import again skips what it already created; a report lists skipped items with their reason; an import can be undone within 7 days, which removes what it created.
- **FR-52** Chat data changes between versions only through additive, idempotent migrations, and the database itself enforces one direct conversation per set of people, one membership per person, one ballot per poll and person and one reaction per person and emoji.

### 3.10 Analytics, health and reports

- **FR-53** A user with `CHAT_ANALYTICS_VIEW` sees, per organization, team and channel and over a chosen period: messages per day, active and posting members (daily and weekly), conversations by activity, files volume, the share of direct conversations, median first reply time in direct conversations, guest activity and posts by bots and agents; counts only, never text, and private and direct conversations only in totals. `(advanced)`
- **FR-54** A health page lists channels without managers, inactive for 90 days, with guests, with duplicate names or very large, failing webhooks and bots, data-loss matches by rule, retention and hold state, each with a suggested action (archive, assign a manager, review). `(advanced)`
- **FR-55** The system registers report definitions: chat usage, channel health, retention runs and deletion reports, legal holds, compliance exports, guests and their expiry, and data-loss matches.
- **FR-56** The MCP server offers, under a new `chat:admin` scope, tools to list channels as administrators see them, read usage counts, preview and apply a retention setting and list holds; applying answers a preview first.

### 3.11 Defaults

- **FR-57** Every setting of FR-3 and every channel policy of the rule matrix defaults to today's behaviour: every holder of `CHAT_SEND` creates public and private channels and uses `@channel` and `@here`, members pin and unpin, authors edit their messages without a time window, only authors and holders of `CHAT_MANAGE` delete others' messages, link previews work as the deployment has them, files follow the platform's upload limits, new employees join the default channel only, a deactivation changes nothing in chat, and no minimum client version is set; an organization that changes nothing sees chat behave exactly as before.

## 4. Non-Functional Requirements

- **Performance**: rights call P95 < 50 ms; channel browser P95 < 300 ms at 20,000 channels per organization; sync delta P95 < 500 ms for a day of changes over 300 conversations; retention run of 1 million messages within 2 hours in batches; analytics pages P95 < 1 s from daily aggregates; data-loss checks add < 20 ms to a send.
- **Data volume**: 100,000 people and 20,000 channels per organization, 5,000 guests per tenant, imports of 10 million messages and 500 GB of files, compliance exports of 1 million messages.
- **Concurrency**: one retention run per organization at a time; holds checked inside the purge transaction; shared-channel copies idempotent per source message and change.
- **Reliability**: retention, import, export and shared-channel copying resume after a restart without duplicates; a failed import item never stops the run.
- **Security & privacy**: guests limited by the portal user type's ceiling; exports and holds behind their own permissions and audited; deletion reports hold counts, never text; analytics hold counts only; what leaves the platform: push payloads to push services, export archives to their requester, imported files fetched from the addresses in the archive, copies of shared-channel messages to the partner tenant of the same deployment.
- **Auditability**: every administrative act of FR-24 with actor, time and before and after.
- **Accessibility and localisation**: settings, browser, wizard and dialogs keyboard operable and labelled; every string in every shipped locale; right-to-left layout.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; cloud and self-hosted (shared channels only within one deployment); works without the access, privacy, meetings and communications features, whose parts are then absent.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Organization chat settings | The `chat.*` settings of an organization in the platform's settings, with their change history |
| Set-up checklist (platform) | Chat's checklist and whether an organization finished or skipped it |
| `ChatGuestAccess` | An outside person's access to channels of an organization, with its end, over a platform invitation |
| `ChatSharedChannelLink` | The connection between a channel of this tenant and one of a partner tenant |
| `ChatMessageCopy` | The mapping between a message and its copy on the partner side |
| Retention policy (platform) | How long messages are kept per organization and conversation kind; a channel's own period on the channel |
| Retention run (platform) | One daily run with its deletion report |
| Legal hold (platform) | A hold on people, conversations or a period, with matter and reason |
| Compliance export (platform export run) | A requested export, its filters, approver, state and archive |
| `ChatDataLossRule`, `ChatDataLossMatch` | A detector with scope and action; one match without the matched text |
| Chat import (platform import run) | An uploaded archive with mapping, dry run, progress and report; one imported item with its outside id |
| Call | A session of the conversation's meeting room, live or ended, shown as a call card message |
| Client cursor | A client's sync position (computed, not stored) |
| `ChatUsageDaily` | Daily counts per conversation and organization for analytics |

## 6. Out of Scope

- Ever Teams screens, offline storage, local search index, native gestures, haptics, navigation and media cache on web, desktop and mobile: the Ever Teams spec `workspace-collaboration-clients`.
- Rooms, media, recording, transcripts and summaries: `meetings`; calendar invitations: `calendar-and-scheduling`.
- User types, sign-in policies, one-time codes, the audit store, privacy requests and the retention registry: `access-control-and-security`; push devices and adapters: `email-and-communications`.
- Conversations, messages, preferences, shortcuts and the poll and reaction reports: `chat-messaging`; bots, agents, cards and apps administration: `chat-agents-and-record-actions`.

## 7. Acceptance Criteria

- [ ] **AC-1** With the chat flags off nothing changes; non-employees stay out of chat unless invited as guests (FR-1, FR-2).
- [ ] **AC-2** Settings changes take effect on server and clients and are recorded with before and after; a blocked domain is never fetched (FR-3, FR-4).
- [ ] **AC-3** The set-up checklist appears once per organization and can be skipped (FR-5).
- [ ] **AC-4** Removing `CHAT_VIEW` stops a person's live events at once; where chat follows deactivation, deactivating an employee does the same and takes them off member lists, and with the setting off a deactivation changes nothing in chat; bulk access changes apply after review (FR-6, FR-7).
- [ ] **AC-5** The channel browser shows private channels without content; an administrator's join is announced; bulk archive reports per channel (FR-11).
- [ ] **AC-6** A channel moves between organizations with history; a name clash is refused (FR-12).
- [ ] **AC-7** The rights call matches the server's decision for every row of the rule matrix in a generated test (FR-14, FR-15).
- [ ] **AC-8** A guest sees only invited channels, cannot browse or open other direct conversations, and loses access at expiry (FR-16–FR-18).
- [ ] **AC-9** A shared channel copies a post, an edit and a deletion both ways; disconnecting stops copying; each side's retention applies to its copy (FR-19).
- [ ] **AC-10** Retention removes old messages, keeps held ones, produces a deletion report; a channel's own period works within bounds (FR-20–FR-22).
- [ ] **AC-11** A compliance export with a held deletion and an edit includes both versions; the export is audited; the second approver is required when set (FR-23, FR-24).
- [ ] **AC-12** A privacy copy and an erasure behave as the organization setting says (FR-25).
- [ ] **AC-13** A data-loss rule warns, blocks and masks as configured, for people and bots, without storing the match (FR-26).
- [ ] **AC-14** A quick call rings group members, the call card updates live and at the end, and the summary's action items arrive in its thread (FR-29–FR-31).
- [ ] **AC-15** The Angular app installs, receives a shared file as a message and shows the unread count on its icon (FR-33, FR-34).
- [ ] **AC-16** A test device receives grouped pushes and a silent clear after reading elsewhere (FR-36).
- [ ] **AC-17** The sync route returns changes and deletions since a cursor and asks an old cursor to resynchronise; an offline send shows its offline time (FR-37, FR-38).
- [ ] **AC-18** Media answer byte ranges; the status route reports minimum versions and maintenance; an outdated client is refused writes (FR-40, FR-41).
- [ ] **AC-19** An import of an archive in the documented import format (JSON lines) maps people, keeps threads and times, notifies nobody, re-runs without duplicates and undoes (FR-49–FR-51).
- [ ] **AC-20** Analytics and health pages show counts only and match the chat's records; the reports of FR-55 exist (FR-53–FR-55).
- [ ] **AC-21** Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test (§4).
- [ ] **AC-22** With the chat flags on and no setting of this spec changed, every existing chat behaviour, permission, route answer and test stays as today, holders of `CHAT_MANAGE` still read channels without joining, and no client is refused for its version (FR-1, FR-57).
- [ ] **AC-23** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-2).

## 8. Open Questions

- Guests are portal users bound to a contact (FR-16): applied default; a guest without any company is recorded under a contact the inviter creates.
- Shared channels between tenants only within one deployment (FR-19): applied default; sharing between deployments needs a separate federation design.
- Messages of an erased person: applied default "kept as former member" unless the organization chooses deletion.
- Retention default: keep forever; channel managers may only shorten unless the organization allows longer.
- Default grants: `CHAT_ADMIN_SETTINGS`, `CHAT_RETENTION_MANAGE`, `CHAT_COMPLIANCE_EXPORT`, `CHAT_IMPORT`, `CHAT_ANALYTICS_VIEW` to super admins and admins; `CHAT_CHANNEL_CREATE_*` to every role with `CHAT_SEND`; `CHAT_GUESTS_INVITE` to managers and admins.
- Set-up telemetry is not collected (FR-47): applied default.

## 9. Constitution Gates

- [x] I Plugin-first — extends `packages/plugins/chat`, `chat-ui` and the realtime plugin; access, privacy, meetings and push through their ports.
- [x] II Tenant/organization scoping — every row scoped; shared channels copy between tenants instead of reading across them.
- [x] III Both ORMs, additive migrations — new tables and columns only, three dialects.
- [x] IV Default-off flag; nothing removed — chat flags and the shared-channel switch off; existing permissions kept.
- [x] V Contracts and API first — rights, sync, status, share and admin routes with contracts before UI.
- [x] VI Permissions, privacy, security — new keys, guest ceilings, audited exports and holds, data-loss rules, listed outbound data.
- [x] VII Real-time through the event bus — outbox facts, realtime for clients, push through the platform's delivery.
- [x] VIII i18n and accessibility — every locale, right-to-left, keyboard operable.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on existing behaviour:

| Requirement | Existing behaviour it extends |
| --- | --- |
| FR-1, FR-6, FR-13 | `CHAT_VIEW`, `CHAT_SEND`, `CHAT_MANAGE`, default grants and chat FR-22–FR-24 of [`docs/specs/features/chat/spec.md`](../chat/spec.md) |
| FR-3, FR-5, FR-45 | the platform settings store, administration checklists and help items |
| FR-8, FR-16 | core invitations with their contact link |
| FR-33 | the host app's existing manifest, offline worker and push worker |
| FR-11, FR-14 | conversation managers and membership checks of chat FR-3, FR-22 |
| FR-24 | the activity-log entries for channel management and webhooks |
| FR-28, FR-4 | sanitised bodies and the egress guard of chat FR-20 |
| FR-36 | web push and delivery of [`docs/specs/features/inbox/spec.md`](../inbox/spec.md) FR-13 |
| FR-37–FR-39, FR-42 | replay, catch-up and token connections of [`docs/specs/features/realtime-channel/spec.md`](../realtime-channel/spec.md) FR-1–FR-3, FR-11 |
| FR-52 | the unique keys of the chat plan (direct key, membership, nonce) |

- Contracts used: [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md) FR-40–FR-43, FR-81–FR-83, FR-91–FR-98 (user types, audit, privacy, retention, holds), [`../data-import-export/spec.md`](../data-import-export/spec.md) (import and export runs), [`../meetings/spec.md`](../meetings/spec.md) FR-11, FR-41 (rooms for conversations), [`../email-and-communications/spec.md`](../email-and-communications/spec.md) FR-60, FR-61 (devices and push), [`../drive/spec.md`](../drive/spec.md) (trash), [`../calendar-and-scheduling/spec.md`](../calendar-and-scheduling/spec.md), [`../platform-administration/spec.md`](../platform-administration/spec.md) (telemetry controls, version), [`../report-builder-and-dashboards/spec.md`](../report-builder-and-dashboards/spec.md), [`../regional-compliance-packs/spec.md`](../regional-compliance-packs/spec.md) (national identifiers).
- Siblings: [`../chat-messaging/spec.md`](../chat-messaging/spec.md), [`../chat-agents-and-record-actions/spec.md`](../chat-agents-and-record-actions/spec.md); client: the Ever Teams spec `workspace-collaboration-clients`.
- Code: `packages/plugins/chat/src/lib/{services/chat-access.service.ts,database/migrations/1791000006200-SeedChatRolePermissions.ts,egress/}`, `packages/plugins/realtime/`, `packages/plugins/inbox/src/lib/delivery/push/`, `packages/plugins/chat-ui/src/lib/`.
