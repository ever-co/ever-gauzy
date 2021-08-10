import { Injectable, OnModuleInit } from '@nestjs/common';
import { getConnection, getManager, IsNull, Repository } from 'typeorm';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import { InjectRepository } from '@nestjs/typeorm';
import { CommandBus } from '@nestjs/cqrs';
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
	OrganizationDocument,
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
import { ImportEntityFieldMapOrCreateCommand } from './commands';
import { ImportRecordFindOrFailCommand, ImportRecordUpdateOrCreateCommand } from './../import-record';

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

		@InjectRepository(OrganizationDocument)
		private readonly organizationDocumentRepository: Repository<OrganizationDocument>,

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
					const rstream = fs.createReadStream(csvPath, 'utf8').pipe(csv());
					rstream.on('data', (data) => { results.push(data); });
					rstream.on('error', (error) => {
						console.log(chalk.red(`Failed to parse CSV for table: ${masterTable}`), error);
						reject(error);
					});
					rstream.on('end', async () => {
						results = results.filter(isNotEmpty);
						for await (const data of results) {
							try {
								if (isNotEmpty(data)) {
									await this.migrateImportEntityRecord(
										item, 
										data
									); 
									console.log(chalk.green(`Success to inserts data for table: ${masterTable}`));
								}
							} catch (error) {
								console.log(chalk.red(`Failed to inserts data for table: ${masterTable}`), error, data);
								reject(error);
							}
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
					const rstream = fs.createReadStream(csvPath, 'utf8').pipe(csv());
					rstream.on('data', (data) => { results.push(data); });
					rstream.on('error', (error) => {
						console.log(chalk.red(`Failed to parse CSV for table: ${joinTableName}`), error);
						reject(error);
					});
					rstream.on('end', async () => {
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
					for (const item of uniqueIdentifier) {
						where.push({ [item.column] : entity[item.column] });
					}
				}
				const desination = await this.commandBus.execute(
					new ImportEntityFieldMapOrCreateCommand(
						repository, 
						where, 
						await this.mapFields(item, entity),
						source.id
					)
				);
				if (desination) {
					await this.mappedImportRecord(
						item,
						desination, 
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
		desination: any,
		row: any
	): Promise<any> {
		const { repository } = item;
		const entityType = repository.metadata.tableName;

		return await new Promise(async (resolve, reject) => {
			try {
				if (desination) {
					await this.commandBus.execute(
						new ImportRecordUpdateOrCreateCommand({
							tenantId: RequestContext.currentTenantId(),
							sourceId: row.id,
							destinationId: desination.id,
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
				if (type.valueOf() === Date) {
					data[`${propertyName}`] = convertToDatetime(data[`${propertyName}`]);
				} else if (type === 'datetime') {
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
				uniqueIdentifier: [ { column: 'name' } ]
			},
			{
				repository: this.reportRepository,
				isStatic: true,
				uniqueIdentifier: [ { column: 'name' }, { column: 'slug' } ]
			},
			{
				repository: this.featureRepository,
				isStatic: true,
				uniqueIdentifier:  [ { column: 'name' }, { column: 'code' } ]
			},
			{
				repository: this.languageRepository,
				isStatic: true,
				uniqueIdentifier: [ { column: 'name' }, { column: 'code' } ]
			},
			{
				repository: this.integrationRepository,
				isStatic: true,
				uniqueIdentifier: [ { column: 'name' } ]
			},
			{
				repository: this.integrationTypeRepository,
				isStatic: true,
				uniqueIdentifier: [ { column: 'name' }, { column: 'groupName' } ],
				relations: [
					{ 
						joinTableName: 'integration_integration_type',
						isCheckRelation: true,
						foreignKeys: [
							{ column: 'integrationId', repository: this.integrationRepository },
							{ column: 'integrationTypeId', repository: this.integrationTypeRepository }
						]
					}
				]
			},
			/**
			* These entities need TENANT
			*/
			{
				repository: this.tenantSettingRepository
			},
			{
				repository: this.roleRepository
			},
			{
				repository: this.rolePermissionsRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'roleId', repository: this.roleRepository }
				]
			},
			{
				repository: this.organizationRepository
			},
			/**
			* These entities need TENANT and ORGANIZATION
			*/
			{ 
				repository: this.userRepository,
				isStatic: true,
			 	isCheckRelation: true,
				foreignKeys: [
					{ column: 'roleId', repository: this.roleRepository }
				]
			},
			{
				repository: this.userOrganizationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'userId', repository: this.userRepository }
				]
			},
			//Organization & Related Entities
			{
				repository: this.organizationPositionRepository
			},
			{
				repository: this.organizationTeamRepository
			},
			{ 
				repository: this.organizationAwardsRepository
			},
			{
				repository: this.organizationVendorRepository
			},
			{
				repository: this.organizationDepartmentRepository
			},
			{
				repository: this.organizationDocumentRepository
			},
			{
				repository: this.organizationLanguagesRepository
			},
			{
				repository: this.organizationEmploymentTypeRepository
			},
			{
				repository: this.organizationContactRepository
			},
			{
				repository: this.organizationProjectRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'organizationContactId', repository: this.organizationContactRepository }
				]
			},
			{
				repository: this.organizationSprintRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'projectId', repository: this.organizationProjectRepository }
				]
			},
			{
				repository: this.organizationRecurringExpenseRepository
			},
			{
				repository: this.contactRepository
			},
			{
				repository: this.customSmtpRepository
			},
			{
				repository: this.reportOrganizationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'reportId', repository: this.reportRepository }
				]
			},
			{
				repository: this.jobPresetRepository
			},
			{
				repository: this.jobSearchCategoryRepository
			},
			{
				repository: this.jobSearchOccupationRepository
			},
			{
				repository: this.jobPresetUpworkJobSearchCriterionRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'jobPresetId', repository: this.jobPresetRepository },
					{ column: 'occupationId', repository: this.jobSearchOccupationRepository },
					{ column: 'categoryId', repository: this.jobSearchCategoryRepository }
				]
			},
			/**
			* These entities need TENANT, ORGANIZATION & USER
			*/
			{
				repository: this.employeeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'userId', repository: this.userRepository },
					{ column: 'contactId', repository: this.contactRepository },
					{ column: 'organizationPositionId', repository: this.organizationPositionRepository }
				],
				relations: [
					{ joinTableName: 'employee_job_preset' },
					{
						joinTableName: 'organization_department_employee',
						foreignKeys: [
							{ column: 'organizationDepartmentId', repository: this.organizationDepartmentRepository },
							{ column: 'employeeId', repository: this.employeeRepository }
						]
					},
					{
						joinTableName: 'organization_employment_type_employee',
						foreignKeys: [
							{ column: 'organizationEmploymentTypeId', repository: this.organizationEmploymentTypeRepository },
							{ column: 'employeeId', repository: this.employeeRepository }
						]
					},
					{
						joinTableName: 'organization_contact_employee',
						foreignKeys: [
							{ column: 'organizationContactId', repository: this.organizationContactRepository },
							{ column: 'employeeId', repository: this.employeeRepository }
						]
					},
					{
						joinTableName: 'organization_project_employee',
						foreignKeys: [
							{ column: 'organizationProjectId', repository: this.organizationProjectRepository },
							{ column: 'employeeId', repository: this.employeeRepository }
						]
					}
				]
			},
			/**
			* These entities need TENANT, ORGANIZATION & CANDIDATE
			*/
			{
				repository: this.candidateRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'userId', repository: this.userRepository },
					{ column: 'organizationPositionId', repository: this.organizationPositionRepository }
				],
				relations: [
					{
						joinTableName: 'candidate_department',
						foreignKeys: [
							{ column: 'candidateId', repository: this.candidateRepository },
							{ column: 'organizationDepartmentId', repository: this.organizationDepartmentRepository }
						]
					},
					{
						joinTableName: 'candidate_employment_type',
						foreignKeys: [
							{ column: 'candidateId', repository: this.candidateRepository },
							{ column: 'organizationEmploymentTypeId', repository: this.organizationEmploymentTypeRepository }
						]
					}
				]
			},
			{
				repository: this.candidateDocumentRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.candidateRepository }
				]
			},
			{
				repository: this.candidateEducationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.candidateRepository }
				]
			},
			{
				repository: this.candidateSkillRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.candidateRepository }
				]
			},
			{
				repository: this.candidateSourceRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.candidateRepository }
				]
			},
			{
				repository: this.candidateInterviewRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.candidateRepository }
				]
			},
			{
				repository: this.candidateInterviewersRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'interviewId', repository: this.candidateInterviewRepository },
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			{
				repository: this.candidateExperienceRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.candidateRepository }
				]
			},
			{
				repository: this.candidateFeedbackRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'candidateId', repository: this.candidateRepository },
					{ column: 'interviewId', repository: this.candidateInterviewRepository },
					{ column: 'interviewerId', repository: this.candidateInterviewersRepository }
				]
			},
			{
				repository: this.candidatePersonalQualitiesRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'interviewId', repository: this.candidateInterviewRepository }
				]
			},
			{
				repository: this.candidateTechnologiesRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'interviewId', repository: this.candidateInterviewRepository }
				]
			},
			{
				repository: this.candidateCriterionsRatingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'feedbackId', repository: this.candidateFeedbackRepository },
					{ column: 'technologyId', repository: this.candidateTechnologiesRepository },
					{ column: 'personalQualityId', repository: this.candidatePersonalQualitiesRepository },
				]
			},
			/**
			* These entities need TENANT and ORGANIZATION
			*/
			{
				repository: this.skillRepository,
				uniqueIdentifier: [ { column: 'name' } ],
				relations: [
					{
						joinTableName: 'skill_employee',
						foreignKeys: [
							{ column: 'skillId', repository: this.skillRepository },
							{ column: 'employeeId', repository: this.employeeRepository }
						]
					},
					{
						joinTableName: 'skill_organization',
						foreignKeys: [
							{ column: 'skillId', repository: this.skillRepository },
							{ column: 'organizationId', repository: this.organizationRepository }
						]
					}
				]
			},
			{
				repository: this.accountingTemplateRepository
			},
			{
				repository: this.approvalPolicyRepository
			},
			{
				repository: this.availabilitySlotsRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			{ 
				repository: this.employeeAppointmentRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			{
				repository: this.appointmentEmployeesRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'employeeAppointmentId', repository: this.employeeAppointmentRepository }
				]
			},
			/*
			* Email & Template  
			*/
			{ 
				repository: this.emailTemplateRepository
			},
			{
				repository: this.emailRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'emailTemplateId', repository: this.emailTemplateRepository },
					{ column: 'userId', repository: this.userRepository }
				]
			},
			{
				repository: this.estimateEmailRepository
			},
			/*
			* Employee & Related Entities 
			*/
			{
				repository: this.employeeAwardRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			{
				repository: this.employeeProposalTemplateRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			{
				repository: this.employeeRecurringExpenseRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			{
				repository: this.employeeSettingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			{
				repository: this.employeeUpworkJobsSearchCriterionRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'jobPresetId', repository: this.jobPresetRepository },
					{ column: 'occupationId', repository: this.jobSearchOccupationRepository },
					{ column: 'categoryId', repository: this.jobSearchCategoryRepository }
				]
			},
			{
				repository: this.employeeLevelRepository
			},
			/*
			* Equipment & Related Entities 
			*/
			{ 
				repository: this.equipmentSharingPolicyRepository
			},
			{
				repository: this.equipmentRepository
			},
			{
				repository: this.equipmentSharingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'equipmentId', repository: this.equipmentRepository },
					{ column: 'equipmentSharingPolicyId', repository: this.equipmentSharingPolicyRepository }
				],
				relations: [
					{
						joinTableName: 'equipment_shares_employees',
						foreignKeys: [
							{ column: 'equipmentSharingId', repository: this.equipmentSharingRepository },
							{ column: 'employeeId', repository: this.employeeRepository }
						]
					},
					{
						joinTableName: 'equipment_shares_teams',
						foreignKeys: [
							{ column: 'equipmentSharingId', repository: this.equipmentSharingRepository },
							{ column: 'organizationTeamId', repository: this.organizationTeamRepository }
						]
					}
				]
			},
			/*
			* Event Type & Related Entities 
			*/
			{ 
				repository: this.eventTypeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			/*
			* Invoice & Related Entities
			*/
			{ 
				repository: this.invoiceRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'sendTo', repository: this.organizationContactRepository },
					{ column: 'organizationContactId', repository: this.organizationContactRepository },
					{ column: 'fromOrganizationId', repository: this.organizationRepository },
					{ column: 'toContactId', repository: this.organizationContactRepository }
				]
			},
			{
				repository: this.invoiceItemRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'invoiceId', repository: this.invoiceRepository },
					{ column: 'taskId', repository: this.taskRepository },
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'projectId', repository: this.organizationProjectRepository },
					{ column: 'productId', repository: this.productRepository },
					{ column: 'expenseId', repository: this.expenseRepository }
				]
			},
			{
				repository: this.invoiceEstimateHistoryRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'userId', repository: this.userRepository },
					{ column: 'invoiceId', repository: this.invoiceRepository }
				]
			},
			/*
			* Expense & Related Entities 
			*/
			{
				repository: this.expenseCategoryRepository
			},
			{
				repository: this.expenseRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'vendorId', repository: this.organizationVendorRepository },
					{ column: 'categoryId', repository: this.expenseCategoryRepository },
					{ column: 'projectId', repository: this.organizationProjectRepository }
				]
			},
			/*
			* Income
			*/
			{ 
				repository: this.incomeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			/*
			* Feature & Related Entities 
			*/
			{
				repository: this.featureOrganizationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'featureId', repository: this.featureRepository }
				]
			},
			{
				repository: this.goalRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'ownerTeamId', repository: this.organizationTeamRepository },
					{ column: 'ownerEmployeeId', repository: this.employeeRepository },
					{ column: 'leadId', repository: this.employeeRepository }
				]
			},
			/*
			* Key Result & Related Entities
			*/
			{ 
				repository: this.keyResultRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'projectId', repository: this.organizationProjectRepository },
					{ column: 'taskId', repository: this.taskRepository },
					{ column: 'leadId', repository: this.employeeRepository },
					{ column: 'ownerId', repository: this.employeeRepository },
					{ column: 'goalId', repository: this.goalRepository }
				]
			},
			{
				repository: this.keyResultTemplateRepository
			},
			{
				repository: this.keyResultUpdateRepository
			},
			/*
			* Goal KPI & Related Entities 
			*/
			{ 
				repository: this.goalKpiRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'leadId', repository: this.employeeRepository }
				]
			},
			{
				repository: this.goalKpiTemplateRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'leadId', repository: this.employeeRepository }
				]
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
			/*
			* Integration & Related Entities
			*/
			{
				repository: this.integrationTenantRepository
			},
			{
				repository: this.integrationSettingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'integrationId', repository: this.integrationTenantRepository }
				]
			},
			{
				repository: this.integrationMapRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'integrationId', repository: this.integrationTenantRepository }
				]
			},
			{
				repository: this.integrationEntitySettingRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'integrationId', repository: this.integrationTenantRepository }
				]
			},
			{
				repository: this.integrationEntitySettingTiedEntityRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'integrationEntitySettingId', repository: this.integrationEntitySettingRepository }
				]
			},
			/*
			* Invite & Related Entities
			*/
			{ 
				repository: this.inviteRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'roleId', repository: this.roleRepository },
					{ column: 'invitedById', repository: this.userRepository },
					{ column: 'organizationContactId', repository: this.organizationContactRepository }
				],
				relations: [
					{
						joinTableName: 'invite_organization_contact',
						foreignKeys: [
							{ column: 'inviteId', repository: this.equipmentSharingRepository },
							{ column: 'organizationContactId', repository: this.organizationContactRepository }
						]
					},
					{
						joinTableName: 'invite_organization_department',
						foreignKeys: [
							{ column: 'inviteId', repository: this.equipmentSharingRepository },
							{ column: 'organizationDepartmentId', repository: this.organizationDepartmentRepository }
						]
					},
					{
						joinTableName: 'invite_organization_project',
						foreignKeys: [
							{ column: 'inviteId', repository: this.equipmentSharingRepository },
							{ column: 'organizationProjectId', repository: this.organizationProjectRepository }
						]
					}
				]
			},
			{
				repository: this.organizationTeamEmployeeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'organizationTeamId', repository: this.organizationTeamRepository },
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'roleId', repository: this.roleRepository }
				]
			},
			/*
			* Pipeline & Stage Entities
			*/
			{ 
				repository: this.pipelineRepository
			},
			{
				repository: this.pipelineStageRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'pipelineId', repository: this.pipelineRepository }
				]
			},
			{
				repository: this.dealRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'createdByUserId', repository: this.userRepository },
					{ column: 'stageId', repository: this.pipelineStageRepository },
					{ column: 'clientId', repository: this.organizationContactRepository }
				]
			},
			/*
			* Product & Related Entities
			*/
			{ 
				repository: this.productCategoryRepository
			},
			{
				repository: this.productCategoryTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.productCategoryRepository }
				]
			},
			{
				repository: this.productTypeRepository
			},
			{
				repository: this.productTypeTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.productTypeRepository }
				]
			},
			{
				repository: this.productOptionGroupRepository
			},
			{
				repository: this.productOptionRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'groupId', repository: this.productOptionGroupRepository }
				]
			},
			{
				repository: this.productOptionTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.productOptionRepository }
				]
			},
			{
				repository: this.productOptionGroupTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.productOptionGroupRepository }
				]
			},
			{
				repository: this.imageAssetRepository
			},
			{
				repository: this.productRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'featuredImageId', repository: this.imageAssetRepository },
					{ column: 'typeId', repository: this.productTypeRepository },
					{ column: 'categoryId', repository: this.productCategoryRepository }
				],
				relations: [
					{ joinTableName: 'product_gallery_item' }
				]
			},
			{
				repository: this.productTranslationRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'referenceId', repository: this.productRepository }
				]
			},
			{
				repository: this.productVariantPriceRepository,
				isCheckRelation: true
			},
			{
				repository: this.productVariantSettingsRepository
			},
			{
				repository: this.productVariantRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'productId', repository: this.productRepository },
					{ column: 'imageId', repository: this.imageAssetRepository },
					{ column: 'priceId', repository: this.productVariantPriceRepository },
					{ column: 'settingsId', repository: this.productVariantSettingsRepository }
				],
				relations: [
					{ joinTableName: 'product_variant_options_product_option' }
				]
			},
			{
				repository: this.warehouseRepository,
				uniqueIdentifier:  [ { column: 'email' }, { column: 'code' } ],
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'logoId', repository: this.imageAssetRepository },
					{ column: 'contactId', repository: this.contactRepository }
				]
			},
			{
				repository: this.merchantRepository,
				uniqueIdentifier:  [ { column: 'email' }, { column: 'code' } ],
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'logoId', repository: this.imageAssetRepository },
					{ column: 'contactId', repository: this.contactRepository }
				],
				relations: [
					{ joinTableName: 'warehouse_merchant' }
				]
			},
			{
				repository: this.warehouseProductRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'warehouseId', repository: this.warehouseRepository },
					{ column: 'productId', repository: this.productRepository }
				],
			},
			{
				repository: this.warehouseProductVariantRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'variantId', repository: this.productVariantRepository },
					{ column: 'warehouseProductId', repository: this.warehouseProductRepository }
				],
			},
			/*
			* Proposal & Related Entities
			*/
			{
				repository: this.proposalRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'organizationContactId', repository: this.organizationContactRepository }
				]
			},
			/*
			* Payment & Related Entities
			*/
			{
				repository: this.paymentRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'invoiceId', repository: this.invoiceRepository },
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'recordedById', repository: this.userRepository },
					{ column: 'projectId', repository: this.organizationProjectRepository },
					{ column: 'contactId', repository: this.organizationContactRepository }
				]
			},
			/*
			* Request Approval & Related Entities
			*/
			{
				repository: this.requestApprovalRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'approvalPolicyId', repository: this.approvalPolicyRepository }
				]
			},
			{
				repository: this.requestApprovalEmployeeRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'requestApprovalId', repository: this.requestApprovalRepository },
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			{
				repository: this.requestApprovalTeamRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'requestApprovalId', repository: this.requestApprovalRepository },
					{ column: 'teamId', repository: this.organizationTeamRepository }
				]
			},
			/*
			* Tasks & Related Entities
			*/
			{
				repository: this.taskRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'projectId', repository: this.organizationProjectRepository },
					{ column: 'creatorId', repository: this.userRepository },
					{ column: 'organizationSprintId', repository: this.organizationSprintRepository }
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
				repository: this.timeOffPolicyRepository,
				relations: [
					{ joinTableName: 'time_off_policy_employee' }
				]
			},
			{
				repository: this.timeOffRequestRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'policyId', repository: this.timeOffPolicyRepository }
				],
				relations: [
					{ joinTableName: 'time_off_request_employee' }
				]
			},
			/*
			* Timesheet & Related Entities
			*/
			{
				repository: this.timeSheetRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'approvedById', repository: this.employeeRepository }
				]
			},
			{
				repository: this.timeLogRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'timesheetId', repository: this.timeSheetRepository },
					{ column: 'projectId', repository: this.organizationProjectRepository },
					{ column: 'taskId', repository: this.taskRepository },
					{ column: 'organizationContactId', repository: this.organizationContactRepository }
				],
				relations: [
					{ joinTableName: 'time_slot_time_logs' }
				]
			},
			{
				repository: this.timeSlotRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository }
				]
			},
			{
				repository: this.timeSlotMinuteRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'timeSlotId', repository: this.timeSlotRepository }
				]
			},
			{
				repository: this.screenShotRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'timeSlotId', repository: this.timeSlotRepository }
				]
			},
			{
				repository: this.activityRepository,
				isCheckRelation: true,
				foreignKeys: [
					{ column: 'employeeId', repository: this.employeeRepository },
					{ column: 'projectId', repository: this.organizationProjectRepository },
					{ column: 'timeSlotId', repository: this.timeSlotRepository },
					{ column: 'taskId', repository: this.taskRepository }
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