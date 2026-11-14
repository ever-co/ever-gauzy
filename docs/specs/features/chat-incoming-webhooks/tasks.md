# Task Breakdown: Chat incoming webhooks

**Feature ID**: `chat-incoming-webhooks`
**Plan**: `./plan.md`
**Status**: `In progress` (server: ever-gauzy #11799)
**Last updated**: 2026-11-13

---

## Phase 1 — Contracts, entities, migration (PR 1)

- [x] **T1**. Contracts in `chat.model.ts`: block union, button, webhook records and inputs, the created answer (URL and signing secret once), interaction input / result / state and status enum, limits; `IChatMessage.webhookId` / `appIconUrl` / `blocks`; `BaseEntityEnum.ChatWebhook` (+ the two ui-core favourite maps)
- [x] **T2**. `isChatWebhooksEnabled` (`GAUZY_CHAT_WEBHOOKS_ENABLED`), `.env.sample` entries (flag, rate limits)
- [x] **T3**. Entities `ChatWebhook`, `ChatWebhookInteraction` (MultiORM + MikroORM repositories); `ChatMessage.webhookId` / `appIconUrl` / `blocks`
- [x] **T4**. Migration `1791000006730-CreateChatWebhooks`: both tables, the three `chat_message` columns, unique (`webhookId`, `nonce`); tri-dialect, idempotent, reversible

## Phase 2 — Receive (PR 1)

- [x] **T5**. `chat-webhook-payload.ts`: `text` / `blocks` / `attachments` (and a form `payload`) → body + normalised blocks; unknown types as text; plain-text sanitizing; limits (64 KiB, 50 blocks, fields, buttons); `422` codes
- [x] **T6**. `chat-webhook-token.ts`: URL secret generation, SHA-256, hint; `chat-webhook-secret-box.ts`: sealed signing secret
- [x] **T7**. `ChatWebhookRateLimiter`: per webhook and per organization windows over the throttler storage; env overrides; `Retry-After`
- [x] **T8**. `POST /api/chat/hooks/:token` (`@Public()`): flag, token lookup, revoked → 404, tenant `FEATURE_CHAT`, archived → 410, limits → 429, payload → 422, nonce / `Idempotency-Key`, `200 ok`; counters and `lastUsedAt`
- [x] **T9**. App message write: `kind: app`, webhook name + icon, counters, mentions (`canBroadcast` for `@channel` / `@here`), outbox facts as a send; channels only

## Phase 3 — Management and interactions (PR 1)

- [x] **T10**. Management routes (list, create ≤ 10 per channel, update, rotate secret, revoke) for managers / creator / `CHAT_MANAGE`; interaction URL judged by the egress guard (resolution included); activity log entries
- [x] **T11**. `POST /api/chat/messages/:id/interactions` + `GET /api/chat/interactions/:id`: membership (404), button lookup in the stored blocks, interaction row, signed POST through the egress guard (`X-Signature`, `Idempotency-Key`), inline attempt + 3 re-signed retries, reply applied once (`replyAppliedAt`), `chat_message.updated`
- [x] **T12**. GraphQL `ChatMessage.webhookId` / `appIconUrl` / `blocks`; README section; plan §4 routes in Swagger (the public receive route is left out of Swagger, like the platform's other inbound webhook routes)
- [x] **T13**. Specs: payload validation and sanitizing, token hashing, signing (header, window, retry re-sign), rate limits, revoke → 404, archived → 410, SSRF refusal of interaction URLs, non-member click → 404, reply applied once, migration idempotency

## Phase 4 — UI

- [x] **T14**. Angular `chat-ui`: Integrations tab (create, URL + secret once with copy, list, rename, icon, interaction URL, broadcast, rotate, revoke), hidden on 404; app messages (badge, name, icon, blocks, buttons with pending / failed); strings in every locale; specs ([#11808](https://github.com/ever-co/ever-gauzy/pull/11808), `1bffa230b6`)
- [x] **T15**. Ever Teams `apps/web` chat: app messages (badge, blocks, buttons → interaction route) behind `NEXT_PUBLIC_CHAT_WEBHOOKS_ENABLED`; strings in all 13 locales; tests ([ever-teams#5071](https://github.com/ever-co/ever-teams/pull/5071), `c16f21b33e`)
- [x] **T16**. Ever Teams management UI (`apps/web` chat, behind `NEXT_PUBLIC_CHAT_WEBHOOKS_ENABLED`): a channel's More > Integrations for the people who manage it, hidden where the list route answers 404 or 403; list (name, icon, creator, created, last used, counters, revoked), create (URL + signing secret shown once with copy buttons), edit, rotate and revoke (both confirmed); 403 / limit / refused-value errors worded; proxy mode twins (`no-store`); strings in all 13 locales; tests ([ever-teams#5183](https://github.com/ever-co/ever-teams/pull/5183), `754ad57664`)

## Phase 4b — Idempotent clicks

- [x] **T18**. A click's `Idempotency-Key` header (≤ 64 printable characters,
  the receive route's rule; ever-gauzy #11852):
  - `chat_webhook_interaction.idempotencyKey` (case-sensitive on every
    dialect) and a unique (`tenantId`, `messageId`, `actorUserId`,
    `idempotencyKey`) in migration `1791000008300` (tri-dialect, guarded,
    idempotent, reversible);
  - a repeat answers the first click as it is now (the message read again
    when the reply was applied) and calls the app no second time;
  - a concurrent duplicate loses on the index (TypeORM and MikroORM error
    shapes);
  - the same key for another button is `409 IDEMPOTENCY_KEY_REUSED`;
  - no key keeps the old behaviour; specs.
  - Angular `chat-ui`: a UUID per click (`newNonce`: `crypto.randomUUID()`
    where the browser has it); a 15 s deadline per send and per ask; sent
    again with the same key while it gets no answer (twice, after 1 s and
    3 s); the key kept for the button's next click after no answer or a
    server error; a repeat delivered without its reply asked about once
    more, and still shown delivered when that ask fails; specs.
- [x] **T19**. Ever Teams: send the key from the app-message buttons and
  forward it through the proxy-mode interaction route (ever-teams #5155):
  the same client rules as `chat-ui`; `forwardToGauzy` forwards an allowlist
  of request headers (never a session header); tests.

## Phase 5 — Verification

- [ ] **T17**. On dev with `GAUZY_CHAT_WEBHOOKS_ENABLED=true`: a text and a block payload render; a button reaches a test receiver with a valid signature and its reply updates the message; 429 after the burst; revoked URL 404; private interaction URL refused
