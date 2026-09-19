/**
 * The modules Apollo scans for resolvers beside the host and the configured plugins.
 *
 * The host module (`graphql-api.module.ts`) imports the domain modules whose resolvers it hosts, which is
 * the ordinary arrangement: the resolver is a provider of the host, and the host reaches the services it
 * needs by importing them. Seven domains are the exception, and for the same underlying reason — the host
 * importing them pulls a zone into the core barrel's own evaluation that is not yet defined at that point.
 *
 * - `InvoiceModule` and `InvoiceItemModule` already sit in a service cycle with each other's neighbour, so
 *   adding the host as a third participant fails the boot inside the invoice module with a circular
 *   dependency it cannot name precisely.
 * - `ContactModule` and `OrganizationContactModule` reach the organization module, which reaches the tenant
 *   module, the auth module and the refresh-token module — and the refresh-token module reads the token
 *   module while the graph is still being built when the entry point is a token repository. Every spec that
 *   imports the application module enters exactly there, so the host importing them fails those specs
 *   before anything they test is loaded.
 * - `UserModule`, `UserOrganizationModule` and `EmailResetModule` are the same zone by another road: a user
 *   membership reaches the organization module, which reaches the channel module, which reaches the host
 *   module — so the host importing one of them closes a circle it is already standing in.
 *
 * Their resolvers are therefore declared by their own modules, and naming those modules in the Apollo
 * `include` list is what makes the endpoint scan them where they live — the same arrangement a plugin's
 * resolvers use. Nothing about the resolvers themselves changes: they call the same services they called
 * while the host declared them.
 *
 * **Why this is a function rather than an array.** The option is read while the GraphQL module is being
 * assembled, and the classes are required at that moment rather than at the top of this file. A
 * module-scope `import` here would put the very zones named above back into the core barrel's evaluation
 * — the edge this exists to remove. Deferring the require to the point of use costs nothing: nothing loads
 * these modules until a GraphQL endpoint is actually configured.
 *
 * @returns The modules that declare a resolver the host cannot host.
 */
export function resolveAdditionalResolverModules(): Function[] {
	return [
		require('../invoice/invoice.module').InvoiceModule,
		require('../invoice-item/invoice-item.module').InvoiceItemModule,
		require('../contact/contact.module').ContactModule,
		require('../organization-contact/organization-contact.module').OrganizationContactModule,
		// The identity zone: a user membership reaches the organization module, which reaches the
		// channel module, which reaches the host module — and the host importing any of them closes the
		// circle it is already inside. Their resolvers are declared by their own modules.
		require('../user/user.module').UserModule,
		require('../user-organization/user-organization.module').UserOrganizationModule,
		// The reset flow imports the user, employee, auth and email-send modules, which is the same zone
		// by another road.
		require('../email-reset/email-reset.module').EmailResetModule,
		// The aggregates read across the whole platform — employees, teams, tenants, users, invoices,
		// payments, tasks and tracked time — so this module sits in the middle of every one of those
		// graphs and cannot be pulled into the barrel that is already inside them.
		require('../stats/stats.module').StatsModule,
		// The organization zone: the aggregate itself and the seven resources the platform serves beside
		// it. Each reaches the organization graph, which is the graph the tenant, auth and refresh-token
		// modules are reached from — so they are scanned where they live rather than imported by the host.
		require('../organization/organization.module').OrganizationModule,
		require('../organization-award/organization-award.module').OrganizationAwardModule,
		require('../organization-document/organization-document.module').OrganizationDocumentModule,
		require('../organization-employment-type/organization-employment-type.module')
			.OrganizationEmploymentTypeModule,
		require('../organization-language/organization-language.module').OrganizationLanguageModule,
		require('../organization-position/organization-position.module').OrganizationPositionModule,
		require('../organization-strategic-initiative/organization-strategic-initiative.module')
			.OrganizationStrategicInitiativeModule,
		require('../organization-task-setting/organization-task-setting.module').OrganizationTaskSettingModule,
		// The tenant itself and the keys a machine caller authenticates with, beside the integration rows
		// an outbound sync is configured in: the same zone by another road.
		require('../tenant/tenant.module').TenantModule,
		require('../tenant-api-key/tenant-api-key.module').TenantApiKeyModule,
		require('../integration/integration.module').IntegrationModule,
		require('../integration-setting/integration-setting.module').IntegrationSettingModule,
		require('../integration-entity-setting/integration-entity-setting.module').IntegrationEntitySettingModule,
		require('../integration-entity-setting-tied/integration-entity-setting-tied.module')
			.IntegrationEntitySettingTiedModule,
		require('../integration-tenant/integration-tenant.module').IntegrationTenantModule,
		// The people the platform sells and ships through: the employee aggregate, the resources the
		// platform serves beside it, and the statistics computed over them. The aggregate reaches the user
		// and organization modules, which is the identity zone again, so the whole set is scanned where it
		// lives.
		require('../employee/employee.module').EmployeeModule,
		require('../employee-appointment/employee-appointment.module').EmployeeAppointmentModule,
		require('../employee-availability/employee-availability.module').EmployeeAvailabilityModule,
		require('../availability-slots/availability-slots.module').AvailabilitySlotsModule,
		require('../employee-award/employee-award.module').EmployeeAwardModule,
		require('../employee-level/employee-level.module').EmployeeLevelModule,
		require('../employee-notification/employee-notification.module').EmployeeNotificationModule,
		require('../employee-notification-setting/employee-notification-setting.module')
			.EmployeeNotificationSettingModule,
		require('../employee-recent-visit/employee-recent-visit.module').EmployeeRecentVisitModule,
		require('../employee-setting/employee-setting.module').EmployeeSettingModule,
		require('../employee-statistics/employee-statistics.module').EmployeeStatisticsModule,
		require('../appointment-employees/appointment-employees.module').AppointmentEmployeesModule,
		// The work-tracking domain: a task, the vocabularies a task points at, the plans it is scheduled
		// into and the views that select it. It reaches the tag and organization graphs, so it is scanned
		// here too rather than pulled into the barrel those graphs are already inside.
		require('../tasks/task.module').TaskModule,
		require('../tasks/task-metadata-bootstrap/task-metadata-bootstrap.module').TaskMetadataBootstrapModule,
		require('../tasks/estimation/task-estimation.module').TaskEstimationModule,
		require('../tasks/linked-issue/task-linked-issue.module').TaskLinkedIssueModule,
		require('../tasks/views/view.module').TaskViewModule,
		require('../tasks/daily-plan/daily-plan.module').DailyPlanModule,
		require('../tasks/screening-tasks/screening-tasks.module').ScreeningTasksModule,
		// The tracked time and the time off beside it. `TimeTrackingModule` is the umbrella the nine
		// time-tracking resource modules hang from, and the scan follows a named module's transitive
		// imports — so one entry covers the timesheet, the log, the timer, the slots, the activities, the
		// custom tracking, the screenshots, the statistics and the timesheet change requests together.
		require('../time-tracking/time-tracking.module').TimeTrackingModule,
		require('../time-off-balance/time-off-balance.module').TimeOffBalanceModule,
		require('../time-off-policy/time-off-policy.module').TimeOffPolicyModule,
		require('../time-off-request/time-off-request.module').TimeOffRequestModule,
		// The project and team group. Four of these seven are reachable through the modules already named
		// above, but reachability by graph accident is not a statement: all seven are named, so a resolver
		// is discovered because the configuration says so rather than because some other module happens to
		// import the one it lives in.
		require('../organization-project/organization-project.module').OrganizationProjectModule,
		require('../organization-project-module/organization-project-module.module').OrganizationProjectModuleModule,
		require('../organization-sprint/organization-sprint.module').OrganizationSprintModule,
		require('../organization-team/organization-team.module').OrganizationTeamModule,
		require('../organization-team-employee/organization-team-employee.module').OrganizationTeamEmployeeModule,
		require('../organization-team-join-request/organization-team-join-request.module')
			.OrganizationTeamJoinRequestModule,
		require('../organization-department/organization-department.module').OrganizationDepartmentModule,
		// The goals an organization sets and the results it measures them by, with the templates and the
		// vocabulary rows beside them.
		require('../goal/goal.module').GoalModule,
		require('../goal-kpi/goal-kpi.module').GoalKpiModule,
		require('../goal-kpi-template/goal-kpi-template.module').GoalKpiTemplateModule,
		require('../goal-template/goal-template.module').GoalTemplateModule,
		require('../goal-time-frame/goal-time-frame.module').GoalTimeFrameModule,
		require('../goal-general-setting/goal-general-setting.module').GoalGeneralSettingModule,
		require('../keyresult/keyresult.module').KeyResultModule,
		require('../keyresult-template/keyresult-template.module').KeyresultTemplateModule,
		require('../keyresult-update/keyresult-update.module').KeyResultUpdateModule,
		// What the organization spends: the expense rows, the categories they are filed under, the two
		// recurring families and the income beside them.
		require('../expense/expense.module').ExpenseModule,
		require('../expense-categories/expense-categories.module').ExpenseCategoriesModule,
		require('../employee-recurring-expense/employee-recurring-expense.module').EmployeeRecurringExpenseModule,
		require('../organization-recurring-expense/organization-recurring-expense.module')
			.OrganizationRecurringExpenseModule,
		require('../income/income.module').IncomeModule,
		// The supplier master an expense points at, which sits beside those resources and belongs to them.
		require('../organization-vendor/organization-vendor.module').OrganizationVendorModule,
		// The equipment an employee is issued and the events and announcements the platform sends.
		require('../equipment/equipment.module').EquipmentModule,
		require('../equipment-sharing/equipment-sharing.module').EquipmentSharingModule,
		require('../equipment-sharing-policy/equipment-sharing-policy.module').EquipmentSharingPolicyModule,
		require('../event-types/event-type.module').EventTypeModule,
		require('../broadcast/broadcast.module').BroadcastModule,
		// The sales pipeline and the reference data beside it.
		require('../deal/deal.module').DealModule,
		require('../pipeline/pipeline.module').PipelineModule,
		require('../merchant/merchant.module').MerchantModule,
		require('../warehouse/warehouse.module').WarehouseModule,
		require('../skills/skill.module').SkillModule,
		require('../language/language.module').LanguageModule,
		require('../official-holiday/official-holiday.module').OfficialHolidayModule,
		require('../resource-link/resource-link.module').ResourceLinkModule,
		require('../shared-entity/shared-entity.module').SharedEntityModule,
		require('../image-asset/image-asset.module').ImageAssetModule,
		// The access and account periphery: what the platform recorded, what it asked for approval of,
		// what a person marked, wrote or was mentioned in, and what they were invited to.
		require('../activity-log/activity-log.module').ActivityLogModule,
		require('../api-call-log/api-call-log.module').ApiCallLogModule,
		require('../entity-subscription/entity-subscription.module').EntitySubscriptionModule,
		require('../request-approval/request-approval.module').RequestApprovalModule,
		require('../approval-policy/approval-policy.module').ApprovalPolicyModule,
		require('../terms-acceptance/terms-acceptance.module').TermsAcceptanceModule,
		require('../invite/invite.module').InviteModule,
		require('../favorite/favorite.module').FavoriteModule,
		require('../reaction/reaction.module').ReactionModule,
		require('../comment/comment.module').CommentModule,
		require('../mention/mention.module').MentionModule,
		// The platform's own services: a registered client, the templates accounting renders, the messages
		// it sent, a payroll run with its lines, the import ledger, and the two reads a signed-out caller
		// reaches with a token.
		require('../auth/oauth-client/oauth-client.module').OAuthClientModule,
		require('../accounting-template/accounting-template.module').AccountingTemplateModule,
		require('../email-history/email-history.module').EmailHistoryModule,
		require('../payroll-run/payroll-run.module').PayrollRunModule,
		require('../export-import/import-history/import-history.module').ImportHistoryModule,
		require('../estimate-email/estimate-email.module').EstimateEmailModule,
		require('../invoice-estimate-history/invoice-estimate-history.module').InvoiceEstimateHistoryModule,
		require('../email-check/email-check.module').EmailCheckModule,
		// Recruiting: the candidacy, the five rows filed against it, the sitting with its verdicts,
		// vocabulary and panel, and the criterion ratings.
		require('../candidate/candidate.module').CandidateModule,
		require('../candidate-feedbacks/candidate-feedbacks.module').CandidateFeedbacksModule,
		require('../candidate-interview/candidate-interview.module').CandidateInterviewModule,
		require('../candidate-interviewers/candidate-interviewers.module').CandidateInterviewersModule,
		require('../candidate-criterions-rating/candidate-criterion-rating.module').CandidateCriterionsRatingModule
	];
}
