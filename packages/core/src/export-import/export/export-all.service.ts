import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getConnection, getManager, Repository } from 'typeorm';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import * as _ from 'lodash';
import * as archiver from 'archiver';
import * as csv from 'csv-writer';
import * as fs from 'fs';
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
	nameFile: string;
	tenantBase?: boolean;
	relations?: IColumnRelationMetadata[];
	condition?: any;
}

@Injectable()
export class ExportAllService implements OnModuleInit {
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
		await this.createDynamicInstanceForPluginEntities();
		await this.registerCoreRepositories();
	}

	async createFolders(): Promise<any> {
		return new Promise((resolve, reject) => {
			const id = uuidv4();
			this.idCsv.next(id);
			fs.access(`./export/${id}/csv`, (error) => {
				if (!error) {
					return null;
				} else {
					fs.mkdir(
						`./export/${id}/csv`,
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

				const output = fs.createWriteStream(`./export/${fileNameS}`);

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
				archive.directory(`./export/${id$}/csv`, false);
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
		const [ items, count ] = await repository.findAndCount(conditions);
		if (count > 0) {
			return await this.csvWriter(item.nameFile, items);
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
					path: `./export/${id$}/csv/${filename}.csv`,
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

	async downloadAsCsvFormat(index: number): Promise<any> {
		const columns = this.repositories[index].repository.metadata.ownColumns.map(column => column.propertyName);

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
					path: `./export/${id$}/csv/${this.repositories[index].nameFile}.csv`,
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
			res.download(`./export/${fileName}`);
			resolve('');
		});
	}

	async deleteCsvFiles(): Promise<any> {
		return new Promise((resolve) => {
			let id$ = '';

			this.idCsv.subscribe((id) => {
				id$ = id;
			});

			fs.access(`./export/${id$}`, (error) => {
				if (!error) {
					fse.removeSync(`./export/${id$}`);
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

			fs.access(`./export/${fileName}`, (error) => {
				if (!error) {
					fse.removeSync(`./export/${fileName}`);
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
				for await (const repository of this.repositories) {
					const { nameFile } = repository;
					if (names.includes(nameFile)) {
						await this.getAsCsv(repository, { 
							tenantId: RequestContext.currentTenantId() 
						});

						// export pivot relational tables
						if (isNotEmpty(repository.relations)) {
							await this.exportRelationalTables(repository, { 
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
					if (items.length > 0) {
						await this.csvWriter(referencTableName, items);
					}
				}
			}
		}
	}
	
	async downloadSpecificTables() {
		return new Promise(async (resolve) => {
			for (const [i] of this.repositories.entries()) {
				await this.downloadAsCsvFormat(i);
			}
			resolve('');
		});
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
	 */
	private async registerCoreRepositories() {
		this.repositories = [
			{
				repository: this.accountingTemplateRepository,
				nameFile: 'accounting_template'
			},
			{
				repository: this.activityRepository,
				nameFile: 'activity'
			},
			{
				repository: this.appointmentEmployeesRepository,
				nameFile: 'appointment_employee'
			},
			{
				repository: this.approvalPolicyRepository,
				nameFile: 'approval_policy'
			},
			{
				repository: this.availabilitySlotsRepository,
				nameFile: 'availability_slot'
			},
			{
				repository: this.candidateRepository,
				nameFile: 'candidate',
				relations: [
					{ joinTableName: 'candidate_department' },
					{ joinTableName: 'candidate_employment_type' },
					{ joinTableName: 'tag_candidate' },
				]
			},
			{
				repository: this.candidateCriterionsRatingRepository,
				nameFile: 'candidate_criterion_rating'
			},
			{
				repository: this.candidateDocumentRepository,
				nameFile: 'candidate_document'
			},
			{
				repository: this.candidateEducationRepository,
				nameFile: 'candidate_education'
			},
			{
				repository: this.candidateExperienceRepository,
				nameFile: 'candidate_experience'
			},
			{
				repository: this.candidateFeedbackRepository,
				nameFile: 'candidate_feedback'
			},
			{
				repository: this.candidateInterviewersRepository,
				nameFile: 'candidate_interviewer'
			},
			{
				repository: this.candidateInterviewRepository,
				nameFile: 'candidate_interview'
			},
			{
				repository: this.candidatePersonalQualitiesRepository,
				nameFile: 'candidate_personal_quality'
			},
			{
				repository: this.candidateSkillRepository,
				nameFile: 'candidate_skill'
			},
			{
				repository: this.candidateSourceRepository,
				nameFile: 'candidate_source'
			},
			{
				repository: this.candidateTechnologiesRepository,
				nameFile: 'candidate_technology'
			},
			{
				repository: this.customSmtpRepository,
				nameFile: 'custom_smtp'
			},
			{ 
				repository: this.contactRepository,
				nameFile: 'contact',
			},
			{ 
				repository: this.dealRepository,
				nameFile: 'deal'
			},
			{ 
				repository: this.emailRepository,
				nameFile: 'email'
			},
			{
				repository: this.emailTemplateRepository,
				nameFile: 'email_template'
			},
			{
				repository: this.employeeAppointmentRepository,
				nameFile: 'employee_appointment'
			},
			{
				repository: this.employeeAwardRepository,
				nameFile: 'employee_award'
			},
			{
				repository: this.employeeLevelRepository,
				nameFile: 'organization_employee_level',
				relations: [
					{ joinTableName: 'tag_organization_employee_level' }
				]
			},
			{
				repository: this.employeeProposalTemplateRepository,
				nameFile: 'employee_proposal_template'
			},
			{
				repository: this.employeeRecurringExpenseRepository,
				nameFile: 'employee_recurring_expense'
			},
			{ 
				repository: this.employeeRepository,
				nameFile: 'employee',
				relations: [
					{ joinTableName: 'employee_job_preset' },
					{ joinTableName: 'tag_employee' }
				]
			},
			{
				repository: this.employeeSettingRepository,
				nameFile: 'employee_setting'
			},
			{
				repository: this.employeeUpworkJobsSearchCriterionRepository,
				nameFile: 'employee_upwork_job_search_criterion'
			},
			{ 
				repository: this.equipmentRepository,
				nameFile: 'equipment',
				relations: [
					{ joinTableName: 'tag_equipment' }
				]
			},
			{
				repository: this.equipmentSharingRepository,
				nameFile: 'equipment_sharing',
				relations: [
					{ joinTableName: 'equipment_shares_employees' },
					{ joinTableName: 'equipment_shares_teams' }
				]
			},
			{
				repository: this.equipmentSharingPolicyRepository,
				nameFile: 'equipment_sharing_policy'
			},
			{
				repository: this.estimateEmailRepository,
				nameFile: 'estimate_email'
			},
			{ 
				repository: this.eventTypeRepository,
				nameFile: 'event_type',
				relations: [
					{ joinTableName: 'tag_event_type' }
				]
			},
			{
				repository: this.expenseCategoryRepository,
				nameFile: 'expense_category',
				relations: [
					{ joinTableName: 'tag_organization_expense_category' }
				]
			},
			{ 
				repository: this.expenseRepository,
				nameFile: 'expense',
				relations: [
					{ joinTableName: 'tag_expense' }
				]
			},
			{ 
				repository: this.featureRepository,
				nameFile: 'feature',
				tenantBase: false
			},
			{ 
				repository: this.featureOrganizationRepository,
				nameFile: 'feature_organization'
			},
			{ 
				repository: this.goalKpiRepository,
				nameFile: 'goal_kpi'
			},
			{
				repository: this.goalKpiTemplateRepository,
				nameFile: 'goal_kpi_template'
			},
			{ 
				repository: this.goalRepository,
				nameFile: 'goal'
			},
			{
				repository: this.goalTemplateRepository,
				nameFile: 'goal_template'
			},
			{
				repository: this.goalTimeFrameRepository,
				nameFile: 'goal_time_frame'
			},
			{
				repository: this.goalGeneralSettingRepository,
				nameFile: 'goal_general_setting'
			},
			{ 
				repository: this.incomeRepository,
				nameFile: 'income',
				relations: [
					{ joinTableName: 'tag_income' }
				]
			},
			{
				repository: this.integrationEntitySettingRepository,
				nameFile: 'integration_entity_setting'
			},
			{
				repository: this.integrationEntitySettingTiedEntityRepository,
				nameFile: 'integration_entity_setting_tied_entity'
			},
			{
				repository: this.integrationMapRepository,
				nameFile: 'integration_map'
			},
			{
				repository: this.integrationRepository,
				nameFile: 'integration',
				tenantBase: false,
				relations: [
					{ joinTableName: 'integration_integration_type' },
					{ joinTableName: 'tag_integration' }
				]
			},
			{
				repository: this.integrationSettingRepository,
				nameFile: 'integration_setting'
			},
			{
				repository: this.integrationTypeRepository,
				nameFile: 'integration_type'
			},
			{
				repository: this.integrationTenantRepository,
				nameFile: 'integration_tenant'
			},
			{ 
				repository: this.inviteRepository,
				nameFile: 'invite',
				relations: [
					{ joinTableName: 'invite_organization_contact' },
					{ joinTableName: 'invite_organization_department' },
					{ joinTableName: 'invite_organization_project' }
				]
			},
			{
				repository: this.invoiceEstimateHistoryRepository,
				nameFile: 'invoice_estimate_history'
			},
			{
				repository: this.invoiceItemRepository,
				nameFile: 'invoice_item'
			},
			{ 
				repository: this.invoiceRepository,
				nameFile: 'invoice',
				relations: [
					{ joinTableName: 'tag_invoice' }
				]
			},
			{ 
				repository: this.jobPresetRepository,
				nameFile: 'job_preset'
			},
			{ 
				repository: this.jobPresetUpworkJobSearchCriterionRepository,
				nameFile: 'job_preset_upwork_job_search_criterion'
			},
			{
				repository: this.jobSearchCategoryRepository,
				nameFile: 'job_search_category'
			},
			{
				repository: this.jobSearchOccupationRepository,
				nameFile: 'job_search_occupation'
			},
			{ 
				repository: this.keyResultRepository,
				nameFile: 'key_result'
			},
			{
				repository: this.keyResultTemplateRepository,
				nameFile: 'key_result_template'
			},
			{
				repository: this.keyResultUpdateRepository,
				nameFile: 'key_result_update'
			},
			{
				repository: this.languageRepository,
				nameFile: 'language',
				tenantBase: false
			},
			{
				repository: this.organizationAwardsRepository,
				nameFile: 'organization_award'
			},
			{
				repository: this.organizationContactRepository,
				nameFile: 'organization_contact',
				relations: [
					{ joinTableName: 'organization_contact_employee' },
					{ joinTableName: 'tag_organization_contact' }
				]
			},
			{
				repository: this.organizationDepartmentRepository,
				nameFile: 'organization_department',
				relations: [
					{ joinTableName: 'organization_department_employee' },
					{ joinTableName: 'tag_organization_department' }
				]
			},
			{
				repository: this.organizationDocumentRepository,
				nameFile: 'organization_document'
			},
			{
				repository: this.organizationEmploymentTypeRepository,
				nameFile: 'organization_employment_type',
				relations: [
					{ joinTableName: 'organization_employment_type_employee' },
					{ joinTableName: 'tag_organization_employment_type' }
				]
			},
			{
				repository: this.organizationLanguagesRepository,
				nameFile: 'organization_language'
			},
			{
				repository: this.organizationPositionsRepository,
				nameFile: 'organization_position',
				relations: [
					{ joinTableName: 'tag_organization_position' }
				]
			},
			{
				repository: this.organizationProjectsRepository,
				nameFile: 'organization_project',
				relations: [
					{ joinTableName: 'organization_project_employee' },
					{ joinTableName: 'tag_organization_project' }
				]
			},
			{
				repository: this.organizationRecurringExpenseRepository,
				nameFile: 'organization_recurring_expense'
			},
			{
				repository: this.organizationRepository,
				nameFile: 'organization',
				relations: [
					{ joinTableName: 'tag_organization' }
				]
			},
			{
				repository: this.organizationSprintRepository,
				nameFile: 'organization_sprint'
			},
			{
				repository: this.organizationTeamEmployeeRepository,
				nameFile: 'organization_team_employee'
			},
			{
				repository: this.organizationTeamRepository,
				nameFile: 'organization_team',
				relations: [
					{ joinTableName: 'tag_organization_team' }
				]
			},
			{
				repository: this.organizationVendorsRepository,
				nameFile: 'organization_vendor',
				relations: [
					{ joinTableName: 'tag_organization_vendor' }
				]
			},
			{ 
				repository: this.paymentRepository,
				nameFile: 'payment',
				relations: [
					{ joinTableName: 'tag_payment' }
				]
			},
			{ 
				repository: this.pipelineRepository,
				nameFile: 'pipeline'
			},
			{
				repository: this.productCategoryRepository,
				nameFile: 'product_category'
			},
			{
				repository: this.productCategoryTranslationRepository,
				nameFile: 'product_category_translation'
			},
			{
				repository: this.productOptionRepository,
				nameFile: 'product_option'
			},
			{
				repository: this.productOptionGroupRepository,
				nameFile: 'product_option_group'
			},
			{
				repository: this.productOptionGroupTranslationRepository,
				nameFile: 'product_option_group_translation'
			},
			{
				repository: this.productOptionTranslationRepository,
				nameFile: 'product_option_translation'
			},
			{ 
				repository: this.productRepository,
				nameFile: 'product',
				relations: [
					{ joinTableName: 'product_gallery_item' },
					{ joinTableName: 'tag_product' }
				]
			},
			{
				repository: this.productTranslationRepository,
				nameFile: 'product_translation'
			},
			{
				repository: this.productTypeRepository,
				nameFile: 'product_type'
			},
			{
				repository: this.productTypeTranslationRepository,
				nameFile: 'product_type_translation'
			},
			{
				repository: this.productVariantPriceRepository,
				nameFile: 'product_variant_price'
			},
			{
				repository: this.productVariantRepository,
				nameFile: 'product_variant',
				relations: [
					{ joinTableName: 'product_variant_options_product_option' }
				]
			},
			{
				repository: this.productVariantSettingsRepository,
				nameFile: 'product_variant_setting'
			},
			{
				repository: this.imageAssetRepository,
				nameFile: 'image_asset'
			},
			{
				repository: this.warehouseRepository,
				nameFile: 'warehouse',
				relations: [
					{ joinTableName: 'tag_warehouse' }
				]
			},
			{
				repository: this.merchantRepository,
				nameFile: 'merchant',
				relations: [
					{ joinTableName: 'warehouse_merchant' },
					{ joinTableName: 'tag_merchant' }
				]
			},
			{
				repository: this.warehouseProductRepository,
				nameFile: 'warehouse_product'
			},
			{
				repository: this.warehouseProductVariantRepository,
				nameFile: 'warehouse_product_variant'
			},
			{ 
				repository: this.proposalRepository,
				nameFile: 'proposal',
				relations: [
					{ joinTableName: 'tag_proposal' }
				]
			},
			{
				repository: this.reportCategoryRepository,
				nameFile: 'report_category',
				tenantBase: false
			},
			{
				repository: this.reportOrganizationRepository,
				nameFile: 'report_organization'
			},
			{
				repository: this.reportRepository,
				nameFile: 'report',
				tenantBase: false
			},
			{
				repository: this.requestApprovalRepository,
				nameFile: 'request_approval',
				relations: [
					{ joinTableName: 'tag_request_approval' }
				]
			},
			{
				repository: this.requestApprovalEmployeeRepository,
				nameFile: 'request_approval_employee'
			},
			{
				repository: this.requestApprovalTeamRepository,
				nameFile: 'request_approval_team'
			},
			{
				repository: this.rolePermissionsRepository,
				nameFile: 'role_permission'
			},
			{
				repository: this.roleRepository,
				nameFile: 'role'
			},
			{
				repository: this.screenShotRepository,
				nameFile: 'screenshot'
			},
			{
				repository: this.skillRepository,
				nameFile: 'skill',
				relations: [
					{ joinTableName: 'skill_employee' },
					{ joinTableName: 'skill_organization' }
				]
			},
			{ 
				repository: this.pipelineStageRepository,
				nameFile: 'pipeline_stage'
			},
			{
				repository: this.tagRepository,
				nameFile: 'tag'
			},
			{
				repository: this.taskRepository,
				nameFile: 'task',
				relations: [
					{ joinTableName: 'task_employee' },
					{ joinTableName: 'task_team' },
					{ joinTableName: 'tag_task' },
				]
			},
			{
				repository: this.tenantRepository,
				nameFile: 'tenant',
				condition: {
					column: 'id',
					replace: 'tenantId'
				}
			},
			{
				repository: this.tenantSettingRepository,
				nameFile: 'tenant_setting'
			},
			{
				repository: this.timeLogRepository,
				nameFile: 'time_log',
				relations: [
					{ joinTableName: 'time_slot_time_logs' }
				]
			},
			{
				repository: this.timeOffPolicyRepository,
				nameFile: 'time_off_policy',
				relations: [
					{ joinTableName: 'time_off_policy_employee' }
				]
			},
			{
				repository: this.timeOffRequestRepository,
				nameFile: 'time_off_request',
				relations: [
					{ joinTableName: 'time_off_request_employee' }
				]
			},
			{
				repository: this.timeSheetRepository,
				nameFile: 'timesheet'
			},
			{
				repository: this.timeSlotRepository,
				nameFile: 'time_slot'
			},
			{
				repository: this.timeSlotMinuteRepository,
				nameFile: 'time_slot_minute'
			},
			{
				repository: this.userOrganizationRepository,
				nameFile: 'user_organization'
			},
			{
				repository: this.userRepository,
				nameFile: 'user'
			},
			...this.dynamicEntitiesClassMap
		] as IRepositoryModel<any>[];
	}
}
