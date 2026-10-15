# Platform extensions — the phantom design names, triaged

**What this is.** The platform-extensions design (`17` §3.2) promised GraphQL
root fields by name. The audit of every row against the composed schema
(handover 2026-09-20 §7.68) found **81 names in the queries and mutations cells
that appeared nowhere in the code** — six triaged by hand in §7.67, the rest
recorded unclassified because the block mixed a *naming* class (fixed in the
design) with a *missing* class (fixed in the code). **Owner decision 12
(2026-10-13): "I want to triage each, but in the end implement all we need
really!"**

**Method.** Each name is measured against
`packages/core/src/lib/graphql/schema/schema.graphql`: served under its own name
→ `delivered`; the capability served under another root field of the same kind
(checked by reading the delivered route and field, not by name similarity) →
`naming`; retired or rejected by the design itself → `retired`; served by
neither REST nor GraphQL → `build`; not a concept of this platform → `drop`.

**This page is generated** from the table in
`tools/scripts/design-name-triage-check.mjs` (`node
tools/scripts/design-name-triage-check.mjs --write`), and the gate — which CI
runs in `static-checks.yml` — fails when the page and the table differ, when a
`delivered` name stops being served, when an equivalent is not served as the
same kind, when a name that is not `delivered` becomes served, when one of the
81 rows disappears, and when the build backlog grows.

**Where it lives.** The gate checks `tools/scripts/design-name-triage.md` in
`ever-co/ever-gauzy`; the documentation site publishes the same page from
`ever-co/ever-gauzy-docs`
(`website/docs/platform-extensions/design-name-triage.md`), and `node
tools/scripts/design-name-triage-check.mjs --markdown` prints it.

**Totals:** 81 names — **24 delivered**, **49 served under another name**, **2
retired**, **5 to build**, **1 dropped**.

**Design-doc amendments (pending: the design documents are not in this
repository).** Every `naming` row: replace the design name with the served one
in `17` §3.2 (and in Appendix A’s derived counts). Every `retired` row: mark it
`(n-a — retired)` beside its replacement. Every `drop` row: remove it, with the
reason given.

**To build (the backlog the gate counts, 5):** `bulkCreateExpenses`,
`bulkCreateOrganizations`, `bulkCreateTasks`, `bulkCreateTimeLogs`,
`bulkCreateUsers`.

**Dropped, for the owner to confirm (1):** `markEntitySubscriptionRead` — an
entity subscription carries no read state (the read state is the notification’s,
see `markEmployeeNotificationRead`).

| # | design name | kind | class | served equivalent | decision / note |
|---|---|---|---|---|---|
| 1 | `acceptOrderQuote` | Mutation | delivered | `acceptOrderQuote` | nothing: the design row is right — pe/a3-order (§7.75) |
| 2 | `declineOrderQuote` | Mutation | delivered | `declineOrderQuote` | nothing: the design row is right — pe/a3-order (§7.75) |
| 3 | `generateOrderInvoice` | Mutation | delivered | `generateOrderInvoice` | nothing: the design row is right — pe/a3-order (§7.75) |
| 4 | `requestOrderApproval` | Mutation | delivered | `requestOrderApproval` | nothing: the design row is right — pe/a3-order (§7.75) |
| 5 | `sendOrderQuote` | Mutation | delivered | `sendOrderQuote` | nothing: the design row is right — pe/a3-order (§7.75) |
| 6 | `approveSeller` | Mutation | naming | `activateSeller` | amend the design row to the served name — the explicit approval after every verification passed is `activate` (§7.76, item 7 closed) |
| 7 | `acceptTerms` | Mutation | delivered | `acceptTerms` | nothing: the design row is right — terms-acceptance surface |
| 8 | `addTeamMember` | Mutation | delivered | `addTeamMember` | nothing: the design row is right — organization team membership |
| 9 | `bulkCreateTenantRoles` | Mutation | delivered | `bulkCreateTenantRoles` | nothing: the design row is right — mirrors `POST /roles/bulk` |
| 10 | `createReportCategory` | Mutation | delivered | `createReportCategory` | nothing: the design row is right — report categories |
| 11 | `deleteReportCategory` | Mutation | delivered | `deleteReportCategory` | nothing: the design row is right — report categories |
| 12 | `updateReportCategory` | Mutation | delivered | `updateReportCategory` | nothing: the design row is right — report categories |
| 13 | `emailResets` | Query | delivered | `emailResets` | nothing: the design row is right — email reset requests |
| 14 | `invoiceByToken` | Query | delivered | `invoiceByToken` | nothing: the design row is right — public invoice link |
| 15 | `invoiceStatistics` | Query | delivered | `invoiceStatistics` | nothing: the design row is right — invoice statistics |
| 16 | `payrollItems` | Query | delivered | `payrollItems` | nothing: the design row is right — §7.68 named it the one with "no served equivalent at all"; served now |
| 17 | `updatePayrollItem` | Mutation | delivered | `updatePayrollItem` | nothing: the design row is right — payroll items |
| 18 | `reportMenuItems` | Query | delivered | `reportMenuItems` | nothing: the design row is right — §7.68: only `updateReportMenu` was served then |
| 19 | `revokeTenantApiKey` | Mutation | delivered | `revokeTenantApiKey` | nothing: the design row is right — tenant API keys |
| 20 | `updateTenantApiKey` | Mutation | delivered | `updateTenantApiKey` | nothing: the design row is right — tenant API keys |
| 21 | `softDeleteTask` | Mutation | delivered | `softDeleteTask` | nothing: the design row is right — the soft-delete pair |
| 22 | `taskByNumber` | Query | delivered | `taskByNumber` | nothing: the design row is right — task by its project number |
| 23 | `termsAcceptances` | Query | delivered | `termsAcceptances` | nothing: the design row is right — terms-acceptance surface |
| 24 | `upcomingSubscriptionBilling` | Query | delivered | `upcomingSubscriptionBilling` | nothing: the design row is right — a preview of the next billing, priced by the function the cycle bills with; REST `GET /subscriptions/:id/upcoming-billing` |
| 25 | `bulkCreateTags` | Mutation | delivered | `bulkCreateTags` | nothing: the design row is right — delivered: `POST /tags/bulk` + `bulkCreateTags`, every item the single create (`POST /tags` / `createTag`) |
| 26 | `createDepartment` | Mutation | naming | `createOrganizationDepartment` | amend the design row to the served name — REST `/organization-department` |
| 27 | `updateDepartment` | Mutation | naming | `updateOrganizationDepartment` | amend the design row to the served name — REST `/organization-department` |
| 28 | `deleteDepartment` | Mutation | naming | `deleteOrganizationDepartment` | amend the design row to the served name — REST `/organization-department` |
| 29 | `createProject` | Mutation | naming | `createOrganizationProject` | amend the design row to the served name — REST `/organization-projects` |
| 30 | `updateProject` | Mutation | naming | `updateOrganizationProject` | amend the design row to the served name — REST `/organization-projects` |
| 31 | `deleteProject` | Mutation | naming | `deleteOrganizationProject` | amend the design row to the served name — REST `/organization-projects` |
| 32 | `softDeleteProject` | Mutation | naming | `softDeleteOrganizationProject` | amend the design row to the served name — the soft-delete pair |
| 33 | `projectModules` | Query | naming | `organizationProjectModules` | amend the design row to the served name — REST `/organization-project-modules` |
| 34 | `createProjectModule` | Mutation | naming | `createOrganizationProjectModule` | amend the design row to the served name — REST `/organization-project-modules` |
| 35 | `updateProjectModule` | Mutation | naming | `updateOrganizationProjectModule` | amend the design row to the served name — REST `/organization-project-modules` |
| 36 | `deleteProjectModule` | Mutation | naming | `deleteOrganizationProjectModule` | amend the design row to the served name — REST `/organization-project-modules` |
| 37 | `createSprint` | Mutation | naming | `createOrganizationSprint` | amend the design row to the served name — REST `/organization-sprint` |
| 38 | `updateSprint` | Mutation | naming | `updateOrganizationSprint` | amend the design row to the served name — REST `/organization-sprint` |
| 39 | `deleteSprint` | Mutation | naming | `deleteOrganizationSprint` | amend the design row to the served name — REST `/organization-sprint` |
| 40 | `createTeam` | Mutation | naming | `createOrganizationTeam` | amend the design row to the served name — REST `/organization-team` |
| 41 | `updateTeam` | Mutation | naming | `updateOrganizationTeam` | amend the design row to the served name — REST `/organization-team` |
| 42 | `updateTeamMember` | Mutation | naming | `updateOrganizationTeamEmployee` | amend the design row to the served name — a member is an organization-team employee row |
| 43 | `removeTeamMember` | Mutation | naming | `deleteOrganizationTeamEmployee` | amend the design row to the served name — a member is an organization-team employee row |
| 44 | `teamJoinRequests` | Query | naming | `organizationTeamJoinRequests` | amend the design row to the served name — REST `/organization-team-join` |
| 45 | `createTeamJoinRequest` | Mutation | naming | `createOrganizationTeamJoinRequest` | amend the design row to the served name — REST `/organization-team-join` |
| 46 | `acceptTeamJoinRequest` | Mutation | naming | `acceptOrganizationTeamJoinRequest` | amend the design row to the served name — REST `/organization-team-join` |
| 47 | `createRecurringExpense` | Mutation | naming | `createOrganizationRecurringExpense`, `createEmployeeRecurringExpense` | amend the design row to the served name — two resources: the organization and the employee recurring expense |
| 48 | `updateRecurringExpense` | Mutation | naming | `updateOrganizationRecurringExpense`, `updateEmployeeRecurringExpense` | amend the design row to the served name — two resources: the organization and the employee recurring expense |
| 49 | `deleteRecurringExpense` | Mutation | naming | `deleteOrganizationRecurringExpense`, `deleteEmployeeRecurringExpense` | amend the design row to the served name — two resources: the organization and the employee recurring expense |
| 50 | `authorizedUser` | Query | naming | `me` | amend the design row to the served name — the authenticated caller |
| 51 | `confirmEmailReset` | Mutation | naming | `verifyEmailReset` | amend the design row to the served name — REST `POST /email-reset/verify-change-email` |
| 52 | `createTenantApiKey` | Mutation | naming | `generateTenantApiKeyPair` | amend the design row to the served name — a key is generated as a pair, shown once |
| 53 | `createTimeLog` | Mutation | naming | `addManualTime` | amend the design row to the served name — §7.68: a time log a person files is manual time |
| 54 | `updateTimeLog` | Mutation | naming | `updateManualTime` | amend the design row to the served name — §7.68 |
| 55 | `customSmtp` | Query | naming | `customSmtpSetting` | amend the design row to the served name — REST `/smtp` |
| 56 | `updateCustomSmtp` | Mutation | naming | `updateSmtpSetting` | amend the design row to the served name — REST `/smtp` |
| 57 | `importHistory` | Query | naming | `importHistories` | amend the design row to the served name — the import ledger is a list |
| 58 | `invoiceHighest` | Query | naming | `highestInvoiceNumber` | amend the design row to the served name — REST `GET /invoices/highest` |
| 59 | `convertInvoiceToEstimate` | Mutation | naming | `updateInvoiceEstimate` | amend the design row to the served name — REST `PUT /invoices/:id/estimate` flips `isEstimate` |
| 60 | `sendEmailHistory` | Mutation | naming | `resendEmailHistory` | amend the design row to the served name — an email history row is re-sent |
| 61 | `timesheetStatistics` | Query | naming | `timeTrackingCounts`, `timeTrackingMembers`, `timeTrackingProjects`, `timeTrackingTasks`, `timeTrackingManualTimes`, `timeTrackingTimeSlots`, `timeTrackingActivities` | amend the design row to the served name — REST `/timesheet/statistics/*` is a family, served one field per route |
| 62 | `createIntegration` | Mutation | naming | `createIntegrationTenant` | amend the design row to the served name — an integration is configured per tenant; the `integration` catalogue is seeded, read-only |
| 63 | `updateIntegration` | Mutation | naming | `updateIntegrationTenant` | amend the design row to the served name — as `createIntegration` |
| 64 | `deleteIntegration` | Mutation | naming | `deleteIntegrationTenant` | amend the design row to the served name — as `createIntegration` |
| 65 | `updateIntegrationEntitySetting` | Mutation | naming | `updateIntegrationEntitySettings` | amend the design row to the served name — the route writes the set |
| 66 | `integrationEntitySettingTied` | Query | naming | `integrationEntitySettings` | amend the design row to the served name — tied rows are read as `IntegrationEntitySetting.tiedEntities`; REST has no read route of its own |
| 67 | `authorizePayment` | Mutation | naming | `authorizePaymentSession` | amend the design row to the served name — payment reconnaissance (§7.68) |
| 68 | `cancelPayment` | Mutation | naming | `voidPaymentSession` | amend the design row to the served name — §3.6: `POST /payments/:id/cancel` is `voidPaymentSession` |
| 69 | `billSubscriptionNow` | Mutation | naming | `billSubscription` | amend the design row to the served name — REST `POST /subscriptions/:id/bill` |
| 70 | `swapSubscriptionPlan` | Mutation | naming | `changeSubscriptionPlan` | amend the design row to the served name — REST `POST /subscriptions/:id/plan` |
| 71 | `createStockAdjustment` | Mutation | naming | `adjustStock` | amend the design row to the served name — REST `POST /stock-adjustments` drafts; `applyStockAdjustment` applies |
| 72 | `markEmployeeNotificationRead` | Mutation | naming | `updateEmployeeNotification`, `markAllEmployeeNotificationsAsRead` | amend the design row to the served name — one notification: `updateEmployeeNotification` with `isRead`/`readAt`; all of the caller’s: the mark-all route |
| 73 | `deleteSellerOffering` | Mutation | naming | `withdrawSellerOffering`, `softDeleteSellerOffering` | amend the design row to the served name — an offering is withdrawn, never erased (§7.65 item 5, `8eaaa273c81`): `DELETE /seller-offerings/:id` withdraws |
| 74 | `createShippingLabel` | Mutation | retired | `requestFulfillmentLabel` | mark the design row n-a (retired) — design-retired; a carrier label is requested for a shipment |
| 75 | `setProductVariantPrice` | Mutation | retired | `updateProductVariantPrice`, `bulkUpsertProductPrices` | mark the design row n-a (retired) — design-retired |
| 76 | `bulkCreateExpenses` | Mutation | build | — | build (REST + GraphQL), then `delivered` — no `POST /expense/bulk` either; build both surfaces on the bulk kernel (`BulkOperation`/`BulkExecutor`) |
| 77 | `bulkCreateOrganizations` | Mutation | build | — | build (REST + GraphQL), then `delivered` — no REST bulk route either |
| 78 | `bulkCreateTasks` | Mutation | build | — | build (REST + GraphQL), then `delivered` — no REST bulk route either |
| 79 | `bulkCreateTimeLogs` | Mutation | build | — | build (REST + GraphQL), then `delivered` — no REST bulk route either; `addManualTime` one at a time |
| 80 | `bulkCreateUsers` | Mutation | build | — | build (REST + GraphQL), then `delivered` — no REST bulk route either; `createEmployeesBulk` covers employees only |
| 81 | `markEntitySubscriptionRead` | Mutation | drop | — | drop from the design (listed for the owner) — an entity subscription carries no read state (the read state is the notification’s, see `markEmployeeNotificationRead`) |
