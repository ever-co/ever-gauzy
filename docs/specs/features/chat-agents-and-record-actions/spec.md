# Feature Specification: Chat agents, bots and record actions

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `chat-agents-and-record-actions`
**Branch**: `feat/chat-agents-and-record-actions`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: the existing chat flags (`GAUZY_CHAT_ENABLED`, tenant `FEATURE_CHAT`) keep task cards, send to chat and create from message as today; the new tenant feature `FEATURE_CHAT_RECORD_CARDS` (default off, needs `FEATURE_CHAT`) for cards of other record types, send to chat and "Discussed in" on record pages, card field settings and message actions; the new tenant feature `FEATURE_CHAT_AGENTS` (default off) for bots, agents, commands, recurring posts and conversation event subscriptions; AI agents also need `GAUZY_CHAT_AI_ENABLED` (exactly `true`) and a configured AI provider; webhook changes stay behind `GAUZY_CHAT_WEBHOOKS_ENABLED`; record notifications need the automation feature of `automation-and-notifications`.

---

## 1. Overview

Chat already turns tasks into **cards** that can be edited in the message (status, priority, assignees through the task service), sends a task to a conversation, creates a task from a message ([`chat`](../chat/spec.md) FR-12–FR-14), lets outside systems post into channels through **incoming webhooks** with blocks and signed, idempotent button callbacks ([`chat-incoming-webhooks`](../chat-incoming-webhooks/spec.md)), and lets AI clients read and post through scoped MCP tools with an "assisted by" mark ([`mcp-collaboration-tools`](../mcp-collaboration-tools/spec.md)). This feature makes chat the place where people **work with business records and automated helpers**: **bots** with their own identity, tokens, buttons, forms, private replies and slash commands; **AI agents** people talk to in direct conversations or mention in any thread; a **record card registry** so every plugin's records (invoices, deals, tickets, pages, projects, employees) render as live cards with fields chosen per organization and actions under the viewer's permissions; **message actions** that create or update records from a message through forms; **notifications from business records** posted into channels as a channel of the platform's notification engine; outgoing chat events through the integration hub; and recurring bot posts without server code. Clients: the Angular app, Ever Teams (screens in the Ever Teams spec `workspace-collaboration-clients`), the MCP server and the SDKs. Agent definitions in general (instructions, models, tools, knowledge, cost limits on every domain) belong to `ai-agents-and-assistants`; this spec owns how an agent takes part in a conversation.

**Advanced capabilities.** An agent can be **mentioned in any thread** and reads only what that thread and the person asking may read; before it changes anything it posts **a visible plan** with each step's preview, waits for approval and offers **undo** afterwards; **approvals, time-off requests and expense decisions** are answered inside the message with an audit entry in the record; every MCP tool a person may use is available as a **slash action** with a form built from the tool and a preview before it writes; and channels **follow records or saved views with smart batching**, one summary per window instead of one message per change.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an app manager, **when** they create the bot "Release Notes" with a picture and a token that may post and read the conversations it is in, **then** the token is shown once, the bot appears in the member picker, and its posts show its name, picture and a "bot" badge.
- **Given** a deployment script holding that token, **when** it posts a message with a header block, two fields and an "Approve" button into a thread of #release, **then** the message appears in the thread for every member, and a click reaches the bot's interaction address signed and once per click.
- **Given** a person typing `/` in a channel, **when** the list opens, **then** it shows the slash commands of the bots and plugins allowed there with their argument hints; `/standup` opens the bot's form, and the bot's answer is visible only to the person.
- **Given** an employee in a direct conversation with the agent "Ops Helper", **when** they ask "which invoices over 5,000 are overdue?", **then** the agent streams its answer with progress lines while it calls the invoice tools, lists invoices the employee may read as cards, and never lists one they may not.
- **Given** a thread in #sales about a stalled deal, **when** a member writes "@Ops Helper draft a follow-up task for Ben and move the deal to Negotiation", **then** the agent posts a plan card with two steps and the preview of each change, and nothing changes until the member approves; after approval each step reports its result with a link, and "undo" stays available for 10 minutes. `(advanced)`
- **Given** a person who pastes the link of invoice INV-0042 or types its number, **when** the message is sent, **then** readers who may read the invoice see a card with customer, amount, due date and status coloured by state; others see the text only.
- **Given** a manager who receives an expense claim to approve, **when** the claim arrives as a card in their direct conversation with the platform bot, **then** they approve it with a comment from the card, the claim's history records the decision "from chat", and the card shows "Approved by Maya" to everyone who sees it. `(advanced)`
- **Given** the action "Create ticket" defined for #support, **when** an agent runs it from a customer's message, **then** a form opens with the subject from the first line, the description from the text and the files attached, the ticket is created under the agent's permissions, and the message shows the ticket's card.
- **Given** a rule of the notification engine "deal won over 10,000 → #wins", **when** a deal is won, **then** the bot posts the deal's card with the templated text, and later changes to that deal from the same rule go into the thread of that first message.
- **Given** #finance following the saved view "Invoices overdue" with a 60-minute window, **when** 14 invoices become overdue within the hour, **then** the channel gets one message listing them with links instead of 14 messages. `(advanced)`
- **Given** a person allowed to use the drive and task tools, **when** they type `/create_task`, **then** a form built from the tool's inputs opens, the preview shows the task that would be created, and "Confirm" creates it and posts the result in the conversation or only to them. `(advanced)`
- **Given** a team lead, **when** they schedule "Weekly priorities" as a bot post every Monday at 09:00 skipping official holidays, **then** the next five times are shown and the post goes out on those days with the team's saved view summary.
- **Given** an integration-hub subscription to "chat message posted" in #alerts with content included, **when** a member posts, **then** the subscriber gets a signed delivery with the message text, retried on failure and listed in the delivery log.

### 2.2 Edge cases & failures

- **Given** a revoked bot token, **when** it is used, **then** the call answers `401` and nothing is posted; a rotated token keeps working for its 24-hour overlap.
- **Given** a bot asked to open a direct conversation with a deactivated employee, **when** it posts, **then** nothing is sent and the answer says the person is inactive.
- **Given** an agent asked in a public channel about a private channel the asker is not in, **when** it answers, **then** it says it cannot read that conversation and quotes nothing from it.
- **Given** a plan card left unanswered, **when** 24 hours pass, **then** it expires, says so, and nothing runs; a record changed since the preview makes the step refuse with "changed since the plan, review again".
- **Given** an agent over its organization's daily limit, **when** someone mentions it, **then** it answers once, only to that person, that the limit resets at a stated time.
- **Given** an AI provider that fails mid-answer, **when** the run stops, **then** the partial message is marked "incomplete", the asker sees a short reason, and the run log keeps the detail for app managers.
- **Given** a record card whose record was deleted, **when** it is shown, **then** a placeholder "This record is no longer available" replaces it without an error.
- **Given** a message action whose form is submitted with an extra field through the API, **when** it runs, **then** the extra field is ignored; a disabled action is refused with `CHAT_ACTION_DISABLED`.
- **Given** a notification rule whose template fails on a record, **when** the record is saved, **then** the save succeeds, the post is skipped and logged in the rule's history, and the rule's owner is told.
- **Given** an interaction or command endpoint that does not answer within 3 seconds, **when** the click or command was made, **then** the person sees "working…" and the bot can still answer within 30 minutes through its response address.
- **Given** an incoming webhook post that names a thread root from another channel, **when** received, **then** it is refused with `422 invalid_thread`.

## 3. Functional Requirements

### 3.1 Scope and what stays

- **FR-1** The system keeps task cards, "send task to chat", "create task from message", card edits through the task service, incoming webhooks with their callbacks and the MCP chat tools with the assisted mark working unchanged; this spec only adds.
- **FR-2** The system serves task cards under the chat flags as today, cards of other record types, send to chat and "Discussed in" on record pages, card field settings and message actions only with `FEATURE_CHAT_RECORD_CARDS` on, bots, agents, commands, recurring posts and conversation event subscriptions only with `FEATURE_CHAT_AGENTS` on, AI agents only with `GAUZY_CHAT_AI_ENABLED` exactly `true` and a configured provider, and answers `404` on those routes otherwise.
- **FR-3** The system offers a Chat → Apps administration page listing bots, agents, incoming webhooks, slash commands, message actions, recurring posts, record subscriptions and chat destinations of the notification engine with owner, conversations, state, last use and recent errors.

### 3.2 Bots

- **FR-4** A user with `CHAT_APPS_MANAGE` can create a bot with a name, a handle unique in the organization, a picture, a description and a responsible person; the system gives it an agent identity (the agent user type of `access-control-and-security`, an agent employee without sign-in) whose agent profile holds that name, handle, picture, description and responsible person, so the bot shows the same wherever the platform shows agents; an agent employee that already exists (for example one an integration provisioned) can be made a bot without a second identity.
- **FR-5** A bot can be a member of channels (added by people allowed to add members), the other member of direct conversations and the author of messages; it receives no push and no email; its messages show its name, picture and a "bot" badge, and search can filter by bots, apps and people.
- **FR-6** A bot's responsible person or a user with `CHAT_APPS_MANAGE` can create tokens for it with scopes (read the conversations it belongs to, post, react, change its own messages, open direct conversations), shown once and stored hashed, rotate one with a 24-hour overlap and revoke it; every call records the token used. The tokens are the platform's API tokens of the bot's identity, so they are listed, limited and revoked with the platform's other keys.
- **FR-7** With a token, a bot can post text, blocks (the block layout of incoming webhooks), files and record cards, reply in a thread, edit and delete its own messages, react, read the messages of conversations it belongs to newest first in pages, list its conversations, add itself to or leave conversations where allowed, and find or open a direct conversation with an active employee (an inactive one is skipped and the answer says so).
- **FR-8** Platform features post as a bot through one service, never as a person: each organization has a platform bot (name and picture set by administrators) used by approvals, notifications and reminders unless a rule names another bot.
- **FR-9** Buttons on bot messages call back the bot's interaction address with the signed, idempotent callback of incoming webhooks, or an in-platform handler a plugin registers; the answer can replace the message, add a reply, answer the clicker only, or open a form whose submitted values are called back the same way.
- **FR-10** A bot or a command can answer one person only: the private reply shows only to them, is never counted as unread, is kept at most 24 hours and can be dismissed.
- **FR-11** A user with `CHAT_APPS_MANAGE` can register slash commands for a bot (name unique in the organization, description, argument hint, conversations where allowed); typing `/` lists the commands allowed in the conversation; invoking one sends the bot a signed call with the person, conversation, thread and text, or runs a plugin's handler; the answer can be a private reply or posted, within 3 seconds or later through the response address of FR-58.
- **FR-12** Deleting a bot revokes its tokens, commands and interaction address, removes it from conversations and keeps its messages shown as "former bot".
- **FR-13** A channel manager can delete bot and agent messages in their channel.

### 3.3 Agents in conversations

- **FR-14** A user with `CHAT_APPS_MANAGE` can make a bot an agent by binding it to an agent of `ai-agents-and-assistants` (instructions, provider and model, tools, knowledge sources, permission mode and limits are that agent's, edited in that feature's pages), optionally pinned to one of its versions; chat adds only where the agent may be mentioned.
- **FR-15** An agent uses the AI providers and credentials configured in the platform's AI settings (hosted providers and self-hosted compatible servers); only people with the AI settings permission add or test a provider; an app manager picks among working ones, and secrets are never shown or sent to clients.
- **FR-16** Instructions can hold variables filled for each conversation: the person's name, email, language, time zone, job title, department, teams and organization, today's date, the conversation's name and its linked record; a preview shows the filled text for a chosen person; reusable instruction texts of an organization are the platform's agent skills.
- **FR-17** The system offers as agent tools the MCP tools of the loaded plugins, chosen by group or one by one and marked read or write; an agent cannot be saved with a write tool unless "may change records" is on; automation flows published as tools are tools too; no agent runs server code that is not a tool.
- **FR-18** When invoked in a conversation, an agent reads only that conversation or thread, the records and files the invoking person may read, and its own knowledge sources filtered by that person's access; it acts with the narrower of its own identity's rights and the person's; it posts only where it was invoked. Before content derived from a record, file or knowledge item reaches the conversation, the agent checks that item against the conversation's audience (its current members and, in a public channel, what a person holding only the organization's default employee role may read); an answer that uses an item the audience may not read continues as a private reply to the invoking person (FR-10) with a note why, and nothing derived from that item is posted where others see it. A posted answer keeps the list of items it used, and a reader of the conversation's messages who may not read one of those items that still exists, a member added later included, sees in its place a note that the answer used records they cannot open.
- **FR-19** An agent can answer from drive folders and pages given as knowledge, with citations of file, page and passage, through the Documents hub's cited retrieval, never citing an item the person may not read.
- **FR-20** In a direct conversation with an agent, every message continues the conversation; "new topic" starts a fresh context; a thread keeps its own context.
- **FR-21** A member can mention an agent that is a member of the conversation (or allowed in all public channels by an app manager) in any message or thread; the agent answers in that thread with the thread's own reading rights of FR-18. `(advanced)`
- **FR-22** An agent's context is the thread with its root, the recent messages of the conversation within its budget, the conversation's linked record and the files of the thread, with older parts summarised; polls are read with their results and never voted on.
- **FR-23** The agent's answer streams into a message marked "agent" with progress lines while tools run; the invoking person can stop it; a run ends after 10 minutes; a failed run tells the person briefly and only them, and keeps the detail in the run log.
- **FR-24** When an answer needs a write tool, the agent first posts a plan card listing each step with the tool's preview of its effects and Approve, Change and Cancel for the invoking person, or for the approver `approval-workflows` requires for that action; nothing is written before approval; a plan expires after 24 hours; a step whose record changed since its preview refuses and asks for a new plan; each executed step reports its result with a link. `(advanced)`
- **FR-25** Changes an agent made from chat are listed under its run with "undo" for 10 minutes for every tool that declares a reverse action; undo runs under the person's rights and is recorded. `(advanced)`
- **FR-26** Files given to an agent are read through the Documents hub's extraction (text, spreadsheet tables, recognised text of scans where switched on); a file sent alone waits up to one minute for a question in the same place before the agent answers; fields extracted from a receipt or invoice can fill a tool's inputs.
- **FR-27** People keep personal prompts and an organization keeps shared prompts, optionally tied to one agent; prompts are offered in the composer when talking to or mentioning an agent.
- **FR-28** The system records each agent run with tokens, estimated cost, duration and tools used as a run of the platform's agents, and refuses runs over the agent's limits and the budgets of `ai-agents-and-assistants` (per organization, agent and person) with the time the limit resets.
- **FR-29** The system writes each run (who asked, where, tools called, plan approvals, changes made, undo) to the audit trail and the agent's run log (one log for the agent's runs in chat and elsewhere); agent messages carry their agent and run, and the MCP assisted mark keeps working for AI clients acting as a person.
- **FR-30** Only users with `CHAT_APPS_MANAGE` create, change, disable or delete agents; run details and errors are shown to them and to the invoking person for their own runs; content passed to a model is treated as data and never as instructions to the platform; no secret is ever placed in a prompt.
- **FR-31** The agent pages of `ai-agents-and-assistants` (list, create, edit identity, instructions with preview, model, tools, knowledge and limits, duplicate, disable, run log) open from the chat Apps page and gain a test as a chosen person in a sandbox conversation and a run log filtered to chat.

### 3.4 Record cards

- **FR-32** Plugins register record types for cards: title, subtitle, picture, up to six fields with formats (state colour, money, date, people, progress), the client route that opens the record (the plugin may override it), key patterns (task keys, document numbers) and editable fields with their service; tasks are the first registration and keep their card and editable fields.
- **FR-33** A person can pick records (type, then record, only readable ones) in the composer and send up to 5 cards with or without text and files; a pasted link to a registered record or a typed registered key becomes a card when the message is sent or edited.
- **FR-34** A card is rendered with the viewer's own rights: it loads when scrolled into view, updates live when the record changes, shows a quiet placeholder for a deleted or unreadable record, and always points to the record by id, never by number alone.
- **FR-35** A card offers open, copy link, copy number, follow and print (with the record type's print template), and changes its registered editable fields through the record's own service with the same permissions and activity log, as task cards do today.
- **FR-36** A user with `CHAT_APPS_MANAGE` can choose per organization and record type which registered fields and custom fields a card shows, in which order; the registration's choice is the default.
- **FR-37** When a record has a workflow of `approval-workflows`, its card lists the transitions the viewer may take and applies one with an optional comment; a refused transition says why.
- **FR-38** Approval tasks, time-off requests and expense claims reach their approver as a card in their direct conversation with the platform bot, with Approve, Reject and a comment; the decision runs through the owning service, is recorded with the channel "chat" in the record's history and audit trail, and updates the card for everyone who sees it. `(advanced)`
- **FR-39** Every registered record page offers "Send to chat" with an optional note and a "Discussed in" panel listing the conversations whose messages carry its card that the viewer may read.
- **FR-40** Messages carrying a record's card appear in that record's timeline of `record-views-and-search` for viewers who may read them; other viewers see how many messages they cannot read.

### 3.5 Actions from a message

- **FR-41** A user with `CHAT_APPS_MANAGE` can define message actions: name, icon, where offered (all conversations, listed ones, messages carrying a card of given types), what they do (create a record of a registered type, start an automation flow, call an MCP tool) and a form of fields (text, long text, number, date, time, date and time, choice, person, record link, checkbox) with label, help, required flag and a default from the message (text, first line, author, time, permalink, conversation, files, linked record) or a fixed value.
- **FR-42** A person who can read the message runs an action from its menu: the form opens filled, only the defined fields are passed on, the record is created under the person's rights, the new record's card is added to the message as a reply and linked both ways; a disabled action is refused with `CHAT_ACTION_DISABLED`, also when called directly.
- **FR-43** The system ships built-in actions when their plugins are loaded: create task (existing), create ticket (`helpdesk-tickets`), log on a contact or deal (`crm-engagement`), expense from an attached receipt (`expenses-and-travel`), save a thread as a page (`documents-and-wiki`) and create an event (`calendar-and-scheduling`); an organization can switch each off.
- **FR-44** Every MCP tool a person may use can be called as `/tool-name`: the system builds a form from the tool's inputs, shows a write tool's preview before "Confirm", and posts the result to the person only or into the conversation as they choose; tools that are hidden from agents (irreversible ones) are not offered. `(advanced)`

### 3.6 Notifications from business records into channels

- **FR-45** A channel, or a person's direct conversation with the platform bot, is a destination of the notification engine of `automation-and-notifications`; its rules and flows post here through the engine's "post to chat" action, and no second rule engine exists in chat.
- **FR-46** A post from the engine comes from the bot the rule names (default the platform bot) with its templated text, mentions, the record's card unless switched off and the buttons the rule defines.
- **FR-47** Later posts about the same record from the same rule go into the thread of its first post, optionally also to the conversation.
- **FR-48** A channel manager can make a channel follow a record, a saved view or a record type with a filter, with a window of 5, 15 or 60 minutes or daily: the changes of a window post as one message listing what changed per record with links; each subscription is an automation of the platform (the task automations for tasks, the notification engine for other records and saved views) whose action posts to the channel, created and listed from the channel, and is offered where that engine is on. `(advanced)`
- **FR-49** Posting never blocks the save of the source record: it runs after commit, retries failures, logs them in the rule's history, tells the rule's owner, and stops posting to an archived or deleted conversation (the engine disables a destination after five failures in a row).
- **FR-50** Each post keeps its source (rule, flow or subscription); channel managers see "from <source>" on it and can mute that source for their channel.
- **FR-51** A chat post never triggers a record notification into the same conversation (loop guard); chat facts are available to flows as triggers of the engine.

### 3.7 Work context

- **FR-52** An organization can turn on a channel per team or per department, public or private, created for existing and new ones, with membership kept in step (memberships marked synced), moved on transfer and archived when the team or department is deleted.
- **FR-53** The system publishes chat facts (message posted, edited, deleted; reaction added, removed; member joined, left) on the event outbox so other plugins react to them through the consumer registry.

### 3.8 Incoming webhooks

- **FR-54** Incoming webhooks keep their behaviour and add: posting into a thread by the id of a root message of the same channel or a key the sender gave an earlier post, a name and icon override when the webhook allows it, mentions inside blocks, up to 5 files by `https` address fetched through the egress guard (10 MB each), and binding the webhook to a bot identity.
- **FR-55** A channel manager can rotate a webhook's address with a 24-hour overlap from the channel's integrations panel and sees its last use and counters.
- **FR-56** Webhooks stay limited to channels; direct conversations are reached by bots through their tokens.
- **FR-57** With `FEATURE_CHAT_AGENTS` on, mentions in an app or bot message file Inbox notifications like a member's mentions, attributed to the app or bot; with it off, an incoming webhook's mentions count on badges and file no Inbox notification, as today.
- **FR-58** A button callback and a slash command receive a response address valid 30 minutes for up to 5 uses to replace the message, reply in its thread or answer the person.

### 3.9 Outgoing chat events

- **FR-59** The system lists chat facts in the event catalogue of `integration-hub` (message posted, edited, deleted; reaction added, removed; conversation created, archived, deleted; member joined, left) with filters by conversation, conversation kind, author kind and keyword, delivered by its signed, retried and logged subscriptions, or by the platform's outgoing webhooks where `integration-hub` is not loaded.
- **FR-60** A delivery carries message text only when the subscription's owner can read the conversation and the subscription asks for content; private channels must be named by a member who manages them; direct conversations are never included.
- **FR-61** A channel manager can create a subscription limited to channels they manage ("when a message here matches") without the general webhook permissions.

### 3.10 Recurring bot posts

- **FR-62** A channel manager or a user with `CHAT_APPS_MANAGE` can schedule a recurring post as a bot: every day, weekdays, chosen weekdays, a day of the month or an expression whose next five times are shown, in a time zone, optionally skipping official holidays, with text and mentions, a record card or a saved view summary; pause, change and delete it; it is a scheduled message of the bot (the scheduled messages of `chat-messaging`, with the platform's recurrence rules), or a flow of the notification engine where the organization builds it there, and needs no server code.
- **FR-63** A one-time bot post at a set time uses the same model.

### 3.11 Background work, API and tools

- **FR-64** The system runs chat's timed and background work (agent runs, card resolution, notification posts, recurring posts, outgoing deliveries) as scheduled jobs and queue workers in which one failing item never stops the others, and starts work caused by a message only after the message is saved.
- **FR-65** Every capability of this spec is a documented REST route in the OpenAPI document, the SDKs and the API catalogue of `integration-hub`; bots call with their tokens, people with their sessions or personal keys; list reads have GraphQL twins.
- **FR-66** The MCP chat group gains `post_chat_record_card`, `list_chat_message_actions`, `run_chat_message_action` (preview unless confirmed), `list_chat_slash_commands` and `list_chat_agents` under the existing scopes.

### 3.12 Reports

- **FR-67** The system registers report definitions: agent usage (runs, tokens, estimated cost, plans approved or refused, undo, errors per agent and person), app activity (posts, clicks and commands per bot and webhook), message actions run per action and outcome, and record notification posts per rule.
- **FR-68** With `FEATURE_CHAT_RECORD_CARDS` and `FEATURE_CHAT_AGENTS` off, chat behaves exactly as today: links and typed keys of records other than tasks stay text (with their link previews where those are switched on), message menus offer only today's entries, record pages show no chat panel, incoming webhook posts behave as today, and task references keep being stored where they are stored today, beside any copy this feature keeps.

## 4. Non-Functional Requirements

- **Performance**: a card batch for one message window (up to 30 cards) P95 < 300 ms; bot post P95 < 200 ms; slash command or click acknowledgement < 3 s end to end; first streamed agent words < 3 s with a working provider; batched subscription posts within one minute of the window end.
- **Data volume**: 200 bots and 50 agents per organization, 1,000 card types registered, 100,000 agent runs per tenant per month, 10,000 record subscriptions per tenant.
- **Concurrency**: plan approval is single-use (a second approval of the same plan is a no-op); a recurring post fires once per time even with several API processes; card edits use the record's own concurrency checks.
- **Reliability**: notification posts and outgoing deliveries are retried from the outbox and never lost on a restart; agent runs survive a process restart as failed with a reason, never as a silent stop.
- **Security & privacy**: bot tokens hashed, scoped and rotated; agents bound by FR-18; plans show exactly what will change; what leaves the platform: message text, files' extracted text and tool results to the tenant's AI provider for agent runs; signed callbacks and command calls with the person's id and name to bot addresses; event deliveries to integration-hub subscribers as FR-60 allows; files fetched from webhook-given addresses through the egress guard.
- **Auditability**: bot, token, agent, action, command and subscription changes in the activity log; every agent run, plan, approval, change and undo in the audit trail; decisions from cards in the record's history.
- **Accessibility and localization**: cards, plan cards, forms and command lists keyboard operable and labelled; field formats in the viewer's locale; built-in action names in every shipped locale.
- **Compatibility**: PostgreSQL, MySQL and SQLite with both ORMs; multi-tenant cloud and self-hosted with self-hosted model servers; works without the automation, approval, helpdesk, expense or AI plugins, whose parts are then absent.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| ---------------- | ----------- |
| `ChatBot` | A non-human chat participant of an organization: its agent identity (name, handle, picture, responsible person on the agent profile) and its chat-only parts (interaction address, platform bot mark) |
| Bot token (platform) | A scoped, hashed API token of the bot's identity with which it calls the API |
| `ChatSlashCommand` | A command a bot or plugin answers, with where it is allowed |
| `ChatPrivateReply` | A short-lived message shown to one person only |
| `ChatResponseAddress` | A short-lived address through which a bot answers a click or command later |
| `ChatAgentBinding` | The link of a bot to an agent of `ai-agents-and-assistants`, with where it may be mentioned |
| Agent (platform) | Instructions, model, tools, knowledge, limits and budget, owned by `ai-agents-and-assistants` |
| Agent run (platform) | One answer of an agent: who asked, where, steps, tokens, cost, outcome |
| Plan and approval (platform) | The steps and previews an agent asks approval for, with their decisions and undo state |
| `ChatPrompt` | Saved prompts of people and organizations; reusable instruction texts are platform agent skills |
| Record card type | A plugin's registration of how its records show as cards (code registry) |
| `ChatCardSetting` | An organization's choice of fields for a record type's card |
| `ChatRecordReference` | A link between a message and a record of any registered type (tasks keep their existing reference too) |
| `ChatMessageAction`, `ChatMessageActionRun` | An administrator-defined action from a message; one run of it |
| Channel subscription | An automation of the platform posting a channel's record changes, with its batching window |
| Bot post | A one-time or recurring scheduled message of a bot |
| `ChatWebhook` (existing) | Gains thread posting, name and icon override, files, bot binding and address rotation |

## 6. Out of Scope

- Agent definitions on every domain, runs, evaluation, model routing, limits and organization-wide cost policies: `ai-agents-and-assistants` (chat binds bots to its agents).
- Rules, flows, schedules, preferences and destinations of notifications: `automation-and-notifications`; general webhooks, the event catalogue and inbound endpoints: `integration-hub`.
- Approval definitions and decisions: `approval-workflows`; tickets, CRM activities, expenses, pages and events created by built-in actions: their specs.
- Conversations, messages, polls, reminders, scheduled messages, search and the person's time-off badge, next working day and profile: `chat-messaging`.
- Chat administration, guests, retention and clients: `chat-administration-and-clients`. Ever Teams screens: the Ever Teams spec `workspace-collaboration-clients`.

## 7. Acceptance Criteria

- [ ] **AC-1** With `FEATURE_CHAT_AGENTS` off, bot, agent, command and subscription routes answer `404` and task cards, webhooks and MCP tools behave as before (FR-1, FR-2).
- [ ] **AC-2** A bot with a scoped token posts blocks into a thread, edits its message, is refused outside its scopes, and a rotated token works during the overlap only (FR-4–FR-7).
- [ ] **AC-3** A button opens a form; its submission and a slash command reach the bot signed and once; a late answer through the response address updates the message; a private reply is seen by one person only (FR-9–FR-11, FR-58).
- [ ] **AC-4** An agent in a direct conversation streams an answer with progress, cites a drive file the person may read and never one they may not (FR-18–FR-23).
- [ ] **AC-5** An agent mentioned in a public thread cannot quote a private conversation the asker is not in; asked there about an invoice the asker may read but another member may not, it answers the asker in a private reply and posts nothing about the invoice in the thread (FR-18, FR-21).
- [ ] **AC-6** A plan card blocks writes until approved, expires after 24 hours, refuses a step whose record changed, and undo reverts within 10 minutes (FR-24, FR-25).
- [ ] **AC-7** Limits refuse a run with the reset time; the run, plan and changes are in the audit trail (FR-28, FR-29).
- [ ] **AC-8** Invoice, deal and ticket cards render from links and numbers with fields chosen by the organization and placeholders for deleted records (FR-32–FR-36).
- [ ] **AC-9** A workflow transition and an expense approval from a card are recorded with the channel chat in the record's history (FR-37, FR-38).
- [ ] **AC-10** "Send to chat" works from three record types; the record's timeline shows the messages a viewer may read and a count of others (FR-39, FR-40).
- [ ] **AC-11** A message action creates a ticket with only its defined fields; a disabled action is refused through the API (FR-41–FR-43).
- [ ] **AC-12** A slash action from an MCP write tool shows its preview before writing (FR-44).
- [ ] **AC-13** A rule posts a deal card; a later change goes into the record thread; a failing template never blocks the save; a muted source stops posting in that channel (FR-45–FR-51).
- [ ] **AC-14** A saved-view subscription with a 60-minute window posts one summary for 14 changes (FR-48).
- [ ] **AC-15** A webhook post lands in a thread with an icon override and a fetched file; rotation keeps the old address for 24 hours (FR-54, FR-55).
- [ ] **AC-16** An integration-hub subscription receives chat facts with text only when allowed; direct conversations never (FR-59–FR-61).
- [ ] **AC-17** A recurring post skips an official holiday and fires once with two API processes (FR-62, FR-64).
- [ ] **AC-18** The reports of FR-67 match the run and post records.
- [ ] **AC-19** Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test (§4).
- [ ] **AC-20** With `FEATURE_CHAT_RECORD_CARDS` and `FEATURE_CHAT_AGENTS` off, a pasted invoice link stays text, message menus, record pages and webhook posts behave as before, and the task reference table is still written (FR-68).
- [ ] **AC-21** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-2, FR-68).

## 8. Open Questions

- Agents in chat are agents of `ai-agents-and-assistants` (FR-14); when chat agents ship first, they ship that feature's agent, run, plan and budget records as it defines them. Applied default.
- Agents in chat are a supported capability with limits and audit. Applied default.
- Who may create bots and actions: applied default `CHAT_APPS_MANAGE` for administrators only; managers get it by choice of the tenant.
- Agents allowed in every public channel: applied default off; an app manager turns it on per agent.
- Content in outgoing chat deliveries: applied default ids only; content by explicit choice, never for direct conversations.
- Undo window for agent changes: applied default 10 minutes.

## 9. Constitution Gates

- [x] I Plugin-first — extends `packages/plugins/chat`, `chat-ui` and the MCP server; plugins register card types, actions and handlers; no plugin imports another.
- [x] II Tenant/organization scoping — bots, agents, cards settings, actions and subscriptions carry tenant and organization; cards are rendered per viewer.
- [x] III Both ORMs, additive migrations — new tables and columns only, three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_CHAT_RECORD_CARDS`, `FEATURE_CHAT_AGENTS` and the AI switch off; task cards, task references and webhooks unchanged.
- [x] V Contracts and API first — every capability is a route with contracts; OpenAPI and SDKs regenerated.
- [x] VI Permissions, privacy, security — hashed scoped tokens, agent rights as the narrower of two, plans before writes, listed outbound data.
- [x] VII Real-time through the event bus — outbox facts; agent streaming over the platform channel.
- [x] VIII i18n and accessibility — labels in every locale; keyboard operable cards and forms.
- [x] IX Tests accompany the change.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Builds on existing behaviour:

| Requirement | Existing behaviour it extends |
| --- | --- |
| FR-1, FR-32, FR-35 | task cards, send to chat and create from message of [`docs/specs/features/chat/spec.md`](../chat/spec.md) FR-12–FR-14 |
| FR-9, FR-54–FR-58 | [`docs/specs/features/chat-incoming-webhooks/spec.md`](../chat-incoming-webhooks/spec.md) FR-1–FR-8 (blocks, signed idempotent callbacks, rate limits) |
| FR-17, FR-29, FR-66 | [`docs/specs/features/mcp-collaboration-tools/spec.md`](../mcp-collaboration-tools/spec.md) FR-1, FR-2, FR-6, FR-7 (scopes, assisted mark, data marking) |
| FR-15, FR-23 | the AI chat plugin's providers, credentials and tool approval |
| FR-19, FR-26 | the Documents hub's extraction, recognition of scans and cited retrieval (its knowledge index) |
| FR-4 | the agent employee kind of the agent-provisioning path and its agent profile |
| FR-6 | the platform's personal API tokens |
| FR-32 | the search plugin's record registrations (label, read permission, title, fields) |
| FR-48 | the trigger, change capture and actions of [`docs/specs/features/task-automations/spec.md`](../task-automations/spec.md) |
| FR-53, FR-59 | the event outbox, consumer registry and the platform's outgoing webhooks |

- Contracts used: [`../automation-and-notifications/spec.md`](../automation-and-notifications/spec.md) (post to chat, destinations, flows as tools, triggers), [`../integration-hub/spec.md`](../integration-hub/spec.md) FR-17–FR-24 (subscriptions), [`../approval-workflows/spec.md`](../approval-workflows/spec.md) FR-39 (cards with decisions), [`../access-control-and-security/spec.md`](../access-control-and-security/spec.md) FR-40, FR-42 (agent user type and ceiling, audit), [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md) FR-40 (record timeline), [`../custom-fields-and-forms/spec.md`](../custom-fields-and-forms/spec.md) (record type registry), [`../print-and-pdf-designer/spec.md`](../print-and-pdf-designer/spec.md), [`../helpdesk-tickets/spec.md`](../helpdesk-tickets/spec.md), [`../crm-engagement/spec.md`](../crm-engagement/spec.md), [`../expenses-and-travel/spec.md`](../expenses-and-travel/spec.md), [`../documents-and-wiki/spec.md`](../documents-and-wiki/spec.md), [`../calendar-and-scheduling/spec.md`](../calendar-and-scheduling/spec.md), [`../ai-agents-and-assistants/spec.md`](../ai-agents-and-assistants/spec.md).
- Siblings: [`../chat-messaging/spec.md`](../chat-messaging/spec.md), `chat-administration-and-clients`; client: the Ever Teams spec `workspace-collaboration-clients`.
- Code: `packages/plugins/chat/src/lib/{chat-task-references.ts,services/chat-task-card.service.ts,webhooks/}`, `packages/plugins/ai-chat/`, `packages/mcp-server/src/lib/tools/collaboration/`, `packages/core/src/lib/{webhook,event-outbox}/`, `packages/contracts/src/lib/employee.model.ts` (`EmployeeKindEnum`).
