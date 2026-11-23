# Feature Specification: Calendar and Scheduling

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `calendar-and-scheduling`
**Branch**: `feat/calendar-and-scheduling`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_CALENDAR` (new tenant feature, default off); the plugin loads only when `GAUZY_CALENDAR_ENABLED` is exactly `true`. `FEATURE_EMPLOYEE_APPOINTMENT` (on) and `GAUZY_MEETING_REMINDERS_ENABLED` (off) keep their meaning.

---

## 1. Overview

Today an employee has an appointments calendar, weekly and dated availability, bookable event types and a public
booking page; invited colleagues get meeting notices, optional reminders and a "meetings I am invited to" list. There
are no calendars as such, no repeating events, no answers to invitations, no rooms or equipment to book, no link from an
event to a customer, deal or task, and there is no sync with outside calendars. This feature turns the
appointments into a full calendar: **personal, team, organization, resource and subscribed calendars** with sharing
levels; **events** (the existing appointments, extended) with time zones, all-day and multi-day spans, privacy and
show-as; **recurrence** with exceptions; **invitations** to colleagues, people of business records and outside guests,
with answers and proposed times; **free/busy** from working hours, events, time off, holidays and shifts; **views** with
people and rooms side by side; **reminders**; **bookable resources** with conflict checks and approvals; **appointment
types and booking pages** with one host, round-robin, collective and group assignment; **events on any record**;
**external sync** over the standard calendar protocol, iCalendar feeds and provider adapters; import, export and search.
Clients: the Angular app (`calendar-ui`, with React surfaces from `calendar-react-ui`), Ever Teams through the same API
(its time-log calendar page stays as it is and can show events as a layer), public booking pages, the MCP server and
the SDKs.

Which calendar concept is whose:

| Concept | Owner |
| --- | --- |
| Calendars of events, invitations, free/busy, resources, booking pages, external sync | this feature |
| Holiday calendars (holidays, rest days, assignment per branch or employee), time-off feeds | `time-off-management` (read here as busy time and as a layer) |
| Service calendars that measure service levels in working time | `helpdesk-sla-routing-and-analytics` (not event calendars; never shown here) |
| Shift templates, rosters, shift feeds | `attendance-and-shifts` (read here as working hours and as a layer) |
| Work-centre calendars | `shop-floor-and-work-orders` |
| Calendar layout of any record list | `record-views-and-search` (renders records; events live here) |

Advanced capabilities: a **scheduling assistant** that proposes times across people, rooms and time
zones and says in one sentence what each option costs; **round-robin, collective and group booking pages with payment
before confirmation**; **focus time and meeting-load analytics** per person and team with privacy thresholds; a
**"could this be a discussion?" check** before a large meeting without agenda; **room check-in with automatic release**;
**attended events as tracked time** on the linked task, so meetings feed cost and billing like any other work; and
**agent tools** that find times and draft events for a person to send.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an employee with appointments, **when** the feature is switched on and they open Calendar, **then** their personal calendar shows every existing appointment, and the appointment pages keep working as before.
- **Given** Ana in Berlin, **when** she creates "Planning" every second Tuesday 09:00–10:00 Berlin time until June with Ben (Lisbon, required) and Chen (optional), a meeting room and the room "Atlas", **then** Ben and Chen get a notice and an email with the times in their own zones, Atlas is confirmed for every occurrence within its horizon, and the rule reads "Every 2 weeks on Tuesday until 30 June".
- **Given** that series, **when** Ben accepts the series and declines one occurrence with "on leave", **then** Ana sees his answers per occurrence, and the declined occurrence leaves Ben's busy time.
- **Given** the series, **when** Ana moves "this and following" to 10:00 from March, **then** the earlier part ends in February, a new series starts in March, earlier answers stay, and participants receive one update.
- **Given** an outside guest invited by address, **when** they click "Accept" in the email, **then** their answer is recorded without an account, and an answer sent from their own calendar program updates the same participant.
- **Given** Ana needs a 45-minute meeting with five colleagues in three time zones next week and a room for six, **when** she asks for proposals, **then** she gets up to five options, each saying who is free, whose local time is early or late, which focus block it overlaps and which room is free (advanced).
- **Given** a manager who shares her calendar with her assistant at "respond on behalf", **when** the assistant accepts an invitation, **then** the organizer sees "accepted by the assistant on behalf of the manager"; her private events show only as "Private" to the assistant.
- **Given** a team calendar "Support rota" and the time-off layer switched on, **when** a lead opens the week, **then** she sees the team's events, approved time off and public holidays together, each layer only as far as she may see it.
- **Given** a booking page "Product demo" for the sales team with round-robin, a 15-minute buffer and payment off, **when** a visitor in New York books Thursday 11:00 their time, **then** the slot was checked again, the deal owner of the visitor's open deal was chosen because he was free, the event lands on his calendar with a meeting room, the visitor confirms by email and the event is linked to the lead created for them.
- **Given** a collective page with two hosts, **when** a visitor opens it, **then** only slots where both are free in their working hours, outside time off and outside synced busy times are offered.
- **Given** Ana's connected outside calendar in two-way mode, **when** she moves an event there, **then** it moves here within 5 minutes; **when** she adds an event here, **then** it appears there, without a second invitation to its participants.
- **Given** a deal page, **when** Ana schedules a meeting from it, **then** the deal's people are proposed as participants, the event is linked to the deal and appears on its events panel and timeline.
- **Given** a field visit assigned to a technician, **when** dispatch moves it, **then** the visit's event on the technician's calendar moves too and cannot be edited there except its reminders.
- **Given** a weekly focus goal of 8 hours in blocks of 2 hours, **when** the week starts, **then** focus blocks are placed in her free time and an organizer who invites over one is told (advanced).
- **Given** an attended 50-minute event linked to a project task, **when** it ends, **then** Ana is offered to log 50 minutes of tracked time on the task (advanced).

### 2.2 Edge cases & failures

- **Given** `FEATURE_CALENDAR` off, **then** every new route answers `404`, no calendar menu or panel shows, and appointments, availability, event types, booking pages and meeting notices behave exactly as today.
- **Given** a user without a share on a colleague's calendar, **then** free/busy shows blocks without titles; private events show "Private" to everyone except the owner.
- **Given** two users editing the same event, **then** the second save is refused with the current version and the changes made since.
- **Given** two visitors booking the last seat of a slot at once, **then** one gets it and the other is told "just taken" with fresh slots.
- **Given** a room that disallows overlaps and is already booked for one occurrence of a new series, **then** that occurrence is listed as a conflict, the others are confirmed, and the organizer may pick another room for it.
- **Given** a daylight-saving change between two occurrences, **then** the meeting stays at 09:00 local in the event's zone, and a participant in another zone sees the shifted local time.
- **Given** a rule "monthly on the 31st", **then** months without a 31st are skipped and the description says so.
- **Given** an outside calendar that is unreachable five times in a row, **then** the connection pauses, the owner is told with the last error, and reconnecting resumes without duplicates.
- **Given** the same event changed here and outside before a sync, **then** each field takes the later change, the other values stay in the history, and the event is marked "changed in both" when time, title or participants differ.
- **Given** an imported outside invitation, **then** no invitation is sent again by the platform; answering it sends a standard reply to the outside organizer.
- **Given** a scheduling message with an older sequence than the stored event, **then** it is ignored and logged.
- **Given** a booking unconfirmed after 60 minutes, **then** it expires, the slot frees and the guest is told.
- **Given** a payment that fails or is not made within 15 minutes, **then** the booking is cancelled and the slot frees (advanced).
- **Given** a team of 240 people added as participants, **then** the organizer is told only the first 100 can be expanded (setting) and asked to use a smaller group or the team calendar.
- **Given** a source feature that deletes its record, **then** its event is cancelled with notices; a person cannot delete a source-owned event from the calendar.
- **Given** an employee of kind agent, **then** it is shown as always available, gets no email invitation and no reminders.
- **Given** a subscribed address that resolves to an internal network address, **then** the fetch is refused and the subscription shows the reason.

## 3. Functional Requirements

### 3.1 Presence and existing appointments

- **FR-1** The system MUST load only when `GAUZY_CALENDAR_ENABLED` is exactly `true`, answer every new route with `404` while `FEATURE_CALENDAR` is off for the tenant, and show no new menu entry or panel.
- **FR-2** The system MUST keep appointments, availability slots, employee availability, event types, the public booking pages, meeting notices, meeting reminders and the invited-meetings list working as today with the feature on or off; an appointment is an event on its host's personal calendar and every event stays readable through the existing appointment routes.
- **FR-3** The system MUST send calendar invitations (FR-36) for events created or changed through the calendar, and keep the short appointment email for appointments written through the existing routes.
- **FR-4** The system MUST show a repeating event once on the existing appointment pages, at its first occurrence, marked as repeating and linked to the calendar.
- **FR-5** The system MUST tell any client which calendar capabilities the current user has (feature, sync adapters, meeting rooms, payment, resources, assistant) so clients show only what works.

### 3.2 Calendars

- **FR-6** The system MUST give every user a personal default calendar in their time zone on first use, holding the appointments they host as an employee.
- **FR-7** A user with `CALENDAR_EDIT` can create further personal calendars with name, colour, description, time zone, default reminders and whether its events make them busy (on by default); on team, organization and subscribed calendars only the events a person takes part in make them busy.
- **FR-8** A user with `CALENDAR_SHARED_MANAGE` can create team calendars (members of the team see them) and organization calendars (every member of the organization sees them) and name their managers.
- **FR-9** A user can show, hide, recolor and reorder any calendar they can see and choose the default calendar for new events; these choices are personal.
- **FR-10** A calendar manager can delete a calendar except a user's last personal one, after a confirmation stating the number of future events and participants affected; its future events are cancelled with notices, and the deletion can be undone for 30 days.
- **FR-11** A user who may write to several calendars can show one event on more of them (for example their own and a team calendar) without copying it.

### 3.3 Sharing and privacy

- **FR-12** A calendar manager can share a calendar with users, teams, roles or the organization at one level:

  | Level | Sees | May do |
  | --- | --- | --- |
  | Free/busy | busy blocks without titles | — |
  | Details | titles, places, participants, descriptions of non-private events | — |
  | Respond on behalf | as details | answer invitations, create and change events as the owner's delegate |
  | Edit own | as details | create events and change the ones they created |
  | Edit all | as details | create, change and cancel any non-private event |
  | Manage | as details | everything, including sharing and settings |

- **FR-13** The system MUST show members of the same organization each other's free/busy (organization setting, default on) and never more without a share.
- **FR-14** A user can mark an event private: everyone except the owner of its home calendar sees only "Private" with its time, and private events never appear in search, feeds, exports, record panels, capture or agent tools of other users.
- **FR-15** The system MUST apply sharing levels to every reader: pages, API, search, feeds, exports, reports, MCP tools and other features' requests.
- **FR-16** The system MUST mark invitations and answers made by a delegate as "on behalf of" the owner and record sharing changes in the audit trail.

### 3.4 Events

- **FR-17** A user who may write to a calendar can create an event with title, start and end each with a time zone (default the calendar's), all-day or timed, location, rich-text description (sanitised), show as (busy, free, tentative, away, working elsewhere), visibility (calendar default, public, private), colour, status (confirmed, tentative, cancelled), reminders, attachments, linked records and a meeting room.
- **FR-18** The system MUST refuse an end before the start, a timed event longer than 366 days, an unknown time zone and an all-day event with times, naming the field.
- **FR-19** The system MUST keep each time in its event's time zone, so local wall time holds across daylight-saving changes, and show times in the viewer's zone, naming the event's zone when it differs.
- **FR-20** A user can save an event as a draft, visible only to them and counted as free, and send it later.
- **FR-21** The system MUST refuse an update carrying an older version, returning the current event and the changes made since.
- **FR-22** A user can add a meeting room from `meetings` to an event (new or existing room); its join link appears on the event, in invitations and in reminders; without `meetings`, a typed link shows with a join action.
- **FR-23** A user can move and resize events by drag and drop, copy and duplicate them; attachments are files of `drive` (or the documents hub when `drive` is absent) readable to participants.
- **FR-24** The system MUST keep a history per event (who, when, before, after) and raise its sequence on every change participants must hear about (time, place, title, description, meeting room, participants, cancellation).
- **FR-25** The system MUST warn, never block, when a new or moved event overlaps busy time of the organizer or a required participant, naming the overlaps the viewer may see.

### 3.5 Recurrence

- **FR-26** A user can make an event repeat daily, weekly on chosen weekdays, monthly on a day of the month or on the nth or last weekday, or yearly, every N periods, ending never, on a date or after N occurrences, and read the rule in plain words in their language.
- **FR-27** The system MUST expand occurrences in the event's time zone, skip dates that do not exist in a period (and say so in the description), and refuse a rule that yields no occurrence.
- **FR-28** A user can change or cancel one occurrence, this and following occurrences (the series is split: the earlier part ends, a new series carries the change), or the whole series; a whole-series change keeps individually changed occurrences unless the user resets them, and the dialog states how many would be reset.
- **FR-29** The system MUST keep answers per occurrence when given for one occurrence and per series otherwise, and keep earlier answers on both parts of a split series.
- **FR-30** The system MUST tell participants and release resource bookings for occurrences that a rule change removes, listing the dates.
- **FR-31** The system MUST export and import repeating events in the iCalendar recurrence form, including cancelled and moved occurrences.

### 3.6 Participants, invitations and answers

- **FR-32** An organizer can add colleagues, whole teams (expanded to members up to 100, setting), people offered by other features' participant sources (a deal's people, an organisation's members, a saved view of people, a cohort, an interview panel), outside addresses and resources, mark each person required or optional, and name co-organizers; outside addresses an appointment already has are its outside guests, and the appointment's address list stays in step with them.
- **FR-33** The system MUST link the event to the record a participant came from when the participant source asks for it.
- **FR-34** An organizer can choose whether participants see the participant list, may invite others and may propose new times (defaults yes, no, yes).
- **FR-35** The system MUST send nothing until the organizer sends the event, and then send each participant an invitation once.
- **FR-36** The system MUST deliver invitations to colleagues as an in-app meeting notice and, per their preferences, email and push; and to outside guests as an email with times in the guest's zone when known, the join link, answer buttons and an iCalendar attachment with the standard scheduling method, from the organizer's sending identity in `email-and-communications` or the platform's sender.
- **FR-37** The system MUST send an update when the sequence rises, a cancellation to removed participants and on cancellation, and nothing for changes that concern only the organizer (colour, own reminders, calendar placement).
- **FR-38** A participant can accept, accept tentatively or decline, with a comment, for one occurrence or the series, from the calendar, the notice, the invitation email (signed buttons, no account needed) or another calendar program (a standard reply).
- **FR-39** A participant can propose another time with their answer; the organizer can accept a proposal, which updates the event, or dismiss it.
- **FR-40** The system MUST tell the organizer of answers and proposals per their preferences and show counts (accepted, tentative, declined, no answer) on the event.
- **FR-41** The system MUST show accepted and tentative events on the participant's calendar and in their busy time, hide declined ones unless "show declined" is on, and list invitations awaiting an answer for answering one by one or in bulk.
- **FR-42** The system MUST process standard scheduling messages received for a user's identity (FR-98) and handed over by mail: an outside invitation becomes an event on the receiver's default calendar marked as organised outside; a reply updates that participant's answer; a cancellation cancels the event; a message with an older sequence is ignored and logged.
- **FR-43** An organizer, or a participant when allowed, can forward an invitation to someone, who is added as optional.

### 3.7 Working hours, availability and free/busy

- **FR-44** The system MUST take a person's working hours from their published shifts when `attendance-and-shifts` is on, else from their availability slots, else from the organization's standard working week, in the person's time zone.
- **FR-45** A user can override their working hours for a date range and set a work location per day (office, remote, other), shown to colleagues; the overrides are their availability for those dates, edited here or on the existing schedules page, so booking pages and free/busy read the same hours. The schedules page shows the override and work-location fields only while the feature is on; with it off the page is as today.
- **FR-46** The system MUST compute a person's busy time from events they organize or accepted (tentative ones marked tentative) on calendars that count towards availability, approved time off and holidays of their holiday calendar (`time-off-management`), busy times of synced outside calendars, and busy blocks other features register; free, draft and declined events never count.
- **FR-47** A user can query free/busy for people and resources over up to 62 days and see busy, tentative, away, outside working hours, time off and holiday blocks, with titles only where their level allows.
- **FR-48** The system MUST treat employees of kind agent as always available and never send them email invitations or reminders.
- **FR-49** The system MUST answer free/busy and open-slot questions for booking pages, interview scheduling, visit dispatch, the scheduling assistant and other features from one rule set, so all of them agree.

### 3.8 Views

- **FR-50** The system MUST offer day, work week, week, month and agenda views, a month-picker with busy days marked by density, a date jump, today, previous and next, and an upcoming-events panel.
- **FR-51** The system MUST offer a scheduling view with up to 50 people or resources side by side (columns in a day, rows on a timeline across a week).
- **FR-52** A user can switch on read-only layers from other features, each within that feature's permissions: approved time off of their team, holidays of their holiday calendar, their shifts, tasks due assigned to them, field visits.
- **FR-53** A user can set week start (the organization's by default), working days shown, default view, time zone (their profile's time zone), a second time-zone column, and whether weekends, declined events and week numbers show.
- **FR-54** A user can create an event by selecting a time range, quick-add by typing a title, and open the full form.
- **FR-55** The system MUST update open views within 2 s when events the viewer may see change.
- **FR-56** The system MUST offer keyboard shortcuts for views, navigation and new event with a help list, and a phone-width layout of every calendar page.

### 3.9 Reminders

- **FR-57** A person can set up to five reminders per event before its start (minutes, hours or days; for all-day events at a time on an earlier day) by in-app notice, email or push, with defaults from the calendar; without their own reminders, colleagues keep their meeting reminder lead time.
- **FR-58** The system MUST send each reminder once per person, occurrence and offset, include place and join link, skip declined, cancelled and past occurrences, and re-arm reminders of moved events.
- **FR-59** An organizer can add email reminders for outside guests (default none; booking pages set their own).
- **FR-60** The platform's meeting reminders MUST also send the reminders of repeating events and the reminders set in the calendar (offsets, channels, outside guests), and leave the existing meeting reminders of other appointments unchanged.

### 3.10 Resources

- **FR-61** A user with `CALENDAR_RESOURCES_MANAGE` can maintain bookable resources: kind (room, equipment, vehicle, other), name, building, floor, place, capacity, features, time zone, opening hours, who may book (everyone, teams, roles), approval with approvers, maximum duration, booking horizon (default 365 days), buffers, whether overlaps are allowed, check-in required, and an optional link to an equipment record.
- **FR-62** The system MUST list resources with filters (kind, building, capacity at least, features, free between two times) and give each resource a calendar.
- **FR-63** A user with `CALENDAR_RESOURCES_BOOK` can add resources to an event; a booking is confirmed at once when the resource is free, open, within horizon and duration and the user may book it without approval; otherwise it is requested from the approvers or refused with the reason.
- **FR-64** The system MUST never confirm overlapping bookings of a resource that disallows overlaps, also under concurrent requests, for every occurrence within the horizon; occurrences beyond it are booked when they come into range and conflicts found then are reported to the organizer.
- **FR-65** An approver can approve or decline a requested booking with a reason; the organizer is told; a request still open at the start expires.
- **FR-66** The system MUST warn when participants exceed a room's capacity.
- **FR-67** (advanced) The system MUST release a check-in room when nobody checks in within 10 minutes (setting) of the start, telling the organizer, and offer check-in from the event, a reminder and a room display page.
- **FR-68** The system MUST keep equipment lending unchanged and show a linked equipment item's lending periods as busy on its resource calendar; booking a resource linked to an equipment item makes a lending request of that item for the occurrence, approved under the item's lending policy, so lending stays the one record of who has the item; rooms, vehicles and other resources are booked by the calendar.

### 3.11 Appointment types and booking pages

- **FR-69** A user with `EVENT_TYPES_EDIT` can give an appointment type (the existing event type): a page address, location kind (in person with address, phone, meeting room, custom), minimum notice, days ahead, slot interval, buffers before and after, daily limit, its own weekly schedule or the hosts' working hours, intake questions (short text, long text, choice, checkbox, phone; required or not), email confirmation (default on for public pages), expiry of unconfirmed bookings (default 60 minutes) and its effect (cancel or keep unconfirmed), cancellation cut-off (default 24 hours), the text or address shown after booking, colour, the calendar bookings go to and guest reminders.
- **FR-70** The system MUST give new fields defaults that keep today's booking pages behaving as before: the defaults named in FR-69 (email confirmation, expiry, cancellation cut-off) are proposed for types created with the feature on, while an existing type keeps today's behaviour (no confirmation step, no expiry, no cut-off) until a user sets the field.
- **FR-71** (advanced) A user with `CALENDAR_BOOKING_PAGES_MANAGE` can publish a type for several hosts of a team or the organization with an assignment: guest chooses the host, round-robin, collective (all hosts free and attending), or group (one host, a number of seats per slot).
- **FR-72** (advanced) The system MUST assign round-robin bookings to the owner of the guest's open lead or deal when that owner is a host and free, else to the free host with the fewest bookings of the type in the last 30 days weighted by host weight, ties to the longest since a booking; a reschedule reassigns when the host is no longer free.
- **FR-73** The system MUST offer only slots beyond the minimum notice, within the days ahead, on the slot grid, inside the schedule or working hours, outside holidays and time off, free in the hosts' calendars including synced busy times and buffers, under the daily limit, free for all hosts (collective) or with seats left (group), and show them in the guest's detected time zone, which the guest can change.
- **FR-74** The system MUST check the chosen slot again at booking under a lock per host and resource, and answer the second of two concurrent guests "just taken" with fresh slots.
- **FR-75** The system MUST create the booking as an event on the host's booking calendar with the guest as participant, the answers in the description and a meeting room when the type has one, and send the guest a confirmation, or a confirmation request whose link expires, with an iCalendar attachment and links to reschedule or cancel; unconfirmed bookings hold their slot until expiry.
- **FR-76** The system MUST match the guest by address to an existing contact or person, else, when the type creates leads (setting, default off), hand the guest to the intake of `lead-capture-and-enrichment` with the booking as reference (else create a contact of type lead), and link the event to the matched or created record and to its open deal with the host.
- **FR-77** A guest can reschedule or cancel through the signed link before the cut-off; host and guest are told; a reschedule keeps the links; the links are the appointment's signed links, so links sent by today's booking emails keep working.
- **FR-78** (advanced) A user can require payment before confirmation through `payment-gateways` at the type's price and currency; an unpaid booking holds its slot for 15 minutes and is then cancelled; a cancellation before the cut-off is refunded in full, after it not at all (type setting).
- **FR-79** The system MUST serve booking pages as public pages with the organization's logo and colours, as a direct link per type and host, and as an embeddable block for the organization's own site.
- **FR-80** The system MUST throttle public booking and confirmation requests per address and network and accept bookings only on published types.
- **FR-81** A host can list their bookings with answers, filter them, and mark a past booking as a no-show.
- **FR-82** The system MUST publish "linked event today" each morning for events linked to a lead or deal and ship an automation template, off by default, that moves the linked lead or deal back to an open stage.

### 3.12 Events on records and other features' events

- **FR-83** A user can link an event to records they may read (contact, lead, deal, organisation, person, project, task, ticket, candidate or any registered record type) and schedule an event from a record with its people proposed and the record linked.
- **FR-84** The system MUST show events linked to a record on its events panel (upcoming and past) and timeline only to viewers who may read the record and the event; a private event is listed there only for its owner (FR-14).
- **FR-85** The system MUST let other features own events of their records (field visits, interview rounds, live classes, one-to-ones): created, changed and cancelled by the source, the source's fields read-only in the calendar with a link back, and cancelled when the source record is deleted.
- **FR-86** The system MUST tell the source feature of participants' answers to its events, so it can react.
- **FR-87** The system MUST keep links when records are merged and remove a link, not the event, when a linked record is deleted.

### 3.13 External sync, feeds, import and export

- **FR-88** A user with `CALENDAR_SYNC_CONNECT` can connect an outside calendar account through a sync adapter: the standard calendar access protocol (server address, user name, app password kept encrypted) shipped with the feature, or a provider adapter plugin signed in through a connected account of `integration-hub`; the outside calendars are then listed for choosing.
- **FR-89** For each chosen outside calendar, a user picks the direction (two-way, into the platform, out of the platform, busy times only) and the platform calendar it maps to (an existing one or a new subscribed calendar).
- **FR-90** The system MUST sync changes both ways within 5 minutes, and within 1 minute where the adapter pushes notices, incrementally where the adapter allows, matching events by their iCalendar identity, including recurrence, exceptions, participants, answers, reminders where the outside side keeps them, and the meeting link.
- **FR-91** The system MUST resolve concurrent changes field by field to the later change, keep the other values in the history, and mark the event "changed in both" for review when time, title or participants differ.
- **FR-92** The system MUST never re-send invitations for events that came from outside, and send invitations for exported events only from the side that organizes them.
- **FR-93** A user can subscribe to an outside iCalendar address as a read-only calendar refreshed hourly (setting, minimum 15 minutes) through the platform's internal-address guard.
- **FR-94** A user can create private feed addresses for one or all of their calendars, with details or free/busy only, and revoke them; feeds never carry private details.
- **FR-95** A user can import an iCalendar file of up to 10,000 events into a calendar after a preview (new, updated by identity, skipped, errors), run in the background with a result file, and export a calendar or a date range as an iCalendar file; both are runs of the platform's data import and export, listed with the organization's other runs.
- **FR-96** The system MUST pause a connection after five consecutive failures (setting), tell its owner with the last error, resume after reconnection without duplicates, and on disconnection let the owner keep or remove the imported events.
- **FR-97** The system MUST offer each user the standard calendar access protocol on the platform for their calendars, authenticated by a personal key of `access-control-and-security` scoped to calendars, and show the settings to enter in a desktop or phone calendar program.

### 3.14 Identities and search

- **FR-98** The system MUST treat as a user's own addresses their sign-in address, the addresses of their mailboxes and their sending identities of `email-and-communications` (connected accounts included), and let them choose among those identities the one invitations come from; answers and invitations to any of them are recognised as theirs.
- **FR-99** A user can search events of calendars they can see by title, description, place, participant and linked record, filtered by calendar, answer, period and linked record type, ranked by closeness to today with repeating events at their nearest occurrence; events also appear in global search within the same rights.

### 3.15 Scheduling assistant `(advanced)`

- **FR-100** (advanced) A user can ask for proposed times for participants (required and optional), named resources or a resource need (kind, capacity, building), a duration, a window and constraints (working hours only, earliest and latest local time, keep focus time, avoid meeting-free times); the system returns up to five options, each listing who is free, who would be outside working hours or early or late locally, which tentative events or focus blocks it overlaps and which resource is free.
- **FR-101** (advanced) The system MUST rank options with all required participants free first, then fewest optional conflicts, then least out-of-hours burden, then least fragmentation of free time, then earliest, and explain each option's trade-off in one sentence.
- **FR-102** (advanced) For a repeating meeting across time zones, the assistant can propose rotating times that share the inconvenience and show per person how many occurrences fall outside their hours.

### 3.16 Focus time, meeting load and the discussion check `(advanced)`

- **FR-103** (advanced) A user can set a weekly focus goal (hours, minimum block, preferred times); the system proposes focus blocks in free time each week and, when the user allows, places them as busy events marked focus, moves them when needed, never below the goal, and flags invitations over them to the organizer.
- **FR-104** (advanced) The system MUST compute per person and week meeting hours, focus hours, short gaps (free gaps under 30 minutes), after-hours meeting time, repeating-meeting hours and decline rate; each person sees their own; managers see team figures only for groups of three or more and per person only where the organization allows it (default off).
- **FR-105** (advanced) The system MUST show a team meeting-load dashboard with trends and the repeating series costing the most person-hours, suggesting series with an average acceptance under 50 % for review.
- **FR-106** (advanced) Before sending an event with four or more participants (setting) and neither agenda nor linked record, the system MUST ask whether it could be a discussion and offer to start one in `discussions` or a chat thread with the same people; the organizer can always continue, and the question comes once per series.
- **FR-107** (advanced) A user with `CALENDAR_SETTINGS_MANAGE` can set organization meeting-free times; organizers are warned when scheduling in them and the assistant avoids them.

### 3.17 Tracked time and agents `(advanced)`

- **FR-108** (advanced) The system MUST offer, after an attended event linked to a task or project, to log its duration (or the time attended when `meetings` reports it) as the person's tracked time on it (setting offer, always, never; default offer), as one time entry marked as from the calendar; a meeting session linked to a task or project without an event gets the same single offer from its attendance.
- **FR-109** (advanced) The system MUST offer MCP and in-app assistant tools to list and read events, query free/busy, propose times, create, change and cancel events (preview first), answer invitations, book resources and list bookings; agents act within the user's rights and sharing, and an agent sends invitations only after the user confirms unless the user allowed it to send.

### 3.18 API, events, other features and reports

- **FR-110** The system MUST expose every capability through REST with cursor pagination and idempotency keys on creating routes, with GraphQL reads of calendars, events and bookings.
- **FR-111** The system MUST offer other features one contract to create, change and cancel source-owned events, register participant sources, busy blocks and layers, ask free/busy and open slots, hear answers, and read the events a user allowed to be captured as CRM activity.
- **FR-112** The system MUST publish, with ids only, as automation triggers and webhook events: event created, changed, cancelled, started, ended, answer changed, time proposed; booking created, confirmed, rescheduled, cancelled, expired, paid; resource booking requested, decided, released; sync connection failed.
- **FR-113** The system MUST record who, when, before and after for calendar, sharing, event, resource, type and connection changes, and mark changes made by an agent as made on behalf of the confirming user.
- **FR-114** The system MUST register these report definitions (filters period, calendar, team, host, type, resource; table and chart; export and schedules through the report builder, a read-only view without it):

  | Report | Answers |
  | --- | --- |
  | Bookings | bookings, confirmations, cancellations, no-shows and paid amounts per type, host and week |
  | Host load | bookings and booked hours per host against their working hours |
  | Resource use | booked and checked-in hours, releases and refusals per resource and building |
  | Answers | answer rates and time to answer per organizer and team |
  | Meeting load (advanced) | meeting, focus and after-hours time per team and week (FR-104 privacy) |
  | Sync health | connections, failures, paused connections and lag per adapter |

## 4. Non-Functional Requirements

- **Performance**: week view of 10 calendars P95 < 300 ms at 5 million events per tenant; free/busy for 50 people over 14 days P95 < 500 ms; booking page slots for 60 days P95 < 400 ms; a confirmed booking or event save P95 < 400 ms excluding emails; expansion capped at 1,000 occurrences per request; sync lag as FR-90.
- **Volume and concurrency**: 20,000 users, 5,000 resources and 2,000 booking types per tenant; one winner per resource slot and per booking seat under concurrent requests; idempotent scheduling messages per sequence and identity.
- **Reliability**: invitations, updates and reminders queued and retried for 24 hours; sync and feed jobs catch up after downtime; busy times rebuilt from events after a failure.
- **Security & privacy**: sharing levels enforced on every reader (FR-15); private events never leave the owner's view; signed answer and booking links are single-purpose and expire with the event; feed and protocol keys stored hashed and revocable; outside fetches guarded against internal addresses; public pages throttled. Leaving the platform: invitation and booking emails (titles, times, places, participants, join links) to participants' addresses; events to outside calendars a user connected; feeds to whoever holds the address; payment data to the payment provider.
- **Auditability**: per FR-113, plus booking state changes and approvals of resource bookings.
- **Accessibility and localization**: calendar grid and scheduling view operable by keyboard with announced dates, times and events; colours never the only signal; rule descriptions, dates and week start in the user's locale; every string in all shipped locales; booking pages in the guest's language when shipped.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted (adapter push notices need a public address, otherwise polling); works without CRM, meetings, payments, shifts, time off and lead capture, whose parts are then absent; OpenAPI and SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Calendar | A named set of events of a person, team, organization, resource or outside source |
| Calendar share | A level of access given to a user, team, role or the organization |
| Event | An appointment extended with calendar, time zones, all-day span, privacy, show-as, sequence and links |
| Series, occurrence, exception | A repeating event, one of its dates, a changed or cancelled date |
| Participant | A colleague, outside guest or person of a record invited to an event, with role and answer |
| Resource, resource booking | A bookable room, item or vehicle; its reservation for an event occurrence |
| Busy block | A time a person or resource is not free, derived from events and outside calendars |
| Appointment type | The existing event type extended with booking rules, questions, hosts and assignment |
| Booking | A guest's reservation through a booking page, with answers, state and links |
| Sync connection, sync link | An outside calendar account; one outside calendar mapped to a platform calendar |
| Feed | A private address serving a calendar as iCalendar |
| Calendar identity | An address a user receives invitations and answers under: the sign-in address, a mailbox address or a sending identity |
| Focus goal, load figures | A person's weekly focus target; weekly meeting and focus figures per person |

## 6. Out of Scope

- Meeting rooms, media, recording, transcripts, agendas and summaries → `meetings` (FR-22 attaches its rooms).
- Invitation banners and answering from a message in the mail client → `mail` (FR-42 processes the messages it hands over).
- Calendar layout of record lists → `record-views-and-search`; holiday calendars and time-off feeds → `time-off-management`; service calendars → `helpdesk-sla-routing-and-analytics`; shifts, rosters and shift feeds → `attendance-and-shifts`; work-centre calendars → `shop-floor-and-work-orders`.
- Connected accounts, provider sign-in, the connector kit and address-book sync → `integration-hub`.
- Notification channels, preferences and the daily agenda digest → `automation-and-notifications`.
- Online payment and refunds → `payment-gateways`; lead rules → `lead-capture-and-enrichment`; CRM activity capture rules → `crm-engagement`.
- Ever Teams calendar screens → the Ever Teams spec `workspace-collaboration-clients`; discussions → `discussions`; chat threads → `chat-messaging`; files → `drive`.

## 7. Acceptance Criteria

- [ ] **AC-1** With `FEATURE_CALENDAR` off every new route answers `404`, and appointments, availability, event types, booking pages, notices and reminders pass their existing tests unchanged (FR-1, FR-2).
- [ ] **AC-2** On enabling, an employee's appointments show on their personal calendar; a repeating event shows once, marked, on the appointment pages (FR-2, FR-4, FR-6).
- [ ] **AC-3** Sharing at each level of FR-12 shows and allows exactly the matrix; private events show "Private" with their time to everyone but the owner in calendar pages, free/busy and API reads, and never appear in search, feeds, exports, record panels or MCP tools of other users (FR-14).
- [ ] **AC-4** A weekly 09:00 series in one zone stays at 09:00 local across a daylight-saving change; "monthly on the 31st" skips short months; the plain-words rule matches in two locales (FR-19, FR-27).
- [ ] **AC-5** "This and following" splits a series with answers kept on both parts and one update sent; a whole-series change keeps changed occurrences unless reset (FR-28, FR-29).
- [ ] **AC-6** Invitations reach colleagues as notices and guests as email with an iCalendar attachment; a guest answers by signed link and by a standard reply; an older-sequence message is ignored (FR-36–FR-38).
- [ ] **AC-7** An outside invitation handed over by mail becomes an event on the receiver's calendar; answering it sends a standard reply (FR-42).
- [ ] **AC-8** Free/busy for 50 people over 14 days returns in under 500 ms on the demo data and includes time off, holidays and synced busy times without titles where not shared (FR-47).
- [ ] **AC-9** Two concurrent bookings of a no-overlap room for the same occurrence confirm exactly one on all three databases; a series reports its conflicting occurrence (FR-29, FR-64).
- [ ] **AC-10** An approval-required room is requested, approved and the organizer told; a check-in room without check-in is released after 10 minutes (advanced: release; FR-65, FR-67).
- [ ] **AC-11** Existing booking pages behave as before; an extended type enforces notice, horizon, buffers, daily limit, holidays and time off in its slots (FR-69, FR-73).
- [ ] **AC-12** Round-robin picks the deal owner when free, else the least-booked host; collective offers only common free slots; group stops at its seats; two concurrent guests get one slot and one "just taken" (advanced: booking types; FR-71, FR-72, FR-74).
- [ ] **AC-13** A booking creates the event, a lead or link to the existing contact, a confirmation email with expiry, and expiry frees the slot; a paid type cancels unpaid bookings after 15 minutes and refunds before the cut-off (advanced: payment; FR-75, FR-76, FR-78).
- [ ] **AC-14** An event scheduled from a deal links to it and shows on its panel and timeline only for readers of both (FR-83, FR-84).
- [ ] **AC-15** A source-owned visit event follows its visit and refuses edits of source fields in the calendar (FR-85, FR-86).
- [ ] **AC-16** Two-way sync with the simulated adapter and with a standard-protocol test server moves changes both ways within the stated lag, without duplicate invitations; a concurrent change is merged and marked; five failures pause the connection (FR-88, FR-90, FR-91, FR-96).
- [ ] **AC-17** Feeds, subscriptions, import with preview and export round-trip a repeating event with exceptions; an internal subscription address is refused (FR-93, FR-95).
- [ ] **AC-18** The scheduling assistant returns ranked options with one-sentence trade-offs for five people across three zones and a room (advanced: assistant; FR-101).
- [ ] **AC-19** Focus blocks are placed to the goal and flagged to organizers; load figures appear for a team of three and are withheld for a team of two; the discussion check asks once per series (advanced: focus and load; FR-103, FR-105–FR-107).
- [ ] **AC-20** An attended linked event logs tracked time on confirmation (advanced: tracked time; FR-108).
- [ ] **AC-21** Every MCP tool of FR-109 answers within the caller's rights; previews write nothing; an agent's invitation waits for confirmation.
- [ ] **AC-22** The six report definitions of FR-114 return the expected figures on the demo data set.
- [ ] **AC-23** Calendar pages pass keyboard and screen-reader checks; everything works on PostgreSQL, MySQL and SQLite with both ORMs; every functional requirement has a passing test (FR-56; §4).
- [ ] **AC-24** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1, FR-2).

## 8. Open Questions

- Which provider sync adapters to build first. Applied default: the adapter contract, the standard-protocol adapter, iCalendar subscriptions and a simulated adapter ship; each provider adapter is a separate plugin.
- Free/busy visible to every member of the organization (FR-13). Applied default: on; an organization can switch it off.
- The platform-side standard calendar protocol (FR-97) ships in the last phase. Applied default.
- Round-robin rule (FR-72). Applied default; weights per host allow other policies later.
- Booking refunds by cut-off only (FR-78). Applied default; partial refunds would need a policy table.
- Team expansion limit of 100 (FR-32) and room release after 10 minutes (FR-67). Applied defaults, both settings.
- Users without an employee record get personal calendars but cannot host booking pages. Applied default.
- Ever Teams' calendar page is its working time-log calendar (month view, time grid, moving and splitting time entries) and stays so; this feature's event routes let its client spec show events as a layer on that page. Applied default.

## 9. Constitution Gates

- [x] I Plugin-first — new `packages/plugins/calendar`, `calendar-ui`, `calendar-react-ui`; sync adapters as plugins; core appointment entities gain additive columns only.
- [x] II Tenant/organization scoping — every record carries tenant and organization; public pages and feeds resolve the tenant from signed tokens only.
- [x] III Both ORMs, additive migrations — new tables and nullable columns, three dialects.
- [x] IV Default-off flag; nothing removed — deploy flag and `FEATURE_CALENDAR` off; appointment routes, pages and reminders unchanged.
- [x] V Contracts and API first — contracts, REST and the adapter and source contracts before UI.
- [x] VI Permissions, privacy, security — new keys plus the existing appointment keys; sharing levels, private events, signed links, hashed feed keys, guarded fetches.
- [x] VII Real-time through the event bus — outbox events and change hints on the platform channel.
- [x] VIII i18n and accessibility — keyboard grid, announced events, keys in every locale.
- [x] IX Tests accompany the change — unit tests of recurrence, time zones, slots and ranking; e2e for booking and sync.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Used by: [`../maintenance-and-field-service/spec.md`](../maintenance-and-field-service/spec.md), [`../recruitment/spec.md`](../recruitment/spec.md), [`../learning-management/spec.md`](../learning-management/spec.md), [`../crm-engagement/spec.md`](../crm-engagement/spec.md), [`../attendance-and-shifts/spec.md`](../attendance-and-shifts/spec.md), [`../time-off-management/spec.md`](../time-off-management/spec.md), [`../performance-management/spec.md`](../performance-management/spec.md), `meetings`, `mail`
- Works with: [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md), [`../integration-hub/spec.md`](../integration-hub/spec.md), [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md), [`../email-and-communications/spec.md`](../email-and-communications/spec.md), [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md), [`../helpdesk-sla-routing-and-analytics/spec.md`](../helpdesk-sla-routing-and-analytics/spec.md), [`../payment-gateways/spec.md`](../payment-gateways/spec.md), [`../lead-capture-and-enrichment/spec.md`](../lead-capture-and-enrichment/spec.md), `drive`, `discussions`
- Code: `packages/core/src/lib/employee-appointment/` (incl. `meeting-notifications/`), `appointment-employees/`, `availability-slots/`, `employee-availability/`, `event-types/`, `equipment-sharing/`, `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`, `packages/ui-core/shared/src/lib/appointments/`, `apps/gauzy/src/app/pages/employees/{appointment,schedules,event-types}`
