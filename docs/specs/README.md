# Ever Gauzy specs

Spec-driven development for the platform, following the
[GitHub Spec Kit](https://github.com/github/spec-kit) workflow adapted in
[`.specify/`](../../.specify/README.md). The constitution
([`.specify/memory/constitution.md`](../../.specify/memory/constitution.md)) is the
highest-priority document: every spec, plan and task list reconciles with it.

```text
docs/specs/
├── README.md            # this index
├── architecture/        # cross-feature architecture docs
├── decisions/           # Architecture Decision Records (ADRs)
└── features/<slug>/     # spec.md (what) · plan.md (how) · tasks.md (PR-sized steps)
```

## Architecture

| Doc | Covers |
| --- | ------ |
| [`architecture/collaboration-suite.md`](architecture/collaboration-suite.md) | How Tasks, Chat, Docs, Inbox, notifications, the real-time channel and integrations fit together across the API, the Angular app, Ever Teams, the desktop apps, the MCP server and the SDKs |
| [`architecture/business-suite.md`](architecture/business-suite.md) | How the business features fit into Ever Gauzy, Ever Teams and Ever Platform: which plugin owns what, the shared engines every feature uses (business documents, ledger posting, stock ledger, approvals, custom fields and views, reports, automation), the reuse map of existing modules, the vocabulary and the conventions every plan follows |

## Features

| Feature | Spec | Status | Flag |
| ------- | ---- | ------ | ---- |
| Real-time channel (collaboration events on the outbox, presence, typing, subscription) | [`features/realtime-channel/`](features/realtime-channel/spec.md) | Merged (#11681) — dev verification open | `GAUZY_REALTIME_ENABLED` |
| Chat (channels, direct messages, threads, mentions, reactions, task cards) | [`features/chat/`](features/chat/spec.md) | Phase 1 merged (#11683, #11686); Angular UI in review (#11687) | `GAUZY_CHAT_ENABLED` |
| Inbox (unified notifications, triage, preferences, push) | [`features/inbox/`](features/inbox/spec.md) | Unified inbox merged (#11682); email/push/settings open | `GAUZY_INBOX_ENABLED` |
| Docs collaboration (spaces, live co-editing, notifications, Markdown export and API editing) | [`features/docs-collaboration/`](features/docs-collaboration/spec.md) | Phase 1 in review (`feat/docs-collaboration`) — [`plan`](features/docs-collaboration/plan.md) · [`tasks`](features/docs-collaboration/tasks.md) | `GAUZY_DOCS_COLLAB_ENABLED` |
| Tasks: saved views, bulk actions, keyboard-first lists | [`features/task-views-and-bulk-actions/`](features/task-views-and-bulk-actions/spec.md) | Phase 1 in review ([#11688](https://github.com/ever-co/ever-gauzy/pull/11688)) — [`plan`](features/task-views-and-bulk-actions/plan.md) · [`tasks`](features/task-views-and-bulk-actions/tasks.md) | `GAUZY_TASK_VIEWS_ENABLED` |
| Integrations: Linear, Asana, Trello (import and sync) | [`features/integrations-asana-linear-trello/`](features/integrations-asana-linear-trello/spec.md) | Phase 1 merged for Linear, Asana and Trello; manual checks on dev outstanding — [`plan`](features/integrations-asana-linear-trello/plan.md) · [`tasks`](features/integrations-asana-linear-trello/tasks.md) | `LINEAR_ENABLED`, `ASANA_ENABLED`, `TRELLO_ENABLED` |
| Docs import (Markdown vault, HTML export zip) and PDF export | [`features/docs-import-export/`](features/docs-import-export/spec.md) | In progress (`feat/docs-import-export`) — [`plan`](features/docs-import-export/plan.md) · [`tasks`](features/docs-import-export/tasks.md) | `GAUZY_DOCS_IMPORT_ENABLED`, `GAUZY_DOCS_PDF_EXPORT_ENABLED` |
| Chat incoming webhooks (bots and automation posts) | [`features/chat-incoming-webhooks/`](features/chat-incoming-webhooks/spec.md) | Draft | `GAUZY_CHAT_WEBHOOKS_ENABLED` |
| Comments and trash (reactions on comments, edit marker, task trash) | [`features/comments-and-trash/`](features/comments-and-trash/plan.md) (client spec in ever-teams) | In review ([#11802](https://github.com/ever-co/ever-gauzy/pull/11802)) — [`plan`](features/comments-and-trash/plan.md) · [`tasks`](features/comments-and-trash/tasks.md) | `GAUZY_TASK_TRASH_ENABLED` |
| MCP tools for chat, docs and inbox | [`features/mcp-collaboration-tools/`](features/mcp-collaboration-tools/spec.md) | In Progress (ever-gauzy #11722: the three groups, switches and scopes; assisted marker and session-recorded scopes open) | MCP server config |
| Business document engine | [`features/business-document-engine/`](features/business-document-engine/spec.md) | Draft | `FEATURE_BUSINESS_DOCUMENTS` |
| Organization setup | [`features/organization-setup/`](features/organization-setup/spec.md) | Draft | `FEATURE_ORGANIZATION_STRUCTURE` |
| Custom fields and forms | [`features/custom-fields-and-forms/`](features/custom-fields-and-forms/spec.md) | Draft | `FEATURE_CUSTOM_FIELDS` |
| Approval workflows | [`features/approval-workflows/`](features/approval-workflows/spec.md) | Draft | `FEATURE_WORKFLOWS` |
| Record views and search | [`features/record-views-and-search/`](features/record-views-and-search/spec.md) | Draft | `FEATURE_RECORD_VIEWS` |
| Report builder and dashboards | [`features/report-builder-and-dashboards/`](features/report-builder-and-dashboards/spec.md) | Draft | `FEATURE_REPORT_BUILDER` |
| Data import and export | [`features/data-import-export/`](features/data-import-export/spec.md) | Draft | `FEATURE_DATA_EXCHANGE` |
| Print and PDF designer | [`features/print-and-pdf-designer/`](features/print-and-pdf-designer/spec.md) | Draft | `FEATURE_PRINT_TEMPLATES` |
| Automation and notifications | [`features/automation-and-notifications/`](features/automation-and-notifications/spec.md) | Draft | `FEATURE_AUTOMATIONS` |
| Access control and security | [`features/access-control-and-security/`](features/access-control-and-security/spec.md) | Draft | `FEATURE_ADVANCED_ACCESS` |
| Email and communications | [`features/email-and-communications/`](features/email-and-communications/spec.md) | Draft | `FEATURE_COMMUNICATIONS` |
| Integration hub | [`features/integration-hub/`](features/integration-hub/spec.md) | Draft | `FEATURE_INTEGRATION_HUB` |
| Platform administration | [`features/platform-administration/`](features/platform-administration/spec.md) | Draft | `FEATURE_ADMIN_CONSOLE` |
| Accounting foundation | [`features/accounting-foundation/`](features/accounting-foundation/spec.md) | Draft | `FEATURE_ACCOUNTING` |
| General ledger | [`features/general-ledger/`](features/general-ledger/spec.md) | Draft | `FEATURE_ACCOUNTING` |
| Tax engine | [`features/tax-engine/`](features/tax-engine/spec.md) | Draft | `FEATURE_TAX_DOCUMENTS`, `FEATURE_WITHHOLDING` |
| Invoicing, receivables and payables | [`features/invoicing-receivables-payables/`](features/invoicing-receivables-payables/spec.md) | Draft | `FEATURE_RECEIVABLES_PAYABLES` |
| Payments and collections | [`features/payments-and-collections/`](features/payments-and-collections/spec.md) | Draft | `FEATURE_COLLECTIONS` |
| Banking and reconciliation | [`features/banking-and-reconciliation/`](features/banking-and-reconciliation/spec.md) | Draft | `FEATURE_BANKING` |
| Financial reports | [`features/financial-reports/`](features/financial-reports/spec.md) | Draft | `FEATURE_FINANCIAL_REPORTS` |
| Budgets and revenue schedules | [`features/budgets-and-revenue-schedules/`](features/budgets-and-revenue-schedules/spec.md) | Draft | `FEATURE_BUDGETS`, `FEATURE_REVENUE_SCHEDULES` |
| Payment gateways | [`features/payment-gateways/`](features/payment-gateways/spec.md) | Draft | `FEATURE_PAYMENT_GATEWAY` |
| Subscription billing | [`features/subscription-billing/`](features/subscription-billing/spec.md) | Draft | `FEATURE_SUBSCRIPTION`, `FEATURE_SUBSCRIPTION_BILLING` |
| Regional compliance packs | [`features/regional-compliance-packs/`](features/regional-compliance-packs/spec.md) | Draft | `FEATURE_REGIONAL_PACKS`, `FEATURE_E_INVOICING` |
| Fixed assets | [`features/fixed-assets/`](features/fixed-assets/spec.md) | Draft | `FEATURE_FIXED_ASSETS` |
| Item catalogue | [`features/item-catalogue/`](features/item-catalogue/spec.md) | Draft | `FEATURE_ITEM_MASTER` |
| Pricing and promotions | [`features/pricing-and-promotions/`](features/pricing-and-promotions/spec.md) | Draft | `FEATURE_PRICING_RULES` |
| Sales order management | [`features/sales-order-management/`](features/sales-order-management/spec.md) | Draft | `FEATURE_SALES` |
| Procurement | [`features/procurement/`](features/procurement/spec.md) | Draft | `FEATURE_PURCHASING` |
| Delivery and shipping | [`features/delivery-and-shipping/`](features/delivery-and-shipping/spec.md) | Draft | `FEATURE_FULFILLMENT`, `FEATURE_RETURNS`, `FEATURE_DELIVERY_TRIPS` |
| Point of sale and loyalty | [`features/point-of-sale-and-loyalty/`](features/point-of-sale-and-loyalty/spec.md) | Draft | `FEATURE_POINT_OF_SALE`, `FEATURE_LOYALTY` |
| Warehouse and stock movements | [`features/warehouse-and-stock-movements/`](features/warehouse-and-stock-movements/spec.md) | Draft | `FEATURE_WAREHOUSE` |
| Stock ledger and valuation | [`features/stock-ledger-and-valuation/`](features/stock-ledger-and-valuation/spec.md) | Draft | `FEATURE_INVENTORY_VALUATION` |
| Lots and serial units | [`features/serials-and-batches/`](features/serials-and-batches/spec.md) | Draft | `FEATURE_LOT_SERIAL_TRACKING` |
| Quality management | [`features/quality-management/`](features/quality-management/spec.md) | Draft | `FEATURE_QUALITY` |
| Bills of materials and routings | [`features/manufacturing-bom-and-routing/`](features/manufacturing-bom-and-routing/spec.md) | Draft | `FEATURE_MANUFACTURING` |
| Shop floor and work orders | [`features/shop-floor-and-work-orders/`](features/shop-floor-and-work-orders/spec.md) | Draft | `FEATURE_MANUFACTURING` |
| Production planning | [`features/production-planning/`](features/production-planning/spec.md) | Draft | `FEATURE_PRODUCTION_PLANNING` |
| Subcontracting | [`features/subcontracting/`](features/subcontracting/spec.md) | Draft | `FEATURE_SUBCONTRACTING` |
| Maintenance and field service | [`features/maintenance-and-field-service/`](features/maintenance-and-field-service/spec.md) | Draft | `FEATURE_FIELD_SERVICE` |
| HR core and employee lifecycle | [`features/hr-core-lifecycle/`](features/hr-core-lifecycle/spec.md) | Draft | `FEATURE_HR_LIFECYCLE` |
| Time-off management | [`features/time-off-management/`](features/time-off-management/spec.md) | Draft | `FEATURE_TIME_OFF_POLICIES` |
| Attendance and shifts | [`features/attendance-and-shifts/`](features/attendance-and-shifts/spec.md) | Draft | `FEATURE_ATTENDANCE`, `FEATURE_SHIFTS` |
| Payroll setup | [`features/payroll-setup/`](features/payroll-setup/spec.md) | Draft | `FEATURE_PAYROLL` |
| Payroll processing | [`features/payroll-processing/`](features/payroll-processing/spec.md) | Draft | `FEATURE_PAYROLL` |
| Expenses and travel | [`features/expenses-and-travel/`](features/expenses-and-travel/spec.md) | Draft | `FEATURE_EXPENSE_CLAIMS` |
| Recruitment | [`features/recruitment/`](features/recruitment/spec.md) | Draft | `FEATURE_RECRUITMENT` |
| Performance management | [`features/performance-management/`](features/performance-management/spec.md) | Draft | `FEATURE_PERFORMANCE_REVIEWS` |
| Learning management | [`features/learning-management/`](features/learning-management/spec.md) | Draft | `FEATURE_LEARNING` |
| Project costing and billing | [`features/project-costing-and-billing/`](features/project-costing-and-billing/spec.md) | Draft | `FEATURE_PROJECT_COSTING` |
| CRM leads and deals | [`features/crm-leads-and-deals/`](features/crm-leads-and-deals/spec.md) | Draft | `FEATURE_CRM` |
| CRM engagement | [`features/crm-engagement/`](features/crm-engagement/spec.md) | Draft | `FEATURE_CRM` |
| CRM forecasting and analytics | [`features/crm-forecasting-and-analytics/`](features/crm-forecasting-and-analytics/spec.md) | Draft | `FEATURE_CRM` |
| Lead capture and enrichment | [`features/lead-capture-and-enrichment/`](features/lead-capture-and-enrichment/spec.md) | Draft | `FEATURE_LEAD_CAPTURE` |
| Marketing campaigns | [`features/marketing-campaigns/`](features/marketing-campaigns/spec.md) | Draft | `FEATURE_CAMPAIGNS` |
| Telephony | [`features/telephony/`](features/telephony/spec.md) | Draft | `FEATURE_TELEPHONY` |
| Helpdesk tickets | [`features/helpdesk-tickets/`](features/helpdesk-tickets/spec.md) | Draft | `FEATURE_HELPDESK` |
| Helpdesk service levels, routing and analytics | [`features/helpdesk-sla-routing-and-analytics/`](features/helpdesk-sla-routing-and-analytics/spec.md) | Draft | `FEATURE_HELPDESK` |
| Customer and supplier portal | [`features/customer-and-supplier-portal/`](features/customer-and-supplier-portal/spec.md) | Draft | `FEATURE_CUSTOMER_PORTAL` |
| Helpdesk portal and knowledge base | [`features/helpdesk-portal-and-knowledge-base/`](features/helpdesk-portal-and-knowledge-base/spec.md) | Draft | `FEATURE_HELPDESK_PORTAL` |
| Commerce connectors | [`features/commerce-connectors/`](features/commerce-connectors/spec.md) | Draft | `FEATURE_COMMERCE_CONNECTORS` |
| Drive (files and folders of the Documents hub) | [`features/drive/`](features/drive/spec.md) | Draft | `FEATURE_DRIVE` |
| Documents and wiki (pages, wiki spaces, review, publishing) | [`features/documents-and-wiki/`](features/documents-and-wiki/spec.md) | Draft | `FEATURE_WIKI` |
| Spreadsheets | [`features/spreadsheets/`](features/spreadsheets/spec.md) | Draft | `FEATURE_SPREADSHEETS` |
| Presentations | [`features/presentations/`](features/presentations/spec.md) | Draft | `FEATURE_PRESENTATIONS` |
| Calendar and Scheduling | [`features/calendar-and-scheduling/`](features/calendar-and-scheduling/spec.md) | Draft | `FEATURE_CALENDAR` |
| Meetings | [`features/meetings/`](features/meetings/spec.md) | Draft | `FEATURE_MEETINGS` |
| Mail | [`features/mail/`](features/mail/spec.md) | Draft | `FEATURE_MAIL` |
| Chat messaging | [`features/chat-messaging/`](features/chat-messaging/spec.md) | Draft | `GAUZY_CHAT_ENABLED`, `FEATURE_CHAT` |
| Chat agents, bots and record actions | [`features/chat-agents-and-record-actions/`](features/chat-agents-and-record-actions/spec.md) | Draft | `FEATURE_CHAT_RECORD_CARDS`, `FEATURE_CHAT_AGENTS` |
| Chat administration and client capabilities | [`features/chat-administration-and-clients/`](features/chat-administration-and-clients/spec.md) | Draft | `GAUZY_CHAT_ENABLED`, `FEATURE_CHAT`, `FEATURE_CHAT_ADMINISTRATION` |
| Discussions | [`features/discussions/`](features/discussions/spec.md) | Draft | `FEATURE_DISCUSSIONS` |
| AI agents and assistants | [`features/ai-agents-and-assistants/`](features/ai-agents-and-assistants/spec.md) | Draft | `FEATURE_AI_AGENTS` |

Statuses: `Draft` → `In Review` → `Approved` → `Implemented` → `Retrospective`.

## Decisions

| ADR | Decision |
| --- | -------- |
| [`decisions/001-collaboration-api-lives-in-plugins.md`](decisions/001-collaboration-api-lives-in-plugins.md) | New collaboration capabilities ship as plugins with one API consumed by every client |

## Scaffolding a new feature

```bash
bash .specify/scripts/bash/create-new-feature.sh <slug> "Feature Title"
# or, in PowerShell 7:
pwsh -File .specify/scripts/powershell/create-new-feature.ps1 -Slug <slug> -Title "Feature Title"
```

The slug is one lower-case directory name (`a-z`, `0-9`, `-`, at most 64 characters); see
[`.specify/README.md`](../../.specify/README.md) for the prerequisites check.
