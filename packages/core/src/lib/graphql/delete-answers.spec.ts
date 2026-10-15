/**
 * A `delete*` field answers whether a row was removed — owner decision, handover 2026-09-20 §7.65 item 21:
 * "GraphQL delete of a non-existent id answers false".
 *
 * Every field below used to `await` its dependency and then `return true`. The dependency hands back the
 * store's `DeleteResult` without reading the row first (`TenantAwareCrudService.delete`, the commands that
 * call it, and the services that narrow it — a system role, a status the platform maintains), so an
 * identifier that names no row, or another tenant's row, ran a statement that touched nothing and the field
 * still told the caller the row was gone, while the REST route returned the same result with `affected: 0`.
 * The fields now answer from that count through `answersDeleted`, the way the cart, fulfillment and order
 * fields already did.
 *
 * For every converted field the table pins three things against a stubbed dependency, so the suite fails on
 * the old bodies (an unconditional `true`) and on any later body that stops reading the count or changes
 * what it hands over:
 *
 * - `{ affected: 0 }` → `false`;
 * - `{ affected: 1 }` → `true`;
 * - the dependency receives exactly the arguments it received before the conversion — the conversion
 *   changes the answer, never the call.
 *
 * The resolver is built from its prototype with only the dependency the field awaits, so nothing but the
 * field body runs; the guards and permissions on each field are pinned by that resolver's own suite.
 */
import { RecurringExpenseDeletionEnum } from '@gauzy/contracts';
import { RequestContext } from '../core/context';
import { AccountingTemplateResolver } from '../accounting-template/accounting-template.resolver';
import { ApiCallLogResolver } from '../api-call-log/api-call-log.resolver';
import { AppointmentEmployeesResolver } from '../appointment-employees/appointment-employees.resolver';
import { ApprovalPolicyResolver } from '../approval-policy/approval-policy.resolver';
import { AvailabilitySlotsResolver } from '../availability-slots/availability-slots.resolver';
import { BroadcastResolver } from '../broadcast/broadcast.resolver';
import { CandidateCriterionsRatingBulkDeleteCommand } from '../candidate-criterions-rating/commands/candidate-criterions-rating.bulk.delete.command';
import { CandidateCriterionsRatingResolver } from '../candidate-criterions-rating/candidate-criterion-rating.resolver';
import { FeedbackDeleteCommand } from '../candidate-feedbacks/commands/candidate-feedbacks.delete.command';
import { CandidateFeedbacksResolver } from '../candidate-feedbacks/candidate-feedbacks.resolver';
import { CandidateInterviewVocabularyResolver } from '../candidate-interview/candidate-interview-vocabulary.resolver';
import { CandidateInterviewResolver } from '../candidate-interview/candidate-interview.resolver';
import { CandidateInterviewersEmployeeBulkDeleteCommand } from '../candidate-interviewers/commands/candidate-interviewers.employee.bulk.delete.command';
import { CandidateInterviewersInterviewBulkDeleteCommand } from '../candidate-interviewers/commands/candidate-interviewers.interview.bulk.delete.command';
import { CandidateInterviewersResolver } from '../candidate-interviewers/candidate-interviewers.resolver';
import { CandidatePersonalQualitiesBulkDeleteCommand } from '../candidate-personal-qualities/commands/candidate-personal-qualities.bulk.delete.command';
import { CandidateTechnologiesBulkDeleteCommand } from '../candidate-technologies/commands/candidate-technologies.bulk.delete.command';
import { CandidateProfileResolver } from '../candidate/candidate-profile.resolver';
import { CandidateResolver } from '../candidate/candidate.resolver';
import { CommentResolver } from '../comment/comment.resolver';
import { ContactResolver } from '../contact/contact.resolver';
import { CustomSmtpResolver } from '../custom-smtp/custom-smtp.resolver';
import { DashboardWidgetResolver } from '../dashboard/dashboard-widget/dashboard-widget.resolver';
import { DashboardResolver } from '../dashboard/dashboard.resolver';
import { DealResolver } from '../deal/deal.resolver';
import { EmailTemplateResolver } from '../email-template/email-template.resolver';
import { EmployeeAppointmentResolver } from '../employee-appointment/employee-appointment.resolver';
import { EmployeeAvailabilityResolver } from '../employee-availability/employee-availability.resolver';
import { EmployeeAwardResolver } from '../employee-award/employee-award.resolver';
import { EmployeeLevelResolver } from '../employee-level/employee-level.resolver';
import { EmployeeNotificationSettingResolver } from '../employee-notification-setting/employee-notification-setting.resolver';
import { EmployeeNotificationResolver } from '../employee-notification/employee-notification.resolver';
import { EmployeeRecurringExpenseDeleteCommand } from '../employee-recurring-expense/commands/employee-recurring-expense.delete.command';
import { EmployeeRecurringExpenseResolver } from '../employee-recurring-expense/employee-recurring-expense.resolver';
import { EmployeeSettingResolver } from '../employee-setting/employee-setting.resolver';
import { EmployeeResolver } from '../employee/employee.resolver';
import { EquipmentSharingPolicyResolver } from '../equipment-sharing-policy/equipment-sharing-policy.resolver';
import { EquipmentSharingResolver } from '../equipment-sharing/equipment-sharing.resolver';
import { EquipmentResolver } from '../equipment/equipment.resolver';
import { EventTypeResolver } from '../event-types/event-type.resolver';
import { ExpenseCategoriesResolver } from '../expense-categories/expense-categories.resolver';
import { ExpenseDeleteCommand } from '../expense/commands/expense.delete.command';
import { ExpenseResolver } from '../expense/expense.resolver';
import { FavoriteResolver } from '../favorite/favorite.resolver';
import { GoalGeneralSettingResolver } from '../goal-general-setting/goal-general-setting.resolver';
import { GoalKpiTemplateResolver } from '../goal-kpi-template/goal-kpi-template.resolver';
import { GoalKpiResolver } from '../goal-kpi/goal-kpi.resolver';
import { GoalTemplateResolver } from '../goal-template/goal-template.resolver';
import { GoalTimeFrameResolver } from '../goal-time-frame/goal-time-frame.resolver';
import { GoalResolver } from '../goal/goal.resolver';
import { IncomeDeleteCommand } from '../income/commands/income.delete.command';
import { IncomeResolver } from '../income/income.resolver';
import { IntegrationTenantDeleteCommand } from '../integration-tenant/commands/integration-tenant.delete.command';
import { IntegrationTenantResolver } from '../integration-tenant/integration-tenant.resolver';
import { InviteResolver } from '../invite/invite.resolver';
import { InvoiceEstimateHistoryResolver } from '../invoice-estimate-history/invoice-estimate-history.resolver';
import { InvoiceItemResolver } from '../invoice-item/invoice-item.resolver';
import { InvoiceDeleteCommand } from '../invoice/commands/invoice.delete.command';
import { InvoiceResolver } from '../invoice/invoice.resolver';
import { KeyResultTemplateResolver } from '../keyresult-template/keyresult-template.resolver';
import { KeyResultUpdateBulkDeleteCommand } from '../keyresult-update/commands/keyresult-update.bulk.delete.command';
import { KeyResultUpdateResolver } from '../keyresult-update/keyresult-update.resolver';
import { KeyResultResolver } from '../keyresult/keyresult.resolver';
import { MentionResolver } from '../mention/mention.resolver';
import { MerchantResolver } from '../merchant/merchant.resolver';
import { OfficialHolidayResolver } from '../official-holiday/official-holiday.resolver';
import { OrganizationAwardResolver } from '../organization-award/organization-award.resolver';
import { OrganizationContactResolver } from '../organization-contact/organization-contact.resolver';
import { OrganizationDepartmentResolver } from '../organization-department/organization-department.resolver';
import { OrganizationDocumentResolver } from '../organization-document/organization-document.resolver';
import { OrganizationEmploymentTypeResolver } from '../organization-employment-type/organization-employment-type.resolver';
import { OrganizationLanguageResolver } from '../organization-language/organization-language.resolver';
import { OrganizationPositionResolver } from '../organization-position/organization-position.resolver';
import { OrganizationProjectModuleResolver } from '../organization-project-module/organization-project-module.resolver';
import { OrganizationProjectResolver } from '../organization-project/organization-project.resolver';
import { OrganizationRecurringExpenseDeleteCommand } from '../organization-recurring-expense/commands/organization-recurring-expense.delete.command';
import { OrganizationRecurringExpenseResolver } from '../organization-recurring-expense/organization-recurring-expense.resolver';
import { OrganizationSprintResolver } from '../organization-sprint/organization-sprint.resolver';
import { OrganizationStrategicInitiativeResolver } from '../organization-strategic-initiative/organization-strategic-initiative.resolver';
import { OrganizationTeamEmployeeResolver } from '../organization-team-employee/organization-team-employee.resolver';
import { OrganizationTeamResolver } from '../organization-team/organization-team.resolver';
import { OrganizationVendorResolver } from '../organization-vendor/organization-vendor.resolver';
import { OrganizationResolver } from '../organization/organization.resolver';
import { PaymentResolver } from '../payment/payment.resolver';
import { PipelineResolver } from '../pipeline/pipeline.resolver';
import { ProductCategoryResolver } from '../product-category/product-category.resolver';
import { ProductOptionResolver } from '../product-option/product-option.resolver';
import { ProductVariantSettingResolver } from '../product-setting/product-setting.resolver';
import { ProductTypeResolver } from '../product-type/product-type.resolver';
import { ProductVariantPriceResolver } from '../product-variant-price/product-variant-price.resolver';
import { ProductVariantDeleteCommand } from '../product-variant/commands/product-variant.delete.command';
import { ProductVariantResolver } from '../product-variant/product-variant.resolver';
import { ProductDeleteCommand } from '../product/commands/product.delete.command';
import { ProductResolver } from '../product/product.resolver';
import { ReactionResolver } from '../reaction/reaction.resolver';
import { RequestApprovalResolver } from '../request-approval/request-approval.resolver';
import { ResourceLinkResolver } from '../resource-link/resource-link.resolver';
import { RolePermissionResolver } from '../role-permission/role-permission.resolver';
import { RoleEntityResolver } from '../role/role-entity.resolver';
import { SharedEntityResolver } from '../shared-entity/shared-entity.resolver';
import { SkillResolver } from '../skills/skill.resolver';
import { TagTypeResolver } from '../tag-type/tag-type.resolver';
import { TagResolver } from '../tags/tag.resolver';
import { DailyPlanResolver } from '../tasks/daily-plan/daily-plan.resolver';
import { TaskEstimationDeleteCommand } from '../tasks/estimation/commands/task-estimation-delete.command';
import { TaskEstimationResolver } from '../tasks/estimation/task-estimation.resolver';
import { TaskLinkedIssueResolver } from '../tasks/linked-issue/task-linked-issue.resolver';
import { ScreeningTaskResolver } from '../tasks/screening-tasks/screening-task.resolver';
import { TaskMetadataResolver } from '../tasks/task-metadata.resolver';
import { TaskResolver } from '../tasks/task.resolver';
import { TaskViewResolver } from '../tasks/views/view.resolver';
import { TenantSettingResolver } from '../tenant/tenant-setting/tenant-setting.resolver';
import { TenantResolver } from '../tenant/tenant.resolver';
import { TimeOffPolicyResolver } from '../time-off-policy/time-off-policy.resolver';
import { TimeOffRequestResolver } from '../time-off-request/time-off-request.resolver';
import { TimeLogResolver } from '../time-tracking/time-log/time-log.resolver';
import { UserOrganizationDeleteCommand } from '../user-organization/commands/user-organization.delete.command';
import { UserOrganizationResolver } from '../user-organization/user-organization.resolver';
import { UserDeleteCommand } from '../user/commands/user.delete.command';
import { UserResolver } from '../user/user.resolver';
import { WarehouseResolver } from '../warehouse/warehouse.resolver';
import { WebhookResolver } from '../webhook/webhook.resolver';

const ID = 'row-1';
const TENANT = 'tenant-1';
const ORGANIZATION = 'organization-1';
const ALL = { deletionType: RecurringExpenseDeletionEnum.ALL, month: 6, year: 2026 };

/** One converted field. */
interface IDeleteAnswerRow {
	/** The GraphQL field, which is also the resolver method's name. */
	field: string;
	/** The resolver class that serves it. */
	resolver: { prototype: object };
	/** The property the resolver holds the awaited dependency under. */
	service: string;
	/** The dependency's method whose result the field now answers from. */
	method: string;
	/** The field's arguments, in declaration order. */
	args: unknown[];
	/** What the dependency must receive — the same as before the conversion. */
	expected: unknown[];
	/** Methods of the same dependency the field awaits first: what each answers and must receive. */
	before?: Record<string, { answers: unknown; expected: unknown[] }>;
}

/** A field that hands its identifier to the dependency's `delete` (or the named method) and nothing else. */
function byId(field: string, resolver: { prototype: object }, service: string, method = 'delete'): IDeleteAnswerRow {
	return { field, resolver, service, method, args: [ID], expected: [ID] };
}

/** A field that dispatches one command; the command must be the same class with the same members. */
function byCommand(field: string, resolver: { prototype: object }, args: unknown[], command: object): IDeleteAnswerRow {
	return { field, resolver, service: 'commandBus', method: 'execute', args, expected: [command] };
}

const ROWS: IDeleteAnswerRow[] = [
	byId('deleteAccountingTemplate', AccountingTemplateResolver, 'accountingTemplateService'),
	{
		// The hard branch only: the withdrawal reads the row first and is pinned below.
		field: 'deleteApiCallLog',
		resolver: ApiCallLogResolver,
		service: 'apiCallLogService',
		method: 'delete',
		args: [ID, true],
		expected: [ID, { where: { forceDelete: true } }]
	},
	byId('deleteAppointmentEmployee', AppointmentEmployeesResolver, 'appointmentEmployeesService'),
	byId('deleteApprovalPolicy', ApprovalPolicyResolver, 'approvalPolicyService'),
	byId('deleteAvailabilitySlot', AvailabilitySlotsResolver, 'availabilitySlotsService'),
	byId('deleteBroadcast', BroadcastResolver, 'broadcastService'),
	byId('deleteCandidateDocument', CandidateProfileResolver, 'candidateDocumentsService'),
	byId('deleteCandidateEducation', CandidateProfileResolver, 'candidateEducationService'),
	byId('deleteCandidateExperience', CandidateProfileResolver, 'candidateExperienceService'),
	byId('deleteCandidateSkill', CandidateProfileResolver, 'candidateSkillService'),
	byId('deleteCandidateSource', CandidateProfileResolver, 'candidateSourceService'),
	byId('deleteCandidate', CandidateResolver, 'candidateService'),
	byId('deleteCandidateCriterionsRating', CandidateCriterionsRatingResolver, 'candidateCriterionsRatingService'),
	byCommand(
		'deleteCandidateCriterionsRatingsByFeedback',
		CandidateCriterionsRatingResolver,
		['feedback-1'],
		new CandidateCriterionsRatingBulkDeleteCommand('feedback-1')
	),
	byId('deleteCandidateFeedback', CandidateFeedbacksResolver, 'candidateFeedbacksService'),
	byCommand(
		'deleteCandidateFeedbackByInterview',
		CandidateFeedbacksResolver,
		['interview-1', 'feedback-1'],
		new FeedbackDeleteCommand('feedback-1', 'interview-1')
	),
	byId('deleteCandidateTechnology', CandidateInterviewVocabularyResolver, 'candidateTechnologiesService'),
	byCommand(
		'deleteCandidateTechnologiesBulk',
		CandidateInterviewVocabularyResolver,
		['interview-1', ['technology-1']],
		new CandidateTechnologiesBulkDeleteCommand('interview-1', [{ id: 'technology-1' }] as any)
	),
	byId('deleteCandidatePersonalQuality', CandidateInterviewVocabularyResolver, 'candidatePersonalQualitiesService'),
	byCommand(
		'deleteCandidatePersonalQualitiesBulk',
		CandidateInterviewVocabularyResolver,
		['interview-1', ['quality-1']],
		new CandidatePersonalQualitiesBulkDeleteCommand('interview-1', [{ id: 'quality-1' }] as any)
	),
	byId('deleteCandidateInterview', CandidateInterviewResolver, 'candidateInterviewService'),
	byId('deleteCandidateInterviewer', CandidateInterviewersResolver, 'candidateInterviewersService'),
	byCommand(
		'deleteCandidateInterviewersByInterview',
		CandidateInterviewersResolver,
		['interview-1'],
		new CandidateInterviewersInterviewBulkDeleteCommand('interview-1')
	),
	byCommand(
		'deleteCandidateInterviewersByEmployee',
		CandidateInterviewersResolver,
		[['employee-1']],
		new CandidateInterviewersEmployeeBulkDeleteCommand([{ employeeId: 'employee-1' }] as any)
	),
	byId('deleteComment', CommentResolver, 'commentService'),
	byId('deleteContact', ContactResolver, 'contactService'),
	byId('deleteSmtpSetting', CustomSmtpResolver, 'customSmtpService'),
	byId('deleteDashboardWidget', DashboardWidgetResolver, 'dashboardWidgetService'),
	byId('deleteDashboard', DashboardResolver, 'dashboardService'),
	byId('deleteDeal', DealResolver, 'dealService'),
	{
		field: 'deleteEmailTemplate',
		resolver: EmailTemplateResolver,
		service: 'emailTemplateService',
		method: 'delete',
		args: [ID],
		expected: [{ id: ID, tenantId: TENANT }],
		before: { findOneByIdString: { answers: { id: ID }, expected: [ID, { where: { tenantId: TENANT } }] } }
	},
	{
		field: 'deleteEmployee',
		resolver: EmployeeResolver,
		service: 'employeeService',
		method: 'delete',
		args: [ID, ORGANIZATION],
		expected: [ID, { where: { organizationId: ORGANIZATION } }]
	},
	byId('deleteEmployeeAppointment', EmployeeAppointmentResolver, 'employeeAppointmentService'),
	byId('deleteEmployeeAvailability', EmployeeAvailabilityResolver, 'employeeAvailabilityService'),
	byId('deleteEmployeeAward', EmployeeAwardResolver, 'employeeAwardService'),
	byId('deleteEmployeeLevel', EmployeeLevelResolver, 'employeeLevelService'),
	byId('deleteEmployeeNotification', EmployeeNotificationResolver, 'employeeNotificationService'),
	byId('deleteEmployeeNotificationSetting', EmployeeNotificationSettingResolver, 'employeeNotificationSettingService'),
	// `all` only: `future` and `current` read the arrangement first and are pinned below.
	byCommand(
		'deleteEmployeeRecurringExpense',
		EmployeeRecurringExpenseResolver,
		[ID, ALL],
		new EmployeeRecurringExpenseDeleteCommand(ID, ALL)
	),
	byId('deleteEmployeeSetting', EmployeeSettingResolver, 'employeeSettingService'),
	byId('deleteEquipment', EquipmentResolver, 'equipmentService'),
	byId('deleteEquipmentSharing', EquipmentSharingResolver, 'equipmentSharingService'),
	byId('deleteEquipmentSharingPolicy', EquipmentSharingPolicyResolver, 'equipmentSharingPolicyService'),
	byId('deleteEventType', EventTypeResolver, 'eventTypeService'),
	byCommand('deleteExpense', ExpenseResolver, [ID, 'employee-1'], new ExpenseDeleteCommand('employee-1', ID)),
	byId('deleteExpenseCategory', ExpenseCategoriesResolver, 'expenseCategoriesService'),
	byId('deleteFavorite', FavoriteResolver, 'favoriteService'),
	byId('deleteGoal', GoalResolver, 'goalService'),
	byId('deleteGoalGeneralSetting', GoalGeneralSettingResolver, 'goalGeneralSettingService'),
	byId('deleteGoalKpi', GoalKpiResolver, 'goalKpiService'),
	byId('deleteGoalKpiTemplate', GoalKpiTemplateResolver, 'goalKpiTemplateService'),
	byId('deleteGoalTemplate', GoalTemplateResolver, 'goalTemplateService'),
	byId('deleteGoalTimeFrame', GoalTimeFrameResolver, 'goalTimeFrameService'),
	byCommand('deleteIncome', IncomeResolver, [ID, 'employee-1'], new IncomeDeleteCommand('employee-1', ID)),
	byCommand(
		'deleteIntegrationTenant',
		IntegrationTenantResolver,
		[ID, ORGANIZATION, TENANT],
		new IntegrationTenantDeleteCommand(ID, { organizationId: ORGANIZATION, tenantId: TENANT })
	),
	byId('deleteInvite', InviteResolver, 'inviteService'),
	byCommand('deleteInvoice', InvoiceResolver, [ID], new InvoiceDeleteCommand(ID)),
	byId('deleteInvoiceEstimateHistory', InvoiceEstimateHistoryResolver, 'invoiceEstimateHistoryService'),
	byId('deleteInvoiceItem', InvoiceItemResolver, 'invoiceItemService'),
	byId('deleteKeyResult', KeyResultResolver, 'keyResultService'),
	byId('deleteKeyResultTemplate', KeyResultTemplateResolver, 'keyResultTemplateService'),
	byId('deleteKeyResultUpdate', KeyResultUpdateResolver, 'keyResultUpdateService'),
	byCommand(
		'deleteKeyResultUpdates',
		KeyResultUpdateResolver,
		['key-result-1'],
		new KeyResultUpdateBulkDeleteCommand('key-result-1')
	),
	byId('deleteMention', MentionResolver, 'mentionService'),
	byId('deleteMerchant', MerchantResolver, 'merchantService'),
	byId('deleteOfficialHoliday', OfficialHolidayResolver, 'officialHolidayService'),
	byId('deleteOrganization', OrganizationResolver, 'organizationService'),
	byId('deleteOrganizationAward', OrganizationAwardResolver, 'organizationAwardService'),
	byId('deleteOrganizationContact', OrganizationContactResolver, 'organizationContactService'),
	byId('deleteOrganizationDepartment', OrganizationDepartmentResolver, 'organizationDepartmentService'),
	byId('deleteOrganizationDocument', OrganizationDocumentResolver, 'organizationDocumentService'),
	byId('deleteOrganizationEmploymentType', OrganizationEmploymentTypeResolver, 'organizationEmploymentTypeService'),
	byId('deleteOrganizationLanguage', OrganizationLanguageResolver, 'organizationLanguageService'),
	byId('deleteOrganizationPosition', OrganizationPositionResolver, 'organizationPositionService'),
	byId('deleteOrganizationProject', OrganizationProjectResolver, 'organizationProjectService'),
	byId('deleteOrganizationProjectModule', OrganizationProjectModuleResolver, 'organizationProjectModuleService'),
	// `all` only, as for the employee's standing costs.
	byCommand(
		'deleteOrganizationRecurringExpense',
		OrganizationRecurringExpenseResolver,
		[ID, ALL],
		new OrganizationRecurringExpenseDeleteCommand(ID, ALL)
	),
	byId('deleteOrganizationSprint', OrganizationSprintResolver, 'organizationSprintService'),
	byId(
		'deleteOrganizationStrategicInitiative',
		OrganizationStrategicInitiativeResolver,
		'organizationStrategicInitiativeService'
	),
	{
		field: 'deleteOrganizationTeam',
		resolver: OrganizationTeamResolver,
		service: 'organizationTeamService',
		method: 'deleteTeam',
		args: [ID, { organizationId: ORGANIZATION }],
		expected: [ID, { organizationId: ORGANIZATION }]
	},
	{
		field: 'deleteOrganizationTeamEmployee',
		resolver: OrganizationTeamEmployeeResolver,
		service: 'organizationTeamEmployeeService',
		method: 'deleteTeamMember',
		args: [ID, { organizationId: ORGANIZATION, organizationTeamId: 'team-1' }],
		expected: [ID, { organizationId: ORGANIZATION, organizationTeamId: 'team-1' }]
	},
	byId('deleteOrganizationVendor', OrganizationVendorResolver, 'organizationVendorService', 'deleteVendor'),
	byId('deletePayment', PaymentResolver, 'paymentService'),
	byId('deletePipeline', PipelineResolver, 'pipelineService'),
	byCommand('deleteProduct', ProductResolver, [ID], new ProductDeleteCommand(ID)),
	byId('deleteProductCategory', ProductCategoryResolver, 'productCategoryService'),
	byId('deleteProductOption', ProductOptionResolver, 'productOptionService'),
	byId('deleteProductVariantSetting', ProductVariantSettingResolver, 'productVariantSettingService'),
	byId('deleteProductType', ProductTypeResolver, 'productTypeService'),
	byCommand('deleteProductVariant', ProductVariantResolver, [ID], new ProductVariantDeleteCommand(ID)),
	byId('deleteProductVariantPrice', ProductVariantPriceResolver, 'productVariantPriceService'),
	byId('deleteReaction', ReactionResolver, 'reactionService'),
	byId('deleteRequestApproval', RequestApprovalResolver, 'requestApprovalService'),
	byId('deleteResourceLink', ResourceLinkResolver, 'resourceLinkService'),
	byId('deleteRole', RoleEntityResolver, 'roleService'),
	byId('deleteRolePermission', RolePermissionResolver, 'rolePermissionService', 'deletePermission'),
	byId('deleteSharedEntity', SharedEntityResolver, 'sharedEntityService'),
	byId('deleteSkill', SkillResolver, 'skillService'),
	byId('deleteTagType', TagTypeResolver, 'tagTypeService'),
	byId('deleteTag', TagResolver, 'tagService'),
	byId('deleteDailyPlan', DailyPlanResolver, 'dailyPlanService'),
	byCommand('deleteTaskEstimation', TaskEstimationResolver, [ID], new TaskEstimationDeleteCommand(ID)),
	byId('deleteTaskLinkedIssue', TaskLinkedIssueResolver, 'taskLinkedIssueService'),
	byId('deleteScreeningTask', ScreeningTaskResolver, 'screeningTasksService'),
	byId('deleteTaskStatus', TaskMetadataResolver, 'taskStatusService'),
	byId('deleteTaskSize', TaskMetadataResolver, 'taskSizeService'),
	byId('deleteTaskPriority', TaskMetadataResolver, 'taskPriorityService'),
	byId('deleteTaskVersion', TaskMetadataResolver, 'taskVersionService'),
	byId('deleteTaskRelatedIssueType', TaskMetadataResolver, 'taskRelatedIssueTypeService'),
	byId('deleteIssueType', TaskMetadataResolver, 'issueTypeService'),
	byId('deleteTask', TaskResolver, 'taskService'),
	byId('deleteTaskView', TaskViewResolver, 'taskViewService'),
	byId('deleteTenantSetting', TenantSettingResolver, 'tenantSettingService'),
	{
		// The caller's own tenant, read from the credential.
		field: 'deleteTenant',
		resolver: TenantResolver,
		service: 'tenantService',
		method: 'delete',
		args: [],
		expected: [TENANT]
	},
	byId('deleteTimeOffPolicy', TimeOffPolicyResolver, 'timeOffPolicyService'),
	byId('deleteTimeOffRequest', TimeOffRequestResolver, 'timeOffRequestService'),
	{
		field: 'deleteTimeLogs',
		resolver: TimeLogResolver,
		service: 'timeLogService',
		method: 'deleteTimeLogs',
		args: [{ logIds: ['log-1'], organizationId: ORGANIZATION }],
		expected: [{ logIds: ['log-1'], organizationId: ORGANIZATION, forceDelete: false }]
	},
	byCommand('deleteUser', UserResolver, [ID], new UserDeleteCommand(ID)),
	byCommand('deleteUserOrganization', UserOrganizationResolver, [ID], new UserOrganizationDeleteCommand(ID)),
	byId('deleteWarehouse', WarehouseResolver, 'warehouseService'),
	byId('deleteWebhookSubscription', WebhookResolver, 'webhookSubscriptionService')
];

/**
 * Runs one field against a dependency that answers `outcome`.
 *
 * @returns The stubs, keyed by method, and the field's answer.
 */
function invoke(row: IDeleteAnswerRow, outcome: unknown) {
	const stubs: Record<string, jest.Mock> = { [row.method]: jest.fn().mockResolvedValue(outcome) };

	for (const [name, { answers }] of Object.entries(row.before ?? {})) {
		stubs[name] = jest.fn().mockResolvedValue(answers);
	}

	const resolver = Object.create(row.resolver.prototype) as Record<string, any>;
	resolver[row.service] = stubs;

	return { stubs, answer: resolver[row.field](...row.args) as Promise<boolean> };
}

describe('GraphQL delete fields answer whether a row was removed', () => {
	beforeEach(() => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('lists every converted core field once', () => {
		const fields = ROWS.map((row) => row.field);

		expect(new Set(fields).size).toBe(fields.length);
		expect(fields).toHaveLength(121);
	});

	describe.each(ROWS)('$field', (row) => {
		it('answers false when the delete affected no row', async () => {
			await expect(invoke(row, { affected: 0, raw: [] }).answer).resolves.toBe(false);
		});

		it('answers true when the delete affected a row', async () => {
			await expect(invoke(row, { affected: 1, raw: [] }).answer).resolves.toBe(true);
		});

		it('hands the dependency the same arguments as before', async () => {
			const { stubs, answer } = invoke(row, { affected: 1, raw: [] });
			await answer;

			const stub = stubs[row.method];
			expect(stub).toHaveBeenCalledTimes(1);
			expect(stub).toHaveBeenCalledWith(...row.expected);

			// Structural equality does not compare classes: a command must also be the same command.
			row.expected.forEach((value, index) => {
				if (value !== null && typeof value === 'object' && !Array.isArray(value) && value.constructor !== Object) {
					expect(stub.mock.calls[0][index]).toBeInstanceOf(value.constructor);
				}
			});

			for (const [name, { expected }] of Object.entries(row.before ?? {})) {
				expect(stubs[name]).toHaveBeenCalledWith(...expected);
			}
		});
	});

	describe('the branches that read the row before they change it keep answering true', () => {
		it('deleteApiCallLog withdraws through softDelete, which refuses a missing row itself', async () => {
			const resolver = Object.create(ApiCallLogResolver.prototype) as Record<string, any>;
			const softDelete = jest.fn().mockResolvedValue({ id: ID });
			const remove = jest.fn();
			resolver['apiCallLogService'] = { softDelete, delete: remove };

			await expect(resolver['deleteApiCallLog'](ID)).resolves.toBe(true);
			expect(softDelete).toHaveBeenCalledWith(ID, { where: { forceDelete: false } });
			expect(remove).not.toHaveBeenCalled();
		});

		it.each([
			['deleteEmployeeRecurringExpense', EmployeeRecurringExpenseResolver],
			['deleteOrganizationRecurringExpense', OrganizationRecurringExpenseResolver]
		])('%s answers true for `current`, whose handler answers the row it opened', async (field, resolver) => {
			const instance = Object.create(resolver.prototype) as Record<string, any>;
			const input = { ...ALL, deletionType: RecurringExpenseDeletionEnum.CURRENT };
			instance['commandBus'] = { execute: jest.fn().mockResolvedValue({ id: 'opened-row' }) };

			await expect(instance[field](ID, input)).resolves.toBe(true);
		});

		it.each([
			['deleteEmployeeRecurringExpense', EmployeeRecurringExpenseResolver],
			['deleteOrganizationRecurringExpense', OrganizationRecurringExpenseResolver]
		])('%s answers true for `future`, whose handler answers an update result', async (field, resolver) => {
			const instance = Object.create(resolver.prototype) as Record<string, any>;
			const input = { ...ALL, deletionType: RecurringExpenseDeletionEnum.FUTURE };
			instance['commandBus'] = { execute: jest.fn().mockResolvedValue({ affected: 1, generatedMaps: [], raw: [] }) };

			await expect(instance[field](ID, input)).resolves.toBe(true);
		});
	});
});
