import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getConnection, getManager, Repository } from 'typeorm';
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
	UserOrganization,
	Warehouse,
	WarehouseProduct,
	WarehouseProductVariant
} from './../../core/entities/internal';
import { RequestContext } from './../../core/context/request-context';
import { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';

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
export class ExportAllService implements OnModuleInit {
	private _dirname: string;
	private _basename = '/export';

	public idZip = new BehaviorSubject<string>('');
	public idCsv = new BehaviorSubject<string>('');

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

		@InjectRepository(Country)
		private readonly countryRepository: Repository<Country>,

		@InjectRepository(Currency)
		private readonly currencyRepository: Repository<Currency>,

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

		@InjectRepository(IntegrationEntitySettingTied)
		private readonly IntegrationEntitySettingTiedRepository: Repository<IntegrationEntitySettingTied>,

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

		@InjectRepository(OrganizationAward)
		private readonly organizationAwardRepository: Repository<OrganizationAward>,

		@InjectRepository(OrganizationContact)
		private readonly organizationContactRepository: Repository<OrganizationContact>,

		@InjectRepository(OrganizationDepartment)
		private readonly organizationDepartmentRepository: Repository<OrganizationDepartment>,

		@InjectRepository(OrganizationDocument)
		private readonly organizationDocumentRepository: Repository<OrganizationDocument>,

		@InjectRepository(OrganizationEmploymentType)
		private readonly organizationEmploymentTypeRepository: Repository<OrganizationEmploymentType>,

		@InjectRepository(OrganizationLanguage)
		private readonly organizationLanguageRepository: Repository<OrganizationLanguage>,

		@InjectRepository(OrganizationPosition)
		private readonly organizationPositionRepository: Repository<OrganizationPosition>,

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

		@InjectRepository(Tenant)
		private readonly tenantRepository: Repository<Tenant>,

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

		private readonly configService: ConfigService
	) {}

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
			const { condition : { replace = 'tenantId', column = 'id' } } = item;
			if (`${replace}` in conditions['where']) {
				delete conditions['where'][replace];
				conditions['where'][column] = where[replace];
			}
		}

		const { repository } = item;
		const nameFile = repository.metadata.tableName;
		
		const [ items, count ] = await repository.findAndCount(conditions);
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
				const [ joinColumn ] = item.joinColumns as ColumnMetadata[];
				if (joinColumn) {
					const { entityMetadata, propertyName, referencedColumn } = joinColumn;
					
					const referencColumn = referencedColumn.propertyName;
					const referencTableName = entityMetadata.givenTableName;
					let sql = `
						SELECT 
							${referencTableName}.* 
						FROM 
							${referencTableName} 
						INNER JOIN ${masterTable} 
							ON "${referencTableName}"."${propertyName}" = "${masterTable}"."${referencColumn}"
					`;
					if (entity.tenantBase !== false) {
						sql += ` WHERE "${masterTable}"."tenantId" = '${where['tenantId']}'`;
					}

					const items = await getManager().query(sql);
					if (isNotEmpty(items)) {
						await this.csvWriter(referencTableName, items);
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
				const referencTableName = item.junctionEntityMetadata.givenTableName;
				const columns = item.junctionEntityMetadata.columns.map((column: ColumnMetadata) => column.propertyName);

				await this.csvTemplateWriter(referencTableName, columns);
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
			const repository = getConnection().getRepository(entity);

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
				repository: this.emailRepository
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
				repository: this.IntegrationEntitySettingTiedRepository
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
				repository: this.productVariantSettingsRepository
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
				repository: this.rolePermissionsRepository
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
