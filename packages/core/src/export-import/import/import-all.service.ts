import { Injectable, OnModuleInit } from '@nestjs/common';
import { getConnection, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
import * as fs from 'fs';
import * as unzipper from 'unzipper';
import * as csv from 'csv-parser';
import * as rimraf from 'rimraf';
import * as _ from 'lodash';
import * as path from 'path';
import { ConfigService } from '@gauzy/config';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { isFunction, isNotEmpty } from '@gauzy/common';
import { convertToDatetime } from './../../core/utils';
import { FileStorage } from './../../core/file-storage';
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
	ImageAsset,
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
	Merchant,
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
	ProductOptionGroup,
	ProductOptionGroupTranslation,
	ProductOptionTranslation,
	ProductTranslation,
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
import { RequestContext } from './../../core';
import { ImportRecordFieldMapperCommand, ImportRecordFirstOrCreateCommand } from './commands';
import { ImportRecordService } from './import-record.service';

export interface IColumnRelationMetadata {
	joinTableName: string;
}

export interface IRepositoryModel<T> {
	repository: Repository<T>;
	nameFile: string;
	tenantBase?: boolean;
	relations?: IColumnRelationMetadata[];
	conditions?: any;
	isMigrate?: boolean
	isRecord?: boolean
}

@Injectable()
export class ImportAllService implements OnModuleInit {
	
	private _dirname: string;
	private _extractPath: string;

	private dynamicEntitiesClassMap: IRepositoryModel<any>[] = [];
	private repositories: IRepositoryModel<any>[] = [];

	constructor(
		@InjectRepository(AccountingTemplate)
		private readonly accountingTemplateRepository: Repository<AccountingTemplate>,

		@InjectRepository(Activity)
		private readonly activityRepository: Repository<Activity>,

		@InjectRepository(AppointmentEmployee)
		private readonly appointmentEmployeesRepository: Repository<AppointmentEmployee>,

		@InjectRepository(ApprovalPolicy)
		private readonly approvalPolicyRepository: Repository<ApprovalPolicy>,

		@InjectRepository(AvailabilitySlot)
		private readonly availabilitySlotsRepository: Repository<AvailabilitySlot>,

		@InjectRepository(Candidate)
		private readonly candidateRepository: Repository<Candidate>,

		@InjectRepository(CandidateCriterionsRating)
		private readonly candidateCriterionsRatingRepository: Repository<CandidateCriterionsRating>,

		@InjectRepository(CandidateDocument)
		private readonly candidateDocumentRepository: Repository<CandidateDocument>,

		@InjectRepository(CandidateEducation)
		private readonly candidateEducationRepository: Repository<CandidateEducation>,

		@InjectRepository(CandidateExperience)
		private readonly candidateExperienceRepository: Repository<CandidateExperience>,

		@InjectRepository(CandidateFeedback)
		private readonly candidateFeedbackRepository: Repository<CandidateFeedback>,

		@InjectRepository(CandidateInterview)
		private readonly candidateInterviewRepository: Repository<CandidateInterview>,

		@InjectRepository(CandidateInterviewers)
		private readonly candidateInterviewersRepository: Repository<CandidateInterviewers>,

		@InjectRepository(CandidatePersonalQualities)
		private readonly candidatePersonalQualitiesRepository: Repository<CandidatePersonalQualities>,

		@InjectRepository(CandidateSkill)
		private readonly candidateSkillRepository: Repository<CandidateSkill>,

		@InjectRepository(CandidateSource)
		private readonly candidateSourceRepository: Repository<CandidateSource>,

		@InjectRepository(CandidateTechnologies)
		private readonly candidateTechnologiesRepository: Repository<CandidateTechnologies>,

		@InjectRepository(Contact)
		private readonly contactRepository: Repository<Contact>,

		@InjectRepository(CustomSmtp)
		private readonly customSmtpRepository: Repository<CustomSmtp>,

		@InjectRepository(Deal)
		private readonly dealRepository: Repository<Deal>,

		@InjectRepository(Email)
		private readonly emailRepository: Repository<Email>,

		@InjectRepository(EmailTemplate)
		private readonly emailTemplateRepository: Repository<EmailTemplate>,

		@InjectRepository(Employee)
		private readonly employeeRepository: Repository<Employee>,

		@InjectRepository(EmployeeAppointment)
		private readonly employeeAppointmentRepository: Repository<EmployeeAppointment>,

		@InjectRepository(EmployeeAward)
		private readonly employeeAwardRepository: Repository<EmployeeAward>,

		@InjectRepository(EmployeeProposalTemplate)
		private readonly employeeProposalTemplateRepository: Repository<EmployeeProposalTemplate>,

		@InjectRepository(EmployeeRecurringExpense)
		private readonly employeeRecurringExpenseRepository: Repository<EmployeeRecurringExpense>,

		@InjectRepository(EmployeeSetting)
		private readonly employeeSettingRepository: Repository<EmployeeSetting>,

		@InjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly employeeUpworkJobsSearchCriterionRepository: Repository<EmployeeUpworkJobsSearchCriterion>,

		@InjectRepository(Equipment)
		private readonly equipmentRepository: Repository<Equipment>,

		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<EquipmentSharing>,

		@InjectRepository(EquipmentSharingPolicy)
		private readonly equipmentSharingPolicyRepository: Repository<EquipmentSharingPolicy>,

		@InjectRepository(EstimateEmail)
		private readonly estimateEmailRepository: Repository<EstimateEmail>,

		@InjectRepository(EventType)
		private readonly eventTypeRepository: Repository<EventType>,

		@InjectRepository(Expense)
		private readonly expenseRepository: Repository<Expense>,

		@InjectRepository(ExpenseCategory)
		private readonly expenseCategoryRepository: Repository<ExpenseCategory>,

		@InjectRepository(Feature)
		private readonly featureRepository: Repository<Feature>,

		@InjectRepository(FeatureOrganization)
		private readonly featureOrganizationRepository: Repository<FeatureOrganization>,

		@InjectRepository(Goal)
		private readonly goalRepository: Repository<Goal>,

		@InjectRepository(GoalTemplate)
		private readonly goalTemplateRepository: Repository<GoalTemplate>,

		@InjectRepository(GoalKPI)
		private readonly goalKpiRepository: Repository<GoalKPI>,

		@InjectRepository(GoalKPITemplate)
		private readonly goalKpiTemplateRepository: Repository<GoalKPITemplate>,

		@InjectRepository(GoalTimeFrame)
		private readonly goalTimeFrameRepository: Repository<GoalTimeFrame>,

		@InjectRepository(GoalGeneralSetting)
		private readonly goalGeneralSettingRepository: Repository<GoalGeneralSetting>,

		@InjectRepository(Income)
		private readonly incomeRepository: Repository<Income>,

		@InjectRepository(Integration)
		private readonly integrationRepository: Repository<Integration>,

		@InjectRepository(IntegrationType)
		private readonly integrationTypeRepository: Repository<IntegrationType>,

		@InjectRepository(IntegrationEntitySetting)
		private readonly integrationEntitySettingRepository: Repository<IntegrationEntitySetting>,

		@InjectRepository(IntegrationEntitySettingTiedEntity)
		private readonly integrationEntitySettingTiedEntityRepository: Repository<IntegrationEntitySettingTiedEntity>,

		@InjectRepository(IntegrationMap)
		private readonly integrationMapRepository: Repository<IntegrationMap>,

		@InjectRepository(IntegrationSetting)
		private readonly integrationSettingRepository: Repository<IntegrationSetting>,

		@InjectRepository(IntegrationTenant)
		private readonly integrationTenantRepository: Repository<IntegrationTenant>,

		@InjectRepository(Invite)
		private readonly inviteRepository: Repository<Invite>,

		@InjectRepository(Invoice)
		private readonly invoiceRepository: Repository<Invoice>,

		@InjectRepository(InvoiceEstimateHistory)
		private readonly invoiceEstimateHistoryRepository: Repository<InvoiceEstimateHistory>,

		@InjectRepository(InvoiceItem)
		private readonly invoiceItemRepository: Repository<InvoiceItem>,

		@InjectRepository(JobPreset)
		private readonly jobPresetRepository: Repository<JobPreset>,

		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly jobPresetUpworkJobSearchCriterionRepository: Repository<JobPresetUpworkJobSearchCriterion>,

		@InjectRepository(JobSearchCategory)
		private readonly jobSearchCategoryRepository: Repository<JobSearchCategory>,

		@InjectRepository(JobSearchOccupation)
		private readonly jobSearchOccupationRepository: Repository<JobSearchOccupation>,

		@InjectRepository(KeyResult)
		private readonly keyResultRepository: Repository<KeyResult>,

		@InjectRepository(KeyResultTemplate)
		private readonly keyResultTemplateRepository: Repository<KeyResultTemplate>,

		@InjectRepository(KeyResultUpdate)
		private readonly keyResultUpdateRepository: Repository<KeyResultUpdate>,

		@InjectRepository(Organization)
		private readonly organizationRepository: Repository<Organization>,

		@InjectRepository(EmployeeLevel)
		private readonly employeeLevelRepository: Repository<EmployeeLevel>,

		@InjectRepository(OrganizationAwards)
		private readonly organizationAwardsRepository: Repository<OrganizationAwards>,

		@InjectRepository(OrganizationContact)
		private readonly organizationContactRepository: Repository<OrganizationContact>,

		@InjectRepository(OrganizationDepartment)
		private readonly organizationDepartmentRepository: Repository<OrganizationDepartment>,

		@InjectRepository(OrganizationDocuments)
		private readonly organizationDocumentRepository: Repository<OrganizationDocuments>,

		@InjectRepository(OrganizationEmploymentType)
		private readonly organizationEmploymentTypeRepository: Repository<OrganizationEmploymentType>,

		@InjectRepository(OrganizationLanguages)
		private readonly organizationLanguagesRepository: Repository<OrganizationLanguages>,

		@InjectRepository(OrganizationPositions)
		private readonly organizationPositionsRepository: Repository<OrganizationPositions>,

		@InjectRepository(OrganizationProject)
		private readonly organizationProjectsRepository: Repository<OrganizationProject>,

		@InjectRepository(OrganizationRecurringExpense)
		private readonly organizationRecurringExpenseRepository: Repository<OrganizationRecurringExpense>,

		@InjectRepository(OrganizationSprint)
		private readonly organizationSprintRepository: Repository<OrganizationSprint>,

		@InjectRepository(OrganizationTeam)
		private readonly organizationTeamRepository: Repository<OrganizationTeam>,

		@InjectRepository(OrganizationTeamEmployee)
		private readonly organizationTeamEmployeeRepository: Repository<OrganizationTeamEmployee>,

		@InjectRepository(OrganizationVendor)
		private readonly organizationVendorsRepository: Repository<OrganizationVendor>,

		@InjectRepository(Payment)
		private readonly paymentRepository: Repository<Payment>,

		@InjectRepository(Pipeline)
		private readonly pipelineRepository: Repository<Pipeline>,

		@InjectRepository(PipelineStage)
		private readonly pipelineStageRepository: Repository<PipelineStage>,

		@InjectRepository(Product)
		private readonly productRepository: Repository<Product>,

		@InjectRepository(ProductTranslation)
		private readonly productTranslationRepository: Repository<ProductTranslation>,

		@InjectRepository(ProductCategory)
		private readonly productCategoryRepository: Repository<ProductCategory>,

		@InjectRepository(ProductCategoryTranslation)
		private readonly productCategoryTranslationRepository: Repository<ProductCategoryTranslation>,

		@InjectRepository(ProductOption)
		private readonly productOptionRepository: Repository<ProductOption>,

		@InjectRepository(ProductOptionTranslation)
		private readonly productOptionTranslationRepository: Repository<ProductOptionTranslation>,

		@InjectRepository(ProductOptionGroup)
		private readonly productOptionGroupRepository: Repository<ProductOptionGroup>,

		@InjectRepository(ProductOptionGroupTranslation)
		private readonly productOptionGroupTranslationRepository: Repository<ProductOptionGroupTranslation>,

		@InjectRepository(ProductVariantSettings)
		private readonly productVariantSettingsRepository: Repository<ProductVariantSettings>,

		@InjectRepository(ProductType)
		private readonly productTypeRepository: Repository<ProductType>,

		@InjectRepository(ProductTypeTranslation)
		private readonly productTypeTranslationRepository: Repository<ProductTypeTranslation>,

		@InjectRepository(ProductVariant)
		private readonly productVariantRepository: Repository<ProductVariant>,

		@InjectRepository(ProductVariantPrice)
		private readonly productVariantPriceRepository: Repository<ProductVariantPrice>,

		@InjectRepository(ImageAsset)
		private readonly imageAssetRepository: Repository<ImageAsset>,

		@InjectRepository(Warehouse)
		private readonly warehouseRepository: Repository<Warehouse>,

		@InjectRepository(Merchant)
		private readonly merchantRepository: Repository<Merchant>,

		@InjectRepository(WarehouseProduct)
		private readonly warehouseProductRepository: Repository<WarehouseProduct>,

		@InjectRepository(WarehouseProductVariant)
		private readonly warehouseProductVariantRepository: Repository<WarehouseProductVariant>,

		@InjectRepository(Proposal)
		private readonly proposalRepository: Repository<Proposal>,

		@InjectRepository(Skill)
		private readonly skillRepository: Repository<Skill>,

		@InjectRepository(Screenshot)
		private readonly screenShotRepository: Repository<Screenshot>,

		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,

		@InjectRepository(RequestApprovalEmployee)
		private readonly requestApprovalEmployeeRepository: Repository<RequestApprovalEmployee>,

		@InjectRepository(RequestApprovalTeam)
		private readonly requestApprovalTeamRepository: Repository<RequestApprovalTeam>,

		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,

		@InjectRepository(RolePermissions)
		private readonly rolePermissionsRepository: Repository<RolePermissions>,

		@InjectRepository(Report)
		private readonly reportRepository: Repository<Report>,

		@InjectRepository(ReportCategory)
		private readonly reportCategoryRepository: Repository<ReportCategory>,

		@InjectRepository(ReportOrganization)
		private readonly reportOrganizationRepository: Repository<ReportOrganization>,

		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>,

		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>,

		@InjectRepository(TenantSetting)
		private readonly tenantSettingRepository: Repository<TenantSetting>,

		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,

		@InjectRepository(TimeSlotMinute)
		private readonly timeSlotMinuteRepository: Repository<TimeSlotMinute>,

		@InjectRepository(TimeOffRequest)
		private readonly timeOffRequestRepository: Repository<TimeOffRequest>,

		@InjectRepository(TimeOffPolicy)
		private readonly timeOffPolicyRepository: Repository<TimeOffPolicy>,

		@InjectRepository(User)
		private readonly userRepository: Repository<User>,

		@InjectRepository(UserOrganization)
		private readonly userOrganizationRepository: Repository<UserOrganization>,

		private readonly configService: ConfigService,
		private readonly commandBus: CommandBus,
		private readonly _importRecordService: ImportRecordService
	) {}

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
			const { repository, nameFile, tenantBase = true, isMigrate = true, isRecord = true } = item;
			const csvPath = path.join(this._extractPath, `${nameFile}.csv`);
			
			if (!fs.existsSync(csvPath)) {
				console.log(`File Does Not Exist, Skipping: ${nameFile}`);
				continue;
			}

			await new Promise((resolve, reject) => {
				try {
					/**
					* This will first collect all the data and then insert
					* If cleanup flag is set then it will also delete current tenant related data from the database table with CASCADE
					*/
					let results = [];
					fs.createReadStream(csvPath, 'utf8')
						.on('error', (error) => {
							reject(error);
						})
						.pipe(csv())
						.on('data', async (data) => {
							if (isRecord) {
								await this.mappedImportRecord(
									item, 
									data
								);
							}
							const row = await this.mappedFields(data);
							results.push(row);
						})
						.on('end', async () => {
							results = results.filter(isNotEmpty);
							if (results.length && isMigrate) {
								const masterTable = repository.metadata.tableName;
								if (cleanup) {
									try {
										let sql = `DELETE FROM ${masterTable}`; 
										if (tenantBase !== false) {
											sql += ` WHERE "${masterTable}"."tenantId" = '${tenantId}'`;
										}
										await repository.query(sql);
										console.log(`Success to clean up process for table: ${masterTable}`);
									} catch (error) {
										console.log(`Failed to clean up process for table: ${masterTable}`, error);
										reject(error);
									}
								}
								try {
									await repository.insert(results);
									console.log(`Success to inserts data for table: ${masterTable}`);
								} catch (error) {
									console.log(`Failed to inserts data for table: ${masterTable}`, error);
									reject(error);
								}
							}
							resolve(results);
						});
				} catch (error) {
					reject(error);
				}
			});
		}
	}

	async mappedImportRecord(
		item: IRepositoryModel<any>,
		row: any
	) { 
		const { repository, conditions } = item;
		const where = [];
		if (isNotEmpty(conditions) && conditions instanceof Array) {
			for (const condition of conditions) {
				where.push({
					[condition.column] : row[condition.column]
				});
			}
		}
		const desination = await this.commandBus.execute(
			new ImportRecordFieldMapperCommand(repository, where)
		);
		if (desination) {
			const entityType = repository.metadata.tableName;
			await this.commandBus.execute(
				new ImportRecordFirstOrCreateCommand({
					tenantId: RequestContext.currentTenantId(),
					sourceId: row.id,
					destinationId: desination.id,
					entityType
				})
			);
		}
	}

	/*
	 * Add missing timestamps fields here
	 */
	mappedFields(data: any) {
		if ('id' in data && isNotEmpty(data['id'])) {
			delete data['id'];
		}
		if ('tenantId' in data && isNotEmpty(data['tenantId'])) {
			data['tenantId'] = RequestContext.currentTenantId();
		}
		if ('createdAt' in data && isNotEmpty(data['createdAt'])) {
			data['createdAt'] = convertToDatetime(data['createdAt']);
		}
		if ('updatedAt' in data && isNotEmpty(data['updatedAt'])) {
			data['updatedAt'] = convertToDatetime(data['updatedAt']);
		}
		if ('recordedAt' in data && isNotEmpty(data['recordedAt'])) {
			data['recordedAt'] = convertToDatetime(data['recordedAt']);
		}
		if ('deletedAt' in data && isNotEmpty(data['deletedAt'])) {
			data['deletedAt'] = convertToDatetime(data['deletedAt']);
		}
		return data;
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
			const repository = getConnection().getRepository(entity);
			const tableName = repository.metadata.tableName;

			this[className] = repository;
			this.dynamicEntitiesClassMap.push({
				repository,
				nameFile: tableName
			});
		}
	}

	/*
	* Load all entities repository after create instance
	* Warning: Changing position here can be FATAL
	*/
	private async registerCoreRepositories() {
		this.repositories = [
			/**
			* These entities do not have any other dependency so need to be imported first
			*/
			{
				repository: this.reportCategoryRepository,
				nameFile: 'report_category',
				tenantBase: false,
				isMigrate: false,
				conditions: [ { column: 'name' } ]
			},
			{
				repository: this.reportRepository,
				nameFile: 'report',
				tenantBase: false,
				isMigrate: false,
				conditions: [ 
					{ column: 'name' }, 
					{ column: 'slug' } 
				]
			},
			// /**
			// * These entities need TENANT
			// */
			// {
			// 	repository: this.tenantSettingRepository,
			// 	nameFile: 'tenant_setting'
			// },
			// {
			// 	repository: this.roleRepository,
			// 	nameFile: 'role'
			// },
			// {
			// 	repository: this.rolePermissionsRepository,
			// 	nameFile: 'role_permission'
			// },
			// {
			// 	repository: this.organizationRepository,
			// 	nameFile: 'organization'
			// },
			// /**
			// * These entities need TENANT and ORGANIZATION
			// */
			// { 
			// 	repository: this.userRepository,
			// 	nameFile: 'user'
			// },
			// {
			// 	repository: this.userOrganizationRepository,
			// 	nameFile: 'user_organization'
			// },
			// {
			// 	repository: this.candidateRepository,
			// 	nameFile: 'candidate',
			// 	relations: [
			// 		{ joinTableName: 'candidate_department' },
			// 		{ joinTableName: 'candidate_employment_type' },
			// 	]
			// },
			// {
			// 	repository: this.contactRepository,
			// 	nameFile: 'contact',
			// },
			// {
			// 	repository: this.customSmtpRepository,
			// 	nameFile: 'custom_smtp'
			// },
			// {
			// 	repository: this.reportOrganizationRepository,
			// 	nameFile: 'report_organization'
			// },
			// {
			// 	repository: this.jobPresetRepository,
			// 	nameFile: 'job_preset'
			// },
			// {
			// 	repository: this.jobSearchCategoryRepository,
			// 	nameFile: 'job_search_category'
			// },
			// {
			// 	repository: this.jobSearchOccupationRepository,
			// 	nameFile: 'job_search_occupation'
			// },
			// {
			// 	repository: this.jobPresetUpworkJobSearchCriterionRepository,
			// 	nameFile: 'job_preset_upwork_job_search_criterion'
			// },
			// /**
			// * These entities need TENANT, ORGANIZATION & USER
			// */
			// {
			// 	repository: this.employeeRepository,
			// 	nameFile: 'employee',
			// 	relations: [
			// 		{ joinTableName: 'employee_job_preset' },
			// 	]
			// },
			// /**
			// * These entities need TENANT, ORGANIZATION & CANDIDATE
			// */
			// {
			// 	repository: this.candidateCriterionsRatingRepository,
			// 	nameFile: 'candidate_criterion_rating'
			// },
			// {
			// 	repository: this.candidateDocumentRepository,
			// 	nameFile: 'candidate_document'
			// },
			// {
			// 	repository: this.candidateEducationRepository,
			// 	nameFile: 'candidate_education'
			// },
			// {
			// 	repository: this.candidateExperienceRepository,
			// 	nameFile: 'candidate_experience'
			// },
			// {
			// 	repository: this.candidateFeedbackRepository,
			// 	nameFile: 'candidate_feedback'
			// },
			// {
			// 	repository: this.candidateInterviewersRepository,
			// 	nameFile: 'candidate_interviewer'
			// },
			// {
			// 	repository: this.candidateInterviewRepository,
			// 	nameFile: 'candidate_interview'
			// },
			// {
			// 	repository: this.candidatePersonalQualitiesRepository,
			// 	nameFile: 'candidate_personal_quality'
			// },
			// {
			// 	repository: this.candidateSkillRepository,
			// 	nameFile: 'candidate_skill'
			// },
			// {
			// 	repository: this.candidateSourceRepository,
			// 	nameFile: 'candidate_source'
			// },
			// {
			// 	repository: this.candidateTechnologiesRepository,
			// 	nameFile: 'candidate_technology'
			// },
			// /**
			// * These entities need TENANT and ORGANIZATION
			// */
			// {
			// 	repository: this.skillRepository,
			// 	nameFile: 'skill',
			// 	relations: [
			// 		{ joinTableName: 'skill_employee' },
			// 		{ joinTableName: 'skill_organization' }
			// 	]
			// },
			// {
			// 	repository: this.accountingTemplateRepository,
			// 	nameFile: 'accounting_template'
			// },
			// {
			// 	repository: this.activityRepository,
			// 	nameFile: 'activity'
			// },
			// {
			// 	repository: this.approvalPolicyRepository,
			// 	nameFile: 'approval_policy'
			// },
			// {
			// 	repository: this.availabilitySlotsRepository,
			// 	nameFile: 'availability_slot'
			// },
			// {
			// 	repository: this.appointmentEmployeesRepository,
			// 	nameFile: 'appointment_employee'
			// },
			// {
			// 	repository: this.dealRepository,
			// 	nameFile: 'deal'
			// },
			// /*
			// * Email & Template  
			// */
			// { 
			// 	repository: this.emailTemplateRepository,
			// 	nameFile: 'email_template'
			// },
			// {
			// 	repository: this.emailRepository,
			// 	nameFile: 'email'
			// },
			// {
			// 	repository: this.estimateEmailRepository,
			// 	nameFile: 'estimate_email'
			// },
			// /*
			// * Employee & Related Entities 
			// */
			// { 
			// 	repository: this.employeeAppointmentRepository,
			// 	nameFile: 'employee_appointment'
			// },
			// {
			// 	repository: this.employeeAwardRepository,
			// 	nameFile: 'employee_award'
			// },
			// {
			// 	repository: this.employeeProposalTemplateRepository,
			// 	nameFile: 'employee_proposal_template'
			// },
			// {
			// 	repository: this.employeeRecurringExpenseRepository,
			// 	nameFile: 'employee_recurring_expense'
			// },
			// {
			// 	repository: this.employeeSettingRepository,
			// 	nameFile: 'employee_setting'
			// },
			// {
			// 	repository: this.employeeUpworkJobsSearchCriterionRepository,
			// 	nameFile: 'employee_upwork_job_search_criterion'
			// },
			// {
			// 	repository: this.employeeLevelRepository,
			// 	nameFile: 'organization_employee_level'
			// },
			// /*
			// * Equipment & Related Entities 
			// */
			// { 
			// 	repository: this.equipmentSharingPolicyRepository,
			// 	nameFile: 'equipment_sharing_policy'
			// },
			// {
			// 	repository: this.equipmentRepository,
			// 	nameFile: 'equipment'
			// },
			// {
			// 	repository: this.equipmentSharingRepository,
			// 	nameFile: 'equipment_sharing',
			// 	relations: [
			// 		{ joinTableName: 'equipment_shares_employees' },
			// 		{ joinTableName: 'equipment_shares_teams' }
			// 	]
			// },
			// /*
			// * Event Type & Related Entities 
			// */
			// { 
			// 	repository: this.eventTypeRepository,
			// 	nameFile: 'event_type'
			// },
			// /*
			// * Expense & Related Entities 
			// */
			// {
			// 	repository: this.expenseCategoryRepository,
			// 	nameFile: 'expense_category'
			// },
			// {
			// 	repository: this.expenseRepository,
			// 	nameFile: 'expense'
			// },
			// /*
			// * Feature & Related Entities 
			// */
			// { 
			// 	repository: this.featureRepository,
			// 	nameFile: 'feature',
			// 	tenantBase: false,
			// 	isMigrate: false
			// },
			// {
			// 	repository: this.featureOrganizationRepository,
			// 	nameFile: 'feature_organization'
			// },
			// /*
			// * Goal KPI & Related Entities 
			// */
			// { 
			// 	repository: this.goalKpiRepository,
			// 	nameFile: 'goal_kpi'
			// },
			// {
			// 	repository: this.goalKpiTemplateRepository,
			// 	nameFile: 'goal_kpi_template'
			// },
			// {
			// 	repository: this.goalRepository,
			// 	nameFile: 'goal'
			// },
			// {
			// 	repository: this.goalTemplateRepository,
			// 	nameFile: 'goal_template'
			// },
			// {
			// 	repository: this.goalTimeFrameRepository,
			// 	nameFile: 'goal_time_frame'
			// },
			// {
			// 	repository: this.goalGeneralSettingRepository,
			// 	nameFile: 'goal_general_setting'
			// },
			// /*
			// * Income
			// */
			// { 
			// 	repository: this.incomeRepository,
			// 	nameFile: 'income'
			// },
			// /*
			// * Integration & Related Entities
			// */
			// {
			// 	repository: this.integrationRepository,
			// 	nameFile: 'integration',
			// 	tenantBase: false
			// },
			// {
			// 	repository: this.integrationTypeRepository,
			// 	nameFile: 'integration_type',
			// 	relations: [
			// 		{ joinTableName: 'integration_integration_type' }
			// 	]
			// },
			// {
			// 	repository: this.integrationEntitySettingRepository,
			// 	nameFile: 'integration_entity_setting'
			// },
			// {
			// 	repository: this.integrationEntitySettingTiedEntityRepository,
			// 	nameFile: 'integration_entity_setting_tied_entity'
			// },
			// {
			// 	repository: this.integrationMapRepository,
			// 	nameFile: 'integration_map'
			// },
			// {
			// 	repository: this.integrationSettingRepository,
			// 	nameFile: 'integration_setting'
			// },
			// {
			// 	repository: this.integrationTenantRepository,
			// 	nameFile: 'integration_tenant'
			// },
			// /*
			// * Invite & Related Entities
			// */
			// { 
			// 	repository: this.inviteRepository,
			// 	nameFile: 'invite',
			// 	relations: [
			// 		{ joinTableName: 'invite_organization_contact' },
			// 		{ joinTableName: 'invite_organization_department' },
			// 		{ joinTableName: 'invite_organization_project' }
			// 	]
			// },
			// /*
			// * Invoice & Related Entities
			// */
			// { 
			// 	repository: this.invoiceRepository,
			// 	nameFile: 'invoice'
			// },
			// {
			// 	repository: this.invoiceItemRepository,
			// 	nameFile: 'invoice_item'
			// },
			// {
			// 	repository: this.invoiceEstimateHistoryRepository,
			// 	nameFile: 'invoice_estimate_history'
			// },
			// /*
			// * Key Result & Related Entities
			// */
			// { 
			// 	repository: this.keyResultRepository,
			// 	nameFile: 'key_result'
			// },
			// {
			// 	repository: this.keyResultTemplateRepository,
			// 	nameFile: 'key_result_template'
			// },
			// {
			// 	repository: this.keyResultUpdateRepository,
			// 	nameFile: 'key_result_update'
			// },
			// /*
			// * Organization & Related Entities
			// */
			// { 
			// 	repository: this.organizationAwardsRepository,
			// 	nameFile: 'organization_award'
			// },
			// {
			// 	repository: this.organizationContactRepository,
			// 	nameFile: 'organization_contact',
			// 	relations: [
			// 		{ joinTableName: 'organization_contact_employee' }
			// 	]
			// },
			// {
			// 	repository: this.organizationDepartmentRepository,
			// 	nameFile: 'organization_department',
			// 	relations: [
			// 		{ joinTableName: 'organization_department_employee' }
			// 	]
			// },
			// {
			// 	repository: this.organizationDocumentRepository,
			// 	nameFile: 'organization_document'
			// },
			// {
			// 	repository: this.organizationEmploymentTypeRepository,
			// 	nameFile: 'organization_employment_type',
			// 	relations: [
			// 		{ joinTableName: 'organization_employment_type_employee' }
			// 	]
			// },
			// {
			// 	repository: this.organizationLanguagesRepository,
			// 	nameFile: 'organization_language'
			// },
			// {
			// 	repository: this.organizationPositionsRepository,
			// 	nameFile: 'organization_position'
			// },
			// {
			// 	repository: this.organizationProjectsRepository,
			// 	nameFile: 'organization_project',
			// 	relations: [
			// 		{ joinTableName: 'organization_project_employee' }
			// 	]
			// },
			// {
			// 	repository: this.organizationRecurringExpenseRepository,
			// 	nameFile: 'organization_recurring_expense'
			// },
			// {
			// 	repository: this.organizationSprintRepository,
			// 	nameFile: 'organization_sprint'
			// },
			// {
			// 	repository: this.organizationTeamEmployeeRepository,
			// 	nameFile: 'organization_team_employee'
			// },
			// {
			// 	repository: this.organizationTeamRepository,
			// 	nameFile: 'organization_team'
			// },
			// {
			// 	repository: this.organizationVendorsRepository,
			// 	nameFile: 'organization_vendor'
			// },
			// /*
			// * Pipeline & Stage Entities
			// */
			// { 
			// 	repository: this.pipelineRepository,
			// 	nameFile: 'pipeline'
			// },
			// {
			// 	repository: this.pipelineStageRepository,
			// 	nameFile: 'pipeline_stage'
			// },
			// /*
			// * Product & Related Entities
			// */
			// { 
			// 	repository: this.productCategoryRepository,
			// 	nameFile: 'product_category'
			// },
			// {
			// 	repository: this.productCategoryTranslationRepository,
			// 	nameFile: 'product_category_translation'
			// },
			// {
			// 	repository: this.productTypeRepository,
			// 	nameFile: 'product_type'
			// },
			// {
			// 	repository: this.productTypeTranslationRepository,
			// 	nameFile: 'product_type_translation'
			// },
			// {
			// 	repository: this.productOptionRepository,
			// 	nameFile: 'product_option'
			// },
			// {
			// 	repository: this.productOptionTranslationRepository,
			// 	nameFile: 'product_option_translation'
			// },
			// {
			// 	repository: this.productOptionGroupRepository,
			// 	nameFile: 'product_option_group'
			// },
			// {
			// 	repository: this.productOptionGroupTranslationRepository,
			// 	nameFile: 'product_option_group_translation'
			// },
			// {
			// 	repository: this.productRepository,
			// 	nameFile: 'product',
			// 	relations: [
			// 		{ joinTableName: 'product_gallery_item' }
			// 	]
			// },
			// {
			// 	repository: this.productTranslationRepository,
			// 	nameFile: 'product_translation'
			// },
			// {
			// 	repository: this.productVariantRepository,
			// 	nameFile: 'product_variant',
			// 	relations: [
			// 		{ joinTableName: 'product_variant_options_product_option' }
			// 	]
			// },
			// {
			// 	repository: this.productVariantPriceRepository,
			// 	nameFile: 'product_variant_price'
			// },
			// {
			// 	repository: this.productVariantSettingsRepository,
			// 	nameFile: 'product_variant_setting'
			// },
			// {
			// 	repository: this.warehouseRepository,
			// 	nameFile: 'warehouse'
			// },
			// {
			// 	repository: this.merchantRepository,
			// 	nameFile: 'merchant',
			// 	relations: [
			// 		{ joinTableName: 'warehouse_merchant' }
			// 	]
			// },
			// {
			// 	repository: this.warehouseProductRepository,
			// 	nameFile: 'warehouse_product'
			// },
			// {
			// 	repository: this.warehouseProductVariantRepository,
			// 	nameFile: 'warehouse_product_variant'
			// },
			// {
			// 	repository: this.imageAssetRepository,
			// 	nameFile: 'image_asset'
			// },
			// /*
			// * Proposal & Related Entities
			// */
			// {
			// 	repository: this.proposalRepository,
			// 	nameFile: 'proposal'
			// },
			// /*
			// * Payment & Related Entities
			// */
			// {
			// 	repository: this.paymentRepository,
			// 	nameFile: 'payment'
			// },
			// /*
			// * Request Approval & Related Entities
			// */
			// {
			// 	repository: this.requestApprovalRepository,
			// 	nameFile: 'request_approval'
			// },
			// {
			// 	repository: this.requestApprovalEmployeeRepository,
			// 	nameFile: 'request_approval_employee'
			// },
			// {
			// 	repository: this.requestApprovalTeamRepository,
			// 	nameFile: 'request_approval_team'
			// },
			// /*
			// * Tasks & Related Entities
			// */
			// {
			// 	repository: this.taskRepository,
			// 	nameFile: 'task',
			// 	relations: [
			// 		{ joinTableName: 'task_employee' },
			// 		{ joinTableName: 'task_team' },
			// 	]
			// },
			// /*
			// * Timesheet & Related Entities
			// */
			// {
			// 	repository: this.timeSheetRepository,
			// 	nameFile: 'timesheet'
			// },
			// {
			// 	repository: this.timeLogRepository,
			// 	nameFile: 'time_log',
			// 	relations: [
			// 		{ joinTableName: 'time_slot_time_logs' }
			// 	]
			// },
			// {
			// 	repository: this.timeSlotRepository,
			// 	nameFile: 'time_slot'
			// },
			// {
			// 	repository: this.timeSlotMinuteRepository,
			// 	nameFile: 'time_slot_minute'
			// },
			// {
			// 	repository: this.screenShotRepository,
			// 	nameFile: 'screenshot'
			// },
			// /*
			// * Timeoff & Related Entities
			// */
			// {
			// 	repository: this.timeOffPolicyRepository,
			// 	nameFile: 'time_off_policy',
			// 	relations: [
			// 		{ joinTableName: 'time_off_policy_employee' }
			// 	]
			// },
			// {
			// 	repository: this.timeOffRequestRepository,
			// 	nameFile: 'time_off_request',
			// 	relations: [
			// 		{ joinTableName: 'time_off_request_employee' }
			// 	]
			// },
			// /*
			// * Tag & Related Entities
			// */
			// {
			// 	repository: this.tagRepository,
			// 	nameFile: 'tag',
			// 	relations: [
			// 		{ joinTableName: 'tag_candidate' },
			// 		{ joinTableName: 'tag_employee' },
			// 		{ joinTableName: 'tag_equipment' },
			// 		{ joinTableName: 'tag_event_type' },
			// 		{ joinTableName: 'tag_expense' },
			// 		{ joinTableName: 'tag_income' },
			// 		{ joinTableName: 'tag_integration' },
			// 		{ joinTableName: 'tag_invoice' },
			// 		{ joinTableName: 'tag_merchant' },
			// 		{ joinTableName: 'tag_organization_contact' },
			// 		{ joinTableName: 'tag_organization_department' },
			// 		{ joinTableName: 'tag_organization_employee_level' },
			// 		{ joinTableName: 'tag_organization_employment_type' },
			// 		{ joinTableName: 'tag_organization_expense_category' },
			// 		{ joinTableName: 'tag_organization_position' },
			// 		{ joinTableName: 'tag_organization_project' },
			// 		{ joinTableName: 'tag_organization_team' },
			// 		{ joinTableName: 'tag_organization_vendor' },
			// 		{ joinTableName: 'tag_organization' },
			// 		{ joinTableName: 'tag_payment' },
			// 		{ joinTableName: 'tag_product' },
			// 		{ joinTableName: 'tag_proposal' },
			// 		{ joinTableName: 'tag_request_approval' },
			// 		{ joinTableName: 'tag_task' },
			// 		{ joinTableName: 'tag_warehouse' },
			// 	]
			// },
			...this.dynamicEntitiesClassMap
		] as IRepositoryModel<any>[];
	}
}
