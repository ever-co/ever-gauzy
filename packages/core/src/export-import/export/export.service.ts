import { MikroInjectRepository } from '@gauzy/common';
import { EntityRepository } from '@mikro-orm/core';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectConnection, InjectRepository } from '@nestjs/typeorm';
import { Connection, Repository } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import * as _ from 'lodash';
import * as archiver from 'archiver';
import * as csv from 'csv-writer';
import * as fs from 'fs';
import * as path from 'path';
import * as fse from 'fs-extra';
import { ConfigService } from '@gauzy/config';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { isFunction, isNotEmpty } from '@gauzy/common';
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
	JobPreset,
	JobPresetUpworkJobSearchCriterion,
	JobSearchCategory,
	JobSearchOccupation,
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
		private readonly accountingTemplateRepository: Repository<AccountingTemplate>,
		@MikroInjectRepository(AccountingTemplate)
		private readonly mikroAccountingTemplateRepository: EntityRepository<AccountingTemplate>,

		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>,

		@MikroInjectRepository(Activity)
		private readonly mikroActivityRepository: EntityRepository<Activity>,

		@InjectRepository(AppointmentEmployee)
		private readonly appointmentEmployeesRepository: Repository<AppointmentEmployee>,

		@MikroInjectRepository(AppointmentEmployee)
		private readonly mikroAppointmentEmployeesRepository: EntityRepository<AppointmentEmployee>,

		@InjectRepository(ApprovalPolicy)
		private readonly approvalPolicyRepository: Repository<ApprovalPolicy>,

		@MikroInjectRepository(ApprovalPolicy)
		private readonly mikroApprovalPolicyRepository: EntityRepository<ApprovalPolicy>,

		@InjectRepository(AvailabilitySlot)
		private readonly availabilitySlotsRepository: Repository<AvailabilitySlot>,

		@MikroInjectRepository(AvailabilitySlot)
		private readonly mikroAvailabilitySlotsRepository: EntityRepository<AvailabilitySlot>,

		@InjectRepository(Candidate)
		private readonly candidateRepository: Repository<Candidate>,

		@MikroInjectRepository(Candidate)
		private readonly mikroCandidateRepository: EntityRepository<Candidate>,

		@InjectRepository(CandidateCriterionsRating)
		private readonly candidateCriterionsRatingRepository: Repository<CandidateCriterionsRating>,

		@MikroInjectRepository(CandidateCriterionsRating)
		private readonly mikroCandidateCriterionsRatingRepository: EntityRepository<CandidateCriterionsRating>,

		@InjectRepository(CandidateDocument)
		private readonly candidateDocumentRepository: Repository<CandidateDocument>,

		@MikroInjectRepository(CandidateDocument)
		private readonly mikroCandidateDocumentRepository: EntityRepository<CandidateDocument>,

		@InjectRepository(CandidateEducation)
		private readonly candidateEducationRepository: Repository<CandidateEducation>,

		@MikroInjectRepository(CandidateEducation)
		private readonly mikroCandidateEducationRepository: EntityRepository<CandidateEducation>,

		@InjectRepository(CandidateExperience)
		private readonly candidateExperienceRepository: Repository<CandidateExperience>,

		@MikroInjectRepository(CandidateExperience)
		private readonly mikroCandidateExperienceRepository: EntityRepository<CandidateExperience>,

		@InjectRepository(CandidateFeedback)
		private readonly candidateFeedbackRepository: Repository<CandidateFeedback>,

		@MikroInjectRepository(CandidateFeedback)
		private readonly mikroCandidateFeedbackRepository: EntityRepository<CandidateFeedback>,

		@InjectRepository(CandidateInterview)
		private readonly candidateInterviewRepository: Repository<CandidateInterview>,

		@MikroInjectRepository(CandidateInterview)
		private readonly mikroCandidateInterviewRepository: EntityRepository<CandidateInterview>,

		@InjectRepository(CandidateInterviewers)
		private readonly candidateInterviewersRepository: Repository<CandidateInterviewers>,

		@MikroInjectRepository(CandidateInterviewers)
		private readonly mikroCandidateInterviewersRepository: EntityRepository<CandidateInterviewers>,

		@InjectRepository(CandidatePersonalQualities)
		private readonly candidatePersonalQualitiesRepository: Repository<CandidatePersonalQualities>,

		@MikroInjectRepository(CandidatePersonalQualities)
		private readonly mikroCandidatePersonalQualitiesRepository: EntityRepository<CandidatePersonalQualities>,

		@InjectRepository(CandidateSkill)
		private readonly candidateSkillRepository: Repository<CandidateSkill>,

		@MikroInjectRepository(CandidateSkill)
		private readonly mikroCandidateSkillRepository: EntityRepository<CandidateSkill>,

		@InjectRepository(CandidateSource)
		private readonly candidateSourceRepository: Repository<CandidateSource>,

		@MikroInjectRepository(CandidateSource)
		private readonly mikroCandidateSourceRepository: EntityRepository<CandidateSource>,

		@InjectRepository(CandidateTechnologies)
		private readonly candidateTechnologiesRepository: Repository<CandidateTechnologies>,

		@MikroInjectRepository(CandidateTechnologies)
		private readonly mikroCandidateTechnologiesRepository: EntityRepository<CandidateTechnologies>,

		@InjectRepository(Contact)
		private readonly contactRepository: Repository<Contact>,

		@MikroInjectRepository(Contact)
		private readonly mikroContactRepository: EntityRepository<Contact>,

		@InjectRepository(Country)
		private readonly countryRepository: Repository<Country>,

		@MikroInjectRepository(Country)
		private readonly mikroCountryRepository: EntityRepository<Country>,

		@InjectRepository(Currency)
		private readonly currencyRepository: Repository<Currency>,

		@MikroInjectRepository(Currency)
		private readonly mikroCurrencyRepository: EntityRepository<Currency>,

		@InjectRepository(CustomSmtp)
		private readonly customSmtpRepository: Repository<CustomSmtp>,

		@MikroInjectRepository(CustomSmtp)
		private readonly mikroCustomSmtpRepository: EntityRepository<CustomSmtp>,

		@InjectRepository(Deal)
		private readonly dealRepository: Repository<Deal>,

		@MikroInjectRepository(Deal)
		private readonly mikroDealRepository: EntityRepository<Deal>,

		@InjectRepository(EmailHistory)
		private readonly emailHistoryRepository: Repository<EmailHistory>,

		@MikroInjectRepository(EmailHistory)
		private readonly mikroEmailHistoryRepository: EntityRepository<EmailHistory>,

		@InjectRepository(EmailTemplate)
		private readonly emailTemplateRepository: Repository<EmailTemplate>,

		@MikroInjectRepository(EmailTemplate)
		private readonly mikroEmailTemplateRepository: EntityRepository<EmailTemplate>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@MikroInjectRepository(Employee)
		private readonly mikroEmployeeRepository: EntityRepository<Employee>,

		@InjectRepository(EmployeeAppointment)
		private readonly employeeAppointmentRepository: Repository<EmployeeAppointment>,

		@MikroInjectRepository(EmployeeAppointment)
		private readonly mikroEmployeeAppointmentRepository: EntityRepository<EmployeeAppointment>,

		@InjectRepository(EmployeeAward)
		private readonly employeeAwardRepository: Repository<EmployeeAward>,

		@MikroInjectRepository(EmployeeAward)
		private readonly mikroEmployeeAwardRepository: EntityRepository<EmployeeAward>,

		@InjectRepository(EmployeeProposalTemplate)
		private readonly employeeProposalTemplateRepository: Repository<EmployeeProposalTemplate>,

		@MikroInjectRepository(EmployeeProposalTemplate)
		private readonly mikroEmployeeProposalTemplateRepository: EntityRepository<EmployeeProposalTemplate>,

		@InjectRepository(EmployeeRecurringExpense)
		private readonly employeeRecurringExpenseRepository: Repository<EmployeeRecurringExpense>,

		@MikroInjectRepository(EmployeeRecurringExpense)
		private readonly mikroEmployeeRecurringExpenseRepository: EntityRepository<EmployeeRecurringExpense>,

		@InjectRepository(EmployeeSetting)
		private readonly employeeSettingRepository: Repository<EmployeeSetting>,

		@MikroInjectRepository(EmployeeSetting)
		private readonly mikroEmployeeSettingRepository: EntityRepository<EmployeeSetting>,

		@InjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly employeeUpworkJobsSearchCriterionRepository: Repository<EmployeeUpworkJobsSearchCriterion>,

		@MikroInjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly mikroEmployeeUpworkJobsSearchCriterionRepository: EntityRepository<EmployeeUpworkJobsSearchCriterion>,

		@InjectRepository(Equipment)
		private readonly equipmentRepository: Repository<Equipment>,

		@MikroInjectRepository(Equipment)
		private readonly mikroEquipmentRepository: EntityRepository<Equipment>,

		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<EquipmentSharing>,

		@MikroInjectRepository(EquipmentSharing)
		private readonly mikroEquipmentSharingRepository: EntityRepository<EquipmentSharing>,

		@InjectRepository(EquipmentSharingPolicy)
		private readonly equipmentSharingPolicyRepository: Repository<EquipmentSharingPolicy>,

		@MikroInjectRepository(EquipmentSharingPolicy)
		private readonly mikroEquipmentSharingPolicyRepository: EntityRepository<EquipmentSharingPolicy>,

		@InjectRepository(EstimateEmail)
		private readonly estimateEmailRepository: Repository<EstimateEmail>,

		@MikroInjectRepository(EstimateEmail)
		private readonly mikroEstimateEmailRepository: EntityRepository<EstimateEmail>,

		@InjectRepository(EventType)
		private readonly eventTypeRepository: Repository<EventType>,

		@MikroInjectRepository(EventType)
		private readonly mikroEventTypeRepository: EntityRepository<EventType>,

		@InjectRepository(Expense)
		private readonly expenseRepository: Repository<Expense>,

		@MikroInjectRepository(Expense)
		private readonly mikroExpenseRepository: EntityRepository<Expense>,

		@InjectRepository(ExpenseCategory)
		private readonly expenseCategoryRepository: Repository<ExpenseCategory>,

		@MikroInjectRepository(ExpenseCategory)
		private readonly mikroExpenseCategoryRepository: EntityRepository<ExpenseCategory>,

		@InjectRepository(Feature)
		private readonly featureRepository: Repository<Feature>,

		@MikroInjectRepository(Feature)
		private readonly mikroFeatureRepository: EntityRepository<Feature>,

		@InjectRepository(FeatureOrganization)
		private readonly featureOrganizationRepository: Repository<FeatureOrganization>,

		@MikroInjectRepository(FeatureOrganization)
		private readonly mikroFeatureOrganizationRepository: EntityRepository<FeatureOrganization>,

		@InjectRepository(Goal)
		private readonly goalRepository: Repository<Goal>,

		@MikroInjectRepository(Goal)
		private readonly mikroGoalRepository: EntityRepository<Goal>,

		@InjectRepository(GoalTemplate)
		private readonly goalTemplateRepository: Repository<GoalTemplate>,

		@MikroInjectRepository(GoalTemplate)
		private readonly mikroGoalTemplateRepository: EntityRepository<GoalTemplate>,

		@InjectRepository(GoalKPI)
		private readonly goalKpiRepository: Repository<GoalKPI>,

		@MikroInjectRepository(GoalKPI)
		private readonly mikroGoalKpiRepository: EntityRepository<GoalKPI>,

		@InjectRepository(GoalKPITemplate)
		private readonly goalKpiTemplateRepository: Repository<GoalKPITemplate>,

		@MikroInjectRepository(GoalKPITemplate)
		private readonly mikroGoalKpiTemplateRepository: EntityRepository<GoalKPITemplate>,

		@InjectRepository(GoalTimeFrame)
		private readonly goalTimeFrameRepository: Repository<GoalTimeFrame>,

		@MikroInjectRepository(GoalTimeFrame)
		private readonly mikroGoalTimeFrameRepository: EntityRepository<GoalTimeFrame>,

		@InjectRepository(GoalGeneralSetting)
		private readonly goalGeneralSettingRepository: Repository<GoalGeneralSetting>,

		@MikroInjectRepository(GoalGeneralSetting)
		private readonly mikroGoalGeneralSettingRepository: EntityRepository<GoalGeneralSetting>,

		@InjectRepository(Income)
		private readonly incomeRepository: Repository<Income>,

		@MikroInjectRepository(Income)
		private readonly mikroIncomeRepository: EntityRepository<Income>,

		@InjectRepository(Integration)
		private readonly integrationRepository: Repository<Integration>,

		@MikroInjectRepository(Integration)
		private readonly mikroIntegrationRepository: EntityRepository<Integration>,

		@InjectRepository(IntegrationType)
		private readonly integrationTypeRepository: Repository<IntegrationType>,

		@MikroInjectRepository(IntegrationType)
		private readonly mikroIntegrationTypeRepository: EntityRepository<IntegrationType>,

		@InjectRepository(IntegrationEntitySetting)
		private readonly integrationEntitySettingRepository: Repository<IntegrationEntitySetting>,

		@MikroInjectRepository(IntegrationEntitySetting)
		private readonly mikroIntegrationEntitySettingRepository: EntityRepository<IntegrationEntitySetting>,

		@InjectRepository(IntegrationEntitySettingTied)
		private readonly integrationEntitySettingTiedRepository: Repository<IntegrationEntitySettingTied>,

		@MikroInjectRepository(IntegrationEntitySettingTied)
		private readonly mikroIntegrationEntitySettingTiedRepository: EntityRepository<IntegrationEntitySettingTied>,

		@InjectRepository(IntegrationMap)
		private readonly integrationMapRepository: Repository<IntegrationMap>,

		@MikroInjectRepository(IntegrationMap)
		private readonly mikroIntegrationMapRepository: EntityRepository<IntegrationMap>,

		@InjectRepository(IntegrationSetting)
		private readonly integrationSettingRepository: Repository<IntegrationSetting>,

		@MikroInjectRepository(IntegrationSetting)
		private readonly mikroIntegrationSettingRepository: EntityRepository<IntegrationSetting>,

		@InjectRepository(IntegrationTenant)
		private readonly integrationTenantRepository: Repository<IntegrationTenant>,

		@MikroInjectRepository(IntegrationTenant)
		private readonly mikroIntegrationTenantRepository: EntityRepository<IntegrationTenant>,

		@InjectRepository(Invite)
		private readonly inviteRepository: Repository<Invite>,

		@MikroInjectRepository(Invite)
		private readonly mikroInviteRepository: EntityRepository<Invite>,

		@InjectRepository(Invoice)
		private readonly invoiceRepository: Repository<Invoice>,

		@MikroInjectRepository(Invoice)
		private readonly mikroInvoiceRepository: EntityRepository<Invoice>,

		@InjectRepository(InvoiceEstimateHistory)
		private readonly invoiceEstimateHistoryRepository: Repository<InvoiceEstimateHistory>,

		@MikroInjectRepository(InvoiceEstimateHistory)
		private readonly mikroInvoiceEstimateHistoryRepository: EntityRepository<InvoiceEstimateHistory>,

		@InjectRepository(InvoiceItem)
		private readonly invoiceItemRepository: Repository<InvoiceItem>,

		@MikroInjectRepository(InvoiceItem)
		private readonly mikroInvoiceItemRepository: EntityRepository<InvoiceItem>,

		@InjectRepository(JobPreset)
		private readonly jobPresetRepository: Repository<JobPreset>,

		@MikroInjectRepository(JobPreset)
		private readonly mikroJobPresetRepository: EntityRepository<JobPreset>,

		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly jobPresetUpworkJobSearchCriterionRepository: Repository<JobPresetUpworkJobSearchCriterion>,

		@MikroInjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly mikroJobPresetUpworkJobSearchCriterionRepository: EntityRepository<JobPresetUpworkJobSearchCriterion>,

		@InjectRepository(JobSearchCategory)
		private readonly jobSearchCategoryRepository: Repository<JobSearchCategory>,

		@MikroInjectRepository(JobSearchCategory)
		private readonly mikroJobSearchCategoryRepository: EntityRepository<JobSearchCategory>,

		@InjectRepository(JobSearchOccupation)
		private readonly jobSearchOccupationRepository: Repository<JobSearchOccupation>,

		@MikroInjectRepository(JobSearchOccupation)
		private readonly mikroJobSearchOccupationRepository: EntityRepository<JobSearchOccupation>,

		@InjectRepository(KeyResult)
		private readonly keyResultRepository: Repository<KeyResult>,

		@MikroInjectRepository(KeyResult)
		private readonly mikroKeyResultRepository: EntityRepository<KeyResult>,

		@InjectRepository(KeyResultTemplate)
		private readonly keyResultTemplateRepository: Repository<KeyResultTemplate>,

		@MikroInjectRepository(KeyResultTemplate)
		private readonly mikroKeyResultTemplateRepository: EntityRepository<KeyResultTemplate>,

		@InjectRepository(KeyResultUpdate)
		private readonly keyResultUpdateRepository: Repository<KeyResultUpdate>,

		@MikroInjectRepository(KeyResultUpdate)
		private readonly mikroKeyResultUpdateRepository: EntityRepository<KeyResultUpdate>,

		@InjectRepository(Language)
		private readonly languageRepository: Repository<Language>,

		@MikroInjectRepository(Language)
		private readonly mikroLanguageRepository: EntityRepository<Language>,

		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>,

		@MikroInjectRepository(Organization)
		private readonly mikroOrganizationRepository: EntityRepository<Organization>,

		@InjectRepository(EmployeeLevel)
		private readonly employeeLevelRepository: Repository<EmployeeLevel>,

		@MikroInjectRepository(EmployeeLevel)
		private readonly mikroEmployeeLevelRepository: EntityRepository<EmployeeLevel>,

		@InjectRepository(OrganizationAward)
		private readonly organizationAwardRepository: Repository<OrganizationAward>,

		@MikroInjectRepository(OrganizationAward)
		private readonly mikroOrganizationAwardRepository: EntityRepository<OrganizationAward>,

		@InjectRepository(OrganizationContact)
		private readonly organizationContactRepository: Repository<OrganizationContact>,

		@MikroInjectRepository(OrganizationContact)
		private readonly mikroOrganizationContactRepository: EntityRepository<OrganizationContact>,

		@InjectRepository(OrganizationDepartment)
		private readonly organizationDepartmentRepository: Repository<OrganizationDepartment>,

		@MikroInjectRepository(OrganizationDepartment)
		private readonly mikroOrganizationDepartmentRepository: EntityRepository<OrganizationDepartment>,

		@InjectRepository(OrganizationDocument)
		private readonly organizationDocumentRepository: Repository<OrganizationDocument>,

		@MikroInjectRepository(OrganizationDocument)
		private readonly mikroOrganizationDocumentRepository: EntityRepository<OrganizationDocument>,

		@InjectRepository(OrganizationEmploymentType)
		private readonly organizationEmploymentTypeRepository: Repository<OrganizationEmploymentType>,

		@MikroInjectRepository(OrganizationEmploymentType)
		private readonly mikroOrganizationEmploymentTypeRepository: EntityRepository<OrganizationEmploymentType>,

		@InjectRepository(OrganizationLanguage)
		private readonly organizationLanguageRepository: Repository<OrganizationLanguage>,

		@MikroInjectRepository(OrganizationLanguage)
		private readonly mikroOrganizationLanguageRepository: EntityRepository<OrganizationLanguage>,

		@InjectRepository(OrganizationPosition)
		private readonly organizationPositionRepository: Repository<OrganizationPosition>,

		@MikroInjectRepository(OrganizationPosition)
		private readonly mikroOrganizationPositionRepository: EntityRepository<OrganizationPosition>,

		@InjectRepository(OrganizationProject)
		private readonly organizationProjectsRepository: Repository<OrganizationProject>,

		@MikroInjectRepository(OrganizationProject)
		private readonly mikroOrganizationProjectsRepository: EntityRepository<OrganizationProject>,

		@InjectRepository(OrganizationRecurringExpense)
		private readonly organizationRecurringExpenseRepository: Repository<OrganizationRecurringExpense>,

		@MikroInjectRepository(OrganizationRecurringExpense)
		private readonly mikroOrganizationRecurringExpenseRepository: EntityRepository<OrganizationRecurringExpense>,

		@InjectRepository(OrganizationSprint)
		private readonly organizationSprintRepository: Repository<OrganizationSprint>,

		@MikroInjectRepository(OrganizationSprint)
		private readonly mikroOrganizationSprintRepository: EntityRepository<OrganizationSprint>,

		@InjectRepository(OrganizationTeam)
		private readonly organizationTeamRepository: Repository<OrganizationTeam>,

		@MikroInjectRepository(OrganizationTeam)
		private readonly mikroOrganizationTeamRepository: EntityRepository<OrganizationTeam>,

		@InjectRepository(OrganizationTeamEmployee)
		private readonly organizationTeamEmployeeRepository: Repository<OrganizationTeamEmployee>,

		@MikroInjectRepository(OrganizationTeamEmployee)
		private readonly mikroOrganizationTeamEmployeeRepository: EntityRepository<OrganizationTeamEmployee>,

		@InjectRepository(OrganizationVendor)
		private readonly organizationVendorsRepository: Repository<OrganizationVendor>,

		@MikroInjectRepository(OrganizationVendor)
		private readonly mikroOrganizationVendorsRepository: EntityRepository<OrganizationVendor>,

		@InjectRepository(Payment)
		private readonly paymentRepository: Repository<Payment>,

		@MikroInjectRepository(Payment)
		private readonly mikroPaymentRepository: EntityRepository<Payment>,

		@InjectRepository(Pipeline)
		private readonly pipelineRepository: Repository<Pipeline>,

		@MikroInjectRepository(Pipeline)
		private readonly mikroPipelineRepository: EntityRepository<Pipeline>,

		@InjectRepository(PipelineStage)
		private readonly pipelineStageRepository: Repository<PipelineStage>,

		@MikroInjectRepository(PipelineStage)
		private readonly mikroPipelineStageRepository: EntityRepository<PipelineStage>,

		@InjectRepository(Product)
		private readonly productRepository: Repository<Product>,

		@MikroInjectRepository(Product)
		private readonly mikroProductRepository: EntityRepository<Product>,

		@InjectRepository(ProductTranslation)
		private readonly productTranslationRepository: Repository<ProductTranslation>,

		@MikroInjectRepository(ProductTranslation)
		private readonly mikroProductTranslationRepository: EntityRepository<ProductTranslation>,

		@InjectRepository(ProductCategory)
		private readonly productCategoryRepository: Repository<ProductCategory>,

		@MikroInjectRepository(ProductCategory)
		private readonly mikroProductCategoryRepository: EntityRepository<ProductCategory>,

		@InjectRepository(ProductCategoryTranslation)
		private readonly productCategoryTranslationRepository: Repository<ProductCategoryTranslation>,

		@MikroInjectRepository(ProductCategoryTranslation)
		private readonly mikroProductCategoryTranslationRepository: EntityRepository<ProductCategoryTranslation>,

		@InjectRepository(ProductOption)
		private readonly productOptionRepository: Repository<ProductOption>,

		@MikroInjectRepository(ProductOption)
		private readonly mikroProductOptionRepository: EntityRepository<ProductOption>,

		@InjectRepository(ProductOptionTranslation)
		private readonly productOptionTranslationRepository: Repository<ProductOptionTranslation>,

		@MikroInjectRepository(ProductOptionTranslation)
		private readonly mikroProductOptionTranslationRepository: EntityRepository<ProductOptionTranslation>,

		@InjectRepository(ProductOptionGroup)
		private readonly productOptionGroupRepository: Repository<ProductOptionGroup>,

		@MikroInjectRepository(ProductOptionGroup)
		private readonly mikroProductOptionGroupRepository: EntityRepository<ProductOptionGroup>,

		@InjectRepository(ProductOptionGroupTranslation)
		private readonly productOptionGroupTranslationRepository: Repository<ProductOptionGroupTranslation>,

		@MikroInjectRepository(ProductOptionGroupTranslation)
		private readonly mikroProductOptionGroupTranslationRepository: EntityRepository<ProductOptionGroupTranslation>,

		@InjectRepository(ProductVariantSetting)
		private readonly productVariantSettingRepository: Repository<ProductVariantSetting>,

		@MikroInjectRepository(ProductVariantSetting)
		private readonly mikroProductVariantSettingRepository: EntityRepository<ProductVariantSetting>,

		@InjectRepository(ProductType)
		private readonly productTypeRepository: Repository<ProductType>,

		@MikroInjectRepository(ProductType)
		private readonly mikroProductTypeRepository: EntityRepository<ProductType>,

		@InjectRepository(ProductTypeTranslation)
		private readonly productTypeTranslationRepository: Repository<ProductTypeTranslation>,

		@MikroInjectRepository(ProductTypeTranslation)
		private readonly mikroProductTypeTranslationRepository: EntityRepository<ProductTypeTranslation>,

		@InjectRepository(ProductVariant)
		private readonly productVariantRepository: Repository<ProductVariant>,

		@MikroInjectRepository(ProductVariant)
		private readonly mikroProductVariantRepository: EntityRepository<ProductVariant>,

		@InjectRepository(ProductVariantPrice)
		private readonly productVariantPriceRepository: Repository<ProductVariantPrice>,

		@MikroInjectRepository(ProductVariantPrice)
		private readonly mikroProductVariantPriceRepository: EntityRepository<ProductVariantPrice>,

		@InjectRepository(ImageAsset)
		private readonly imageAssetRepository: Repository<ImageAsset>,

		@MikroInjectRepository(ImageAsset)
		private readonly mikroImageAssetRepository: EntityRepository<ImageAsset>,

		@InjectRepository(Warehouse)
		private readonly warehouseRepository: Repository<Warehouse>,

		@MikroInjectRepository(Warehouse)
		private readonly mikroWarehouseRepository: EntityRepository<Warehouse>,

		@InjectRepository(Merchant)
		private readonly merchantRepository: Repository<Merchant>,

		@MikroInjectRepository(Merchant)
		private readonly mikroMerchantRepository: EntityRepository<Merchant>,

		@InjectRepository(WarehouseProduct)
		private readonly warehouseProductRepository: Repository<WarehouseProduct>,

		@MikroInjectRepository(WarehouseProduct)
		private readonly mikroWarehouseProductRepository: EntityRepository<WarehouseProduct>,

		@InjectRepository(WarehouseProductVariant)
		private readonly warehouseProductVariantRepository: Repository<WarehouseProductVariant>,

		@MikroInjectRepository(WarehouseProductVariant)
		private readonly mikroWarehouseProductVariantRepository: EntityRepository<WarehouseProductVariant>,

		@InjectRepository(Proposal)
		private readonly proposalRepository: Repository<Proposal>,

		@MikroInjectRepository(Proposal)
		private readonly mikroProposalRepository: EntityRepository<Proposal>,

		@InjectRepository(Skill)
		private readonly skillRepository: Repository<Skill>,

		@MikroInjectRepository(Skill)
		private readonly mikroSkillRepository: EntityRepository<Skill>,

		@InjectRepository(Screenshot)
		private readonly screenShotRepository: Repository<Screenshot>,

		@MikroInjectRepository(Screenshot)
		private readonly mikroScreenShotRepository: EntityRepository<Screenshot>,

		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,

		@MikroInjectRepository(RequestApproval)
		private readonly mikroRequestApprovalRepository: EntityRepository<RequestApproval>,

		@InjectRepository(RequestApprovalEmployee)
		private readonly requestApprovalEmployeeRepository: Repository<RequestApprovalEmployee>,

		@MikroInjectRepository(RequestApprovalEmployee)
		private readonly mikroRequestApprovalEmployeeRepository: EntityRepository<RequestApprovalEmployee>,

		@InjectRepository(RequestApprovalTeam)
		private readonly requestApprovalTeamRepository: Repository<RequestApprovalTeam>,

		@MikroInjectRepository(RequestApprovalTeam)
		private readonly mikroRequestApprovalTeamRepository: EntityRepository<RequestApprovalTeam>,

		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,

		@MikroInjectRepository(Role)
		private readonly mikroRoleRepository: EntityRepository<Role>,

		@InjectRepository(RolePermission)
		private readonly rolePermissionRepository: Repository<RolePermission>,

		@MikroInjectRepository(RolePermission)
		private readonly mikroRolePermissionRepository: EntityRepository<RolePermission>,

		@InjectRepository(Report)
		private readonly reportRepository: Repository<Report>,

		@MikroInjectRepository(Report)
		private readonly mikroReportRepository: EntityRepository<Report>,

		@InjectRepository(ReportCategory)
		private readonly reportCategoryRepository: Repository<ReportCategory>,

		@MikroInjectRepository(ReportCategory)
		private readonly mikroReportCategoryRepository: EntityRepository<ReportCategory>,

		@InjectRepository(ReportOrganization)
		private readonly reportOrganizationRepository: Repository<ReportOrganization>,

		@MikroInjectRepository(ReportOrganization)
		private readonly mikroReportOrganizationRepository: EntityRepository<ReportOrganization>,

		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>,

		@MikroInjectRepository(Tag)
		private readonly mikroTagRepository: EntityRepository<Tag>,

		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>,

		@MikroInjectRepository(Task)
		private readonly mikroTaskRepository: EntityRepository<Task>,

		@InjectRepository(Tenant)
		private readonly tenantRepository: Repository<Tenant>,

		@MikroInjectRepository(Tenant)
		private readonly mikroTenantRepository: EntityRepository<Tenant>,

		@InjectRepository(TenantSetting)
		private readonly tenantSettingRepository: Repository<TenantSetting>,

		@MikroInjectRepository(TenantSetting)
		private readonly mikroTenantSettingRepository: EntityRepository<TenantSetting>,

		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,

		@MikroInjectRepository(Timesheet)
		private readonly mikroTimeSheetRepository: EntityRepository<Timesheet>,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@MikroInjectRepository(TimeLog)
		private readonly mikroTimeLogRepository: EntityRepository<TimeLog>,

		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,

		@MikroInjectRepository(TimeSlot)
		private readonly mikroTimeSlotRepository: EntityRepository<TimeSlot>,

		@InjectRepository(TimeSlotMinute)
		private readonly timeSlotMinuteRepository: Repository<TimeSlotMinute>,

		@MikroInjectRepository(TimeSlotMinute)
		private readonly mikroTimeSlotMinuteRepository: EntityRepository<TimeSlotMinute>,

		@InjectRepository(TimeOffRequest)
		private readonly timeOffRequestRepository: Repository<TimeOffRequest>,

		@MikroInjectRepository(TimeOffRequest)
		private readonly mikroTimeOffRequestRepository: EntityRepository<TimeOffRequest>,

		@InjectRepository(TimeOffPolicy)
		private readonly timeOffPolicyRepository: Repository<TimeOffPolicy>,

		@MikroInjectRepository(TimeOffPolicy)
		private readonly mikroTimeOffPolicyRepository: EntityRepository<TimeOffPolicy>,

		@InjectRepository(User)
		private readonly userRepository: Repository<User>,

		@MikroInjectRepository(User)
		private readonly mikroUserRepository: EntityRepository<User>,

		@InjectRepository(UserOrganization)
		private readonly userOrganizationRepository: Repository<UserOrganization>,

		@MikroInjectRepository(UserOrganization)
		private readonly mikroUserOrganizationRepository: EntityRepository<UserOrganization>,

		@InjectConnection()
		private readonly dataSource: Connection,

		private readonly configService: ConfigService
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

			const className = _.camelCase(entity.name);
			const repository = this.dataSource.getRepository(entity);

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
				repository: this.accountingTemplateRepository
			},
			{
				repository: this.activityRepository
			},
			{
				repository: this.appointmentEmployeesRepository
			},
			{
				repository: this.approvalPolicyRepository
			},
			{
				repository: this.availabilitySlotsRepository
			},
			{
				repository: this.candidateRepository,
				relations: [
					{ joinTableName: 'candidate_department' },
					{ joinTableName: 'candidate_employment_type' },
					{ joinTableName: 'tag_candidate' }
				]
			},
			{
				repository: this.candidateCriterionsRatingRepository
			},
			{
				repository: this.candidateDocumentRepository
			},
			{
				repository: this.candidateEducationRepository
			},
			{
				repository: this.candidateExperienceRepository
			},
			{
				repository: this.candidateFeedbackRepository
			},
			{
				repository: this.candidateInterviewersRepository
			},
			{
				repository: this.candidateInterviewRepository
			},
			{
				repository: this.candidatePersonalQualitiesRepository
			},
			{
				repository: this.candidateSkillRepository
			},
			{
				repository: this.candidateSourceRepository
			},
			{
				repository: this.candidateTechnologiesRepository
			},
			{
				repository: this.customSmtpRepository
			},
			{
				repository: this.contactRepository
			},
			{
				repository: this.countryRepository,
				tenantBase: false
			},
			{
				repository: this.currencyRepository,
				tenantBase: false
			},
			{
				repository: this.dealRepository
			},
			{
				repository: this.emailHistoryRepository
			},
			{
				repository: this.emailTemplateRepository
			},
			{
				repository: this.employeeAppointmentRepository
			},
			{
				repository: this.employeeAwardRepository
			},
			{
				repository: this.employeeLevelRepository,
				relations: [
					{ joinTableName: 'tag_organization_employee_level' }
				]
			},
			{
				repository: this.employeeProposalTemplateRepository
			},
			{
				repository: this.employeeRecurringExpenseRepository
			},
			{
				repository: this.employeeRepository,
				relations: [
					{ joinTableName: 'employee_job_preset' },
					{ joinTableName: 'tag_employee' }
				]
			},
			{
				repository: this.employeeSettingRepository
			},
			{
				repository: this.employeeUpworkJobsSearchCriterionRepository
			},
			{
				repository: this.equipmentRepository,
				relations: [
					{ joinTableName: 'tag_equipment' }
				]
			},
			{
				repository: this.equipmentSharingRepository,
				relations: [
					{ joinTableName: 'equipment_shares_employees' },
					{ joinTableName: 'equipment_shares_teams' }
				]
			},
			{
				repository: this.equipmentSharingPolicyRepository
			},
			{
				repository: this.estimateEmailRepository
			},
			{
				repository: this.eventTypeRepository,
				relations: [
					{ joinTableName: 'tag_event_type' }
				]
			},
			{
				repository: this.expenseCategoryRepository,
				relations: [
					{ joinTableName: 'tag_organization_expense_category' }
				]
			},
			{
				repository: this.expenseRepository,
				relations: [
					{ joinTableName: 'tag_expense' }
				]
			},
			{
				repository: this.featureRepository,
				tenantBase: false
			},
			{
				repository: this.featureOrganizationRepository
			},
			{
				repository: this.goalKpiRepository
			},
			{
				repository: this.goalKpiTemplateRepository
			},
			{
				repository: this.goalRepository
			},
			{
				repository: this.goalTemplateRepository
			},
			{
				repository: this.goalTimeFrameRepository
			},
			{
				repository: this.goalGeneralSettingRepository
			},
			{
				repository: this.incomeRepository,
				relations: [
					{ joinTableName: 'tag_income' }
				]
			},
			{
				repository: this.integrationEntitySettingRepository
			},
			{
				repository: this.integrationEntitySettingTiedRepository
			},
			{
				repository: this.integrationMapRepository
			},
			{
				repository: this.integrationRepository,
				tenantBase: false,
				relations: [
					{ joinTableName: 'integration_integration_type' },
					{ joinTableName: 'tag_integration' }
				]
			},
			{
				repository: this.integrationSettingRepository
			},
			{
				repository: this.integrationTypeRepository,
				tenantBase: false
			},
			{
				repository: this.integrationTenantRepository
			},
			{
				repository: this.inviteRepository,
				relations: [
					{ joinTableName: 'invite_organization_contact' },
					{ joinTableName: 'invite_organization_department' },
					{ joinTableName: 'invite_organization_project' }
				]
			},
			{
				repository: this.invoiceEstimateHistoryRepository
			},
			{
				repository: this.invoiceItemRepository
			},
			{
				repository: this.invoiceRepository,
				relations: [
					{ joinTableName: 'tag_invoice' }
				]
			},
			{
				repository: this.jobPresetRepository
			},
			{
				repository: this.jobPresetUpworkJobSearchCriterionRepository
			},
			{
				repository: this.jobSearchCategoryRepository
			},
			{
				repository: this.jobSearchOccupationRepository
			},
			{
				repository: this.keyResultRepository
			},
			{
				repository: this.keyResultTemplateRepository
			},
			{
				repository: this.keyResultUpdateRepository
			},
			{
				repository: this.languageRepository,
				tenantBase: false
			},
			{
				repository: this.organizationAwardRepository
			},
			{
				repository: this.organizationContactRepository,
				relations: [
					{ joinTableName: 'organization_contact_employee' },
					{ joinTableName: 'tag_organization_contact' }
				]
			},
			{
				repository: this.organizationDepartmentRepository,
				relations: [
					{ joinTableName: 'organization_department_employee' },
					{ joinTableName: 'tag_organization_department' }
				]
			},
			{
				repository: this.organizationDocumentRepository
			},
			{
				repository: this.organizationEmploymentTypeRepository,
				relations: [
					{ joinTableName: 'organization_employment_type_employee' },
					{ joinTableName: 'tag_organization_employment_type' }
				]
			},
			{
				repository: this.organizationLanguageRepository
			},
			{
				repository: this.organizationPositionRepository,
				relations: [
					{ joinTableName: 'tag_organization_position' }
				]
			},
			{
				repository: this.organizationProjectsRepository,
				relations: [
					{ joinTableName: 'organization_project_employee' },
					{ joinTableName: 'tag_organization_project' }
				]
			},
			{
				repository: this.organizationRecurringExpenseRepository
			},
			{
				repository: this.organizationRepository,
				relations: [
					{ joinTableName: 'tag_organization' }
				]
			},
			{
				repository: this.organizationSprintRepository
			},
			{
				repository: this.organizationTeamEmployeeRepository
			},
			{
				repository: this.organizationTeamRepository,
				relations: [
					{ joinTableName: 'tag_organization_team' }
				]
			},
			{
				repository: this.organizationVendorsRepository,
				relations: [
					{ joinTableName: 'tag_organization_vendor' }
				]
			},
			{
				repository: this.paymentRepository,
				relations: [
					{ joinTableName: 'tag_payment' }
				]
			},
			{
				repository: this.pipelineRepository
			},
			{
				repository: this.productCategoryRepository
			},
			{
				repository: this.productCategoryTranslationRepository
			},
			{
				repository: this.productOptionRepository
			},
			{
				repository: this.productOptionGroupRepository
			},
			{
				repository: this.productOptionGroupTranslationRepository
			},
			{
				repository: this.productOptionTranslationRepository
			},
			{
				repository: this.productRepository,
				relations: [
					{ joinTableName: 'product_gallery_item' },
					{ joinTableName: 'tag_product' }
				]
			},
			{
				repository: this.productTranslationRepository
			},
			{
				repository: this.productTypeRepository
			},
			{
				repository: this.productTypeTranslationRepository
			},
			{
				repository: this.productVariantPriceRepository
			},
			{
				repository: this.productVariantRepository,
				relations: [
					{ joinTableName: 'product_variant_options_product_option' }
				]
			},
			{
				repository: this.productVariantSettingRepository
			},
			{
				repository: this.imageAssetRepository
			},
			{
				repository: this.warehouseRepository,
				relations: [
					{ joinTableName: 'tag_warehouse' }
				]
			},
			{
				repository: this.merchantRepository,
				relations: [
					{ joinTableName: 'warehouse_merchant' },
					{ joinTableName: 'tag_merchant' }
				]
			},
			{
				repository: this.warehouseProductRepository
			},
			{
				repository: this.warehouseProductVariantRepository
			},
			{
				repository: this.proposalRepository,
				relations: [
					{ joinTableName: 'tag_proposal' }
				]
			},
			{
				repository: this.reportCategoryRepository,
				tenantBase: false
			},
			{
				repository: this.reportOrganizationRepository
			},
			{
				repository: this.reportRepository,
				tenantBase: false
			},
			{
				repository: this.requestApprovalRepository,
				relations: [
					{ joinTableName: 'tag_request_approval' }
				]
			},
			{
				repository: this.requestApprovalEmployeeRepository
			},
			{
				repository: this.requestApprovalTeamRepository
			},
			{
				repository: this.rolePermissionRepository
			},
			{
				repository: this.roleRepository
			},
			{
				repository: this.screenShotRepository
			},
			{
				repository: this.skillRepository,
				relations: [
					{ joinTableName: 'skill_employee' },
					{ joinTableName: 'skill_organization' }
				]
			},
			{
				repository: this.pipelineStageRepository
			},
			{
				repository: this.tagRepository
			},
			{
				repository: this.taskRepository,
				relations: [
					{ joinTableName: 'task_employee' },
					{ joinTableName: 'task_team' },
					{ joinTableName: 'tag_task' },
				]
			},
			{
				repository: this.tenantRepository,
				condition: {
					column: 'id',
					replace: 'tenantId'
				}
			},
			{
				repository: this.tenantSettingRepository
			},
			{
				repository: this.timeLogRepository,
				relations: [
					{ joinTableName: 'time_slot_time_logs' }
				]
			},
			{
				repository: this.timeOffPolicyRepository,
				relations: [
					{ joinTableName: 'time_off_policy_employee' }
				]
			},
			{
				repository: this.timeOffRequestRepository,
				relations: [
					{ joinTableName: 'time_off_request_employee' }
				]
			},
			{
				repository: this.timeSheetRepository
			},
			{
				repository: this.timeSlotRepository
			},
			{
				repository: this.timeSlotMinuteRepository
			},
			{
				repository: this.userOrganizationRepository
			},
			{
				repository: this.userRepository
			},
			...this.dynamicEntitiesClassMap
		] as IRepositoryModel<any>[];
	}
}
