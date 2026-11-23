# Task Breakdown: AI agents and assistants

> Ordered, granular tasks derived from `plan.md`. Each task is small enough to land in
> one PR and ships with tests per Constitution Principle IX.

**Feature ID**: `ai-agents-and-assistants`
**Plan**: `./plan.md`
**Status**: `Draft`
**Last updated**: 2026-11-23

---

## How to use

- Tasks are sequential by default; `(parallel)` tasks can run alongside their predecessor.
- Each task names its files so an implementer can pick it up cold.
- Tick the checkbox as the PR lands; add new tasks at the bottom, never renumber.
- Everything stays behind `GAUZY_AI_AGENTS_ENABLED` and `FEATURE_AI_AGENTS`: the feature is off by default; after the trial period it may be switched on by default for new tenants only; existing tenants keep their setting until an administrator changes it. `aa/` means
  `packages/plugins/ai-agents/src/lib/`, `ui/` means `packages/plugins/ai-agents-ui/src/lib/`, `rui/` means
  `packages/plugins/ai-agents-react-ui/src/lib/`, `mcp/` means `packages/mcp-server/src/lib/`. Each entity folder follows
  the plugin layout of `packages/plugins/inventory`: `<name>.entity.ts`, `<name>.service.ts`, `<name>.controller.ts`,
  `dto/`, `repository/type-orm-<name>.repository.ts` and `repository/mikro-orm-<name>.repository.ts`.
- Phases 1 to 4 deliver plan phase 1; Phase 5 delivers plan phase 2 (depth); Phase 6 plan phase 3 (advanced).
- Needs for later phases: `automation-and-notifications` (`AUTOMATION_RULES`, `AUTOMATION_FLOWS`) for triggers and flow
  tools, `access-control-and-security` (`AGENT_RUN_CREDENTIALS`) for the full ceiling; both are optional ports.

## Phase 1 — Contracts, entities, migrations

- [ ] **T1**. Contracts `packages/contracts/src/lib/ai-agents.model.ts` (agent document, tool modes, run, step, tool call,
  confirmation, purpose, template, skill, budget, usage, evaluation, `IAgentRuntime`, `IAgentUsage`, error codes); export
  from `packages/contracts/src/index.ts`; `EmployeeAgentSourceEnum.GAUZY` in
  `packages/contracts/src/lib/employee-agent-profile.model.ts`. Test: agent document schema validation spec
  (`packages/contracts/src/lib/ai-agents.model.spec.ts`).
- [ ] **T2**. `PluginContributions.ai` (`purposes`, `agentTemplates`, `skills`) in `packages/plugin/src/lib/plugin-contributions.ts`
  and `PluginAiRegistry` in `packages/core/src/lib/plugin-contributions/plugin-ai.registry.ts` beside the permission,
  feature and setting registries of `plugin-contribution.registry.ts`; helpers `registerAssistantPurposes`,
  `registerAgentTemplates`, `registerAgentSkills` in `packages/plugin/src/lib/ai-contributions.ts`; duplicates refused
  and listed in the contributions report. Test: registry spec (`plugin-ai.registry.spec.ts`); a plugin's declared
  purpose is listed without this plugin imported.
- [ ] **T3**. Plugin scaffold `packages/plugins/ai-agents` (`package.json`, `project.json`, `tsconfig.json`,
  `tsconfig.lib.json`, `tsconfig.spec.json`, `jest.config.ts`, `src/index.ts`, `aa/ai-agents.plugin.ts`,
  `aa/ai-agents.module.ts`), `aa/ai-agents-enabled.ts` (exact `true`); `PluginContributions` on `@GauzyCorePlugin`:
  `aa/ai-agents.features.ts` (`FEATURE_AI_AGENTS`), `aa/ai-agents.permissions.ts` (with `defaultFor`),
  `aa/ai-agents.settings.ts` (`ai.maskedFields`, `ai.webToolsEnabled`, `ai.confirmationExpiryHours`, `ai.mcp.*`, tenant
  and organization scope); `apps/api/src/plugins.ts` after `AiChatPlugin`, `apps/worker/src/plugins.ts`; `.env.sample`.
  Test: flag spec; plugin list specs (`apps/api/src/plugins.matrix.spec.ts`); settings resolved per organization with
  the tenant as fallback.
- [ ] **T4**. On the shared core migration helpers of `procurement` T4 (`@gauzy/core`), entities and migrations
  `1791000081100` to `1791000081140` (no passage, usage month, settings or MCP client table): entities
  `aa/agents/{ai-agent,ai-agent-version,ai-agent-trigger,ai-conversation-agent,ai-memory-note}.entity.ts`,
  `aa/skills/ai-skill.entity.ts`, `aa/request-tools/ai-request-tool.entity.ts`,
  `aa/knowledge/{ai-knowledge-base,ai-knowledge-source,ai-knowledge-gap}.entity.ts`,
  `aa/runs/{ai-run,ai-run-step,ai-tool-call,ai-confirmation,ai-answer-rating,ai-dry-run-plan}.entity.ts`,
  `aa/usage/{ai-purpose-setting,ai-model-price,ai-budget,ai-usage-entry}.entity.ts`,
  `aa/evaluation/{ai-evaluation-suite,ai-evaluation-case,ai-evaluation-run,ai-scorecard-week}.entity.ts` with their
  TypeORM and MikroORM repositories; migrations `aa/database/migrations/1791000081100-CreateAiAgentTables.ts`,
  `1791000081110-CreateAiKnowledgeTables.ts`, `1791000081120-CreateAiRunTables.ts`, `1791000081130-CreateAiUsageTables.ts`,
  `1791000081140-CreateAiEvaluationTables.ts`, listed in `aa/database/ai-agents-migrations.ts`. Test: migrations on
  SQLite twice; mapping under both ORMs; MySQL index lengths. Migration timestamps: `1791000081100` to `1791000081199` (`packages/plugins/ai-agents`).
- [ ] **T5**. Seed `aa/database/migrations/1791000081160-SeedAiReportCatalogue.ts` (category "AI" keyed
  `FEATURE_AI_AGENTS` in the shared catalogue feature filter); default grants through `defaultFor` in
  `aa/ai-agents.permissions.ts` (no permission seed). Test: idempotent seed; grants per role on a new tenant and after
  the permission reload; with the feature off the Reports page and menu are unchanged.
- [ ] **T49**. Tool metadata for every existing group (group, writes, permissions, feature, route, `derivedEffects` for
  routes that derive further records on the server) and the write
  conventions (`registerWriteTool`: `preview`, idempotency key, preview token, assisted mark, generic request preview for
  legacy writing tools used when `preview: true` is passed or `ai.mcp.previewByDefault` is on). Files:
  `mcp/tools/tool-metadata.ts`, `mcp/tools/tool-conventions.ts`. Test: `mcp/tools/tool-conventions.spec.ts`: every new writing tool answers a preview by default; an existing writing tool called without `preview` commits
  as today with the setting off and with the feature off; the assisted mark appears on existing tools only with the
  feature on.
- [ ] **T50**. Route check against the OpenAPI document; a new tool failing it fails the build, an existing one is
  reported only; the availability it writes to `TOOLS_REGISTRY` hides an existing failing tool from agents only where the
  tenant setting `ai.mcp.hideFailingTools` is on (off by default); CI step. Files:
  `tools/scripts/mcp-tool-route-check.mjs`, `mcp/config/tools-registry.ts`, `.github/workflows/static-checks.yml`. Test:
  `tools/scripts/mcp-tool-route-check.test.mjs`: a seeded dangling new tool fails the check; an existing failing tool is
  reported, still listed to an MCP client and, with the setting off, still offered to agents; with the setting on it is
  not offered to agents.
- [ ] **T51**. Group switches generalized from `mcp/tools/collaboration/scopes.ts` to every group
  (`GAUZY_MCP_TOOLS_<GROUP>`, existing groups on as today), scopes `<group>:read|write`, applied at tool registration.
  Files: `mcp/tools/tool-groups.ts`, `mcp/tools/collaboration/scopes.ts`, `mcp/tools/register-all-tools.ts`. Test:
  `mcp/tools/tool-groups.spec.ts`: existing sessions keep every tool; collaboration groups still
  default off.

## Phase 2 — Services, endpoints, events

- [ ] **T6**. `aa/agents/agent.service.ts`: creating an agent creates its agent employee and `employee_agent_profile`
  (`source = 'gauzy'`; name, avatar and status kept there through
  `packages/core/src/lib/employee-agent-profile/employee-agent-profile.service.ts`); drafts with `If-Match`, placeholder
  validation and preview (`aa/agents/instruction-placeholders.ts`), publish, rollback, pause and archive (profile status),
  versions (`aa/agents/agent-version.service.ts`). Test: stale save refused; published version immutable; unknown
  placeholder refused; renaming the agent renames the profile.
- [ ] **T7**. `aa/tools/tool-catalogue.service.ts`: catalogue from `TOOLS_REGISTRY` with `mcp/tools/tool-metadata.ts`,
  `buildGauzyTools`, `buildClientTools`, `AiChatToolRegistry`; built-ins skeleton. Test: catalogue lists group, write flag,
  permissions; unavailable tools marked.
- [ ] **T8**. `aa/runtime/mcp-host.ts`: per-run `McpServer` with `registerAllMcpTools` on the linked in-memory transport,
  calls inside `runWithAuthKey`. Test: two concurrent runs with different users never share a token.
- [ ] **T9**. `aa/runtime/agent-runtime.service.ts`: model loop over `AiProviderRegistry` with fallback model, step hook,
  limits (steps, tokens, minutes, calls), run, step and tool-call rows, streaming to the caller. Test: limits stop at the
  next step; fallback recorded; provider failure keeps the trace.
- [ ] **T10**. `aa/runtime/tool-gate.ts`: modes (off, allowed, confirm, preview only), invoker permission check, untrusted
  marks with the helper moved from `packages/plugins/docs/src/lib/knowledge/security/untrusted-content.ts` to
  `packages/utils/src/lib/ai/untrusted-content.ts` (re-exported by docs), result cap and masking. Test: hidden tool not
  offered; refused call recorded; write after untrusted content needs confirmation, in the same step and in a later
  step, after a resume, and in the next run of the same conversation while its context still holds that content.
- [ ] **T11**. `aa/confirmations/`: confirmation cards in the stream (`aa/confirmations/confirmation.service.ts`), inbox
  approval and question items through `INBOX_ITEM_WRITER`, source handler `AI_AGENTS`
  (`aa/confirmations/ai-agents-inbox-source.handler.ts`), expiry job (`aa/confirmations/confirmation-expiry.scheduler.ts`).
  Test: approve continues, reject passes the note, expiry ends the run, a late answer is refused.
- [ ] **T12**. `aa/usage/`: price table (`aa/usage/ai-model-price.service.ts`), usage entries per model call in exact
  decimals (`aa/usage/ai-usage-entry.service.ts`), a consumer of `DocsAiUsageEvent` writing Documents AI calls into the
  same ledger (`aa/usage/docs-ai-usage.listener.ts`), totals added to the core usage meter (`USAGE_METER`, metrics
  `ai.tokens`, `ai.cost`) in the transaction that writes each usage entry. Test: cost from tokens and prices; unpriced
  flag; an embedding call of the docs plugin counts against the organization cap from the moment its usage entry is
  written; a call that crosses the monthly cap makes the next run refused with `AI_BUDGET_EXCEEDED` before the hourly
  `usage-close` pass runs; the usage page states that Documents calls are counted as the Documents plugin reports them.
- [ ] **T13**. The assistant as agent "Assistant": `ai-chat` turns also write runs and usage when the plugin is loaded
  and `FEATURE_AI_AGENTS` is on for the tenant (optional hook in `packages/plugins/ai-chat/src/lib/ai-chat.service.ts`,
  answered by `aa/runtime/assistant-run.hook.ts`; absent or off = unchanged); the agent keeps the assistant's 12-step
  limit and adds no masking, time limit or result cap until a user sets one. Test: assistant behaviour identical with the
  plugin off and with the feature off; with the feature on, the same answers and tool results reach the model.
- [ ] **T14**. Controllers and DTOs for agents (`aa/agents/agent.controller.ts`), tools (`aa/tools/tool.controller.ts`),
  runs (`aa/runs/run.controller.ts`), confirmations (`aa/confirmations/confirmation.controller.ts`), prices and usage
  (`aa/usage/usage.controller.ts`), settings (`aa/settings/ai-settings.controller.ts`, read and written through the
  settings store), each with its `dto/`; GraphQL reads in `aa/graphql/schema-extensions.ts` and
  `aa/graphql/ai-agents.resolver.ts`. Test: e2e per route with permissions and `404` with the feature off.
- [ ] **T15**. Events `ai_agent.*`, `ai_run.*`, `ai_confirmation.*` on the outbox; realtime hints `run:<id>`; notification
  categories. Files: `aa/events/ai-agents.events.ts`, `aa/events/ai-agents-realtime.ts` (outbox to
  `RealtimeHintsService.appendHint`), `aa/notifications/ai-agents-notification-categories.ts`. Test: events carry ids
  only; hint per run.
- [ ] **T52**. Built-in tools, record group (spec FR-19 except knowledge, memory, skill and delegation tools, which T29,
  T38 and T36 add; the report, people and web groups are T56, T57 and T58): describe record types, search records, read
  a record, read a file, each within the invoker's access, registered in the catalogue of T7. Files:
  `aa/tools/built-ins/describe-record-types.tool.ts`, `aa/tools/built-ins/search-records.tool.ts`,
  `aa/tools/built-ins/read-record.tool.ts`, `aa/tools/built-ins/read-file.tool.ts`. Test:
  `aa/tools/built-ins/built-ins.spec.ts`: search and read return only records, fields and files the invoker may read;
  describe lists the registered record types.
- [ ] **T53**. Model settings and data disclosure (spec FR-5, FR-8): default, fallback and embedding model per tenant or
  organization as setting contributions `ai.defaultModel`, `ai.fallbackModel`, `ai.embeddingModel` (unset = the
  provider credential's `defaultModel`, as today), used by the agent runtime; a disclosure service lists per provider
  what leaves the platform (instructions, messages, tool results, passages, embedding texts) and whether it is local,
  returned by `GET /api/ai-agents/settings`. Files: `aa/ai-agents.settings.ts`, `aa/runtime/agent-runtime.service.ts`,
  `aa/settings/provider-disclosure.service.ts`, `aa/settings/ai-settings.controller.ts`. Test:
  `aa/settings/provider-disclosure.service.spec.ts`: an organization model overrides the
  tenant's; a local provider is listed as local; with the settings unset the assistant picks its model as today.
- [ ] **T54**. Agent attribution (spec FR-40, FR-71): every platform call of a run carries the run's agent employee and
  invoker, applied by the MCP host and the assistant tool client and read into the request context, so the activity log
  records actor type `Agent` with the agent employee and the invoker acted for, and record histories show the agent with
  the assisted mark of T49. Files: `aa/runtime/agent-attribution.ts`, `aa/runtime/mcp-host.ts`,
  `packages/core/src/lib/core/context/request-context.ts`, `packages/core/src/lib/activity-log/activity-log.service.ts`.
  Test: `aa/runtime/agent-attribution.spec.ts`: a write through an allowed
  tool is logged as the agent's for the invoker; a request without a run is logged as today.
- [ ] **T56**. Built-in tools, report group (spec FR-19): run a report definition over `REPORT_RUNS`, not offered when
  the port is unbound; registered in the catalogue of T7. Files: `aa/tools/built-ins/run-report.tool.ts`. Test:
  `aa/tools/built-ins/run-report.tool.spec.ts`: a report runs with the invoker's access; the tool is not offered when
  `REPORT_RUNS` is unbound.
- [ ] **T57**. Built-in tools, people group (spec FR-19, FR-38): ask a person (an inbox question of T11) and hand over
  (to a person or team with note, draft and sources, assigning the context record where possible); registered in the
  catalogue of T7. Files: `aa/tools/built-ins/ask-person.tool.ts`, `aa/tools/built-ins/hand-over.tool.ts`. Test:
  `aa/tools/built-ins/people-tools.spec.ts`: hand-over assigns the task to the named person; a question reaches the
  person's inbox and its answer resumes the run.
- [ ] **T58**. Built-in tools, web group (spec FR-8, FR-19): web search and fetch through the core outbound policy
  (`packages/core/src/lib/webhook/webhook-endpoint-policy.ts`), hidden when `ai.webToolsEnabled` is off; registered in
  the catalogue of T7. Files: `aa/tools/built-ins/web-search.tool.ts`, `aa/tools/built-ins/web-fetch.tool.ts`. Test:
  `aa/tools/built-ins/web-tools.spec.ts`: web tools are not offered with the switch off; a private address is refused by
  the outbound policy.

## Phase 3 — UI surfaces

- [ ] **T16**. Angular `packages/plugins/ai-agents-ui`: `ui/ai-agents-ui.plugin.ts`, `ui/ai-agents.routes.ts`, menu "AI",
  agent list (`ui/pages/agents/agents-page.component.ts`) and designer (`ui/pages/agent-designer/agent-designer.component.ts`:
  profile, instructions with preview, model and limits, tools with modes and routes, audience, versions),
  `ui/services/ai-agents-api.service.ts`, i18n keys `AI_AGENTS.*` in every locale of
  `packages/ui-core/i18n/assets/i18n/`. Test: rendering and keyboard specs.
- [ ] **T17** (parallel). Runs list and trace page, usage and prices page, settings page (masking, web tools, expiry,
  models and the provider disclosure of T53; run retention links to the platform retention page). Files:
  `ui/pages/runs/runs-page.component.ts`, `ui/pages/run-trace/run-trace-page.component.ts`,
  `ui/pages/usage/usage-page.component.ts`, `ui/pages/settings/ai-settings-page.component.ts`. Test: rendering specs; trace
  shows steps and refusals.
- [ ] **T18** (parallel). React `packages/plugins/ai-agents-react-ui`: `rui/components/AgentPicker.tsx`,
  `rui/components/ConfirmationCard.tsx`, `rui/components/QuestionCard.tsx`, `rui/components/RunTrace.tsx`,
  `rui/components/RatingBar.tsx`; mounted by the `ai-chat-react-ui` sidebar
  (`packages/plugins/ai-chat-react-ui/src/lib/ai-chat-sidebar.component.ts`) when the routes answer. Test: component
  specs; sidebar unchanged on `404`.

## Phase 4 — MCP, SDKs, integrations, docs

- [ ] **T19**. MCP tool metadata and preview conventions: built by T49 (Phase 1, `mcp/tools/tool-metadata.ts`, `mcp/tools/tool-conventions.ts`); its tests are T49's.
- [ ] **T20**. MCP route check: built by T50 (Phase 1, `tools/scripts/mcp-tool-route-check.mjs`); its tests are T50's.
- [ ] **T21**. MCP group switches: built by T51 (Phase 1, `mcp/tools/tool-groups.ts`); its tests are T51's.
- [ ] **T22**. Tenant MCP settings: `/api/ai-agents/mcp/settings`, the MCP server reads settings at session start and
  reports session start and end to the connected clients list of `access-control-and-security` (no client table here);
  the settings page shows that list through `CONNECTED_CLIENTS`; revoked clients refused; declared identity logged.
  Files: `aa/mcp-settings/mcp-settings.controller.ts`, `aa/mcp-settings/mcp-settings.service.ts`,
  `mcp/config/tenant-mcp-settings.ts` (read at session start, cached 60 s), `mcp/session/session-manager.ts` (session
  start and end, revoked clients), `mcp/common/security-logger.ts` (client name and declared identity). Test: tenant switch off refuses tools; revoke from the list takes effect on the next call; a tenant with the feature
  off (settings route `404`) is served exactly as today.
- [ ] **T23**. `mcp/tools/ai-agents.ts`: `agents_list`, `agents_run`, `agent_runs_get`, `agent_confirmations_decide`,
  `agent_questions_answer`, `ai_usage_get`. Test: `agents_run` defaults to a dry run.
- [ ] **T24**. Report definitions and cards of spec FR-80 (runs, usage, confirmations, refusals) registered with the report
  registry. Files: `aa/reports/ai-agents-reports.ts`, `aa/reports/ai-agents-report-cards.ts`. Test: figures on seeded runs.
- [ ] **T25**. OpenAPI regenerated, SDK note; user docs (agents, tools and modes, MCP conventions for plugin authors) in
  `packages/plugins/ai-agents/README.md` and `packages/mcp-server/src/lib/config/TOOLS_CONFIG.md`, and
  `docs/specs/README.md` row. Test: OpenAPI diff is additive; docs build.

## Phase 5 — Depth (plan phase 2)

- [ ] **T26**. Knowledge bases and sources: `aa/knowledge/knowledge-base.controller.ts`,
  `aa/knowledge/knowledge-base.service.ts`, `aa/knowledge/knowledge-source.service.ts` with `dto/`, Documents scope
  sources over `DOCS_KNOWLEDGE_SEARCH_SERVICE`, knowledge folder per base for text, uploads and web pages with review;
  publishing a document source to the base's audience (`publishedToAudience`; refused for record sources). Test: an
  unreviewed page is not returned; a reader without the share gets no passage; a published document source reaches a
  member without the share; publishing a record source is refused.
- [ ] **T27**. Record sources over the `search` plugin's index (`search_document` with its scope filters; a definition
  contributed to `packages/plugins/search/src/lib/definitions/` for a type without one), filtered by the source's saved
  view through `RECORD_VIEWS_QUERY`, texts embedded into the Documents vector store where available; per-entry access
  re-check with `RECORD_ACCESS_FILTER`. Files: `aa/knowledge/record-source.service.ts`. Test: restricted reader; entry
  updated after a record change by the search plugin's consumer.
- [ ] **T28**. Web crawl job (depth 0 to 2, one site, core `webhook-endpoint-policy.ts`; the `ai-chat` guard
  `ssrf/outbound-url-guard.ts` left as it is), source states and error log, knowledge gaps, events
  `ai_knowledge_source.ready` and `.failed`. Files: `aa/knowledge/web-crawl.worker.ts`,
  `aa/knowledge/knowledge-refresh.scheduler.ts`, `aa/knowledge/knowledge-gap.service.ts`. Test: refused site marked
  failed with last good passages kept; `ai-chat` SSRF specs and code unchanged.
- [ ] **T29**. Cross-source ranking (word and meaning fusion), citations in answers, built-in `search_knowledge`, MCP
  `knowledge_search`, `AI_KNOWLEDGE_SEARCH` port. Files: `aa/knowledge/knowledge-search.service.ts`,
  `aa/tools/built-ins/search-knowledge.tool.ts`, `mcp/tools/ai-agents.ts`, `apps/api/src/plugin-composition.ts`. Test:
  ranking spec; citation links.
- [ ] **T30**. Purposes: settings per purpose (`aa/purposes/purpose.controller.ts`, `aa/purposes/purpose.service.ts`),
  `AGENT_RUNTIME.complete` and `AGENT_RUNTIME.purge` (a domain's anonymization erases its runs' step inputs, outputs
  and tool payloads, keeping the run row and usage) (`aa/runtime/agent-runtime.port.ts`), adapters for the domain
  tokens of plan §3.1 in `apps/api/src/plugin-composition.ts`. Test: purpose off → domain fallback; purpose model
  used; masking applied; after `purge` a run keeps its usage and holds no input, output or tool payload.
- [ ] **T31**. Budgets and caps per organization, agent, purpose and user, each window checked against its own counter:
  `DAY` and `MONTH` against the core usage meter, `MINUTE` through the core throttler storage keyed by principal and
  metric, `ACTION` against the size of the current action (records of the bulk action, rows of the export); checks
  before every step; 80 % and 100 % notices and events `ai_budget.warning` and `.reached`; `AI_BUDGET_EXCEEDED`; agent
  principal limits (requests, writes, bulk records, exported rows, confirmations) offered as `AGENT_BUDGETS` with their
  windows, so `access-control-and-security` checks each against the same counter. Files:
  `aa/usage/ai-budget.controller.ts`, `aa/usage/ai-budget.service.ts`, `aa/runtime/budget-check.ts`,
  `aa/usage/usage-close.scheduler.ts`, `apps/api/src/plugin-composition.ts`. Test: cap refuses new runs; warning once per month;
  a `MINUTE` request cap refuses the next request within the minute and allows it in the next; an `ACTION` cap of 100
  refuses a bulk action over 101 records and allows one over 100;
  `access-control-and-security` reads an agent's write limit through the port.
- [ ] **T32**. Triggers: automation rules with an agent step through `AUTOMATION_RULES`, bound `AUTOMATION_AGENTS`; urgent
  flag. Files: `aa/triggers/agent-trigger.controller.ts`, `aa/triggers/agent-trigger.service.ts`,
  `aa/triggers/automation-agents.adapter.ts`, `apps/api/src/plugin-composition.ts`. Test: record event starts a run under
  the rule's run-as identity; budget passed by the step honoured.
- [ ] **T33** (parallel). Mailbox hand-off listener on `INBOX_EMAIL_HANDOFFS`, draft-only mode, allowed actions. Files:
  `aa/triggers/mailbox-handoff.listener.ts`. Test: a
  delivered message yields a draft and no send.
- [ ] **T34** (parallel). `WORKFLOW_AGENTS` (`decide` within passed limits, `advise`) and `CUSTOM_FIELDS_AGENTS` bindings;
  "Ask an agent" on record pages. Files: `aa/workflows/workflow-agents.adapter.ts`,
  `aa/workflows/custom-fields-agents.adapter.ts`, `apps/api/src/plugin-composition.ts`,
  `ui/components/ask-agent-action/ask-agent-action.component.ts`. Test: an agent never decides on a record it created.
- [ ] **T35**. Bulk runs over a saved view through `RECORD_VIEWS_SELECTION`, batches of 500, one confirmation per batch
  after its preview, per-record results. Files: `aa/runs/bulk-run.service.ts`, `aa/runs/dto/bulk-run.dto.ts`,
  `aa/runs/run.controller.ts`. Test: 300 records with one failure.
- [ ] **T36**. Skills and sub-agents (budget share, depth 2, cycle refusal); request and flow tools are T55. Files:
  `aa/skills/ai-skill.controller.ts`, `aa/skills/ai-skill.service.ts`, `aa/tools/built-ins/load-skill.tool.ts`,
  `aa/tools/built-ins/delegate.tool.ts`, `aa/runtime/sub-agent-runner.ts`. Test: delegation depth; a cycle is refused;
  a sub-run gets a share of the remaining budget; a sub-run delegated after its parent read untrusted content starts
  marked and its write needs confirmation (FR-24); a marked sub-run's summary marks the parent, whose next write needs
  confirmation.
- [ ] **T37**. Agent templates from plugins (enable, tune, clone, next version offered), export and import packages with
  preview. Files: `aa/templates/agent-template.service.ts`, `aa/agents/agent-package.service.ts`,
  `aa/agents/agent.controller.ts`. Test: round trip between two tenants without keys or content.
- [ ] **T38** (parallel). Memory notes (remember tool, own notes page), ratings, retention kinds `ai.runs` and
  `ai.knowledge-gaps` declared through `RETENTION_SOURCES` (own cleanup only while `access-control-and-security` is not
  loaded) and account-deletion hook for memory notes. Files: `aa/memory/ai-memory-note.service.ts`,
  `aa/memory/ai-memory.controller.ts`, `aa/tools/built-ins/remember.tool.ts`, `aa/runs/answer-rating.service.ts`,
  `aa/retention/ai-retention-sources.ts`, `aa/memory/account-deletion.hook.ts`, `ui/pages/memory/memory-page.component.ts`.
  Test: deleted account removes its memory notes and leaves
  assistant conversations as today; runs pruned at the period set on the platform retention page.
- [ ] **T39** (parallel). React `DryRunPlan` and hooks `useAgentRun`, `useAgents` in `ai-agents-react-ui`
  (`rui/components/DryRunPlan.tsx`, `rui/hooks/useAgentRun.ts`, `rui/hooks/useAgents.ts`) for the assistant sidebar.
  Test: component specs.
- [ ] **T40**. Knowledge health and AI usage reports (spec FR-80) and the Administration dashboard cards. Files:
  `aa/reports/ai-agents-reports.ts`, `aa/reports/knowledge-health.report.ts`, `aa/reports/ai-agents-report-cards.ts`.
  Test: figures on seeded runs and sources.
- [ ] **T55**. Request tools through `INTEGRATION_HTTP` and `CONNECTED_ACCOUNTS` (declared outbound request with typed
  parameters, answer trimmed to declared fields, core outbound policy) and flow tools through `AUTOMATION_FLOWS`
  (published flow with typed inputs and outputs), each under the run's tool gate. Files:
  `aa/request-tools/ai-request-tool.controller.ts`, `aa/request-tools/ai-request-tool.service.ts`,
  `aa/tools/request-tool.runner.ts`, `aa/tools/flow-tool.runner.ts`. Test: request tool trimmed to fields; a request to
  a private address is refused; tools are not offered when their port is unbound.

## Phase 6 — Advanced capabilities (plan phase 3)

- [ ] **T41**. Ceiling: `AGENT_RUN_CREDENTIALS` consumption, run credential lifetime, fallback gate; sub-agents, flow and
  request tools under the same set; refusal explanations to the model. Files: `aa/runtime/run-credentials.ts`,
  `aa/runtime/tool-gate.ts`, `aa/runtime/sub-agent-runner.ts`. Test: an agent for a manager closes only the
  manager's team tasks (spec AC-8); a run that waited for a confirmation, and a run resumed after an API restart, get a
  new credential before their next call; an invoker deactivated or stripped of a tool's permission while the run waited
  ends it with `AI_ACCESS_CHANGED` and no call is made.
- [ ] **T42**. Dry runs: writing tools forced to `preview: true`, plan rows, plan execution with preview tokens, stop and
  re-plan on a changed record. Files: `aa/dry-runs/dry-run.service.ts`, `aa/dry-runs/plan-executor.service.ts`,
  `aa/runs/run.controller.ts` (`execute-plan`). Test: plan executes exactly; changed record stops; a call to a
  `derivedEffects` tool with only a generic preview (posting a worksheet) is listed with its derived effects marked not
  previewed, is not executed from the plan, and execution stops before it with a confirmation request.
- [ ] **T43**. Evidence per step (instructions version, record versions, passages) and replay against another version or
  model with recorded outputs and divergence marks. Files: `aa/replay/run-evidence.recorder.ts`,
  `aa/replay/run-replay.service.ts`, `ui/pages/run-trace/run-trace-page.component.ts`. Test: replay writes nothing;
  side-by-side traces.
- [ ] **T44**. Evaluation suites and cases (from runs and written), criteria checks, judge purpose `ai.evaluation-judge`,
  replay mode and live read-only mode, publish gate with override reason, proposed cases. Files:
  `aa/evaluation/evaluation-suite.controller.ts`, `aa/evaluation/evaluation-suite.service.ts`,
  `aa/evaluation/evaluation-criteria.ts`, `aa/evaluation/evaluation.worker.ts`, `aa/evaluation/publish-gate.ts`,
  `ui/pages/evaluation/evaluation-page.component.ts`. Test: regression refuses publish;
  override recorded.
- [ ] **T45**. Agent employees: role title, manager (`reportsToEmployeeId`, the sponsor read by `access-control-and-security`)
  and teams on the agent's profile, working hours with queued runs, assignment and mention runs through
  `subscriber:ai-agents`; agents synchronised from Ever Works listed without a definition. Files:
  `aa/workers/agent-worker.service.ts`, `aa/workers/working-window.scheduler.ts`,
  `aa/workers/ai-agents-outbox.subscriber.ts`, `aa/agents/agent.controller.ts` (`worker`). Test: run waits for the window;
  urgent trigger runs at once; changing the manager changes the sponsor.
- [ ] **T46**. Scorecards (daily partial, weekly close), manager rules and pause; `AGENT_USAGE` bound as
  `PAYROLL_AGENT_USAGE`; agent employee cost report. Files: `aa/scorecards/scorecard.service.ts`,
  `aa/scorecards/scorecard.scheduler.ts`, `aa/scorecards/manager-rules.ts`, `aa/reports/agent-employee-cost.report.ts`,
  `apps/api/src/plugin-composition.ts`. Test: scorecard on seeded runs; cost by project.
- [ ] **T47**. Benchmarks: knowledge search at one million passages (PostgreSQL), tool-call overhead, 100 concurrent runs.
  Files: `tools/perf/ai-agents-bench.mjs`. Test: report attached to the PR.
- [ ] **T48**. Provide the ports other features bind to (plan, **Consumer tokens answered**): `BANKING_DOCUMENT_EXTRACTION`, `COMMERCE_ASSISTANT`, `COMMUNICATIONS_ASSISTANT`, `CUSTOM_FIELDS_AGENTS`, `DATA_EXCHANGE_ASSISTANT`, `DISCUSSIONS_ASSISTANT`, `EXPENSE_RECEIPT_READER`, `GATEWAY_ASSISTANT`, `HELP_CENTER_ASSISTANT`, `HR_ASSISTANT`, `INTEGRATION_ASSISTANT`, `LEARNING_ASSISTANT`, `MAIL_TEXT_GENERATION`, `MARKETING_ASSISTANT`, `MEETINGS_SPEECH`, `MEETINGS_TEXT_GENERATION`, `PERFORMANCE_ASSISTANT`, `PORTAL_ASSISTANT`, `PRINT_ASSISTANT`, `PROJECT_ASSISTANT`, `RECRUITMENT_ASSISTANT`, `REPORT_ASSISTANT`, `SHEETS_ASSISTANT`, `SLIDES_ASSISTANT`, `TELEPHONY_SPEECH`, `TELEPHONY_TEXT_GENERATION`, `WORKFLOW_AGENTS`. Files: `apps/api/src/plugin-composition.ts`. Test: one contract test per token over the shape its consumer plan states; with this feature off each consumer keeps its stated fallback.

## Requirement Coverage

Every functional requirement of `spec.md` §3 and the tasks that implement it; each task's test clause verifies it, together with the acceptance criteria of `spec.md` §7 that cite it.

| Requirements | Spec section | Tasks |
| --- | --- | --- |
| FR-1 | §3.1 Scope, flags and compatibility | T3, T14 |
| FR-2 | §3.1 Scope, flags and compatibility | T3, T22, T51 |
| FR-3 | §3.1 Scope, flags and compatibility | T13 |
| FR-4 | §3.2 Model providers and AI settings | T9 |
| FR-5 | §3.2 Model providers and AI settings | T53 |
| FR-6 | §3.2 Model providers and AI settings | T12 |
| FR-7 | §3.2 Model providers and AI settings | T3, T10, T17 |
| FR-8 | §3.2 Model providers and AI settings | T58, T53, T17 |
| FR-9 | §3.3 Agent definitions | T6, T16 |
| FR-10 | §3.3 Agent definitions | T6, T9, T16 |
| FR-11 | §3.3 Agent definitions | T6, T16, T36 |
| FR-12 | §3.3 Agent definitions | T10, T41 |
| FR-13 | §3.3 Agent definitions | T6 |
| FR-14 | §3.3 Agent definitions | T2, T37 |
| FR-15 | §3.3 Agent definitions | T36 |
| FR-16 | §3.3 Agent definitions | T37 |
| FR-17 | §3.4 Tools and their permissions | T7 |
| FR-18 | §3.4 Tools and their permissions | T10, T11, T49 |
| FR-19 | §3.4 Tools and their permissions | T7, T52, T56, T57, T58, T29, T36, T38 |
| FR-20 | §3.4 Tools and their permissions | T55 |
| FR-21 | §3.4 Tools and their permissions | T7, T10 |
| FR-22 | §3.4 Tools and their permissions | T10, T41 |
| FR-23 | §3.4 Tools and their permissions | T36, T41, T55 |
| FR-24 | §3.4 Tools and their permissions | T10, T36 |
| FR-25 | §3.4 Tools and their permissions | T9, T10 |
| FR-26–FR-27 | §3.5 Knowledge bases | T26 |
| FR-28 | §3.5 Knowledge bases | T26, T27, T29 |
| FR-29 | §3.5 Knowledge bases | T26, T28 |
| FR-30 | §3.5 Knowledge bases | T28, T29 |
| FR-31 | §3.5 Knowledge bases | T26, T27 |
| FR-32 | §3.5 Knowledge bases | T26 |
| FR-33 | §3.5 Knowledge bases | T26, T28 |
| FR-34 | §3.6 Runs, conversations, confirmations and audit | T9, T13, T30 |
| FR-35 | §3.6 Runs, conversations, confirmations and audit | T9 |
| FR-36 | §3.6 Runs, conversations, confirmations and audit | T13, T14, T18, T38 |
| FR-37 | §3.6 Runs, conversations, confirmations and audit | T11, T18 |
| FR-38 | §3.6 Runs, conversations, confirmations and audit | T11, T57 |
| FR-39 | §3.6 Runs, conversations, confirmations and audit | T9, T14 |
| FR-40 | §3.6 Runs, conversations, confirmations and audit | T54 |
| FR-41 | §3.6 Runs, conversations, confirmations and audit | T38 |
| FR-42 | §3.6 Runs, conversations, confirmations and audit | T14, T17 |
| FR-43 | §3.6 Runs, conversations, confirmations and audit | T38 |
| FR-44 | §3.7 Triggers, hand-offs and bulk runs | T32, T33 |
| FR-45 | §3.7 Triggers, hand-offs and bulk runs | T32 |
| FR-46 | §3.7 Triggers, hand-offs and bulk runs | T33 |
| FR-47 | §3.7 Triggers, hand-offs and bulk runs | T34 |
| FR-48 | §3.7 Triggers, hand-offs and bulk runs | T35 |
| FR-49 | §3.7 Triggers, hand-offs and bulk runs | T34 |
| FR-50 | §3.8 Cost limits and usage | T12, T31 |
| FR-51 | §3.8 Cost limits and usage | T31 |
| FR-52 | §3.8 Cost limits and usage | T46 |
| FR-53–FR-55 | §3.9 Agents as accountable workers (advanced) | T45 |
| FR-56 | §3.9 Agents as accountable workers (advanced) | T46 |
| FR-57 | §3.9 Agents as accountable workers (advanced) | T45, T46 |
| FR-58 | §3.10 Dry runs and replay (advanced) | T39, T42 |
| FR-59 | §3.10 Dry runs and replay (advanced) | T42 |
| FR-60–FR-61 | §3.10 Dry runs and replay (advanced) | T43 |
| FR-62–FR-65 | §3.11 Evaluation (advanced) | T44 |
| FR-66–FR-68 | §3.12 Shared layer for domain assistants and MCP tools | T2, T30 |
| FR-69 | §3.12 Shared layer for domain assistants and MCP tools | T49, T50 |
| FR-70 | §3.12 Shared layer for domain assistants and MCP tools | T49 |
| FR-71 | §3.12 Shared layer for domain assistants and MCP tools | T49, T54 |
| FR-72 | §3.12 Shared layer for domain assistants and MCP tools | T51 |
| FR-73 | §3.12 Shared layer for domain assistants and MCP tools | T50 |
| FR-74–FR-75 | §3.12 Shared layer for domain assistants and MCP tools | T22 |
| FR-76 | §3.12 Shared layer for domain assistants and MCP tools | T6, T11, T26 |
| FR-77 | §3.13 API, events and reports | T14, T26, T30, T31, T44, T46 |
| FR-78 | §3.13 API, events and reports | T23, T29 |
| FR-79 | §3.13 API, events and reports | T15, T28, T31 |
| FR-80 | §3.13 API, events and reports | T24, T40 |

## Definition of Done

- All checkboxes ticked; tests green locally and in CI.
- Migrations verified on PostgreSQL, MySQL and SQLite with both ORMs.
- Flag default stays off; enabling it in dev shows the feature end to end.
- Constitution gates in `spec.md` §9 confirmed.
- Feature checks: with the plugin off the assistant, MCP server and Documents knowledge behave exactly as before (AC-16);
  with it on and default settings, existing MCP tools and the assistant behave as before (AC-17); every new MCP writing
  tool answers a preview by default and the route check passes for new tools; a restricted invoker never gets an
  agent to read or change what they could not; no provider payload carries a masked field; the budgets of spec §4 hold.
