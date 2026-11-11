# Task Breakdown: Inbox

**Feature ID**: `inbox`
**Plan**: `./plan.md`
**Status**: `In Progress` — T1–T8 in ever-co/ever-gauzy#11682
**Last updated**: 2026-11-08

---

## Phase 1 — Contracts and core events

- [x] **T1**. Contracts: `TASK_UPDATE` type, `Updated` action, `IEmployeeNotificationPreferences`, `NOTIFICATION` kind, `DONE` tab, `isDone`/`doneAt`, `INBOX_NOTIFICATION_EXTERNAL_SOURCE`
- [x] **T2**. Core: `EmployeeNotificationCreatedEvent` / `EmployeeNotificationUpdatedEvent` published by `EmployeeNotificationService` (create, update, markAllAsRead); type transformer and title template for `TaskUpdate`
- [x] **T3**. Core: follower fan-out (`entity-subscription/fan-out/`) on `CommentEvent` and `TaskEvent`, flag `GAUZY_NOTIFICATION_FANOUT_ENABLED`, specs

## Phase 2 — Inbox plugin

- [x] **T4**. Bridge `notifications/inbox-notification.bridge.ts`: file notifications as NOTIFICATION items; `GAUZY` source handler mirror; `EmployeeNotificationUpdatedEvent` mirror; spec
- [x] **T5**. Done state: `doneAt` column (migration `1791000005200`), DTO, service (`setState`, tabs, `stateOf`), GraphQL schema
- [x] **T6**. `inbox_item.state_changed` outbox event on state change and mark-all-read
- [x] **T7**. README section; `.env.sample` flag
- [x] **T8**. Module wiring (`CqrsModule`, bridge, handlers)

## Phase 3 — Verification and UI

- [x] **T9**. CI green on #11682 (tsc, Jest, schema snapshot, field-binding check); fix forward
- [ ] **T10**. Enable on dev: mention → NOTIFICATION item; read mirror both ways; follower comment notification with the flag on
- [x] **T11**. Angular `inbox-ui`: Done tab + action, NOTIFICATION rendering (opens the task/comment), counts (ever-gauzy #11720)
- [x] **T12**. Dedupe rule per spec FR-4 (10-minute window per recipient/target/kind) in the Inbox's notification bridge (ever-gauzy #11707: a mention whose twin reached the user within ten minutes is not filed again). The folded twin's notification row is mirrored since T18 (plan §10.3)

## Phase 4 — Delivery (lane G10)

- [x] **T13**. Email immediate / digest (worker job, templates) honouring `preferences`
- [x] **T14**. Web push subscriptions (`web-push` dependency already present) and the push decision (no focused session) (ever-gauzy #11721; the browsers' side — service worker + subscribe in the Angular app and Ever Teams — follows)
- [x] **T15**. Settings page in the Angular app and Ever Teams for per-kind channels, DND, digest hour (ever-gauzy #11714 `inbox-ui` Settings → Notifications; ever-teams #4978)

**Status 2026-11-07:** merged into develop (ever-gauzy #11682, `b9070d1dc2`) after one bot round (organization-scoped followers, receiver-named state events, mirrored changes announced, snoozed/done tab, per-organization events).

## Follow-ups (from the plan's §10)

- [x] **T16**. Durable filing: a recovery sweep (`InboxNotificationSweepService`, worker, every five minutes) with a durable checkpoint (`inbox_sweep_checkpoint`, migration `1791000006540`) and no age cutoff that files notifications with no Inbox item through the live filing's own path and leaves folded twins alone (plan §10.1)
- [x] **T17**. Notification row and Inbox entry always created together; the legacy per-type switches decide only e-mail and push (plan §10.2). Done 2026-11-10 (owner decision: always on everywhere); `EmployeeNotificationService.create` no longer returns early, `kindSwitchOf` keeps refusing an unknown type
- [x] **T18**. Many-to-one record of the notification rows a deduplicated entry stands for (`metadata.twinNotificationIds`), every state change mirrored both ways through it (plan §10.3)
