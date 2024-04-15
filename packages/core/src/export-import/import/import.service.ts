import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import { IsNull, Repository } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import * as fs from 'fs';
import * as unzipper from 'unzipper';
import * as csv from 'csv-parser';
import * as rimraf from 'rimraf';
import * as _ from 'lodash';
import * as path from 'path';
import * as chalk from 'chalk';
import { ConfigService } from '@gauzy/config';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { isFunction, isNotEmpty } from '@gauzy/common';
import { ConnectionEntityManager } from '../../database/connection-entity-manager';
import { convertToDatetime } from '../../core/utils';
import { FileStorage } from '../../core/file-storage';
import {
	AccountingTemplate,
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
	CustomSmtp,
	Deal,
	EmailHistory,
	EmailTemplate,
	Employee,
	EmployeeAppointment,
	EmployeeAward,
	EmployeeLevel,
	EmployeeRecurringExpense,
	EmployeeSetting,
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
	ImageAsset,
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
	// JobPreset,
	// EmployeeUpworkJobsSearchCriterion,
	// JobPresetUpworkJobSearchCriterion,
	// JobSearchCategory,
	// JobSearchOccupation,
	KeyResult,
	KeyResultTemplate,
	KeyResultUpdate,
	Language,
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
	ProductOptionGroup,
	ProductOptionGroupTranslation,
	ProductOptionTranslation,
	ProductTranslation,
	ProductType,
	ProductTypeTranslation,
	ProductVariant,
	ProductVariantPrice,
	ProductVariantSetting,
	Proposal,
	Report,
	ReportCategory,
	ReportOrganization,
	RequestApproval,
	RequestApprovalEmployee,
	RequestApprovalTeam,
	Role,
	RolePermission,
	Screenshot,
	Skill,
	Tag,
	Task,
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
import { RequestContext } from '../../core';
import { ImportEntityFieldMapOrCreateCommand } from './commands';
import { ImportRecordFindOrFailCommand, ImportRecordUpdateOrCreateCommand } from '../import-record';
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
// import { MikroOrmJobSearchCategoryRepository } from '../../employee-job-preset/job-search-category/repository/mikro-orm-job-search-category.repository';
// import { TypeOrmJobSearchCategoryRepository } from '../../employee-job-preset/job-search-category/repository/type-orm-job-search-category.repository';
// import { MikroOrmJobSearchOccupationRepository } from '../../employee-job-preset/job-search-occupation/repository/mikro-orm-job-search-occupation.repository';
// import { TypeOrmJobSearchOccupationRepository } from '../../employee-job-preset/job-search-occupation/repository/type-orm-job-search-occupation.repository';
// import { MikroOrmEmployeeUpworkJobsSearchCriterionRepository } from '../../employee-job-preset/repository/mikro-orm-employee-upwork-jobs-search-criterion.entity.repository';
// import { MikroOrmJobPresetUpworkJobSearchCriterionRepository } from '../../employee-job-preset/repository/mikro-orm-job-preset-upwork-job-search-criterion.repository';
// import { MikroOrmJobPresetRepository } from '../../employee-job-preset/repository/mikro-orm-job-preset.repository';
// import { TypeOrmJobPresetUpworkJobSearchCriterionRepository } from '../../employee-job-preset/repository/type-orm-job-preset-upwork-job-search-criterion.repository';
// import { TypeOrmJobPresetRepository } from '../../employee-job-preset/repository/type-orm-job-preset.repository';
// import { TypeOrmEmployeeUpworkJobsSearchCriterionRepository } from '../../employee-job-preset/repository/typeorm-orm-employee-upwork-jobs-search-criterion.entity.repository';
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
import { MikroOrmProposalRepository } from '../../proposal/repository/mikro-orm-proposal.repository';
import { TypeOrmProposalRepository } from '../../proposal/repository/type-orm-proposal.repository';
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
import { MikroOrmTimeSlotMinuteRepository } from '../../time-tracking/time-slot/repository/mikro-orm-time-slot-minute.repository';
import { MikroOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/mikro-orm-time-slot.repository';
import { TypeOrmTimeSlotMinuteRepository } from '../../time-tracking/time-slot/repository/type-orm-time-slot-minute.repository';
import { TypeOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/type-orm-time-slot.repository';
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

export interface IForeignKey<T> {
	column: string;
	repository: Repository<T>
}

export interface IColumnRelationMetadata<T> {
	joinTableName: string;
	foreignKeys: IForeignKey<T>[];
	isCheckRelation: boolean;
}

export interface IRepositoryModel<T> {
	repository: Repository<T>;
	relations?: IColumnRelationMetadata<T>[];
	foreignKeys?: any;
	uniqueIdentifier?: any;

	// additional condition
	isStatic?: boolean;
	isCheckRelation?: boolean;
}

@Injectable()
export class ImportService implements OnModuleInit {

	private _dirname: string;
	private _extractPath: string;

	private dynamicEntitiesClassMap: IRepositoryModel<any>[] = [];
	private repositories: IRepositoryModel<any>[] = [];

	constructor(
		@InjectRepository(AccountingTemplate)
		private typeOrmAccountingTemplateRepository: TypeOrmAccountingTemplateRepository,

		mikroOrmAccountingTemplateRepository: MikroOrmAccountingTemplateRepository,

		@InjectRepository(Activity)
		private typeOrmActivityRepository: TypeOrmActivityRepository,

		mikroOrmActivityRepository: MikroOrmActivityRepository,

		@InjectRepository(AppointmentEmployee)
		private typeOrmAppointmentEmployeeRepository: TypeOrmAppointmentEmployeeRepository,

		mikroOrmAppointmentEmployeeRepository: MikroOrmAppointmentEmployeeRepository,

		@InjectRepository(ApprovalPolicy)
		private typeOrmApprovalPolicyRepository: TypeOrmApprovalPolicyRepository,

		mikroOrmApprovalPolicyRepository: MikroOrmApprovalPolicyRepository,

		@InjectRepository(AvailabilitySlot)
		private typeOrmAvailabilitySlotRepository: TypeOrmAvailabilitySlotRepository,

		mikroOrmAvailabilitySlotRepository: MikroOrmAvailabilitySlotRepository,

		@InjectRepository(Candidate)
		private typeOrmCandidateRepository: TypeOrmCandidateRepository,

		mikroOrmCandidateRepository: MikroOrmCandidateRepository,

		@InjectRepository(CandidateCriterionsRating)
		private typeOrmCandidateCriterionsRatingRepository: TypeOrmCandidateCriterionsRatingRepository,

		mikroOrmCandidateCriterionsRatingRepository: MikroOrmCandidateCriterionsRatingRepository,

		@InjectRepository(CandidateDocument)
		private typeOrmCandidateDocumentRepository: TypeOrmCandidateDocumentRepository,

		mikroOrmCandidateDocumentRepository: MikroOrmCandidateDocumentRepository,

		@InjectRepository(CandidateEducation)
		private typeOrmCandidateEducationRepository: TypeOrmCandidateEducationRepository,

		mikroOrmCandidateEducationRepository: MikroOrmCandidateEducationRepository,

		@InjectRepository(CandidateExperience)
		private typeOrmCandidateExperienceRepository: TypeOrmCandidateExperienceRepository,

		mikroOrmCandidateExperienceRepository: MikroOrmCandidateExperienceRepository,

		@InjectRepository(CandidateFeedback)
		private typeOrmCandidateFeedbackRepository: TypeOrmCandidateFeedbackRepository,

		mikroOrmCandidateFeedbackRepository: MikroOrmCandidateFeedbackRepository,

		@InjectRepository(CandidateInterview)
		private typeOrmCandidateInterviewRepository: TypeOrmCandidateInterviewRepository,

		mikroOrmCandidateInterviewRepository: MikroOrmCandidateInterviewRepository,

		@InjectRepository(CandidateInterviewers)
		private typeOrmCandidateInterviewersRepository: TypeOrmCandidateInterviewersRepository,

		mikroOrmCandidateInterviewersRepository: MikroOrmCandidateInterviewersRepository,

		@InjectRepository(CandidatePersonalQualities)
		private typeOrmCandidatePersonalQualitiesRepository: TypeOrmCandidatePersonalQualitiesRepository,

		mikroOrmCandidatePersonalQualitiesRepository: MikroOrmCandidatePersonalQualitiesRepository,

		@InjectRepository(CandidateSkill)
		private typeOrmCandidateSkillRepository: TypeOrmCandidateSkillRepository,

		mikroOrmCandidateSkillRepository: MikroOrmCandidateSkillRepository,

		@InjectRepository(CandidateSource)
		private typeOrmCandidateSourceRepository: TypeOrmCandidateSourceRepository,

		mikroOrmCandidateSourceRepository: MikroOrmCandidateSourceRepository,

		@InjectRepository(CandidateTechnologies)
		private typeOrmCandidateTechnologiesRepository: TypeOrmCandidateTechnologiesRepository,

		mikroOrmCandidateTechnologiesRepository: MikroOrmCandidateTechnologiesRepository,

		@InjectRepository(Contact)
		private typeOrmContactRepository: TypeOrmContactRepository,

		mikroOrmContactRepository: MikroOrmContactRepository,

		@InjectRepository(CustomSmtp)
		private typeOrmCustomSmtpRepository: TypeOrmCustomSmtpRepository,

		mikroOrmCustomSmtpRepository: MikroOrmCustomSmtpRepository,

		@InjectRepository(Deal)
		private typeOrmDealRepository: TypeOrmDealRepository,

		mikroOrmDealRepository: MikroOrmDealRepository,

		@InjectRepository(EmailHistory)
		private typeOrmEmailHistoryRepository: TypeOrmEmailHistoryRepository,

		mikroOrmEmailHistoryRepository: MikroOrmEmailHistoryRepository,

		@InjectRepository(EmailTemplate)
		private typeOrmEmailTemplateRepository: TypeOrmEmailTemplateRepository,

		mikroOrmEmailTemplateRepository: MikroOrmEmailTemplateRepository,

		@InjectRepository(Employee)
		private typeOrmEmployeeRepository: TypeOrmEmployeeRepository,

		mikroOrmEmployeeRepository: MikroOrmEmployeeRepository,

		@InjectRepository(EmployeeAppointment)
		private typeOrmEmployeeAppointmentRepository: TypeOrmEmployeeAppointmentRepository,

		mikroOrmEmployeeAppointmentRepository: MikroOrmEmployeeAppointmentRepository,

		@InjectRepository(EmployeeAward)
		private typeOrmEmployeeAwardRepository: TypeOrmEmployeeAwardRepository,

		mikroOrmEmployeeAwardRepository: MikroOrmEmployeeAwardRepository,

		@InjectRepository(EmployeeRecurringExpense)
		private typeOrmEmployeeRecurringExpenseRepository: TypeOrmEmployeeRecurringExpenseRepository,

		mikroOrmEmployeeRecurringExpenseRepository: MikroOrmEmployeeRecurringExpenseRepository,

		@InjectRepository(EmployeeSetting)
		private typeOrmEmployeeSettingRepository: TypeOrmEmployeeSettingRepository,

		mikroOrmEmployeeSettingRepository: MikroOrmEmployeeSettingRepository,

		// @InjectRepository(EmployeeUpworkJobsSearchCriterion)
		// private typeOrmEmployeeUpworkJobsSearchCriterionRepository: TypeOrmEmployeeUpworkJobsSearchCriterionRepository,

		// mikroOrmEmployeeUpworkJobsSearchCriterionRepository: MikroOrmEmployeeUpworkJobsSearchCriterionRepository,

		@InjectRepository(Equipment)
		private typeOrmEquipmentRepository: TypeOrmEquipmentRepository,

		mikroOrmEquipmentRepository: MikroOrmEquipmentRepository,

		@InjectRepository(EquipmentSharing)
		private typeOrmEquipmentSharingRepository: TypeOrmEquipmentSharingRepository,

		mikroOrmEquipmentSharingRepository: MikroOrmEquipmentSharingRepository,

		@InjectRepository(EquipmentSharingPolicy)
		private typeOrmEquipmentSharingPolicyRepository: TypeOrmEquipmentSharingPolicyRepository,

		mikroOrmEquipmentSharingPolicyRepository: MikroOrmEquipmentSharingPolicyRepository,

		@InjectRepository(EstimateEmail)
		private typeOrmEstimateEmailRepository: TypeOrmEstimateEmailRepository,

		mikroOrmEstimateEmailRepository: MikroOrmEstimateEmailRepository,

		@InjectRepository(EventType)
		private typeOrmEventTypeRepository: TypeOrmEventTypeRepository,

		mikroOrmEventTypeRepository: MikroOrmEventTypeRepository,

		@InjectRepository(Expense)
		private typeOrmExpenseRepository: TypeOrmExpenseRepository,

		mikroOrmExpenseRepository: MikroOrmExpenseRepository,

		@InjectRepository(ExpenseCategory)
		private typeOrmExpenseCategoryRepository: TypeOrmExpenseCategoryRepository,

		mikroOrmExpenseCategoryRepository: MikroOrmExpenseCategoryRepository,

		@InjectRepository(Feature)
		private typeOrmFeatureRepository: TypeOrmFeatureRepository,

		mikroOrmFeatureRepository: MikroOrmFeatureRepository,

		@InjectRepository(FeatureOrganization)
		private typeOrmFeatureOrganizationRepository: TypeOrmFeatureOrganizationRepository,

		mikroOrmFeatureOrganizationRepository: MikroOrmFeatureOrganizationRepository,

		@InjectRepository(Goal)
		private typeOrmGoalRepository: TypeOrmGoalRepository,

		mikroOrmGoalRepository: MikroOrmGoalRepository,

		@InjectRepository(GoalTemplate)
		private typeOrmGoalTemplateRepository: TypeOrmGoalTemplateRepository,

		mikroOrmGoalTemplateRepository: MikroOrmGoalTemplateRepository,

		@InjectRepository(GoalKPI)
		private typeOrmGoalKPIRepository: TypeOrmGoalKPIRepository,

		mikroOrmGoalKPIRepository: MikroOrmGoalKPIRepository,

		@InjectRepository(GoalKPITemplate)
		private typeOrmGoalKPITemplateRepository: TypeOrmGoalKPITemplateRepository,

		mikroOrmGoalKPITemplateRepository: MikroOrmGoalKPITemplateRepository,

		@InjectRepository(GoalTimeFrame)
		private typeOrmGoalTimeFrameRepository: TypeOrmGoalTimeFrameRepository,

		mikroOrmGoalTimeFrameRepository: MikroOrmGoalTimeFrameRepository,

		@InjectRepository(GoalGeneralSetting)
		private typeOrmGoalGeneralSettingRepository: TypeOrmGoalGeneralSettingRepository,

		mikroOrmGoalGeneralSettingRepository: MikroOrmGoalGeneralSettingRepository,

		@InjectRepository(Income)
		private typeOrmIncomeRepository: TypeOrmIncomeRepository,

		mikroOrmIncomeRepository: MikroOrmIncomeRepository,

		@InjectRepository(Integration)
		private typeOrmIntegrationRepository: TypeOrmIntegrationRepository,

		mikroOrmIntegrationRepository: MikroOrmIntegrationRepository,

		@InjectRepository(IntegrationType)
		private typeOrmIntegrationTypeRepository: TypeOrmIntegrationTypeRepository,

		mikroOrmIntegrationTypeRepository: MikroOrmIntegrationTypeRepository,

		@InjectRepository(IntegrationEntitySetting)
		private typeOrmIntegrationEntitySettingRepository: TypeOrmIntegrationEntitySettingRepository,

		mikroOrmIntegrationEntitySettingRepository: MikroOrmIntegrationEntitySettingRepository,

		@InjectRepository(IntegrationEntitySettingTied)
		private typeOrmIntegrationEntitySettingTiedRepository: TypeOrmIntegrationEntitySettingTiedRepository,

		mikroOrmIntegrationEntitySettingTiedRepository: MikroOrmIntegrationEntitySettingTiedRepository,

		@InjectRepository(IntegrationMap)
		private typeOrmIntegrationMapRepository: TypeOrmIntegrationMapRepository,

		mikroOrmIntegrationMapRepository: MikroOrmIntegrationMapRepository,

		@InjectRepository(IntegrationSetting)
		private typeOrmIntegrationSettingRepository: TypeOrmIntegrationSettingRepository,

		mikroOrmIntegrationSettingRepository: MikroOrmIntegrationSettingRepository,

		@InjectRepository(IntegrationTenant)
		private typeOrmIntegrationTenantRepository: TypeOrmIntegrationTenantRepository,

		mikroOrmIntegrationTenantRepository: MikroOrmIntegrationTenantRepository,

		@InjectRepository(Invite)
		private typeOrmInviteRepository: TypeOrmInviteRepository,

		mikroOrmInviteRepository: MikroOrmInviteRepository,

		@InjectRepository(Invoice)
		private typeOrmInvoiceRepository: TypeOrmInvoiceRepository,

		mikroOrmInvoiceRepository: MikroOrmInvoiceRepository,

		@InjectRepository(InvoiceEstimateHistory)
		private typeOrmInvoiceEstimateHistoryRepository: TypeOrmInvoiceEstimateHistoryRepository,

		mikroOrmInvoiceEstimateHistoryRepository: MikroOrmInvoiceEstimateHistoryRepository,

		@InjectRepository(InvoiceItem)
		private typeOrmInvoiceItemRepository: TypeOrmInvoiceItemRepository,

		mikroOrmInvoiceItemRepository: MikroOrmInvoiceItemRepository,

		// @InjectRepository(JobPreset)
		// private typeOrmJobPresetRepository: TypeOrmJobPresetRepository,

		// mikroOrmJobPresetRepository: MikroOrmJobPresetRepository,

		// @InjectRepository(JobPresetUpworkJobSearchCriterion)
		// private typeOrmJobPresetUpworkJobSearchCriterionRepository: TypeOrmJobPresetUpworkJobSearchCriterionRepository,

		// mikroOrmJobPresetUpworkJobSearchCriterionRepository: MikroOrmJobPresetUpworkJobSearchCriterionRepository,

		// @InjectRepository(JobSearchCategory)
		// private typeOrmJobSearchCategoryRepository: TypeOrmJobSearchCategoryRepository,

		// mikroOrmJobSearchCategoryRepository: MikroOrmJobSearchCategoryRepository,

		// @InjectRepository(JobSearchOccupation)
		// private typeOrmJobSearchOccupationRepository: TypeOrmJobSearchOccupationRepository,

		// mikroOrmJobSearchOccupationRepository: MikroOrmJobSearchOccupationRepository,

		@InjectRepository(KeyResult)
		private typeOrmKeyResultRepository: TypeOrmKeyResultRepository,

		mikroOrmKeyResultRepository: MikroOrmKeyResultRepository,

		@InjectRepository(KeyResultTemplate)
		private typeOrmKeyResultTemplateRepository: TypeOrmKeyResultTemplateRepository,

		mikroOrmKeyResultTemplateRepository: MikroOrmKeyResultTemplateRepository,

		@InjectRepository(KeyResultUpdate)
		private typeOrmKeyResultUpdateRepository: TypeOrmKeyResultUpdateRepository,

		mikroOrmKeyResultUpdateRepository: MikroOrmKeyResultUpdateRepository,

		@InjectRepository(Language)
		private typeOrmLanguageRepository: TypeOrmLanguageRepository,

		mikroOrmLanguageRepository: MikroOrmLanguageRepository,

		@InjectRepository(Organization)
		private typeOrmOrganizationRepository: TypeOrmOrganizationRepository,

		mikroOrmOrganizationRepository: MikroOrmOrganizationRepository,

		@InjectRepository(EmployeeLevel)
		private typeOrmEmployeeLevelRepository: TypeOrmEmployeeLevelRepository,

		mikroOrmEmployeeLevelRepository: MikroOrmEmployeeLevelRepository,

		@InjectRepository(OrganizationAward)
		private typeOrmOrganizationAwardRepository: TypeOrmOrganizationAwardRepository,

		mikroOrmOrganizationAwardRepository: MikroOrmOrganizationAwardRepository,

		@InjectRepository(OrganizationContact)
		private typeOrmOrganizationContactRepository: TypeOrmOrganizationContactRepository,

		mikroOrmOrganizationContactRepository: MikroOrmOrganizationContactRepository,

		@InjectRepository(OrganizationDepartment)
		private typeOrmOrganizationDepartmentRepository: TypeOrmOrganizationDepartmentRepository,

		mikroOrmOrganizationDepartmentRepository: MikroOrmOrganizationDepartmentRepository,

		@InjectRepository(OrganizationDocument)
		private typeOrmOrganizationDocumentRepository: TypeOrmOrganizationDocumentRepository,

		mikroOrmOrganizationDocumentRepository: MikroOrmOrganizationDocumentRepository,

		@InjectRepository(OrganizationEmploymentType)
		private typeOrmOrganizationEmploymentTypeRepository: TypeOrmOrganizationEmploymentTypeRepository,

		mikroOrmOrganizationEmploymentTypeRepository: MikroOrmOrganizationEmploymentTypeRepository,

		@InjectRepository(OrganizationLanguage)
		private typeOrmOrganizationLanguageRepository: TypeOrmOrganizationLanguageRepository,

		mikroOrmOrganizationLanguageRepository: MikroOrmOrganizationLanguageRepository,

		@InjectRepository(OrganizationPosition)
		private typeOrmOrganizationPositionRepository: TypeOrmOrganizationPositionRepository,

		mikroOrmOrganizationPositionRepository: MikroOrmOrganizationPositionRepository,

		@InjectRepository(OrganizationProject)
		private typeOrmOrganizationProjectRepository: TypeOrmOrganizationProjectRepository,

		mikroOrmOrganizationProjectRepository: MikroOrmOrganizationProjectRepository,

		@InjectRepository(OrganizationRecurringExpense)
		private typeOrmOrganizationRecurringExpenseRepository: TypeOrmOrganizationRecurringExpenseRepository,

		mikroOrmOrganizationRecurringExpenseRepository: MikroOrmOrganizationRecurringExpenseRepository,

		@InjectRepository(OrganizationSprint)
		private typeOrmOrganizationSprintRepository: TypeOrmOrganizationSprintRepository,

		mikroOrmOrganizationSprintRepository: MikroOrmOrganizationSprintRepository,

		@InjectRepository(OrganizationTeam)
		private typeOrmOrganizationTeamRepository: TypeOrmOrganizationTeamRepository,

		mikroOrmOrganizationTeamRepository: MikroOrmOrganizationTeamRepository,

		@InjectRepository(OrganizationTeamEmployee)
		private typeOrmOrganizationTeamEmployeeRepository: TypeOrmOrganizationTeamEmployeeRepository,

		mikroOrmOrganizationTeamEmployeeRepository: MikroOrmOrganizationTeamEmployeeRepository,

		@InjectRepository(OrganizationVendor)
		private typeOrmOrganizationVendorRepository: TypeOrmOrganizationVendorRepository,

		mikroOrmOrganizationVendorRepository: MikroOrmOrganizationVendorRepository,

		@InjectRepository(Payment)
		private typeOrmPaymentRepository: TypeOrmPaymentRepository,

		mikroOrmPaymentRepository: MikroOrmPaymentRepository,

		@InjectRepository(Pipeline)
		private typeOrmPipelineRepository: TypeOrmPipelineRepository,

		mikroOrmPipelineRepository: MikroOrmPipelineRepository,

		@InjectRepository(PipelineStage)
		private typeOrmPipelineStageRepository: TypeOrmPipelineStageRepository,

		mikroOrmPipelineStageRepository: MikroOrmPipelineStageRepository,

		@InjectRepository(Product)
		private typeOrmProductRepository: TypeOrmProductRepository,

		mikroOrmProductRepository: MikroOrmProductRepository,

		@InjectRepository(ProductTranslation)
		private typeOrmProductTranslationRepository: TypeOrmProductTranslationRepository,

		mikroOrmProductTranslationRepository: MikroOrmProductTranslationRepository,

		@InjectRepository(ProductCategory)
		private typeOrmProductCategoryRepository: TypeOrmProductCategoryRepository,

		mikroOrmProductCategoryRepository: MikroOrmProductCategoryRepository,

		@InjectRepository(ProductCategoryTranslation)
		private typeOrmProductCategoryTranslationRepository: TypeOrmProductCategoryTranslationRepository,

		mikroOrmProductCategoryTranslationRepository: MikroOrmProductCategoryTranslationRepository,

		@InjectRepository(ProductOption)
		private typeOrmProductOptionRepository: TypeOrmProductOptionRepository,

		mikroOrmProductOptionRepository: MikroOrmProductOptionRepository,

		@InjectRepository(ProductOptionTranslation)
		private typeOrmProductOptionTranslationRepository: TypeOrmProductOptionTranslationRepository,

		mikroOrmProductOptionTranslationRepository: MikroOrmProductOptionTranslationRepository,

		@InjectRepository(ProductOptionGroup)
		private typeOrmProductOptionGroupRepository: TypeOrmProductOptionGroupRepository,

		mikroOrmProductOptionGroupRepository: MikroOrmProductOptionGroupRepository,

		@InjectRepository(ProductOptionGroupTranslation)
		private typeOrmProductOptionGroupTranslationRepository: TypeOrmProductOptionGroupTranslationRepository,

		mikroOrmProductOptionGroupTranslationRepository: MikroOrmProductOptionGroupTranslationRepository,

		@InjectRepository(ProductVariantSetting)
		private typeOrmProductVariantSettingRepository: TypeOrmProductVariantSettingRepository,

		mikroOrmProductVariantSettingRepository: MikroOrmProductVariantSettingRepository,

		@InjectRepository(ProductType)
		private typeOrmProductTypeRepository: TypeOrmProductTypeRepository,

		mikroOrmProductTypeRepository: MikroOrmProductTypeRepository,

		@InjectRepository(ProductTypeTranslation)
		private typeOrmProductTypeTranslationRepository: TypeOrmProductTypeTranslationRepository,

		mikroOrmProductTypeTranslationRepository: MikroOrmProductTypeTranslationRepository,

		@InjectRepository(ProductVariant)
		private typeOrmProductVariantRepository: TypeOrmProductVariantRepository,

		mikroOrmProductVariantRepository: MikroOrmProductVariantRepository,

		@InjectRepository(ProductVariantPrice)
		private typeOrmProductVariantPriceRepository: TypeOrmProductVariantPriceRepository,

		mikroOrmProductVariantPriceRepository: MikroOrmProductVariantPriceRepository,

		@InjectRepository(ImageAsset)
		private typeOrmImageAssetRepository: TypeOrmImageAssetRepository,

		mikroOrmImageAssetRepository: MikroOrmImageAssetRepository,

		@InjectRepository(Warehouse)
		private typeOrmWarehouseRepository: TypeOrmWarehouseRepository,

		mikroOrmWarehouseRepository: MikroOrmWarehouseRepository,

		@InjectRepository(Merchant)
		private typeOrmMerchantRepository: TypeOrmMerchantRepository,

		mikroOrmMerchantRepository: MikroOrmMerchantRepository,

		@InjectRepository(WarehouseProduct)
		private typeOrmWarehouseProductRepository: TypeOrmWarehouseProductRepository,

		mikroOrmWarehouseProductRepository: MikroOrmWarehouseProductRepository,

		@InjectRepository(WarehouseProductVariant)
		private typeOrmWarehouseProductVariantRepository: TypeOrmWarehouseProductVariantRepository,

		mikroOrmWarehouseProductVariantRepository: MikroOrmWarehouseProductVariantRepository,

		@InjectRepository(Proposal)
		private typeOrmProposalRepository: TypeOrmProposalRepository,

		mikroOrmProposalRepository: MikroOrmProposalRepository,

		@InjectRepository(Skill)
		private typeOrmSkillRepository: TypeOrmSkillRepository,

		mikroOrmSkillRepository: MikroOrmSkillRepository,

		@InjectRepository(Screenshot)
		private typeOrmScreenshotRepository: TypeOrmScreenshotRepository,

		mikroOrmScreenshotRepository: MikroOrmScreenshotRepository,

		@InjectRepository(RequestApproval)
		private typeOrmRequestApprovalRepository: TypeOrmRequestApprovalRepository,

		mikroOrmRequestApprovalRepository: MikroOrmRequestApprovalRepository,

		@InjectRepository(RequestApprovalEmployee)
		private typeOrmRequestApprovalEmployeeRepository: TypeOrmRequestApprovalEmployeeRepository,

		mikroOrmRequestApprovalEmployeeRepository: MikroOrmRequestApprovalEmployeeRepository,

		@InjectRepository(RequestApprovalTeam)
		private typeOrmRequestApprovalTeamRepository: TypeOrmRequestApprovalTeamRepository,

		mikroOrmRequestApprovalTeamRepository: MikroOrmRequestApprovalTeamRepository,

		@InjectRepository(Role)
		private typeOrmRoleRepository: TypeOrmRoleRepository,

		mikroOrmRoleRepository: MikroOrmRoleRepository,

		@InjectRepository(RolePermission)
		private typeOrmRolePermissionRepository: TypeOrmRolePermissionRepository,

		mikroOrmRolePermissionRepository: MikroOrmRolePermissionRepository,

		@InjectRepository(Report)
		private typeOrmReportRepository: TypeOrmReportRepository,

		mikroOrmReportRepository: MikroOrmReportRepository,

		@InjectRepository(ReportCategory)
		private typeOrmReportCategoryRepository: TypeOrmReportCategoryRepository,

		mikroOrmReportCategoryRepository: MikroOrmReportCategoryRepository,

		@InjectRepository(ReportOrganization)
		private typeOrmReportOrganizationRepository: TypeOrmReportOrganizationRepository,

		mikroOrmReportOrganizationRepository: MikroOrmReportOrganizationRepository,

		@InjectRepository(Tag)
		private typeOrmTagRepository: TypeOrmTagRepository,

		mikroOrmTagRepository: MikroOrmTagRepository,

		@InjectRepository(Task)
		private typeOrmTaskRepository: TypeOrmTaskRepository,

		mikroOrmTaskRepository: MikroOrmTaskRepository,

		@InjectRepository(TenantSetting)
		private typeOrmTenantSettingRepository: TypeOrmTenantSettingRepository,

		mikroOrmTenantSettingRepository: MikroOrmTenantSettingRepository,

		@InjectRepository(Timesheet)
		private typeOrmTimesheetRepository: TypeOrmTimesheetRepository,

		mikroOrmTimesheetRepository: MikroOrmTimesheetRepository,

		@InjectRepository(TimeLog)
		private typeOrmTimeLogRepository: TypeOrmTimeLogRepository,

		mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,

		@InjectRepository(TimeSlot)
		private typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,

		mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,

		@InjectRepository(TimeSlotMinute)
		private typeOrmTimeSlotMinuteRepository: TypeOrmTimeSlotMinuteRepository,

		mikroOrmTimeSlotMinuteRepository: MikroOrmTimeSlotMinuteRepository,

		@InjectRepository(TimeOffRequest)
		private typeOrmTimeOffRequestRepository: TypeOrmTimeOffRequestRepository,

		mikroOrmTimeOffRequestRepository: MikroOrmTimeOffRequestRepository,

		@InjectRepository(TimeOffPolicy)
		private typeOrmTimeOffPolicyRepository: TypeOrmTimeOffPolicyRepository,

		mikroOrmTimeOffPolicyRepository: MikroOrmTimeOffPolicyRepository,

		@InjectRepository(User)
		private typeOrmUserRepository: TypeOrmUserRepository,

		mikroOrmUserRepository: MikroOrmUserRepository,

		@InjectRepository(UserOrganization)
		private typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,

		mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,

		private readonly configService: ConfigService,
		private readonly _connectionEntityManager: ConnectionEntityManager,
		private readonly commandBus: CommandBus
	) { }

	async onModuleInit() {
		//base import csv directory path
		this._dirname = path.join(this.configService.assetOptions.assetPublicPath || __dirname);

		await this.createDynamicInstanceForPluginEntities();
		await this.registerCoreRepositories();
	}

	public removeExtractedFiles() {
		try {
			rimraf.sync(this._extractPath);
		} catch (error) {
			console.log(error);
		}
	}

	public async unzipAndParse(filePath: string, cleanup: boolean = false) {

		//extracted import csv directory path
		this._extractPath = path.join(path.join(this._dirname, filePath), '../csv');

		const file = await new FileStorage().getProvider().getFile(filePath);
		await unzipper.Open.buffer(file).then((d) =>
			d.extract({ path: this._extractPath })
		);
		await this.parse(cleanup);
	}

	async parse(cleanup: boolean = false) {
		/**
		  * Can only run in a particular order
		*/
		const tenantId = RequestContext.currentTenantId();
		for await (const item of this.repositories) {

			const { repository, isStatic = false, relations = [] } = item;
			const nameFile = repository.metadata.tableName;
			const csvPath = path.join(this._extractPath, `${nameFile}.csv`);
			const masterTable = repository.metadata.tableName;

			if (!fs.existsSync(csvPath)) {
				console.log(chalk.yellow(`File Does Not Exist, Skipping: ${nameFile}`));
				continue;
			}

			console.log(chalk.magenta(`Importing process start for table: ${masterTable}`));

			await new Promise(async (resolve, reject) => {
				try {
					/**
					* This will first collect all the data and then insert
					* If cleanup flag is set then it will also delete current tenant related data from the database table with CASCADE
					*/
					if (cleanup && isStatic !== true) {
						try {
							let sql = `DELETE FROM "${masterTable}" WHERE "${masterTable}"."tenantId" = '${tenantId}'`;
							await repository.query(sql);
							console.log(chalk.yellow(`Clean up processing for table: ${masterTable}`));
						} catch (error) {
							console.log(chalk.red(`Failed to clean up process for table: ${masterTable}`), error);
							reject(error);
						}
					}

					let results = [];
					const stream = fs.createReadStream(csvPath, 'utf8').pipe(csv());
					stream.on('data', (data) => { results.push(data); });
					stream.on('error', (error) => {
						console.log(chalk.red(`Failed to parse CSV for table: ${masterTable}`), error);
						reject(error);
					});
					stream.on('end', async () => {
						results = results.filter(isNotEmpty);
						try {
							for await (const data of results) {
								if (isNotEmpty(data)) {
									await this.migrateImportEntityRecord(
										item,
										data
									);
								}
							}
							console.log(chalk.green(`Success to inserts data for table: ${masterTable}`));
						} catch (error) {
							console.log(chalk.red(`Failed to inserts data for table: ${masterTable}`), error);
							reject(error);
						}
						resolve(true);
					});
				} catch (error) {
					console.log(chalk.red(`Failed to read file for table: ${masterTable}`), error);
					reject(error);
				}
			});

			// export pivot relational tables
			if (isNotEmpty(relations)) {
				await this.parseRelationalTables(item, cleanup);
			}
		}
	}

	async parseRelationalTables(
		entity: IRepositoryModel<any>,
		cleanup: boolean = false
	) {
		const { relations } = entity;
		for await (const item of relations) {
			const { joinTableName } = item;
			const csvPath = path.join(this._extractPath, `${joinTableName}.csv`);

			if (!fs.existsSync(csvPath)) {
				console.log(chalk.yellow(`File Does Not Exist, Skipping: ${joinTableName}`));
				continue;
			}

			console.log(chalk.magenta(`Importing process start for table: ${joinTableName}`));

			await new Promise(async (resolve, reject) => {
				try {
					let results = [];
					const stream = fs.createReadStream(csvPath, 'utf8').pipe(csv());
					stream.on('data', (data) => { results.push(data); });
					stream.on('error', (error) => {
						console.log(chalk.red(`Failed to parse CSV for table: ${joinTableName}`), error);
						reject(error);
					});
					stream.on('end', async () => {
						results = results.filter(isNotEmpty);

						for await (const data of results) {
							try {
								if (isNotEmpty(data)) {
									const fields = await this.mapRelationFields(item, data);
									const sql = `INSERT INTO "${joinTableName}" (${'"' + Object.keys(fields).join(`", "`) + '"'}) VALUES ("$1", "$2")`;
									// const items = await getManager().query(sql, Object.values(fields));
									console.log(sql);
									// console.log(chalk.green(`Success to inserts data for table: ${joinTableName}`));
								}
							} catch (error) {
								console.log(chalk.red(`Failed to inserts data for table: ${joinTableName}`), error);
								reject(error);
							}
						}
						resolve(true);
					});
				} catch (error) {
					console.log(chalk.red(`Failed to read file for table: ${joinTableName}`, error));
					reject(error);
				}
			});

		}
	}

	/*
	* Map static tables import record before insert data
	*/
	async migrateImportEntityRecord(
		item: IRepositoryModel<any>,
		entity: any
	): Promise<any> {
		const { repository, uniqueIdentifier = [] } = item;
		const masterTable = repository.metadata.tableName;

		return await new Promise(async (resolve, reject) => {
			try {
				const source = JSON.parse(JSON.stringify(entity));
				const where = [];
				if (isNotEmpty(uniqueIdentifier) && uniqueIdentifier instanceof Array) {
					if ('tenantId' in entity && isNotEmpty(entity['tenantId'])) {
						where.push({ tenantId: RequestContext.currentTenantId() });
					}
					for (const unique of uniqueIdentifier) {
						where.push({ [unique.column]: entity[unique.column] });
					}
				}
				const destination = await this.commandBus.execute(
					new ImportEntityFieldMapOrCreateCommand(
						repository,
						where,
						await this.mapFields(item, entity),
						source.id
					)
				);
				if (destination) {
					await this.mappedImportRecord(
						item,
						destination,
						source
					);
				}
				resolve(true)
			} catch (error) {
				console.log(chalk.red(`Failed to migrate import entity data for table: ${masterTable}`), error, entity);
				reject(error)
			}
		});
	}

	/*
	* Map import record after find or insert data
	*/
	async mappedImportRecord(
		item: IRepositoryModel<any>,
		destination: any,
		row: any
	): Promise<any> {
		const { repository } = item;
		const entityType = repository.metadata.tableName;

		return await new Promise(async (resolve, reject) => {
			try {
				if (destination) {
					await this.commandBus.execute(
						new ImportRecordUpdateOrCreateCommand({
							tenantId: RequestContext.currentTenantId(),
							sourceId: row.id,
							destinationId: destination.id,
							entityType
						})
					);
				}
				resolve(true);
			} catch (error) {
				console.log(chalk.red(`Failed to map import record for table: ${entityType}`), error);
				reject(error)
			}
		});
	}

	/*
	* Map tenant & organization base fields here
	* Notice: Please add timestamp field here if missing
	*/
	async mapFields(
		item: IRepositoryModel<any>,
		data: any
	) {
		if ('id' in data && isNotEmpty(data['id'])) {
			delete data['id'];
		}
		if ('tenantId' in data && isNotEmpty(data['tenantId'])) {
			data['tenantId'] = RequestContext.currentTenantId();
		}
		if ('organizationId' in data && isNotEmpty(data['organizationId'])) {
			try {
				const organization = await this.typeOrmOrganizationRepository.findOneByOrFail({
					id: data['organizationId'],
					tenantId: RequestContext.currentTenantId()
				});
				data['organizationId'] = organization ? organization.id : IsNull().value;
			} catch (error) {
				const { record } = await this.commandBus.execute(
					new ImportRecordFindOrFailCommand({
						tenantId: RequestContext.currentTenantId(),
						sourceId: data['organizationId'],
						entityType: this.typeOrmOrganizationRepository.metadata.tableName
					})
				);
				data['organizationId'] = record ? record.destinationId : IsNull().value;
			}
		}
		return await this.mapTimeStampsFields(
			item, await this.mapRelationFields(item, data)
		);
	}

	/*
	* Map timestamps fields here
	*/
	async mapTimeStampsFields(item: IRepositoryModel<any>, data: any) {
		const { repository } = item;
		for await (const column of repository.metadata.columns as ColumnMetadata[]) {
			const { propertyName, type } = column;
			if (`${propertyName}` in data && isNotEmpty(data[`${propertyName}`])) {
				if ((type.valueOf() === Date) || (type === 'datetime' || type === 'timestamp')) {
					data[`${propertyName}`] = convertToDatetime(data[`${propertyName}`]);
				} else if (data[`${propertyName}`] === 'true') {
					data[`${propertyName}`] = true;
				} else if (data[`${propertyName}`] === 'false') {
					data[`${propertyName}`] = false;
				}
			}
		}
		return data;
	}

	/*
	* Map relation fields here
	*/
	async mapRelationFields(
		item: IRepositoryModel<any> | IColumnRelationMetadata<any>,
		data: any
	): Promise<any> {
		return await new Promise(async (resolve, reject) => {
			try {
				const { foreignKeys = [], isCheckRelation = false } = item;
				if (isCheckRelation) {
					if (isNotEmpty(foreignKeys) && foreignKeys instanceof Array) {
						for await (const { column, repository } of foreignKeys) {
							const { record } = await this.commandBus.execute(
								new ImportRecordFindOrFailCommand({
									tenantId: RequestContext.currentTenantId(),
									sourceId: data[column],
									entityType: repository.metadata.tableName
								})
							);
							data[column] = record ? record.destinationId : IsNull().value;
						}
					}
				}
				resolve(data);
			} catch (error) {
				console.log(chalk.red('Failed to map relation entity before insert'), error);
				reject(error);
			}
		});
	}

	//load plugins entities for import data
	private async createDynamicInstanceForPluginEntities() {
		for await (const entity of getEntitiesFromPlugins(
			this.configService.plugins
		)) {
			if (!isFunction(entity)) {
				continue;
			}

			const className = _.camelCase(entity.name);
			const repository = this._connectionEntityManager.getRepository(entity);

			this[className] = repository;
			this.dynamicEntitiesClassMap.push({ repository });
		}
	}

	/*
	* Load all entities repository after create instance
	* Warning: Changing position here can be FATAL
	*/
	private async registerCoreRepositories() {
		this.repositories = [
			/**
			* These entities do not have any other dependency so need to be mapped first
			*/
			{
				repository: this.typeOrmReportCategoryRepository,
				isStatic: true,
				uniqueIdentifier: [{ column: 'name' }]
			},
			{
				repository: this.typeOrmReportRepository,
				isStatic: true,
				uniqueIdentifier: [{ column: 'name' }, { column: 'slug' }]
			},
			{
				repository: this.typeOrmFeatureRepository,
				isStatic: true,
				uniqueIdentifier: [{ column: 'name' }, { column: 'code' }]
			},
			{
				repository: this.typeOrmLanguageRepository,
				isStatic: true,
				uniqueIdentifier: [{ column: 'name' }, { column: 'code' }]
			},
			{
				repository: this.typeOrmIntegrationRepository,
				isStatic: true,
				uniqueIdentifier: [{ column: 'name' }]
			},
			{
				repository: this.typeOrmIntegrationTypeRepository,
				isStatic: true,
				uniqueIdentifier: [{ column: 'name' }, { column: 'groupName' }],
				relations: [
					{
						joinTableName: 'integration_integration_type',
						isCheckRelation: true,
						foreignKeys: [
							{ column: 'integrationId', repository: this.typeOrmIntegrationRepository },
							{ column: 'integrationTypeId', repository: this.typeOrmIntegrationTypeRepository }
						]
					}
				]
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
				repository: this.typeOrmRolePermissionRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'roleId', repository: this.typeOrmRoleRepository }
				]
			},
			{
				repository: this.typeOrmOrganizationRepository
			},
			/**
			* These entities need TENANT and ORGANIZATION
			*/
			{
				repository: this.typeOrmUserRepository,
				isStatic: true,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'roleId', repository: this.typeOrmRoleRepository }
				]
			},
			{
				repository: this.typeOrmUserOrganizationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'userId', repository: this.typeOrmUserRepository }
				]
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
				repository: this.typeOrmOrganizationContactRepository
			},
			{
				repository: this.typeOrmOrganizationProjectRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'organizationContactId', repository: this.typeOrmOrganizationContactRepository }
				]
			},
			{
				repository: this.typeOrmOrganizationSprintRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'projectId', repository: this.typeOrmOrganizationProjectRepository }
				]
			},
			{
				repository: this.typeOrmOrganizationRecurringExpenseRepository
			},
			{
				repository: this.typeOrmContactRepository
			},
			{
				repository: this.typeOrmCustomSmtpRepository
			},
			{
				repository: this.typeOrmReportOrganizationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'reportId', repository: this.typeOrmReportRepository }
				]
			},
			// {
			// 	repository: this.typeOrmJobPresetRepository
			// },
			// {
			// 	repository: this.typeOrmJobSearchCategoryRepository
			// },
			// {
			// 	repository: this.typeOrmJobSearchOccupationRepository
			// },
			// {
			// 	repository: this.typeOrmJobPresetUpworkJobSearchCriterionRepository,
			// 	isCheckRelation: true,
			// 	foreignKeys: [
			// 		{ column: 'jobPresetId', repository: this.typeOrmJobPresetRepository },
			// 		{ column: 'occupationId', repository: this.typeOrmJobSearchOccupationRepository },
			// 		{ column: 'categoryId', repository: this.typeOrmJobSearchCategoryRepository }
			// 	]
			// },
			/**
			* These entities need TENANT, ORGANIZATION & USER
			*/
			{
				repository: this.typeOrmEmployeeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'userId', repository: this.typeOrmUserRepository },
					{ column: 'contactId', repository: this.typeOrmContactRepository },
					{ column: 'organizationPositionId', repository: this.typeOrmOrganizationPositionRepository }
				],
				relations: [
					{ joinTableName: 'employee_job_preset' },
					{
						joinTableName: 'organization_department_employee',
						foreignKeys: [
							{ column: 'organizationDepartmentId', repository: this.typeOrmOrganizationDepartmentRepository },
							{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
						]
					},
					{
						joinTableName: 'organization_employment_type_employee',
						foreignKeys: [
							{ column: 'organizationEmploymentTypeId', repository: this.typeOrmOrganizationEmploymentTypeRepository },
							{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
						]
					},
					{
						joinTableName: 'organization_contact_employee',
						foreignKeys: [
							{ column: 'organizationContactId', repository: this.typeOrmOrganizationContactRepository },
							{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
						]
					},
					{
						joinTableName: 'organization_project_employee',
						foreignKeys: [
							{ column: 'organizationProjectId', repository: this.typeOrmOrganizationProjectRepository },
							{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
						]
					}
				]
			},
			/**
			* These entities need TENANT, ORGANIZATION & CANDIDATE
			*/
			{
				repository: this.typeOrmCandidateRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'userId', repository: this.typeOrmUserRepository },
					{ column: 'organizationPositionId', repository: this.typeOrmOrganizationPositionRepository }
				],
				relations: [
					{
						joinTableName: 'candidate_department',
						foreignKeys: [
							{ column: 'candidateId', repository: this.typeOrmCandidateRepository },
							{ column: 'organizationDepartmentId', repository: this.typeOrmOrganizationDepartmentRepository }
						]
					},
					{
						joinTableName: 'candidate_employment_type',
						foreignKeys: [
							{ column: 'candidateId', repository: this.typeOrmCandidateRepository },
							{ column: 'organizationEmploymentTypeId', repository: this.typeOrmOrganizationEmploymentTypeRepository }
						]
					}
				]
			},
			{
				repository: this.typeOrmCandidateDocumentRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.typeOrmCandidateRepository }
				]
			},
			{
				repository: this.typeOrmCandidateEducationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.typeOrmCandidateRepository }
				]
			},
			{
				repository: this.typeOrmCandidateSkillRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.typeOrmCandidateRepository }
				]
			},
			{
				repository: this.typeOrmCandidateSourceRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.typeOrmCandidateRepository }
				]
			},
			{
				repository: this.typeOrmCandidateInterviewRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.typeOrmCandidateRepository }
				]
			},
			{
				repository: this.typeOrmCandidateInterviewersRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'interviewId', repository: this.typeOrmCandidateInterviewRepository },
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			{
				repository: this.typeOrmCandidateExperienceRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.typeOrmCandidateRepository }
				]
			},
			{
				repository: this.typeOrmCandidateFeedbackRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.typeOrmCandidateRepository },
					{ column: 'interviewId', repository: this.typeOrmCandidateInterviewRepository },
					{ column: 'interviewerId', repository: this.typeOrmCandidateInterviewersRepository }
				]
			},
			{
				repository: this.typeOrmCandidatePersonalQualitiesRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'interviewId', repository: this.typeOrmCandidateInterviewRepository }
				]
			},
			{
				repository: this.typeOrmCandidateTechnologiesRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'interviewId', repository: this.typeOrmCandidateInterviewRepository }
				]
			},
			{
				repository: this.typeOrmCandidateCriterionsRatingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'feedbackId', repository: this.typeOrmCandidateFeedbackRepository },
					{ column: 'technologyId', repository: this.typeOrmCandidateTechnologiesRepository },
					{ column: 'personalQualityId', repository: this.typeOrmCandidatePersonalQualitiesRepository },
				]
			},
			/**
			* These entities need TENANT and ORGANIZATION
			*/
			{
				repository: this.typeOrmSkillRepository,
				uniqueIdentifier: [{ column: 'name' }],
				relations: [
					{
						joinTableName: 'skill_employee',
						foreignKeys: [
							{ column: 'skillId', repository: this.typeOrmSkillRepository },
							{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
						]
					},
					{
						joinTableName: 'skill_organization',
						foreignKeys: [
							{ column: 'skillId', repository: this.typeOrmSkillRepository },
							{ column: 'organizationId', repository: this.typeOrmOrganizationRepository }
						]
					}
				]
			},
			{
				repository: this.typeOrmAccountingTemplateRepository
			},
			{
				repository: this.typeOrmApprovalPolicyRepository
			},
			{
				repository: this.typeOrmAvailabilitySlotRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			{
				repository: this.typeOrmEmployeeAppointmentRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			{
				repository: this.typeOrmAppointmentEmployeeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'employeeAppointmentId', repository: this.typeOrmEmployeeAppointmentRepository }
				]
			},
			/*
			* Email & Template
			*/
			{
				repository: this.typeOrmEmailTemplateRepository
			},
			{
				repository: this.typeOrmEmailHistoryRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'emailTemplateId', repository: this.typeOrmEmailTemplateRepository },
					{ column: 'userId', repository: this.typeOrmUserRepository }
				]
			},
			{
				repository: this.typeOrmEstimateEmailRepository
			},
			/*
			* Employee & Related Entities
			*/
			{
				repository: this.typeOrmEmployeeAwardRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			// {
			// 	repository: this.typeOrmEmployeeProposalTemplateRepository,
			// 	isCheckRelation: true,
			// 	foreignKeys: [
			// 		{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
			// 	]
			// },
			{
				repository: this.typeOrmEmployeeRecurringExpenseRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			{
				repository: this.typeOrmEmployeeSettingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			// {
			// 	repository: this.typeOrmEmployeeUpworkJobsSearchCriterionRepository,
			// 	isCheckRelation: true,
			// 	foreignKeys: [
			// 		{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
			// 		{ column: 'jobPresetId', repository: this.typeOrmJobPresetRepository },
			// 		{ column: 'occupationId', repository: this.typeOrmJobSearchOccupationRepository },
			// 		{ column: 'categoryId', repository: this.typeOrmJobSearchCategoryRepository }
			// 	]
			// },
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
				repository: this.typeOrmEquipmentSharingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'equipmentId', repository: this.typeOrmEquipmentRepository },
					{ column: 'equipmentSharingPolicyId', repository: this.typeOrmEquipmentSharingPolicyRepository }
				],
				relations: [
					{
						joinTableName: 'equipment_shares_employees',
						foreignKeys: [
							{ column: 'equipmentSharingId', repository: this.typeOrmEquipmentSharingRepository },
							{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
						]
					},
					{
						joinTableName: 'equipment_shares_teams',
						foreignKeys: [
							{ column: 'equipmentSharingId', repository: this.typeOrmEquipmentSharingRepository },
							{ column: 'organizationTeamId', repository: this.typeOrmOrganizationTeamRepository }
						]
					}
				]
			},
			/*
			* Event Type & Related Entities
			*/
			{
				repository: this.typeOrmEventTypeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			/*
			* Invoice & Related Entities
			*/
			{
				repository: this.typeOrmInvoiceRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'sendTo', repository: this.typeOrmOrganizationContactRepository },
					{ column: 'organizationContactId', repository: this.typeOrmOrganizationContactRepository },
					{ column: 'fromOrganizationId', repository: this.typeOrmOrganizationRepository },
					{ column: 'toContactId', repository: this.typeOrmOrganizationContactRepository }
				]
			},
			{
				repository: this.typeOrmInvoiceItemRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'invoiceId', repository: this.typeOrmInvoiceRepository },
					{ column: 'taskId', repository: this.typeOrmTaskRepository },
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'projectId', repository: this.typeOrmOrganizationProjectRepository },
					{ column: 'productId', repository: this.typeOrmProductRepository },
					{ column: 'expenseId', repository: this.typeOrmExpenseRepository }
				]
			},
			{
				repository: this.typeOrmInvoiceEstimateHistoryRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'userId', repository: this.typeOrmUserRepository },
					{ column: 'invoiceId', repository: this.typeOrmInvoiceRepository }
				]
			},
			/*
			* Expense & Related Entities
			*/
			{
				repository: this.typeOrmExpenseCategoryRepository
			},
			{
				repository: this.typeOrmExpenseRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'vendorId', repository: this.typeOrmOrganizationVendorRepository },
					{ column: 'categoryId', repository: this.typeOrmExpenseCategoryRepository },
					{ column: 'projectId', repository: this.typeOrmOrganizationProjectRepository }
				]
			},
			/*
			* Income
			*/
			{
				repository: this.typeOrmIncomeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			/*
			* Feature & Related Entities
			*/
			{
				repository: this.typeOrmFeatureOrganizationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'featureId', repository: this.typeOrmFeatureRepository }
				]
			},
			{
				repository: this.typeOrmGoalRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'ownerTeamId', repository: this.typeOrmOrganizationTeamRepository },
					{ column: 'ownerEmployeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'leadId', repository: this.typeOrmEmployeeRepository }
				]
			},
			/*
			* Key Result & Related Entities
			*/
			{
				repository: this.typeOrmKeyResultRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'projectId', repository: this.typeOrmOrganizationProjectRepository },
					{ column: 'taskId', repository: this.typeOrmTaskRepository },
					{ column: 'leadId', repository: this.typeOrmEmployeeRepository },
					{ column: 'ownerId', repository: this.typeOrmEmployeeRepository },
					{ column: 'goalId', repository: this.typeOrmGoalRepository }
				]
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
				repository: this.typeOrmGoalKPIRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'leadId', repository: this.typeOrmEmployeeRepository }
				]
			},
			{
				repository: this.typeOrmGoalKPITemplateRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'leadId', repository: this.typeOrmEmployeeRepository }
				]
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
				repository: this.typeOrmIntegrationSettingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'integrationId', repository: this.typeOrmIntegrationTenantRepository }
				]
			},
			{
				repository: this.typeOrmIntegrationMapRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'integrationId', repository: this.typeOrmIntegrationTenantRepository }
				]
			},
			{
				repository: this.typeOrmIntegrationEntitySettingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'integrationId', repository: this.typeOrmIntegrationTenantRepository }
				]
			},
			{
				repository: this.typeOrmIntegrationEntitySettingTiedRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'integrationEntitySettingId', repository: this.typeOrmIntegrationEntitySettingRepository }
				]
			},
			/*
			* Invite & Related Entities
			*/
			{
				repository: this.typeOrmInviteRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'roleId', repository: this.typeOrmRoleRepository },
					{ column: 'invitedById', repository: this.typeOrmUserRepository },
					{ column: 'organizationContactId', repository: this.typeOrmOrganizationContactRepository }
				],
				relations: [
					{
						joinTableName: 'invite_organization_contact',
						foreignKeys: [
							{ column: 'inviteId', repository: this.typeOrmEquipmentSharingRepository },
							{ column: 'organizationContactId', repository: this.typeOrmOrganizationContactRepository }
						]
					},
					{
						joinTableName: 'invite_organization_department',
						foreignKeys: [
							{ column: 'inviteId', repository: this.typeOrmEquipmentSharingRepository },
							{ column: 'organizationDepartmentId', repository: this.typeOrmOrganizationDepartmentRepository }
						]
					},
					{
						joinTableName: 'invite_organization_project',
						foreignKeys: [
							{ column: 'inviteId', repository: this.typeOrmEquipmentSharingRepository },
							{ column: 'organizationProjectId', repository: this.typeOrmOrganizationProjectRepository }
						]
					}
				]
			},
			{
				repository: this.typeOrmOrganizationTeamEmployeeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'organizationTeamId', repository: this.typeOrmOrganizationTeamRepository },
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'roleId', repository: this.typeOrmRoleRepository }
				]
			},
			/*
			* Pipeline & Stage Entities
			*/
			{
				repository: this.typeOrmPipelineRepository
			},
			{
				repository: this.typeOrmPipelineStageRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'pipelineId', repository: this.typeOrmPipelineRepository }
				]
			},
			{
				repository: this.typeOrmDealRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'createdByUserId', repository: this.typeOrmUserRepository },
					{ column: 'stageId', repository: this.typeOrmPipelineStageRepository },
					{ column: 'clientId', repository: this.typeOrmOrganizationContactRepository }
				]
			},
			/*
			* Product & Related Entities
			*/
			{
				repository: this.typeOrmProductCategoryRepository
			},
			{
				repository: this.typeOrmProductCategoryTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.typeOrmProductCategoryRepository }
				]
			},
			{
				repository: this.typeOrmProductTypeRepository
			},
			{
				repository: this.typeOrmProductTypeTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.typeOrmProductTypeRepository }
				]
			},
			{
				repository: this.typeOrmProductOptionGroupRepository
			},
			{
				repository: this.typeOrmProductOptionRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'groupId', repository: this.typeOrmProductOptionGroupRepository }
				]
			},
			{
				repository: this.typeOrmProductOptionTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.typeOrmProductOptionRepository }
				]
			},
			{
				repository: this.typeOrmProductOptionGroupTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.typeOrmProductOptionGroupRepository }
				]
			},
			{
				repository: this.typeOrmImageAssetRepository
			},
			{
				repository: this.typeOrmProductRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'featuredImageId', repository: this.typeOrmImageAssetRepository },
					{ column: 'typeId', repository: this.typeOrmProductTypeRepository },
					{ column: 'categoryId', repository: this.typeOrmProductCategoryRepository }
				],
				relations: [
					{ joinTableName: 'product_gallery_item' }
				]
			},
			{
				repository: this.typeOrmProductTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.typeOrmProductRepository }
				]
			},
			{
				repository: this.typeOrmProductVariantPriceRepository,
				isCheckRelation: true
			},
			{
				repository: this.typeOrmProductVariantSettingRepository
			},
			{
				repository: this.typeOrmProductVariantRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'productId', repository: this.typeOrmProductRepository },
					{ column: 'imageId', repository: this.typeOrmImageAssetRepository },
					{ column: 'priceId', repository: this.typeOrmProductVariantPriceRepository },
					{ column: 'settingsId', repository: this.typeOrmProductVariantSettingRepository }
				],
				relations: [
					{ joinTableName: 'product_variant_options_product_option' }
				]
			},
			{
				repository: this.typeOrmWarehouseRepository,
				uniqueIdentifier: [{ column: 'email' }, { column: 'code' }],
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'logoId', repository: this.typeOrmImageAssetRepository },
					{ column: 'contactId', repository: this.typeOrmContactRepository }
				]
			},
			{
				repository: this.typeOrmMerchantRepository,
				uniqueIdentifier: [{ column: 'email' }, { column: 'code' }],
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'logoId', repository: this.typeOrmImageAssetRepository },
					{ column: 'contactId', repository: this.typeOrmContactRepository }
				],
				relations: [
					{ joinTableName: 'warehouse_merchant' }
				]
			},
			{
				repository: this.typeOrmWarehouseProductRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'warehouseId', repository: this.typeOrmWarehouseRepository },
					{ column: 'productId', repository: this.typeOrmProductRepository }
				],
			},
			{
				repository: this.typeOrmWarehouseProductVariantRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'variantId', repository: this.typeOrmProductVariantRepository },
					{ column: 'warehouseProductId', repository: this.typeOrmWarehouseProductRepository }
				],
			},
			/*
			* Proposal & Related Entities
			*/
			{
				repository: this.typeOrmProposalRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'organizationContactId', repository: this.typeOrmOrganizationContactRepository }
				]
			},
			/*
			* Payment & Related Entities
			*/
			{
				repository: this.typeOrmPaymentRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'invoiceId', repository: this.typeOrmInvoiceRepository },
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'recordedById', repository: this.typeOrmUserRepository },
					{ column: 'projectId', repository: this.typeOrmOrganizationProjectRepository },
					{ column: 'contactId', repository: this.typeOrmOrganizationContactRepository }
				]
			},
			/*
			* Request Approval & Related Entities
			*/
			{
				repository: this.typeOrmRequestApprovalRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'approvalPolicyId', repository: this.typeOrmApprovalPolicyRepository }
				]
			},
			{
				repository: this.typeOrmRequestApprovalEmployeeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'requestApprovalId', repository: this.typeOrmRequestApprovalRepository },
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			{
				repository: this.typeOrmRequestApprovalTeamRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'requestApprovalId', repository: this.typeOrmRequestApprovalRepository },
					{ column: 'teamId', repository: this.typeOrmOrganizationTeamRepository }
				]
			},
			/*
			* Tasks & Related Entities
			*/
			{
				repository: this.typeOrmTaskRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'projectId', repository: this.typeOrmOrganizationProjectRepository },
					{ column: 'creatorId', repository: this.typeOrmUserRepository },
					{ column: 'organizationSprintId', repository: this.typeOrmOrganizationSprintRepository }
				],
				relations: [
					{ joinTableName: 'task_employee' },
					{ joinTableName: 'task_team' },
				]
			},
			/*
			* Timeoff & Related Entities
			*/
			{
				repository: this.typeOrmTimeOffPolicyRepository,
				relations: [
					{ joinTableName: 'time_off_policy_employee' }
				]
			},
			{
				repository: this.typeOrmTimeOffRequestRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'policyId', repository: this.typeOrmTimeOffPolicyRepository }
				],
				relations: [
					{ joinTableName: 'time_off_request_employee' }
				]
			},
			/*
			* Timesheet & Related Entities
			*/
			{
				repository: this.typeOrmTimesheetRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'approvedById', repository: this.typeOrmEmployeeRepository }
				]
			},
			{
				repository: this.typeOrmTimeLogRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'timesheetId', repository: this.typeOrmTimesheetRepository },
					{ column: 'projectId', repository: this.typeOrmOrganizationProjectRepository },
					{ column: 'taskId', repository: this.typeOrmTaskRepository },
					{ column: 'organizationContactId', repository: this.typeOrmOrganizationContactRepository }
				],
				relations: [
					{ joinTableName: 'time_slot_time_logs' }
				]
			},
			{
				repository: this.typeOrmTimeSlotRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository }
				]
			},
			{
				repository: this.typeOrmTimeSlotMinuteRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'timeSlotId', repository: this.typeOrmTimeSlotRepository }
				]
			},
			{
				repository: this.typeOrmScreenshotRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'timeSlotId', repository: this.typeOrmTimeSlotRepository }
				]
			},
			{
				repository: this.typeOrmActivityRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.typeOrmEmployeeRepository },
					{ column: 'projectId', repository: this.typeOrmOrganizationProjectRepository },
					{ column: 'timeSlotId', repository: this.typeOrmTimeSlotRepository },
					{ column: 'taskId', repository: this.typeOrmTaskRepository }
				]
			},
			/*
			* Tag & Related Entities
			*/
			{
				repository: this.typeOrmTagRepository,
				relations: [
					{ joinTableName: 'tag_candidate' },
					{ joinTableName: 'tag_employee' },
					{ joinTableName: 'tag_equipment' },
					{ joinTableName: 'tag_event_type' },
					{ joinTableName: 'tag_expense' },
					{ joinTableName: 'tag_income' },
					{ joinTableName: 'tag_integration' },
					{ joinTableName: 'tag_invoice' },
					{ joinTableName: 'tag_merchant' },
					{ joinTableName: 'tag_organization_contact' },
					{ joinTableName: 'tag_organization_department' },
					{ joinTableName: 'tag_organization_employee_level' },
					{ joinTableName: 'tag_organization_employment_type' },
					{ joinTableName: 'tag_organization_expense_category' },
					{ joinTableName: 'tag_organization_position' },
					{ joinTableName: 'tag_organization_project' },
					{ joinTableName: 'tag_organization_team' },
					{ joinTableName: 'tag_organization_vendor' },
					{ joinTableName: 'tag_organization' },
					{ joinTableName: 'tag_payment' },
					{ joinTableName: 'tag_product' },
					{ joinTableName: 'tag_proposal' },
					{ joinTableName: 'tag_request_approval' },
					{ joinTableName: 'tag_task' },
					{ joinTableName: 'tag_warehouse' }
				]
			},
			...this.dynamicEntitiesClassMap
		] as IRepositoryModel<any>[];
	}
}
