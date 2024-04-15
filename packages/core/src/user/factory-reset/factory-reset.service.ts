// Modified code from https://github.com/xmlking/ngx-starter-kit.
// MIT License, see https://github.com/xmlking/ngx-starter-kit/blob/develop/LICENSE
// Copyright (c) 2018 Sumanth Chinthagunta

import { ConfigService } from '@gauzy/config';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { RequestContext } from 'core';
import { Repository, In } from 'typeorm';
import { filter, map, some } from 'underscore';
import {
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
	CandidateSkill,
	CandidateSource,
	CandidateTechnologies,
	Contact,
	Deal,
	EmailHistory,
	Employee,
	EmployeeAppointment,
	EmployeeAward,
	EmployeeLevel,
	EmployeeRecurringExpense,
	EmployeeSetting,
	Equipment,
	EquipmentSharing,
	EstimateEmail,
	EventType,
	Expense,
	ExpenseCategory,
	FeatureOrganization,
	Goal,
	GoalKPI,
	GoalKPITemplate,
	GoalTemplate,
	GoalTimeFrame,
	Income,
	IntegrationEntitySetting,
	IntegrationEntitySettingTied,
	IntegrationMap,
	IntegrationSetting,
	IntegrationTenant,
	Invite,
	Invoice,
	InvoiceEstimateHistory,
	InvoiceItem,
	// JobPreset,
	// JobSearchCategory,
	// JobSearchOccupation,
	KeyResult,
	KeyResultTemplate,
	KeyResultUpdate,
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
	ProductOption,
	ProductVariant,
	ProductVariantPrice,
	ProductVariantSetting,
	Proposal,
	RequestApproval,
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
	User,
	UserOrganization
} from '../../core/entities/internal';
import { TypeOrmActivityRepository } from '../../time-tracking/activity/repository/type-orm-activity.repository';
import { MikroOrmActivityRepository } from '../../time-tracking/activity/repository/mikro-orm-activity.repository';
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
import { MikroOrmDealRepository } from '../../deal/repository/mikro-orm-deal.repository';
import { TypeOrmDealRepository } from '../../deal/repository/type-orm-deal.repository';
import { MikroOrmEmailHistoryRepository } from '../../email-history/repository/mikro-orm-email-history.repository';
import { TypeOrmEmailHistoryRepository } from '../../email-history/repository/type-orm-email-history.repository';
import { MikroOrmEmployeeAppointmentRepository } from '../../employee-appointment/repository/mikro-orm-employee-appointment.repository';
import { TypeOrmEmployeeAppointmentRepository } from '../../employee-appointment/repository/type-orm-employee-appointment.repository';
import { MikroOrmEmployeeAwardRepository } from '../../employee-award/repository/mikro-orm-employee-award.repository';
import { TypeOrmEmployeeAwardRepository } from '../../employee-award/repository/type-orm-employee-award.repository';
// import { MikroOrmJobSearchCategoryRepository } from '../../employee-job-preset/job-search-category/repository/mikro-orm-job-search-category.repository';
// import { TypeOrmJobSearchCategoryRepository } from '../../employee-job-preset/job-search-category/repository/type-orm-job-search-category.repository';
// import { MikroOrmJobSearchOccupationRepository } from '../../employee-job-preset/job-search-occupation/repository/mikro-orm-job-search-occupation.repository';
// import { TypeOrmJobSearchOccupationRepository } from '../../employee-job-preset/job-search-occupation/repository/type-orm-job-search-occupation.repository';
// import { MikroOrmJobPresetRepository } from '../../employee-job-preset/repository/mikro-orm-job-preset.repository';
// import { TypeOrmJobPresetRepository } from '../../employee-job-preset/repository/type-orm-job-preset.repository';
import { MikroOrmEmployeeLevelRepository } from '../../employee-level/repository/mikro-orm-employee-level.repository';
import { TypeOrmEmployeeLevelRepository } from '../../employee-level/repository/type-orm-employee-level.repository';
import { MikroOrmEmployeeRecurringExpenseRepository } from '../../employee-recurring-expense/repository/mikro-orm-employee-recurring-expense.repository';
import { TypeOrmEmployeeRecurringExpenseRepository } from '../../employee-recurring-expense/repository/type-orm-employee-recurring-expense.repository';
import { MikroOrmEmployeeSettingRepository } from '../../employee-setting/repository/mikro-orm-employee-setting.repository';
import { TypeOrmEmployeeSettingRepository } from '../../employee-setting/repository/type-orm-employee-setting.repository';
import { MikroOrmEmployeeRepository } from '../../employee/repository/mikro-orm-employee.repository';
import { TypeOrmEmployeeRepository } from '../../employee/repository/type-orm-employee.repository';
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
import { TypeOrmFeatureOrganizationRepository } from '../../feature/repository/type-orm-feature-organization.repository';
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
import { MikroOrmProductCategoryRepository } from '../../product-category/repository/mikro-orm-product-category.repository';
import { TypeOrmProductCategoryRepository } from '../../product-category/repository/type-orm-product-category.repository';
import { MikroOrmProductOptionRepository } from '../../product-option/repository/mikro-orm-product-option.repository';
import { TypeOrmProductOptionRepository } from '../../product-option/repository/type-orm-product-option.repository';
import { MikroOrmProductVariantSettingRepository } from '../../product-setting/repository/mikro-orm-product-setting.repository';
import { TypeOrmProductVariantSettingRepository } from '../../product-setting/repository/type-orm-product-setting.repository';
import { MikroOrmProductVariantPriceRepository } from '../../product-variant-price/repository/mikro-orm-product-variant-price.repository';
import { TypeOrmProductVariantPriceRepository } from '../../product-variant-price/repository/type-orm-product-variant-price.repository';
import { MikroOrmProductVariantRepository } from '../../product-variant/repository/mikro-orm-product-variant.repository';
import { TypeOrmProductVariantRepository } from '../../product-variant/repository/type-orm-product-variant.repository';
import { MikroOrmProductRepository } from '../../product/repository/mikro-orm-product.repository';
import { TypeOrmProductRepository } from '../../product/repository/type-orm-product.repository';
import { MikroOrmProposalRepository } from '../../proposal/repository/mikro-orm-proposal.repository';
import { TypeOrmProposalRepository } from '../../proposal/repository/type-orm-proposal.repository';
import { MikroOrmRequestApprovalRepository } from '../../request-approval/repository/mikro-orm-request-approval.repository';
import { TypeOrmRequestApprovalRepository } from '../../request-approval/repository/type-orm-request-approval.repository';
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
import { MikroOrmScreenshotRepository } from '../../time-tracking/screenshot/repository/mikro-orm-screenshot.repository';
import { TypeOrmScreenshotRepository } from '../../time-tracking/screenshot/repository/type-orm-screenshot.repository';
import { MikroOrmTimeLogRepository } from '../../time-tracking/time-log/repository/mikro-orm-time-log.repository';
import { TypeOrmTimeLogRepository } from '../../time-tracking/time-log/repository/type-orm-time-log.repository';
import { MikroOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/mikro-orm-time-slot.repository';
import { TypeOrmTimeSlotRepository } from '../../time-tracking/time-slot/repository/type-orm-time-slot.repository';
import { MikroOrmTimesheetRepository } from '../../time-tracking/timesheet/repository/mikro-orm-timesheet.repository';
import { TypeOrmTimesheetRepository } from '../../time-tracking/timesheet/repository/type-orm-timesheet.repository';
import { MikroOrmUserOrganizationRepository } from '../../user-organization/repository/mikro-orm-user-organization.repository';
import { TypeOrmUserOrganizationRepository } from '../../user-organization/repository/type-orm-user-organization.repository';
import { MikroOrmUserRepository } from '../../user/repository/mikro-orm-user.repository';
import { TypeOrmUserRepository } from '../../user/repository/type-orm-user.repository';

@Injectable()
export class FactoryResetService {
	repositories: Repository<any>[];

	constructor(
		@InjectRepository(Activity)
		private typeOrmActivityRepository: TypeOrmActivityRepository,

		private mikroOrmActivityRepository: MikroOrmActivityRepository,

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

		@InjectRepository(Deal)
		private typeOrmDealRepository: TypeOrmDealRepository,

		mikroOrmDealRepository: MikroOrmDealRepository,

		@InjectRepository(EmailHistory)
		private typeOrmEmailHistoryRepository: TypeOrmEmailHistoryRepository,

		mikroOrmEmailHistoryRepository: MikroOrmEmailHistoryRepository,

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

		@InjectRepository(Income)
		private typeOrmIncomeRepository: TypeOrmIncomeRepository,

		mikroOrmIncomeRepository: MikroOrmIncomeRepository,

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

		@InjectRepository(EmployeeLevel)
		private typeOrmEmployeeLevelRepository: TypeOrmEmployeeLevelRepository,

		mikroOrmEmployeeLevelRepository: MikroOrmEmployeeLevelRepository,

		@InjectRepository(OrganizationAward)
		private typeOrmOrganizationAwardRepository: TypeOrmOrganizationAwardRepository,

		mikroOrmOrganizationAwardRepository: MikroOrmOrganizationAwardRepository,

		@InjectRepository(Organization)
		private typeOrmOrganizationRepository: TypeOrmOrganizationRepository,

		mikroOrmOrganizationRepository: MikroOrmOrganizationRepository,

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

		@InjectRepository(ProductCategory)
		private typeOrmProductCategoryRepository: TypeOrmProductCategoryRepository,

		mikroOrmProductCategoryRepository: MikroOrmProductCategoryRepository,

		@InjectRepository(ProductOption)
		private typeOrmProductOptionRepository: TypeOrmProductOptionRepository,

		mikroOrmProductOptionRepository: MikroOrmProductOptionRepository,

		@InjectRepository(ProductVariantSetting)
		private typeOrmProductVariantSettingRepository: TypeOrmProductVariantSettingRepository,

		mikroOrmProductVariantSettingRepository: MikroOrmProductVariantSettingRepository,

		@InjectRepository(ProductVariant)
		private typeOrmProductVariantRepository: TypeOrmProductVariantRepository,

		mikroOrmProductVariantRepository: MikroOrmProductVariantRepository,

		@InjectRepository(ProductVariantPrice)
		private typeOrmProductVariantPriceRepository: TypeOrmProductVariantPriceRepository,

		mikroOrmProductVariantPriceRepository: MikroOrmProductVariantPriceRepository,

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

		@InjectRepository(Tag)
		private typeOrmTagRepository: TypeOrmTagRepository,

		mikroOrmTagRepository: MikroOrmTagRepository,

		@InjectRepository(Task)
		private typeOrmTaskRepository: TypeOrmTaskRepository,

		mikroOrmTaskRepository: MikroOrmTaskRepository,

		@InjectRepository(Timesheet)
		private typeOrmTimesheetRepository: TypeOrmTimesheetRepository,

		mikroOrmTimesheetRepository: MikroOrmTimesheetRepository,

		@InjectRepository(TimeLog)
		private typeOrmTimeLogRepository: TypeOrmTimeLogRepository,

		mikroOrmTimeLogRepository: MikroOrmTimeLogRepository,

		@InjectRepository(TimeSlot)
		private typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,

		mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,

		@InjectRepository(TimeOffRequest)
		private typeOrmTimeOffRequestRepository: TypeOrmTimeOffRequestRepository,

		mikroOrmTimeOffRequestRepository: MikroOrmTimeOffRequestRepository,

		@InjectRepository(TimeOffPolicy)
		private typeOrmTimeOffPolicyRepository: TypeOrmTimeOffPolicyRepository,

		mikroOrmTimeOffPolicyRepository: MikroOrmTimeOffPolicyRepository,

		@InjectRepository(TenantSetting)
		private typeOrmTenantSettingRepository: TypeOrmTenantSettingRepository,

		mikroOrmTenantSettingRepository: MikroOrmTenantSettingRepository,

		@InjectRepository(User)
		private typeOrmUserRepository: TypeOrmUserRepository,

		mikroOrmUserRepository: MikroOrmUserRepository,

		@InjectRepository(UserOrganization)
		private typeOrmUserOrganizationRepository: TypeOrmUserOrganizationRepository,

		mikroOrmUserOrganizationRepository: MikroOrmUserOrganizationRepository,

		private configService: ConfigService
	) { }

	async onModuleInit() {
		this.registerCoreRepositories();
	}

	async reset() {
		if (this.configService.get('demo') === true) {
			throw new ForbiddenException();
		}
		const userId = RequestContext.currentUserId();
		const tenantId = RequestContext.currentTenantId();

		const user = await this.typeOrmUserRepository.findOneBy({
			id: userId,
			tenantId
		});
		user.thirdPartyId = null;
		user.preferredLanguage = null;
		user.preferredComponentLayout = null;
		await this.typeOrmUserRepository.save(user);

		const oldOrganization: any = await this.typeOrmUserOrganizationRepository.findOne({
			order: {
				createdAt: 'ASC'
			},
			select: ['organizationId'],
			where: {
				userId: userId
			}
		});
		const organizations: any = await this.typeOrmUserOrganizationRepository.find({
			select: ['organizationId'],
			where: {
				userId: userId
			}
		});

		const allOrganizationsIds = map(organizations, (org) => {
			return org.organizationId;
		});
		const deleteOrganizationIds = filter(allOrganizationsIds, (organizationsId) => {
			return organizationsId != oldOrganization.organizationId;
		});

		const findInput = {
			organizationIds: allOrganizationsIds,
			tenantId: user.tenantId
		};

		await this.deleteSpecificTables(findInput);
		if (deleteOrganizationIds?.length > 0) {
			await this.typeOrmUserOrganizationRepository.delete({
				userId: userId,
				organizationId: In(deleteOrganizationIds),
				tenantId: user.tenantId
			});
			await this.typeOrmOrganizationRepository.delete({
				id: In(deleteOrganizationIds),
				tenantId: user.tenantId
			});
		}

		const firstOrganization = await this.typeOrmOrganizationRepository.findOneBy({
			id: oldOrganization.organizationId
		});

		return firstOrganization;
	}

	async deleteSpecificTables(findInput: { organizationIds: string[]; tenantId: string }) {
		for (let i = 0; i < this.repositories.length; i++) {
			await this.deleteRepository(this.repositories[i], findInput);
		}
		return;
	}

	async deleteRepository(
		repository: Repository<any>,
		findInput: {
			organizationIds: string[];
			tenantId: string;
		}
	): Promise<any> {
		let conditions: any = {};
		const columns = repository.metadata.ownColumns.map((column) => column.propertyName);
		const tenantId = some(columns, (column) => {
			return column === 'tenantId';
		});
		const organizationId = some(columns, (column) => {
			return column === 'organizationId';
		});

		if (tenantId && organizationId) {
			conditions = {
				tenantId: findInput['tenantId'],
				organizationId: In(findInput['organizationIds'])
			};
		}
		if (tenantId && !organizationId) {
			conditions = {
				tenantId: findInput['tenantId']
			};
		}
		return repository.delete(conditions);
	}

	private registerCoreRepositories() {
		this.repositories = [
			this.typeOrmTagRepository,
			this.typeOrmActivityRepository,
			this.typeOrmApprovalPolicyRepository,
			this.typeOrmAppointmentEmployeeRepository,
			this.typeOrmAvailabilitySlotRepository,
			this.typeOrmCandidateCriterionsRatingRepository,
			this.typeOrmCandidateDocumentRepository,
			this.typeOrmCandidateEducationRepository,
			this.typeOrmCandidateExperienceRepository,
			this.typeOrmCandidateFeedbackRepository,
			this.typeOrmCandidateInterviewersRepository,
			this.typeOrmCandidateInterviewRepository,
			this.typeOrmCandidateRepository,
			this.typeOrmCandidateSkillRepository,
			this.typeOrmCandidateSourceRepository,
			this.typeOrmCandidateTechnologiesRepository,
			this.typeOrmDealRepository,
			this.typeOrmKeyResultRepository,
			this.typeOrmKeyResultTemplateRepository,
			this.typeOrmKeyResultUpdateRepository,
			this.typeOrmGoalKPIRepository,
			this.typeOrmGoalKPITemplateRepository,
			this.typeOrmGoalRepository,
			this.typeOrmGoalTemplateRepository,
			this.typeOrmGoalTimeFrameRepository,
			this.typeOrmEmailHistoryRepository,
			this.typeOrmTimeLogRepository,
			this.typeOrmTimeOffPolicyRepository,
			this.typeOrmTimeOffRequestRepository,
			this.typeOrmTimesheetRepository,
			this.typeOrmTimeSlotRepository,
			this.typeOrmInvoiceItemRepository,
			this.typeOrmInvoiceEstimateHistoryRepository,
			this.typeOrmInvoiceRepository,
			this.typeOrmFeatureOrganizationRepository,
			// this.typeOrmJobPresetRepository,
			// this.typeOrmJobSearchCategoryRepository,
			// this.typeOrmJobSearchOccupationRepository,
			this.typeOrmEmployeeAppointmentRepository,
			this.typeOrmEmployeeAwardRepository,
			this.typeOrmEmployeeLevelRepository,
			this.typeOrmEmployeeRecurringExpenseRepository,
			this.typeOrmEmployeeRepository,
			this.typeOrmEmployeeSettingRepository,
			this.typeOrmEquipmentSharingRepository,
			this.typeOrmEquipmentRepository,
			this.typeOrmEstimateEmailRepository,
			this.typeOrmEventTypeRepository,
			this.typeOrmExpenseCategoryRepository,
			this.typeOrmExpenseRepository,
			this.typeOrmIncomeRepository,
			this.typeOrmIntegrationEntitySettingRepository,
			this.typeOrmIntegrationEntitySettingTiedRepository,
			this.typeOrmIntegrationMapRepository,
			this.typeOrmIntegrationSettingRepository,
			this.typeOrmIntegrationTenantRepository,
			this.typeOrmInviteRepository,
			this.typeOrmOrganizationAwardRepository,
			this.typeOrmOrganizationDepartmentRepository,
			this.typeOrmOrganizationDocumentRepository,
			this.typeOrmOrganizationEmploymentTypeRepository,
			this.typeOrmOrganizationLanguageRepository,
			this.typeOrmOrganizationPositionRepository,
			this.typeOrmOrganizationSprintRepository,
			this.typeOrmOrganizationTeamEmployeeRepository,
			this.typeOrmOrganizationTeamRepository,
			this.typeOrmOrganizationVendorRepository,
			this.typeOrmOrganizationRecurringExpenseRepository,
			this.typeOrmOrganizationProjectRepository,
			this.typeOrmOrganizationContactRepository,
			this.typeOrmProductCategoryRepository,
			this.typeOrmProductOptionRepository,
			this.typeOrmProductRepository,
			this.typeOrmProductVariantPriceRepository,
			this.typeOrmProductVariantRepository,
			this.typeOrmProductVariantSettingRepository,
			this.typeOrmPaymentRepository,
			this.typeOrmPipelineRepository,
			this.typeOrmProposalRepository,
			this.typeOrmRequestApprovalRepository,
			this.typeOrmScreenshotRepository,
			this.typeOrmSkillRepository,
			this.typeOrmPipelineStageRepository,
			this.typeOrmContactRepository,
			this.typeOrmTaskRepository,
			this.typeOrmTenantSettingRepository
		];
	}
}
