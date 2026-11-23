# Feature Specification: CRM engagement

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `crm-engagement`
**Branch**: `feat/crm-engagement`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_CRM` (shared with `crm-leads-and-deals`, default off); service levels, the sales hierarchy, its visibility, activity capture and coaching are further organization settings, each off by default

---

## 1. Overview

Contacts already carry comments with mentions (shown as "Notes"), a documents panel and members picked by hand; deals
carry nothing. This feature gives the leads, deals, people and organisations of `crm-leads-and-deals` their working
life: one **activity timeline** per record (stage moves, owner changes, emails, messages, calls, meetings, notes,
comments, tasks, files, automation runs), **notes and tasks** that are the platform's own notes and tasks, **email and
messages from the record** through the platform's communications, a **communication status** that says who owes the
next message, **first response and service levels** on leads and deals through the same engine that serves tickets,
**owner, assignees and assignment rules** through the platform's assignment engine with availability, territory and
capacity, **visibility and sharing** as configurations of the platform's record rules, and an optional **sales
hierarchy** that follows the organization's reporting line with exceptions for sales. Clients: the Angular app
(`crm-ui` pages and the platform's task views, installable on phones), the MCP server and the SDKs.

Advanced capabilities: **automatic activity capture** from each user's mailbox and calendar with
per-user privacy choices and a weekly digest to undo; **relationship strength** and "going quiet" signals from real
two-way interaction; **reply-time coaching** with evidence and a nudge before a hot lead waits too long; **"what changed
since my last visit"** and AI summaries of calls, meetings and threads written to the timeline only after approval;
**selling effort** from time tracked on CRM tasks and calls, so a deal shows what it cost to win; **explainable
routing** by territory, language, skills and capacity; and everything live on open pages.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a salesperson opening the deal "Ruiz Logistics – fleet plan", **when** the Activity tab loads, **then** they see newest first the stage moves with time spent, the owner change, two emails, a call with its recording, a pinned note, an open task and the entries of the lead it came from marked "from lead"; choosing the Emails tab shows only the emails.
- **Given** that deal, **when** the salesperson writes to its primary person with the template "Proposal follow-up" and picks "tomorrow morning", **then** the message is listed on the deal as scheduled for 09:00 in their time zone; **when** the customer replies the next day, **then** the reply sits on the deal's timeline, the communication status becomes "awaiting us" and the owner gets one Inbox notice.
- **Given** a policy "Hot web leads: first response 15 working minutes" on a calendar Monday to Friday 09:00–18:00 with the organization's holidays, **when** a hot lead arrives from a web form at 17:55 on a Friday, **then** its response is due Monday at 09:10; at 75 % of the target its owner is warned; **when** the owner sends the first email, **then** the clock is met and the lead shows its first response time in working minutes.
- **Given** an assignment rule "EMEA web leads, in turn, team EMEA, weekdays 08:00–18:00", **when** a lead from a German web form arrives, **then** it goes to the next team member whose state is available; Ana (away) and Ben (on approved time off) are skipped and "why this person?" lists both reasons.
- **Given** hierarchy visibility on and the rule template "Sales person: own or assigned" chosen, **when** a sales person opens the deals board, **then** they see only deals they own or are assigned to, with exact counts; their manager sees their own and those of everyone below them in the hierarchy.
- **Given** Ana who owns a lead, **when** she shares it read-only with Carl until Friday, **then** Carl gets an Inbox notice, reads the lead until Friday and not after; the lead's shares list shows it.
- **Given** a deal, **when** the salesperson creates the task "Send revised quote" due tomorrow 10:00 for Ben, **then** Ben is notified, the task shows in his tasks and on the deal; **when** 10:00 passes with the task open, **then** one "CRM task overdue" event fires and an automation can act on it.
- **Given** Ana who allows capture of her mailbox with "metadata only" and excludes her bank's domain, **when** she exchanges emails with a person of an organisation with an open deal she owns, **then** subject, time and participants appear on the person and the deal; her bank's emails never do; a thread she marks private disappears from both.
- **Given** an organisation page, **when** the user opens Relationships, **then** they see strength per colleague ("strong with Ana, weak with Ben") with the signals behind it; the open deal whose decision maker has not answered for 16 days shows "going quiet".
- **Given** a manager with `CRM_COACHING_VIEW`, **when** they open Coaching, **then** they see each person's median reply time against the team median with the records that waited longest; **when** a hot lead's message has waited longer than its owner's usual reply time, **then** the owner gets one nudge with a drafted reply to review.
- **Given** a salesperson back on a deal after five days, **when** they choose "What changed?", **then** they see the 14 entries added since their last visit, grouped by kind, and, with an AI provider configured, a five-line summary linking to them.
- **Given** an agent connected through MCP, **when** it calls `crm_record_summarise` for a call with `preview: true`, **then** it receives the proposed note with its sources and nothing is written; after the user approves an edited version, the note is on the timeline marked "generated, approved by <user>".

### 2.2 Edge cases & failures

- **Given** `FEATURE_CRM` off, **when** any route of this spec is called, **then** `404`; contacts keep their comments, documents panel and members exactly as today.
- **Given** the communications plugin not loaded, **then** the Emails and Messages tabs and the composer shortcut are absent, and the communication status stays at its manual value.
- **Given** the shared service level engine not loaded, **when** a manager tries to switch service levels on, **then** it is refused with the reason, and first response times are still recorded in elapsed time.
- **Given** the automation plugin not loaded, **then** assignment rules and the assignee list are absent; the owner is set by hand only.
- **Given** record rules not available, **when** a manager switches hierarchy visibility on, **then** it is refused with the reason; the hierarchy still serves forecasts and escalation.
- **Given** two users assigning the same lead at once, **then** one change wins and the other receives `409` with the current owner.
- **Given** 200 deals selected for "assign to Ben", **when** 5 cannot be edited by the caller, **then** 195 are assigned and the result lists the 5 with the reason.
- **Given** an assignment rule without people, **when** a manager activates it, **then** it is refused; **given** nobody in any pool, **then** the lead stays without owner, sits in the "Unassigned" view and the rule's owner is told once.
- **Given** a person who is mentioned in a note on a deal they cannot read, **then** the author is warned before saving and the person gets no content in the notice.
- **Given** a holiday added to a calendar after due times were set, **then** open clocks on that calendar are recomputed and the change is on their timelines.
- **Given** a hierarchy move that would put Ana under someone who reports to her, **then** it is refused naming the loop; removing a manager with reports and no destination is refused.
- **Given** an email whose sender matches two leads, **then** it shows on both timelines and both switch to "awaiting us".
- **Given** a file over the organization's limit for deals, **then** the upload is refused naming the limit and nothing is stored.
- **Given** the web app installed on a phone that loses its connection while a note is typed, **then** the note is kept on the device and offered for sending on reconnect; nothing is half-saved.
- **Given** a user who switches capture off, **then** no new message is captured from that moment and earlier captured entries stay unless they choose "remove captured entries".

## 3. Functional Requirements

### 3.1 Presence and settings

- **FR-1** The system MUST answer every route this spec adds with `404` while `FEATURE_CRM` is off for the tenant; no menu entry, page, tab, MCP tool, job effect or event of this spec is then observable.
- **FR-2** The system MUST offer each capability only while the plugin it builds on is loaded (email and messages: `email-and-communications`; calls: `telephony`; service levels: the shared service level engine of `helpdesk-sla-routing-and-analytics`; assignment rules and assignees: `automation-and-notifications`; record rules and shares: `access-control-and-security`; notes, palette and views: `record-views-and-search`), hide an absent capability with its reason in Settings → CRM, and keep the rest working.
- **FR-3** A user with `CRM_SETTINGS_EDIT` can switch on per organization, each off by default: service levels on leads, service levels on deals, sales hierarchy, hierarchy visibility, activity capture and reply-time coaching; every change is audited with before and after.
- **FR-4** The system MUST keep a contact's comments, documents panel and members working as today, mirror the open assignments of a lead, person or organisation into its members (a new assignee is added as a member; a closed assignment removes only a member that the mirror itself added, never one a person picked by hand), and copy existing members into open assignments when `FEATURE_CRM` is first turned on for the organization, leaving the members list unchanged.

### 3.2 Activity timeline

- **FR-5** The system MUST show on every lead, deal, person and organisation page the record timeline of `record-views-and-search` with the CRM's entries (creation, stage moves with time in stage, owner and assignee changes, conversion, merge, service level milestones, communication status changes, task events) and the entries other features contribute (comments, field changes, notes, emails, messages, calls, meetings, files, automation runs).
- **FR-6** The system MUST offer tabs that filter the timeline by kind (Activity, Emails, Messages, Calls, Tasks, Notes, Comments, Files) beside the record tabs of `crm-leads-and-deals`, hide tabs of absent plugins, and let the palette open a tab of the current record.
- **FR-7** The system MUST include in a deal's timeline the entries of its source lead from before conversion, and in a person's and an organisation's timeline the entries of their deals and of the lead they came from, each marked with its record and shown once.
- **FR-8** The system MUST show only entries the viewer may read: entries of records the viewer cannot read are left out and private entries show only to their author.
- **FR-9** The system MUST order the timeline newest or oldest first and show relative or exact times per user preference, group consecutive field changes by one person within 5 minutes, and page by cursor.
- **FR-10** The system MUST add new entries to an open CRM page within 2 s of their creation by a person, an automation, an agent or intake, without reload, and warn a user editing a field another person changed meanwhile.
- **FR-11** The system MUST keep per lead and deal the counts of comments, emails, messages, calls, notes, open tasks and files, show them on list rows and board cards, and recalculate them when entries are added, removed or moved by a merge.
- **FR-12** The system MUST mark a lead or deal unread for its owner and assignees in lists and boards when others added entries after their last opening of it, and clear the mark when they open it.
- **FR-13** The system MUST update a lead's or deal's last activity time on every entry made by a person or a communication (automations only when they send a communication), for the staleness and health rules of `crm-leads-and-deals`.

### 3.3 Notes and comments

- **FR-14** A user who can read a CRM record can add notes to it: a note is one of the platform's comments on the record marked as a note (rich text, mentions, readers or private, as `record-views-and-search` defines notes), so notes and comments are one thread that the Notes and Comments tabs filter by kind; they edit and delete their own and pin any; the CRM shows a note's first line as its title, pinned notes first with who pinned them and when, and a copy-link action that opens the note in place.
- **FR-15** The system MUST notify each person newly mentioned in a note or comment once per save, and warn the author before saving when a mentioned person cannot read the record; that person's notice then carries no content.
- **FR-16** The system MUST accept comments with mentions and attachments on leads, deals, people and organisations, and bump the record's modified time on a new comment when the organization chooses so (default off).
- **FR-17** The system MUST offer a Notes page listing the CRM notes the viewer may read, filtered by record type, record, author, date and pinned, opening each in a side panel with edit and delete for its author and copy link.
- **FR-18** The system MUST show the existing contact comments in the timeline as comments, without copying or converting them.

### 3.4 Tasks

- **FR-19** A user with `ORG_TASK_ADD` who can read a CRM record can create a task linked to it with title, description, priority, status, start, due date and time and assignees; it is a platform task that needs no project, uses the organization's task statuses and priorities, shows in its assignees' tasks and can be timed.
- **FR-20** The system MUST show a record's tasks on its Tasks tab and timeline (created, status changed, done), offer a status change from the row, and open a task in a side panel without leaving the record.
- **FR-21** The system MUST notify a task's assignees when they are assigned and close the previous assignee's open to-do on the record when a task is reassigned.
- **FR-22** The system MUST remind assignees before a linked task is due through the platform's task reminders and publish "CRM task overdue" once per task and due time when it passes with the task open.
- **FR-23** The system MUST offer a "CRM tasks" view in the platform's task views over the tasks linked to records the viewer may read, as a list and a board by status, filtered by priority, assignee, status, due (overdue, today, this week, later), record type and record; creating a task there asks for its record. No second task board exists.
- **FR-24** The system MUST list overdue linked tasks and those due within 7 days in the palette's upcoming panel and on the CRM home.
- **FR-25** The system MUST move a lead's open tasks to its deal at conversion (setting, default on) and keep its done tasks on the person.
- **FR-26** (advanced) The system MUST count time tracked on tasks linked to a deal, and on calls linked to it when `telephony` is loaded, as the deal's selling effort: hours per person and, for holders of `CRM_SELLING_COST_VIEW`, cost at stored rates; won deals give their cost of sale to `crm-forecasting-and-analytics`.

### 3.5 Email and messages on CRM records

- **FR-27** A user with `COMMUNICATIONS_MESSAGE_SEND` who can read a lead, deal, person or organisation can open the composer of `email-and-communications` from its header, a person row or a timeline email, with recipients prefilled from the record (the deal's primary person first, its other people, the organisation's primary contact), copy, blind copy, sending identity, template, attachments and signature.
- **FR-28** The system MUST leave a person marked "do not contact" out of prefilled recipients, say why, and ask for confirmation before such a person is added by hand; suppressed addresses are refused as the communications feature decides.
- **FR-29** The system MUST offer reply and reply all on every received email in a CRM timeline, keeping its thread.
- **FR-30** The system MUST offer scheduling choices in the CRM composer (in one hour, this afternoon, tomorrow morning, next working day, a chosen time) in the sender's time zone, and show scheduled messages on the record with edit, send now and cancel for their author only.
- **FR-31** The system MUST link each email or message sent from a CRM record to that record and to its recipients' parties, show on CRM timelines every incoming message the communications matcher links to them, and also link a reply to a converted lead's mail to its deal.
- **FR-32** The system MUST publish "CRM record replied" when a party's message links to a lead or deal, as an automation trigger and as input to the communication status and service levels.
- **FR-33** A user with `COMMUNICATIONS_TEMPLATE_MANAGE` can keep enabled or disabled email and text templates for leads, deals, people and organisations using CRM tokens (record fields and custom fields, owner, primary person, organisation, stage, amount, next step); the CRM composer offers the enabled templates of the record's type and the general ones.
- **FR-34** A user can set their own subject pattern for email from CRM records with tokens (record reference, title, organisation) and see a preview; the platform's reply reference is still added.
- **FR-35** The system MUST choose in the CRM composer the user's own sending identity and default signature, else the organization's default for the record type, and let them switch to any identity they may use.
- **FR-36** A user with `COMMUNICATIONS_MESSAGE_SEND` can send a text or messaging message from a record to a person's number or handle on the channels of `email-and-communications`; where a channel allows only approved templates outside its reply window, only those are offered.
- **FR-37** The system MUST show a record's messages as one conversation on its Messages tab, notify the record's owner (else its assignees) of each incoming message, and ask for confirmation before a number or handle that already has a conversation is changed.
- **FR-38** The system MUST show on Settings → CRM → Communication the messages sent from CRM records per sending account this month, beside the template list of each account.
- **FR-39** A user with `ORG_CONTACT_ADD` can create a lead, or with `EDIT_SALES_PIPELINES` a deal, from a received email in a mailbox or timeline after confirming the prefilled fields (sender name split into first and last name, address, company from a non-public domain); the email is linked to the new record; the action is not offered on sent mail.

### 3.6 Communication status

- **FR-40** The system MUST keep on each lead and deal a communication status from the organization's list, each status having name, colour, position and a kind (awaiting us, awaiting them, neutral); shipped: "Awaiting us", "Awaiting them", "No conversation"; statuses in use are deactivated, never deleted.
- **FR-41** The system MUST, per organization switches (default on), set the first status of kind "awaiting them" when a user sends an email or message from the record and the first of kind "awaiting us" when a party's message links to it, and bump the record's modified time on a new communication (default off).
- **FR-42** A user with edit right can set the status by hand; the change is a timeline entry, and the automation action "set communication status" is offered.
- **FR-43** The system MUST show the status on lists, boards and the record header, filterable, and provide the system view "Awaiting our reply" ordered by waiting time.

### 3.7 Calls, meetings and events

- **FR-44** The system MUST show the calls `telephony` logs for a CRM record on its Calls tab and timeline with direction, status, duration, caller and receiver, recording player, summary, outcome and the attached note and tasks; the Calls tab and click-to-call are absent while `telephony` is off.
- **FR-45** The system MUST show meetings and calendar events linked to a CRM record on its timeline and let a user schedule one from the record with the record's people as participants through `calendar-and-scheduling`.
- **FR-46** The system MUST offer calendar events a participant source over CRM people: all people of a deal, an organisation's members, or the people and leads of a saved view (up to 100), each added participant linking the event to that record's timeline.

### 3.8 Files

- **FR-47** A user with edit right can attach files to a lead, deal, person or organisation from its Files tab or by dropping them on the page, as drive documents linked to the record; files are listed with size, author and date, can be opened, downloaded and unlinked (deleted only with the drive's own rights), and each change is a timeline entry.
- **FR-48** The system MUST apply per CRM record type the organization's upload limits (maximum size, allowed types) and refuse a file outside them naming the limit; until the organization sets narrower limits, the Files tab accepts every file the record's documents panel accepts today (the drive's own limits).
- **FR-49** The system MUST list in the Files tab the attachments of the record's emails and comments, marked with their origin.

### 3.9 First response and service levels

- **FR-50** The system MUST record for each lead and deal the first inbound contact (creation by intake or the first party message) and the first response by a person (email or message sent, call connected, call logged by hand), in elapsed time and, when a service calendar applies, in working time; a converted lead's deal keeps the lead's figures.
- **FR-51** A user with `CRM_SLA_MANAGE` can define service level policies for leads or deals on the shared service level engine: name, record type, active, valid from and to, position, calendar, conditions on the record's fields and custom fields (source, intake channel, territory, temperature, owner's team, pipeline, amount) and one default per record type without conditions.
- **FR-52** The system MUST validate a policy's conditions on save against an empty record of its type, refuse conditions it cannot evaluate naming the field, and refuse deactivating or deleting the default policy.
- **FR-53** The system MUST apply to a record the first active, valid policy in order whose conditions match, else the default, else none, and choose again when a field read by the conditions changes, keeping elapsed working time.
- **FR-54** The system MUST take a policy's targets as first response and next reply in working minutes or hours, per lead temperature for leads (one row may serve every temperature) and one row for deals.
- **FR-55** A user with `CRM_SLA_MANAGE` can pick or create a policy's calendar: weekly working intervals per weekday with breaks, a holiday calendar of `time-off-management` (dated holidays with descriptions and weekly off days generated over a date range), and dated exceptions; a calendar in use cannot be deleted.
- **FR-56** The system MUST, when a policy measures next reply, start a new clock each time a party writes after a reply and meet it with the next person reply, recording each as met or missed.
- **FR-57** The system MUST pause the clocks of a record in an on-hold stage and end them when the lead is converted or lost or the deal is won or lost.
- **FR-58** The system MUST show on the record its policy, start, response due time, first and last response times, state (running, paused, met, met late, breached) and working time left.
- **FR-59** The system MUST offer service level state and due time as list columns, filters and sort keys, the system view "Response due" ordered by due time, and the responses due within 24 hours in the palette's upcoming panel.
- **FR-60** A user with `CRM_SLA_MANAGE` can duplicate, rename, enable, disable and reorder policies from their list; an edit shows how many open records it affects and keeps their due times unless the user recomputes them.
- **FR-61** The system MUST warn the owner (else the assignees) at a share of the target (default 75 %), record a breach at its due time even when found later, notify the owner and their hierarchy manager (when the hierarchy is on), and publish warnings, breaches and fulfilments as timeline entries and automation triggers.
- **FR-62** The system MUST refuse switching service levels on while the shared engine is not loaded, naming it, and keep recording first response in elapsed time meanwhile.

### 3.10 Owner, assignees and assignment rules

- **FR-63** The system MUST keep the lead's or deal's owner (`crm-leads-and-deals`) as one of its assignees, which are the record assignments of `automation-and-notifications`; an owner change closes the previous owner's assignment unless the user keeps it in the same step.
- **FR-64** A user with edit right can assign and unassign one or more users from the record header, a list row, a board card or the palette ("assign to me", "assign to…"), and in bulk on up to 500 records with per-record results; each new assignee is notified and gets an open to-do on the record.
- **FR-65** The system MUST show assignees as an avatar stack with availability indicators on rows, cards and headers, with a popover to add and remove them.
- **FR-66** A user with `ASSIGNMENT_RULE_MANAGE` can define assignment rules for leads or deals on the platform's assignment engine (conditions, unassignment conditions, pool of people, teams or roles with weights, distribution in turn, fewest open, weighted, by capacity or from a field, active weekdays and hours, position, description), duplicate them and see each rule's last assignee; a rule without people cannot be activated.
- **FR-67** The system MUST run the rules when a lead or deal is created without owner, reopened, or its owner is deactivated, and on demand for selected records (preview first); the first matching rule decides, and with "rules set the owner" (default on) the chosen person becomes owner, else an assignee.
- **FR-68** The system MUST order each pool before distribution: available people first, then away, then anyone else of the pool; people on approved time off or outside their working hours are chosen only when nobody else is left; each skipped person and reason is kept with the decision.
- **FR-69** (advanced) The system MUST let a rule also narrow its pool by the record's territory (its sales people and those of parent territories), language, required skills and a cap of open records per person, and show "why this person?" with the rule, the order tried and each skip reason.
- **FR-70** A user with `ASSIGNMENT_RULE_MANAGE` can make a rule cover one intake channel (web form, email, phone, messaging, ad, manual) at weekly hours with a team as its pool, and keep one catch-all rule per channel for hours no rule covers; the system warns when two rules of one channel overlap in time and refuses an interval that ends before it starts.
- **FR-71** The system MUST carry a lead's owner and open assignees to its deal at conversion, and keep them on the person.
- **FR-72** The system MUST show a territory's manager (`sales-order-management`) on the leads and deals of that territory and offer "territory manager" as a pool member, a breach escalation target and a notice recipient.
- **FR-73** (advanced) The system MUST offer, when an owner starts approved time off of more than 3 working days or is deactivated, to move their open leads and deals with a service level running to people chosen by the rules, listed for the manager to accept.

### 3.11 Availability

- **FR-74** The system MUST read each person's availability from the organization's availability states (one state per person, shared with support, from `helpdesk-sla-routing-and-analytics`) when that plugin is loaded, else from the platform presence (active and idle count as available, away as away, offline as unavailable); people with no state count as available.
- **FR-75** A user can set their own availability state, with an optional end time, from the CRM header when states are available; it shows as a coloured dot beside their avatar wherever CRM shows people and reaches open pages within 2 s.

### 3.12 Visibility and sharing

- **FR-76** The system MUST register leads, deals, people and organisations with the record-level rules of `access-control-and-security`, declaring their owner, assignee and territory paths, so the scopes own, assigned, team, reporting line, values (territory with descendants) and condition apply to them in lists, counts, boards, search, timelines, exports, reports and MCP.
- **FR-77** The system MUST keep every CRM record readable and editable by its owner and assignees whatever the rules (setting, default on), and keep CRM records visible to every member holding the view permission while the type has no rule.
- **FR-78** The system MUST offer the rule templates "Sales person: own or assigned", "Sales manager: hierarchy" and "Territory: own territory and below", applied only when a user with `ACCESS_RECORD_RULES_MANAGE` chooses one, after a preview of who gains and loses access.
- **FR-79** A user with `ACCESS_RECORD_SHARE` and the share right can share a CRM record with users, teams or roles for read or edit with an optional expiry from its header; the record lists its shares, shares end at expiry, and the deal created from a lead receives the lead's shares (setting, default on).

### 3.13 Sales hierarchy

- **FR-80** The system MUST take the organization's sales hierarchy from its reporting line (`hr-core-lifecycle`; without it, the managers of each person's organization teams), and a user with `CRM_HIERARCHY_MANAGE` can place a person under another sales manager by drag and drop or a keyboard move, kept as an exception to the reporting line and shown as such, or return them to the reporting line; the system refuses a move that creates a loop or places a person under someone without `VIEW_SALES_PIPELINES`, naming the problem.
- **FR-81** The system MUST, when a person with reports is removed from the sales hierarchy, ask where the reports go (their manager by default, or a named person) and, optionally, to whom their open leads and deals move, and refuse the removal without a destination; the choice is kept as exceptions and never changes the reporting line itself.
- **FR-82** The system MUST, with hierarchy visibility on, resolve the reporting line scope of CRM record rules from the sales hierarchy: a manager reads records owned by or assigned to anyone below them; records stay visible up the chain.
- **FR-83** The system MUST refuse hierarchy visibility while record-level rules are unavailable, restore the previous visibility at once when it is switched off, and keep the tree.
- **FR-84** The system MUST offer the hierarchy to forecast roll-ups (`crm-forecasting-and-analytics`), breach escalation and coaching, show each person's manager and reports on their CRM card, and keep a history of hierarchy changes with who and when.
- **FR-85** The system MUST tell a person's manager when that person is deactivated and offer the moves of FR-81.

### 3.14 Activity capture `(advanced)`

- **FR-86** (advanced) A user can let the system capture their email and calendar activity with CRM parties from their own and team mailboxes in the platform's Inbox (connected outside mailboxes included) and their synced calendar: a message or event with a known person or organisation links to that party and to the open leads and deals the user owns or is assigned to with that party.
- **FR-87** (advanced) Each user chooses per source off (default), metadata only (subject, time, participants) or full content, lists excluded domains and addresses, and can mark a thread or event private, after which it is never linked and its earlier links are removed.
- **FR-88** (advanced) The system MUST never capture items with only internal participants, with excluded or suppressed addresses, or marked sensitive, and send each capturing user a weekly digest of what was captured with one-click unlink.
- **FR-89** (advanced) A user with `CRM_SETTINGS_EDIT` can allow capture for the organization and set the most a user may share (metadata only or full content); a user's choice may only be stricter.
- **FR-90** (advanced) The system MUST propose unknown participants from the domain of an organisation with an open deal as new people of it, created only on confirmation.

### 3.15 Relationship signals `(advanced)`

- **FR-91** (advanced) The system MUST compute nightly for each person and organisation a relationship strength per colleague and overall (strong, steady, weak, none) from the recency, frequency and two-way balance of emails, messages, calls and meetings over 90 days, and show it with its signals.
- **FR-92** (advanced) The system MUST mark an open deal "going quiet" when its primary person or decision maker has not answered for a set number of days (default 14) and a person whose replies have slowed to twice their usual time; the marks show on the deal and feed deal health of `crm-leads-and-deals`.
- **FR-93** (advanced) The system MUST show on an organisation page which colleagues know which of its people best, from interactions the viewer may read, for introductions.

### 3.16 Reply-time coaching `(advanced)`

- **FR-94** (advanced) The system MUST compute per user their median working-time reply to parties on CRM records over the last 30 days against the team median and their own trend, show it to the user, and to holders of `CRM_COACHING_VIEW` for the people they lead (hierarchy or teams they manage).
- **FR-95** (advanced) The system MUST nudge an owner once per message when a party's message on a hot lead or an open deal has waited longer than the smaller of the policy's warning time and the owner's median, with one action that opens the composer on a drafted reply.
- **FR-96** (advanced) The system MUST show coaching as suggestions with their evidence (records waiting longest, hours with slow replies) and never publish a ranking to the team unless the organization opts in.

### 3.17 Summaries `(advanced)`

- **FR-97** (advanced) A user can ask on a CRM record "What changed?": the system lists the entries added since the user's previous opening (the one before the current visit), grouped by kind, and adds a short written summary with links to the entries when an AI provider is configured.
- **FR-98** (advanced) A user can ask for a summary of a linked call or meeting transcript or email thread; the summary is proposed with its sources and written to the timeline as a note only after the user approves it, possibly edited, marked "generated, approved by" the user.
- **FR-99** The system MUST send record content to the organization's AI provider only when the organization enabled assistants for CRM, and only entries the requesting user may read.

### 3.18 API, MCP, events and reports

- **FR-100** The system MUST expose every capability through REST (GraphQL reads where the plugin contributes them), with idempotency keys on creating routes and per-record results on bulk routes.
- **FR-101** The system MUST offer MCP tools and in-app assistant tools to read a record's timeline and engagement, add a note, create, update and list CRM tasks, set the communication status, assign and explain an assignment, read service level states and what is due, share a record, read the hierarchy, read relationship strength, get "what changed" and propose summaries, under the caller's permissions; writing tools take `preview: true`.
- **FR-102** The system MUST record a change made by an agent as made by the agent on behalf of the user who confirmed it.
- **FR-103** The system MUST publish, with ids only, as automation triggers and webhook events: communication status changed, record replied, CRM task overdue, record assigned and unassigned, service level warned, breached and met on CRM records, hierarchy changed, relationship band changed and deal going quiet.
- **FR-104** The system MUST give `crm-forecasting-and-analytics` the engagement facts it reads: first response times, interactions per record and owner, last activity, selling effort of won deals and the sales hierarchy.
- **FR-105** The system MUST register these report definitions (filters period, organization, owner, team, hierarchy branch, record type, pipeline and source where they apply; table and chart; export and schedules through the report builder, a read-only view without it):

  | Report | Answers |
  | --- | --- |
  | Service level compliance | met, met late and breached first responses and next replies on leads and deals by policy, owner, source and channel |
  | Awaiting our reply | leads and deals whose status is "awaiting us", with waiting time, owner and last message |
  | Assignment distribution | records assigned per person and rule, skips by reason, unassigned records and time to assignment |
  | CRM tasks | open, overdue and done tasks linked to CRM records by assignee, priority and record type |
  | Relationship strength | people and organisations by band and trend, deals going quiet |
  | Reply times | median and spread of reply times per person and team over time |
  | Selling effort | tracked hours and cost per deal, owner and outcome, against deal value |

## 4. Non-Functional Requirements

- **Performance**: a CRM timeline's first page (50 merged entries with carry-forward) P95 < 400 ms at 10,000 entries per record; counts and status on 2,000-card boards add no query per card; assignment decided within 2 s of creation P95; capture links a pulled message within 60 s; nightly relationship and coaching runs for 100,000 parties < 20 min.
- **Volume**: 50 million timeline entries, 5 million CRM tasks and 2,000 users in a hierarchy per tenant; 500 assignment rules and 200 policies per organization.
- **Concurrency**: owner and status writes state the version they read (`If-Match`); bulk assignment reports per record; one decision per record and trigger.
- **Reliability**: events through the event outbox (at least once, deduplicated per consumer); counts and facts rebuildable from their sources; nightly jobs idempotent and catching up after downtime; a missed overdue or warning is raised late, never twice.
- **Security & privacy**: tenant and organization scoped; every surface applies the record rules; captured content follows the user's mode and the organization's ceiling; private entries visible to their author only; leaving the platform: emails and messages through `email-and-communications`, AI provider calls only when enabled and with readable entries only.
- **Auditability**: who, when, before and after for owner, assignee, status, policy, rule, hierarchy, capture and settings changes; agent changes carry the agent marker.
- **Accessibility and localization**: tabs, avatar popovers, the hierarchy editor and boards are keyboard operable with labelled controls; states carry text, not colour alone; durations and times in the viewer's language and time zone; every string in all shipped locales.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; each sibling plugin optional with the stated fallback; OpenAPI and SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Timeline entry | One dated item of a CRM record's history, contributed by the CRM or another feature |
| Engagement state | A lead's or deal's counts, last activity, communication status, first response and service level summary |
| Communication status | Who owes the next message on a lead or deal, from the organization's list with a kind |
| Response fact | One party message and the person reply that answered it, with elapsed and working time |
| CRM task link | A platform task attached to a CRM record, kept as one of the platform's record links |
| Service level policy (CRM) | A policy of the shared engine for leads or deals with conditions, calendar and targets |
| Assignment rule (CRM) | A rule of the platform's assignment engine for leads or deals, optionally covering a channel at given hours |
| Availability | A person's state for routing: a named state or the platform presence |
| Sales hierarchy exception | A user placed under a sales manager other than their reporting-line manager |
| Capture preference, capture entry | A user's capture choices; one captured message or event linked to CRM records |
| Relationship | A party's strength per colleague and overall, with signals |
| User CRM preference | A user's subject pattern, default identity and nudge choices, kept with the user's other preferences |

## 6. Out of Scope

- Lead, deal, person and organisation records, owner field, conversion, merge, primary flags and validation of people's channels, stage rules, staleness, health and next best action → `crm-leads-and-deals`.
- First response, activity and owner reports, forecast roll-ups → `crm-forecasting-and-analytics` (fed by FR-104).
- Email accounts, identities, sending, scheduling queue, threading and matching, templates engine, signatures, text and messaging transport, provider accounts and template review, suppression and consent → `email-and-communications`.
- Call logs, click-to-call, call popup, recordings → `telephony`; meetings media → `meetings`; calendar events and invitations → `calendar-and-scheduling`.
- Web forms, intake from email, calls, messaging and ads, enrichment → `lead-capture-and-enrichment`.
- The timeline shell, notes, record visits, palette and saved views → `record-views-and-search`; task views → the platform's task views; the reporting line → `hr-core-lifecycle`; the assignment engine and record assignments → `automation-and-notifications`; record rules, shares and the share dialog → `access-control-and-security`; the service level engine, calendars and availability states → `helpdesk-sla-routing-and-analytics`; holiday calendars → `time-off-management`; territories and sales people → `sales-order-management`; drive documents → `drive`.

## 7. Acceptance Criteria

- [ ] **AC-1** With `FEATURE_CRM` off every route of this spec answers `404`; the contact page's comments, documents panel and members behave as before (FR-1, FR-4).
- [ ] **AC-2** A deal's Activity tab shows stage moves, owner change, an email, a call, a note, a task and its source lead's earlier comments marked "from lead"; each tab filters to its kind; an entry added by another user appears within 2 s (FR-5–FR-7).
- [ ] **AC-3** A pinned note shows first with who pinned it; a mention of a person who cannot read the deal warns the author (FR-14, FR-15).
- [ ] **AC-4** A task created from a deal shows in the assignee's tasks and on the deal; passing its due time raises exactly one "CRM task overdue" event; the "CRM tasks" view of the task views filters by assignee and due as list and board (FR-22–FR-24).
- [ ] **AC-5** An email sent from a deal with a template and "tomorrow morning" is scheduled at 09:00 in the sender's zone; the reply lands on the deal and its lead, the status turns "awaiting us" and the owner gets one notice (FR-30).
- [ ] **AC-6** A "do not contact" person is left out of prefilled recipients with the reason (FR-28).
- [ ] **AC-7** A hot web lead at 17:55 on Friday gets its response due Monday 09:10 under the scenario's calendar; a warning at 75 %, a breach at the due time after a simulated hour of downtime, and a met clock on the first email follow FR-53 to FR-61 on three databases.
- [ ] **AC-8** Switching service levels on without the shared engine is refused; first response is still recorded in elapsed time (FR-62).
- [ ] **AC-9** An assignment rule assigns in turn, skips an away person and one on time off with reasons, and "why this person?" lists them; a rule without people cannot be activated (FR-66, FR-68, FR-69).
- [ ] **AC-10** Two channel rules with overlapping hours raise a warning; a catch-all rule takes a lead outside every slot (FR-70).
- [ ] **AC-11** With the template "Sales person: own or assigned" and hierarchy visibility on, a sales person's deal list and counts contain only their own and assigned deals, and their manager's contain their subtree's (FR-78, FR-82).
- [ ] **AC-12** A share until Friday works until Friday and not after; a lead's shares move to its deal at conversion (FR-79).
- [ ] **AC-13** The sales hierarchy shows the reporting line with exceptions marked; a hierarchy move creating a loop is refused; removing a manager without a destination for reports is refused; switching visibility off restores the earlier lists at once (FR-80, FR-81, FR-83).
- [ ] **AC-14** Bulk "assign to Ben" on 200 deals with 5 not editable assigns 195 and reports 5 with reasons (FR-64).
- [ ] **AC-15** Capture in "metadata only" links subject, time and participants of a thread with a customer to the person and the open deal; an excluded domain and a private thread never appear; the weekly digest unlinks in one click (advanced: capture; FR-87, FR-88).
- [ ] **AC-16** Relationship strength shows per colleague with signals; a deal whose decision maker did not answer for 14 days is "going quiet" (advanced: relationships; FR-91, FR-92).
- [ ] **AC-17** Coaching shows the user's median against the team; a hot lead waiting beyond the owner's median produces exactly one nudge (advanced: coaching; FR-94, FR-95).
- [ ] **AC-18** "What changed?" lists exactly the entries since the previous visit, also after the current opening cleared the unread mark; a proposed call summary writes nothing until approved and is then marked as generated (advanced: summaries; FR-97, FR-98).
- [ ] **AC-19** Tracked time on a deal's tasks shows as selling effort; cost appears only to holders of `CRM_SELLING_COST_VIEW` (advanced: effort; FR-26).
- [ ] **AC-20** The seven report definitions of FR-105 return the expected figures on the demo data set and the system views "Awaiting our reply", "Response due" and "Unassigned" list the right records.
- [ ] **AC-21** Every MCP tool of FR-101 answers under the caller's rights and its preview writes nothing.
- [ ] **AC-22** CRM pages pass keyboard and screen-reader checks; works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (§4).
- [ ] **AC-23** With `FEATURE_CRM` turned on, a contact's members picked by hand stay when an owner changes or an assignment closes, and a file the documents panel accepts today is accepted by the Files tab while the organization has set no narrower limit (FR-4, FR-48).
- [ ] **AC-24** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Availability states live in the helpdesk's agent module. Applied default: the CRM reads them when the helpdesk plugin is loaded (a salesperson gets an agent profile not routable for tickets) and platform presence otherwise; states can later move to a shared people service.
- Service level policies for leads and deals need the shared engine to accept a record type on policies and calendars. Applied default: additive change in the engine of `helpdesk-sla-routing-and-analytics`; without it, first response only.
- Lead temperature is the priority of lead service level targets (deals use one row). Applied default.
- Hierarchy visibility needs a reporting-line source per record type in the record rules. Applied default: additive extension point in `access-control-and-security`.
- Owner and assignees always read and edit their records whatever the rules. Applied default on; an organization can switch it off.
- Activity capture defaults to off for every user, and an administrator can only allow it, never force it on. Applied default.
- A contact's members stay the store that other pages read; CRM assignments are mirrored into it. Applied default; older readers can later be aligned with assignments.

## 9. Constitution Gates

- [x] I Plugin-first — sub-modules of `packages/plugins/crm` and pages in `crm-ui`; no core table changes.
- [x] II Tenant/organization scoping — every new record carries tenant and organization; queries go through tenant-aware services and record rules.
- [x] III Both ORMs, additive migrations — new tables and nullable columns on three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_CRM` and per-organization switches off; contact comments, documents and members kept.
- [x] V Contracts and API first — contracts in `packages/contracts`; every capability through REST and MCP before UI.
- [x] VI Permissions, privacy, security — four new keys, record rules on every surface, capture ceiling and private marks, AI calls opt-in.
- [x] VII Real-time through the event bus — outbox events, real-time hints for timelines, counts, status and availability.
- [x] VIII i18n and accessibility — keys in every locale, keyboard tabs, popovers and hierarchy editor, text with colours.
- [x] IX Tests accompany the change — unit, e2e and fallback (sibling absent) tests per task.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../crm-leads-and-deals/spec.md`](../crm-leads-and-deals/spec.md), `email-and-communications`, [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md), [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md), [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md), [`../helpdesk-sla-routing-and-analytics/spec.md`](../helpdesk-sla-routing-and-analytics/spec.md)
- Works with: [`../crm-forecasting-and-analytics/spec.md`](../crm-forecasting-and-analytics/spec.md), `telephony`, `lead-capture-and-enrichment`, `calendar-and-scheduling`, `meetings`, [`../time-off-management/spec.md`](../time-off-management/spec.md), [`../sales-order-management/spec.md`](../sales-order-management/spec.md), [`../hr-core-lifecycle/spec.md`](../hr-core-lifecycle/spec.md)
- Code: `apps/gauzy/src/app/pages/contacts/contact-view/` (notes tab, members tab, documents panel), `packages/core/src/lib/comment/`, `packages/core/src/lib/resource-link/`, `packages/core/src/lib/employee-recent-visit/`, `packages/plugins/task-views-ui/`, `packages/plugins/inbox/src/lib/email/handoff/`, `packages/core/src/lib/mention/`, `packages/core/src/lib/tasks/` (tasks, due reminders), `packages/core/src/lib/activity-log/`, `packages/plugins/docs/src/lib/entities/document-link.entity.ts`, `packages/plugins/realtime/src/lib/realtime-presence.store.ts`, `packages/core/src/lib/event-outbox/`
