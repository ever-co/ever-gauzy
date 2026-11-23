# Task Breakdown: Calendar and Scheduling

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `calendar-and-scheduling`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold. A path that does not start with `packages/`, `apps/`
  or `docs/` is inside `packages/plugins/calendar/src/lib/`; every entity file there has its
  `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts` beside it, and every
  controller its `dto/` folder. Angular files of `calendar-ui` are under `packages/plugins/calendar-ui/src/lib/`.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_CALENDAR_ENABLED` and `FEATURE_CALENDAR`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it.
- Plan phase 1 = T1–T20, T36, T38, T41, T65–T69; phase 2 = T21–T30, T46, T47, T59–T61 and the answer page of T39; phase 3 =
  T31–T35, T37, T40 and the booking pages of T39; phase 4 = T42–T45, T62, T63; phase 5 = T48–T58, T64.
- Depends on, each behind a port with the fallback of plan §7: meeting rooms (`meetings`), sender
  (`email-and-communications`), notifications (`automation-and-notifications`), connected accounts and the connector kit
  (`integration-hub`), time off and holidays (`time-off-management`), shifts (`attendance-and-shifts`), checkout
  (`payment-gateways`), lead intake (`lead-capture-and-enrichment`), record rules (`access-control-and-security`),
  timeline and record page extension points (`record-views-and-search`).

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/calendar.model.ts` (plan §3: enums, calendar, share, event,
  occurrence, participant, resource, booking, free/busy, slots, proposals, sync adapter, port tokens); optional fields on
  `packages/contracts/src/lib/employee-appointment.model.ts`, `packages/contracts/src/lib/event-type.model.ts`,
  `packages/contracts/src/lib/employee-availability.model.ts` and `IIntegrationMap` in
  `packages/contracts/src/lib/integration.model.ts`; `ICalendarUiPreferences` in `packages/contracts/src/lib/user.model.ts`;
  `CalendarAnswer` in `EmployeeNotificationTypeEnum` of `packages/contracts/src/lib/employee-notification.model.ts`;
  export from `packages/contracts/src/index.ts`. Test: `packages/contracts/src/lib/calendar.model.spec.ts` (enum values
  and type guards).
- [ ] **T2**. Plugin scaffold `packages/plugins/calendar` (`package.json`, `project.json`, `tsconfig.json`,
  `tsconfig.lib.json`, `jest.config.ts`, `.eslintrc.json`, `src/index.ts`), `calendar.plugin.ts`, `calendar.module.ts`,
  `calendar-schedule.plugin.ts`, `calendar-enabled.ts` (exact `true`), `calendar.features.ts` (`FEATURE_CALENDAR`,
  default off); conditional entries in `apps/api/src/plugins.ts` and `apps/worker/src/plugins.ts`. Test:
  `apps/api/src/plugins.matrix.spec.ts` and `apps/worker/src/plugins.spec.ts` list the plugin only when
  `GAUZY_CALENDAR_ENABLED` is exactly `true`; `calendar-enabled.spec.ts`.
- [ ] **T3**. Core migration `packages/core/src/lib/database/migrations/1791000061900-ExtendAppointmentsForCalendar.ts`
  and the new optional columns on `EmployeeAppointment`, `AppointmentEmployee`, `EventType`, `EmployeeAppointmentReminder`
  (offset, channel, guest key, the non-null `claimKey` with its unique index replacing
  `IDX_employee_appointment_reminder_key`, backfilled for existing claims), `EmployeeAvailability` (`workLocation`) and `IntegrationMap`
  (`remoteVersion`, `syncState`) (MultiORM, both repositories). Files:
  `packages/core/src/lib/employee-appointment/employee-appointment.entity.ts`,
  `packages/core/src/lib/appointment-employees/appointment-employees.entity.ts`,
  `packages/core/src/lib/event-types/event-type.entity.ts`,
  `packages/core/src/lib/employee-appointment/meeting-notifications/employee-appointment-reminder.entity.ts`,
  `packages/core/src/lib/employee-availability/employee-availability.entity.ts`,
  `packages/core/src/lib/integration-map/integration-map.entity.ts`. Test:
  `packages/core/src/lib/database/extend-appointments-for-calendar-migration.spec.ts` on SQLite (up twice is a no-op;
  existing claims get their `claimKey`; every declared `answer` and `syncState` value is stored unchanged);
  existing `employee-appointment.resolver.spec.ts`, `appointment-employees.resolver.spec.ts`,
  `employee-availability.resolver.spec.ts`, `event-type.resolver.spec.ts` and
  `packages/core/src/lib/database/employee-appointment-reminder-migration.spec.ts` unchanged and green.
  Migration timestamps: `1791000061900` to `1791000061999` (`packages/core`).
- [ ] **T4**. Entities for calendars, shares, user settings, placements; migration on the shared core migration helpers of `procurement` T4 (`@gauzy/core`):
  `1791000061100-CreateCalendarTables`. Files: `calendars/calendar.entity.ts`, `calendars/calendar-user-setting.entity.ts`,
  `calendars/calendar-event-placement.entity.ts`, `sharing/calendar-share.entity.ts`,
  `database/migrations/1791000061100-CreateCalendarTables.ts`, `database/calendar-migrations.ts` (listed only with
  `GAUZY_CALENDAR_ENABLED`). Test: `database/calendar-migrations.spec.ts` (tables and indexes on SQLite; up twice is a
  no-op). Migration timestamps: `1791000061100` to `1791000061199` (`packages/plugins/calendar`).
- [ ] **T5** (parallel). Entities for guests, occurrence answers, links; migration
  `1791000061110-CreateCalendarParticipationTables` (record links are core `resource_link` rows, no table here). Files:
  `participants/calendar-guest.entity.ts`, `participants/calendar-occurrence-answer.entity.ts`,
  `database/migrations/1791000061110-CreateCalendarParticipationTables.ts`. Test: `database/calendar-migrations.spec.ts`.
- [ ] **T6** (parallel). Entities for resources, resource bookings, busy blocks; migration
  `1791000061120-CreateCalendarResourceTables`. Files: `resources/calendar-resource.entity.ts`,
  `resources/calendar-resource-booking.entity.ts`, `availability/calendar-busy-block.entity.ts`,
  `database/migrations/1791000061120-CreateCalendarResourceTables.ts`. Test: `database/calendar-migrations.spec.ts`.
- [ ] **T7** (parallel). Entities for bookings and booking hosts; migration `1791000061130-CreateCalendarBookingTables`.
  Files: `booking/calendar-booking.entity.ts`, `booking/calendar-booking-host.entity.ts`,
  `database/migrations/1791000061130-CreateCalendarBookingTables.ts`. Test: `database/calendar-migrations.spec.ts`.
- [ ] **T8** (parallel). Entities for sync connections, links, feeds; migration `1791000061140-CreateCalendarSyncTables`.
  Files: `sync/calendar-sync-connection.entity.ts`, `sync/calendar-sync-link.entity.ts`, `feeds/calendar-feed.entity.ts`,
  `database/migrations/1791000061140-CreateCalendarSyncTables.ts`. Test: `database/calendar-migrations.spec.ts`.
- [ ] **T9** (parallel). Entities for load weeks and time offers; migration `1791000061150-CreateCalendarInsightTables`.
  Files: `insights/calendar-load-week.entity.ts`, `insights/calendar-time-offer.entity.ts`,
  `database/migrations/1791000061150-CreateCalendarInsightTables.ts`. Test: `database/calendar-migrations.spec.ts`.
- [ ] **T10**. Permissions `calendar.permissions.ts` as plugin contributions with `defaultFor` (no seed migration);
  organization settings declared in `calendar.settings.ts` (platform settings store). Test: `calendar.permissions.spec.ts`
  (grants for a new and an existing tenant); `calendar.settings.spec.ts` (declared defaults answered without stored values).

## Phase 2 — Services, endpoints, events

- [ ] **T11**. Recurrence on the core module `packages/core/src/lib/recurrence/` of `business-document-engine` T62: weekday lists, nth and last weekday,
  counts, exceptions, expansion in a time zone, splits and plain words (i18n keys), without changing its existing
  cadences; the calendar's `ical/` maps these rules to and from the iCalendar form. Files:
  `packages/core/src/lib/recurrence/recurrence-weekday.rules.ts`, `packages/core/src/lib/recurrence/recurrence-expand.ts`,
  `packages/core/src/lib/recurrence/recurrence-describe.ts`, `ical/ical-recurrence.mapper.ts`. Test:
  `packages/core/src/lib/recurrence/recurrence-expand.spec.ts` (property tests across offset changes; month-end skips;
  empty rules refused), `packages/core/src/lib/recurrence/recurrence-describe.spec.ts` (two locales),
  `ical/ical-recurrence.mapper.spec.ts`; existing `packages/core/src/lib/invoice-schedule/invoice-schedule.rules.spec.ts`
  unchanged.
- [ ] **T12**. Calendars and sharing `calendars/calendar.service.ts`, `sharing/calendar-access.service.ts` (levels,
  organization free/busy default, private filtering), controllers with default personal calendar creation and soft
  delete with undo. Files: `calendars/calendar.controller.ts`, `calendars/calendar-user-setting.service.ts` (personal
  show, colour and order), `sharing/calendar-share.service.ts`, `sharing/calendar-share.controller.ts`. Test:
  `sharing/calendar-access.service.spec.ts` (FR-12 matrix per level; private events across readers: the owner and an
  invited participant see the details, a reader of either calendar through a share sees "Private");
  `calendars/calendar.service.spec.ts` (a default personal calendar on first use holds the user's hosted appointments;
  the last personal calendar cannot be deleted; undo within 30 days).
- [ ] **T13**. Events `events/calendar-event.service.ts` over the core appointment entities (validation, versions,
  sequence rules, history, placements, drafts, overlap warnings) and controller with `expand` reads. Files:
  `events/calendar-event.controller.ts`, `events/calendar-event-history.service.ts`, `events/calendar-event.validation.ts`.
  Test: `events/calendar-event.service.spec.ts` (refusals of FR-18; version conflict; sequence rises only on
  participant-relevant changes; a draft sends nothing).
- [ ] **T14**. Entity subscriber `events/appointment.subscriber.ts` (enqueue busy rebuild and sync for writes through the
  existing routes, sequence bump) and the "repeats" mark in `packages/ui-core/shared/src/lib/appointments/appointment-calendar`.
  Files: `events/appointment.subscriber.ts`,
  `packages/ui-core/shared/src/lib/appointments/appointment-calendar/appointment-calendar.component.ts`. Test:
  `events/appointment.subscriber.spec.ts` (a legacy update rebuilds busy blocks; a repeating event shows once, marked);
  legacy appointment tests green.
- [ ] **T15**. Working hours and busy time `availability/working-hours.service.ts` (shifts, weekly and date-specific
  availability slots as overrides, `employee_availability.workLocation`, organization week),
  `availability/busy-blocks.service.ts` (rebuild, roll, enable-time build, `registerCalendarBusySources`), time-off,
  holiday and shift adapters with core fallbacks; date overrides and work location on the existing schedules page while
  `FEATURE_CALENDAR` is on. Files: `availability/working-hours.controller.ts`, `availability/sources/time-off.source.ts`,
  `availability/sources/holidays.source.ts`, `availability/sources/shifts.source.ts`,
  `apps/gauzy/src/app/pages/employees/schedules/availability-slots/availability-slots.component.ts` and its `.html`.
  Test: `availability/working-hours.service.spec.ts` and `availability/busy-blocks.service.spec.ts` (each source and
  fallback; agents always available); `availability-slots.component.spec.ts` (an override made on the schedules page
  changes booking slots; with the feature off the schedules page renders as today).
- [ ] **T16**. Free/busy and open slots `availability/free-busy.service.ts`, `availability/slots.service.ts` (one rule set,
  `CALENDAR_AVAILABILITY` binding). Files: `availability/free-busy.controller.ts` (`/calendar/free-busy`,
  `/calendar/slots`), `availability/calendar-availability.port.ts`. Test: `availability/free-busy.service.spec.ts` (50
  people over 14 days under the budget on a generated set of the demo data's size; titles hidden by level);
  `availability/slots.service.spec.ts`.
- [ ] **T17**. Layers registry `views/calendar-layers.registry.ts` (`registerCalendarLayers`) with time off, holidays,
  shifts, tasks due and field visits entries; layers route. Files: `views/calendar-layers.controller.ts`,
  `views/layers/time-off.layer.ts`, `views/layers/holidays.layer.ts`, `views/layers/shifts.layer.ts`,
  `views/layers/tasks-due.layer.ts`, `views/layers/field-visits.layer.ts`. Test: `views/calendar-layers.registry.spec.ts`
  (each layer respects its source's rights).
- [ ] **T18**. Reminders on the core sweep: `reminderOffsets` written by `reminders/calendar-reminder.service.ts`; core
  `meeting-reminder.service.ts` extended with per-event and per-participant offsets, channels, outside guests and
  occurrences of repeating events (core recurrence), claimed on the widened key, registered whenever the calendar feature
  is on. Files: `reminders/calendar-reminder.controller.ts` (`/reminders/me`, `/guest-reminders`),
  `packages/core/src/lib/employee-appointment/meeting-notifications/meeting-reminder.service.ts`,
  `packages/core/src/lib/employee-appointment/meeting-notifications/meeting-reminder-enabled.ts`. Test:
  `reminders/calendar-reminder.service.spec.ts` and
  `packages/core/src/lib/employee-appointment/meeting-notifications/meeting-reminder.service.sqlite.spec.ts` (one reminder
  per person, occurrence, offset and channel; two sweeps racing on a colleague claim and on a guest claim with null
  offset and channel file one notification each; moved event re-armed; declined skipped; plain appointment reminders
  unchanged with `GAUZY_MEETING_REMINDERS_ENABLED`).
- [ ] **T19**. Links and record events `links/calendar-link.service.ts` (record read through `RECORD_ACCESS_FILTER`,
  merge and delete handling), record events route, `RECORD_TIMELINE_SOURCES` entry. Files:
  `links/calendar-link.controller.ts`, `links/calendar-record-events.controller.ts`, `links/calendar-timeline.source.ts`.
  Test: `links/calendar-link.service.spec.ts` (reader of record but not event sees nothing; a private event is listed only for its owner; a
  merge keeps the link; a deleted record removes the link, not the event).
- [ ] **T20**. Outbox events, realtime hints and notification categories (plan §5); status route. Files:
  `calendar-streamed-events.ts`, `events/calendar-realtime-hints.ts`, `events/calendar-notification-categories.ts`,
  `calendar-status.controller.ts`, `calendar-status.service.ts`. Test: `events/calendar-realtime-hints.spec.ts` (hints
  reach the calendar audience only, within 2 s of the change); `calendar-status.service.spec.ts` (capabilities listed only
  for the parts that are loaded).
- [ ] **T21**. Participants `participants/participant.service.ts` (colleagues on `appointment_employee` with answer columns,
  guests created from the appointment's `emails` on first read and written back on change, team expansion with limit,
  roles, co-organizers, options, forwarding an invitation as optional) and `registerCalendarParticipantSources`. Files:
  `participants/participant.controller.ts` (`…/forward`), `participants/calendar-participant-sources.registry.ts`,
  `participants/guest-sync.service.ts`. Test: `participants/participant.service.spec.ts` (expansion limit; source links
  created; an outside address added through the appointment form shows as a guest and the reverse; a forwarded person is
  optional).
- [ ] **T22**. iCalendar module `ical/` (write and read events, series, exceptions, scheduling methods) and dispatch queue
  `participants/invitation.dispatcher.ts` (colleague notices through `MeetingNotificationService` and
  `NOTIFICATION_DISPATCHER`, guest email through `CALENDAR_MAILER`, tokens, updates and cancellations by sequence).
  Files: `ical/ical-writer.ts`, `ical/ical-reader.ts`, `ical/ical-scheduling.ts`, `participants/invitation-dispatch.worker.ts`,
  `participants/calendar-mailer.port.ts`. Test: `ical/ical.spec.ts` (round trip of a series with exceptions);
  `participants/invitation.dispatcher.spec.ts` (one update per change; nothing before the organizer sends; an appointment
  written through the existing routes keeps the short appointment email; no invitation for an event organised outside;
  agents get no email).
- [ ] **T23**. Answers and proposals (per series and per occurrence, delegates, bulk answers, organizer notices) and
  public answer route with signed tokens. Files: `participants/answer.service.ts`, `participants/answer.controller.ts`
  (`…/answer`, `…/proposals/:pid/{accept,dismiss}`, `/calendar/invitations`), `public/public-answer.controller.ts`,
  `participants/guest-token.service.ts`. Test: `participants/answer.service.spec.ts` (guest answer without account;
  delegate marked; occurrence answer kept on split; counts per answer on the event).
- [ ] **T24**. Scheduling message intake `scheduling-messages/intake.service.ts` (`CALENDAR_SCHEDULING_MESSAGES`;
  `registerMailIntakes` matcher, `INBOX_EMAIL_HANDOFFS` fallback; invitations, replies, cancellations, older sequence
  ignored). Files: `scheduling-messages/mail-intake.matcher.ts`, `scheduling-messages/inbox-handoff.listener.ts`. Test:
  `scheduling-messages/intake.service.spec.ts` (each method; older sequence logged).
- [ ] **T25**. Series edits (this, following, all, reset of changed occurrences, removed dates released and told).
  Files: `events/series-edit.service.ts`, `events/calendar-event.controller.ts` (`scope` parameter). Test:
  `events/series-edit.service.spec.ts` (AC-5 scenario; removed dates release resource bookings and are listed to
  participants).
- [ ] **T26**. Identities read through `CALENDAR_IDENTITIES` (`calendar-identity.service.ts`: sign-in address, owned
  mailboxes, the user's communication identities and delegations; the chosen sending identity per invitation). Files:
  `participants/calendar-identity.service.ts`, `participants/calendar-identity.controller.ts` (`/calendar/identities`).
  Test: `participants/calendar-identity.service.spec.ts` (reply to an alias recognised; no identity table).
- [ ] **T27**. Search `calendar-search.service.ts` (nearest occurrence ranking) and global search source. Files:
  `events/calendar-search.service.ts`, `events/calendar-search.controller.ts`, `events/calendar-global-search.source.ts`.
  Test: `events/calendar-search.service.spec.ts` (repeating event found at nearest occurrence; private hidden).
- [ ] **T28** (parallel). Feeds and subscriptions `feeds/*` (hashed tokens, details or free/busy, guarded fetch, refresh
  job). Files: `feeds/calendar-feed.service.ts`, `feeds/calendar-feed.controller.ts`, `feeds/public-feed.controller.ts`,
  `feeds/subscription-refresh.service.ts`, `schedule/calendar-subscriptions.scheduler.ts`. Test:
  `feeds/calendar-feed.service.spec.ts` (private never in a feed; revoked feed refused);
  `feeds/subscription-refresh.service.spec.ts` (internal address refused).
- [ ] **T29** (parallel). Import and export as the iCalendar profile and writer of the data-exchange engine
  (`transfer/ical-import.profile.ts`, `transfer/ical-export.writer.ts`; dry run, background, result file from the
  engine; on `data-import-export` T27 and T12). Test: `transfer/ical-import.profile.spec.ts` (10,000-event file;
  duplicates by identity; series with exceptions round-trip); `transfer/ical-export.writer.spec.ts`.
- [ ] **T30**. Source-owned events `CALENDAR_EVENTS` service (upsert by source key, read-only source fields, answer
  listeners, cancel on source deletion) and bindings for the consumer tokens of plan §7. Files:
  `events/calendar-events.port.ts`, `events/source-event.service.ts`, `events/calendar-port.adapter.ts`
  (`CalendarPortAdapter`), `apps/api/src/plugin-composition.ts`. Test: `events/source-event.service.spec.ts` (a visit
  event follows reschedule and cancel; edits of source fields refused; the source hears answers).
- [ ] **T31**. Resources `resources/*` (directory, opening hours, approvals, locks, overlap check per occurrence,
  horizon job, capacity warning; resources linked to an equipment item booked as `equipment_sharing` requests under the
  item's policy, lending shown as busy). Files: `resources/calendar-resource.service.ts`,
  `resources/calendar-resource.controller.ts`, `resources/resource-booking.service.ts`,
  `resources/resource-booking.controller.ts` (`decide`), `resources/resource-lock.ts`,
  `resources/equipment-sharing.bridge.ts`, `schedule/calendar-resource-horizon.scheduler.ts`. Test:
  `resources/resource-booking.db.spec.ts` (concurrent bookings on three databases confirm one; conflicting occurrence
  reported); `resources/resource-booking.service.spec.ts` (approval, decline with reason, expiry at the start; an
  equipment-linked booking appears on the equipment sharing page).
- [ ] **T32**. Appointment type extension in the existing event type service and DTOs (optional fields, defaults that
  keep today's behaviour). Files: `packages/core/src/lib/event-types/event-type.controller.ts`,
  `packages/core/src/lib/event-types/event-type.service.ts`,
  `packages/core/src/lib/event-types/commands/handlers/event-type.create.handler.ts`,
  `packages/core/src/lib/event-types/schema/event-types.type.gql`, `booking/booking-type.defaults.ts`. Test:
  `packages/core/src/lib/event-types/event-type.resolver.spec.ts` (existing booking flow unchanged);
  `booking/booking-type.defaults.spec.ts` (defaults proposed only for types created with the feature on).
- [ ] **T33**. Booking engine `booking/booking.service.ts` (slots from FR-73, re-check under lock from the event tables,
  resource bookings and busy sources for the slot with busy blocks only for synced outside calendars (plan §2
  Concurrency), event creation,
  confirmation and expiry, reschedule and cancel by the appointment's signed token with purpose and expiry, link version
  raised on change, no-shows) and public controllers with throttling. Files: `booking/booking.controller.ts` (host's
  bookings, filters, no-show, cancel), `booking/booking-lock.ts`, `booking/booking-token.service.ts`,
  `public/public-booking.controller.ts`, `schedule/calendar-booking-expiry.scheduler.ts`. Test:
  `booking/booking.db.spec.ts` (two concurrent guests; an event added to the host's calendar whose busy-block rebuild
  has not run yet refuses that slot); `booking/booking.service.spec.ts` (expiry frees the slot; a link
  from today's booking email still opens its booking; unpublished type refused; throttled after the limit).
- [ ] **T34**. Party matching and lead intake (`CALENDAR_LEAD_INTAKE` with the booking as reference, contact fallback,
  deal link). Files: `booking/party-matching.service.ts`, `booking/calendar-lead-intake.port.ts`. Test:
  `booking/party-matching.service.spec.ts` (one lead even when lead capture's own listener runs).
- [ ] **T35** (parallel). "Linked event today" job and the disabled automation template. Files:
  `schedule/calendar-linked-today.scheduler.ts`, `schedule/calendar-linked-today.service.ts`,
  `events/linked-event-today.template.ts`. Test: `schedule/calendar-linked-today.service.spec.ts` (trigger once per event
  and day; template off by default).
- [ ] **T59**. Meeting room and attachments on events: `CALENDAR_CONFERENCING` (a new or existing room of `meetings`; its
  join link on the event, in invitations and in reminders; without `meetings` a typed link with a join action) and
  `CALENDAR_FILES` (attachments as files of `drive`, else the documents hub, readable to participants). Files:
  `events/calendar-conferencing.port.ts`, `events/calendar-files.port.ts`, `events/event-extras.service.ts`. Test:
  `events/event-extras.service.spec.ts` (room join link in the invitation and reminder; typed link without `meetings`;
  attachment readable by a participant, not by others).
- [ ] **T60**. GraphQL reads `calendars`, `calendarEvents`, `calendarBookings`, `calendarResources` with the sharing of
  `CalendarAccessService`; cursor pagination and `Idempotency-Key` on every creating REST route. Files:
  `graphql/calendar.resolver.ts`, `graphql/calendar-event.resolver.ts`, `graphql/calendar-booking.resolver.ts`,
  `graphql/calendar-resource.resolver.ts`, `graphql/schema-extensions.ts`. Test: `graphql/calendar.resolver.spec.ts`
  (reads filtered by level; private events as "Private"); `graphql/write-routes.spec.ts` (a repeated idempotency key
  creates once).
- [ ] **T61**. Audit trail: activity log entries (who, when, before, after) for calendar, sharing, event, resource, type,
  booking and connection changes, changes made by an agent marked as made on behalf of the confirming user. Files:
  `calendar-audit.service.ts`, `sharing/calendar-share.service.ts`, `events/calendar-event-history.service.ts`. Test:
  `calendar-audit.service.spec.ts` (a sharing change and an event change each logged with before and after; an agent
  change names the confirming user).

## Phase 3 — UI surfaces

- [ ] **T36**. `packages/plugins/calendar-ui`: package, menu entry and guards, and the calendar page (day, work week,
  week, month and agenda views, month-picker with busy days, date jump, upcoming-events panel, calendar list to show,
  hide, recolor and reorder calendars and pick the default one, layers, live refresh of open views); the second time
  zone, shortcuts and phone layout are T65, the event drawer and form T66 and T67, the recurrence editor and drag T69, the invitations page T68. Files:
  `packages/plugins/calendar-ui/` (`package.json`, `project.json`, `src/index.ts`), `calendar-ui.plugin.ts`,
  `calendar-ui.routes.ts`, `calendar-ui.guard.ts`, `components/calendar-page/calendar-page.component.ts`,
  `components/calendar-list/calendar-list.component.ts`, `services/calendar-api.service.ts` (all under
  `packages/plugins/calendar-ui/src/lib/`). Test: `components/calendar-page/calendar-page.component.spec.ts` (each
  view renders; navigation; a change pushed for a visible event refreshes the view), `calendar-ui.guard.spec.ts` (no
  menu entry and no route with the feature off).
- [ ] **T37**. Scheduling view, resources pages (directory, calendar, approvals), booking pages and bookings pages,
  settings pages (organization over the platform settings store, my view choices in `uiPreferences.calendar`, feeds;
  working hours on the existing schedules page). Files (under `packages/plugins/calendar-ui/src/lib/`):
  `components/scheduling-page/scheduling-page.component.ts`, `components/resources-page/resources-page.component.ts`,
  `components/booking-pages-page/booking-pages-page.component.ts`, `components/bookings-page/bookings-page.component.ts`,
  `components/calendar-settings/calendar-settings.component.ts`,
  `components/my-calendar-settings/my-calendar-settings.component.ts`. Test: a rendering spec beside each component
  (`*.component.spec.ts`).
- [ ] **T38** (parallel). `packages/plugins/calendar-react-ui` (`EventCard`, `EventForm`, `AnswerButtons`, `FreeBusyStrip`,
  `TimeProposals`, `RecordEventsPanel`, `ScheduleAction`) hosted through `@gauzy/ui-react` on the calendar and record
  pages. Files (under `packages/plugins/calendar-react-ui/src/lib/components/`): `EventCard.tsx`, `EventForm.tsx`,
  `AnswerButtons.tsx`, `FreeBusyStrip.tsx`, `TimeProposals.tsx`, `RecordEventsPanel.tsx`, `ScheduleAction.tsx`; and
  `packages/plugins/calendar-react-ui/src/i18n/en.json`. Test: `packages/plugins/calendar-react-ui/src/lib/components/*.spec.tsx`
  (component tests; scheduling from a record proposes its people).
- [ ] **T39**. `public-layout-ui` routes: booking page with guest time zone and questions, manage page, answer page;
  embed mode. Files: `packages/plugins/public-layout-ui/src/lib/public-layout.routes.ts`,
  `packages/plugins/public-layout-ui/src/lib/components/calendar-booking/calendar-booking.component.ts`,
  `packages/plugins/public-layout-ui/src/lib/components/calendar-booking-manage/calendar-booking-manage.component.ts`,
  `packages/plugins/public-layout-ui/src/lib/components/calendar-answer/calendar-answer.component.ts`. Test: rendering
  specs beside each component; `packages/plugins/public-layout-ui/src/lib/public-layout.routes.registration-switch.spec.ts`
  (existing public routes unchanged).
- [ ] **T40**. Event type form fields in `apps/gauzy/src/app/pages/employees/event-types` when the feature is on.
  Files: `apps/gauzy/src/app/pages/employees/event-types/event-type-mutation/event-type-mutation.component.ts` and its
  `.html`. Test: `event-type-mutation.component.spec.ts` (form with the feature on and off).
- [ ] **T41**. i18n keys `CALENDAR.*` in every locale and the email templates of plan §6 in every language. Files:
  `packages/ui-core/i18n/assets/i18n/*.json`, `packages/core/src/lib/core/seeds/data/default-email-templates/` (folders
  `calendar-invitation`, `calendar-update`, `calendar-cancellation`, `calendar-reminder`, `booking-confirmation`,
  `booking-confirm-request`, `booking-cancelled`, each `<language>/html.mjml` and `<language>/subject.hbs`). Test:
  `packages/plugins/calendar-ui/src/lib/calendar-ui.i18n.spec.ts` (every `CALENDAR.*` key in every locale; every template
  in every language).
- [ ] **T65** (parallel). Calendar page options of T36: second time-zone column, week start, working days, weekends,
  declined events and week numbers shown (my view choices in `uiPreferences.calendar`), keyboard shortcuts for views,
  navigation and new event with a help list, and the phone-width layout. Files (under
  `packages/plugins/calendar-ui/src/lib/`): `components/calendar-page/calendar-view-options.component.ts`,
  `components/calendar-page/calendar-shortcuts.service.ts`, `components/shortcut-help/shortcut-help.component.ts`.
  Test: `components/calendar-page/calendar-shortcuts.service.spec.ts` (every shortcut, help list),
  `components/calendar-page/calendar-view-options.component.spec.ts` (declined events hidden until shown; second zone
  column; phone-width rendering).
- [ ] **T66**. Event drawer and event form, part 1: create by selecting a time range, quick add by title, full form
  (title, start and end with time zones, all-day, location, description, show as, private, calendar), reminders,
  links. Files (under `packages/plugins/calendar-ui/src/lib/`): `components/event-drawer/event-drawer.component.ts`,
  `components/event-form/event-form.component.ts`. Test: `components/event-form/event-form.component.spec.ts` (a
  selected range opens the form with its times; an end before the start is shown on the field the server names).
- [ ] **T67** (parallel). Event form, part 2: participants (colleagues, teams, participant sources, outside guests,
  optional), participant options, the free/busy strip, resources with the capacity warning, meeting room or typed join
  link. Files (under `packages/plugins/calendar-ui/src/lib/`): `components/event-form/event-participants.component.ts`,
  `components/free-busy-strip/free-busy-strip.component.ts`, `components/event-form/event-resources.component.ts`,
  `components/event-form/event-meeting-room.component.ts`. Test: rendering specs beside each component (busy blocks
  only at the viewer's level; overlap and capacity warnings never block saving).
- [ ] **T68** (parallel). Invitations page: invitations awaiting an answer, answered one by one or in bulk (accept,
  tentative, decline with a comment, for one occurrence or the series), proposals of new times. Files (under
  `packages/plugins/calendar-ui/src/lib/`): `components/invitations-page/invitations-page.component.ts`,
  `components/answer-dialog/answer-dialog.component.ts`. Test:
  `components/invitations-page/invitations-page.component.spec.ts` (bulk answer; a declined event leaves the page).
- [ ] **T69**. Recurrence editor and drag: the recurrence editor of the event form; move and resize by drag and drop,
  copy and duplicate on the calendar page. Files (under `packages/plugins/calendar-ui/src/lib/`):
  `components/recurrence-editor/recurrence-editor.component.ts`, `components/calendar-page/event-drag.directive.ts`.
  Test: `components/recurrence-editor/recurrence-editor.component.spec.ts` (each repeat rule of spec FR-26 round-trips),
  `components/calendar-page/event-drag.directive.spec.ts` (a move asks for the occurrence or the series of a repeating
  event).

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T42**. Sync adapter registry `sync/calendar-sync-adapter.registry.ts` (`registerCalendarSyncAdapters`) on the
  connector kit, simulated adapter, shared adapter contract suite. Files: `sync/simulated/simulated-calendar-sync.adapter.ts`,
  `sync/testing/calendar-sync-adapter.contract-suite.ts`. Test: `sync/simulated/simulated-calendar-sync.adapter.spec.ts`
  (suite green for the simulated adapter).
- [ ] **T43**. Standard-protocol adapter `sync/protocol/` (discovery, calendars, incremental pull, push, encrypted
  credentials, guarded agent). Files: `sync/protocol/caldav-sync.adapter.ts`, `sync/protocol/caldav.client.ts`,
  `sync/protocol/caldav-discovery.ts`. Test: `sync/protocol/caldav-sync.adapter.e2e-spec.ts` against a protocol test
  server in the e2e suite.
- [ ] **T44**. Sync runner `sync/sync-runner.service.ts` (directions, identity matching through `integration_map` rows
  with `remoteVersion` and `syncState`, per-field merge with the three-way merge lifted from the Ever Works sync engine to
  `packages/core/src/lib/integration-map/merge/`, conflicts, invitations only from the organizing side, failure limit and
  pause, notices route, watch renewal, disconnect keep or remove). Files:
  `packages/core/src/lib/integration-map/merge/three-way-merge.ts` (re-exported from
  `packages/plugins/integration-ever-works/src/lib/sync/merge/three-way-merge.ts`), `sync/sync-conflicts.controller.ts`,
  `sync/public-sync-notice.controller.ts`, `schedule/calendar-sync.scheduler.ts`. Test: `sync/sync-runner.service.spec.ts`
  (two-way within lag; concurrent change marked; five failures pause; an event from outside sends no invitation);
  `packages/plugins/integration-ever-works/src/lib/sync/merge/three-way-merge.spec.ts` green on the lifted merge.
- [ ] **T45**. Platform-side standard calendar protocol `dav/` (read and write of the caller's calendars, personal key
  scoped to calendars, settings shown in My settings). Files: `dav/calendar-dav.controller.ts`, `dav/calendar-dav.service.ts`,
  `dav/calendar-dav-key.guard.ts`. Test: `dav/calendar-dav.e2e-spec.ts` (a protocol client lists and writes events).
- [ ] **T46**. MCP tools `packages/mcp-server/src/lib/tools/calendar.ts` (plan §7, except `calendar_propose_times` and
  `calendar_load_summary` of T64) with previews; registration with `AiChatToolRegistry`. Files:
  `packages/mcp-server/src/lib/tools/calendar.ts`, `assistant/calendar-assistant.tools.ts`. Test:
  `packages/mcp-server/src/lib/tools/calendar.spec.ts` (previews write nothing; rights and sharing respected; other users'
  private events never returned; an agent's
  invitation waits for confirmation).
- [ ] **T47**. Report definitions of spec FR-114 with the read-only fallback viewer; personal data handlers; OpenAPI
  regenerated; SDK regeneration noted; adapter author guide in the plugin README. Files:
  `insights/calendar-report.definitions.ts`, `calendar-personal-data.handlers.ts`, `packages/plugins/calendar/README.md`,
  `packages/core/src/lib/bootstrap/swagger.ts`. Test: `insights/calendar-report.definitions.spec.ts` (figures on a
  fixture set); `calendar-personal-data.handlers.spec.ts` (erasure anonymises guests).
- [ ] **T62**. Sync connections and mapping routes: adapters list, connect, reconnect, remote calendars, links with the
  direction and the platform calendar (an existing one or a new subscribed calendar), disconnect. Files:
  `sync/calendar-sync.controller.ts`, `sync/calendar-sync-connection.service.ts`. Test:
  `sync/calendar-sync-connection.service.spec.ts` (connecting the simulated adapter lists its calendars; a link maps to a
  new calendar with the chosen direction; credentials never returned).
- [ ] **T63**. Sync settings pages in `calendar-ui`: connections (connect, choose calendars and direction, reconnect,
  disconnect keep or remove) and the changed-in-both review. Files (under `packages/plugins/calendar-ui/src/lib/`):
  `components/sync-connections/sync-connections.component.ts`, `components/sync-conflicts/sync-conflicts.component.ts`.
  Test: rendering spec beside each component.

## Phase 5 — Advanced capabilities

- [ ] **T48**. Scheduling assistant `assistant/time-proposals.service.ts` (candidates from busy blocks and working hours,
  ranking of FR-101, one-sentence trade-offs, rotating proposals across zones). Files:
  `assistant/time-proposals.controller.ts` (`/calendar/proposals`). Test: `assistant/time-proposals.service.spec.ts`
  (ranking table; five people, three zones, one room).
- [ ] **T49**. Round-robin, collective and group assignment with host weights and the deal owner first; booking hosts
  routes and UI. Files: `booking/booking-assignment.service.ts`, `booking/booking-host.service.ts`,
  `booking/booking-host.controller.ts`, `packages/plugins/calendar-ui/src/lib/components/booking-hosts/booking-hosts.component.ts`.
  Test: `booking/booking-assignment.service.spec.ts` (AC-12 cases).
- [ ] **T50**. Payment before booking through `CALENDAR_PAYMENTS` (hold, timeout, refund by cut-off). Files:
  `booking/booking-payment.service.ts`, `booking/calendar-payments.port.ts`. Test: `booking/booking-payment.service.spec.ts`
  (unpaid cancelled after 15 minutes; refund before cut-off only).
- [ ] **T51**. Room check-in and automatic release, room display check-in. Files: `resources/room-check-in.service.ts`,
  `schedule/calendar-room-release.scheduler.ts`, `public/public-room.controller.ts`,
  `packages/plugins/public-layout-ui/src/lib/components/calendar-room-display/calendar-room-display.component.ts` and its
  route in `public-layout.routes.ts`. Test: `resources/room-check-in.service.spec.ts` (release after 10 minutes;
  organizer told).
- [ ] **T52**. Focus time `insights/focus.service.ts` (goal, weekly placement, moves, flags to organizers). Files:
  `schedule/calendar-focus.scheduler.ts`. Test: `insights/focus.service.spec.ts` (goal kept after a conflicting
  invitation).
- [ ] **T53**. Load figures `insights/load.service.ts` and team dashboard with privacy thresholds; series review
  suggestions. Files: `insights/load.controller.ts`, `schedule/calendar-load.scheduler.ts`,
  `packages/plugins/calendar-ui/src/lib/components/insights-page/insights-page.component.ts`. Test:
  `insights/load.service.spec.ts` (team of two withheld; per-person only with the setting).
- [ ] **T54**. Discussion check and meeting-free times (`CALENDAR_DISCUSSIONS`, once per series, warnings, assistant
  avoidance). Files: `insights/discussion-check.service.ts`, `insights/meeting-free-times.service.ts`,
  `insights/calendar-discussions.port.ts`. Test: `insights/discussion-check.service.spec.ts` (asked once; skipped without
  discussions or chat).
- [ ] **T55**. Tracked time offers `insights/time-offer.service.ts` and `CALENDAR_TIME_OFFERS` (attended minutes from
  `meetings` when present, offers for meeting sessions without an event, one entry marked from the calendar). Files:
  `insights/time-offer.controller.ts`, `schedule/calendar-time-offers.scheduler.ts`. Test:
  `insights/time-offer.service.spec.ts` (entry appears in the timesheet once; one offer per person for a session).
- [ ] **T56**. Capture feed `CALENDAR_CAPTURE` for `crm-engagement` (outside participants, per-user choice, private never).
  Files: `links/calendar-capture.port.ts`. Test: `links/calendar-capture.port.spec.ts` (private and internal-only events
  never returned).
- [ ] **T57**. Demo data: calendars, a repeating series with exceptions, rooms, a team booking page with bookings, a
  simulated sync connection. Files: `seeds/calendar-seeder.service.ts`, `seeds/calendar.seed.ts`, `calendar.plugin.ts`
  (seed hook). Test: `seeds/calendar.seed.spec.ts` (demo seed on SQLite).
- [ ] **T58**. User docs (calendars, sharing, invitations, resources, booking pages, sync, feeds, self-hosted notices) and
  `docs/specs/README.md` row; spec status `Implemented` when phase 5 lands. Files: docs site `website/docs/calendar/`,
  `docs/specs/README.md`, `docs/specs/features/calendar-and-scheduling/spec.md`. Test: docs build.
- [ ] **T64**. MCP tools `calendar_propose_times` (over T48) and `calendar_load_summary` (over T53) in the calendar tools
  of T46. Files: `packages/mcp-server/src/lib/tools/calendar.ts`, `packages/mcp-server/src/lib/tools/register-all-tools.ts`.
  Test: `packages/mcp-server/src/lib/tools/calendar.spec.ts` (proposals
  within the caller's rights; team figures withheld under the threshold).

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Presence and existing appointments | T2, T36 |
| FR-2 | §3.1 Presence and existing appointments | T3, T13, T14 |
| FR-3 | §3.1 Presence and existing appointments | T22 |
| FR-4 | §3.1 Presence and existing appointments | T14 |
| FR-5 | §3.1 Presence and existing appointments | T20 |
| FR-6 | §3.2 Calendars | T12 |
| FR-7–FR-8 | §3.2 Calendars | T12 |
| FR-9 | §3.2 Calendars | T12, T36 |
| FR-10 | §3.2 Calendars | T12 |
| FR-11 | §3.2 Calendars | T13 |
| FR-12–FR-13 | §3.3 Sharing and privacy | T12 |
| FR-14 | §3.3 Sharing and privacy | T19, T46, T56 |
| FR-15 | §3.3 Sharing and privacy | T12, T46, T60 |
| FR-16 | §3.3 Sharing and privacy | T23, T61 |
| FR-17–FR-18 | §3.4 Events | T13, T66 |
| FR-19 | §3.4 Events | T11, T13 |
| FR-20–FR-21 | §3.4 Events | T13 |
| FR-22 | §3.4 Events | T59, T67 |
| FR-23 | §3.4 Events | T59, T69 |
| FR-24–FR-25 | §3.4 Events | T13 |
| FR-26–FR-27 | §3.5 Recurrence | T11, T69 |
| FR-28 | §3.5 Recurrence | T25 |
| FR-29 | §3.5 Recurrence | T23, T25 |
| FR-30 | §3.5 Recurrence | T25 |
| FR-31 | §3.5 Recurrence | T22, T29 |
| FR-32–FR-34 | §3.6 Participants, invitations and answers | T21, T67 |
| FR-35 | §3.6 Participants, invitations and answers | T13, T22 |
| FR-36 | §3.6 Participants, invitations and answers | T21, T22, T26 |
| FR-37 | §3.6 Participants, invitations and answers | T13, T22 |
| FR-38 | §3.6 Participants, invitations and answers | T23, T24, T68 |
| FR-39–FR-40 | §3.6 Participants, invitations and answers | T23 |
| FR-41 | §3.6 Participants, invitations and answers | T23, T65, T68 |
| FR-42 | §3.6 Participants, invitations and answers | T24 |
| FR-43 | §3.6 Participants, invitations and answers | T21 |
| FR-44–FR-45 | §3.7 Working hours, availability and free/busy | T15 |
| FR-46–FR-47 | §3.7 Working hours, availability and free/busy | T15, T16 |
| FR-48 | §3.7 Working hours, availability and free/busy | T15, T22 |
| FR-49 | §3.7 Working hours, availability and free/busy | T15, T16 |
| FR-50 | §3.8 Views | T36 |
| FR-51 | §3.8 Views | T37 |
| FR-52 | §3.8 Views | T17 |
| FR-53 | §3.8 Views | T37, T65 |
| FR-54 | §3.8 Views | T66 |
| FR-55 | §3.8 Views | T20, T36 |
| FR-56 | §3.8 Views | T65 |
| FR-57–FR-60 | §3.9 Reminders | T18 |
| FR-61 | §3.10 Resources | T31 |
| FR-62 | §3.10 Resources | T6, T31 |
| FR-63–FR-66 | §3.10 Resources | T31 |
| FR-67 | §3.10 Resources | T51 |
| FR-68 | §3.10 Resources | T31 |
| FR-69 | §3.11 Appointment types and booking pages | T32, T40 |
| FR-70 | §3.11 Appointment types and booking pages | T32, T40 |
| FR-71–FR-72 | §3.11 Appointment types and booking pages | T49 |
| FR-73–FR-75 | §3.11 Appointment types and booking pages | T33 |
| FR-76 | §3.11 Appointment types and booking pages | T34 |
| FR-77 | §3.11 Appointment types and booking pages | T33 |
| FR-78 | §3.11 Appointment types and booking pages | T50 |
| FR-79 | §3.11 Appointment types and booking pages | T39 |
| FR-80 | §3.11 Appointment types and booking pages | T33, T39 |
| FR-81 | §3.11 Appointment types and booking pages | T33, T37 |
| FR-82 | §3.11 Appointment types and booking pages | T35 |
| FR-83 | §3.12 Events on records and other features' events | T19, T38 |
| FR-84 | §3.12 Events on records and other features' events | T19 |
| FR-85–FR-86 | §3.12 Events on records and other features' events | T30 |
| FR-87 | §3.12 Events on records and other features' events | T19 |
| FR-88 | §3.13 External sync, feeds, import and export | T42, T43, T62 |
| FR-89 | §3.13 External sync, feeds, import and export | T44, T62 |
| FR-90 | §3.13 External sync, feeds, import and export | T42, T43, T44 |
| FR-91 | §3.13 External sync, feeds, import and export | T44 |
| FR-92 | §3.13 External sync, feeds, import and export | T22, T44 |
| FR-93–FR-94 | §3.13 External sync, feeds, import and export | T28 |
| FR-95 | §3.13 External sync, feeds, import and export | T29 |
| FR-96 | §3.13 External sync, feeds, import and export | T44, T63 |
| FR-97 | §3.13 External sync, feeds, import and export | T45 |
| FR-98 | §3.14 Identities and search | T26 |
| FR-99 | §3.14 Identities and search | T27 |
| FR-100–FR-102 | §3.15 Scheduling assistant (advanced) | T48 |
| FR-103 | §3.16 Focus time, meeting load and the discussion check (advanced) | T52 |
| FR-104–FR-105 | §3.16 Focus time, meeting load and the discussion check (advanced) | T53 |
| FR-106–FR-107 | §3.16 Focus time, meeting load and the discussion check (advanced) | T54 |
| FR-108 | §3.17 Tracked time and agents (advanced) | T55 |
| FR-109 | §3.17 Tracked time and agents (advanced) | T46, T64 |
| FR-110 | §3.18 API, events, other features and reports | T12, T13, T60 |
| FR-111 | §3.18 API, events, other features and reports | T15, T16, T17, T21, T30, T56 |
| FR-112 | §3.18 API, events, other features and reports | T20, T35 |
| FR-113 | §3.18 API, events, other features and reports | T13, T61 |
| FR-114 | §3.18 API, events, other features and reports | T47 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flags default off; enabling them in dev shows the feature end to end; with them off, the existing appointment,
  availability, event type, booking page and reminder tests pass unchanged.
- Constitution gates in `spec.md` §9 confirmed.
- The sync adapter contract suite passes for the simulated and standard-protocol adapters and is published for plugins.
- Free/busy, slot and week-view budgets of spec §4 met on the demo data set.
- Every acceptance criterion of `spec.md` §7 demonstrated on the demo data set.
