import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { camelCase } from 'typeorm/util/StringUtils';
import { ConfigService } from '@gauzy/config';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { isFunction } from '@gauzy/utils';
import { ConnectionEntityManager } from '../../database/connection-entity-manager';
import {
	AccountingTemplate,
	Activity,
	ActivityLog,
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
	Comment,
	Contact,
	Country,
	Currency,
	CustomSmtp,
	DailyPlan,
	Dashboard,
	DashboardWidget,
	Deal,
	EmailHistory,
	EmailReset,
	EmailTemplate,
	Employee,
	EmployeeAppointment,
	EmployeeAvailability,
	EmployeeAward,
	EmployeeLevel,
	EmployeeNotification,
	EmployeeNotificationSetting,
	EmployeePhone,
	EmployeeRecurringExpense,
	EmployeeSetting,
	EntitySubscription,
	Equipment,
	EquipmentSharing,
	EquipmentSharingPolicy,
	EstimateEmail,
	EventType,
	Expense,
	ExpenseCategory,
	Favorite,
	Feature,
	FeatureOrganization,
	Goal,
	GoalGeneralSetting,
	GoalKPI,
	GoalKPITemplate,
	GoalTemplate,
	GoalTimeFrame,
	ImageAsset,
	ImportHistory,
	Income,
	Integration,
	IntegrationEntitySetting,
	IntegrationEntitySettingTied,
	IntegrationMap,
	IntegrationSetting,
	IntegrationTenant,
	IntegrationType,
	Invite,
	Invoice,
	InvoiceEstimateHistory,
	InvoiceItem,
	IssueType,
	KeyResult,
	KeyResultTemplate,
	KeyResultUpdate,
	Language,
	Mention,
	Merchant,
	Organization,
	OrganizationAward,
	OrganizationContact,
	OrganizationDepartment,
	OrganizationDocument,
	OrganizationEmploymentType,
	OrganizationLanguage,
	OrganizationPosition,
	OrganizationProject,
	OrganizationProjectEmployee,
	OrganizationProjectModule,
	OrganizationProjectModuleEmployee,
	OrganizationRecurringExpense,
	OrganizationSprint,
	OrganizationSprintEmployee,
	OrganizationSprintTask,
	OrganizationSprintTaskHistory,
	OrganizationTaskSetting,
	OrganizationTeam,
	OrganizationTeamEmployee,
	OrganizationTeamJoinRequest,
	OrganizationVendor,
	Payment,
	Pipeline,
	PipelineStage,
	Product,
	ProductCategory,
	ProductCategoryTranslation,
	ProductOption,
	ProductOptionGroup,
	ProductOptionGroupTranslation,
	ProductOptionTranslation,
	ProductTranslation,
	ProductType,
	ProductTypeTranslation,
	ProductVariant,
	ProductVariantPrice,
	ProductVariantSetting,
	Reaction,
	Report,
	ReportCategory,
	ReportOrganization,
	RequestApproval,
	RequestApprovalEmployee,
	RequestApprovalTeam,
	ResourceLink,
	Role,
	RolePermission,
	ScreeningTask,
	Screenshot,
	Skill,
	SocialAccount,
	Tag,
	TagType,
	Task,
	TaskEstimation,
	TaskLinkedIssue,
	TaskPriority,
	TaskRelatedIssueType,
	TaskSize,
	TaskStatus,
	TaskVersion,
	TaskView,
	Tenant,
	TenantSetting,
	TimeLog,
	TimeOffPolicy,
	TimeOffRequest,
	Timesheet,
	TimeSlot,
	TimeSlotMinute,
	User,
	UserOrganization,
	Warehouse,
	WarehouseProduct,
	WarehouseProductVariant
} from '../../core/entities/internal';
import { ImportRecord } from '../import-record';
import { MikroOrmAccountingTemplateRepository } from '../../accounting-template/repository/mikro-orm-accounting-template.repository';
import { TypeOrmAccountingTemplateRepository } from '../../accounting-template/repository/type-orm-accounting-template.repository';
import { MikroOrmAppointmentEmployeeRepository } from '../../appointment-employees/repository/mikro-orm-appointment-employee.repository';
import { TypeOrmAppointmentEmployeeRepository } from '../../appointment-employees/repository/type-orm-appointment-employee.repository';
import { MikroOrmApprovalPolicyRepository } from '../../approval-policy/repository/mikro-orm-approval-policy.repository';
import { TypeOrmApprovalPolicyRepository } from '../../approval-policy/repository/type-orm-approval-policy.repository';
import { MikroOrmAvailabilitySlotRepository } from '../../availability-slots/repository/mikro-orm-availability-slot.repository';
import { TypeOrmAvailabilitySlotRepository } from '../../availability-slots/repository/type-orm-availability-slot.repository';
import { MikroOrmCandidateCriterionsRatingRepository } from '../../candidate-criterions-rating/repository/mikro-orm-candidate-criterions-rating.repository';
import { TypeOrmCandidateCriterionsRatingRepository } from '../../candidate-criterions-rating/repository/type-orm-candidate-criterions-rating.repository';
import { MikroOrmCandidateDocumentRepository } from '../../candidate-documents/repository/mikro-orm-candidate-document.repository';
import { TypeOrmCandidateDocumentRepository } from '../../candidate-documents/repository/type-orm-candidate-document.repository';
import { MikroOrmCandidateEducationRepository } from '../../candidate-education/repository/mikro-orm-candidate-education.repository';
import { TypeOrmCandidateEducationRepository } from '../../candidate-education/repository/type-orm-candidate-education.repository';
import { MikroOrmCandidateExperienceRepository } from '../../candidate-experience/repository/mikro-orm-candidate-experience.repository';
import { TypeOrmCandidateExperienceRepository } from '../../candidate-experience/repository/type-orm-candidate-experience.repository';
import { MikroOrmCandidateFeedbackRepository } from '../../candidate-feedbacks/repository/mikro-orm-candidate-feedback.repository';
import { TypeOrmCandidateFeedbackRepository } from '../../candidate-feedbacks/repository/type-orm-candidate-feedback.repository';
import { MikroOrmCandidateInterviewRepository } from '../../candidate-interview/repository/mikro-orm-candidate-interview.repository';
import { TypeOrmCandidateInterviewRepository } from '../../candidate-interview/repository/type-orm-candidate-interview.repository';
import { MikroOrmCandidateInterviewersRepository } from '../../candidate-interviewers/repository/mikro-orm-candidate-interviewers.repository';
import { TypeOrmCandidateInterviewersRepository } from '../../candidate-interviewers/repository/type-orm-candidate-interviewers.repository';
import { MikroOrmCandidatePersonalQualitiesRepository } from '../../candidate-personal-qualities/repository/mikro-orm-candidate-personal-qualities.repository';
import { TypeOrmCandidatePersonalQualitiesRepository } from '../../candidate-personal-qualities/repository/type-orm-candidate-personal-qualities.repository';
import { MikroOrmCandidateSkillRepository } from '../../candidate-skill/repository/mikro-orm-candidate-skill.repository';
import { TypeOrmCandidateSkillRepository } from '../../candidate-skill/repository/type-orm-candidate-skill.repository';
import { MikroOrmCandidateSourceRepository } from '../../candidate-source/repository/mikro-orm-candidate-source.repository';
import { TypeOrmCandidateSourceRepository } from '../../candidate-source/repository/type-orm-candidate-source.repository';
import { MikroOrmCandidateTechnologiesRepository } from '../../candidate-technologies/repository/mikro-orm-candidate-technologies.repository';
import { TypeOrmCandidateTechnologiesRepository } from '../../candidate-technologies/repository/type-orm-candidate-technologies.repository';
import { MikroOrmCandidateRepository } from '../../candidate/repository/mikro-orm-candidate.repository';
import { TypeOrmCandidateRepository } from '../../candidate/repository/type-orm-candidate.repository';
import { MikroOrmContactRepository } from '../../contact/repository/mikro-orm-contact.repository';
import { TypeOrmContactRepository } from '../../contact/repository/type-orm-contact.repository';
import { MikroOrmCustomSmtpRepository } from '../../custom-smtp/repository/mikro-orm-custom-smtp.repository';
import { TypeOrmCustomSmtpRepository } from '../../custom-smtp/repository/type-orm-custom-smtp.repository';
import { MikroOrmDealRepository } from '../../deal/repository/mikro-orm-deal.repository';
import { TypeOrmDealRepository } from '../../deal/repository/type-orm-deal.repository';
import { MikroOrmEmailHistoryRepository } from '../../email-history/repository/mikro-orm-email-history.repository';
import { TypeOrmEmailHistoryRepository } from '../../email-history/repository/type-orm-email-history.repository';
import { MikroOrmEmailTemplateRepository } from '../../email-template/repository/mikro-orm-email-template.repository';
import { TypeOrmEmailTemplateRepository } from '../../email-template/repository/type-orm-email-template.repository';
import { MikroOrmEmployeeAppointmentRepository } from '../../employee-appointment/repository/mikro-orm-employee-appointment.repository';
import { TypeOrmEmployeeAppointmentRepository } from '../../employee-appointment/repository/type-orm-employee-appointment.repository';
import { MikroOrmEmployeeAwardRepository } from '../../employee-award/repository/mikro-orm-employee-award.repository';
import { TypeOrmEmployeeAwardRepository } from '../../employee-award/repository/type-orm-employee-award.repository';
import { MikroOrmEmployeeLevelRepository } from '../../employee-level/repository/mikro-orm-employee-level.repository';
import { TypeOrmEmployeeLevelRepository } from '../../employee-level/repository/type-orm-employee-level.repository';
import { MikroOrmEmployeeRecurringExpenseRepository } from '../../employee-recurring-expense/repository/mikro-orm-employee-recurring-expense.repository';
import { TypeOrmEmployeeRecurringExpenseRepository } from '../../employee-recurring-expense/repository/type-orm-employee-recurring-expense.repository';
import { MikroOrmEmployeeSettingRepository } from '../../employee-setting/repository/mikro-orm-employee-setting.repository';
import { TypeOrmEmployeeSettingRepository } from '../../employee-setting/repository/type-orm-employee-setting.repository';
import { MikroOrmEmployeeRepository } from '../../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
import { MikroOrmEquipmentSharingPolicyRepository } from '../../equipment-sharing-policy/repository/mikro-orm-equipment-sharing-policy.repository';
import { TypeOrmEquipmentSharingPolicyRepository } from '../../equipment-sharing-policy/repository/type-orm-equipment-sharing-policy.repository';
import { MikroOrmEquipmentSharingRepository } from '../../equipment-sharing/repository/mikro-orm-equipment-sharing.repository';
import { TypeOrmEquipmentSharingRepository } from '../../equipment-sharing/repository/type-orm-equipment-sharing.repository';
import { MikroOrmEquipmentRepository } from '../../equipment/repository/mikro-orm-equipment.repository';
import { TypeOrmEquipmentRepository } from '../../equipment/repository/type-orm-equipment.repository';
import { MikroOrmEstimateEmailRepository } from '../../estimate-email/repository/mikro-orm-estimate-email.repository';
import { TypeOrmEstimateEmailRepository } from '../../estimate-email/repository/type-orm-estimate-email.repository';
import { MikroOrmEventTypeRepository } from '../../event-types/repository/mikro-orm-event-type.repository';
import { TypeOrmEventTypeRepository } from '../../event-types/repository/type-orm-event-types.repository';
import { MikroOrmExpenseCategoryRepository } from '../../expense-categories/repository/mikro-orm-expense-category.repository';
import { TypeOrmExpenseCategoryRepository } from '../../expense-categories/repository/type-orm-expense-category.repository';
import { MikroOrmExpenseRepository } from '../../expense/repository/mikro-orm-expense.repository';
import { TypeOrmExpenseRepository } from '../../expense/repository/type-orm-expense.repository';
import { MikroOrmFeatureOrganizationRepository } from '../../feature/repository/mikro-orm-feature-organization.repository';
import { MikroOrmFeatureRepository } from '../../feature/repository/mikro-orm-feature.repository';
import { TypeOrmFeatureRepository } from '../../feature/repository/type-orm-feature.repository';
import { TypeOrmFeatureOrganizationRepository } from '../../feature/repository/type-orm-feature-organization.repository';
import { MikroOrmGoalGeneralSettingRepository } from '../../goal-general-setting/repository/mikro-orm-goal-general-setting.repository';
import { TypeOrmGoalGeneralSettingRepository } from '../../goal-general-setting/repository/type-orm-goal-general-setting.repository';
import { MikroOrmGoalKPITemplateRepository } from '../../goal-kpi-template/repository/mikro-orm-goal-kpi-template.repository';
import { TypeOrmGoalKPITemplateRepository } from '../../goal-kpi-template/repository/type-orm-goal-kpi-template.repository';
import { MikroOrmGoalKPIRepository } from '../../goal-kpi/repository/mikro-orm-goal-kpi.repository';
import { TypeOrmGoalKPIRepository } from '../../goal-kpi/repository/type-orm-goal-kpi.repository';
import { MikroOrmGoalTemplateRepository } from '../../goal-template/repository/mikro-orm-goal-template.repository';
import { TypeOrmGoalTemplateRepository } from '../../goal-template/repository/type-orm-goal-template.repository';
import { MikroOrmGoalTimeFrameRepository } from '../../goal-time-frame/repository/mikro-orm-goal-time-frame.repository';
import { TypeOrmGoalTimeFrameRepository } from '../../goal-time-frame/repository/type-orm-goal-time-frame.repository';
import { MikroOrmGoalRepository } from '../../goal/repository/mikro-orm-goal.repository';
import { TypeOrmGoalRepository } from '../../goal/repository/type-orm-goal.repository';
import { MikroOrmImageAssetRepository } from '../../image-asset/repository/mikro-orm-image-asset.repository';
import { TypeOrmImageAssetRepository } from '../../image-asset/repository/type-orm-image-asset.repository';
import { MikroOrmIncomeRepository } from '../../income/repository/mikro-orm-income.repository';
import { TypeOrmIncomeRepository } from '../../income/repository/type-orm-income.repository';
import { MikroOrmIntegrationEntitySettingTiedRepository } from '../../integration-entity-setting-tied/repository/mikro-orm-integration-entity-setting-tied.repository';
import { TypeOrmIntegrationEntitySettingTiedRepository } from '../../integration-entity-setting-tied/repository/type-orm-integration-entity-setting-tied.repository';
import { MikroOrmIntegrationEntitySettingRepository } from '../../integration-entity-setting/repository/mikro-orm-integration-entity-setting.repository';
import { TypeOrmIntegrationEntitySettingRepository } from '../../integration-entity-setting/repository/type-orm-integration-entity-setting.repository';
import { MikroOrmIntegrationMapRepository } from '../../integration-map/repository/mikro-orm-integration-map.repository';
import { TypeOrmIntegrationMapRepository } from '../../integration-map/repository/type-orm-integration-map.repository';
import { MikroOrmIntegrationSettingRepository } from '../../integration-setting/repository/mikro-orm-integration-setting.repository';
import { TypeOrmIntegrationSettingRepository } from '../../integration-setting/repository/type-orm-integration-setting.repository';
import { MikroOrmIntegrationTenantRepository } from '../../integration-tenant/repository/mikro-orm-integration-tenant.repository';
import { TypeOrmIntegrationTenantRepository } from '../../integration-tenant/repository/type-orm-integration-tenant.repository';
import { MikroOrmIntegrationTypeRepository } from '../../integration/repository/mikro-orm-integration-type.repository';
import { MikroOrmIntegrationRepository } from '../../integration/repository/mikro-orm-integration.repository';
import { TypeOrmIntegrationTypeRepository } from '../../integration/repository/type-orm-integration-type.repository';
import { TypeOrmIntegrationRepository } from '../../integration/repository/type-orm-integration.repository';
import { MikroOrmInviteRepository } from '../../invite/repository/mikro-orm-invite.repository';
import { TypeOrmInviteRepository } from '../../invite/repository/type-orm-invite.repository';
import { MikroOrmInvoiceEstimateHistoryRepository } from '../../invoice-estimate-history/repository/mikro-orm-invoice-estimate-history.repository';
import { TypeOrmInvoiceEstimateHistoryRepository } from '../../invoice-estimate-history/repository/type-orm-invoice-estimate-history.repository';
import { MikroOrmInvoiceItemRepository } from '../../invoice-item/repository/mikro-orm-invoice-item.repository';
import { TypeOrmInvoiceItemRepository } from '../../invoice-item/repository/type-orm-invoice-item.repository';
import { MikroOrmInvoiceRepository } from '../../invoice/repository/mikro-orm-invoice.repository';
import { TypeOrmInvoiceRepository } from '../../invoice/repository/type-orm-invoice.repository';
import { MikroOrmKeyResultTemplateRepository } from '../../keyresult-template/repository/mikro-orm-keyresult-template.repository';
import { TypeOrmKeyResultTemplateRepository } from '../../keyresult-template/repository/type-orm-keyresult-template.repository';
import { MikroOrmKeyResultUpdateRepository } from '../../keyresult-update/repository/mikro-orm-keyresult-update.repository';
import { TypeOrmKeyResultUpdateRepository } from '../../keyresult-update/repository/type-orm-keyresult-update.repository';
import { MikroOrmKeyResultRepository } from '../../keyresult/repository/mikro-orm-keyresult.repository';
import { TypeOrmKeyResultRepository } from '../../keyresult/repository/type-orm-keyresult.repository';
import { MikroOrmLanguageRepository } from '../../language/repository/mikro-orm-language.repository';
import { TypeOrmLanguageRepository } from '../../language/repository/type-orm-language.repository';
import { MikroOrmMerchantRepository } from '../../merchant/repository/mikro-orm-merchant.repository';
import { TypeOrmMerchantRepository } from '../../merchant/repository/type-orm-merchant.repository';
import { MikroOrmOrganizationAwardRepository } from '../../organization-award/repository/mikro-orm-organization-award.repository';
import { TypeOrmOrganizationAwardRepository } from '../../organization-award/repository/type-orm-organization-award.repository';
import { MikroOrmOrganizationContactRepository } from '../../organization-contact/repository/mikro-orm-organization-contact.repository';
import { TypeOrmOrganizationContactRepository } from '../../organization-contact/repository/type-orm-organization-contact.repository';
import { MikroOrmOrganizationDepartmentRepository } from '../../organization-department/repository/mikro-orm-organization-department.repository';
import { TypeOrmOrganizationDepartmentRepository } from '../../organization-department/repository/type-orm-organization-department.repository';
import { MikroOrmOrganizationDocumentRepository } from '../../organization-document/repository/mikro-orm-organization-document.repository';
import { TypeOrmOrganizationDocumentRepository } from '../../organization-document/repository/type-orm-organization-document.repository';
import { MikroOrmOrganizationEmploymentTypeRepository } from '../../organization-employment-type/repository/mikro-orm-organization-employment-type.repository';
import { TypeOrmOrganizationEmploymentTypeRepository } from '../../organization-employment-type/repository/type-orm-organization-employment-type.repository';
import { MikroOrmOrganizationLanguageRepository } from '../../organization-language/repository/mikro-orm-organization-language.repository';
import { TypeOrmOrganizationLanguageRepository } from '../../organization-language/repository/type-orm-organization-language.repository';
import { MikroOrmOrganizationPositionRepository } from '../../organization-position/repository/mikro-orm-organization-position.repository';
import { TypeOrmOrganizationPositionRepository } from '../../organization-position/repository/type-orm-organization-position.repository';
import { MikroOrmOrganizationProjectRepository } from '../../organization-project/repository/mikro-orm-organization-project.repository';
import { TypeOrmOrganizationProjectRepository } from '../../organization-project/repository/type-orm-organization-project.repository';
import { MikroOrmOrganizationRecurringExpenseRepository } from '../../organization-recurring-expense/repository/mikro-orm-organization-recurring-expense.repository';
import { TypeOrmOrganizationRecurringExpenseRepository } from '../../organization-recurring-expense/repository/type-orm-organization-recurring-expense.repository';
import { MikroOrmOrganizationSprintRepository } from '../../organization-sprint/repository/mikro-orm-organization-sprint.repository';
import { TypeOrmOrganizationSprintRepository } from '../../organization-sprint/repository/type-orm-organization-sprint.repository';
import { MikroOrmOrganizationTeamEmployeeRepository } from '../../organization-team-employee/repository/mikro-orm-organization-team-employee.repository';
import { TypeOrmOrganizationTeamEmployeeRepository } from '../../organization-team-employee/repository/type-orm-organization-team-employee.repository';
import { MikroOrmOrganizationTeamRepository } from '../../organization-team/repository/mikro-orm-organization-team.repository';
import { TypeOrmOrganizationTeamRepository } from '../../organization-team/repository/type-orm-organization-team.repository';
import { MikroOrmOrganizationVendorRepository } from '../../organization-vendor/repository/mikro-orm-organization-vendor.repository';
import { TypeOrmOrganizationVendorRepository } from '../../organization-vendor/repository/type-orm-organization-vendor.repository';
import { MikroOrmOrganizationRepository } from '../../organization/repository/mikro-orm-organization.repository';
import { TypeOrmOrganizationRepository } from '../../organization/repository/type-orm-organization.repository';
import { MikroOrmPaymentRepository } from '../../payment/repository/mikro-orm-payment.repository';
import { TypeOrmPaymentRepository } from '../../payment/repository/type-orm-payment.repository';
import { MikroOrmPipelineStageRepository } from '../../pipeline-stage/repository/mikro-orm-pipeline-stage.repository';
import { TypeOrmPipelineStageRepository } from '../../pipeline-stage/repository/type-orm-pipeline-stage.repository';
import { MikroOrmPipelineRepository } from '../../pipeline/repository/mikro-orm-pipeline.repository';
import { TypeOrmPipelineRepository } from '../../pipeline/repository/type-orm-pipeline.repository';
import { MikroOrmProductCategoryTranslationRepository } from '../../product-category/repository/mikro-orm-product-category-translation.repository';
import { MikroOrmProductCategoryRepository } from '../../product-category/repository/mikro-orm-product-category.repository';
import { TypeOrmProductCategoryTranslationRepository } from '../../product-category/repository/type-orm-product-category-translation.repository';
import { TypeOrmProductCategoryRepository } from '../../product-category/repository/type-orm-product-category.repository';
import { MikroOrmProductOptionGroupTranslationRepository } from '../../product-option/repository/mikro-orm-product-option-group-translation.repository';
import { MikroOrmProductOptionGroupRepository } from '../../product-option/repository/mikro-orm-product-option-group.repository';
import { MikroOrmProductOptionTranslationRepository } from '../../product-option/repository/mikro-orm-product-option-translation.repository';
import { MikroOrmProductOptionRepository } from '../../product-option/repository/mikro-orm-product-option.repository';
import { TypeOrmProductOptionGroupTranslationRepository } from '../../product-option/repository/type-orm-product-option-group-translation.repository';
import { TypeOrmProductOptionGroupRepository } from '../../product-option/repository/type-orm-product-option-group.repository';
import { TypeOrmProductOptionTranslationRepository } from '../../product-option/repository/type-orm-product-option-translation.repository';
import { TypeOrmProductOptionRepository } from '../../product-option/repository/type-orm-product-option.repository';
import { MikroOrmProductVariantSettingRepository } from '../../product-setting/repository/mikro-orm-product-setting.repository';
import { TypeOrmProductVariantSettingRepository } from '../../product-setting/repository/type-orm-product-setting.repository';
import { MikroOrmProductTypeTranslationRepository } from '../../product-type/repository/mikro-orm-product-type-translation.repository';
import { MikroOrmProductTypeRepository } from '../../product-type/repository/mikro-orm-product-type.repository';
import { TypeOrmProductTypeTranslationRepository } from '../../product-type/repository/type-orm-product-type-translation.repository';
import { TypeOrmProductTypeRepository } from '../../product-type/repository/type-orm-product-type.repository';
import { MikroOrmProductVariantPriceRepository } from '../../product-variant-price/repository/mikro-orm-product-variant-price.repository';
import { TypeOrmProductVariantPriceRepository } from '../../product-variant-price/repository/type-orm-product-variant-price.repository';
import { MikroOrmProductVariantRepository } from '../../product-variant/repository/mikro-orm-product-variant.repository';
import { TypeOrmProductVariantRepository } from '../../product-variant/repository/type-orm-product-variant.repository';
import { MikroOrmProductTranslationRepository } from '../../product/repository/mikro-orm-product-translation.repository';
import { MikroOrmProductRepository } from '../../product/repository/mikro-orm-product.repository';
import { TypeOrmProductTranslationRepository } from '../../product/repository/type-orm-product-translation.repository';
import { TypeOrmProductRepository } from '../../product/repository/type-orm-product.repository';
import { MikroOrmReportCategoryRepository } from '../../reports/repository/mikro-orm-report-category.repository';
import { MikroOrmReportOrganizationRepository } from '../../reports/repository/mikro-orm-report-organization.repository';
import { MikroOrmReportRepository } from '../../reports/repository/mikro-orm-report.repository';
import { TypeOrmReportCategoryRepository } from '../../reports/repository/type-orm-report-category.repository';
import { TypeOrmReportOrganizationRepository } from '../../reports/repository/type-orm-report-organization.repository';
import { TypeOrmReportRepository } from '../../reports/repository/type-orm-report.repository';
import { MikroOrmRequestApprovalEmployeeRepository } from '../../request-approval-employee/repository/mikro-orm-request-approval-employee.repository';
import { TypeOrmRequestApprovalEmployeeRepository } from '../../request-approval-employee/repository/type-orm-request-approval-employee.repository';
import { MikroOrmRequestApprovalTeamRepository } from '../../request-approval-team/repository/mikro-orm-request-approval-team.repository';
import { TypeOrmRequestApprovalTeamRepository } from '../../request-approval-team/repository/type-orm-request-approval-team.repository';
import { MikroOrmRequestApprovalRepository } from '../../request-approval/repository/mikro-orm-request-approval.repository';
import { TypeOrmRequestApprovalRepository } from '../../request-approval/repository/type-orm-request-approval.repository';
import { MikroOrmRolePermissionRepository } from '../../role-permission/repository/mikro-orm-role-permission.repository';
import { TypeOrmRolePermissionRepository } from '../../role-permission/repository/type-orm-role-permission.repository';
import { MikroOrmRoleRepository } from '../../role/repository/mikro-orm-role.repository';
import { TypeOrmRoleRepository } from '../../role/repository/type-orm-role.repository';
import { MikroOrmSkillRepository } from '../../skills/repository/mikro-orm-skill.repository';
import { TypeOrmSkillRepository } from '../../skills/repository/type-orm-skill.repository';
import { MikroOrmTagRepository } from '../../tags/repository/mikro-orm-tag.repository';
import { TypeOrmTagRepository } from '../../tags/repository/type-orm-tag.repository';
import { MikroOrmTaskRepository } from '../../tasks/repository/mikro-orm-task.repository';
import { TypeOrmTaskRepository } from '../../tasks/repository/type-orm-task.repository';
import { MikroOrmTenantSettingRepository } from '../../tenant/tenant-setting/repository/mikro-orm-tenant-setting.repository';
import { TypeOrmTenantSettingRepository } from '../../tenant/tenant-setting/repository/type-orm-tenant-setting.repository';
import { MikroOrmTimeOffPolicyRepository } from '../../time-off-policy/repository/mikro-orm-time-off-policy.repository';
import { TypeOrmTimeOffPolicyRepository } from '../../time-off-policy/repository/type-orm-time-off-policy.repository';
import { MikroOrmTimeOffRequestRepository } from '../../time-off-request/repository/mikro-orm-time-off-request.repository';
import { TypeOrmTimeOffRequestRepository } from '../../time-off-request/repository/type-orm-time-off-request.repository';
import { MikroOrmActivityRepository } from '../../time-tracking/activity/repository/mikro-orm-activity.repository';
import { TypeOrmActivityRepository } from '../../time-tracking/activity/repository/type-orm-activity.repository';
import { MikroOrmScreenshotRepository } from '../../time-tracking/screenshot/repository/mikro-orm-screenshot.repository';
import { TypeOrmScreenshotRepository } from '../../time-tracking/screenshot/repository/type-orm-screenshot.repository';
import { MikroOrmTimeLogRepository } from '../../time-tracking/time-log/repository/mikro-orm-time-log.repository';
import { TypeOrmTimeLogRepository } from '../../time-tracking/time-log/repository/type-orm-time-log.repository';
import { MikroOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/mikro-orm-time-slot.repository';
import { TypeOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotMinuteRepository } from '../../time-tracking/time-slot/time-slot-minute/repositories/mikro-orm-time-slot-minute.repository';
import { TypeOrmTimeSlotMinuteRepository } from '../../time-tracking/time-slot/time-slot-minute/repositories/type-orm-time-slot-minute.repository';
import { MikroOrmTimesheetRepository } from '../../time-tracking/timesheet/repository/mikro-orm-timesheet.repository';
import { TypeOrmTimesheetRepository } from '../../time-tracking/timesheet/repository/type-orm-timesheet.repository';
import { MikroOrmUserOrganizationRepository } from '../../user-organization/repository/mikro-orm-user-organization.repository';
import { TypeOrmUserOrganizationRepository } from '../../user-organization/repository/type-orm-user-organization.repository';
import { MikroOrmUserRepository } from '../../user/repository/mikro-orm-user.repository';
import { TypeOrmUserRepository } from '../../user/repository/type-orm-user.repository';
import { MikroOrmWarehouseProductVariantRepository } from '../../warehouse/repository/mikro-orm-warehouse-product-variant.repository';
import { MikroOrmWarehouseProductRepository } from '../../warehouse/repository/mikro-orm-warehouse-product.repository ';
import { MikroOrmWarehouseRepository } from '../../warehouse/repository/mikro-orm-warehouse.repository';
import { TypeOrmWarehouseProductVariantRepository } from '../../warehouse/repository/type-orm-warehouse-product-variant.repository';
import { TypeOrmWarehouseProductRepository } from '../../warehouse/repository/type-orm-warehouse-product.repository ';
import { TypeOrmWarehouseRepository } from '../../warehouse/repository/type-orm-warehouse.repository';
import { TypeOrmTagTypeRepository } from '../../tag-type/repository/type-orm-tag-type.repository';
import { TypeOrmTenantRepository } from '../../tenant/repository/type-orm-tenant.repository';
import { TypeOrmActivityLogRepository } from '../../activity-log/repository/type-orm-activity-log.repository';
import { TypeOrmSocialAccountRepository } from '../../auth/social-account/repository/type-orm-social-account.repository';
import { TypeOrmCommentRepository } from '../../comment/repository/type-orm-comment.repository';
import { TypeOrmEmailResetRepository } from '../../email-reset/repository/type-orm-email-reset.repository';
import { TypeOrmEmployeeAvailabilityRepository } from '../../employee-availability/repository/type-orm-employee-availability.repository';
import { TypeOrmEmployeeNotificationSettingRepository } from '../../employee-notification-setting/repository/type-orm-employee-notification-setting.repository';
import { TypeOrmEmployeeNotificationRepository } from '../../employee-notification/repository/type-orm-employee-notification.repository';
import { TypeOrmEmployeePhoneRepository } from '../../employee-phone/repository/type-orm-employee-phone.repository';
import { TypeOrmEntitySubscriptionRepository } from '../../entity-subscription/repository/type-orm-entity-subscription.repository';
import { TypeOrmFavoriteRepository } from '../../favorite/repository/type-orm-favorite.repository';
import { TypeOrmMentionRepository } from '../../mention/repository/type-orm-mention.repository';
import { TypeOrmOrganizationProjectModuleEmployeeRepository } from '../../organization-project-module/repository/type-orm-organization-project-module-employee.repository';
import { TypeOrmOrganizationProjectModuleRepository } from '../../organization-project-module/repository/type-orm-organization-project-module.repository';
import { TypeOrmOrganizationProjectEmployeeRepository } from '../../organization-project/repository/type-orm-organization-project-employee.repository';
import { TypeOrmOrganizationSprintEmployeeRepository } from '../../organization-sprint/repository/type-orm-organization-sprint-employee.repository';
import { TypeOrmOrganizationSprintTaskHistoryRepository } from '../../organization-sprint/repository/type-orm-organization-sprint-task-history.repository';
import { TypeOrmOrganizationSprintTaskRepository } from '../../organization-sprint/repository/type-orm-organization-sprint-task.repository';
import { TypeOrmOrganizationTaskSettingRepository } from '../../organization-task-setting/repository/type-orm-organization-task-setting.repository';
import { TypeOrmOrganizationTeamJoinRequestRepository } from '../../organization-team-join-request/repository/type-orm-organization-team-join-request.repository';
import { TypeOrmReactionRepository } from '../../reaction/repository/type-orm-reaction.repository';
import { TypeOrmResourceLinkRepository } from '../../resource-link/repository/type-orm-resource-link.repository';
import { TypeOrmDailyPlanRepository } from '../../tasks/daily-plan/repository/type-orm-daily-plan.repository';
import { TypeOrmTaskEstimationRepository } from '../../tasks/estimation/repository/type-orm-estimation.repository';
import { TypeOrmIssueTypeRepository } from '../../tasks/issue-type/repository/type-orm-issue-type.repository';
import { TypeOrmTaskLinkedIssueRepository } from '../../tasks/linked-issue/repository/type-orm-linked-issue.repository';
import { TypeOrmTaskPriorityRepository } from '../../tasks/priorities/repository/type-orm-task-priority.repository';
import { TypeOrmTaskRelatedIssueTypeRepository } from '../../tasks/related-issue-type/repository/type-orm-related-issue-type.repository';
import { TypeOrmScreeningTaskRepository } from '../../tasks/screening-tasks/repository/type-orm-screening-task.repository';
import { TypeOrmTaskSizeRepository } from '../../tasks/sizes/repository/type-orm-task-size.repository';
import { TypeOrmTaskStatusRepository } from '../../tasks/statuses/repository/type-orm-task-status.repository';
import { TypeOrmTaskVersionRepository } from '../../tasks/versions/repository/type-orm-task-version.repository';
import { TypeOrmTaskViewRepository } from '../../tasks/views/repository/type-orm-task-view.repository';
import { TypeOrmImportHistoryRepository } from '../import-history/repository/type-orm-import-history.repository';
import { TypeOrmImportRecordRepository } from '../import-record/repository/type-orm-import-record.repository';
import { TypeOrmCountryRepository } from '../../country/repository/type-orm-country.repository';
import { TypeOrmCurrencyRepository } from '../../currency/repository/type-orm-currency.repository';
import { TypeOrmDashboardRepository } from '../../dashboard/repository/type-orm-dashboard.repository';
import { TypeOrmDashboardWidgetRepository } from '../../dashboard/dashboard-widget/repository/type-orm-dashboard-widget.repository';

export interface IForeignKey<T = any> {
	column: string;
	inverseColumn?: string;
	repository: Repository<T>;
}

export interface IColumnRelationMetadata<T = any> {
	joinTableName: string;
	foreignKeys: IForeignKey<T>[];
	isCheckRelation: boolean;
}

export interface IRepositoryModel<T = any> {
	repository: Repository<T>;
	relations?: IColumnRelationMetadata<T>[];
	foreignKeys?: IForeignKey<any>[];
	uniqueIdentifiers?: { column: string }[];

	// additional condition
	isStatic?: boolean;
	isCheckRelation: boolean;

	// export service fields
	isTenantBased?: boolean;
	substitute?: {
		originalField: string;
		substituteField: string;
	};
}

@Injectable()
export class RepositoriesService implements OnModuleInit {
	constructor(
		@InjectRepository(AccountingTemplate)
		public typeOrmAccountingTemplateRepository: TypeOrmAccountingTemplateRepository,

		mikroOrmAccountingTemplateRepository: MikroOrmAccountingTemplateRepository,

		@InjectRepository(Activity)
		public typeOrmActivityRepository: TypeOrmActivityRepository,

		mikroOrmActivityRepository: MikroOrmActivityRepository,

		@InjectRepository(AppointmentEmployee)
		public typeOrmAppointmentEmployeeRepository: TypeOrmAppointmentEmployeeRepository,

		mikroOrmAppointmentEmployeeRepository: MikroOrmAppointmentEmployeeRepository,

		@InjectRepository(ApprovalPolicy)
		public typeOrmApprovalPolicyRepository: TypeOrmApprovalPolicyRepository,

		mikroOrmApprovalPolicyRepository: MikroOrmApprovalPolicyRepository,

		@InjectRepository(AvailabilitySlot)
		public typeOrmAvailabilitySlotRepository: TypeOrmAvailabilitySlotRepository,

		mikroOrmAvailabilitySlotRepository: MikroOrmAvailabilitySlotRepository,

		@InjectRepository(Candidate)
		public typeOrmCandidateRepository: TypeOrmCandidateRepository,

		mikroOrmCandidateRepository: MikroOrmCandidateRepository,

		@InjectRepository(CandidateCriterionsRating)
		public typeOrmCandidateCriterionsRatingRepository: TypeOrmCandidateCriterionsRatingRepository,

		mikroOrmCandidateCriterionsRatingRepository: MikroOrmCandidateCriterionsRatingRepository,

		@InjectRepository(CandidateDocument)
		public typeOrmCandidateDocumentRepository: TypeOrmCandidateDocumentRepository,

		mikroOrmCandidateDocumentRepository: MikroOrmCandidateDocumentRepository,

		@InjectRepository(CandidateEducation)
		public typeOrmCandidateEducationRepository: TypeOrmCandidateEducationRepository,

		mikroOrmCandidateEducationRepository: MikroOrmCandidateEducationRepository,

		@InjectRepository(CandidateExperience)
		public typeOrmCandidateExperienceRepository: TypeOrmCandidateExperienceRepository,

		mikroOrmCandidateExperienceRepository: MikroOrmCandidateExperienceRepository,

		@InjectRepository(CandidateFeedback)
		public typeOrmCandidateFeedbackRepository: TypeOrmCandidateFeedbackRepository,

		mikroOrmCandidateFeedbackRepository: MikroOrmCandidateFeedbackRepository,

		@InjectRepository(CandidateInterview)
		public typeOrmCandidateInterviewRepository: TypeOrmCandidateInterviewRepository,

		mikroOrmCandidateInterviewRepository: MikroOrmCandidateInterviewRepository,

		@InjectRepository(CandidateInterviewers)
		public typeOrmCandidateInterviewersRepository: TypeOrmCandidateInterviewersRepository,

		mikroOrmCandidateInterviewersRepository: MikroOrmCandidateInterviewersRepository,

		@InjectRepository(CandidatePersonalQualities)
		public typeOrmCandidatePersonalQualitiesRepository: TypeOrmCandidatePersonalQualitiesRepository,

		mikroOrmCandidatePersonalQualitiesRepository: MikroOrmCandidatePersonalQualitiesRepository,

		@InjectRepository(CandidateSkill)
		public typeOrmCandidateSkillRepository: TypeOrmCandidateSkillRepository,

		mikroOrmCandidateSkillRepository: MikroOrmCandidateSkillRepository,

		@InjectRepository(CandidateSource)
		public typeOrmCandidateSourceRepository: TypeOrmCandidateSourceRepository,

		mikroOrmCandidateSourceRepository: MikroOrmCandidateSourceRepository,

		@InjectRepository(CandidateTechnologies)
		public typeOrmCandidateTechnologiesRepository: TypeOrmCandidateTechnologiesRepository,

		mikroOrmCandidateTechnologiesRepository: MikroOrmCandidateTechnologiesRepository,

		@InjectRepository(Contact)
		public typeOrmContactRepository: TypeOrmContactRepository,

		mikroOrmContactRepository: MikroOrmContactRepository,

		@InjectRepository(CustomSmtp)
		public typeOrmCustomSmtpRepository: TypeOrmCustomSmtpRepository,

		mikroOrmCustomSmtpRepository: MikroOrmCustomSmtpRepository,

		@InjectRepository(Deal)
		public typeOrmDealRepository: TypeOrmDealRepository,

		mikroOrmDealRepository: MikroOrmDealRepository,

		@InjectRepository(EmailHistory)
		public typeOrmEmailHistoryRepository: TypeOrmEmailHistoryRepository,

		mikroOrmEmailHistoryRepository: MikroOrmEmailHistoryRepository,

		@InjectRepository(EmailTemplate)
		public typeOrmEmailTemplateRepository: TypeOrmEmailTemplateRepository,

		mikroOrmEmailTemplateRepository: MikroOrmEmailTemplateRepository,

		@InjectRepository(Employee)
		public typeOrmEmployeeRepository: TypeOrmEmployeeRepository,

		mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,

		@InjectRepository(EmployeeAppointment)
		public typeOrmEmployeeAppointmentRepository: TypeOrmEmployeeAppointmentRepository,

		mikroOrmEmployeeAppointmentRepository: MikroOrmEmployeeAppointmentRepository,

		@InjectRepository(EmployeeAward)
		public typeOrmEmployeeAwardRepository: TypeOrmEmployeeAwardRepository,

		mikroOrmEmployeeAwardRepository: MikroOrmEmployeeAwardRepository,

		@InjectRepository(EmployeeRecurringExpense)
		public typeOrmEmployeeRecurringExpenseRepository: TypeOrmEmployeeRecurringExpenseRepository,

		mikroOrmEmployeeRecurringExpenseRepository: MikroOrmEmployeeRecurringExpenseRepository,

		@InjectRepository(EmployeeSetting)
		public typeOrmEmployeeSettingRepository: TypeOrmEmployeeSettingRepository,

		mikroOrmEmployeeSettingRepository: MikroOrmEmployeeSettingRepository,

		@InjectRepository(Equipment)
		public typeOrmEquipmentRepository: TypeOrmEquipmentRepository,

		mikroOrmEquipmentRepository: MikroOrmEquipmentRepository,

		@InjectRepository(EquipmentSharing)
		public typeOrmEquipmentSharingRepository: TypeOrmEquipmentSharingRepository,

		mikroOrmEquipmentSharingRepository: MikroOrmEquipmentSharingRepository,

		@InjectRepository(EquipmentSharingPolicy)
		public typeOrmEquipmentSharingPolicyRepository: TypeOrmEquipmentSharingPolicyRepository,

		mikroOrmEquipmentSharingPolicyRepository: MikroOrmEquipmentSharingPolicyRepository,

		@InjectRepository(EstimateEmail)
		public typeOrmEstimateEmailRepository: TypeOrmEstimateEmailRepository,

		mikroOrmEstimateEmailRepository: MikroOrmEstimateEmailRepository,

		@InjectRepository(EventType)
		public typeOrmEventTypeRepository: TypeOrmEventTypeRepository,

		mikroOrmEventTypeRepository: MikroOrmEventTypeRepository,

		@InjectRepository(Expense)
		public typeOrmExpenseRepository: TypeOrmExpenseRepository,

		mikroOrmExpenseRepository: MikroOrmExpenseRepository,

		@InjectRepository(ExpenseCategory)
		public typeOrmExpenseCategoryRepository: TypeOrmExpenseCategoryRepository,

		mikroOrmExpenseCategoryRepository: MikroOrmExpenseCategoryRepository,

		@InjectRepository(Feature)
		public typeOrmFeatureRepository: TypeOrmFeatureRepository,

		mikroOrmFeatureRepository: MikroOrmFeatureRepository,

		@InjectRepository(FeatureOrganization)
		public typeOrmFeatureOrganizationRepository: TypeOrmFeatureOrganizationRepository,

		mikroOrmFeatureOrganizationRepository: MikroOrmFeatureOrganizationRepository,

		@InjectRepository(Goal)
		public typeOrmGoalRepository: TypeOrmGoalRepository,

		mikroOrmGoalRepository: MikroOrmGoalRepository,

		@InjectRepository(GoalTemplate)
		public typeOrmGoalTemplateRepository: TypeOrmGoalTemplateRepository,

		mikroOrmGoalTemplateRepository: MikroOrmGoalTemplateRepository,

		@InjectRepository(GoalKPI)
		public typeOrmGoalKPIRepository: TypeOrmGoalKPIRepository,

		mikroOrmGoalKPIRepository: MikroOrmGoalKPIRepository,

		@InjectRepository(GoalKPITemplate)
		public typeOrmGoalKPITemplateRepository: TypeOrmGoalKPITemplateRepository,

		mikroOrmGoalKPITemplateRepository: MikroOrmGoalKPITemplateRepository,

		@InjectRepository(GoalTimeFrame)
		public typeOrmGoalTimeFrameRepository: TypeOrmGoalTimeFrameRepository,

		mikroOrmGoalTimeFrameRepository: MikroOrmGoalTimeFrameRepository,

		@InjectRepository(GoalGeneralSetting)
		public typeOrmGoalGeneralSettingRepository: TypeOrmGoalGeneralSettingRepository,

		mikroOrmGoalGeneralSettingRepository: MikroOrmGoalGeneralSettingRepository,

		@InjectRepository(Income)
		public typeOrmIncomeRepository: TypeOrmIncomeRepository,

		mikroOrmIncomeRepository: MikroOrmIncomeRepository,

		@InjectRepository(Integration)
		public typeOrmIntegrationRepository: TypeOrmIntegrationRepository,

		mikroOrmIntegrationRepository: MikroOrmIntegrationRepository,

		@InjectRepository(IntegrationType)
		public typeOrmIntegrationTypeRepository: TypeOrmIntegrationTypeRepository,

		mikroOrmIntegrationTypeRepository: MikroOrmIntegrationTypeRepository,

		@InjectRepository(IntegrationEntitySetting)
		public typeOrmIntegrationEntitySettingRepository: TypeOrmIntegrationEntitySettingRepository,

		mikroOrmIntegrationEntitySettingRepository: MikroOrmIntegrationEntitySettingRepository,

		@InjectRepository(IntegrationEntitySettingTied)
		public typeOrmIntegrationEntitySettingTiedRepository: TypeOrmIntegrationEntitySettingTiedRepository,

		mikroOrmIntegrationEntitySettingTiedRepository: MikroOrmIntegrationEntitySettingTiedRepository,

		@InjectRepository(IntegrationMap)
		public typeOrmIntegrationMapRepository: TypeOrmIntegrationMapRepository,

		mikroOrmIntegrationMapRepository: MikroOrmIntegrationMapRepository,

		@InjectRepository(IntegrationSetting)
		public typeOrmIntegrationSettingRepository: TypeOrmIntegrationSettingRepository,

		mikroOrmIntegrationSettingRepository: MikroOrmIntegrationSettingRepository,

		@InjectRepository(IntegrationTenant)
		public typeOrmIntegrationTenantRepository: TypeOrmIntegrationTenantRepository,

		mikroOrmIntegrationTenantRepository: MikroOrmIntegrationTenantRepository,

		@InjectRepository(Invite)
		public typeOrmInviteRepository: TypeOrmInviteRepository,

		mikroOrmInviteRepository: MikroOrmInviteRepository,

		@InjectRepository(Invoice)
		public typeOrmInvoiceRepository: TypeOrmInvoiceRepository,

		mikroOrmInvoiceRepository: MikroOrmInvoiceRepository,

		@InjectRepository(InvoiceEstimateHistory)
		public typeOrmInvoiceEstimateHistoryRepository: TypeOrmInvoiceEstimateHistoryRepository,

		mikroOrmInvoiceEstimateHistoryRepository: MikroOrmInvoiceEstimateHistoryRepository,

		@InjectRepository(InvoiceItem)
		public typeOrmInvoiceItemRepository: TypeOrmInvoiceItemRepository,

		mikroOrmInvoiceItemRepository: MikroOrmInvoiceItemRepository,

		@InjectRepository(KeyResult)
		public typeOrmKeyResultRepository: TypeOrmKeyResultRepository,

		mikroOrmKeyResultRepository: MikroOrmKeyResultRepository,

		@InjectRepository(KeyResultTemplate)
		public typeOrmKeyResultTemplateRepository: TypeOrmKeyResultTemplateRepository,

		mikroOrmKeyResultTemplateRepository: MikroOrmKeyResultTemplateRepository,

		@InjectRepository(KeyResultUpdate)
		public typeOrmKeyResultUpdateRepository: TypeOrmKeyResultUpdateRepository,

		mikroOrmKeyResultUpdateRepository: MikroOrmKeyResultUpdateRepository,

		@InjectRepository(Language)
		public typeOrmLanguageRepository: TypeOrmLanguageRepository,

		mikroOrmLanguageRepository: MikroOrmLanguageRepository,

		@InjectRepository(Organization)
		public typeOrmOrganizationRepository: TypeOrmOrganizationRepository,

		mikroOrmOrganizationRepository: MikroOrmOrganizationRepository,

		@InjectRepository(EmployeeLevel)
		public typeOrmEmployeeLevelRepository: TypeOrmEmployeeLevelRepository,

		mikroOrmEmployeeLevelRepository: MikroOrmEmployeeLevelRepository,

		@InjectRepository(OrganizationAward)
		public typeOrmOrganizationAwardRepository: TypeOrmOrganizationAwardRepository,

		mikroOrmOrganizationAwardRepository: MikroOrmOrganizationAwardRepository,

		@InjectRepository(OrganizationContact)
		public typeOrmOrganizationContactRepository: TypeOrmOrganizationContactRepository,

		mikroOrmOrganizationContactRepository: MikroOrmOrganizationContactRepository,

		@InjectRepository(OrganizationDepartment)
		public typeOrmOrganizationDepartmentRepository: TypeOrmOrganizationDepartmentRepository,

		mikroOrmOrganizationDepartmentRepository: MikroOrmOrganizationDepartmentRepository,

		@InjectRepository(OrganizationDocument)
		public typeOrmOrganizationDocumentRepository: TypeOrmOrganizationDocumentRepository,

		mikroOrmOrganizationDocumentRepository: MikroOrmOrganizationDocumentRepository,

		@InjectRepository(OrganizationEmploymentType)
		public typeOrmOrganizationEmploymentTypeRepository: TypeOrmOrganizationEmploymentTypeRepository,

		mikroOrmOrganizationEmploymentTypeRepository: MikroOrmOrganizationEmploymentTypeRepository,

		@InjectRepository(OrganizationLanguage)
		public typeOrmOrganizationLanguageRepository: TypeOrmOrganizationLanguageRepository,

		mikroOrmOrganizationLanguageRepository: MikroOrmOrganizationLanguageRepository,

		@InjectRepository(OrganizationPosition)
		public typeOrmOrganizationPositionRepository: TypeOrmOrganizationPositionRepository,

		mikroOrmOrganizationPositionRepository: MikroOrmOrganizationPositionRepository,

		@InjectRepository(OrganizationProject)
		public typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,

		mikroOrmOrganizationProjectRepository: MikroOrmOrganizationProjectRepository,

		@InjectRepository(OrganizationRecurringExpense)
		public typeOrmOrganizationRecurringExpenseRepository: TypeOrmOrganizationRecurringExpenseRepository,

		mikroOrmOrganizationRecurringExpenseRepository: MikroOrmOrganizationRecurringExpenseRepository,

		@InjectRepository(OrganizationSprint)
		public typeOrmOrganizationSprintRepository: TypeOrmOrganizationSprintRepository,

		mikroOrmOrganizationSprintRepository: MikroOrmOrganizationSprintRepository,

		@InjectRepository(OrganizationTeam)
		public typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,

		mikroOrmOrganizationTeamRepository: MikroOrmOrganizationTeamRepository,

		@InjectRepository(OrganizationTeamEmployee)
		public typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,

		mikroOrmOrganizationTeamEmployeeRepository: MikroOrmOrganizationTeamEmployeeRepository,

		@InjectRepository(OrganizationVendor)
		public typeOrmOrganizationVendorRepository: TypeOrmOrganizationVendorRepository,

		mikroOrmOrganizationVendorRepository: MikroOrmOrganizationVendorRepository,

		@InjectRepository(Payment)
		public typeOrmPaymentRepository: TypeOrmPaymentRepository,

		mikroOrmPaymentRepository: MikroOrmPaymentRepository,

		@InjectRepository(Pipeline)
		public typeOrmPipelineRepository: TypeOrmPipelineRepository,

		mikroOrmPipelineRepository: MikroOrmPipelineRepository,

		@InjectRepository(PipelineStage)
		public typeOrmPipelineStageRepository: TypeOrmPipelineStageRepository,

		mikroOrmPipelineStageRepository: MikroOrmPipelineStageRepository,

		@InjectRepository(Product)
		public typeOrmProductRepository: TypeOrmProductRepository,

		mikroOrmProductRepository: MikroOrmProductRepository,

		@InjectRepository(ProductTranslation)
		public typeOrmProductTranslationRepository: TypeOrmProductTranslationRepository,

		mikroOrmProductTranslationRepository: MikroOrmProductTranslationRepository,

		@InjectRepository(ProductCategory)
		public typeOrmProductCategoryRepository: TypeOrmProductCategoryRepository,

		mikroOrmProductCategoryRepository: MikroOrmProductCategoryRepository,

		@InjectRepository(ProductCategoryTranslation)
		public typeOrmProductCategoryTranslationRepository: TypeOrmProductCategoryTranslationRepository,

		mikroOrmProductCategoryTranslationRepository: MikroOrmProductCategoryTranslationRepository,

		@InjectRepository(ProductOption)
		public typeOrmProductOptionRepository: TypeOrmProductOptionRepository,

		mikroOrmProductOptionRepository: MikroOrmProductOptionRepository,

		@InjectRepository(ProductOptionTranslation)
		public typeOrmProductOptionTranslationRepository: TypeOrmProductOptionTranslationRepository,

		mikroOrmProductOptionTranslationRepository: MikroOrmProductOptionTranslationRepository,

		@InjectRepository(ProductOptionGroup)
		public typeOrmProductOptionGroupRepository: TypeOrmProductOptionGroupRepository,

		mikroOrmProductOptionGroupRepository: MikroOrmProductOptionGroupRepository,

		@InjectRepository(ProductOptionGroupTranslation)
		public typeOrmProductOptionGroupTranslationRepository: TypeOrmProductOptionGroupTranslationRepository,

		mikroOrmProductOptionGroupTranslationRepository: MikroOrmProductOptionGroupTranslationRepository,

		@InjectRepository(ProductVariantSetting)
		public typeOrmProductVariantSettingRepository: TypeOrmProductVariantSettingRepository,

		mikroOrmProductVariantSettingRepository: MikroOrmProductVariantSettingRepository,

		@InjectRepository(ProductType)
		public typeOrmProductTypeRepository: TypeOrmProductTypeRepository,

		mikroOrmProductTypeRepository: MikroOrmProductTypeRepository,

		@InjectRepository(ProductTypeTranslation)
		public typeOrmProductTypeTranslationRepository: TypeOrmProductTypeTranslationRepository,

		mikroOrmProductTypeTranslationRepository: MikroOrmProductTypeTranslationRepository,

		@InjectRepository(ProductVariant)
		public typeOrmProductVariantRepository: TypeOrmProductVariantRepository,

		mikroOrmProductVariantRepository: MikroOrmProductVariantRepository,

		@InjectRepository(ProductVariantPrice)
		public typeOrmProductVariantPriceRepository: TypeOrmProductVariantPriceRepository,

		mikroOrmProductVariantPriceRepository: MikroOrmProductVariantPriceRepository,

		@InjectRepository(ImageAsset)
		public typeOrmImageAssetRepository: TypeOrmImageAssetRepository,

		mikroOrmImageAssetRepository: MikroOrmImageAssetRepository,

		@InjectRepository(Warehouse)
		public typeOrmWarehouseRepository: TypeOrmWarehouseRepository,

		mikroOrmWarehouseRepository: MikroOrmWarehouseRepository,

		@InjectRepository(Merchant)
		public typeOrmMerchantRepository: TypeOrmMerchantRepository,

		mikroOrmMerchantRepository: MikroOrmMerchantRepository,

		@InjectRepository(WarehouseProduct)
		public typeOrmWarehouseProductRepository: TypeOrmWarehouseProductRepository,

		mikroOrmWarehouseProductRepository: MikroOrmWarehouseProductRepository,

		@InjectRepository(WarehouseProductVariant)
		public typeOrmWarehouseProductVariantRepository: TypeOrmWarehouseProductVariantRepository,

		mikroOrmWarehouseProductVariantRepository: MikroOrmWarehouseProductVariantRepository,

		@InjectRepository(Skill)
		public typeOrmSkillRepository: TypeOrmSkillRepository,

		mikroOrmSkillRepository: MikroOrmSkillRepository,

		@InjectRepository(Screenshot)
		public typeOrmScreenshotRepository: TypeOrmScreenshotRepository,

		mikroOrmScreenshotRepository: MikroOrmScreenshotRepository,

		@InjectRepository(RequestApproval)
		public typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository,

		mikroOrmRequestApprovalRepository: MikroOrmRequestApprovalRepository,

		@InjectRepository(RequestApprovalEmployee)
		public typeOrmRequestApprovalEmployeeRepository: TypeOrmRequestApprovalEmployeeRepository,

		mikroOrmRequestApprovalEmployeeRepository: MikroOrmRequestApprovalEmployeeRepository,

		@InjectRepository(RequestApprovalTeam)
		public typeOrmRequestApprovalTeamRepository: TypeOrmRequestApprovalTeamRepository,

		mikroOrmRequestApprovalTeamRepository: MikroOrmRequestApprovalTeamRepository,

		@InjectRepository(Role)
		public typeOrmRoleRepository: TypeOrmRoleRepository,

		mikroOrmRoleRepository: MikroOrmRoleRepository,

		@InjectRepository(RolePermission)
		public typeOrmRolePermissionRepository: TypeOrmRolePermissionRepository,

		mikroOrmRolePermissionRepository: MikroOrmRolePermissionRepository,

		@InjectRepository(Report)
		public typeOrmReportRepository: TypeOrmReportRepository,

		mikroOrmReportRepository: MikroOrmReportRepository,

		@InjectRepository(ReportCategory)
		public typeOrmReportCategoryRepository: TypeOrmReportCategoryRepository,

		mikroOrmReportCategoryRepository: MikroOrmReportCategoryRepository,

		@InjectRepository(ReportOrganization)
		public typeOrmReportOrganizationRepository: TypeOrmReportOrganizationRepository,

		mikroOrmReportOrganizationRepository: MikroOrmReportOrganizationRepository,

		@InjectRepository(Tag)
		public typeOrmTagRepository: TypeOrmTagRepository,

		mikroOrmTagRepository: MikroOrmTagRepository,

		@InjectRepository(Task)
		public typeOrmTaskRepository: TypeOrmTaskRepository,

		mikroOrmTaskRepository: MikroOrmTaskRepository,

		@InjectRepository(TenantSetting)
		public typeOrmTenantSettingRepository: TypeOrmTenantSettingRepository,

		mikroOrmTenantSettingRepository: MikroOrmTenantSettingRepository,

		@InjectRepository(Timesheet)
		public typeOrmTimesheetRepository: TypeOrmTimesheetRepository,

		mikroOrmTimesheetRepository: MikroOrmTimesheetRepository,

		@InjectRepository(TimeLog)
		public typeOrmTimeLogRepository: TypeOrmTimeLogRepository,

		mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,

		@InjectRepository(TimeSlot)
		public typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,

		mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,

		@InjectRepository(TimeSlotMinute)
		public typeOrmTimeSlotMinuteRepository: TypeOrmTimeSlotMinuteRepository,

		mikroOrmTimeSlotMinuteRepository: MikroOrmTimeSlotMinuteRepository,

		@InjectRepository(TimeOffRequest)
		public typeOrmTimeOffRequestRepository: TypeOrmTimeOffRequestRepository,

		mikroOrmTimeOffRequestRepository: MikroOrmTimeOffRequestRepository,

		@InjectRepository(TimeOffPolicy)
		public typeOrmTimeOffPolicyRepository: TypeOrmTimeOffPolicyRepository,

		mikroOrmTimeOffPolicyRepository: MikroOrmTimeOffPolicyRepository,

		@InjectRepository(User)
		public typeOrmUserRepository: TypeOrmUserRepository,

		mikroOrmUserRepository: MikroOrmUserRepository,

		@InjectRepository(UserOrganization)
		public typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,

		mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,

		@InjectRepository(TagType)
		public typeOrmTagTypeRepository: TypeOrmTagTypeRepository,

		@InjectRepository(Tenant)
		public typeOrmTenantRepository: TypeOrmTenantRepository,

		@InjectRepository(ActivityLog)
		public typeOrmActivityLogRepository: TypeOrmActivityLogRepository,

		@InjectRepository(EmployeeAvailability)
		public typeOrmEmployeeAvailabilityRepository: TypeOrmEmployeeAvailabilityRepository,

		@InjectRepository(Comment)
		public typeOrmCommentRepository: TypeOrmCommentRepository,

		@InjectRepository(DailyPlan)
		public typeOrmDailyPlanRepository: TypeOrmDailyPlanRepository,

		@InjectRepository(EmailReset)
		public typeOrmEmailResetRepository: TypeOrmEmailResetRepository,

		@InjectRepository(EmployeeNotification)
		public typeOrmEmployeeNotificationRepository: TypeOrmEmployeeNotificationRepository,

		@InjectRepository(EmployeeNotificationSetting)
		public typeOrmEmployeeNotificationSettingRepository: TypeOrmEmployeeNotificationSettingRepository,

		@InjectRepository(EmployeePhone)
		public typeOrmEmployeePhoneRepository: TypeOrmEmployeePhoneRepository,

		@InjectRepository(EntitySubscription)
		public typeOrmEntitySubscriptionRepository: TypeOrmEntitySubscriptionRepository,

		@InjectRepository(Favorite)
		public typeOrmFavoriteRepository: TypeOrmFavoriteRepository,

		@InjectRepository(ImportHistory)
		public typeOrmImportHistoryRepository: TypeOrmImportHistoryRepository,

		@InjectRepository(ImportRecord)
		public typeOrmImportRecordRepository: TypeOrmImportRecordRepository,

		@InjectRepository(IssueType)
		public typeOrmIssueTypeRepository: TypeOrmIssueTypeRepository,

		@InjectRepository(Mention)
		public typeOrmMentionRepository: TypeOrmMentionRepository,

		@InjectRepository(OrganizationProjectEmployee)
		public typeOrmOrganizationProjectEmployeeRepository: TypeOrmOrganizationProjectEmployeeRepository,

		@InjectRepository(OrganizationProjectModule)
		public typeOrmOrganizationProjectModuleRepository: TypeOrmOrganizationProjectModuleRepository,

		@InjectRepository(OrganizationProjectModuleEmployee)
		public typeOrmOrganizationProjectModuleEmployeeRepository: TypeOrmOrganizationProjectModuleEmployeeRepository,

		@InjectRepository(OrganizationSprintEmployee)
		public typeOrmOrganizationSprintEmployeeRepository: TypeOrmOrganizationSprintEmployeeRepository,

		@InjectRepository(OrganizationSprintTask)
		public typeOrmOrganizationSprintTaskRepository: TypeOrmOrganizationSprintTaskRepository,

		@InjectRepository(OrganizationSprintTaskHistory)
		public typeOrmOrganizationSprintTaskHistoryRepository: TypeOrmOrganizationSprintTaskHistoryRepository,

		@InjectRepository(OrganizationTaskSetting)
		public typeOrmOrganizationTaskSettingRepository: TypeOrmOrganizationTaskSettingRepository,

		@InjectRepository(OrganizationTeamJoinRequest)
		public typeOrmOrganizationTeamJoinRequestRepository: TypeOrmOrganizationTeamJoinRequestRepository,

		@InjectRepository(Reaction)
		public typeOrmReactionRepository: TypeOrmReactionRepository,

		@InjectRepository(ResourceLink)
		public typeOrmResourceLinkRepository: TypeOrmResourceLinkRepository,

		@InjectRepository(ScreeningTask)
		public typeOrmScreeningTaskRepository: TypeOrmScreeningTaskRepository,

		@InjectRepository(SocialAccount)
		public typeOrmSocialAccountRepository: TypeOrmSocialAccountRepository,

		@InjectRepository(TaskEstimation)
		public typeOrmTaskEstimationRepository: TypeOrmTaskEstimationRepository,

		@InjectRepository(TaskLinkedIssue)
		public typeOrmTaskLinkedIssueRepository: TypeOrmTaskLinkedIssueRepository,

		@InjectRepository(TaskPriority)
		public typeOrmTaskPriorityRepository: TypeOrmTaskPriorityRepository,

		@InjectRepository(TaskRelatedIssueType)
		public typeOrmTaskRelatedIssueTypeRepository: TypeOrmTaskRelatedIssueTypeRepository,

		@InjectRepository(TaskSize)
		public typeOrmTaskSizeRepository: TypeOrmTaskSizeRepository,

		@InjectRepository(TaskStatus)
		public typeOrmTaskStatusRepository: TypeOrmTaskStatusRepository,

		@InjectRepository(TaskVersion)
		public typeOrmTaskVersionRepository: TypeOrmTaskVersionRepository,

		@InjectRepository(TaskView)
		public typeOrmTaskViewRepository: TypeOrmTaskViewRepository,

		@InjectRepository(Country)
		public typeOrmCountryRepository: TypeOrmCountryRepository,

		@InjectRepository(Currency)
		public typeOrmCurrencyRepository: TypeOrmCurrencyRepository,

		@InjectRepository(Dashboard)
		public typeOrmDashboardRepository: TypeOrmDashboardRepository,

		@InjectRepository(DashboardWidget)
		public typeOrmDashboardWidgetRepository: TypeOrmDashboardWidgetRepository,

		private readonly configService: ConfigService,
		private readonly _connectionEntityManager: ConnectionEntityManager
	) {}

	dynamicEntitiesClassMap: IRepositoryModel<any>[] = [];
	repositories: IRepositoryModel<any>[] = [];

	public baseEntityRelationFields = [
		{ column: 'createdByUserId', repository: this.typeOrmUserRepository },
		{ column: 'updatedByUserId', repository: this.typeOrmUserRepository },
		{ column: 'deletedByUserId', repository: this.typeOrmUserRepository }
	];

	async onModuleInit() {
		await this.createDynamicInstanceForPluginEntities();
		await this.registerCoreRepositories();
	}

	/**
	 * A helper function to get the repository relations graph
	 * @param repository the repository to work on
	 */
	private async getRepositoryRelationsGraph(repository: Repository<any>): Promise<IRepositoryModel> {
		const entityMetadata = repository.metadata;

		// Get unique identifiers (assuming they are part of unique constraints)
		const uniqueIdentifiers =
			entityMetadata.uniques.map((unique) => {
				return {
					column: unique.columns
						.map((col) => col.propertyName)
						.filter((propertyName) => {
							return !repository.metadata.relations.some(
								(relation) => relation.propertyName === propertyName
							);
						})[0]
				};
			}) || [];

		// Get foreign keys and relations
		const foreignKeys =
			entityMetadata.relations
				.filter((relation) => relation.propertyName && (relation.isManyToOne || relation.isOneToOne))
				.filter(
					(relation) =>
						![
							...this.baseEntityRelationFields.map((el) => el.column),
							'organizationId',
							'tenantId'
						].includes(relation.joinColumns[0]?.databaseName || `${relation.propertyName}Id`)
				)
				.map((relation) => {
					return {
						column: relation.joinColumns[0]?.databaseName || `${relation.propertyName}Id`,
						repository: this._connectionEntityManager.getRepository(relation.type)
					};
				}) || [];

		const relations =
			entityMetadata.relations
				.filter((relation) => relation.isManyToMany && relation.joinTableName)
				.map((relation) => {
					const foreignKeys =
						relation.foreignKeys.map((fk) => ({
							column: fk.columns[0]?.propertyName,
							repository: this._connectionEntityManager.getRepository(fk.referencedEntityMetadata.target)
						})) || [];
					return {
						joinTableName: relation.joinTableName,
						foreignKeys,
						isCheckRelation: foreignKeys.length > 0
					};
				}) || [];

		const isTenantBased = entityMetadata.foreignKeys.flatMap((el) => el.columnNames)?.includes('tenantId');

		return {
			repository,
			isCheckRelation: foreignKeys.length > 0,
			uniqueIdentifiers,
			foreignKeys,
			relations,
			isTenantBased
		};
	}

	/**
	 *
	 * A helper function that builds dynamically a dependencies / relations
	 * graph for each repository registered
	 *
	 */
	async buildRepositoriesRelationsGraph() {
		const result: IRepositoryModel[] = [];
		for await (const item of this.repositories) {
			const { repository, isStatic, substitute } = item;

			const repositoryRelationsGraph = await this.getRepositoryRelationsGraph(repository);

			result.push({
				...repositoryRelationsGraph,
				isStatic,
				substitute
			});
		}

		return result;
	}

	async createDynamicInstanceForPluginEntities() {
		for await (const entity of getEntitiesFromPlugins(this.configService.plugins)) {
			if (!isFunction(entity)) {
				continue;
			}

			const className = camelCase(entity.name);
			const repository = this._connectionEntityManager.getRepository(entity);

			const repositoryRelationsGraph = await this.getRepositoryRelationsGraph(repository);

			this[className] = repository;
			this.dynamicEntitiesClassMap.push(repositoryRelationsGraph);
		}
	}

	/*
	 * Core repositories
	 * Warning: Changing position here can be FATAL
	 */
	private async registerCoreRepositories() {
		this.repositories = [
			{
				repository: this.typeOrmTenantRepository,
				substitute: { substituteField: 'id', originalField: 'tenantId' }
			},
			/**
			 * These entities do not have any other dependency so need to be mapped first
			 */
			{
				repository: this.typeOrmReportCategoryRepository,
				isStatic: true
			},
			{
				repository: this.typeOrmReportRepository,
				isStatic: true
			},
			{
				repository: this.typeOrmFeatureRepository,
				isStatic: true
			},
			{
				repository: this.typeOrmLanguageRepository,
				isStatic: true
			},
			{
				repository: this.typeOrmCountryRepository,
				isStatic: true
			},
			{
				repository: this.typeOrmCurrencyRepository,
				isStatic: true
			},
			{
				repository: this.typeOrmIntegrationRepository,
				isStatic: true
			},
			{
				repository: this.typeOrmIntegrationTypeRepository,
				isStatic: true
			},
			/**
			 * These entities need TENANT
			 */
			{
				repository: this.typeOrmTenantSettingRepository
			},
			{
				repository: this.typeOrmRoleRepository
			},
			{
				repository: this.typeOrmRolePermissionRepository
			},
			{
				repository: this.typeOrmOrganizationRepository
			},
			/**
			 * These entities need TENANT and ORGANIZATION
			 */
			{
				repository: this.typeOrmUserRepository,
				isStatic: true
			},
			{
				repository: this.typeOrmUserOrganizationRepository
			},
			//Organization & Related Entities
			{
				repository: this.typeOrmOrganizationPositionRepository
			},
			{
				repository: this.typeOrmOrganizationTeamRepository
			},
			{
				repository: this.typeOrmOrganizationAwardRepository
			},
			{
				repository: this.typeOrmOrganizationVendorRepository
			},
			{
				repository: this.typeOrmOrganizationDepartmentRepository
			},
			{
				repository: this.typeOrmOrganizationDocumentRepository
			},
			{
				repository: this.typeOrmOrganizationLanguageRepository
			},
			{
				repository: this.typeOrmOrganizationEmploymentTypeRepository
			},
			{
				repository: this.typeOrmContactRepository
			},
			{
				repository: this.typeOrmOrganizationContactRepository
			},
			{
				repository: this.typeOrmOrganizationProjectRepository
			},
			{
				repository: this.typeOrmOrganizationSprintRepository
			},
			{
				repository: this.typeOrmOrganizationRecurringExpenseRepository
			},
			{
				repository: this.typeOrmCustomSmtpRepository
			},
			{
				repository: this.typeOrmReportOrganizationRepository
			},
			/**
			 * These entities need TENANT, ORGANIZATION & USER
			 */
			{
				repository: this.typeOrmEmployeeRepository
			},
			{
				repository: this.typeOrmActivityLogRepository
			},
			{
				repository: this.typeOrmDashboardRepository
			},
			{
				repository: this.typeOrmDashboardWidgetRepository
			},
			{
				repository: this.typeOrmEmailResetRepository
			},
			{
				repository: this.typeOrmTagTypeRepository
			},
			/**
			 * These entities need TENANT, ORGANIZATION & CANDIDATE
			 */
			{
				repository: this.typeOrmCandidateRepository
			},
			{
				repository: this.typeOrmCandidateDocumentRepository
			},
			{
				repository: this.typeOrmCandidateEducationRepository
			},
			{
				repository: this.typeOrmCandidateSkillRepository
			},
			{
				repository: this.typeOrmCandidateSourceRepository
			},
			{
				repository: this.typeOrmCandidateInterviewRepository
			},
			{
				repository: this.typeOrmCandidateInterviewersRepository
			},
			{
				repository: this.typeOrmCandidateExperienceRepository
			},
			{
				repository: this.typeOrmCandidateFeedbackRepository
			},
			{
				repository: this.typeOrmCandidatePersonalQualitiesRepository
			},
			{
				repository: this.typeOrmCandidateTechnologiesRepository
			},
			{
				repository: this.typeOrmCandidateCriterionsRatingRepository
			},
			/**
			 * These entities need TENANT and ORGANIZATION
			 */
			{
				repository: this.typeOrmSkillRepository
			},
			{
				repository: this.typeOrmAccountingTemplateRepository
			},
			{
				repository: this.typeOrmApprovalPolicyRepository
			},
			{
				repository: this.typeOrmAvailabilitySlotRepository
			},
			{
				repository: this.typeOrmEmployeeAppointmentRepository
			},
			{
				repository: this.typeOrmAppointmentEmployeeRepository
			},
			/*
			 * Email & Template
			 */
			{
				repository: this.typeOrmEmailTemplateRepository
			},
			{
				repository: this.typeOrmEmailHistoryRepository
			},
			{
				repository: this.typeOrmEstimateEmailRepository
			},
			/*
			 * Employee & Related Entities
			 */
			{
				repository: this.typeOrmEmployeeAwardRepository
			},
			{
				repository: this.typeOrmEmployeeRecurringExpenseRepository
			},
			{
				repository: this.typeOrmEmployeeSettingRepository
			},
			{
				repository: this.typeOrmEmployeeLevelRepository
			},
			/*
			 * Equipment & Related Entities
			 */
			{
				repository: this.typeOrmEquipmentSharingPolicyRepository
			},
			{
				repository: this.typeOrmEquipmentRepository
			},
			{
				repository: this.typeOrmEquipmentSharingRepository
			},
			/*
			 * Event Type & Related Entities
			 */
			{
				repository: this.typeOrmEventTypeRepository
			},
			/*
			 * Invoice & Related Entities
			 */
			{
				repository: this.typeOrmInvoiceRepository
			},
			{
				repository: this.typeOrmInvoiceItemRepository
			},
			{
				repository: this.typeOrmInvoiceEstimateHistoryRepository
			},
			/*
			 * Expense & Related Entities
			 */
			{
				repository: this.typeOrmExpenseCategoryRepository
			},
			{
				repository: this.typeOrmExpenseRepository
			},
			/*
			 * Income
			 */
			{
				repository: this.typeOrmIncomeRepository
			},
			/*
			 * Feature & Related Entities
			 */
			{
				repository: this.typeOrmFeatureOrganizationRepository
			},
			{
				repository: this.typeOrmGoalRepository
			},
			{
				repository: this.typeOrmGoalKPIRepository
			},
			/*
			 * Key Result & Related Entities
			 */
			{
				repository: this.typeOrmKeyResultRepository
			},
			{
				repository: this.typeOrmKeyResultTemplateRepository
			},
			{
				repository: this.typeOrmKeyResultUpdateRepository
			},
			/*
			 * Goal KPI & Related Entities
			 */
			{
				repository: this.typeOrmGoalKPITemplateRepository
			},
			{
				repository: this.typeOrmGoalTemplateRepository
			},
			{
				repository: this.typeOrmGoalTimeFrameRepository
			},
			{
				repository: this.typeOrmGoalGeneralSettingRepository
			},
			/*
			 * Integration & Related Entities
			 */
			{
				repository: this.typeOrmIntegrationTenantRepository
			},
			{
				repository: this.typeOrmIntegrationSettingRepository
			},
			{
				repository: this.typeOrmIntegrationMapRepository
			},
			{
				repository: this.typeOrmIntegrationEntitySettingRepository
			},
			{
				repository: this.typeOrmIntegrationEntitySettingTiedRepository
			},
			/*
			 * Invite & Related Entities
			 */
			{
				repository: this.typeOrmInviteRepository
			},
			{
				repository: this.typeOrmOrganizationTeamEmployeeRepository
			},
			/*
			 * Pipeline & Stage Entities
			 */
			{
				repository: this.typeOrmPipelineRepository
			},
			{
				repository: this.typeOrmPipelineStageRepository
			},
			{
				repository: this.typeOrmDealRepository
			},
			/*
			 * Product & Related Entities
			 */
			{
				repository: this.typeOrmImageAssetRepository
			},
			{
				repository: this.typeOrmProductCategoryRepository
			},
			{
				repository: this.typeOrmProductCategoryTranslationRepository
			},
			{
				repository: this.typeOrmProductTypeRepository
			},
			{
				repository: this.typeOrmProductTypeTranslationRepository
			},
			{
				repository: this.typeOrmProductOptionGroupRepository
			},
			{
				repository: this.typeOrmProductOptionRepository
			},
			{
				repository: this.typeOrmProductOptionTranslationRepository
			},
			{
				repository: this.typeOrmProductOptionGroupTranslationRepository
			},
			{
				repository: this.typeOrmProductRepository
			},
			{
				repository: this.typeOrmProductTranslationRepository
			},
			{
				repository: this.typeOrmProductVariantPriceRepository
			},
			{
				repository: this.typeOrmProductVariantSettingRepository
			},
			{
				repository: this.typeOrmProductVariantRepository
			},
			{
				repository: this.typeOrmWarehouseRepository
			},
			{
				repository: this.typeOrmMerchantRepository
			},
			{
				repository: this.typeOrmWarehouseProductRepository
			},
			{
				repository: this.typeOrmWarehouseProductVariantRepository
			},
			/*
			 * Payment & Related Entities
			 */
			{
				repository: this.typeOrmPaymentRepository
			},
			/*
			 * Request Approval & Related Entities
			 */
			{
				repository: this.typeOrmRequestApprovalRepository
			},
			{
				repository: this.typeOrmRequestApprovalEmployeeRepository
			},
			{
				repository: this.typeOrmRequestApprovalTeamRepository
			},
			/*
			 * Tasks & Related Entities
			 */
			{
				repository: this.typeOrmTaskRepository
			},
			/*
			 * Timeoff & Related Entities
			 */
			{
				repository: this.typeOrmTimeOffPolicyRepository
			},
			{
				repository: this.typeOrmTimeOffRequestRepository
			},
			/*
			 * Timesheet & Related Entities
			 */
			{
				repository: this.typeOrmTimesheetRepository
			},
			{
				repository: this.typeOrmTimeLogRepository
			},
			{
				repository: this.typeOrmTimeSlotRepository
			},
			{
				repository: this.typeOrmTimeSlotMinuteRepository
			},
			{
				repository: this.typeOrmScreenshotRepository
			},
			{
				repository: this.typeOrmActivityRepository
			},
			/*
			 * Tag & Related Entities
			 */
			{
				repository: this.typeOrmTagRepository
			},
			{
				repository: this.typeOrmCommentRepository
			},
			{
				repository: this.typeOrmDailyPlanRepository
			},
			{
				repository: this.typeOrmEmployeeNotificationRepository
			},
			{
				repository: this.typeOrmEmployeeNotificationSettingRepository
			},
			{
				repository: this.typeOrmEmployeePhoneRepository
			},
			{
				repository: this.typeOrmEntitySubscriptionRepository
			},
			{
				repository: this.typeOrmFavoriteRepository
			},
			{
				repository: this.typeOrmIssueTypeRepository
			},
			{
				repository: this.typeOrmMentionRepository
			},
			{
				repository: this.typeOrmOrganizationProjectEmployeeRepository
			},
			{
				repository: this.typeOrmOrganizationProjectModuleRepository
			},
			{
				repository: this.typeOrmOrganizationProjectModuleEmployeeRepository
			},
			{
				repository: this.typeOrmOrganizationSprintEmployeeRepository
			},
			{
				repository: this.typeOrmOrganizationSprintTaskRepository
			},
			{
				repository: this.typeOrmOrganizationSprintTaskHistoryRepository
			},
			{
				repository: this.typeOrmOrganizationTaskSettingRepository
			},
			{
				repository: this.typeOrmOrganizationTeamJoinRequestRepository
			},
			{
				repository: this.typeOrmReactionRepository
			},
			{
				repository: this.typeOrmResourceLinkRepository
			},
			{
				repository: this.typeOrmScreeningTaskRepository
			},
			{
				repository: this.typeOrmSocialAccountRepository
			},
			{
				repository: this.typeOrmTaskEstimationRepository
			},
			{
				repository: this.typeOrmTaskLinkedIssueRepository
			},
			{
				repository: this.typeOrmTaskPriorityRepository
			},
			{
				repository: this.typeOrmTaskRelatedIssueTypeRepository
			},
			{
				repository: this.typeOrmTaskSizeRepository
			},
			{
				repository: this.typeOrmTaskStatusRepository
			},
			{
				repository: this.typeOrmTaskVersionRepository
			},
			{
				repository: this.typeOrmTaskViewRepository
			},
			...this.dynamicEntitiesClassMap
		] as IRepositoryModel<any>[];
	}
}
