import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouterModule } from 'nest-router';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { getConfig } from '@gauzy/config';
import {
	UpworkReportService,
	UpworkJobService,
	UpworkOffersService
} from '@gauzy/integration-upwork';
import { coreEntities } from './../../core/entities';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';
import { CountryService } from '../../country';
import { UserService } from '../../user/user.service';
import { UserOrganizationService } from '../../user-organization/user-organization.services';
import { EmailService } from '../../email/email.service';
import { EmailTemplateService } from '../../email-template/email-template.service';
import { EmployeeService } from '../../employee/employee.service';
import { EmployeeRecurringExpenseService } from '../../employee-recurring-expense';
import { EmployeeSettingService } from '../../employee-setting';
import { EquipmentSharingService } from '../../equipment-sharing';
import { ExpenseService } from '../../expense/expense.service';
import { ExpenseCategoriesService } from '../../expense-categories/expense-categories.service';
import { IncomeService } from '../../income/income.service';
import { InviteService } from '../../invite/invite.service';
import { OrganizationService } from '../../organization/organization.service';
import { OrganizationProjectsService } from '../../organization-projects/organization-projects.service';
import { OrganizationDepartmentService } from '../../organization-department/organization-department.service';
import { RoleService } from '../../role/role.service';
import { InvoiceService } from '../../invoice/invoice.service';
import { PdfmakerService } from './../../invoice/pdfmaker.service';
import { InvoiceItemService } from '../../invoice-item/invoice-item.service';
import { EmployeeLevelService } from '../../organization_employee-level/organization-employee-level.service';
import { OrganizationContactService } from '../../organization-contact/organization-contact.service';
import { OrganizationEmploymentTypeService } from '../../organization-employment-type/organization-employment-type.service';
import { OrganizationPositionsService } from '../../organization-positions/organization-positions.service';
import { OrganizationRecurringExpenseService } from '../../organization-recurring-expense/organization-recurring-expense.service';
import { OrganizationTeamService } from '../../organization-team/organization-team.service';
import { OrganizationVendorService } from '../../organization-vendor/organization-vendor.service';
import { ProposalService } from '../../proposal/proposal.service';
import { RolePermissionsService } from '../../role-permissions/role-permissions.service';
import { TagService } from '../../tags/tag.service';
import { TaskService } from '../../tasks/task.service';
import { TenantService } from '../../tenant/tenant.service';
import { TimeOffPolicyService } from '../../time-off-policy/time-off-policy.service';
import { TimeSheetService } from '../../timesheet/timesheet/timesheet.service';
import { ActivityService } from '../../timesheet/activity/activity.service';
import { ScreenshotService } from '../../timesheet/screenshot/screenshot.service';
import { TimeSlotService } from '../../timesheet/time-slot/time-slot.service';
import { TimeLogService } from '../../timesheet/time-log/time-log.service';
import { AppointmentEmployeesService } from '../../appointment-employees/appointment-employees.service';
import { ApprovalPolicyService } from '../../approval-policy/approval-policy.service';
import { CandidateService } from '../../candidate/candidate.service';
import { OrganizationTeamEmployeeService } from '../../organization-team-employee/organization-team-employee.service';
import { EquipmentService } from '../../equipment/equipment.service';
import { EstimateEmailService } from '../../estimate-email/estimate-email.service';
import { ContactService } from '../../contact/contact.service';
import { OrganizationSprintService } from '../../organization-sprint/organization-sprint.service';
import { EmployeeAppointmentService } from '../../employee-appointment';
import { UpworkService } from '../../upwork/upwork.service';
import { RequestApprovalService } from '../../request-approval/request-approval.service';
import { AvailabilitySlotsService } from '../../availability-slots/availability-slots.service';
import { CandidateCriterionsRatingService } from '../../candidate-criterions-rating/candidate-criterion-rating.service';
import { CandidateDocumentsService } from '../../candidate-documents/candidate-documents.service';
import { CandidateExperienceService } from '../../candidate-experience/candidate-experience.service';
import { CandidateFeedbacksService } from '../../candidate-feedbacks/candidate-feedbacks.service';
import { CandidateInterviewService } from '../../candidate-interview/candidate-interview.service';
import { CandidateEducationService } from '../../candidate-education/candidate-education.service';
import { CandidateInterviewersService } from '../../candidate-interviewers/candidate-interviewers.service';
import { CandidatePersonalQualitiesService } from '../../candidate-personal-qualities/candidate-personal-qualities.service';
import { CandidateSkillService } from '../../candidate-skill/candidate-skill.service';
import { CandidateSourceService } from '../../candidate-source/candidate-source.service';
import { CandidateTechnologiesService } from '../../candidate-technologies/candidate-technologies.service';
import { DealService } from '../../deal/deal.service';
import { EmployeeStatisticsService } from '../../employee-statistics';
import { GoalService } from '../../goal/goal.service';
import { GoalKpiService } from '../../goal-kpi/goal-kpi.service';
import { GoalTimeFrameService } from '../../goal-time-frame/goal-time-frame.service';
import { EventTypeService } from '../../event-types/event-type.service';
import { TimerService } from '../../timesheet/timer/timer.service';
import { StageService } from '../../pipeline-stage/pipeline-stage.service';
import { SkillService } from '../../skills/skill.service';
import { TimeOffRequestService } from '../../time-off-request/time-off-request.service';
import { PipelineService } from '../../pipeline/pipeline.service';
import { PaymentService } from '../../payment/payment.service';
import { ProductService } from '../../product/product.service';
import { ProductTypeService } from '../../product-type/product-type.service';
import { ProductVariantSettingService } from '../../product-settings/product-settings.service';
import { ProductOptionService } from '../../product-option/product-option.service';
import { ProductVariantService } from '../../product-variant/product-variant.service';
import { ProductVariantPriceService } from '../../product-variant-price/product-variant-price.service';
import { OrganizationAwardService } from '../../organization-award/organization-award.service';
import { OrganizationLanguageService } from '../../organization-language/organization-language.service';
import { LanguageService } from '../../language/language.service';
import { IntegrationService } from '../../integration/integration.service';
import { IntegrationMapService } from '../../integration-map/integration-map.service';
import { IntegrationSettingService } from '../../integration-setting/integration-setting.service';
import { IntegrationEntitySettingService } from '../../integration-entity-setting/integration-entity-setting.service';
import { IntegrationEntitySettingTiedEntityService } from '../../integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.service';
import { IntegrationTenantService } from '../../integration-tenant/integration-tenant.service';
import { KeyResultService } from '../../keyresult/keyresult.service';
import { KeyResultUpdateService } from '../../keyresult-update/keyresult-update.service';
import { ProductCategoryService } from '../../product-category/product-category.service';
import { OrganizationDocumentService } from '../../organization-document/organization-document.service';
import { CustomSmtpService } from '../../custom-smtp/custom-smtp.service';
import { CurrencyService } from '../../currency';
import { EmployeeAwardService } from '../../employee-award/employee-award.service';
import { EmployeeProposalTemplateService } from '../../employee-proposal-template/employee-proposal-template.service';
import { GoalTemplateService } from '../../goal-template/goal-template.service';
import { GoalKpiTemplateService } from '../../goal-kpi-template/goal-kpi-template.service';
import { InvoiceEstimateHistoryService } from '../../invoice-estimate-history/invoice-estimate-history.service';
import { JobPresetService } from '../../employee-job-preset/job-preset.service';
import { JobSearchOccupationService } from '../../employee-job-preset/job-search-occupation/job-search-occupation.service';
import { JobSearchCategoryService } from '../../employee-job-preset/job-search-category/job-search-category.service';
import { KeyresultTemplateService } from '../../keyresult-template/keyresult-template.service';
import { ReportService } from '../../reports/report.service';
import { ReportCategoryService } from '../../reports/report-category.service';
import { ImportRecordModule } from './../../export-import/import-record';

@Module({
	imports: [
		RouterModule.forRoutes([
			{ path: '/download', module: ExportAllModule }
		]),
		CqrsModule,
		TypeOrmModule.forFeature([
			...coreEntities,
			...getEntitiesFromPlugins(getConfig().plugins)
		]),
		ImportRecordModule
	],
	controllers: [ExportAllController],
	providers: [
		ActivityService,
		AppointmentEmployeesService,
		ApprovalPolicyService,
		AvailabilitySlotsService,

		CandidateService,
		CandidateCriterionsRatingService,
		CandidateDocumentsService,
		CandidateEducationService,
		CandidateExperienceService,
		CandidateFeedbacksService,
		CandidateInterviewService,
		CandidateInterviewersService,
		CandidatePersonalQualitiesService,
		CandidateSkillService,
		CandidateSourceService,
		CandidateTechnologiesService,
		ContactService,
		CountryService,
		CurrencyService,
		CustomSmtpService,

		DealService,

		EmailService,
		EmailTemplateService,
		EmployeeService,
		EmployeeAwardService,
		EmployeeAppointmentService,
		EmployeeLevelService,
		EmployeeProposalTemplateService,
		EmployeeRecurringExpenseService,
		EmployeeSettingService,
		EmployeeStatisticsService,
		EquipmentService,
		EquipmentSharingService,
		EstimateEmailService,
		EventTypeService,
		ExpenseService,
		ExpenseCategoriesService,
		ExportAllService,

		GoalService,
		GoalTemplateService,
		GoalKpiService,
		GoalKpiTemplateService,
		GoalTimeFrameService,

		IncomeService,
		IntegrationService,
		IntegrationEntitySettingService,
		IntegrationEntitySettingTiedEntityService,
		IntegrationMapService,
		IntegrationSettingService,
		IntegrationTenantService,
		InviteService,
		InvoiceService,
		PdfmakerService,
		InvoiceItemService,
		InvoiceEstimateHistoryService,

		JobPresetService,
		JobSearchOccupationService,
		JobSearchCategoryService,

		KeyResultService,
		KeyresultTemplateService,
		KeyResultUpdateService,

		LanguageService,

		OrganizationAwardService,
		OrganizationLanguageService,
		OrganizationService,
		OrganizationContactService,
		OrganizationDepartmentService,
		OrganizationDocumentService,
		OrganizationEmploymentTypeService,
		OrganizationPositionsService,
		OrganizationProjectsService,
		OrganizationRecurringExpenseService,
		OrganizationTeamService,
		OrganizationTeamEmployeeService,
		OrganizationSprintService,
		OrganizationVendorService,

		PaymentService,
		PipelineService,
		ProductService,
		ProductCategoryService,
		ProductTypeService,
		ProductOptionService,
		ProductVariantService,
		ProductVariantSettingService,
		ProductVariantPriceService,
		ProposalService,

		ReportService,
		ReportCategoryService,
		RequestApprovalService,
		RoleService,
		RolePermissionsService,

		ScreenshotService,
		StageService,
		SkillService,

		TagService,
		TaskService,
		TenantService,
		TimerService,
		TimeOffPolicyService,
		TimeOffRequestService,
		TimeSheetService,
		TimeLogService,
		TimeSlotService,

		UpworkJobService,
		UpworkOffersService,
		UpworkService,
		UpworkReportService,
		UserService,
		UserOrganizationService
	],
	exports: [
		ActivityService,
		AppointmentEmployeesService,
		ApprovalPolicyService,
		AvailabilitySlotsService,

		CandidateService,
		CandidateCriterionsRatingService,
		CandidateDocumentsService,
		CandidateEducationService,
		CandidateExperienceService,
		CandidateFeedbacksService,
		CandidateInterviewService,
		CandidateInterviewersService,
		CandidatePersonalQualitiesService,
		CandidateSkillService,
		CandidateSourceService,
		CandidateTechnologiesService,
		ContactService,
		CountryService,
		CurrencyService,
		CustomSmtpService,

		DealService,

		EmailService,
		EmailTemplateService,
		EmployeeService,
		EmployeeAppointmentService,
		EmployeeAwardService,
		EmployeeProposalTemplateService,
		EmployeeLevelService,
		EmployeeRecurringExpenseService,
		EmployeeSettingService,
		EmployeeStatisticsService,
		EquipmentService,
		EquipmentSharingService,
		EstimateEmailService,
		EventTypeService,
		ExpenseService,
		ExpenseCategoriesService,
		ExportAllService,

		GoalService,
		GoalTemplateService,
		GoalKpiService,
		GoalKpiTemplateService,
		GoalTimeFrameService,

		IncomeService,
		IntegrationService,
		IntegrationEntitySettingService,
		IntegrationEntitySettingTiedEntityService,
		IntegrationMapService,
		IntegrationSettingService,
		IntegrationTenantService,
		InviteService,
		InvoiceService,
		PdfmakerService,
		InvoiceItemService,
		InvoiceEstimateHistoryService,

		JobPresetService,
		JobSearchOccupationService,
		JobSearchCategoryService,

		KeyResultService,
		KeyresultTemplateService,
		KeyResultUpdateService,

		LanguageService,

		OrganizationService,
		OrganizationAwardService,
		OrganizationLanguageService,
		OrganizationContactService,
		OrganizationDepartmentService,
		OrganizationDocumentService,
		OrganizationEmploymentTypeService,
		OrganizationPositionsService,
		OrganizationProjectsService,
		OrganizationRecurringExpenseService,
		OrganizationTeamService,
		OrganizationTeamEmployeeService,
		OrganizationSprintService,
		OrganizationVendorService,

		PaymentService,
		PipelineService,
		ProductService,
		ProductCategoryService,
		ProductTypeService,
		ProductOptionService,
		ProductVariantService,
		ProductVariantSettingService,
		ProductVariantPriceService,
		ProposalService,

		ReportService,
		ReportCategoryService,
		RoleService,
		RolePermissionsService,
		RequestApprovalService,

		StageService,
		SkillService,
		ScreenshotService,

		TagService,
		TaskService,
		TenantService,
		TimerService,
		TimeOffPolicyService,
		TimeOffRequestService,
		TimeSheetService,
		TimeLogService,
		TimeSlotService,

		UpworkJobService,
		UpworkOffersService,
		UpworkService,
		UpworkReportService,
		UserService,
		UserOrganizationService
	]
})
export class ExportAllModule {}
