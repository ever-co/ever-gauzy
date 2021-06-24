import { Injectable, OnModuleInit } from '@nestjs/common';
import { getConnection, getManager, InsertResult, IsNull, Repository } from 'typeorm';
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
	Language,
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
import {
	ImportEntityFieldMapOrCreateCommand,
	ImportRecordFindOrFailCommand,
	ImportRecordFirstOrCreateCommand
} from './commands';

export interface IColumnRelationMetadata {
	joinTableName: string;
}

export interface IRepositoryModel<T> {
	repository: Repository<T>;
	relations?: IColumnRelationMetadata[];
	fieldMapper?: any;

	// additional condition
	isStatic?: boolean;
	isMigrate?: boolean;
	isRecord?: boolean;
	isCheckRelation?: boolean;
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

		@InjectRepository(Language)
		private readonly languageRepository: Repository<Language>,

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
		private readonly organizationPositionRepository: Repository<OrganizationPositions>,

		@InjectRepository(OrganizationProject)
		private readonly organizationProjectRepository: Repository<OrganizationProject>,

		@InjectRepository(OrganizationRecurringExpense)
		private readonly organizationRecurringExpenseRepository: Repository<OrganizationRecurringExpense>,

		@InjectRepository(OrganizationSprint)
		private readonly organizationSprintRepository: Repository<OrganizationSprint>,

		@InjectRepository(OrganizationTeam)
		private readonly organizationTeamRepository: Repository<OrganizationTeam>,

		@InjectRepository(OrganizationTeamEmployee)
		private readonly organizationTeamEmployeeRepository: Repository<OrganizationTeamEmployee>,

		@InjectRepository(OrganizationVendor)
		private readonly organizationVendorRepository: Repository<OrganizationVendor>,

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
		private readonly commandBus: CommandBus
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
			
			const { repository, isStatic = false, isRecord = true, isMigrate = true } = item;
			const nameFile = repository.metadata.tableName;
			const csvPath = path.join(this._extractPath, `${nameFile}.csv`);
			const masterTable = repository.metadata.tableName;

			if (!fs.existsSync(csvPath)) {
				console.log(`File Does Not Exist, Skipping: ${nameFile}`);
				continue;
			}

			console.log(`Importing process start for table: ${masterTable}`);
			await new Promise(async (resolve, reject) => {
				try {
					/**
					* This will first collect all the data and then insert
					* If cleanup flag is set then it will also delete current tenant related data from the database table with CASCADE
					*/
					if (cleanup && isMigrate === true) {
						try {
							let sql = `DELETE FROM ${masterTable}`; 
							if (isStatic !== true) {
								sql += ` WHERE "${masterTable}"."tenantId" = '${tenantId}'`;
							}
							await repository.query(sql);
							console.log(`Success to clean up process for table: ${masterTable}`);
						} catch (error) {
							console.log(`Failed to clean up process for table: ${masterTable}`, error);
							reject(error);
						}
					}

					const results = [];
					const rstream = fs.createReadStream(csvPath, 'utf8').pipe(csv());
					rstream.on('data', async (data) => { results.push(data); });
					rstream.on('error', (error) => {
						console.log(`Failer to parse CSV for table: ${masterTable}`, error);
						reject(error);
					});
					rstream.on('end', async () => {
						for await (const data of results) {
							if ((isStatic) || (!isMigrate && isRecord)) {
								await this.mappedStaticImportRecord(
									item, 
									data
								);
								console.log(`Success to inserts import record for table: ${masterTable}`);
							} else if (isMigrate) {
								if (isNotEmpty(data)) {
									try {
										const raw = JSON.parse(JSON.stringify(data));
										const insert = await repository.insert(await this.mapFields(item, data)) as InsertResult;
										const desination = insert['identifiers'][0];

										if (isRecord) {
											await this.mappedImportRecord(
												item,
												desination, 
												raw
											);
										}
										console.log(`Success to inserts data for table: ${masterTable}`);
									} catch (error) {
										console.log(`Failed to inserts data for table: ${masterTable}`, error);
										reject(error);
									}
								}
							}
						}
						resolve(true);
					});
				} catch (error) {
					reject(error);
				}
			});
		}
	}

	/*
	* Map static tables import record before insert data
	*/
	async mappedStaticImportRecord(
		item: IRepositoryModel<any>,
		entity: any
	): Promise<any> { 
		return new Promise(async (resolve, reject) => {
			try {
				const { repository, fieldMapper, isRecord } = item;
				const raw = JSON.parse(JSON.stringify(entity));

				const where = [];
				if (isNotEmpty(fieldMapper) && fieldMapper instanceof Array) {
					for await (const item of fieldMapper) {
						where.push({ [item.column] : entity[item.column] });
					}
				}
				const desination = await this.commandBus.execute(
					new ImportEntityFieldMapOrCreateCommand(
						repository, 
						where, 
						await this.mapFields(item, entity)
					)
				);
				if (desination && isRecord) {
					await this.mappedImportRecord(
						item,
						desination, 
						raw
					);
				}
				resolve(true)
			} catch (error) {
				reject(error)
			}
		});
	}

	/*
	* Map import record after find or insert data
	*/
	async mappedImportRecord(
		item: IRepositoryModel<any>,
		desination: any,
		row: any
	): Promise<any> {
		return new Promise(async (resolve, reject) => {
			try {
				const { repository } = item;
				if (desination) {
					await this.commandBus.execute(
						new ImportRecordFirstOrCreateCommand({
							sourceId: row.id,
							destinationId: desination.id,
							entityType: repository.metadata.tableName
						})
					);
				}
				resolve(true);
			} catch (error) {
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
			const { record } = await this.commandBus.execute(
				new ImportRecordFindOrFailCommand({
					tenantId: RequestContext.currentTenantId(),
					sourceId: data['organizationId'],
					entityType: getManager().getRepository(Organization).metadata.tableName
				})
			);
			data['organizationId'] = record ? record.destinationId : IsNull().value;
		}
		return await this.mapTimeStampsFields(
			await this.mapRelationFields(item, data)
		);
	}
	
	/*
	* Map timestamps fields here
	*/
	async mapTimeStampsFields(data: any) {
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

	/*
	* Map relation fields here
	*/
	async mapRelationFields(
		item: IRepositoryModel<any>,
		data: any
	): Promise<any> {
		return new Promise(async (resolve, reject) => {
			try {
				const { fieldMapper = [], isCheckRelation } = item;
				if (isCheckRelation) {
					if (isNotEmpty(fieldMapper) && fieldMapper instanceof Array) {
						for await (const { column, entityType } of fieldMapper) {
							const { record } = await this.commandBus.execute(
								new ImportRecordFindOrFailCommand({ 
									tenantId: RequestContext.currentTenantId(),
									sourceId: data[column], 
									entityType 
								})
							);
							data[column] = record ? record.destinationId : IsNull().value; 
						}
					}
				}
				resolve(data);
			} catch (error) {
				console.log('Failed to map relation entity before insert', error);	
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
			const repository = getConnection().getRepository(entity);

			this[className] = repository;
			this.dynamicEntitiesClassMap.push({
				repository
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
			* These entities do not have any other dependency so need to be mapped first
			*/
			{
				repository: this.reportCategoryRepository,
				isStatic: true,
				fieldMapper: [ { column: 'name' } ]
			},
			{
				repository: this.reportRepository,
				isStatic: true,
				fieldMapper: [ { column: 'name' }, { column: 'slug' } ]
			},
			{
				repository: this.featureRepository,
				isStatic: true,
				fieldMapper:  [ { column: 'name' }, { column: 'code' } ]
			},
			{
				repository: this.languageRepository,
				isStatic: true,
				fieldMapper: [ { column: 'name' }, { column: 'code' } ]
			},
			{
				repository: this.integrationRepository,
				isStatic: true,
				fieldMapper: [ { column: 'name' } ]
			},
			{
				repository: this.integrationTypeRepository,
				isStatic: true,
				fieldMapper: [ { column: 'name' }, { column: 'groupName' } ],
				relations: [
					{ joinTableName: 'integration_integration_type' }
				]
			},
			/**
			* These entities need TENANT
			*/
			{
				repository: this.tenantSettingRepository,
			},
			{
				repository: this.roleRepository,
			},
			{
				repository: this.rolePermissionsRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'roleId', entityType: this.roleRepository.metadata.tableName }
				]
			},
			{
				repository: this.organizationRepository,
				isMigrate: false,
				fieldMapper:  [ { column: 'name' }, { column: 'profile_link' } ]
			},
			/**
			* These entities need TENANT and ORGANIZATION
			*/
			{ 
				repository: this.userRepository,
			 	isCheckRelation: true,
				fieldMapper: [
					{ column: 'roleId', entityType: this.roleRepository.metadata.tableName }
				]
			},
			{
				repository: this.userOrganizationRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'userId', entityType: this.userRepository.metadata.tableName }
				]
			},
			//Organization & Related Entities
			{
				repository: this.organizationPositionRepository,
			},
			{
				repository: this.organizationTeamRepository,
			},
			{ 
				repository: this.organizationAwardsRepository,
			},
			{
				repository: this.organizationVendorRepository,
			},
			{
				repository: this.organizationDepartmentRepository,
				relations: [
					{ joinTableName: 'organization_department_employee' }
				]
			},
			{
				repository: this.organizationDocumentRepository,
			},
			{
				repository: this.organizationLanguagesRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'languageId', entityType: this.languageRepository.metadata.tableName }
				]
			},
			{
				repository: this.organizationEmploymentTypeRepository,
				relations: [
					{ joinTableName: 'organization_employment_type_employee' }
				]
			},
			{
				repository: this.organizationContactRepository,
				relations: [
					{ joinTableName: 'organization_contact_employee' }
				]
			},
			{
				repository: this.organizationProjectRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'organizationContactId', entityType: this.organizationContactRepository.metadata.tableName }
				],
				relations: [
					{ joinTableName: 'organization_project_employee' }
				]
			},
			{
				repository: this.organizationSprintRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'projectId', entityType: this.organizationProjectRepository.metadata.tableName },
				]
			},
			{
				repository: this.organizationRecurringExpenseRepository,
			},
			{
				repository: this.contactRepository
			},
			{
				repository: this.customSmtpRepository,
			},
			{
				repository: this.reportOrganizationRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'reportId', entityType: this.reportRepository.metadata.tableName }
				]
			},
			{
				repository: this.jobPresetRepository,
			},
			{
				repository: this.jobSearchCategoryRepository,
			},
			{
				repository: this.jobSearchOccupationRepository,
			},
			{
				repository: this.jobPresetUpworkJobSearchCriterionRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'jobPresetId', entityType: this.jobPresetRepository.metadata.tableName },
					{ column: 'occupationId', entityType: this.jobSearchOccupationRepository.metadata.tableName },
					{ column: 'categoryId', entityType: this.jobSearchCategoryRepository.metadata.tableName }
				]
			},
			/**
			* These entities need TENANT, ORGANIZATION & USER
			*/
			{
				repository: this.employeeRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'userId', entityType: this.userRepository.metadata.tableName },
					{ column: 'contactId', entityType: this.contactRepository.metadata.tableName },
					{ column: 'organizationPositionId', entityType: this.organizationPositionRepository.metadata.tableName }
				],
				relations: [
					{ joinTableName: 'employee_job_preset' },
				]
			},
			/**
			* These entities need TENANT, ORGANIZATION & CANDIDATE
			*/
			{
				repository: this.candidateRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'organizationId', entityType: this.organizationRepository.metadata.tableName }
				],
				relations: [
					{ joinTableName: 'candidate_department' },
					{ joinTableName: 'candidate_employment_type' },
				]
			},
			{
				repository: this.candidateDocumentRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'candidateId', entityType: this.candidateRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidateEducationRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'candidateId', entityType: this.candidateRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidateSkillRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'candidateId', entityType: this.candidateRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidateSourceRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'candidateId', entityType: this.candidateRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidateInterviewRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'candidateId', entityType: this.candidateRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidateInterviewersRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'interviewId', entityType: this.candidateInterviewRepository.metadata.tableName },
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidateExperienceRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'candidateId', entityType: this.candidateRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidateFeedbackRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'candidateId', entityType: this.candidateRepository.metadata.tableName },
					{ column: 'interviewId', entityType: this.candidateInterviewRepository.metadata.tableName },
					{ column: 'interviewerId', entityType: this.candidateInterviewersRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidatePersonalQualitiesRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'interviewId', entityType: this.candidateInterviewRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidateTechnologiesRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'interviewId', entityType: this.candidateInterviewRepository.metadata.tableName }
				]
			},
			{
				repository: this.candidateCriterionsRatingRepository
			},
			/**
			* These entities need TENANT and ORGANIZATION
			*/
			{
				repository: this.skillRepository,
				relations: [
					{ joinTableName: 'skill_employee' },
					{ joinTableName: 'skill_organization' }
				]
			},
			{
				repository: this.accountingTemplateRepository,
			},
			{
				repository: this.approvalPolicyRepository,
			},
			{
				repository: this.availabilitySlotsRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName }
				]
			},
			{ 
				repository: this.employeeAppointmentRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName }
				]
			},
			{
				repository: this.appointmentEmployeesRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'employeeAppointmentId', entityType: this.employeeAppointmentRepository.metadata.tableName },
				]
			},
			/*
			* Email & Template  
			*/
			{ 
				repository: this.emailTemplateRepository,
			},
			{
				repository: this.emailRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'emailTemplateId', entityType: this.emailTemplateRepository.metadata.tableName },
					{ column: 'userId', entityType: this.userRepository.metadata.tableName },
				]
			},
			{
				repository: this.estimateEmailRepository,
			},
			/*
			* Employee & Related Entities 
			*/
			{
				repository: this.employeeAwardRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
				]
			},
			{
				repository: this.employeeProposalTemplateRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
				]
			},
			{
				repository: this.employeeRecurringExpenseRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
				]
			},
			{
				repository: this.employeeSettingRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
				]
			},
			{
				repository: this.employeeUpworkJobsSearchCriterionRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'jobPresetId', entityType: this.jobPresetRepository.metadata.tableName },
					{ column: 'occupationId', entityType: this.jobSearchOccupationRepository.metadata.tableName },
					{ column: 'categoryId', entityType: this.jobSearchCategoryRepository.metadata.tableName }
				]
			},
			{
				repository: this.employeeLevelRepository,
			},
			/*
			* Equipment & Related Entities 
			*/
			{ 
				repository: this.equipmentSharingPolicyRepository,
			},
			{
				repository: this.equipmentRepository,
			},
			{
				repository: this.equipmentSharingRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'equipmentId', entityType: this.equipmentRepository.metadata.tableName },
					{ column: 'equipmentSharingPolicyId', entityType: this.equipmentSharingPolicyRepository.metadata.tableName }
				],
				relations: [
					{ joinTableName: 'equipment_shares_employees' },
					{ joinTableName: 'equipment_shares_teams' }
				]
			},
			/*
			* Event Type & Related Entities 
			*/
			{ 
				repository: this.eventTypeRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName }
				]
			},
			/*
			* Invoice & Related Entities
			*/
			{ 
				repository: this.invoiceRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'organizationContactId', entityType: this.organizationContactRepository.metadata.tableName },
					{ column: 'fromOrganizationId', entityType: this.organizationRepository.metadata.tableName },
					{ column: 'toContactId', entityType: this.organizationContactRepository.metadata.tableName },
				]
			},
			{
				repository: this.invoiceItemRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'invoiceId', entityType: this.invoiceRepository.metadata.tableName },
					{ column: 'taskId', entityType: this.taskRepository.metadata.tableName },
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'projectId', entityType: this.organizationProjectRepository.metadata.tableName },
					{ column: 'productId', entityType: this.productRepository.metadata.tableName },
					{ column: 'expenseId', entityType: this.expenseRepository.metadata.tableName },
				]
			},
			{
				repository: this.invoiceEstimateHistoryRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'userId', entityType: this.userRepository.metadata.tableName },
					{ column: 'invoiceId', entityType: this.invoiceRepository.metadata.tableName },
				]
			},
			/*
			* Expense & Related Entities 
			*/
			{
				repository: this.expenseCategoryRepository,
			},
			{
				repository: this.expenseRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'vendorId', entityType: this.organizationVendorRepository.metadata.tableName },
					{ column: 'categoryId', entityType: this.expenseCategoryRepository.metadata.tableName },
					{ column: 'projectId', entityType: this.organizationProjectRepository.metadata.tableName }
				]
			},
			/*
			* Income
			*/
			{ 
				repository: this.incomeRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName }
				]
			},
			/*
			* Feature & Related Entities 
			*/
			{
				repository: this.featureOrganizationRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'featureId', entityType: this.featureRepository.metadata.tableName }
				]
			},
			/*
			* Key Result & Related Entities
			*/
			{ 
				repository: this.keyResultRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'projectId', entityType: this.organizationProjectRepository.metadata.tableName },
					{ column: 'taskId', entityType: this.taskRepository.metadata.tableName },
					{ column: 'leadId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'ownerId', entityType: this.employeeRepository.metadata.tableName },
				]
			},
			{
				repository: this.keyResultTemplateRepository,
			},
			{
				repository: this.keyResultUpdateRepository,
			},

			/*
			* Goal KPI & Related Entities 
			*/
			{ 
				repository: this.goalKpiRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'leadId', entityType: this.employeeRepository.metadata.tableName }
				]
			},
			{
				repository: this.goalKpiTemplateRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'leadId', entityType: this.employeeRepository.metadata.tableName }
				]
			},
			{
				repository: this.goalRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'alignedKeyResultId', entityType: this.keyResultRepository.metadata.tableName },
					{ column: 'ownerTeamId', entityType: this.organizationTeamRepository.metadata.tableName },
					{ column: 'ownerEmployeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'leadId', entityType: this.employeeRepository.metadata.tableName }
				]
			},
			{
				repository: this.goalTemplateRepository,
			},

			{
				repository: this.goalTimeFrameRepository,
			},
			{
				repository: this.goalGeneralSettingRepository,
			},
			/*
			* Integration & Related Entities
			*/
			{
				repository: this.integrationTenantRepository,
			},
			{
				repository: this.integrationSettingRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'integrationId', entityType: this.integrationTenantRepository.metadata.tableName }
				]
			},
			{
				repository: this.integrationMapRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'integrationId', entityType: this.integrationTenantRepository.metadata.tableName }
				]
			},
			{
				repository: this.integrationEntitySettingRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'integrationId', entityType: this.integrationTenantRepository.metadata.tableName }
				]
			},
			{
				repository: this.integrationEntitySettingTiedEntityRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'integrationEntitySettingId', entityType: this.integrationEntitySettingRepository.metadata.tableName }
				]
			},
			/*
			* Invite & Related Entities
			*/
			{ 
				repository: this.inviteRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'roleId', entityType: this.roleRepository.metadata.tableName },
					{ column: 'invitedById', entityType: this.userRepository.metadata.tableName },
					{ column: 'organizationContactId', entityType: this.organizationContactRepository.metadata.tableName }
				],
				relations: [
					{ joinTableName: 'invite_organization_contact' },
					{ joinTableName: 'invite_organization_department' },
					{ joinTableName: 'invite_organization_project' }
				]
			},
			{
				repository: this.organizationTeamEmployeeRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'organizationTeamId', entityType: this.organizationTeamRepository.metadata.tableName },
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'roleId', entityType: this.roleRepository.metadata.tableName }
				]
			},
			/*
			* Pipeline & Stage Entities
			*/
			{ 
				repository: this.pipelineRepository,
			},
			{
				repository: this.pipelineStageRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'pipelineId', entityType: this.pipelineRepository.metadata.tableName }
				]
			},
			{
				repository: this.dealRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'createdByUserId', entityType: this.userRepository.metadata.tableName },
					{ column: 'stageId', entityType: this.pipelineStageRepository.metadata.tableName },
					{ column: 'clientId', entityType: this.organizationContactRepository.metadata.tableName },
				]
			},
			/*
			* Product & Related Entities
			*/
			{ 
				repository: this.productCategoryRepository,
			},
			{
				repository: this.productCategoryTranslationRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'referenceId', entityType: this.productCategoryRepository.metadata.tableName }
				]
			},
			{
				repository: this.productTypeRepository,
			},
			{
				repository: this.productTypeTranslationRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'referenceId', entityType: this.productTypeRepository.metadata.tableName }
				]
			},
			{
				repository: this.productOptionGroupRepository,
			},
			{
				repository: this.productOptionRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'groupId', entityType: this.productOptionGroupRepository.metadata.tableName }
				]
			},
			{
				repository: this.productOptionTranslationRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'referenceId', entityType: this.productOptionRepository.metadata.tableName }
				]
			},
			{
				repository: this.productOptionGroupTranslationRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'referenceId', entityType: this.productOptionGroupRepository.metadata.tableName }
				]
			},
			{
				repository: this.imageAssetRepository
			},
			{
				repository: this.productRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'featuredImageId', entityType: this.imageAssetRepository.metadata.tableName },
					{ column: 'typeId', entityType: this.productTypeRepository.metadata.tableName },
					{ column: 'categoryId', entityType: this.productCategoryRepository.metadata.tableName },
				],
				relations: [
					{ joinTableName: 'product_gallery_item' }
				]
			},
			{
				repository: this.productTranslationRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'referenceId', entityType: this.productRepository.metadata.tableName }
				]
			},
			{
				repository: this.productVariantPriceRepository,
				isCheckRelation: true
			},
			{
				repository: this.productVariantSettingsRepository,
			},
			{
				repository: this.productVariantRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'productId', entityType: this.productRepository.metadata.tableName },
					{ column: 'imageId', entityType: this.imageAssetRepository.metadata.tableName },
					{ column: 'priceId', entityType: this.productVariantPriceRepository.metadata.tableName },
					{ column: 'settingsId', entityType: this.productVariantSettingsRepository.metadata.tableName }
				],
				relations: [
					{ joinTableName: 'product_variant_options_product_option' }
				]
			},
			{
				repository: this.warehouseRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'logoId', entityType: this.imageAssetRepository.metadata.tableName },
					{ column: 'contactId', entityType: this.contactRepository.metadata.tableName }
				]
			},
			{
				repository: this.merchantRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'logoId', entityType: this.imageAssetRepository.metadata.tableName },
					{ column: 'contactId', entityType: this.contactRepository.metadata.tableName }
				],
				relations: [
					{ joinTableName: 'warehouse_merchant' }
				]
			},
			{
				repository: this.warehouseProductRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'warehouseId', entityType: this.warehouseRepository.metadata.tableName },
					{ column: 'productId', entityType: this.productRepository.metadata.tableName }
				],
			},
			{
				repository: this.warehouseProductVariantRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'variantId', entityType: this.productVariantRepository.metadata.tableName },
					{ column: 'warehouseProductId', entityType: this.warehouseProductRepository.metadata.tableName }
				],
			},
			/*
			* Proposal & Related Entities
			*/
			{
				repository: this.proposalRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'organizationContactId', entityType: this.organizationContactRepository.metadata.tableName },
				]
			},
			/*
			* Payment & Related Entities
			*/
			{
				repository: this.paymentRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'invoiceId', entityType: this.invoiceRepository.metadata.tableName },
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'recordedById', entityType: this.userRepository.metadata.tableName },
					{ column: 'projectId', entityType: this.organizationProjectRepository.metadata.tableName },
					{ column: 'contactId', entityType: this.organizationContactRepository.metadata.tableName }
				]
			},
			/*
			* Request Approval & Related Entities
			*/
			{
				repository: this.requestApprovalRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'approvalPolicyId', entityType: this.approvalPolicyRepository.metadata.tableName }
				],
			},
			{
				repository: this.requestApprovalEmployeeRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'requestApprovalId', entityType: this.requestApprovalRepository.metadata.tableName },
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName }
				],
			},
			{
				repository: this.requestApprovalTeamRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'requestApprovalId', entityType: this.requestApprovalRepository.metadata.tableName },
					{ column: 'teamId', entityType: this.organizationTeamEmployeeRepository.metadata.tableName }
				],
			},
			/*
			* Tasks & Related Entities
			*/
			{
				repository: this.taskRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'projectId', entityType: this.organizationProjectRepository.metadata.tableName },
					{ column: 'creatorId', entityType: this.userRepository.metadata.tableName },
					{ column: 'organizationSprintId', entityType: this.organizationSprintRepository.metadata.tableName },
				],
				relations: [
					{ joinTableName: 'task_employee' },
					{ joinTableName: 'task_team' },
				]
			},
			/*
			* Timesheet & Related Entities
			*/
			{
				repository: this.timeSheetRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'approvedById', entityType: this.employeeRepository.metadata.tableName }
				],
			},
			{
				repository: this.timeLogRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'timesheetId', entityType: this.timeSheetRepository.metadata.tableName },
					{ column: 'projectId', entityType: this.organizationProjectRepository.metadata.tableName },
					{ column: 'taskId', entityType: this.taskRepository.metadata.tableName },
					{ column: 'organizationContactId', entityType: this.organizationContactRepository.metadata.tableName }
				],
				relations: [
					{ joinTableName: 'time_slot_time_logs' }
				]
			},
			{
				repository: this.timeSlotRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeeId', entityType: this.employeeRepository.metadata.tableName }
				]
			},
			{
				repository: this.timeSlotMinuteRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'timeSlotId', entityType: this.timeSlotRepository.metadata.tableName }
				]
			},
			{
				repository: this.screenShotRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'timeSlotId', entityType: this.timeSlotRepository.metadata.tableName }
				]
			},
			{
				repository: this.activityRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'employeId', entityType: this.employeeRepository.metadata.tableName },
					{ column: 'projectId', entityType: this.organizationProjectRepository.metadata.tableName },
					{ column: 'timeSlotId', entityType: this.timeSlotRepository.metadata.tableName },
					{ column: 'taskId', entityType: this.taskRepository.metadata.tableName }
				]
			},
			/*
			* Timeoff & Related Entities
			*/
			{
				repository: this.timeOffPolicyRepository,
				relations: [
					{ joinTableName: 'time_off_policy_employee' }
				]
			},
			{
				repository: this.timeOffRequestRepository,
				isCheckRelation: true,
				fieldMapper: [
					{ column: 'policyId', entityType: this.timeOffPolicyRepository.metadata.tableName }
				],
				relations: [
					{ joinTableName: 'time_off_request_employee' }
				]
			},
			/*
			* Tag & Related Entities
			*/
			{
				repository: this.tagRepository,
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