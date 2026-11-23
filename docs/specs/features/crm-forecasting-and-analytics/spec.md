# Feature Specification: CRM forecasting and analytics

> Behaviour-first spec per [Constitution Principle X](../../../../.specify/memory/constitution.md#x-specs-are-behaviour-first).
> Describe **what** the system does, not how it is structured. Save implementation
> details for `plan.md`. Mark any unresolved question with `[NEEDS CLARIFICATION: …]`.

**Feature ID**: `crm-forecasting-and-analytics`
**Branch**: `feat/crm-forecasting-and-analytics`
**Status**: `Draft`
**Created**: 2026-11-16
**Last updated**: 2026-11-23
**Owner**: platform maintainers
**Feature flag**: `FEATURE_CRM` (new, default off, shared with `crm-leads-and-deals`); the existing `FEATURE_MULTI_CURRENCY` (default off) governs deals in other currencies

---

## 1. Overview

Once deals carry an owner, an amount, a currency, a probability, an expected close date and an outcome
(`crm-leads-and-deals`), sales managers need to know what the pipeline is worth, what will close and when, and how their
team converts. This feature adds: **deal currency and rates** (every deal valued in the organization currency and the
chosen reporting currency at a recorded rate); the **weighted pipeline**; the **forecast** by period, person and team;
a **configurable CRM dashboard** of metric cards and charts; and the **pipeline, conversion, win-loss, source and owner
reports**, all as report definitions of the report builder, listed with every other report of the platform, so users
can clone, pivot, export and schedule them. Clients: the Angular app (`crm-ui` pages and dashboard, installable on
phones with read-only cards that keep their last figures), the MCP server and in-app assistant, and the SDKs.

Advanced capabilities: the forecast has **categories** (committed, probable, possible, excluded),
**submissions and manager overrides** that roll up a team hierarchy, **snapshots over time** with **pipeline movement**
between any two, and **accuracy tracking** per person and team once a period ends; it includes **recurring revenue** from
recurring deal lines, renewals and live subscriptions, and **delivery capacity from tracked time** so a manager sees
whether the team can deliver what it is about to win; every card and chart **drills down to the records** and updates
**live**; dashboards exist **per user, per team and for the organization**; and an assistant **explains why the forecast
moved** between two snapshots, naming the deals that moved it.

## 2. User Scenarios

### 2.1 Primary scenarios

- **Given** an organization in euros with an open deal of 10,000 US dollars at 60% and a rate of 0.92 valid today, **when** a manager opens the pipeline report, **then** the deal counts 9,200 € in pipeline value and 5,520 € in weighted value, and its row shows the rate, its date and that it came from the rate table.
- **Given** a sales manager with `CRM_FORECAST_VIEW` on the forecast page for "Q4", **when** it opens, **then** they see for their team and each member: closed, committed, probable, possible and weighted amounts, the target where one exists and the gap, each figure linking to its deals.
- **Given** a salesperson with `CRM_FORECAST_SUBMIT`, **when** they submit 120,000 € committed and 150,000 € probable for Q4 with a note, **then** their submission is kept with the time, and their manager sees calculated, submitted and override figures side by side.
- **Given** a manager with `CRM_FORECAST_OVERRIDE`, **when** they override their team's Q4 committed amount to 300,000 € with the reason "two renewals slip", **then** the next level up rolls up 300,000 € for that team and still shows the calculated figure beside it.
- **Given** weekly snapshots since the start of Q4, **when** the manager compares the snapshot of 1 October with today's, **then** they see new deals, increased, decreased, pulled in, pushed out, won and lost amounts, each opening its deals; **when** they ask the assistant "why did the committed amount drop?", **then** it answers in a few sentences naming the three deals that moved it most, writing nothing.
- **Given** Q3 has ended, **when** the manager opens forecast accuracy, **then** each person and team shows, per snapshot week, the error and bias of their calculated, submitted and overridden committed amount against the won amount, and the trend over the last eight quarters.
- **Given** open deals with a 12-month subscription line and active subscriptions renewing in Q1, **when** the manager opens the recurring forecast, **then** new recurring revenue (weighted), renewals due and existing recurring revenue at risk show as monthly and yearly run-rate.
- **Given** committed deals that sell 600 hours of services in January, **when** the manager opens capacity, **then** the delivery team shows 600 hours needed against 450 available from its tracked time and time off, the 150-hour gap, and the deals that cause it.
- **Given** a user on the CRM dashboard, **when** they add the chart "Lost deals by reason" from the catalogue and resize it, **then** their personal dashboard keeps it; **when** they click the "Price" bar, **then** the matching lost deals open as a list; **when** a deal is lost elsewhere, **then** the chart updates within 5 seconds.
- **Given** an agent connected through MCP, **when** it calls `get_forecast` for Q4 and `submit_forecast` with `preview: true`, **then** it receives the figures and the submission it would make, and nothing is written.

### 2.2 Edge cases & failures

- **Given** `FEATURE_CRM` off, **when** a forecast, dashboard or report route is called, **then** `404`; no card, report definition or job of this spec exists.
- **Given** a salesperson without `CRM_ANALYTICS_VIEW_ALL`, **when** they open a report, **then** it shows only their own deals and leads, and filters naming other owners are refused.
- **Given** a deal in Swiss francs with no rate of the pair on its rate date, **then** it is saved, marked "rate missing", left out of money totals in the reporting currency, counted in counts, and listed in the "Deals without a rate" check with a link to enter one.
- **Given** a deal in another currency while `FEATURE_MULTI_CURRENCY` is off, **then** it cannot exist (`crm-leads-and-deals`), and every figure is in the organization currency.
- **Given** a won deal, **when** the rate table changes later, **then** its organization-currency amount keeps the rate of its closed date; **when** it is reopened, **then** it is valued again at the current rate.
- **Given** two managers overriding the same team and period at once, **then** both overrides are kept in the history and the later one is current; each sees the other's.
- **Given** a snapshot already taken, **when** deals change afterwards, **then** the snapshot's figures do not change; a snapshot is never edited or deleted by users.
- **Given** the weekly snapshot job stops half-way, **when** it runs again, **then** it completes the same snapshot without duplicating rows.
- **Given** the organization changes its fiscal start month, **then** past snapshots keep the periods they were taken in and new figures use the new periods; accuracy compares only snapshots of the same period definition.
- **Given** the report builder is not loaded, **then** the default CRM dashboard and the CRM reports still show read-only with their filters; adding, cloning and scheduling need the builder.
- **Given** a deal without an amount, **then** it counts in counts and conversion figures and is listed as "no value" in money figures.
- **Given** a phone without connection, **when** the user opens the dashboard in the installed web app, **then** it shows the last loaded figures with the time they were computed.

## 3. Functional Requirements

### 3.1 Presence and access

- **FR-1** The system MUST answer every route this spec adds with `404` when `FEATURE_CRM` is off; no report definition, card, dashboard, snapshot job or MCP tool of this spec is then observable.
- **FR-2** The system MUST show a user with `CRM_ANALYTICS_VIEW_ALL` every owner's figures, and any other user with `CRM_REPORTS_VIEW` only figures of records they own and of the organization teams they manage; a filter naming other owners is refused for them.
- **FR-3** The system MUST apply the reader's record permissions, including the record-level rules CRM registers ([`crm-engagement`](../crm-engagement/spec.md) FR-76) where they are loaded, to every live figure and to its drill-down list alike: a figure counts only records the reader may read, and its drill-down lists exactly those records. Snapshot and forecast roll-ups are stored totals of a scope, shown under FR-2.

### 3.2 Deal currency and rates

- **FR-4** The system MUST keep on every deal with an amount its amount in the organization currency, the rate used, the rate date and where the rate came from.
- **FR-5** The system MUST resolve a deal's rate in this order: a rate typed on the deal; the stored rate of the pair valid on the rate date; its inverse; a cross rate through the organization currency; else none.
- **FR-6** The system MUST use as rate date the computation day for open deals (re-rated daily and on change) and the closed date for won and lost deals, which keep that rate until reopened.
- **FR-7** The system MUST save a deal without a resolvable rate, mark it "rate missing", leave it out of money totals in organization and reporting currency, keep it in counts, and list it in the check "Deals without a rate".
- **FR-8** A user with `EXCHANGE_RATES_EDIT` can enter a missing rate from the CRM rates page, which lists each currency used by open deals with its latest rate, date and source; rate feeds fill the same table when configured (`general-ledger`).
- **FR-9** A user with `CRM_SETTINGS_EDIT` can choose the CRM reporting currency (default: the organization currency); the system shows every money figure of this spec in it, converted from the organization currency at the rate of the report date, with its symbol and the organization's number and date formats.
- **FR-10** A user with `CRM_REPORTS_VIEW` can show any money report in deal currencies instead, grouped by currency without conversion.

### 3.3 Weighted pipeline

- **FR-11** The system MUST compute for open deals the count, pipeline value (sum of amounts), weighted value (amount × probability) and average value, grouped by stage, pipeline, owner, team, source, deal type, territory, campaign and expected close period.
- **FR-12** The system MUST split deal value into one-time and recurring parts from the deal lines, show recurring value as monthly and yearly run-rate and as total value over the line's term, and offer each as a measure.
- **FR-13** The system MUST list deals with an expected close date in the past as "overdue to close" in pipeline figures and drill-downs.

### 3.4 Forecast

- **FR-14** The system MUST build forecast periods (month, quarter, year) from the organization's fiscal calendar: the accounting fiscal periods when `accounting` is on, else the organization's fiscal start date.
- **FR-15** The system MUST give every open deal a forecast category (possible, probable, committed, excluded) from its stage's category (a stage setting, default by probability bands set in CRM settings); won deals are "closed"; a user with `EDIT_SALES_PIPELINES` can set a deal's category by hand, which holds until the deal changes stage.
- **FR-16** A user with `CRM_FORECAST_VIEW` can open the forecast for a period and a person or team: closed, committed, probable, possible and weighted amounts, the target where one is set for the person or team (the sales targets of `sales-order-management` while it is on, else the organization's sales goal KPIs for that period), and the gap, each opening its deals.
- **FR-17** The system MUST roll forecasts up from owners to their organization teams and to the organization, or along the sales hierarchy of `crm-engagement` when it is loaded and chosen in settings.
- **FR-18** (advanced) A user with `CRM_FORECAST_SUBMIT` can submit their committed and probable amounts for a period with a note; the system keeps every submission with its time and shows the latest as current.
- **FR-19** (advanced) A user with `CRM_FORECAST_OVERRIDE` can override the committed and probable amounts of a team they manage for a period with a reason; the next level rolls up the override instead of the calculated value, and every level shows calculated, submitted and override figures side by side.
- **FR-20** (advanced) The system MUST snapshot weekly (day set in CRM settings), at each period end and on request of a holder of `CRM_FORECAST_OVERRIDE`: every open and recently closed deal's owner, stage, category, amount, currency, rate, organization amount, probability, expected close date and recurring and service parts, plus every roll-up, submission and override.
- **FR-21** The system MUST keep snapshots unchanged and refuse their edit or deletion by users; a snapshot run that stops is completed by the next run without duplicates.
- **FR-22** (advanced) A user with `CRM_FORECAST_VIEW` can compare two snapshots of a period: new, increased, decreased, pulled in from later periods, pushed out to later periods, won and lost amounts and counts, each opening its deals.
- **FR-23** (advanced) The system MUST compute, when a period ends, the accuracy of each snapshot's calculated, submitted and overridden committed amount per person and team against the won amount (error percent and bias, over or under), and show the trend over the last eight periods.
- **FR-24** The system MUST show for a period how its committed, probable and weighted values changed from snapshot to snapshot.
- **FR-25** (advanced) The system MUST show a recurring forecast per period: new recurring revenue of open deals (weighted and by category), renewals due from contracts and renewal deals (`crm-leads-and-deals`), and recurring revenue of active subscriptions with a scheduled cancellation as at risk (`subscription-billing`), as monthly and yearly run-rate.
- **FR-26** (advanced) The system MUST show delivery capacity per period and delivery team: hours needed by the service lines of closed, committed and probable deals (by expected start, default the expected close date) against hours available, computed from each member's weekly hour limit (else their average tracked hours over the last 12 weeks), minus approved time off and the remaining estimates of their open tasks; the gap lists the deals that cause it.
- **FR-27** A user with `EDIT_SALES_PIPELINES` can set a deal's delivery team (an organization team, default from CRM settings) and expected delivery start.
- **FR-28** The system MUST update forecast figures within 5 s of a deal change, with a refresh fallback.
- **FR-29** (advanced) A user with `CRM_FORECAST_VIEW` can ask an assistant to explain the change between two snapshots: a short text naming the deals that moved the figure most and how, plus the structured movement; nothing is written.

### 3.5 CRM dashboard

- **FR-30** The system MUST provide a CRM dashboard per organization with a default layout of the cards and charts marked "default" in §3.7, built on the dashboards of `report-builder-and-dashboards`.
- **FR-31** A user with `CRM_REPORTS_VIEW` can add, remove, resize and reorder cards and charts on their own dashboard by choosing a type (metric card, axis chart, share chart, table, spacer) and then a metric from the CRM catalogue, and reset it to the default layout.
- **FR-32** (advanced) The system MUST keep dashboards per user, per team and for the organization: a user with `CRM_DASHBOARD_MANAGE` edits the organization and team dashboards, and any user can copy one to their own.
- **FR-33** The system MUST filter a dashboard by period presets (last 7, 30, 60 and 90 days, this and last month, quarter and fiscal year) or a custom range, compare with the previous equal period, and filter by owner or team within the reader's rights (FR-2).
- **FR-34** The system MUST update cards and charts within 5 s of a change, offer a manual refresh and show when each figure was computed.
- **FR-35** (advanced) The system MUST open the records behind any card, bar, point or slice as a saved-view list with the matching filter (`record-views-and-search`).
- **FR-36** The system MUST let other plugins contribute cards and charts to the CRM catalogue by registering report definitions tagged for CRM; a contributed definition with the key of a built-in one is ignored and logged.
- **FR-37** The system MUST let dashboards and reports be exported and scheduled by email as the report builder allows, and show the default dashboard and reports read-only, with their filters, while the builder is not loaded.

### 3.6 Reports

- **FR-38** The system MUST register the report definitions of §3.7 with the report builder and list them in the platform's report catalogue under "Sales" (shown per organization like every other report) for tenants with `FEATURE_CRM` on, each filterable by organization, period, owner, team, pipeline, stage, source, deal type, territory and campaign, exportable, and respecting FR-2 and FR-3; for a tenant with `FEATURE_CRM` off the report catalogue, the report menu and the widget list of the custom dashboards show exactly the entries they show today.
- **FR-39** The system MUST count funnel stages from stage history: distinct leads or deals that reached each stage in the chosen cohort, re-entering a stage counting once, lost records counting for the stages they reached, with an option to leave out records lost since.
- **FR-40** The system MUST compute time to close as days from lead creation to conversion and from deal creation to win, as average and median, compared with the previous equal period.
- **FR-41** The system MUST compute win rate by count and by value, average sales cycle of won and of lost deals, and loss by reason, chosen alternative and stage at loss.
- **FR-42** The system MUST compute per source and per campaign attribution: leads, conversions to deals, wins, conversion rates, won value and average won value.
- **FR-43** The system MUST compute per owner: leads, conversions, deals, quotations, orders, wins, won value, conversion ratios, average cycle and, when `crm-engagement` is loaded, activities.
- **FR-44** The system MUST compute, when `crm-engagement` records first responses, the time to first response per day and owner; and, when it records interactions, the leads with at least a set number of interactions and older than a set age that never converted.
- **FR-45** The system MUST compute, per converted lead, the days, the interactions (when `crm-engagement` is loaded) and the tickets (when helpdesk is loaded) before it became a customer.
- **FR-46** The system MUST refresh report figures within 1 minute of a change and answer reports over 500 k deals P95 < 2 s.

### 3.7 Report definitions, cards and charts

- **FR-47** The system MUST register the definitions below; those marked "default" form the default CRM dashboard.

| Definition | Kind | Question it answers |
| --- | --- | --- |
| Leads created | card, default | How many leads were created in the period, against the previous period |
| Deals open now | card, default | How many deals are open now |
| Open deal value weighted by probability | card, default | What the open pipeline is worth weighted by probability |
| Average value of open deals | card | Average amount of open deals |
| Deals won and their value | card, default | Deals won and their value in the period |
| Average value of won deals | card | Average amount of deals won in the period |
| Average value of new deals | card | Average amount of all deals created in the period |
| Share of closed deals won | card, default | Share of closed deals won, by count and by value, over the last 90 days |
| Days from lead to deal | card | Average days from lead creation to conversion, against the previous period |
| Days from deal to win | card | Average days from deal creation to win |
| Committed amount against target | card | Committed forecast against target |
| Leads, deals and wins over time | axis chart, default | Leads, deals and won deals per day or week |
| Weighted forecast and won value by month | axis chart, default | Weighted forecast and won value by expected close month, trailing and coming 12 months |
| Leads and deals reaching each stage | axis chart, default | How many leads and deals reached each stage |
| Open and won deals per stage | axis and share chart, default | Where open and won deals sit, by count and value |
| Lost deals by reason | axis chart, default | Why deals are lost, by reason and stage at loss |
| Deals per territory | axis chart | Count and value per territory |
| Deals per owner | axis chart | Count and value per owner |
| Leads and deals per source | share charts, default | Which sources feed leads and produce deals |
| Open deal summary | table | Count, value and weighted value by stage, owner, source, type or month |
| Open deal value over time | table and chart | Pipeline value per month or quarter by owner, source, type or stage |
| Conversion between stages | table | Conversion rate and median days between consecutive stages |
| Won and lost deals by cause | table | Wins and losses by owner, source, type, reason, chosen alternative and stage at loss |
| List of lost deals | table | Each lost deal with reason, stage, chosen alternative, territory, contact and source |
| List of leads | table | Every lead with owner, stage, source, territory, contact data and address |
| Results per source and campaign | table | Leads, conversions, wins and value per source and campaign |
| Results per owner | table | Leads, deals, quotations, orders, wins and ratios per owner |
| Path from lead to customer | table | Days, interactions and tickets before each lead became a customer |
| Active leads without a deal | table | Leads with many interactions that never converted |
| First response time per day and owner | table and chart | Average time to first response per day and owner |
| Forecast amounts per category | table | Closed, committed, probable, possible and target per person, team and period |
| Forecast error and bias | table and chart | Error and bias per person, team, period and snapshot |
| Changes between two snapshots | table | What changed between two snapshots and which deals did it |
| Recurring revenue outlook | table and chart | New recurring revenue, renewals and revenue at risk per period |
| Delivery hours needed and available | table and chart | Hours needed against hours available per team and period |
| Deals without a rate | table | Open deals whose currency has no rate on their rate date |

### 3.8 MCP tools and assistants

- **FR-48** The system MUST offer MCP and in-app assistant tools to read the pipeline summary, the forecast, a snapshot comparison, accuracy, capacity, any CRM report definition with filters, and the dashboard's figures, under the caller's rights (FR-2); `submit_forecast` and `override_forecast` take `preview: true`.
- **FR-49** (advanced) A user with `CRM_REPORTS_VIEW` can ask an assistant how a card or report figure is computed: the definition, filters, rate rule and the records behind it.
- **FR-50** The system MUST publish forecast submissions, overrides, snapshots taken and accuracy computed as events for automations and webhooks.

## 4. Non-Functional Requirements

- **Performance**: forecast page P95 < 1 s for a team of 50 owners and 20 k open deals; cards P95 < 500 ms; reports P95 < 2 s at 500 k deals and 5 M stage-history rows per tenant; a weekly snapshot of 100 k open deals < 5 min; live updates within 5 s.
- **Volume**: snapshots kept 5 years by default (setting, minimum 2), about 5 M snapshot rows per year for 100 k open deals weekly.
- **Concurrency**: submissions and overrides are append-only; the latest by time is current; snapshot runs hold an organization lock.
- **Reliability**: snapshot, re-rating and accuracy jobs are idempotent per organization and date and catch up after downtime; facts are rebuilt from deals and history on demand.
- **Security & privacy**: tenant and organization scoped; figures respect the reader's rights; snapshots hold owner ids and amounts, no contact details; nothing leaves the platform except scheduled report emails chosen by users and AI provider calls for explanations when an organization configured one.
- **Auditability**: every submission, override (with reason), rate typed on a deal and setting change is kept with who and when.
- **Accessibility and localization**: every chart has a table view and labelled series; colours are not the only signal; numbers, currencies and dates follow the user's locale; strings in all shipped locales.
- **Compatibility**: PostgreSQL, MySQL, SQLite; both ORMs; cloud and self-hosted; OpenAPI and SDKs regenerated.

## 5. Key Entities & Domain Concepts

| Entity / concept | Description |
| --- | --- |
| Deal valuation | A deal's amount in organization currency with the rate, rate date and rate source |
| Reporting currency | The currency every CRM money figure is shown in |
| Forecast category | Possible, probable, committed, excluded or closed, from the stage or set by hand |
| Forecast period | A fiscal month, quarter or year |
| Forecast submission | A person's committed and probable amounts for a period, with a note |
| Forecast override | A manager's committed and probable amounts for a team and period, with a reason |
| Forecast snapshot | Frozen deal values and roll-ups of a moment, for movement and accuracy |
| Forecast accuracy | Error and bias of a snapshot's forecast against the won amount |
| Delivery team, capacity | The team that delivers a deal's services; its hours needed against hours available |
| CRM dashboard | A dashboard of CRM cards and charts for a user, team or organization |
| CRM report definition | A registered report, card or chart over CRM data |

## 6. Out of Scope

- Deal amount, currency, probability, stages, outcomes, lines and contracts themselves → `crm-leads-and-deals`.
- Report builder, dashboard engine, pivots, exports and email schedules → `report-builder-and-dashboards`; free-form analysis across outside data sources: not part of this feature.
- Exchange-rate feeds and revaluation → `general-ledger`; exchange-rate table → existing pricing plugin.
- Sales targets and the sales person and territory trees → `sales-order-management` (goal KPIs serve as targets without it); sales hierarchy, activities and first responses → `crm-engagement`.
- Group counts in any list → `record-views-and-search`; subscription billing → `subscription-billing`; campaign costs and results → `marketing-campaigns`.

## 7. Acceptance Criteria

- [ ] **AC-1** With `FEATURE_CRM` off, every route of this spec answers `404` and no snapshot job runs (FR-1).
- [ ] **AC-2** A foreign-currency deal is valued with the stored rate of its rate date, shows rate, date and source, keeps its closed-date rate after a win and is re-rated when reopened (FR-4–FR-6).
- [ ] **AC-3** A deal without a rate is in counts, out of money totals in organization and reporting currency, in its own currency's total when a report is shown in deal currencies, and in "Deals without a rate"; entering a rate brings it into the converted totals (FR-7, FR-10).
- [ ] **AC-4** Pipeline and weighted values per stage and owner match the demo data set in the reporting currency (FR-11).
- [ ] **AC-5** A salesperson sees only their figures; a manager with `CRM_ANALYTICS_VIEW_ALL` sees all; a filter on another owner is refused for the salesperson; a team manager without `CRM_ANALYTICS_VIEW_ALL` sees the figures of the teams they manage; a deal a record rule hides from the reader is in neither a figure nor its drill-down (FR-2, FR-3).
- [ ] **AC-6** A submission and a team override appear side by side with the calculated figure; the next level rolls up the override (advanced: forecast; FR-18, FR-19).
- [ ] **AC-7** Two weekly snapshots exist; their comparison lists new, pushed-out and won deals correctly; a snapshot is unchanged after deals change (advanced: snapshots; FR-21, FR-22).
- [ ] **AC-8** After a period ends, accuracy shows error and bias per person and team for each snapshot (advanced: accuracy; FR-23).
- [ ] **AC-9** The recurring forecast shows new recurring revenue from deal lines, renewals from contracts and subscriptions at risk (advanced: recurring revenue; FR-25).
- [ ] **AC-10** Capacity shows hours needed by service lines against hours available from tracked time and time off, with the deals behind the gap (advanced: capacity; FR-26).
- [ ] **AC-11** The default CRM dashboard shows every default card and chart; a user adds, resizes and resets a chart; a team dashboard edited by a manager is seen by the team (advanced: dashboards per user and team; FR-30–FR-32).
- [ ] **AC-12** Clicking a chart bar opens the matching deals as a list; losing a deal elsewhere updates the chart within 5 s (advanced: drill-down and live; FR-35).
- [ ] **AC-13** The funnel counts a deal that re-entered a stage once and counts lost deals for the stages they reached (FR-39).
- [ ] **AC-14** Every definition of §3.7 exists, returns correct figures on the demo data set, and exports.
- [ ] **AC-15** With the report builder not loaded, the default dashboard and reports show read-only; the reports are listed under "Sales" on the platform's Reports page; a goal KPI target shows with its gap on the forecast while the Sales app is off (FR-38).
- [ ] **AC-16** `explain_forecast_change` names the deals that moved the committed amount most and writes nothing; `submit_forecast` with preview writes nothing (advanced: assistant; FR-29, FR-48).
- [ ] **AC-17** Works on PostgreSQL, MySQL and SQLite with both ORMs; all functional requirements have a passing test (§4).
- [ ] **AC-18** With `FEATURE_CRM` off, nothing changes: the Reports page and report menu list the same reports in the same categories with the same per-organization menu switches, the custom dashboards offer the same widgets, and the existing pipeline and deal pages show the same fields and behave as before (FR-38).
- [ ] **AC-19** With the feature off, and with the feature on and default settings, every existing page, route, field, permission and report behaves as today (FR-1).

## 8. Open Questions

- Rate date for open deals. Applied default: the computation day (re-rated daily); an organization may later choose the expected close date instead.
- Default category bands. Applied default: committed at 70% and above, probable at 40% and above, possible below, excluded only by hand; stages can name their own category.
- Roll-up hierarchy without `crm-engagement`. Applied default: owner → organization teams the owner belongs to (a person in two teams counts in both team figures and once in the organization).
- Capacity source. Applied default: weekly hour limit of the employee, else the 12-week average of tracked hours; time off and open task estimates are subtracted.
- Snapshot retention. Applied default: 5 years, setting with a 2-year minimum.

## 9. Constitution Gates

- [x] I Plugin-first — sub-modules `forecast/` and `analytics/` of the `crm` plugin and pages in `crm-ui`; core gets nullable deal and stage columns, report catalogue entries and a feature key on report categories.
- [x] II Tenant/organization scoping — every snapshot, submission and dashboard row has tenant and organization.
- [x] III Both ORMs, additive migrations — new tables and nullable columns on three dialects.
- [x] IV Default-off flag; nothing removed — `FEATURE_CRM` off; existing dashboards, widgets and reports untouched.
- [x] V Contracts and API first — contracts in `packages/contracts`; REST first; reports as definitions.
- [x] VI Permissions, privacy, security — new `CRM_*` analytics keys; figures follow the reader's rights.
- [x] VII Real-time through the event bus — deal events drive live figures through the platform push channel.
- [x] VIII i18n and accessibility — table views for charts, locale formats, keys in every locale.
- [x] IX Tests accompany the change — unit tests per calculation, e2e per route, figures on the demo data set.
- [x] X Behaviour-first (this document).
- [x] XI Documentation describes our platform only.

## 10. References

- Plan: [`plan.md`](./plan.md) · Tasks: [`tasks.md`](./tasks.md)
- Depends on: [`../crm-leads-and-deals/spec.md`](../crm-leads-and-deals/spec.md), `report-builder-and-dashboards`
- Works with: [`../sales-order-management/spec.md`](../sales-order-management/spec.md) (targets), [`../general-ledger/spec.md`](../general-ledger/spec.md) (rate feeds), [`../subscription-billing/spec.md`](../subscription-billing/spec.md), [`../record-views-and-search/spec.md`](../record-views-and-search/spec.md), `crm-engagement`, [`../realtime-channel/spec.md`](../realtime-channel/spec.md)
- Code: `packages/plugins/pricing/src/lib/exchange-rate/`, `packages/core/src/lib/dashboard/`, `packages/core/src/lib/reports/`, `packages/core/src/lib/goal-kpi/`, `packages/core/src/lib/goal-time-frame/`, `packages/core/src/lib/saved-report/`, `packages/ui-core/shared/src/lib/dashboard/widgets/`, `packages/core/src/lib/deal/`, `packages/core/src/lib/time-tracking/time-log/`, `packages/plugins/subscription/src/lib/subscription/`
