import { Activity } from './timesheet/activity.entity';
import { AppointmentEmployee } from './appointment-employees/appointment-employees.entity';
import { ApprovalPolicy } from './approval-policy/approval-policy.entity';
import { AvailabilitySlot } from './availability-slots/availability-slots.entity';
import { Candidate } from './candidate/candidate.entity';
import { CandidateCriterionsRating } from './candidate-criterions-rating/candidate-criterion-rating.entity';
import { CandidateDocument } from './candidate-documents/candidate-documents.entity';
import { CandidateEducation } from './candidate-education/candidate-education.entity';
import { CandidateExperience } from './candidate-experience/candidate-experience.entity';
import { CandidateFeedback } from './candidate-feedbacks/candidate-feedbacks.entity';
import { CandidateInterview } from './candidate-interview/candidate-interview.entity';
import { CandidateInterviewers } from './candidate-interviewers/candidate-interviewers.entity';
import { CandidatePersonalQualities } from './candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateSkill } from './candidate-skill/candidate-skill.entity';
import { CandidateSource } from './candidate-source/candidate-source.entity';
import { CandidateTechnologies } from './candidate-technologies/candidate-technologies.entity';
import { Contact } from './contact/contact.entity';
import { Country } from './country/country.entity';
import { Currency } from './currency/currency.entity';
import { CustomSmtp } from './custom-smtp/custom-smtp.entity';
import { Deal } from './deal/deal.entity';
import { Email } from './email/email.entity';
import { EmailTemplate } from './email-template/email-template.entity';
import { Employee } from './employee/employee.entity';
import { EmployeeAppointment } from './employee-appointment/employee-appointment.entity';
import { EmployeeAward } from './employee-award/employee-award.entity';
import { EmployeeLevel } from './organization_employee-level/organization-employee-level.entity';
import { EmployeeProposalTemplate } from './employee-proposal-template/employee-proposal-template.entity';
import { EmployeeRecurringExpense } from './employee-recurring-expense/employee-recurring-expense.entity';
import { EmployeeSetting } from './employee-setting/employee-setting.entity';
import { EmployeeUpworkJobsSearchCriterion } from './employee-job-preset/employee-upwork-jobs-search-criterion.entity';
import { Equipment } from './equipment/equipment.entity';
import { EquipmentSharing } from './equipment-sharing/equipment-sharing.entity';
import { EquipmentSharingPolicy } from './equipment-sharing-policy/equipment-sharing-policy.entity';
import { EstimateEmail } from './estimate-email/estimate-email.entity';
import { EventType } from './event-types/event-type.entity';
import { Expense } from './expense/expense.entity';
import { ExpenseCategory } from './expense-categories/expense-category.entity';
import { Feature } from './feature/feature.entity';
import { FeatureOrganization } from './feature/feature_organization.entity';
import { Goal } from './goal/goal.entity';
import { GoalGeneralSetting } from './goal-general-setting/goal-general-setting.entity';
import { GoalKPI } from './goal-kpi/goal-kpi.entity';
import { GoalKPITemplate } from './goal-kpi-template/goal-kpi-template.entity';
import { GoalTemplate } from './goal-template/goal-template.entity';
import { GoalTimeFrame } from './goal-time-frame/goal-time-frame.entity';
import { HelpCenter } from './help-center/help-center.entity';
import { HelpCenterArticle } from './help-center-article/help-center-article.entity';
import { HelpCenterAuthor } from './help-center-author/help-center-author.entity';
import { Income } from './income/income.entity';
import { Integration } from './integration/integration.entity';
import { IntegrationEntitySetting } from './integration-entity-setting/integration-entity-setting.entity';
import { IntegrationEntitySettingTiedEntity } from './integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.entity';
import { IntegrationMap } from './integration-map/integration-map.entity';
import { IntegrationSetting } from './integration-setting/integration-setting.entity';
import { IntegrationTenant } from './integration-tenant/integration-tenant.entity';
import { IntegrationType } from './integration/integration-type.entity';
import { Invite } from './invite/invite.entity';
import { Invoice } from './invoice/invoice.entity';
import { InvoiceEstimateHistory } from './invoice-estimate-history/invoice-estimate-history.entity';
import { InvoiceItem } from './invoice-item/invoice-item.entity';
import { JobPreset } from './employee-job-preset/job-preset.entity';
import { JobPresetUpworkJobSearchCriterion } from './employee-job-preset/job-preset-upwork-job-search-criterion.entity';
import { JobSearchCategory } from './employee-job-preset/job-search-category/job-search-category.entity';
import { JobSearchOccupation } from './employee-job-preset/job-search-occupation/job-search-occupation.entity';
import { KeyResult } from './keyresult/keyresult.entity';
import { KeyResultTemplate } from './keyresult-template/keyresult-template.entity';
import { KeyResultUpdate } from './keyresult-update/keyresult-update.entity';
import { Language } from './language/language.entity';
import { Organization } from './organization/organization.entity';
import { OrganizationAwards } from './organization-awards/organization-awards.entity';
import { OrganizationContact } from './organization-contact/organization-contact.entity';
import { OrganizationDepartment } from './organization-department/organization-department.entity';
import { OrganizationDocuments } from './organization-documents/organization-documents.entity';
import { OrganizationEmploymentType } from './organization-employment-type/organization-employment-type.entity';
import { OrganizationLanguages } from './organization-languages/organization-languages.entity';
import { OrganizationPositions } from './organization-positions/organization-positions.entity';
import { OrganizationProject } from './organization-projects/organization-projects.entity';
import { OrganizationRecurringExpense } from './organization-recurring-expense/organization-recurring-expense.entity';
import { OrganizationSprint } from './organization-sprint/organization-sprint.entity';
import { OrganizationTeam } from './organization-team/organization-team.entity';
import { OrganizationTeamEmployee } from './organization-team-employee/organization-team-employee.entity';
import { OrganizationVendor } from './organization-vendors/organization-vendors.entity';
import { Payment } from './payment/payment.entity';
import { Pipeline } from './pipeline/pipeline.entity';
import { PipelineStage } from './pipeline-stage/pipeline-stage.entity';
import { Product } from './product/product.entity';
import { ProductCategory } from './product-category/product-category.entity';
import { ProductCategoryTranslation } from './product-category/product-category-translation.entity';
import { ProductOption } from './product-option/product-option.entity';
import { ProductType } from './product-type/product-type.entity';
import { ProductTypeTranslation } from './product-type/product-type-translation.entity';
import { ProductVariant } from './product-variant/product-variant.entity';
import { ProductVariantPrice } from './product-variant-price/product-variant-price.entity';
import { ProductVariantSettings } from './product-settings/product-settings.entity';
import { Proposal } from './proposal/proposal.entity';
import { Report } from './reports/report.entity';
import { ReportCategory } from './reports/report-category.entity';
import { ReportOrganization } from './reports/report-organization.entity';
import { RequestApproval } from './request-approval/request-approval.entity';
import { RequestApprovalEmployee } from './request-approval-employee/request-approval-employee.entity';
import { RequestApprovalTeam } from './request-approval-team/request-approval-team.entity';
import { Role } from './role/role.entity';
import { RolePermissions } from './role-permissions/role-permissions.entity';
import { Screenshot } from './timesheet/screenshot.entity';
import { Skill } from './skills/skill.entity';
import { Tag } from './tags/tag.entity';
import { Task } from './tasks/task.entity';
import { Tenant } from './tenant/tenant.entity';
import { TenantSetting } from './tenant/tenant-setting/tenant-setting.entity';
import { TimeLog } from './timesheet/time-log.entity';
import { TimeOffPolicy } from './time-off-policy/time-off-policy.entity';
import { TimeOffRequest } from './time-off-request/time-off-request.entity';
import { Timesheet } from './timesheet/timesheet.entity';
import { TimeSlot } from './timesheet/time-slot.entity';
import { TimeSlotMinute } from './timesheet/time-slot-minute.entity';
import { User } from './user/user.entity';
import { UserOrganization } from './user-organization/user-organization.entity';

export const coreEntities = [
	Activity,
	AppointmentEmployee,
	ApprovalPolicy,
	AvailabilitySlot,
	Candidate,
	CandidateCriterionsRating,
	CandidateDocument,
	CandidateEducation,
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
	Currency,
	CustomSmtp,
	Deal,
	Email,
	EmailTemplate,
	Employee,
	EmployeeAppointment,
	EmployeeAward,
	EmployeeLevel,
	EmployeeProposalTemplate,
	EmployeeRecurringExpense,
	EmployeeSetting,
	EmployeeUpworkJobsSearchCriterion,
	Equipment,
	EquipmentSharing,
	EquipmentSharingPolicy,
	EstimateEmail,
	EventType,
	Expense,
	ExpenseCategory,
	Feature,
	FeatureOrganization,
	Goal,
	GoalGeneralSetting,
	GoalKPI,
	GoalKPITemplate,
	GoalTemplate,
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
	IntegrationType,
	Invite,
	Invoice,
	InvoiceEstimateHistory,
	InvoiceItem,
	JobPreset,
	JobPresetUpworkJobSearchCriterion,
	JobSearchCategory,
	JobSearchOccupation,
	KeyResult,
	KeyResultTemplate,
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
	OrganizationProject,
	OrganizationRecurringExpense,
	OrganizationSprint,
	OrganizationTeam,
	OrganizationTeamEmployee,
	OrganizationVendor,
	Payment,
	Pipeline,
	PipelineStage,
	Product,
	ProductCategory,
	ProductCategoryTranslation,
	ProductOption,
	ProductType,
	ProductTypeTranslation,
	ProductVariant,
	ProductVariantPrice,
	ProductVariantSettings,
	Proposal,
	Report,
	ReportCategory,
	ReportOrganization,
	RequestApproval,
	RequestApprovalEmployee,
	RequestApprovalTeam,
	Role,
	RolePermissions,
	Screenshot,
	Skill,
	Tag,
	Task,
	Tenant,
	TenantSetting,
	TimeLog,
	TimeOffPolicy,
	TimeOffRequest,
	Timesheet,
	TimeSlot,
	TimeSlotMinute,
	User,
	UserOrganization
];
