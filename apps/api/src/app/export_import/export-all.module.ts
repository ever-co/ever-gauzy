import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExportAllController } from './export-all.controller';
import { ExportAllService } from './export-all.service';
import { CountryService, Country } from '../country';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { UserOrganization } from '../user-organization/user-organization.entity';
import { Email } from '../email/email.entity';
import { EmailService } from '../email/email.service';
import { EmailTemplate } from '../email-template/email-template.entity';
import { EmailTemplateService } from '../email-template/email-template.service';
import { Employee } from '../employee/employee.entity';
import { EmployeeService } from '../employee/employee.service';
import {
	EmployeeRecurringExpenseService,
	EmployeeRecurringExpense
} from '../employee-recurring-expense';
import { EmployeeSettingService, EmployeeSetting } from '../employee-setting';
import {
	EquipmentSharingService,
	EquipmentSharing
} from '../equipment-sharing';
import { Expense } from '../expense/expense.entity';
import { ExpenseService } from '../expense/expense.service';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { ExpenseCategoriesService } from '../expense-categories/expense-categories.service';
import { IncomeService } from '../income/income.service';
import { Income } from '../income/income.entity';
import { InviteService } from '../invite/invite.service';
import { Invite } from '../invite/invite.entity';
import { Organization } from '../organization/organization.entity';
import { OrganizationService } from '../organization/organization.service';
import { OrganizationProjects } from '../organization-projects/organization-projects.entity';
import { OrganizationProjectsService } from '../organization-projects/organization-projects.service';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationDepartmentService } from '../organization-department/organization-department.service';
import { Role } from '../role/role.entity';
import { RoleService } from '../role/role.service';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { InvoiceService } from '../invoice/invoice.service';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceItemService } from '../invoice-item/invoice-item.service';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { EmployeeLevelService } from '../organization_employeeLevel/organization-employee-level.service';
import { EmployeeLevel } from '../organization_employeeLevel/organization-employee-level.entity';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { OrganizationEmploymentTypeService } from '../organization-employment-type/organization-employment-type.service';
import { OrganizationPositions } from '../organization-positions/organization-positions.entity';
import { OrganizationPositionsService } from '../organization-positions/organization-positions.service';
import { OrganizationRecurringExpense } from '../organization-recurring-expense/organization-recurring-expense.entity';
import { OrganizationRecurringExpenseService } from '../organization-recurring-expense/organization-recurring-expense.service';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { OrganizationTeamService } from '../organization-team/organization-team.service';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';
import { OrganizationVendorsService } from '../organization-vendors/organization-vendors.service';
import { Proposal } from '../proposal/proposal.entity';
import { ProposalService } from '../proposal/proposal.service';
import { RolePermissions } from '../role-permissions/role-permissions.entity';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';
import { Tag } from '../tags/tag.entity';
import { TagService } from '../tags/tag.service';
import { Task } from '../tasks/task.entity';
import { TaskService } from '../tasks/task.service';
import { Tenant } from '../tenant/tenant.entity';
import { TenantService } from '../tenant/tenant.service';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { TimeOffPolicyService } from '../time-off-policy/time-off-policy.service';
import { Timesheet } from '../timesheet/timesheet.entity';
import { TimeSlot } from '../timesheet/time-slot.entity';
import { Activity } from '../timesheet/activity.entity';
import { Screenshot } from '../timesheet/screenshot.entity';
import { TimeLog } from '../timesheet/time-log.entity';
import { TimeSlotMinute } from '../timesheet/time-slot-minute.entity';
import { TimeSheetService } from '../timesheet/timesheet/timesheet.service';
import { ActivityService } from '../timesheet/activity/activity.service';
import { ScreenshotService } from '../timesheet/screenshot/screenshot.service';
import { TimeSlotService } from '../timesheet/time-slot/time-slot.service';
import { TimeLogService } from '../timesheet/time-log/time-log.service';
import { AppointmentEmployeesService } from '../appointment-employees/appointment-employees.service';
import { AppointmentEmployees } from '../appointment-employees/appointment-employees.entity';
import { ApprovalPolicyService } from '../approval-policy/approval-policy.service';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { CandidateService } from '../candidate/candidate.service';
import { Candidate } from '../candidate/candidate.entity';
import { OrganizationTeamEmployeeService } from '../organization-team-employee/organization-team-employee.service';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { Equipment } from '../equipment/equipment.entity';
import { EquipmentService } from '../equipment/equipment.service';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';
import { EstimateEmail } from '../estimate-email/estimate-email.entity';
import { Contact } from '../contact/contact.entity';
import { ContactService } from '../contact/contact.service';
import { RequestApprovalTeam } from '../request-approval-team/request-approval-team.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';
import { OrganizationSprint } from '../organization-sprint/organization-sprint.entity';
import { OrganizationSprintService } from '../organization-sprint/organization-sprint.service';
import { AvailabilitySlots } from '../availability-slots/availability-slots.entity';
import { CandidateDocument } from '../candidate-documents/candidate-documents.entity';
import { CandidateExperience } from '../candidate-experience/candidate-experience.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { CandidateInterviewers } from '../candidate-interviewers/candidate-interviewers.entity';
import { CandidateTechnologies } from '../candidate-technologies/candidate-technologies.entity';
import { CandidateCriterionsRating } from '../candidate-criterions-rating/candidate-criterion-rating.entity';
import { CandidateEducation } from '../candidate-education/candidate-education.entity';
import { CandidateFeedback } from '../candidate-feedbacks/candidate-feedbacks.entity';
import { CandidatePersonalQualities } from '../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateSkill } from '../candidate-skill/candidate-skill.entity';
import { CandidateSource } from '../candidate-source/candidate-source.entity';
import { Deal } from '../deal/deal.entity';
import {
	EmployeeAppointment,
	EmployeeAppointmentService
} from '../employee-appointment';
import { EventType } from '../event-types/event-type.entity';
import { GoalKPI } from '../goal-kpi/goal-kpi.entity';
import { GoalTimeFrame } from '../goal-time-frame/goal-time-frame.entity';
import { Goal } from '../goal/goal.entity';
import { HelpCenterArticle } from '../help-center-article/help-center-article.entity';
import { HelpCenterAuthor } from '../help-center-author/help-center-author.entity';
import { HelpCenter } from '../help-center/help-center.entity';
import { IntegrationEntitySettingTiedEntity } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entitiy.entity';
import { Integration } from '../integration/integration.entity';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';
import { IntegrationMap } from '../integration-map/integration-map.entity';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';
import { IntegrationSetting } from '../integration-setting/integration-setting.entity';
import { KeyResultUpdate } from '../keyresult-update/keyresult-update.entity';
import { KeyResult } from '../keyresult/keyresult.entity';
import { Language } from '../language/language.entity';
import { OrganizationAwards } from '../organization-awards/organization-awards.entity';
import { OrganizationLanguages } from '../organization-languages/organization-languages.entity';
import { Payment } from '../payment/payment.entity';
import { Pipeline } from '../pipeline/pipeline.entity';
import { Product } from '../product/product.entity';
import { Skill } from '../skills/skill.entity';
import { Stage } from '../stage/stage.entity';
import { TimeOffRequest } from '../time-off-request/time-off-request.entity';
import { UpworkService } from '../upwork/upwork.service';
import { RequestApprovalService } from '../request-approval/request-approval.service';
import { AvailabilitySlotsService } from '../availability-slots/availability-slots.service';
import { CandidateCriterionsRatingService } from '../candidate-criterions-rating/candidate-criterion-rating.service';
import { CandidateDocumentsService } from '../candidate-documents/candidate-documents.service';
import { CandidateExperienceService } from '../candidate-experience/candidate-experience.service';
import { CandidateFeedbacksService } from '../candidate-feedbacks/candidate-feedbacks.service';
import { CandidateInterviewService } from '../candidate-interview/candidate-interview.service';
import { CandidateEducationService } from '../candidate-education/candidate-education.service';
import { CandidateInterviewersService } from '../candidate-interviewers/candidate-interviewers.service';
import { CandidatePersonalQualitiesService } from '../candidate-personal-qualities/candidate-personal-qualities.service';
import { CandidateSkillService } from '../candidate-skill/candidate-skill.service';
import { CandidateSourceService } from '../candidate-source/candidate-source.service';
import { CandidateTechnologiesService } from '../candidate-technologies/candidate-technologies.service';
import { DealService } from '../deal/deal.service';
import { EmployeeStatisticsService } from '../employee-statistics';
import { GoalService } from '../goal/goal.service';
import { GoalKpiService } from '../goal-kpi/goal-kpi.service';
import { GoalTimeFrameService } from '../goal-time-frame/goal-time-frame.service';
import { EventTypeService } from '../event-types/event-type.service';
import { HelpCenterService } from '../help-center/help-center.service';
import { HelpCenterArticleService } from '../help-center-article/help-center-article.service';
import { HelpCenterAuthorService } from '../help-center-author/help-center-author.service';
import { TimerService } from '../timesheet/timer/timer.service';
import { StageService } from '../stage/stage.service';
import { SkillService } from '../skills/skill.service';
import { TimeOffRequestService } from '../time-off-request/time-off-request.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { PaymentService } from '../payment/payment.service';
import { ProductService } from '../product/product.service';
import { ProductOption } from '../product-option/product-option.entity';
import { ProductVariantSettings } from '../product-settings/product-settings.entity';
import { ProductType } from '../product-type/product-type.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { ProductVariantPrice } from '../product-variant-price/product-variant-price.entity';
import { ProductTypeService } from '../product-type/product-type.service';
import { ProductVariantSettingService } from '../product-settings/product-settings.service';
import { ProductOptionService } from '../product-option/product-option.service';
import { ProductVariantService } from '../product-variant/product-variant.service';
import { ProductVariantPriceService } from '../product-variant-price/product-variant-price.service';
import { OrganizationAwardsService } from '../organization-awards/organization-awards.service';
import { OrganizationLanguagesService } from '../organization-languages/organization-languages.service';
import { LanguageService } from '../language/language.service';
import { IntegrationService } from '../integration/integration.service';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IntegrationEntitySettingService } from '../integration-entity-setting/integration-entity-setting.service';
import { IntegrationEntitySettingTiedEntityService } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entitiy.service';
import { IntegrationTenantService } from '../integration-tenant/integration-tenant.service';
import { KeyResultService } from '../keyresult/keyresult.service';
import { KeyResultUpdateService } from '../keyresult-update/keyresult-update.service';
import { ProductCategory } from '../product-category/product-category.entity';
import { ProductCategoryService } from '../product-category/product-category.service';
import { OrganizationDocuments } from '../organization-documents/organization-documents.entity';
import { OrganizationDocumentsService } from '../organization-documents/organization-documents.service';

@Module({
	imports: [
		CqrsModule,
		TypeOrmModule.forFeature([
			Activity,
			AppointmentEmployees,
			ApprovalPolicy,
			AvailabilitySlots,

			Candidate,
			CandidateCriterionsRating,
			CandidateDocument,
			CandidateEducation,
			CandidateExperience,
			CandidateExperience,
			CandidateFeedback,
			CandidateInterview,
			CandidateInterviewers,
			CandidatePersonalQualities,
			CandidateSkill,
			CandidateSource,
			CandidateTechnologies,
			Contact,
			Country,

			Deal,

			Email,
			EmailTemplate,
			Employee,
			EmployeeAppointment,
			EmployeeLevel,
			EmployeeRecurringExpense,
			EmployeeSetting,
			EmployeeSetting,
			Equipment,
			EquipmentSharing,
			EstimateEmail,
			EventType,
			Expense,
			ExpenseCategory,

			Goal,
			GoalKPI,
			GoalTimeFrame,

			HelpCenter,
			HelpCenterArticle,
			HelpCenterAuthor,

			Income,
			Integration,
			IntegrationEntitySetting,
			IntegrationEntitySettingTiedEntity,
			IntegrationMap,
			IntegrationSetting,
			IntegrationTenant,
			Invite,
			Invoice,
			InvoiceItem,

			KeyResult,
			KeyResultUpdate,

			Language,

			Organization,
			OrganizationAwards,
			OrganizationContact,
			OrganizationDepartment,
			OrganizationDocuments,
			OrganizationEmploymentType,
			OrganizationLanguages,
			OrganizationPositions,
			OrganizationProjects,
			OrganizationRecurringExpense,
			OrganizationSprint,
			OrganizationTeam,
			OrganizationTeamEmployee,
			OrganizationVendor,

			Payment,
			Pipeline,
			Product,
			ProductCategory,
			ProductOption,
			ProductVariantSettings,
			ProductType,
			ProductVariant,
			ProductVariantPrice,
			Proposal,

			RequestApproval,
			RequestApprovalEmployee,
			RequestApprovalTeam,
			Role,
			RolePermissions,

			Screenshot,
			Skill,
			Stage,

			Tag,
			Task,
			Tenant,
			TimeOffPolicy,
			TimeOffRequest,
			Timesheet,
			TimeSlot,
			TimeLog,
			TimeSlotMinute,

			User,
			UserOrganization
		])
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

		DealService,

		EmailService,
		EmailTemplateService,
		EmployeeService,
		EmployeeAppointmentService,
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
		GoalKpiService,
		GoalTimeFrameService,

		HelpCenterService,
		HelpCenterArticleService,
		HelpCenterAuthorService,

		IncomeService,
		IntegrationService,
		IntegrationEntitySettingService,
		IntegrationEntitySettingTiedEntityService,
		IntegrationMapService,
		IntegrationSettingService,
		IntegrationTenantService,
		InviteService,
		InvoiceService,
		InvoiceItemService,

		KeyResultService,
		KeyResultUpdateService,

		LanguageService,

		OrganizationAwardsService,
		OrganizationLanguagesService,
		OrganizationService,
		OrganizationContactService,
		OrganizationDepartmentService,
		OrganizationDocumentsService,
		OrganizationEmploymentTypeService,
		OrganizationPositionsService,
		OrganizationProjectsService,
		OrganizationRecurringExpenseService,
		OrganizationTeamService,
		OrganizationTeamEmployeeService,
		OrganizationSprintService,
		OrganizationVendorsService,

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

		UpworkService,
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

		DealService,

		EmailService,
		EmailTemplateService,
		EmployeeService,
		EmployeeAppointmentService,
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
		GoalKpiService,
		GoalTimeFrameService,

		HelpCenterService,
		HelpCenterArticleService,
		HelpCenterAuthorService,

		IncomeService,
		IntegrationService,
		IntegrationEntitySettingService,
		IntegrationEntitySettingTiedEntityService,
		IntegrationMapService,
		IntegrationSettingService,
		IntegrationTenantService,
		InviteService,
		InvoiceService,
		InvoiceItemService,

		KeyResultService,
		KeyResultUpdateService,

		LanguageService,

		OrganizationService,
		OrganizationAwardsService,
		OrganizationLanguagesService,
		OrganizationContactService,
		OrganizationDepartmentService,
		OrganizationDocumentsService,
		OrganizationEmploymentTypeService,
		OrganizationPositionsService,
		OrganizationProjectsService,
		OrganizationRecurringExpenseService,
		OrganizationTeamService,
		OrganizationTeamEmployeeService,
		OrganizationSprintService,
		OrganizationVendorsService,

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

		UpworkService,
		UserService,
		UserOrganizationService
	]
})
export class ExportAllModule {}
