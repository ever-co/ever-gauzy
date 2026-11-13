# Feature Specification: Chat incoming webhooks

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `chat-incoming-webhooks`
**Branch**: `feat/chat-incoming-webhooks`
**Status**: `Draft`
**Created**: 2026-11-07
**Last updated**: 2026-11-07
**Owner**: platform maintainers
**Feature flag**: `GAUZY_CHAT_WEBHOOKS_ENABLED` (default off; requires `GAUZY_CHAT_ENABLED`)

---

## 1. Overview

Automation (CI pipelines, monitoring, the platform's own integrations, scripts) can post
messages into a chat channel through a per-channel **incoming webhook URL**. A webhook
message appears in the channel with an "App" badge and the webhook's name and icon,
supports plain text and a simple structured layout (title, fields, buttons), and buttons
can call back the sender with a signed payload so a channel member can act on an alert
(acknowledge, approve, open) without leaving the chat. Webhook payloads accept the
widely used JSON shape for chat bots (`text`, `blocks`, `attachments`) so existing
senders work without changes.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** a channel manager, **when** they open the channel's Integrations tab and
  create a webhook named "Deploys", **then** they see the webhook URL once, can copy it,
  and the channel lists the webhook with its creator and creation time.
- **Given** a CI job that POSTs `{"text": "Build 412 passed"}` to the URL, **when** the
  request arrives, **then** a message "Build 412 passed" from "Deploys" with an App badge
  appears in the channel within a second for every member.
- **Given** a monitoring tool that posts a structured payload with a title, two fields
  and an "Acknowledge" button, **when** rendered, **then** members see the title, the
  fields side by side and the button.
- **Given** a member who clicks "Acknowledge", **when** the click is processed, **then**
  the platform POSTs a signed interaction payload (who clicked, which button, which
  message) to the webhook's configured interaction URL, and the sender's reply (if any)
  updates the message in place.
- **Given** a webhook that posts 50 messages in a minute, **when** the limit is reached,
  **then** further requests get a rate-limit response and nothing is lost on the sender's
  side beyond the rejected calls.

### 2.2 Edge cases & failures

- **Given** a webhook URL that has been revoked, **when** it is called, **then** the
  platform answers "not found" and posts nothing.
- **Given** a payload larger than 64 KiB or with more than 50 blocks, **when** received,
  **then** it is rejected with a validation error.
- **Given** a webhook whose channel was archived, **when** called, **then** the message is
  rejected with a clear status.
- **Given** an interaction URL on a private network address, **when** configured, **then**
  the platform refuses to save it.
- **Given** a member who may not view the channel, **when** they try to click a button
  through the API with a message id, **then** they receive "not found".

## 3. Functional Requirements

- **FR-1** Channel managers MUST be able to create up to ten webhooks per channel, each
  with a name, optional icon, optional interaction URL, and a secret shown once; revoke
  and rename them; and see when each was last used.
- **FR-2** The webhook endpoint MUST accept a JSON body with `text` and/or `blocks`
  (section, header, divider, fields, context, actions with buttons) and/or legacy
  `attachments`, MUST render unknown block types as plain text, and MUST answer `200 ok`
  on success, `404` for unknown or revoked webhooks, `422` for invalid payloads and `429`
  when rate-limited.
- **FR-3** Messages posted by a webhook MUST be stored as chat messages authored by the
  webhook (not by any employee), marked as app messages, and MUST flow through the same
  events, unread counters and mention rules as member messages; `@channel`/`@here` from a
  webhook MUST be honoured only when the webhook is allowed to broadcast.
- **FR-4** Buttons MUST produce interaction callbacks: a signed POST (timestamp +
  signature header derived from the webhook secret) to the interaction URL with the
  actor, the message id, the action id and value, and an `interactionId` that is created
  once per click and stays the same on every retry of that callback (also sent as an
  `Idempotency-Key` header); receivers MUST deduplicate on it, and the platform applies
  the sender's reply for one `interactionId` at most once. The sender's synchronous reply
  MAY replace or update the message.
- **FR-5** Interaction URLs and any URL in a payload MUST be validated (https only,
  public hosts only); the platform MUST NOT follow them beyond the callback POST.
- **FR-6** Rate limits MUST apply per webhook (default 60 requests per minute, burst 20)
  and per organization.
- **FR-7** Creating, revoking and renaming webhooks MUST be recorded in the activity log.
- **FR-8** The platform MUST NOT accept webhooks for direct or group conversations.

## 4. Non-Functional Requirements

- **Performance**: webhook POST acknowledged under 150 ms P95.
- **Reliability**: idempotency by optional `nonce`; interaction callbacks retried three
  times with backoff, each retry re-signed with a fresh timestamp but carrying the same
  `interactionId`, so a sender whose earlier response was lost does not act twice.
  A member's click sent again with its `Idempotency-Key` (a double click, a
  retry after a lost answer) is the same interaction and calls the app no
  second time.
- **Security & privacy**: secrets hashed at rest; URLs validated; signatures on
  callbacks; no employee data beyond name and id in callbacks.
- **Observability**: per-webhook counters (accepted, rejected, rate-limited, callback
  failures).
- **Compatibility**: PostgreSQL, SQLite, MySQL; both ORMs.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `ChatWebhook`    | A named incoming endpoint bound to one channel with a hashed secret, optional icon and interaction URL |
| `AppMessage`     | A chat message authored by a webhook with a structured block layout |
| `Interaction`    | A member's click on an app-message button and its signed callback, identified by an `interactionId` stable across retries |

## 6. Out of Scope

- Outgoing webhooks on member messages, slash commands, bot users with their own
  identity and permissions.
- Scheduled or recurring posts.

## 7. Acceptance Criteria

- [ ] A text payload and a block payload render correctly; the URL is shown once; revoked
      URLs answer 404.
- [ ] A button click reaches the interaction URL with a valid signature and the reply
      updates the message.
- [ ] Rate limits and payload limits are enforced; private-network URLs are refused.
- [ ] Works on PostgreSQL, MySQL and SQLite with both ORMs; behind `GAUZY_CHAT_WEBHOOKS_ENABLED`.
- [ ] All functional requirements have a passing test.

## 8. Open Questions

- `[NEEDS CLARIFICATION: whether webhooks may be created by any channel member or only managers (proposed: managers and the channel creator)]`

## 9. Constitution Gates

- [x] I Plugin-first — part of `packages/plugins/chat`.
- [x] II Tenant/organization scoping.
- [x] III Both ORMs, additive migrations.
- [x] IV Default-off flag; nothing removed.
- [x] V Contracts and API first.
- [x] VI Permissions, privacy, security — hashed secrets, signed callbacks, URL validation.
- [x] VII Real-time through the event bus — app messages are chat messages.
- [x] VIII i18n and accessibility — management UI strings in every locale.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Depends on: [`../chat/spec.md`](../chat/spec.md)
