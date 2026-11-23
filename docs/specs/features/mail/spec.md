# Feature Specification: Mail

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `mail`
**Branch**: `feat/mail`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_MAIL` (new tenant feature, default off); the plugin loads only when `GAUZY_MAIL_ENABLED` is exactly `true` and needs the Inbox switches (`GAUZY_INBOX_ENABLED`, `GAUZY_INBOX_EMAIL_ENABLED`); triage with AI is an organization switch, off by default.

---

## 1. Overview

Behind the Inbox switches the platform already receives mail into personal, team and organization mailboxes on the
platform domain, on an organization's verified domain or by forwarding, with sanitizing, threading, sender checks, a
quarantine and an attention inbox entry per message; replies and forwards exist in the API only. `email-and-communications`
adds sending identities, connected outside mailboxes, signatures, templates, a composer on records, a queue with undo
and scheduled sending, delivery states and the communication log. This feature adds a **mail client** on the same
mailboxes and messages (no second store): a **three-pane reader** with conversations and an **all-inboxes** view; **folders, labels**, stars, snooze and bulk actions; **compose** with drafts, identities, aliases,
signatures and attachments from files and records; **search**; **rules**, **auto-replies**, **sender review** and
**junk** handling; **remote-content privacy** and attachment tools; **contacts autocomplete** and **calendar invitations**
in messages; **shared mailboxes** with assignment and states; **domains, quotas and deliverability reports**; **import and
export**. Clients: the Angular app (`mail-ui`, which shows messages with the Inbox's own message viewer), Ever Teams
through the same API, the MCP server and the SDKs.

Advanced capabilities: **triage** that ranks mail by priority, tells people from notifications and
newsletters, summarises long threads and prepares **suggested replies as drafts** for a person to edit and send;
**snooze and follow-up nudges** that bring a thread back when nobody answered; **one-click "turn this thread into a task,
ticket, lead, expense or bill"** with fields proposed from the message and the thread kept linked; **collision detection**
in shared mailboxes that shows who is reading or replying and checks again before sending; **rules with any number of
conditions**, run on demand over existing mail with a preview; **deliverability reports** read from the reports mailbox; and
**agent tools** that search, file and draft under the caller's rights.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee with a personal mailbox and access to "support@" and "sales@", **when** they open Mail, **then** they see their mailboxes and folders, an all-inboxes view with unread counts, the list with conversations and a reading pane they can put on the right, at the bottom or switch off.
- **Given** a conversation of six messages, two of them copies received in two mailboxes, **when** they open it, **then** the copies show once, earlier messages are collapsed, and each message has reply, reply all, forward and more.
- **Given** the composer, **when** they type "an", **then** colleagues, contacts and recent correspondents are suggested; they pick an identity among the mailboxes and aliases they may send as, the default signature is inserted, a file from `drive` and the PDF of an invoice are attached, and the draft is saved as they type.
- **Given** a sent message, **when** the undo window is still open, **then** "Undo" brings it back to the composer; a message scheduled for Monday 08:00 waits in "Scheduled" with send now, reschedule and cancel.
- **Given** a rule "from the bank's domain and subject contains statement → label Finance, move to Finance, mark read", **when** they save it with "apply to existing mail", **then** a preview shows the 214 matching messages first and the rule then applies to them and to new mail.
- **Given** an auto-reply from 1 to 14 August for contacts only, **when** a contact writes twice, **then** they get one auto-reply in that period; a newsletter gets none.
- **Given** sender review on, **when** an unknown sender writes, **then** the message waits in "Sender review" until the owner allows the sender (future mail goes to the inbox) or declines them (future mail goes to "Declined senders"); a sender the owner wrote to is allowed automatically.
- **Given** a message with remote images, **when** it opens, **then** images are blocked with "show images" once or always for this sender, loaded through the platform so the sender learns nothing about the reader.
- **Given** an invitation from an outside organizer, **when** the message opens, **then** a banner shows the event with the reader's calendar around it and accept, tentative and decline; the answer goes back to the organizer.
- **Given** the shared mailbox "support@" not bound to the helpdesk, **when** Ben assigns a thread to himself, **then** colleagues see "Ben" on it; **when** Ana opens it while Ben is replying, **then** she sees "Ben is replying" and, before she sends, that a reply went out meanwhile (advanced: collisions).
- **Given** triage on, **when** a morning's mail arrives, **then** "Important" lists the three messages from people waiting on an answer first, newsletters are grouped apart, and a long thread shows a three-line summary with a suggested reply ready as a draft (advanced).
- **Given** a sent proposal with "remind me if no reply in 3 days", **when** nobody answers, **then** the thread comes back to the top of the inbox on day 3 with "no reply yet" (advanced).
- **Given** a supplier's message with an invoice attached, **when** the reader chooses "Create bill", **then** a draft bill is proposed with supplier, number, date and amount from the attachment, created on confirmation and linked to the thread (advanced).
- **Given** an administrator, **when** they add the domain "acme.com", **then** the page shows the records to publish for receiving and sending, verifies them, and after a week shows which senders pass or fail authentication for the domain.

### 2.2 Edge cases & failures

- **Given** `FEATURE_MAIL` off, **then** every new route answers `404`, the Mail menu is absent, and the attention inbox, mailboxes, replies and the communications composer behave as today.
- **Given** a mailbox the helpdesk claims as a ticket channel, **then** the client shows its messages read-only with links to their tickets, refuses replies from the client with "answer in the ticket", and its rules, sender review and auto-reply do not run.
- **Given** a user who loses access to a shared mailbox, **then** its folders disappear from their client at once, while messages addressed to them personally stay readable.
- **Given** two people moving the same message to different folders at once, **then** the later move wins and the other sees the message move.
- **Given** a draft edited on two devices, **then** the later save wins and the other device shows "changed on another device" with a reload.
- **Given** a rule that forwards to an outside address, **then** it needs the mailbox manager's confirmation, never forwards messages held as spam, and stops after 100 forwards an hour.
- **Given** an auto-reply loop with another automatic sender, **then** no auto-reply answers automatic messages, lists or messages that are themselves auto-replies.
- **Given** a mailbox over its quota, **then** new mail is still kept, the owner and managers are told daily, and, where a manager set a retention, trash older than it is purged first.
- **Given** a permanent delete of a message linked to a record or under hold, **then** the message leaves the mailbox views but stays on the record.
- **Given** a connected mailbox whose server refuses a move, **then** the move is undone in the client with the server's reason.
- **Given** an import file with messages already present, **then** duplicates by message identity are skipped and counted.
- **Given** no AI provider or triage off, **then** no ranking, summary or suggested reply appears; everything else works.

## 3. Functional Requirements

### 3.1 Presence and existing mail

- **FR-1** The system MUST load only when `GAUZY_MAIL_ENABLED` is exactly `true` and the Inbox email switches are on, and answer every new route with `404` while `FEATURE_MAIL` is off.
- **FR-2** The system MUST keep mailboxes, receiving, quarantine, Inbox replies and forwards, the attention inbox, the communications composer, intake rules and hand-offs working as today, and show their messages in the client without copying them.
- **FR-3** The system MUST keep read, archive and snooze state of a message the same in the client and the attention inbox for each person when the message has an attention entry: it is one state, the attention entry's.
- **FR-4** The system MUST show mailboxes claimed by another feature (a helpdesk channel, an agent hand-off) read-only with a link to the claiming record, refuse replies from the client for them, and run none of this feature's rules, sender review or auto-replies on them.
- **FR-5** A user can choose per mailbox whether its new mail also creates attention entries (default as today: yes).

### 3.2 Mailboxes and all inboxes

- **FR-6** The system MUST list for a user every mailbox whose mail they receive (personal, team, organization, connected) with folders and unread counts, and an all-inboxes view merging their inboxes with one unread count.
- **FR-7** A user with `INBOX_MAILBOX_MANAGE` can manage mailboxes from the mail settings: create, rename, deactivate, members and roles, aliases, distribution lists, quota and whether a mailbox receives.
- **FR-8** A mailbox owner can let colleagues read and answer their personal mailbox as delegates, shown to recipients as "on behalf of".
- **FR-9** A user can switch between mailboxes and the all-inboxes view with one key and see which mailbox each message in the merged view belongs to.
- **FR-10** The system MUST show a connected mailbox's server folders as its folders and, where the connection allows, apply moves, flags and deletions on the server, undoing a refused change with the server's reason.
- **FR-11** A user can choose the reading pane on the right, at the bottom or off, list density, conversation view on or off, and grouping of the list by date.
- **FR-12** The system MUST update open lists, counts and conversations within 2 s when messages arrive or change.

### 3.3 Reading and conversations

- **FR-13** The system MUST show a conversation's messages oldest to newest with earlier ones collapsed, copies of one message received in several mailboxes the reader can see shown once, and quoted text folded.
- **FR-14** The system MUST render a message's sanitised body in an isolated frame without scripts, with sender, recipients, date in the reader's time zone, authentication verdicts on request, and attachments listed.
- **FR-15** A user can reply, reply all and forward from any message in a conversation, with the quote and the original attachments on forward.
- **FR-16** The system MUST mark a message read when it stays open for 2 seconds (setting: immediately, after 2 s, manually).
- **FR-17** A user can print a message or a conversation and open a message in its own window.
- **FR-18** The system MUST show delivery states of messages the reader sent (queued, sent, delivered, deferred, bounced, failed) from the communication log, with the reason of a failure.
- **FR-19** The system MUST show links of a message to records (ticket, deal, contact, bill) and let the reader open them.

### 3.4 Folders, labels and message actions

- **FR-20** The system MUST give each mailbox the folders Inbox, Sent, Drafts, Scheduled, Archive, Junk and Trash, and let a user with manage rights on it add nested folders with name, colour and position, rename, move and delete them (messages of a deleted folder go to the Inbox).
- **FR-21** The system MUST keep each message in one folder of its mailbox and let it carry any number of labels.
- **FR-22** A user can create labels for their mailbox and use organization labels (managed with `INBOX_MAILBOX_MANAGE`), each with a name and colour; labels are the organization's tags of the mail type, a mailbox's own labels shown only in that mailbox.
- **FR-23** A user can star, mark read or unread, label, move, archive, mark as junk or not junk, delete to Trash and restore, for one message, a conversation or a selection (up to 5,000 at once, applied in the background with progress).
- **FR-24** A user can snooze a conversation until a time (later today, tomorrow, next week, a chosen time); it leaves the inbox and returns unread at that time; the snooze is the person's own, the same as snoozing its attention entries.
- **FR-25** A user can empty Trash or Junk after a confirmation that states the number of messages; messages linked to records or on hold leave the mailbox views and stay on their records.
- **FR-26** The system MUST purge Trash and Junk older than the mailbox's retention once a mailbox manager sets one (none by default, so no message is purged until then; 30 days is the suggested value); messages filed to Junk by a spam verdict are kept until then like any other.
- **FR-27** The system MUST keep folder, label and star state per mailbox (shared by all its members) and read state per person.
- **FR-28** A user can mute a conversation so later messages of it skip the inbox and notifications.
- **FR-29** The system MUST offer push notices of new mail per mailbox and folder, which a user can mute, through the platform's notification delivery.

### 3.5 Compose, drafts and sending

- **FR-30** A user can write a new message, reply or forward in a composer that can be docked, minimized and opened full size, with recipient chips for to, cc and bcc, a subject, a rich-text body, emoji, and an identity picker.
- **FR-31** The system MUST suggest recipients as the user types from colleagues, contacts and people of the platform the user may read and their own recent correspondents, and turn a mention of a colleague in the body into a recipient when the user confirms.
- **FR-32** A user can attach uploads, files of `drive` and record documents (a record's PDF in a print template) and inline images; above the identity's size limit the system offers protected links instead.
- **FR-33** The system MUST save drafts automatically every 5 seconds of typing and on close, list them in Drafts, keep them private to their author unless shared with the mailbox's members, and resume them on any device; a draft is a communication of `email-and-communications` in draft state.
- **FR-34** The system MUST send through the sending contract of `email-and-communications` with its undo window, scheduling, queue, delivery states and record links, and store the sent message in the mailbox's Sent folder and conversation.
- **FR-35** A user can schedule a message for a time in their time zone and, in Scheduled, send it now, reschedule or cancel it; failed sends show in the mailbox with retry and dismiss.
- **FR-36** The system MUST link a reply to the records its conversation is linked to.
- **FR-37** The system MUST refuse sending from an identity the user may not use and from a claimed mailbox (FR-4), naming the reason.
- **FR-38** The system MUST warn before sending when the message mentions an attachment but has none, or when recipients are outside the organization and the conversation was internal.
- **FR-39** The system MUST, when `email-and-communications` is not loaded, send through the mailbox's own sending path of the Inbox, without scheduling, undo or delivery states, and keep an unsent draft only on the device where it is written.

### 3.6 Identities, aliases, signatures and lists

- **FR-40** The system MUST offer as identities the mailboxes a user may send from, their aliases marked send-as, and the sending identities of `email-and-communications` they may use, and preselect the identity of the mailbox a reply comes from.
- **FR-41** A user with `INBOX_MAILBOX_MANAGE` can give a mailbox aliases on the same domains; mail to an alias arrives in the mailbox marked with the alias, and replies leave from the alias.
- **FR-42** A user can pick the default signature per identity from the signatures of `email-and-communications` and choose whether it goes above or below quoted text.
- **FR-43** A user with `MAIL_LISTS_MANAGE` can create distribution addresses with members (colleagues, mailboxes, outside addresses) and who may write to them (members, the organization, anyone); a message to the address reaches each member once.
- **FR-44** The system MUST refuse an alias or list address that is taken anywhere in the deployment or on a domain the organization has not verified.
- **FR-45** The system MUST refuse messages to a list from senders it does not allow and tell the list's managers once a day.

### 3.7 Search

- **FR-46** A user can search all mail they may read by words in subject, body, sender, recipients and attachment names, with filters for mailbox, folder, label, from, to, date range, has attachment, unread, starred and size, and save a search as a folder-like view.
- **FR-47** The system MUST suggest people, labels and recent searches while typing and show results ranked by relevance or date with the matched words marked.
- **FR-48** The system MUST apply mailbox access to every result and never show messages of mailboxes the user lost access to.

### 3.8 Rules, auto-replies, sender review and junk

- **FR-49** A mailbox owner, or a manager of a shared mailbox, can create rules with any number of conditions joined by all or any (sender, recipients, subject, body, has attachment, size, list message, sender is a contact, label) and any number of actions (move, label, star, mark read, mark important, assign, forward, reply with a template, archive, delete, stop further rules), ordered.
- **FR-50** The system MUST apply active rules in order within 5 seconds of a message's arrival, record each rule's hits, and let a user apply a rule to existing mail after a preview of the matching messages (up to 50,000); mailbox rules run after the sender rules and the intake rules of `email-and-communications` and use the same conditions.
- **FR-51** The system MUST require a mailbox manager's confirmation for rules that forward outside the organization, never forward messages held as spam, and limit forwards to 100 an hour per mailbox.
- **FR-52** A user can set an automatic reply for a mailbox with start and end, subject and body, for everyone or contacts only, sent at most once per sender per 4 days (setting), never to automatic messages, lists or other auto-replies.
- **FR-53** A mailbox owner can switch on sender review: mail from senders who are not contacts, colleagues or allowed waits in Sender review until the owner allows or declines the sender; mail from declined senders goes to "Declined senders"; senders the owner writes to are allowed; a decision can be undone. Decisions are the mailbox's sender rules of `email-and-communications`, listed with the mailbox's existing allow list; without that feature only the allow list filters senders.
- **FR-54** The system MUST put messages with a suspect spam verdict in Junk, keep the quarantine as today for held messages, and show each message's spam decision with its reasons.
- **FR-55** A user marking a message as junk can also block its sender for the mailbox, and marking as not junk can allow it, through the sender rules of `email-and-communications`.
- **FR-56** A mailbox manager can set the mailbox's spam thresholds within the deployment's limits.
- **FR-57** The system SHOULD accept content scanning adapters (spam and malware) as plugins and honour their verdicts like provider verdicts.
- **FR-58** The system MUST show a mailbox's spam and sender review decisions in a log for its managers with the 30 last days.

### 3.9 Attachments, remote content and privacy

- **FR-59** A user can preview attachments that are images, PDF, text and documents the documents hub can preview, download one or all as an archive, and save any to `drive` or to a linked record's files.
- **FR-60** A reader can download a message as a standard message file and view its source, which only downloads and never renders.
- **FR-61** The system MUST block remote images and fonts by default and load them, when the reader allows once or always for a sender, through the platform's guarded fetcher with tracking parameters removed and the reader's address hidden; the allow prompt tells the reader that an image can still let the sender know the message was opened, and opened again when it is viewed more than a day later, because an identifier in the image's own address cannot be removed. Allowing always for a sender is offered for, and applies to, only messages whose sender address passes the platform's domain authentication check; a message from that address that does not pass it asks again.
- **FR-62** The system MUST show sender pictures only from the platform's own contacts and colleagues.
- **FR-63** The system MUST warn before opening a link whose shown text names another address than its target.

### 3.10 Contacts and calendar invitations

- **FR-64** A reader can save a sender or recipient as a contact or a person of an existing organisation, with name and address from the message.
- **FR-65** The system MUST offer contacts to connected address books through the address-book sync of `integration-hub`, and contact files through `data-import-export`.
- **FR-66** The system MUST show calendar invitations, updates and cancellations in a message as a banner with the event, the reader's busy times around it and answers, applied through `calendar-and-scheduling`; replies from other organizers update the event the same way.
- **FR-67** A reader can add an outside event file attached to a message to one of their calendars.

### 3.11 Shared mailboxes

- **FR-68** A member of a shared mailbox can assign a conversation to a member, take it, or unassign it, and set its state (open, waiting on the customer, closed); a new message reopens a closed conversation.
- **FR-69** The system MUST offer views per shared mailbox: unassigned, assigned to me, waiting, closed, and by assignee.
- **FR-70** Members can comment on a conversation internally with mentions; comments never leave the platform.
- **FR-71** (advanced) The system MUST show live who is reading and who is replying to a conversation, and show a draft in progress by another member.
- **FR-72** (advanced) The system MUST check before sending whether a message or reply arrived in the conversation since the composer opened, show it, and let the sender review, send anyway or discard.
- **FR-73** The system MUST tell an assignee of a new assignment and of new messages in conversations assigned to them, per their preferences.

### 3.12 Domains, quotas and deliverability

- **FR-74** A user with `MAIL_DOMAINS_MANAGE` can see the domains of the organization's mailboxes, verify each once for all its mailboxes with the proof the Inbox already checks (a domain verified there stays verified), see the records to publish for receiving and for sending authentication (from the provider account and `email-and-communications` checks), copy them, export them as a file and see each one's state.
- **FR-75** The system MUST let mailboxes, aliases and lists use only verified domains or the platform domain, re-check domains daily, and warn managers when a record disappears.
- **FR-76** A user with `INBOX_MAILBOX_MANAGE` can set storage quotas per mailbox (default from the organization); the system shows use, warns at 80 % and 95 %, and keeps receiving above it while telling the owner daily.
- **FR-77** A domain manager can name a reports mailbox; the system reads aggregate authentication reports and secure-transport reports sent to it and keeps them per domain and reporter.
- **FR-78** The system MUST show per domain the share of messages passing and failing authentication, by sending source, and secure-transport successes and failures with their reasons.
- **FR-79** The system MUST warn domain managers when an unknown source sends more than 100 messages a day as the domain or when a known source starts failing authentication.
- **FR-80** The system MUST show administrators an overview of mailboxes, members, aliases, lists, quotas, inactive and failing mailboxes.

### 3.13 Import, export, programs and access

- **FR-81** A user can import messages from standard message files and mailbox archives into a mailbox folder they manage (up to 2 GB per import), in the background with a result report, skipping duplicates by message identity, as a run of the platform's data import.
- **FR-82** A user can export a folder, a search result or a whole mailbox they manage as standard mailbox archives or message files, in the background with a download link valid for 7 days, as a run of the platform's data export.
- **FR-83** The system MUST show per mailbox how outside mail clients reach it: the server settings of a connected mailbox, the forwarding address of a platform mailbox, and the sending settings of its identity.
- **FR-84** A user can create a personal key of `access-control-and-security` scoped to their mail for programs and agents that read and send through the API, and revoke it.
- **FR-85** The system MUST offer other features and integrations reading of a mailbox's messages and sending from it through the API and the contracts of FR-34 and FR-94, under the caller's mailbox access.

### 3.14 Triage, nudges and records `(advanced)`

- **FR-86** (advanced) The system MUST, when the organization enabled triage and an AI provider is configured, rank incoming mail by priority (needs your answer, important, normal, low), tell people from notifications, newsletters and receipts, and show an "Important" view first; the reader can correct a ranking, which teaches their future ranking.
- **FR-87** (advanced) The system MUST summarise conversations longer than five messages in three lines on request or automatically (setting), using the thread summary of `email-and-communications`, marked as generated.
- **FR-88** (advanced) The system MUST prepare up to three suggested replies for messages that need an answer as drafts the reader can pick, edit and send; nothing is sent without the reader.
- **FR-89** (advanced) A user can ask to be reminded when a sent message gets no reply within a time (default 3 days); the conversation then returns to the top of the inbox marked "no reply yet", and a reply cancels the reminder; the reminder is one of the platform's reminders on records, listed with the person's others.
- **FR-90** (advanced) The system MUST remind a user, when they allowed it, of received messages that need their answer and are still unanswered after 2 working days.
- **FR-91** (advanced) A reader can turn a conversation into a task, ticket, lead, expense or supplier bill, or any record type that declares mail intake, with fields proposed from the messages and attachments, created on confirmation through the owning feature and linked to the conversation.
- **FR-92** (advanced) The system MUST offer MCP and in-app assistant tools to search mail, read a conversation, label, move, snooze, draft a reply (saved as a draft, never sent), summarise, and propose a record from a conversation (preview first), within the caller's mailbox access.
- **FR-93** (advanced) The system MUST send message content to the organization's AI provider only when triage or the assistant is enabled, and never for mailboxes the organization excluded.

### 3.15 API, events, shortcuts and reports

- **FR-94** The system MUST expose every capability through REST with GraphQL reads, idempotency keys on creating routes and cursor pagination.
- **FR-95** The system MUST publish, with ids only, as automation triggers and webhook events: message filed, moved, labelled, assigned, conversation state changed, rule applied, auto-reply sent, sender reviewed, domain state changed, report received.
- **FR-96** The system MUST offer keyboard shortcuts for every list and message action with a help overlay, switchable off, and a phone-width layout of the client.
- **FR-97** The system MUST record who, when, before and after for mailbox, alias, list, folder, label, rule, auto-reply, sender review, domain and quota changes and for permanent deletions.
- **FR-98** The system MUST register these report definitions (filters period, mailbox, domain, assignee; table and chart; export and schedules through the report builder, a read-only view without it):

  | Report | Answers |
  | --- | --- |
  | Mail overview | mailboxes, members, aliases, lists, quota use, inactive and failing mailboxes |
  | Domain authentication | messages passing and failing per domain, source and reporter |
  | Secure transport | successful and failed sessions per domain with failure reasons |
  | Outbox | messages pending, sent and failed per mailbox and identity, with recipient states |
  | Shared mailbox work | conversations, first answer time, time to close and backlog per mailbox and assignee |
  | Rules and sender review | rule hits, auto-replies sent, senders reviewed per mailbox |

- **FR-99** The system MUST leave the Inbox's message viewer and the platform's search results exactly as today for tenants with `FEATURE_MAIL` off: the "show images" consent of FR-61 and mail hits in search appear only for tenants with the feature on.

## 4. Non-Functional Requirements

- **Performance**: mailbox list page P95 < 300 ms at 1 million messages in a mailbox and 50 million per tenant; open a conversation P95 < 400 ms; search P95 < 700 ms over the tenant's mail; rules applied within 5 s of arrival; counts and lists live within 2 s; draft saves P95 < 200 ms.
- **Volume and concurrency**: 5,000 mailboxes and 2,000 concurrent client users per tenant; bulk actions of 5,000 messages; imports of 2 GB; concurrent moves resolved by the later change.
- **Reliability**: rules, sender review and auto-replies run once per message and survive restarts; imports and exports resume; server-side changes on connected mailboxes retried and undone on refusal.
- **Security & privacy**: mailbox access checked on every read, search, export and MCP call; bodies shown only sanitised in an isolated frame; message sources only downloaded; remote content blocked by default and proxied; sender review and rule decisions logged; personal keys scoped and revocable. Leaving the platform: sent messages, forwards and auto-replies to their recipients through the mailbox's sending path; message content to the AI provider only per FR-93; remote content requests from the platform's fetcher.
- **Auditability**: per FR-97.
- **Accessibility and localization**: the three panes and composer operable by keyboard, labelled and announced; colour never the only signal; every string in all shipped locales; dates in the reader's locale and time zone.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted (receiving through the deployment's mail paths); works without communications (FR-39), calendar, drive, CRM, helpdesk and AI providers, whose parts are then absent; OpenAPI and SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Mailbox, message, conversation | The existing mailbox, received or sent message and thread, shown by the client |
| Folder, label | A place of a message in its mailbox; a tag a message can carry many of |
| Message state, read mark | A message's folder, labels and star in its mailbox; a person's read state of a message without an attention entry |
| Conversation state | Assignee, state and mute of a conversation (snooze and reminders are the person's attention entries and platform reminders) |
| Draft | An unsent message of its author, saved as typed: a communication in draft state with the client's fields |
| Alias, distribution address | Another address of a mailbox; an address that reaches several members |
| Rule, auto-reply | Conditions and actions applied to arriving mail; a dated automatic answer |
| Sender decision | An address allowed or declined for a mailbox: a sender rule of the mailbox |
| Domain, domain report | An organization's own mail domain, proved through its mailboxes; a received authentication or secure-transport report |
| Mail transfer | An import or export of messages: a run of the platform's data import or export |
| Triage result | A message's ranking, kind, summary and suggested replies |

## 6. Out of Scope

- Sending identities, connected mailbox connections, signatures, templates, the queue, undo and scheduling, delivery states, record-linked email, intake rules, sender rules and the communication log → `email-and-communications` (this client uses them).
- Ticket handling of channel mailboxes → `helpdesk-tickets`; events and answers → `calendar-and-scheduling`; files → `drive`; contacts and the party model → `crm-leads-and-deals`; contact sync → `integration-hub`.
- Campaigns, newsletters and marketing lists with consent → `marketing-campaigns`; sign-in, password recovery and key policies → `access-control-and-security`; Ever Teams mail screens → the Ever Teams spec `workspace-collaboration-clients`.

## 7. Acceptance Criteria

- [ ] **AC-1** With `FEATURE_MAIL` off every new route answers `404`; mailboxes, receiving, the attention inbox, replies and the communications composer pass their tests unchanged (FR-1, FR-2).
- [ ] **AC-2** The client lists a user's mailboxes with counts and an all-inboxes view; copies of one message show once; read state matches the attention inbox both ways (FR-6, FR-9).
- [ ] **AC-3** A helpdesk channel mailbox shows read-only with ticket links and refuses replies from the client (FR-4, FR-19).
- [ ] **AC-4** Folders, labels, stars, snooze, mute and bulk actions on 5,000 messages work and update a second client within 2 s (FR-21, FR-27, FR-28).
- [ ] **AC-5** Compose with suggestions, identity, signature, `drive` file and record PDF; drafts resume on another device; undo and scheduling come from communications; without communications the mailbox path sends (FR-32–FR-34).
- [ ] **AC-6** An alias receives and replies from itself; a distribution address reaches each member once and refuses a disallowed sender (FR-41, FR-43).
- [ ] **AC-7** Search finds a word in an attachment name and a body within access, saved searches work, and a removed member sees nothing of the mailbox (FR-46–FR-48).
- [ ] **AC-8** A rule with four conditions and three actions applies within 5 s and to existing mail after a preview; an outside forward needs confirmation (FR-50, FR-51).
- [ ] **AC-9** An auto-reply answers a contact once in its window and never an automatic sender; sender review holds, allows, declines and undoes (FR-52, FR-53).
- [ ] **AC-10** Remote images load only after consent through the platform's fetcher; message sources only download (FR-59–FR-61).
- [ ] **AC-11** An outside invitation shows the banner and the answer updates the calendar event (FR-66, FR-67).
- [ ] **AC-12** Assignment, states and internal comments in a shared mailbox; live reading and replying marks; the send-time check shows a reply sent meanwhile (advanced: collisions; FR-70–FR-72).
- [ ] **AC-13** A domain verifies with its records; aggregate and secure-transport reports from the reports mailbox appear per domain; an unknown sending source raises a warning (FR-77–FR-79).
- [ ] **AC-14** Quota warnings at 80 % and 95 % and receiving above quota; Trash purges after a retention its manager set, and nothing is purged from a mailbox without one; linked messages stay on records (FR-25, FR-26, FR-76).
- [ ] **AC-15** Import of a mailbox archive skips duplicates; export of a folder downloads within its 7-day link (FR-81, FR-82).
- [ ] **AC-16** Triage ranks, groups newsletters, summarises a long thread and prepares suggested replies as drafts; corrections change later rankings; nothing is sent without the reader (advanced: triage; FR-86–FR-88, FR-93).
- [ ] **AC-17** A no-reply reminder brings the thread back on its day and a reply cancels it (advanced: nudges; FR-89, FR-90).
- [ ] **AC-18** A conversation becomes a ticket, task, lead, expense and bill with proposed fields and stays linked (advanced: records from mail; FR-91).
- [ ] **AC-19** Every MCP tool of FR-92 answers within mailbox access; drafts are never sent by an agent.
- [ ] **AC-20** The six report definitions of FR-98 return the expected figures on the demo data set.
- [ ] **AC-21** The client passes keyboard and screen-reader checks; works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-96; §4).
- [ ] **AC-22** With `FEATURE_MAIL` off, the Inbox viewer offers no "show images" and global search returns the same results as before; with it on and no retention set, no message is ever purged (FR-99).
- [ ] **AC-23** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- The platform runs no mail server: outside mail clients reach platform mailboxes only by forwarding, and connected mailboxes keep their own server (FR-83). Applied default: no standard mail protocol access to platform mailboxes.
- Thread assignment: this feature owns the assignee of mailbox conversations; the communications mailbox view's assign action writes the same assignee when mail is loaded. Applied default.
- New mail keeps creating attention entries by default (FR-5). Applied default.
- Folder, label and star state is shared per mailbox, read state per person (FR-27). Applied default.
- Trash and Junk kept until a mailbox manager sets a retention (30 days suggested), auto-reply once per sender per 4 days, outside forwards capped at 100 an hour. Applied defaults, all settings.
- Content scanning adapters are optional plugins; none ships with this feature (FR-57). Applied default.

## 9. Constitution Gates

- [x] I Plugin-first — new `packages/plugins/mail`, `mail-ui`; the Inbox gains optional seams and shares its message viewer.
- [x] II Tenant/organization scoping — every record carries tenant and organization; mailbox access on every read.
- [x] III Both ORMs, additive migrations — new tables only; the Inbox tables are unchanged.
- [x] IV Default-off flag; nothing removed — deploy flag and `FEATURE_MAIL` off; mailboxes, attention inbox and replies untouched.
- [x] V Contracts and API first — contracts and REST before UI; sending through the existing contract.
- [x] VI Permissions, privacy, security — new keys beside the Inbox keys; isolated rendering, proxied remote content, outside-forward confirmation, audited deletions.
- [x] VII Real-time through the event bus — outbox events, live counts and collision presence on the platform channel.
- [x] VIII i18n and accessibility — keyboard client and composer, keys in every locale.
- [x] IX Tests accompany the change — unit tests for rules, sender review, auto-replies, deduplication; e2e for client flows.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../email-and-communications/spec.md`](../email-and-communications/spec.md); builds on [`docs/specs/features/inbox/spec.md`](../inbox/spec.md)
- Works with: [`../helpdesk-tickets/spec.md`](../helpdesk-tickets/spec.md), [`../calendar-and-scheduling/spec.md`](../calendar-and-scheduling/spec.md), [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md), [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md), [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md), [`../integration-hub/spec.md`](../integration-hub/spec.md), [`../data-import-export/spec.md`](../data-import-export/spec.md), `drive`
- Code: `packages/plugins/inbox/` (`EMAIL.md`, `src/lib/email/**`), `packages/plugins/inbox-ui/`, `packages/plugins/email-provider-*`, `packages/contracts/src/lib/inbox-email.model.ts`, `packages/core/src/lib/{email-send,email-template,email-history,custom-smtp}`, `packages/plugins/search/`
