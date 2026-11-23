# Feature Specification: Helpdesk tickets

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `helpdesk-tickets`
**Branch**: `feat/helpdesk-tickets`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_HELPDESK` (tenant feature, default off) · the plugin loads only when `GAUZY_HELPDESK_ENABLED`
is exactly `true` · assistants and AI responders also need `FEATURE_HELPDESK_ASSISTANT` (default off)

---

## 1. Overview

Today a customer's request has no home: tasks carry statuses, priorities, people, comments and time but no customer side,
and the Inbox receives mail and replies through the API only. This feature makes the **ticket** a task of the issue type
"Ticket" in a support project with a customer side: requester and customer from the platform's contacts, channel,
service-level and satisfaction state and **one conversation** fed by email, a web form, the API and the portal. Tickets
use the task statuses (with waiting and closed categories that drive replies, reopening and closing), priorities,
references, links, comments, views, board, timer and time logs. The helpdesk adds channels, replies through the Inbox,
saved replies, templates per kind of request, acknowledgements, merge and split, and ticket views with bulk actions,
search, shortcuts and live presence. Agents, routing, service levels and reports: `helpdesk-sla-routing-and-analytics`;
customer pages and ratings: `helpdesk-portal-and-knowledge-base`. Clients: the Gauzy web app (installable on phones), the
MCP server and the SDKs; every task screen lists, opens and times tickets as the tasks they are.

**Advanced capabilities.** Time on a ticket runs on the **platform timer** directly, so each ticket, customer and
contract has a measured, billable time and cost; an **assistant** drafts replies from the help centre, documents and
past tickets with sources, summarises threads, proposes template, priority and routing and finds duplicates, always as a
draft a person approves; an **AI first-line responder** answers within explicit limits and hands over; **one
conversation** spans email, chat widget, portal and messaging; a ticket links to its customer's **orders, invoices,
deliveries, serial units and projects** and starts their actions; **collisions** are caught live; colleagues are
**pulled in from team chat**; merges and splits can be **undone**. Marked `(advanced)`.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a mailbox connected as an email channel, **when** a known contact writes "Printer offline", **then** within
  10 s ticket HD-10234 (also a task in every task list) appears unassigned with requester, customer, channel defaults,
  attachments and an acknowledgement; **when** an agent sends the saved reply "Restart steps" (action "set status
  Awaiting customer"), **then** it leaves threaded with `[HD-10234]` in the subject, the action applies, and the
  customer's answer reopens the ticket.
- **Given** two tickets about one order, **when** an agent merges HD-10240 into HD-10234, **then** messages, comments and
  files move with their times, HD-10240 closes as merged and linked as a duplicate, later mail to it lands on HD-10234,
  and undo stays offered for 24 hours; an internal comment mentioning a colleague never reaches the customer.
- **Given** an agent writing a reply, **when** a customer message arrives before sending, **then** the composer shows it
  and asks to send anyway or revise; a colleague sees the agent marked "replying". `(advanced)`
- **Given** the timer run 25 minutes on HD-10234 from any task screen, **then** the time is in the agent's timesheet
  under the support project with the ticket's customer, on the ticket (cost for cost viewers), and bills. `(advanced)`
- **Given** a how-to question, **when** the agent asks for a draft, **then** it cites two help articles and a past ticket
  in the customer's language, and an open ticket of the same customer is proposed for merge. `(advanced)`
- **Given** an AI responder for "How-to" web form tickets, **when** an article answers a 23:00 question with high
  confidence, **then** it replies marked as automated; "it did not help" sends the ticket to people. `(advanced)`
- **Given** a late parcel, **when** the agent links the order, **then** order and delivery states show live and a return
  starts prefilled; two colleagues pulled in get a linked private chat. `(advanced)`

### 2.2 Edge cases & failures

- **Given** a delivery report, bounce, automatic or list mail, **then** nothing is created; an out-of-office reply stays as
  a notice without reopening; a bounced reply is marked; a looping sender gets at most 5 acknowledgements an hour.
- **Given** a customer message on a closed ticket, **then** a linked follow-up ticket opens; a merge into a merged ticket
  or making a cycle is refused; different customers need a confirmation.
- **Given** two agents changing one ticket at once, **then** the second gets a conflict with the current value; a client
  losing its connection mid-reply gets its server draft back, checked again before sending.
- **Given** the mail provider failing, **then** the reply stays as failed with the error, is retried three times and its
  author is notified; the saved reply's actions stay applied.
- **Given** a customer-side write to a closed field, **then** `400` names it; a flood is refused with `429`; a ticket
  outside the agent's visibility answers `404`; a delete without permission answers `403`.
- **Given** no AI provider, **then** assistant actions are hidden with a notice; a responder over budget hands over; with
  the Inbox email features off, email channels show "paused" and other channels work.
- **Given** `FEATURE_HELPDESK` off, **then** helpdesk routes and public endpoints answer `404`; mailboxes behave as before.

## 3. Functional Requirements

### 3.1 Scope, flags and compatibility

- **FR-1** The system loads only when `GAUZY_HELPDESK_ENABLED` is exactly `true` and gates every route, GraphQL field,
  menu entry, MCP tool and public endpoint with `FEATURE_HELPDESK`; off, they answer `404`.
- **FR-2** The system uses the platform's tasks and their statuses, priorities, links, views and trash, contacts,
  employees, teams, tags, comments, mentions, reactions, followers, time logs, documents and Inbox mailboxes directly,
  copying no party and keeping no second list of statuses, priorities, types or links.
- **FR-3** The system only adds routes, fields and enum values; nothing existing is renamed, repurposed or removed.

### 3.2 Tickets

- **FR-4** A ticket is a task of the issue type "Ticket" in a support project: the task's title is its subject (1–255
  characters), and its status, priority, team, assignee, tags, parent, description (the ticket's summary, written or
  accepted from the assistant), resolved, created and updated times are the task's; the ticket adds template, channel,
  source, requester, customer, copied addresses, language, custom fields, a resolution summary and a last activity time.
- **FR-5** A ticket's number is its task reference in the support project (the project key, default `HD`, and the
  task number); a number is never reused, a ticket moved to another support project keeps answering to its former
  reference, and search and the palette find a ticket by its exact reference.
- **FR-6** The requester is the contact with the sender's exact address (case-insensitive), else a new contact (setting,
  default on) or name and address on the ticket; the customer is their organisation contact, changeable by an agent.
- **FR-7** A user with `HELPDESK_TICKET_CREATE` can raise a ticket for a requester from the workspace, a contact, a call
  or an email, choosing whether the requester is told; source "agent" and the creator are recorded.
- **FR-8** A user with `HELPDESK_TICKET_EDIT` can rename the subject and change the fields the template shows, here or in
  any task screen; references, bookkeeping times and counts, and merge and split links are never writable.
- **FR-9** The system keeps in wall-clock time first and last agent reply, last customer message, counts per side,
  average agent reply interval, resolved, closed, reopen count, waiting time and since.
- **FR-10** The system records the arrival channel and the page, help article, search text and campaign tag reported.
- **FR-11** A user with `HELPDESK_TICKET_DELETE` can trash tickets singly or in bulk through the task trash (restorable
  until purged; trashed tickets are purged after the organization's ticket trash period, default 30 days, 0 keeps them,
  which never applies to tasks of other issue types) or purge them, recorded; a deleted contact's tickets keep the
  requester's name and address.
- **FR-12** The ticket page shows breadcrumbs to its list, next and previous ticket, tabs for conversation, analytics and
  activity, and the requester's and customer's recent and similar-subject tickets with merge and link.

### 3.3 Statuses, priorities, kinds of request and templates

- **FR-13** A user with `HELPDESK_SETTINGS_MANAGE` defines ticket statuses as task statuses of the support project (name,
  customer label per language, colour, order, active, one category of new, in progress, waiting, done or closed, each
  with a default); shipped "New", "In progress", "Awaiting customer", "Awaiting third party", "Done", "Closed"; used ones
  stay; deactivating asks where open tickets move.
- **FR-14** The system applies these status rules (switchable in workflow settings where noted):

  | Event | Effect |
  |---|---|
  | ticket created | default status (and priority) of its template, else its channel, else the organization |
  | first public agent reply on a new or in-progress ticket | "status after reply" (default "Awaiting customer"; can be off) |
  | customer message on a waiting or done ticket | reopen status (default first in-progress); from done, reopen count + 1 and assignee told |
  | customer message on a closed ticket | linked follow-up ticket (setting: reopen instead within N days) |
  | entering done or closed (from any screen) | stamps resolved when empty; closes open record assignments on the ticket |
  | leaving done or closed for another category | clears resolved |
  | entering, leaving waiting | starts, stops the waiting time |

- **FR-15** The system closes tickets left in done (or a chosen status) without a public message for N days (default 7,
  0 off) with an internal comment saying why, and can remind a requester M days before closing a ticket awaiting them.
- **FR-16** A user with `HELPDESK_SETTINGS_MANAGE` defines priorities as task priorities of the support project (shipped
  urgent, high, medium, low) and kinds of request as templates (name per language, icon, default priority, status and
  team, customer-selectable, default); every ticket keeps the issue type "Ticket"; used ones stay.
- **FR-17** A template can require approval: its tickets start an approval through `approval-workflows`, wait in their
  initial status, show the decision, and move to in progress or, rejected, to closed with the reason. `(advanced)`
- **FR-18** A user with `HELPDESK_SETTINGS_MANAGE` can define each template's fields with, per field, visibility and
  creation requirement for agents and customers, customer-editable later, placeholder and help, and a description
  skeleton, laid out by custom-field layouts under their field rules and field-level permissions, never scripted.
- **FR-19** A customer-side write to a field the template keeps closed, or to a computed field, gets `400` naming it.

### 3.4 Channels

- **FR-20** A user with `HELPDESK_SETTINGS_MANAGE` can create email, web form, chat widget, messaging, phone and API
  channels with support project, default template, priority, team, status, language, brand and notices.
- **FR-21** An email channel binds an Inbox organization or team mailbox: a message opens a ticket unless its threading
  headers, reference token or reply tag name one (a merged ticket's mail reaches its final target); the mailbox's members
  keep receiving its mail as Inbox items as today unless an administrator turns on the channel's "work through tickets"
  setting (off by default), which then stops those items.
- **FR-22** The system makes nothing from delivery reports, bounces, mail with an empty return path, marked automatically
  generated or sent to a list, or from the platform's own mailboxes; out-of-office replies stay as notices without a
  status change; a bounce marks the agent reply bounced with an internal notice; quarantined mail arrives only released.
- **FR-23** Email attachments and inline images stay in the Inbox store, linked, never copied; uploads are documents
  linked to the ticket; both download under the Inbox's safety rules and follow replies, merges and splits; a user who
  can read an Inbox email can turn it into a ticket keeping its content.
- **FR-24** A web form channel takes submissions at its public endpoint, posted by the hosted and embedded forms of
  `lead-capture-and-enrichment`, the organization's websites or any allowed app, with the template's customer fields,
  confirming each ticket by email; above 5 per address or 30 per network address an hour, oversized files or a failed
  challenge are refused without a ticket by the shared public-form defence; the API (`HELPDESK_TICKET_CREATE`,
  idempotency key) and the portal create tickets under the same template rules.
- **FR-25** A chat widget channel gives visitors of allowed websites, through a script they embed, a live conversation
  that is a ticket and continues by email when they leave. `(advanced)`
- **FR-26** A messaging channel exchanges text and messaging-app messages through `email-and-communications` providers;
  a message matches a contact by number and joins their open ticket of the last 7 days or opens one. `(advanced)`
- **FR-27** A ticket keeps one conversation across channels: each message shows its channel, a reply goes by default to
  the channel of the customer's last message, and the agent can pick any channel reaching them. `(advanced)`
- **FR-28** Calls handled by `telephony` open or join a ticket with the call on its timeline; a team chat message becomes
  a ticket from its message actions.

### 3.5 Conversation, replies and notices

- **FR-29** A user with `HELPDESK_TICKET_EDIT` replies with sanitised rich text, inline images, attachments within the
  channel's limit, to, copy (prefilled) and blind copy, reply-all, saved replies and a signature, stored before sending.
- **FR-30** Email replies leave from the channel's mailbox, threaded, with the reference token, through
  `email-and-communications` when loaded, else the Inbox; each shows queued, sent, failed or bounced; a failure is
  retried 3 times, then its author is notified.
- **FR-31** An agent can send now (default), schedule up to 30 days ahead and cancel until it leaves, or record a reply
  without sending (an answer given by phone or in person).
- **FR-32** A new ticket is acknowledged when its channel enables it, from a per-language template with tokens (number,
  subject, name, expected first response) and an outside-hours text; never to automatic mail, at most 5 an hour each.
- **FR-33** A web form, portal or widget requester is told of each agent reply with a follow-up link (default on);
  customer messages use the requester's language (contact's, else detected, else the organization's), brand, signature.
- **FR-34** Agents are notified by helpdesk categories and preferences of assignments, customer replies on tickets they
  hold or follow, reopens, mentions, reactions and new queue tickets (off), listed in the Inbox by category and unread.
- **FR-35** Customer messages, agent replies, automated answers and notices form one ordered conversation with author,
  channel, time, delivery state and attachments, oldest or newest first per agent.

### 3.6 Internal collaboration

- **FR-36** Agents write internal comments, the task's comments (rich text, mentions that notify and warn when the person
  cannot read the ticket, edit and delete of their own); no customer-facing output ever includes them.
- **FR-37** Agents react with emoji when allowed (default on; notifies the author without email) and pin up to 5 comments
  per ticket on top (a sixth is refused); people follow tickets as tasks (assignees and mentioned people automatically).
- **FR-38** An agent asks colleagues or a team to assist on the ticket: a private chat linked to the ticket opens with its card (the task card as
  today; the ticket card where `FEATURE_CHAT_RECORD_CARDS` is on), invitees read the
  ticket for 7 days, and closing offers a summary comment to approve; a ticket reference in chat offers "join".
  `(advanced)`
- **FR-39** The timeline merges conversation, comments, field and tag changes, assignments, links, merges, splits, tasks,
  time logs, calls, service-level events and assistant actions, filterable by kind.

### 3.7 Saved replies

- **FR-40** Agents keep saved replies (title, per-language bodies as the platform's email templates, attachments, folder)
  for themselves, chosen teams or the organization (`HELPDESK_SAVED_REPLY_MANAGE`; organization scope can be off).
- **FR-41** Placeholders (any ticket, requester or agent field and the follow-up link; unknown ones refused at save) fill
  in; actions (set any editable field, assign to me, change tags, add a comment) show as chips and apply on send.
- **FR-42** The picker ranks by title and body match, the ticket's template and language and the agent's and team's
  counted use, previews, and opens from the composer, a shortcut or the palette.
- **FR-43** A user with `HELPDESK_TICKET_EDIT` can send one reply to up to 500 selected tickets, placeholders per ticket,
  with a result per ticket (sent, refused with reason, failed).

### 3.8 Merge, split, links, tasks and related records

- **FR-44** A user with `HELPDESK_TICKET_MERGE` who may edit all tickets involved merges tickets into a target: messages,
  comments, attachments, related records, tags and followers move with their times; sources close as merged, linked as
  duplicates of the target, their time counted with it; requesters told and copied (optional); a merged target or a
  cycle is refused; different customers need confirmation.
- **FR-45** A user with `HELPDESK_TICKET_MERGE` splits a ticket at a customer message: it and later messages (comments on
  choice) move to a new ticket of the same support project copying requester, customer, copies, template, priority,
  team and tags, linked as related and marked "split from", with a comment left.
- **FR-46** A merge or split can be undone within 24 hours while no new public message arrived. `(advanced)`
- **FR-47** Agents link tickets with each other and with any task through the task links (relates to, duplicates —
  optionally closing the duplicate with a notice —, blocks, is blocked by, clones), shown on both.
- **FR-48** A parent ticket shows its child tickets (sub-tasks) and closes with one reply to all requesters. `(advanced)`
- **FR-49** An agent creates tasks from a ticket (project, title, description with a link back, assignees), linked as
  blocking it; the ticket shows their status, and a done task leaves a notice and, when set, reopens it to in progress.
- **FR-50** Agents link a ticket to its customer's records of any type (orders, invoices, deliveries, returns, serial
  units, projects, contracts), seeing their live state; each record lists its tickets on its timeline. `(advanced)`
- **FR-51** From a linked record an agent starts its plugin's actions (return, replacement order, credit note draft, field
  visit) prefilled under that plugin's rules; a serial number fills item, customer and warranty. `(advanced)`

### 3.9 Lists, views, search, bulk work and keyboard

- **FR-52** Tickets list in task views filtered to the issue type "Ticket" (reference, subject, requester, customer,
  status, priority, template, team, assignee, tags, channel, age, last message, unread), with filters, sorts, grouping,
  columns, sharing, pins, defaults and export.
- **FR-53** The system ships ticket views "my open tickets", "unassigned in my teams", "awaiting customer", "followed by
  me", "recently updated", "all open" (and "due soon" from service levels), as plain lists when saved views are off.
- **FR-54** Tickets show on the task board by status, priority or team; a move applies FR-14. `(advanced)`
- **FR-55** Search finds tickets by reference, subject, messages and internal comments (agents only) with facets team,
  status, priority, customer, channel and date, skips quoted earlier replies, and drops unreadable tickets.
- **FR-56** Bulk actions (status, priority, template, team, assignee, tags, reply, merge into one, follow, trash,
  restore) above 500 tickets run as a background operation with progress; each ticket reports done, refused or failed.
- **FR-57** Every ticket command (field changes, reply, comment, saved reply, copy, navigation) is in the palette with a
  shortcut each user can rebind.
- **FR-58** Opening marks a ticket seen per agent and lists it among their recent items; lists flag tickets with
  customer messages since as unread, and agents mark them read or unread.

### 3.10 Real time, presence and collisions

- **FR-59** Open tickets and lists update within 2 s when anyone (customer and system included) changes a ticket, adds a
  message or comment or assigns it, also on the customer's open portal or widget page; a field being edited is kept.
- **FR-60** A ticket shows its readers who views it and who writes, with a typing indicator; presence is not stored;
  drafts save to the server every 5 s per agent and restore on any device.
- **FR-61** Sending after a customer message, reply or status change arrived since writing began shows it and asks to
  send anyway or revise; with "reply lock" on, a second agent confirms before writing. `(advanced)`

### 3.11 Time and cost

- **FR-62** An agent runs the platform timer on a ticket, a task, from its page, any task screen or
  the desktop timer; time logs carry its support project (a contract's, if linked) and its customer as client. `(advanced)`
- **FR-63** Time on the ticket (timer or manual) shows on it per person and in total, flows into timesheets, approvals
  and payroll, and bills when its project bills time, with the reference in the invoice line. `(advanced)`
- **FR-64** A ticket's cost comes from its time logs' stored pay rates, totalled per customer and contract with merged
  sources rolled into their target, and shows only to holders of `HELPDESK_COST_VIEW`. `(advanced)`

### 3.12 Assistants and AI responder

- **FR-65** With `FEATURE_HELPDESK_ASSISTANT` and `HELPDESK_ASSISTANT_USE`, an agent gets a draft from help articles,
  documents and resolved tickets they may read, in the requester's language, citing sources with a confidence, never
  sent by the assistant; other customers' names, addresses, numbers and amounts are masked. `(advanced)`
- **FR-66** On arrival the assistant proposes template, priority, tags, team, language and sentiment with reasons, and
  flags likely duplicates (same requester or customer, similar content, 14 days) with a score; agents accept or
  dismiss each; nothing applies without a person. `(advanced)`
- **FR-67** The assistant summarises a thread on demand and offers it past 8 messages (asked, tried, open, next step), to
  save as the summary, and translates messages both ways, marked as translations. `(advanced)`
- **FR-68** Each proposal keeps sources, model and outcome (accepted, edited, rejected), its cost in the platform's AI
  usage; use counts against the organization's monthly helpdesk AI budget, beyond it refused with the reason. `(advanced)`
- **FR-69** A user with `HELPDESK_AI_RESPONDER_MANAGE` defines AI responders: a platform AI agent acting as an agent
  employee, with channels, templates, languages, hours, mode (draft only by default, or send within limits), threshold
  (0.8), replies per ticket (2), forbidden topics, allowed actions (reply, ask, link an article, tag), hand-over team and
  the agent's own budget. `(advanced)`
- **FR-70** A responder answers an unassigned or own ticket of its scope only at or above its threshold, without a
  forbidden topic and within limits, saying it is automated and how to reach a person; it hands over (hand-over team,
  note with draft, sources and reason) when the customer asks for a person or is dissatisfied, confidence is low, a
  limit or budget is reached, a forbidden topic appears, or the priority is urgent. `(advanced)`
- **FR-71** Each responder decision is recorded with the platform's agent runs (outcome, confidence, sources, cost), its
  actions show as an agent's, and one or all responders of an organization pause at once. `(advanced)`

### 3.13 Settings, setup and layouts

- **FR-72** A user with `HELPDESK_SETTINGS_MANAGE` edits all settings on one page set with an unsaved-change guard; each
  agent sets signatures per channel, composer default, conversation order and send-later default (language, time zone
  and theme stay platform preferences).
- **FR-73** A setup assistant creates defaults, connects a mailbox and adds a sample ticket; dismissible notices show what
  stops tickets flowing (no active channel, failing mailbox, no agent or team, service levels without a policy).
- **FR-74** Workspace, ticket page and composer work on phones in the installable web app (cards with swipe actions,
  drawer, full-screen composer); task screens open tickets as tasks linking to the conversation.
- **FR-75** The requester panel shows contact and customer with inline edit, links, call (telephony), recent tickets,
  ratings from `helpdesk-portal-and-knowledge-base` and "send portal access" when loaded; names and avatars read alike
  everywhere; tickets carry the platform's coloured tags, changed singly, in bulk or from the palette.

### 3.14 API, MCP, events and extension

- **FR-76** REST covers every capability with GraphQL reads, idempotency keys and cursor paging; ticket events (created,
  updated, status changed, assigned, merged, split, deleted, restored), raised beside the task events, and message
  events (received, sent, failed, bounced) carry ids only, for webhooks, real time and automations.
- **FR-77** The system registers the ticket as a kind of task (card, timeline, view filters) and declares automation
  triggers (created, status entered, customer or agent replied, priority or team changed, no customer reply for a time)
  and actions (set fields, saved reply, internal comment, tags, create task).
- **FR-78** MCP tools list, read with conversation, create (preview), reply (draft by default, send with preview), update,
  merge and split (preview), search saved replies, draft and summarise, under the caller's permissions.
- **FR-79** The portal and other plugins get a ticket service: create a ticket for a contact on a channel, list a
  contact's or customer's tickets, read the customer-visible conversation and fields, add a customer message.

## 4. Non-Functional Requirements

- **Performance**: email to ticket within 10 s P95 (60 s without a queue); reply accepted under 300 ms P95, at the provider
  within 30 s; 50-row list under 300 ms P95 at five million tickets per tenant; latest 50 items of a 1,000-item ticket
  under 400 ms; live updates within 2 s; search under 200 ms; assistant draft within 15 s; 500-ticket bulk under 20 s.
- **Volume and reliability**: five million tickets and fifty million messages per tenant, 20,000 new tickets a day per
  organization; inbound at least once, deduplicated, with a recovery sweep; outbound durable with retries; merge, split
  and undo atomic; drafts survive disconnects.
- **Security & privacy**: one customer-facing serializer drops comments and agent-only fields; public endpoints rate
  limited; HTML sanitised on write and render; downloads `nosniff` and sandboxed; costs to cost viewers only. Leaving the
  platform: email to requesters and copies, messaging, widget messages, prompts to the tenant's AI provider, webhooks.
- **Observability**: activity for field changes, merges, splits, undo, purges, responder actions; a channel event log
  (refused, ignored, bounced, failed); metrics for intake lag, send failures, collisions, assistant cost.
- **Accessibility and localization**: keyboard lists, board, conversation and composer; new messages announced to screen
  readers; labels in every locale; customer emails in the requester's language.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; without a queue, Inbox email, record
  views or an AI provider only that capability is missing; OpenAPI additive; SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| Ticket | A task of the issue type "Ticket" with a customer side: requester, customer, channel, one conversation, service-level and satisfaction state |
| Status, priority | The task statuses and priorities of the support project; a status's category (new, in progress, waiting, done, closed) drives its rules |
| Template | A kind of request with its defaults and the fields agents and customers see |
| Channel | Where tickets come from and replies go: email mailbox, web form, chat widget, messaging, phone, API |
| Ticket message, reply draft | A customer message, agent reply, automated answer or notice; an unsent reply |
| Saved reply | A reusable reply with placeholders, languages and actions, personal, team or organization |
| Task link, related record, move | A task link between tickets and tasks; a link to a record of another type; what a merge or split moved |
| Assist | A private chat linked to a ticket, opened when an agent asks colleagues to assist on it |
| Assistant suggestion | A draft, summary, classification, duplicate or translation proposal with sources and outcome |
| AI responder | A platform AI agent answering tickets as an agent employee within helpdesk limits |

## 6. Out of Scope

- Agents, teams, routing, service levels, calendars, the outside-hours mark, escalation, dashboards, every helpdesk
  report: `helpdesk-sla-routing-and-analytics`.
- Help centre, customer ticket pages and layout, outside-hours banner, ratings with their emails and forms, customer
  organisations, portal branding: `helpdesk-portal-and-knowledge-base`; portal sign-in: `customer-and-supplier-portal`.
- Email accounts and sending, signatures, text providers: `email-and-communications`; calls: `telephony`; chat cards:
  `chat-agents-and-record-actions` (`FEATURE_CHAT_RECORD_CARDS`); task statuses, priorities, links, views, board, trash, timer and task screens: the
  platform's tasks; palette, timeline shell, related records: `record-views-and-search`; fields and rules:
  `custom-fields-and-forms`; flows, assignment engine, preferences: `automation-and-notifications`; approvals:
  `approval-workflows`; AI agents, runs and budgets: `ai-agents-and-assistants`; hosted forms and the public-form
  defence: `lead-capture-and-enrichment`; customer contracts: `crm-leads-and-deals`.

## 7. Acceptance Criteria

- [ ] **AC-1** Mail to a channel mailbox opens a ticket with requester, customer, attachments and acknowledgement; a reply
      leaves threaded with the token; the customer's answer reopens it; automatic mail follows FR-22.
- [ ] **AC-2** Web form, API and portal service create tickets under template rules; closed fields and floods are refused (FR-20, FR-24, FR-79).
- [ ] **AC-3** Each FR-14 row holds; auto-close writes its reason; saved replies fill placeholders and apply actions on
      send; a bulk reply to 500 tickets reports per ticket; comments never reach a reply or the portal service.
- [ ] **AC-4** Merge and split move every item with its time and carry the customer side; mail to a merged ticket reaches
      the target; cycles are refused; undo restores within 24 hours (advanced: undo; FR-44–FR-46).
- [ ] **AC-5** Tickets appear in task lists, boards and the timer as tasks, and a status changed from a task screen
      applies FR-14; ticket views, search and bulk work show only readable tickets; an approval template waits for its
      decision; a parent closes its children with one reply (advanced: board, approval, parents).
- [ ] **AC-6** Two agents see each other live; sending after a new customer message prompts (advanced: collisions; FR-59, FR-61).
- [ ] **AC-7** Timer time on the ticket reaches the timesheet, the ticket, an invoice line with the reference, and cost
      for cost viewers only (advanced: time and cost; FR-63, FR-64).
- [ ] **AC-8** A draft cites sources, masks other customers, is never sent by the assistant; proposals keep outcomes; a
      responder answers within limits and hands over on each FR-70 condition (advanced: assistant, responder).
- [ ] **AC-9** Email, widget and messaging form one conversation per requester (advanced: one conversation; FR-27).
- [ ] **AC-10** A linked order shows live state and starts a prefilled return; the approved summary of an assist becomes a
      comment (advanced: related records, assist; FR-38, FR-50, FR-51).
- [ ] **AC-11** Ticket facts (bookkeeping, channel, arrival, assistant outcomes, saved reply use, time) feed the report
      sources of `helpdesk-sla-routing-and-analytics` and match seeded data (FR-10).
- [ ] **AC-12** Feature off: `404` on every helpdesk route and public endpoint; mailboxes behave as before (FR-1).
- [ ] **AC-13** With the feature on, a mailbox bound to a channel keeps giving its members Inbox items until "work
      through tickets" is turned on; trashed tasks of other issue types are never purged by the ticket trash period; task
      screens, statuses and comments of other projects behave as before (FR-21).
- [ ] **AC-14** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test.

## 8. Open Questions

- Customers are the platform's own contacts. Default applied.
- Forms use field rules and form actions; scripts on forms are not offered. Default applied.
- Unknown senders become contacts (setting, default on); channel mailboxes keep making Inbox items unless the
  channel's "work through tickets" setting is turned on (default off). Default applied.
- A customer message on a closed ticket opens a follow-up ticket; AI responders start draft-only. Default applied.
- No default grant to the employee role; a support role bundle of `access-control-and-security` is recommended.
  Default applied.

## 9. Constitution Gates

- [x] I Plugin-first — new plugin pair `helpdesk`, `helpdesk-ui`; tickets are core tasks with an extension; the Inbox and
      tasks gain additive seams.
- [x] II Tenant/organization scoping — every ticket, message, channel, reply and suggestion is scoped.
- [x] III Both ORMs, additive migrations — new tables and additive task-status and comment columns on three dialects; no
      existing column changed.
- [x] IV Default-off flag; nothing removed — deploy switch plus `FEATURE_HELPDESK`; mailboxes unchanged until bound.
- [x] V Contracts and API first — contracts, REST, GraphQL reads, public endpoints and SDKs before screens.
- [x] VI Permissions, privacy, security — permission keys, visibility, sanitised content, rate-limited public routes.
- [x] VII Real-time through the event bus — ticket events on the outbox; presence and typing as platform signals.
- [x] VIII i18n and accessibility — keys in every locale, keyboard workspace, customer emails per language.
- [x] IX Tests accompany the change — per requirement, with dialect and ORM parity specs.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md) ·
  [`helpdesk-sla-routing-and-analytics`](../helpdesk-sla-routing-and-analytics/spec.md)
- Works with: [`record-views-and-search`](../record-views-and-search/spec.md),
  [`automation-and-notifications`](../automation-and-notifications/spec.md),
  [`custom-fields-and-forms`](../custom-fields-and-forms/spec.md), [`approval-workflows`](../approval-workflows/spec.md);
  builds on [`inbox`](../inbox/spec.md), [`realtime-channel`](../realtime-channel/spec.md)
- Code: `packages/plugins/{inbox,docs,realtime,chat}/`,
  `packages/core/src/lib/{tasks,comment,reaction,tags,organization-contact,time-tracking,api,operation}/`
