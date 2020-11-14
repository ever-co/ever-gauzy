// Copyright (c) 2019-2020 Ever Co. LTD

// Modified code from https://github.com/xmlking/ngx-starter-kit.
// Originally MIT Licensed
// - see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// - original code `Copyright (c) 2018 Sumanth Chinthagunta`
import { CandidateInterviewers } from './../candidate-interviewers/candidate-interviewers.entity';
import { Invoice } from '../invoice/invoice.entity';
import { InvoiceItem } from '../invoice-item/invoice-item.entity';
import { Tag } from '../tags/tag.entity';
import { Skill } from '../skills/skill.entity';
import { Language } from '../language/language.entity';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '../config';
import { environment as env } from '@env-api/environment';
import { User } from '../user/user.entity';
import { Employee } from '../employee/employee.entity';
import { Role } from '../role/role.entity';
import { Organization } from '../organization/organization.entity';
import { Income } from '../income/income.entity';
import { Expense } from '../expense/expense.entity';
import { EmployeeSetting } from '../employee-setting';
import { RequestContextMiddleware } from './context';
import { UserOrganization } from '../user-organization/user-organization.entity';
import { OrganizationDepartment } from '../organization-department/organization-department.entity';
import { OrganizationRecurringExpense } from '../organization-recurring-expense/organization-recurring-expense.entity';
import { EmployeeRecurringExpense } from '../employee-recurring-expense/employee-recurring-expense.entity';
import { OrganizationContact } from '../organization-contact/organization-contact.entity';
import { OrganizationPositions } from '../organization-positions/organization-positions.entity';
import { OrganizationVendor } from '../organization-vendors/organization-vendors.entity';
import { OrganizationProject } from '../organization-projects/organization-projects.entity';
import { OrganizationTeam } from '../organization-team/organization-team.entity';
import { OrganizationTeamEmployee } from '../organization-team-employee/organization-team-employee.entity';
import { OrganizationAwards } from '../organization-awards/organization-awards.entity';
import { OrganizationLanguages } from '../organization-languages/organization-languages.entity';
import { Proposal } from '../proposal/proposal.entity';
import { Country } from '../country/country.entity';
import { Invite } from '../invite/invite.entity';
import { Email } from '../email/email.entity';
import { TimeOffPolicy } from '../time-off-policy/time-off-policy.entity';
import { RolePermissions } from '../role-permissions/role-permissions.entity';
import { Tenant } from './../tenant/tenant.entity';
import { EmailTemplate } from '../email-template/email-template.entity';
import { OrganizationEmploymentType } from '../organization-employment-type/organization-employment-type.entity';
import { Equipment } from '../equipment/equipment.entity';
import { EmployeeLevel } from '../organization_employeeLevel/organization-employee-level.entity';
import { Task } from '../tasks/task.entity';
import { Timesheet } from '../timesheet/timesheet.entity';
import { TimeSlot } from '../timesheet/time-slot.entity';
import { Activity } from '../timesheet/activity.entity';
import { Screenshot } from '../timesheet/screenshot.entity';
import { TimeLog } from '../timesheet/time-log.entity';
import { ExpenseCategory } from '../expense-categories/expense-category.entity';
import { EquipmentSharing } from '../equipment-sharing/equipment-sharing.entity';
import { Product } from '../product/product.entity';
import { ProductOption } from '../product-option/product-option.entity';
import { ProductVariantSettings } from '../product-settings/product-settings.entity';
import { ProductType } from '../product-type/product-type.entity';
import { ProductVariant } from '../product-variant/product-variant.entity';
import { ProductVariantPrice } from '../product-variant-price/product-variant-price.entity';
import { ProductCategory } from '../product-category/product-category.entity';
import { CandidateSource } from '../candidate-source/candidate-source.entity';
import { IntegrationSetting } from '../integration-setting/integration-setting.entity';
import { IntegrationTenant } from '../integration-tenant/integration-tenant.entity';
import { IntegrationMap } from '../integration-map/integration-map.entity';
import { Candidate } from '../candidate/candidate.entity';
import { IntegrationEntitySetting } from '../integration-entity-setting/integration-entity-setting.entity';
import { IntegrationEntitySettingTiedEntity } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.entity';
import { CandidateEducation } from '../candidate-education/candidate-education.entity';
import { CandidateDocument } from '../candidate-documents/candidate-documents.entity';
import { CandidateSkill } from '../candidate-skill/candidate-skill.entity';
import { CandidateExperience } from './../candidate-experience/candidate-experience.entity';
import { CandidateFeedback } from './../candidate-feedbacks/candidate-feedbacks.entity';
import { Integration } from '../integration/integration.entity';
import { IntegrationType } from '../integration/integration-type.entity';
import { CandidateInterview } from '../candidate-interview/candidate-interview.entity';
import { EmployeeAppointment } from '../employee-appointment';
import { AppointmentEmployee } from '../appointment-employees/appointment-employees.entity';
import { RequestApproval } from '../request-approval/request-approval.entity';
import { RequestApprovalEmployee } from '../request-approval-employee/request-approval-employee.entity';
import { ApprovalPolicy } from '../approval-policy/approval-policy.entity';
import { EventType } from '../event-types/event-type.entity';
import { AvailabilitySlot } from '../availability-slots/availability-slots.entity';
import { ProductTypeTranslation } from '../product-type/product-type-translation.entity';
import { HelpCenter } from '../help-center/help-center.entity';
import { HelpCenterAuthor } from './../help-center-author/help-center-author.entity';
import { ProductCategoryTranslation } from '../product-category/product-category-translation.entity';
import { Pipeline } from '../pipeline/pipeline.entity';
import { Payment } from '../payment/payment.entity';
import { CandidatePersonalQualities } from '../candidate-personal-qualities/candidate-personal-qualities.entity';
import { PipelineStage } from '../pipeline-stage/pipeline-stage.entity';
import { CandidateTechnologies } from '../candidate-technologies/candidate-technologies.entity';
import { Goal } from '../goal/goal.entity';
import { KeyResult } from '../keyresult/keyresult.entity';
import { RequestApprovalTeam } from '../request-approval-team/request-approval-team.entity';
import { KeyResultUpdate } from '../keyresult-update/keyresult-update.entity';
import { CandidateCriterionsRating } from '../candidate-criterions-rating/candidate-criterion-rating.entity';
import { HelpCenterArticle } from '../help-center-article/help-center-article.entity';
import { GoalTimeFrame } from '../goal-time-frame/goal-time-frame.entity';
import { EstimateEmail } from '../estimate-email/estimate-email.entity';
import { TimeSlotMinute } from '../timesheet/time-slot-minute.entity';
import { Contact } from '../contact/contact.entity';
import { TimeOffRequest } from '../time-off-request/time-off-request.entity';
import { Deal } from '../deal/deal.entity';
import { OrganizationSprint } from '../organization-sprint/organization-sprint.entity';
import { GoalKPI } from '../goal-kpi/goal-kpi.entity';
import { OrganizationDocuments } from '../organization-documents/organization-documents.entity';
import { GoalGeneralSetting } from '../goal-general-setting/goal-general-setting.entity';
import { EquipmentSharingPolicy } from '../equipment-sharing-policy/equipment-sharing-policy.entity';
import { KeyResultTemplate } from '../keyresult-template/keyresult-template.entity';
import { GoalTemplate } from '../goal-template/goal-template.entity';
import { EmployeeAward } from '../employee-award/employee-award.entity';
import { InvoiceEstimateHistory } from '../invoice-estimate-history/invoice-estimate-history.entity';
import { GoalKPITemplate } from '../goal-kpi-template/goal-kpi-template.entity';
import { TenantSetting } from '../tenant/tenant-setting/tenant-setting.entity';
import { FileStorageModule } from './file-storage';
import { EmployeeUpworkJobsSearchCriterion } from '../employee-job-preset/employee-upwork-jobs-search-criterion.entity';
import { JobPresetUpworkJobSearchCriterion } from '../employee-job-preset/job-preset-upwork-job-search-criterion.entity';
import { JobPreset } from '../employee-job-preset/job-preset.entity';
import { JobSearchOccupation } from '../employee-job-preset/job-search-occupation/job-search-occupation.entity';
import { JobSearchCategory } from '../employee-job-preset/job-search-category/job-search-category.entity';
import { Report } from '../reports/report.entity';
import { ReportCategory } from '../reports/report-category.entity';
import { EmployeeProposalTemplate } from '../employee-proposal-template/employee-proposal-template.entity';
import { ReportOrganization } from '../reports/report-organization.entity';

const entities = [
	Invite,
	User,
	Employee,
	Candidate,
	Role,
	Organization,
	Income,
	Expense,
	EmployeeSetting,
	UserOrganization,
	OrganizationDepartment,
	OrganizationContact,
	OrganizationPositions,
	OrganizationProject,
	OrganizationVendor,
	OrganizationRecurringExpense,
	EmployeeRecurringExpense,
	OrganizationTeam,
	OrganizationTeamEmployee,
	OrganizationAwards,
	OrganizationLanguages,
	OrganizationDocuments,
	Proposal,
	Country,
	Email,
	TimeOffPolicy,
	TimeOffRequest,
	RolePermissions,
	Tenant,
	TenantSetting,
	EmailTemplate,
	Tag,
	Skill,
	Language,
	Invoice,
	InvoiceItem,
	InvoiceEstimateHistory,
	OrganizationEmploymentType,
	Equipment,
	EquipmentSharing,
	EmployeeLevel,
	Task,
	Goal,
	GoalTimeFrame,
	GoalGeneralSetting,
	GoalKPI,
	GoalTemplate,
	GoalKPITemplate,
	KeyResult,
	KeyResultUpdate,
	KeyResultTemplate,
	TimeSlot,
	Timesheet,
	TimeLog,
	Activity,
	Screenshot,
	TimeSlotMinute,
	ExpenseCategory,
	ProductVariantPrice,
	ProductOption,
	ProductVariantSettings,
	ProductType,
	ProductCategory,
	ProductVariant,
	Product,
	CandidateSource,
	CandidateDocument,
	CandidateFeedback,
	CandidateEducation,
	CandidateSkill,
	CandidateExperience,
	CandidateInterview,
	CandidateInterviewers,
	CandidatePersonalQualities,
	CandidateTechnologies,
	CandidateCriterionsRating,
	HelpCenter,
	HelpCenterArticle,
	HelpCenterAuthor,
	IntegrationSetting,
	Integration,
	IntegrationType,
	IntegrationSetting,
	IntegrationTenant,
	IntegrationMap,
	IntegrationEntitySetting,
	IntegrationEntitySettingTiedEntity,
	RequestApproval,
	RequestApprovalEmployee,
	RequestApprovalTeam,
	ApprovalPolicy,
	EquipmentSharingPolicy,
	EmployeeAppointment,
	AppointmentEmployee,
	EventType,
	AvailabilitySlot,
	ProductTypeTranslation,
	ProductCategoryTranslation,
	Pipeline,
	Payment,
	PipelineStage,
	Deal,
	Payment,
	EstimateEmail,
	Contact,
	OrganizationSprint,
	EmployeeAward,
	JobPreset,
	JobPresetUpworkJobSearchCriterion,
	EmployeeUpworkJobsSearchCriterion,
	JobSearchOccupation,
	JobSearchCategory,
	Report,
	ReportCategory,
	EmployeeProposalTemplate,
	ReportOrganization
];

@Module({
	imports: [
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			useFactory: (config: ConfigService): TypeOrmModuleOptions => ({
				...env.database,
				entities
				// subscribers,
				// migrations,
			}),
			inject: [ConfigService]
		}),
		FileStorageModule
		/*
    TerminusModule.forRootAsync({
      // Inject the TypeOrmHealthIndicator provided by nestjs/terminus
      inject: [TypeOrmHealthIndicator, DNSHealthIndicator],
      useFactory: (db, dns) => getTerminusOptions(db, dns)
    })
    */
	],
	controllers: [],
	providers: []
})
export class CoreModule implements NestModule {
	configure(consumer: MiddlewareConsumer) {
		consumer.apply(RequestContextMiddleware).forRoutes('*');
	}
}
