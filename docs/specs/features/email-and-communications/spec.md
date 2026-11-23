# Feature Specification: Email and communications

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `email-and-communications`
**Branch**: `feat/email-and-communications`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_COMMUNICATIONS` (tenant feature, default off) · the plugin loads only when
`GAUZY_COMMUNICATIONS_ENABLED` is exactly `true` · receiving keeps the Inbox switches (`GAUZY_INBOX_ENABLED`,
`GAUZY_INBOX_EMAIL_ENABLED`) · connected mailboxes add `EMAIL_PROVIDER_IMAP_ENABLED` · each text message or push
adapter has its own `*_ENABLED` switch; text and push accounts are kept with the Inbox's provider accounts, so they need
the Inbox's email switch too

---

## 1. Overview

Today the platform sends system email from templates per language through the organization's or tenant's mail server
settings or one of five email provider plugins, and keeps an email history with resend. Behind the Inbox switches it
receives mail into mailboxes with threads, quarantine, reply and a hand-off seam. Text messages have a settings page
that stores nothing; push reaches only browsers. This feature makes **one communications service for every record**:
sending identities, connected mailboxes, a composer on any record with templates, attachments and scheduling, a durable
queue with per-recipient delivery status, mail that becomes or joins a record, a **communication log** on every record
it concerns, suppression and unsubscribe, text messages and mobile push through adapters. Automation, payments, payroll,
helpdesk, print, reports and access control send through it. Clients: the Angular app, Ever Teams (its own mail screens
over this feature's API), MCP and the SDKs.

**Advanced capabilities.** Each sending identity carries a **delivery health score** with domain checks and
**warm-up warnings** before a volume jump hurts it; an assistant **drafts replies and summarises threads** for a person
to approve; a party's emails, text messages, chat and calls read as **one conversation** with a reply on any channel;
incoming mail is **matched to records with a stated reason and confidence**; and messages to customers respect their
**local sending window**. Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an administrator with `COMMUNICATIONS_ACCOUNT_MANAGE`, **when** they add the identity "Sales" with reply-to,
  signature, footer with logo and archive copy and make it the quotation default, **then** a test message arrives with
  signature and footer, and every quotation email leaves as that identity.
- **Given** a salesperson on a deal, **when** they send the template "Quotation follow-up" in the contact's language with
  the quotation PDF and a file, **then** within a minute it is sent, appears on the deal, the contact and the customer
  organization, and its recipients show delivered, then opened.
- **Given** a mailbox "support@" with the intake rule "create a ticket", **when** a customer writes, **then** a ticket is
  created with the sender matched to their contact, one acknowledgement with the reference goes back, and the customer's
  reply joins the same ticket.
- **Given** an employee who connected their own mailbox by signing in, **when** a client writes to them, **then** the
  message is pulled within two minutes, shows on the client's timeline and is answered from the record.
- **Given** a clerk on a confirmed order, **when** they choose **Text message**, **then** the order's default text fills
  in, the counter shows two parts, and after sending the log row turns delivered.
- **Given** a customer who clicks **Unsubscribe** in a statement email, **then** the next statement run skips them as
  "suppressed: unsubscribed" while receipts still reach them.
- **Given** an agent on a long thread, **when** they choose **Summarise** and **Draft reply**, **then** a short summary with
  the open question appears and a draft in the customer's language waits for them to edit and send. `(advanced)`
- **Given** an identity whose daily volume would jump from 200 to 5,000, **when** a bulk send is queued, **then** a warm-up
  warning recommends a ramp and offers to spread the send. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a user without `COMMUNICATIONS_MESSAGE_SEND` or view rights on the record, **then** sending answers `403`; with
  the feature off new routes answer `404` and system mail, the Inbox and email history work as today.
- **Given** a temporary refusal by the mail server, **then** the message retries with back-off, shows "retrying", and is
  marked failed with the server's answer after the last attempt.
- **Given** a message stuck "sending" after a crash, **then** it is taken up after 10 minutes and never sent twice to a
  recipient the transport already accepted.
- **Given** an incoming message matching two records equally, **then** it lands in the mailbox's "to file" list with both
  candidates for a person to file in one click.
- **Given** an auto-reply from the other side, **then** no acknowledgement goes back; a hard bounce suppresses the
  address and tells the record owner once; a revoked mailbox sign-in stops pulling and asks the owner to reconnect.
- **Given** a text to a country the account does not allow or past the monthly cap, **then** it is refused before sending
  with the reason; a bulk send cancelled halfway cancels what is queued and keeps what was sent.
- **Given** two people replying to one thread at once, **then** the second sees the first reply before sending.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads this feature only when `GAUZY_COMMUNICATIONS_ENABLED` is exactly `true` and gates every new
  route, GraphQL field, menu entry and MCP tool with `FEATURE_COMMUNICATIONS`; off, they answer `404`.
- **FR-2** The system keeps system templates, mail server settings, provider accounts, email history with resend,
  mailboxes, the receiving pipeline and Inbox replies working as today and reads them as this feature's first data. Each
  email body is stored once: the email history keeps a row for every send and shows and resends the body of a message
  sent through this feature from that message; mailbox mail stays in the mailbox; invoice and estimate emails and invoice reminders
  keep sending as today and appear in the invoice's communication log without being sent again.
- **FR-3** The system sends through the existing transport order (named account, organization then tenant default
  account, organization then tenant mail server settings, deployment mail settings).
- **FR-4** The system only adds routes, fields and values to existing contracts; nothing is renamed or removed.

### 3.2 Sending identities and accounts

- **FR-5** A user with `COMMUNICATIONS_ACCOUNT_MANAGE` can define sending identities per organization: who messages
  appear to come from and where answers go, the sign-off and branding they carry, an optional archive copy, the transport
  they leave through (mail server settings, a provider account or a connected mailbox), and whether they hide the author.
- **FR-6** The system lets one identity be the organization default, one per record type and one per message purpose
  (system, record, bulk), and resolves the identity for a send in the order purpose, record type, organization default.
- **FR-7** A user can attach their connected mailbox as a personal identity that only they (and delegates they name) can
  send from; system mail never uses a personal identity.
- **FR-8** The system verifies an identity on save with a test message to the editor and refuses a transport that fails
  the test, naming the error.
- **FR-9** The system wraps a message body in the identity's footer, logo and organization address unless the template is
  marked raw, and lets the organization switch the standard footer off for automatic reports.
- **FR-10** The system lists the five provider plugins, the mail server settings and connected mailboxes as accounts on
  one page, each with direction (in, out, both), scope, default flags, last check and last error.
- **FR-11** The system marks an incoming account to create a contact from an unknown sender when the organization chooses
  so, never for addresses on the organization's own domains.

### 3.3 Connected mailboxes and receiving

- **FR-12** A user can connect an existing mailbox by the standard mail protocols (host, port, encryption, user and
  password) or by signing in with its provider through a connected account of `integration-hub`; passwords are stored
  encrypted and never returned.
- **FR-13** The system pulls a connected mailbox every 2 minutes (setting 1 to 60), for the folders chosen, all or only
  unread messages, with an initial window (default the last 30 days, at most 5,000 messages) and an attachment size limit
  above which the attachment is skipped and named in the message.
- **FR-14** The system passes pulled messages through the existing receiving pipeline (sanitizing, threading, sender
  checks, spam verdicts, quarantine) so a connected mailbox behaves as any other mailbox.
- **FR-15** The system marks a message read on the server when it is read in the platform and the mailbox owner chose
  two-way read state, and appends messages sent from a connected mailbox to its sent folder when the server allows.
- **FR-16** A mailbox manager can set sender rules per mailbox (allow, block, always quarantine by address or domain);
  messages refused by a rule are kept 30 days with the rule named. A mailbox's existing sender allow list is the same list
  as its allow rules and keeps its meaning: a mailbox with allow rules admits only the senders they name and holds an
  unauthenticated one in the quarantine, as today; mailbox rules come before organization rules, and block before
  quarantine before allow; for tenants with the feature off, mail is admitted exactly as the allow list admits it today.
- **FR-17** The system stops pulling a mailbox after five failed sign-ins in a row, tells its owner and the account
  managers, and resumes after a successful reconnect from the last pulled position.

### 3.4 Mail to records

- **FR-18** A user with `COMMUNICATIONS_INTAKE_MANAGE` can give a mailbox intake rules: for messages matching conditions
  (to address, sender domain, subject words), create a record of a type that declares mail intake (for example a ticket,
  a lead or a supplier bill to capture), or only link to records found.
- **FR-19** The system links a reply to its record by the reference token the platform put in the subject or headers,
  then by thread, then by the rules of FR-80; a reply never creates a second record.
- **FR-20** The system sends, when the rule says so, one acknowledgement per new record from a template with the record's
  reference, at most once per sender per hour, never to automatic senders or bulk mail, and never in answer to another
  acknowledgement.
- **FR-21** The system lets a rule notify chosen people when a linked thread waits for an answer longer than N minutes
  (default 60) within working hours, once per waiting message.
- **FR-22** The system shows each mailbox's messages with their record links, the "to file" list of unmatched messages,
  and lets a member with access link, unlink, assign to a colleague or create a record from a message.
- **FR-23** The system lets a record type owner declare mail intake (fields filled from subject, body, sender, sender
  name, receiving mailbox, attachments), so a new type joins intake without changes here.

### 3.5 Composer on records

- **FR-24** A user with `COMMUNICATIONS_MESSAGE_SEND` and view rights on a record can email from it: they pick people
  among the record's parties and fields or type addresses, choose an identity and a template, and attach the record's
  PDF in a print template of their choice, the record's files or uploads.
- **FR-25** The system fills template tokens from the record, its related records, custom fields, the sender and the
  recipient, in the recipient's language when the template has it, else the organization's.
- **FR-26** The system holds a sent message for an undo window (default 15 s, setting 0 to 30) before it is queued.
- **FR-27** A user can schedule a message for a later time in their time zone, edit or cancel it until it is queued, and
  see scheduled messages on the record and in "My scheduled messages".
- **FR-28** The system stores the message on the record with its rendered body and attachment list; the record's PDF is
  kept with the message only when the organization chooses so, else it is re-rendered on demand.
- **FR-29** The system refuses a send whose attachments exceed the identity's limit (default 20 MB), naming the limit,
  and offers a protected link to the files instead.
- **FR-30** The system warns before sending to more than 50 recipients from one composer and offers a bulk send.

### 3.6 Templates and signatures

- **FR-31** A user with `COMMUNICATIONS_TEMPLATE_MANAGE` can create email and text templates: name, record type or none,
  purpose, subject and body per language, attachments by print template, and sharing (personal, team, organization).
- **FR-32** The system keeps the existing system templates as they are, lists them beside user templates, and lets a
  record template start as a copy of a system one.
- **FR-33** The system offers default text and email templates per document type and lifecycle event that a plugin
  declares (sent, confirmed, delivered, issued, received), editable per organization and language.
- **FR-34** The system validates tokens at save, refuses unknown ones naming them, and previews a template against a
  chosen record and recipient before saving.
- **FR-35** A user can keep several signatures and pick a default per sending identity; an administrator can set an
  organization signature block placed under personal signatures.

### 3.7 Outbound queue and delivery status

- **FR-36** The system queues every outbound message, sends system messages before record ones and record ones before
  bulk, never before its scheduled time and within 60 s of it where a queue exists, tracking each recipient apart.
- **FR-37** The system retries a temporary failure with back-off up to 5 times (setting 0 to 10), records each attempt,
  and marks the recipient failed with the answer after the last one.
- **FR-38** The system picks up messages stuck sending for 10 minutes and never sends again to a recipient whose send
  the transport accepted.
- **FR-39** A user with `COMMUNICATIONS_QUEUE_MANAGE` can suspend and resume the queue per organization or identity, retry
  failed messages and cancel queued ones; while suspended, messages are kept and the queue shows the backlog.
- **FR-40** The system stops a bulk send when more than 10 % of its first 200 recipients fail and asks the sender to
  continue or cancel.
- **FR-41** The system records per recipient the delivery events providers report (accepted, delivered, deferred,
  bounced, complained, rejected, opened, clicked, unsubscribed), verified by the provider's signature, each once.
- **FR-42** The system tracks opens and clicks only when the identity turns tracking on (default off), never for messages
  to employees, and states that opens of messages with several recipients are approximate.
- **FR-43** The system stores no body for messages a template marks sensitive (sign-in links, codes, password resets),
  keeping only metadata and the delivery state.
- **FR-44** The system counts messages per organization and channel per day and month and enforces the plan or
  deployment limits set for them, refusing with the limit named.

### 3.8 Communication log and timeline

- **FR-45** The system records every email, text message and push it sends or receives for a record as a communication
  with channel, direction, parties, status, read state, delivery state, tags and attachments.
- **FR-46** The system links a communication to every record it concerns (the record sent from, the parties' contact,
  organization and vendor, a matched ticket or deal), so it shows on each of their timelines once.
- **FR-47** The system gives a communication an open, answered or closed state per record it is linked to, set by
  replies, by a person, or by the owning feature.
- **FR-48** The system contributes communications to the record timeline with filters by channel, direction and person,
  and to global search by subject, parties and body text the viewer may read.
- **FR-49** A person sees a communication only when they can view a record it is linked to, or it was sent to or by them.

### 3.9 Suppression and unsubscribe

- **FR-50** The system adds an unsubscribe link and header to every message whose purpose is not transactional; one
  click suppresses the address for that purpose and organization, without sign-in, and confirms on a page.
- **FR-51** The system keeps a suppression list per organization (address or number, purpose or all, reason: unsubscribed,
  hard bounce, complaint, manual, stop keyword), honoured by every send; transactional messages pass only
  purpose-specific suppressions.
- **FR-52** A user with `COMMUNICATIONS_SUPPRESSION_MANAGE` can list, add, remove (with a reason) and export suppressions;
  removal of a complaint needs the person's documented consent.
- **FR-53** The system offers a public preference page per recipient listing the purposes they can opt in or out of.

### 3.10 Text messages

- **FR-54** A user with `COMMUNICATIONS_ACCOUNT_MANAGE` can add text message provider accounts through adapters (a
  generic HTTP gateway adapter with method, address, parameter names and static parameters ships with the feature),
  with sender names or numbers, allowed countries, monthly cap and default flag; they are listed with the email provider
  accounts and connected mailboxes in one account list, and the existing settings page lists them.
- **FR-55** A user with `COMMUNICATIONS_MESSAGE_SEND` can send a text message from a record to numbers from its parties,
  people and fields, with a template, a live character and part counter, the encoding and the estimated cost.
- **FR-56** The system normalises numbers to the international format using the party's country, refuses invalid ones
  before sending, and logs every attempt with the recipient states of FR-41 and the message's purpose; provider errors
  are kept for administrators and shown to senders as a reason.
- **FR-57** A user with `COMMUNICATIONS_MESSAGE_BULK_SEND` can send a text or email to up to 10,000 recipients from a saved
  view or selection of contacts, people of contacts and vendors, employees or leads, filtered by group, department or
  owner; recipients without an address, suppressed or without consent are reported, not sent.
- **FR-58** The system receives texts through adapters that can, links them to the party by number, and honours stop
  and start keywords per organization.
- **FR-59** A user with `COMMUNICATIONS_ACCOUNT_MANAGE` can restrict which roles send texts and bulk messages; access
  control uses texts for sign-in codes.

### 3.11 Push

- **FR-60** The system registers mobile devices of signed-in users (platform, application, token), delivers push to them
  through mobile push adapters, removes tokens the adapter reports invalid, and keeps web push as today.
- **FR-61** A person can list and remove their devices and browsers in one list.

### 3.12 Preferences, consent and quiet times

- **FR-62** The system asks the preference model of `automation-and-notifications` before sending a notification by
  email, text or push and sends only on the channels it allows; a record message from a colleague is not a notification.
- **FR-63** The system records a party's consent per channel and purpose (source, time, text shown) and refuses a bulk or
  marketing-purpose text to a party without consent where the organization requires it.
- **FR-64** The system holds non-urgent messages to parties outside their local sending window (default 08:00 to 20:00,
  per organization and channel) and sends them at the next opening. `(advanced)`

### 3.13 Delivery health `(advanced)`

- **FR-65** The system scores each sending identity daily from 0 to 100 on bounce rate, complaint rate, deferrals,
  authentication results of its domain and volume history, and shows the score with its causes.
- **FR-66** The system checks each sending domain's authentication records weekly and on demand, together with the
  mailbox domain verification that exists today, and says what to fix.
- **FR-67** The system warns the sender and the account managers when a send would raise an identity's daily volume above
  its warm-up curve (default double the 7-day average after the first 30 days), offers to spread it over days, and
  pauses an identity whose complaint rate passes 0.3 % until a manager resumes it.

### 3.14 Assistant `(advanced)`

- **FR-68** A thread reader can ask for its summary (participants, decisions, open questions, next step), stored with
  the version it read and marked generated.
- **FR-69** A user who can send can ask for a reply draft in the recipient's language from the thread, the record and a
  chosen tone; the draft is never sent without a person's send, and only facts from the thread and record are used.
- **FR-70** The system offers a sentiment and urgency hint on incoming messages of mailboxes with intake rules, used to
  sort the "to file" list and to raise the unanswered alert sooner for urgent ones.
- **FR-71** The system sends thread content to the organization's AI provider only when it enabled the assistant here.

### 3.15 One conversation per party `(advanced)`

- **FR-72** The system shows a party's conversation: emails, texts, chat messages and calls across all records and
  mailboxes the viewer may see, in time order, channel marked.
- **FR-73** A user can reply from the conversation on any channel the party has an address for, linked to the records
  of the message answered.
- **FR-74** The system merges one contact's addresses and numbers into one conversation and offers to merge an unknown
  address into a known person.

### 3.16 API, events, agents and reports

- **FR-75** The system exposes every capability through REST with GraphQL reads; sending routes take idempotency keys.
- **FR-76** The system publishes events for messages queued, sent, delivered, bounced, opened, failed and received,
  suppressions added, intake records created and identity health changes; payloads carry ids only.
- **FR-77** The system offers to other features one sending contract (email or text, template or body, recipients,
  record links, attachments, purpose, language, identity) used by automation, payments, payroll, print, reports,
  helpdesk and access control, and one receiving contract for mail intake.
- **FR-78** The system offers MCP tools to send (preview first), schedule, list a record's communications, summarise a
  thread, draft a reply, manage templates, list suppressions and read delivery states, under the caller's permissions.
- **FR-79** The system lets the Inbox deliver notification emails and texts through this queue and its identities.
- **FR-80** The system matches incoming mail to records by token, thread, sender (contacts, people, vendors), then record
  numbers in the subject, storing reason and confidence; below 0.8 a person files it. `(advanced)`
- **FR-81** The system registers these report definitions:

  | Report | Answers |
  |---|---|
  | Communications log | messages per channel, direction, identity, purpose and state over a period |
  | Delivery health | score, bounces, complaints, deferrals and volume per identity and domain over time |
  | Text message usage | parts, cost and failures per provider account, country and purpose |
  | Unanswered mail | linked threads waiting for an answer by mailbox, owner and age |
  | Suppressions | additions and removals by reason and purpose |
  | Template use | sends, opens and replies per template |

## 4. Non-Functional Requirements

- **Performance**: composer opens under 500 ms P95; a queued message reaches its transport within 60 s P95; 50 messages
  per second per worker; a record timeline of 10,000 communications under 300 ms P95; connected mail within 2 minutes.
- **Volume**: 50 million communications and 200 million recipient rows per tenant; 500 connected mailboxes per tenant.
- **Reliability**: at-least-once queue, no duplicate send after a crash, provider events deduplicated, pulling resumes
  from the last position after downtime.
- **Security & privacy**: credentials encrypted with the platform key, never returned; bodies sanitised before storage
  and render; sensitive templates keep no body; tracking off by default. Leaves the platform: email and text messages
  to recipients and their providers, push payloads to push adapters, thread content to the AI provider when enabled.
- **Observability**: queue depth, latency, failures per transport, bounce and complaint rates, pull lag; audit of
  identity, template, suppression and queue actions.
- **Accessibility and localization**: keyboard operable composer and log; templates per language; viewer's time zone.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted, with or without a queue; OpenAPI
  additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Sending identity | An address with name, reply-to, signature, footer and transport that messages leave as |
| Connected mailbox | An existing mailbox the platform reads and sends from through the standard protocols or a sign-in |
| Communication | One email, text message or push sent or received, with channel, direction, purpose and state |
| Recipient delivery | One recipient of a communication with its delivery state and events |
| Record link | The tie between a communication and a record it concerns |
| Template, signature | A reusable message per record type, purpose and language; a person's or organization's sign-off |
| Intake rule | What a mailbox does with incoming mail: create, link, acknowledge, alert |
| Suppression, consent | An address or number that must not receive a purpose; a party's recorded permission |
| Provider account (text, push) | Credentials and limits of a text message or push adapter |
| Device | A person's registered phone or browser for push |
| Identity health | A sending identity's daily score and its causes |

## 6. Out of Scope

- The mail client (compose outside records, folders, labels, rules, aliases, search, shared mailbox client, calendar
  invitations): `mail`.
- Campaigns, audiences, mailing lists with double opt-in, newsletters and campaign results: `marketing-campaigns`.
- Calls, call logs and recordings (they join the conversation through the timeline): `telephony`.
- Notification categories, the preference model, quiet hours and digests: `automation-and-notifications`.
- Print template design and PDF rendering: `print-and-pdf-designer`. The record timeline shell: `record-views-and-search`.
- Registration of outside sign-in applications and their tokens: `integration-hub`. Sign-in code policy:
  `access-control-and-security`. Ticket rules and replies: `helpdesk-tickets`. Chat messages: `chat-messaging`.

## 7. Acceptance Criteria

- [ ] **AC-1** A sending identity with signature, footer and archive copy passes its test; quotation emails leave as it (FR-5, FR-9).
- [ ] **AC-2** An email from a deal with template, PDF and file is delivered, shows on deal, contact and organization,
      and its recipients move from queued to delivered and opened (tracking on) (FR-24, FR-28, FR-46).
- [ ] **AC-3** A connected mailbox (protocol and sign-in) pulls within 2 minutes, marks read back, pauses after five
      failed sign-ins (FR-12, FR-13, FR-15, FR-17).
- [ ] **AC-4** A support mailbox rule creates one ticket per new message, acknowledges once, joins replies by token, and
      never loops with another auto-responder (FR-18, FR-19, FR-23).
- [ ] **AC-5** The queue retries temporary failures, recovers stuck messages without a duplicate, suspends and resumes,
      and stops a bulk send above the failure threshold (FR-37–FR-39).
- [ ] **AC-6** An unsubscribe click suppresses the purpose; a hard bounce suppresses the address; receipts still go out (FR-50, FR-51).
- [ ] **AC-7** A text from an order uses the document default, counts parts, logs delivery; a stop keyword suppresses (FR-55, FR-56, FR-58).
- [ ] **AC-8** A bulk send to a saved view reports skipped recipients and progresses live; cancel stops queued messages (FR-40, FR-57).
- [ ] **AC-9** Mobile push reaches a registered device; an invalid token is removed (FR-60, FR-61).
- [ ] **AC-10** Identity health scores a seeded bounce spike, reports a missing domain record and warns before a volume
      jump (advanced: delivery health; FR-65–FR-67).
- [ ] **AC-11** A thread summary and a reply draft use only thread and record facts and are never sent without a person
      (advanced: assistant; FR-68, FR-69).
- [ ] **AC-12** A party's conversation merges email, text, chat and calls; a reply goes out on the chosen channel (advanced:
      one conversation) (FR-72–FR-74).
- [ ] **AC-13** Customer messages queued at 23:00 local leave at 08:00 local (advanced: sending window; FR-64).
- [ ] **AC-14** Automation, payments, print, reports, helpdesk and access control send through the one contract (FR-77).
- [ ] **AC-15** The six reports of FR-81 return correct figures on seeded data.
- [ ] **AC-16** Feature off: `404` on new routes; system mail, Inbox and email history behave as before; works on
      PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-1, FR-2).
- [ ] **AC-17** With the plugin loaded, a mailbox with a sender allow list still admits only those senders (feature on
      or off), and the email history resends a message sent through this feature with its body (FR-16).
- [ ] **AC-18** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Connected mailboxes are polled every 2 minutes, not held open. Default applied; a held connection can come later.
- Open and click tracking default off for every identity; the record PDF is re-rendered on demand unless the
  organization chooses to store it. Defaults applied.
- Mailing lists with double opt-in stay with `marketing-campaigns`; bulk sends here stop at 10,000. Defaults applied.

## 9. Constitution Gates

- [x] I Plugin-first — new `communications` pair and a connected-mailbox provider plugin; Inbox and core get seams and nullable columns.
- [x] II Tenant/organization scoping — identities, communications, links, rules, suppressions and accounts are scoped.
- [x] III Both ORMs, additive migrations — new tables and nullable columns on three dialects.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_COMMUNICATIONS`; today's mail paths unchanged.
- [x] V Contracts and API first — contracts, REST, GraphQL reads and the sending contract before UI.
- [x] VI Permissions, privacy, security — permission keys, encrypted secrets, signed provider events, data leaving in §4.
- [x] VII Real-time through the event bus — outbox events; queue progress and timeline updates on the push channel.
- [x] VIII i18n and accessibility — templates per language, keys in every locale, keyboard composer.
- [x] IX Tests accompany the change — per requirement, transport fakes, dialect and ORM parity specs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on: [`inbox`](../inbox/spec.md), [`realtime-channel`](../realtime-channel/spec.md)
- Works with: [`automation-and-notifications`](../automation-and-notifications/spec.md),
  [`record-views-and-search`](../record-views-and-search/spec.md), [`print-and-pdf-designer`](../print-and-pdf-designer/spec.md),
  [`integration-hub`](../integration-hub/spec.md), [`access-control-and-security`](../access-control-and-security/spec.md),
  [`payments-and-collections`](../payments-and-collections/spec.md), [`helpdesk-tickets`](../helpdesk-tickets/spec.md)
- Code: `packages/core/src/lib/{email-send,email-template,email-history,custom-smtp}`, `packages/plugins/inbox/src/lib/email`,
  `packages/plugins/email-provider-*`, `apps/gauzy/src/app/pages/settings/sms-gateway`
