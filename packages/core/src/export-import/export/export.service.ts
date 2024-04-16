import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { camelCase } from 'lodash';
import * as archiver from 'archiver';
import * as csv from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import * as fse from 'fs-extra';
import { ConfigService } from '@gauzy/config';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { isFunction, isNotEmpty } from '@gauzy/common';
import { ConnectionEntityManager } from '../../database/connection-entity-manager';
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
	Country,
	Currency,
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
} from './../../core/entities/internal';
import { RequestContext } from './../../core/context';
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
import { MikroOrmCountryRepository } from '../../country/repository/mikro-orm-country.repository';
import { TypeOrmCountryRepository } from '../../country/repository/type-orm-country.repository';
import { MikroOrmCurrencyRepository } from '../../currency/repository/mikro-orm-currency.repository';
import { TypeOrmCurrencyRepository } from '../../currency/repository/type-orm-currency.repository';
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
import { MikroOrmTenantRepository } from '../../tenant/repository/mikro-orm-tenant.repository';
import { TypeOrmTenantRepository } from '../../tenant/repository/type-orm-tenant.repository';
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


export interface IColumnRelationMetadata {
	joinTableName: string;
}
export interface IRepositoryModel<T> {
	repository: Repository<T>;
	tenantBase?: boolean;
	relations?: IColumnRelationMetadata[];
	condition?: any;
}

@Injectable()
export class ExportService implements OnModuleInit {
	private _dirname: string;
	private _basename = '/export';

	public idZip = new BehaviorSubject<string>('');
	public idCsv = new BehaviorSubject<string>('');

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

		@InjectRepository(Country)
		private typeOrmCountryRepository: TypeOrmCountryRepository,

		mikroOrmCountryRepository: MikroOrmCountryRepository,

		@InjectRepository(Currency)
		private typeOrmCurrencyRepository: TypeOrmCurrencyRepository,

		mikroOrmCurrencyRepository: MikroOrmCurrencyRepository,

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

		@InjectRepository(Tenant)
		private typeOrmTenantRepository: TypeOrmTenantRepository,

		mikroOrmTenantRepository: MikroOrmTenantRepository,

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
		private readonly _connectionEntityManager: ConnectionEntityManager
	) { }

	async onModuleInit() {
		const public_path = this.configService.assetOptions.assetPublicPath || __dirname;
		//base import csv directory path
		this._dirname = path.join(public_path, this._basename);

		await this.createDynamicInstanceForPluginEntities();
		await this.registerCoreRepositories();
	}

	async createFolders(): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = uuidv4();
			this.idCsv.next(id);
			fs.access(`${this._dirname}/${id}/csv`, (error) => {
				if (!error) {
					return null;
				} else {
					fs.mkdir(
						`${this._dirname}/${id}/csv`,
						{ recursive: true },
						(err) => {
							if (err) reject(err);
							resolve('');
						}
					);
				}
			});
		});
	}

	async archiveAndDownload(): Promise<any> {
		return new Promise((resolve, reject) => {
			{
				const id = uuidv4();
				const fileNameS = id + '_export.zip';
				this.idZip.next(fileNameS);

				const output = fs.createWriteStream(`${this._dirname}/${fileNameS}`);

				const archive = archiver('zip', {
					zlib: { level: 9 }
				});

				output.on('close', function () {
					resolve('');
				});

				output.on('end', function () {
					console.log('Data has been drained');
				});

				archive.on('warning', function (err) {
					if (err.code === 'ENOENT') {
						reject(err);
					} else {
						console.log('Unexpected error!');
					}
				});

				archive.on('error', function (err) {
					reject(err);
				});

				let id$ = '';
				this.idCsv.subscribe((idCsv) => {
					id$ = idCsv;
				});

				archive.pipe(output);
				archive.directory(`${this._dirname}/${id$}/csv`, false);
				archive.finalize();
			}
		});
	}

	async getAsCsv(
		item: IRepositoryModel<any>,
		where: { tenantId: string; }
	): Promise<any> {
		const conditions = {};
		if (item.tenantBase !== false) {
			conditions['where'] = {
				tenantId: where['tenantId']
			}
		}

		/*
		* Replace condition with default condition
		*/
		if (isNotEmpty(item.condition) && isNotEmpty(conditions['where'])) {
			const { condition: { replace = 'tenantId', column = 'id' } } = item;
			if (`${replace}` in conditions['where']) {
				delete conditions['where'][replace];
				conditions['where'][column] = where[replace];
			}
		}

		const { repository } = item;
		const nameFile = repository.metadata.tableName;

		const [items, count] = await repository.findAndCount(conditions);
		if (count > 0) {
			return await this.csvWriter(nameFile, items);
		}

		return false;
	}

	async csvWriter(
		filename: string,
		items: any[]
	): Promise<boolean | any> {
		return new Promise((resolve, reject) => {
			try {
				const createCsvWriter = csv.createObjectCsvWriter;
				const dataIn = [];
				const dataKeys = Object.keys(items[0]);

				for (const count of dataKeys) {
					dataIn.push({ id: count, title: count });
				}

				let id$ = '';
				this.idCsv.subscribe((id) => {
					id$ = id;
				});

				const csvWriter = createCsvWriter({
					path: `${this._dirname}/${id$}/csv/${filename}.csv`,
					header: dataIn
				});

				csvWriter.writeRecords(items).then(() => {
					resolve(items);
				});
			} catch (error) {
				reject(error)
			}
		});
	}

	async csvTemplateWriter(
		filename: string,
		columns: any
	): Promise<any> {
		if (columns) {
			return new Promise((resolve) => {
				const createCsvWriter = csv.createObjectCsvWriter;
				const dataIn = [];
				const dataKeys = columns;

				for (const count of dataKeys) {
					dataIn.push({ id: count, title: count });
				}

				let id$ = '';
				this.idCsv.subscribe((id) => {
					id$ = id;
				});

				const csvWriter = createCsvWriter({
					path: `${this._dirname}/${id$}/csv/${filename}.csv`,
					header: dataIn
				});

				csvWriter.writeRecords([]).then(() => {
					resolve('');
				});
			});
		}
		return false;
	}

	async downloadToUser(res): Promise<any> {
		return new Promise((resolve) => {
			let fileName = '';

			this.idZip.subscribe((filename) => {
				fileName = filename;
			});

			res.download(`${this._dirname}/${fileName}`);
			resolve('');
		});
	}

	async deleteCsvFiles(): Promise<any> {
		return new Promise((resolve) => {
			let id$ = '';

			this.idCsv.subscribe((id) => {
				id$ = id;
			});

			fs.access(`${this._dirname}/${id$}`, (error) => {
				if (!error) {
					fse.removeSync(`${this._dirname}/${id$}`);
					resolve('');
				} else {
					return null;
				}
			});
		});
	}
	async deleteArchive(): Promise<any> {
		return new Promise((resolve) => {
			let fileName = '';
			this.idZip.subscribe((fileName$) => {
				fileName = fileName$;
			});
			fs.access(`${this._dirname}/${fileName}`, (error) => {
				if (!error) {
					fse.removeSync(`${this._dirname}/${fileName}`);
					resolve('');
				} else {
					return null;
				}
			});
		});
	}

	async exportTables() {
		return new Promise(async (resolve, reject) => {
			try {
				for await (const item of this.repositories) {
					await this.getAsCsv(item, {
						tenantId: RequestContext.currentTenantId()
					});

					// export pivot relational tables
					if (isNotEmpty(item.relations)) {
						await this.exportRelationalTables(item, {
							tenantId: RequestContext.currentTenantId()
						});
					}
				}
				resolve(true);
			} catch (error) {
				reject(error)
			}
		});
	}

	async exportSpecificTables(names: string[]) {
		return new Promise(async (resolve, reject) => {
			try {
				for await (const item of this.repositories) {
					const nameFile = item.repository.metadata.tableName;
					if (names.includes(nameFile)) {
						await this.getAsCsv(item, {
							tenantId: RequestContext.currentTenantId()
						});

						// export pivot relational tables
						if (isNotEmpty(item.relations)) {
							await this.exportRelationalTables(item, {
								tenantId: RequestContext.currentTenantId()
							});
						}
					}
				}
				resolve(true);
			} catch (error) {
				reject(error)
			}
		});
	}

	/*
	* Export Many To Many Pivot Table Using TypeORM Relations
	*/
	async exportRelationalTables(
		entity: IRepositoryModel<any>,
		where: { tenantId: string; }
	) {
		const { repository, relations } = entity;
		const masterTable = repository.metadata.givenTableName as string;

		for await (const item of repository.metadata.manyToManyRelations) {
			const relation = relations.find((relation: IColumnRelationMetadata) => relation.joinTableName === item.joinTableName);
			if (relation) {
				const [joinColumn] = item.joinColumns as ColumnMetadata[];
				if (joinColumn) {
					const { entityMetadata, propertyName, referencedColumn } = joinColumn;

					const referenceColumn = referencedColumn.propertyName;
					const referenceTableName = entityMetadata.givenTableName;
					let sql = `
						SELECT
							${referenceTableName}.*
						FROM
							${referenceTableName}
						INNER JOIN ${masterTable}
							ON "${referenceTableName}"."${propertyName}" = "${masterTable}"."${referenceColumn}"
					`;
					if (entity.tenantBase !== false) {
						sql += ` WHERE "${masterTable}"."tenantId" = '${where['tenantId']}'`;
					}

					const items = await repository.manager.query(sql);
					if (isNotEmpty(items)) {
						await this.csvWriter(referenceTableName, items);
					}
				}
			}
		}
	}

	async exportSpecificTablesSchema() {
		return new Promise(async (resolve, reject) => {
			try {
				for await (const item of this.repositories) {
					const { repository, relations } = item;
					const nameFile = repository.metadata.tableName;
					const columns = repository.metadata.ownColumns.map((column: ColumnMetadata) => column.propertyName);

					await this.csvTemplateWriter(nameFile, columns);

					// export pivot relational tables
					if (isNotEmpty(relations)) {
						await this.exportRelationalTablesSchema(item);
					}
				}
				resolve(true);
			} catch (error) {
				reject(error)
			}
		});
	}

	async exportRelationalTablesSchema(
		entity: IRepositoryModel<any>,
	) {
		const { repository, relations } = entity;
		for await (const item of repository.metadata.manyToManyRelations) {
			const relation = relations.find((relation: IColumnRelationMetadata) => relation.joinTableName === item.joinTableName);
			if (relation) {
				const referenceTableName = item.junctionEntityMetadata.givenTableName;
				const columns = item.junctionEntityMetadata.columns.map((column: ColumnMetadata) => column.propertyName);

				await this.csvTemplateWriter(referenceTableName, columns);
			}
		}
	}

	/*
	 * Load all plugins entities for export data
	 */
	private async createDynamicInstanceForPluginEntities() {
		for await (const entity of getEntitiesFromPlugins(
			this.configService.plugins
		)) {
			if (!isFunction(entity)) {
				continue;
			}

			const className = camelCase(entity.name);
			const repository = this._connectionEntityManager.getRepository(entity);

			this[className] = repository;
			this.dynamicEntitiesClassMap.push({ repository });
		}
	}

	/*
	 * Load all entities repository after create instance
	 */
	private async registerCoreRepositories() {
		this.repositories = [
			{
				repository: this.typeOrmAccountingTemplateRepository
			},
			{
				repository: this.typeOrmActivityRepository
			},
			{
				repository: this.typeOrmAppointmentEmployeeRepository
			},
			{
				repository: this.typeOrmApprovalPolicyRepository
			},
			{
				repository: this.typeOrmAvailabilitySlotRepository
			},
			{
				repository: this.typeOrmCandidateRepository,
				relations: [
					{ joinTableName: 'candidate_department' },
					{ joinTableName: 'candidate_employment_type' },
					{ joinTableName: 'tag_candidate' }
				]
			},
			{
				repository: this.typeOrmCandidateCriterionsRatingRepository
			},
			{
				repository: this.typeOrmCandidateDocumentRepository
			},
			{
				repository: this.typeOrmCandidateEducationRepository
			},
			{
				repository: this.typeOrmCandidateExperienceRepository
			},
			{
				repository: this.typeOrmCandidateFeedbackRepository
			},
			{
				repository: this.typeOrmCandidateInterviewersRepository
			},
			{
				repository: this.typeOrmCandidateInterviewRepository
			},
			{
				repository: this.typeOrmCandidatePersonalQualitiesRepository
			},
			{
				repository: this.typeOrmCandidateSkillRepository
			},
			{
				repository: this.typeOrmCandidateSourceRepository
			},
			{
				repository: this.typeOrmCandidateTechnologiesRepository
			},
			{
				repository: this.typeOrmCustomSmtpRepository
			},
			{
				repository: this.typeOrmContactRepository
			},
			{
				repository: this.typeOrmCountryRepository,
				tenantBase: false
			},
			{
				repository: this.typeOrmCurrencyRepository,
				tenantBase: false
			},
			{
				repository: this.typeOrmDealRepository
			},
			{
				repository: this.typeOrmEmailHistoryRepository
			},
			{
				repository: this.typeOrmEmailTemplateRepository
			},
			{
				repository: this.typeOrmEmployeeAppointmentRepository
			},
			{
				repository: this.typeOrmEmployeeAwardRepository
			},
			{
				repository: this.typeOrmEmployeeLevelRepository,
				relations: [
					{ joinTableName: 'tag_organization_employee_level' }
				]
			},
			{
				repository: this.typeOrmEmployeeRecurringExpenseRepository
			},
			{
				repository: this.typeOrmEmployeeRepository,
				relations: [
					{ joinTableName: 'tag_employee' }
				]
			},
			{
				repository: this.typeOrmEmployeeSettingRepository
			},
			{
				repository: this.typeOrmEquipmentRepository,
				relations: [
					{ joinTableName: 'tag_equipment' }
				]
			},
			{
				repository: this.typeOrmEquipmentSharingRepository,
				relations: [
					{ joinTableName: 'equipment_shares_employees' },
					{ joinTableName: 'equipment_shares_teams' }
				]
			},
			{
				repository: this.typeOrmEquipmentSharingPolicyRepository
			},
			{
				repository: this.typeOrmEstimateEmailRepository
			},
			{
				repository: this.typeOrmEventTypeRepository,
				relations: [
					{ joinTableName: 'tag_event_type' }
				]
			},
			{
				repository: this.typeOrmExpenseCategoryRepository,
				relations: [
					{ joinTableName: 'tag_organization_expense_category' }
				]
			},
			{
				repository: this.typeOrmExpenseRepository,
				relations: [
					{ joinTableName: 'tag_expense' }
				]
			},
			{
				repository: this.typeOrmFeatureRepository,
				tenantBase: false
			},
			{
				repository: this.typeOrmFeatureOrganizationRepository
			},
			{
				repository: this.typeOrmGoalKPIRepository
			},
			{
				repository: this.typeOrmGoalKPITemplateRepository
			},
			{
				repository: this.typeOrmGoalRepository
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
			{
				repository: this.typeOrmIncomeRepository,
				relations: [
					{ joinTableName: 'tag_income' }
				]
			},
			{
				repository: this.typeOrmIntegrationEntitySettingRepository
			},
			{
				repository: this.typeOrmIntegrationEntitySettingTiedRepository
			},
			{
				repository: this.typeOrmIntegrationMapRepository
			},
			{
				repository: this.typeOrmIntegrationRepository,
				tenantBase: false,
				relations: [
					{ joinTableName: 'integration_integration_type' },
					{ joinTableName: 'tag_integration' }
				]
			},
			{
				repository: this.typeOrmIntegrationSettingRepository
			},
			{
				repository: this.typeOrmIntegrationTypeRepository,
				tenantBase: false
			},
			{
				repository: this.typeOrmIntegrationTenantRepository
			},
			{
				repository: this.typeOrmInviteRepository,
				relations: [
					{ joinTableName: 'invite_organization_contact' },
					{ joinTableName: 'invite_organization_department' },
					{ joinTableName: 'invite_organization_project' }
				]
			},
			{
				repository: this.typeOrmInvoiceEstimateHistoryRepository
			},
			{
				repository: this.typeOrmInvoiceItemRepository
			},
			{
				repository: this.typeOrmInvoiceRepository,
				relations: [
					{ joinTableName: 'tag_invoice' }
				]
			},
			{
				repository: this.typeOrmKeyResultRepository
			},
			{
				repository: this.typeOrmKeyResultTemplateRepository
			},
			{
				repository: this.typeOrmKeyResultUpdateRepository
			},
			{
				repository: this.typeOrmLanguageRepository,
				tenantBase: false
			},
			{
				repository: this.typeOrmOrganizationAwardRepository
			},
			{
				repository: this.typeOrmOrganizationContactRepository,
				relations: [
					{ joinTableName: 'organization_contact_employee' },
					{ joinTableName: 'tag_organization_contact' }
				]
			},
			{
				repository: this.typeOrmOrganizationDepartmentRepository,
				relations: [
					{ joinTableName: 'organization_department_employee' },
					{ joinTableName: 'tag_organization_department' }
				]
			},
			{
				repository: this.typeOrmOrganizationDocumentRepository
			},
			{
				repository: this.typeOrmOrganizationEmploymentTypeRepository,
				relations: [
					{ joinTableName: 'organization_employment_type_employee' },
					{ joinTableName: 'tag_organization_employment_type' }
				]
			},
			{
				repository: this.typeOrmOrganizationLanguageRepository
			},
			{
				repository: this.typeOrmOrganizationPositionRepository,
				relations: [
					{ joinTableName: 'tag_organization_position' }
				]
			},
			{
				repository: this.typeOrmOrganizationProjectRepository,
				relations: [
					{ joinTableName: 'organization_project_employee' },
					{ joinTableName: 'tag_organization_project' }
				]
			},
			{
				repository: this.typeOrmOrganizationRecurringExpenseRepository
			},
			{
				repository: this.typeOrmOrganizationRepository,
				relations: [
					{ joinTableName: 'tag_organization' }
				]
			},
			{
				repository: this.typeOrmOrganizationSprintRepository
			},
			{
				repository: this.typeOrmOrganizationTeamEmployeeRepository
			},
			{
				repository: this.typeOrmOrganizationTeamRepository,
				relations: [
					{ joinTableName: 'tag_organization_team' }
				]
			},
			{
				repository: this.typeOrmOrganizationVendorRepository,
				relations: [
					{ joinTableName: 'tag_organization_vendor' }
				]
			},
			{
				repository: this.typeOrmPaymentRepository,
				relations: [
					{ joinTableName: 'tag_payment' }
				]
			},
			{
				repository: this.typeOrmPipelineRepository
			},
			{
				repository: this.typeOrmProductCategoryRepository
			},
			{
				repository: this.typeOrmProductCategoryTranslationRepository
			},
			{
				repository: this.typeOrmProductOptionRepository
			},
			{
				repository: this.typeOrmProductOptionGroupRepository
			},
			{
				repository: this.typeOrmProductOptionGroupTranslationRepository
			},
			{
				repository: this.typeOrmProductOptionTranslationRepository
			},
			{
				repository: this.typeOrmProductRepository,
				relations: [
					{ joinTableName: 'product_gallery_item' },
					{ joinTableName: 'tag_product' }
				]
			},
			{
				repository: this.typeOrmProductTranslationRepository
			},
			{
				repository: this.typeOrmProductTypeRepository
			},
			{
				repository: this.typeOrmProductTypeTranslationRepository
			},
			{
				repository: this.typeOrmProductVariantPriceRepository
			},
			{
				repository: this.typeOrmProductVariantRepository,
				relations: [
					{ joinTableName: 'product_variant_options_product_option' }
				]
			},
			{
				repository: this.typeOrmProductVariantSettingRepository
			},
			{
				repository: this.typeOrmImageAssetRepository
			},
			{
				repository: this.typeOrmWarehouseRepository,
				relations: [
					{ joinTableName: 'tag_warehouse' }
				]
			},
			{
				repository: this.typeOrmMerchantRepository,
				relations: [
					{ joinTableName: 'warehouse_merchant' },
					{ joinTableName: 'tag_merchant' }
				]
			},
			{
				repository: this.typeOrmWarehouseProductRepository
			},
			{
				repository: this.typeOrmWarehouseProductVariantRepository
			},
			{
				repository: this.typeOrmProposalRepository,
				relations: [
					{ joinTableName: 'tag_proposal' }
				]
			},
			{
				repository: this.typeOrmReportCategoryRepository,
				tenantBase: false
			},
			{
				repository: this.typeOrmReportOrganizationRepository
			},
			{
				repository: this.typeOrmReportRepository,
				tenantBase: false
			},
			{
				repository: this.typeOrmRequestApprovalRepository,
				relations: [
					{ joinTableName: 'tag_request_approval' }
				]
			},
			{
				repository: this.typeOrmRequestApprovalEmployeeRepository
			},
			{
				repository: this.typeOrmRequestApprovalTeamRepository
			},
			{
				repository: this.typeOrmRolePermissionRepository
			},
			{
				repository: this.typeOrmRoleRepository
			},
			{
				repository: this.typeOrmScreenshotRepository
			},
			{
				repository: this.typeOrmSkillRepository,
				relations: [
					{ joinTableName: 'skill_employee' },
					{ joinTableName: 'skill_organization' }
				]
			},
			{
				repository: this.typeOrmPipelineStageRepository
			},
			{
				repository: this.typeOrmTagRepository
			},
			{
				repository: this.typeOrmTaskRepository,
				relations: [
					{ joinTableName: 'task_employee' },
					{ joinTableName: 'task_team' },
					{ joinTableName: 'tag_task' },
				]
			},
			{
				repository: this.typeOrmTenantRepository,
				condition: { column: 'id', replace: 'tenantId' }
			},
			{
				repository: this.typeOrmTenantSettingRepository
			},
			{
				repository: this.typeOrmTimeLogRepository,
				relations: [
					{ joinTableName: 'time_slot_time_logs' }
				]
			},
			{
				repository: this.typeOrmTimeOffPolicyRepository,
				relations: [
					{ joinTableName: 'time_off_policy_employee' }
				]
			},
			{
				repository: this.typeOrmTimeOffRequestRepository,
				relations: [
					{ joinTableName: 'time_off_request_employee' }
				]
			},
			{
				repository: this.typeOrmTimesheetRepository
			},
			{
				repository: this.typeOrmTimeSlotRepository
			},
			{
				repository: this.typeOrmTimeSlotMinuteRepository
			},
			{
				repository: this.typeOrmUserOrganizationRepository
			},
			{
				repository: this.typeOrmUserRepository
			},
			...this.dynamicEntitiesClassMap
		] as IRepositoryModel<any>[];
	}
}
