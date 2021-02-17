import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { getConnection, Repository } from 'typeorm';
import { BehaviorSubject } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import * as _ from 'lodash';
import * as archiver from 'archiver';
import * as csv from 'csv-writer';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import { ConfigService } from '@gauzy/config';
import { getEntitiesFromPlugins } from '@gauzy/plugin';
import { isFunction } from '@gauzy/common';
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
	CandidatePersonalQualities,
	CandidateSkill,
	CandidateSource,
	CandidateTechnologies,
	Contact,
	Country,
	Currency,
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
	Equipment,
	EquipmentSharing,
	EstimateEmail,
	EventType,
	Expense,
	ExpenseCategory,
	Goal,
	GoalKPI,
	GoalKPITemplate,
	GoalTemplate,
	GoalTimeFrame,
	Income,
	Integration,
	IntegrationEntitySetting,
	IntegrationEntitySettingTiedEntity,
	IntegrationMap,
	IntegrationSetting,
	IntegrationTenant,
	Invite,
	Invoice,
	InvoiceEstimateHistory,
	InvoiceItem,
	JobPreset,
	JobSearchCategory,
	JobSearchOccupation,
	KeyResult,
	KeyResultTemplate,
	KeyResultUpdate,
	Language,
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
	ProductOption,
	ProductType,
	ProductVariant,
	ProductVariantPrice,
	ProductVariantSettings,
	Proposal,
	Report,
	ReportCategory,
	RequestApproval,
	Role,
	RolePermissions,
	Screenshot,
	Skill,
	Tag,
	Task,
	Tenant,
	TimeLog,
	TimeOffPolicy,
	TimeOffRequest,
	Timesheet,
	TimeSlot,
	User,
	UserOrganization
} from './../../core/entities/internal';

export interface IRepositoryModel {
	repository: any;
	nameFile: string;
	tenantOrganizationBase?: boolean;
	tenantBase?: boolean;
}

@Injectable()
export class ExportAllService implements OnModuleInit {
	public idZip = new BehaviorSubject<string>('');
	public idCsv = new BehaviorSubject<string>('');

	private dynamicEntitiesClassMap: IRepositoryModel[] = [];
	private repositories: IRepositoryModel[] = [];

	constructor(
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

		@InjectRepository(Equipment)
		private readonly equipmentRepository: Repository<Equipment>,

		@InjectRepository(EquipmentSharing)
		private readonly equipmentSharingRepository: Repository<EquipmentSharing>,

		@InjectRepository(EstimateEmail)
		private readonly estimateEmailRepository: Repository<EstimateEmail>,

		@InjectRepository(EventType)
		private readonly eventTypeRepository: Repository<EventType>,

		@InjectRepository(Expense)
		private readonly expenseRepository: Repository<Expense>,

		@InjectRepository(ExpenseCategory)
		private readonly expenseCategoryRepository: Repository<ExpenseCategory>,

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

		@InjectRepository(Income)
		private readonly incomeRepository: Repository<Income>,

		@InjectRepository(Integration)
		private readonly integrationRepository: Repository<Integration>,

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
		private readonly stageRepository: Repository<PipelineStage>,

		@InjectRepository(Product)
		private readonly productRepository: Repository<Product>,

		@InjectRepository(ProductCategory)
		private readonly productCategoryRepository: Repository<ProductCategory>,

		@InjectRepository(ProductOption)
		private readonly productOptionRepository: Repository<ProductOption>,

		@InjectRepository(ProductVariantSettings)
		private readonly productVariantSettingsRepository: Repository<ProductVariantSettings>,

		@InjectRepository(ProductType)
		private readonly productTypeRepository: Repository<ProductType>,

		@InjectRepository(ProductVariant)
		private readonly productVariantRepository: Repository<ProductVariant>,

		@InjectRepository(ProductVariantPrice)
		private readonly productVariantPriceRepository: Repository<ProductVariantPrice>,

		@InjectRepository(Proposal)
		private readonly proposalRepository: Repository<Proposal>,

		@InjectRepository(Skill)
		private readonly skillRepository: Repository<Skill>,

		@InjectRepository(Screenshot)
		private readonly screenShotRepository: Repository<Screenshot>,

		@InjectRepository(RequestApproval)
		private readonly requestApprovalRepository: Repository<RequestApproval>,

		@InjectRepository(Role)
		private readonly roleRepository: Repository<Role>,

		@InjectRepository(RolePermissions)
		private readonly rolePermissionsRepository: Repository<RolePermissions>,

		@InjectRepository(Report)
		private readonly reportRepository: Repository<Report>,

		@InjectRepository(ReportCategory)
		private readonly reportCategoryRepository: Repository<ReportCategory>,

		@InjectRepository(Tag)
		private readonly tagRepository: Repository<Tag>,

		@InjectRepository(Task)
		private readonly taskRepository: Repository<Task>,

		@InjectRepository(Tenant)
		private readonly tenantRepository: Repository<Tenant>,

		@InjectRepository(Timesheet)
		private readonly timeSheetRepository: Repository<Timesheet>,

		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,

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
		this.createDynamicInstanceForPluginEntities();
		this.registerCoreRepositories();
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
		service_count: number,
		findInput: {
			organizationId: string;
			tenantId: string;
		}
	): Promise<any> {
		const conditions = {};
		if (
			this.repositories[service_count]['tenantOrganizationBase'] !== false
		) {
			conditions['where'] = findInput;
		}
		if (this.repositories[service_count]['tenantBase'] === true) {
			conditions['where'] = {
				tenantId: findInput['tenantId']
			};
		}

		const [incomingData, count] = await this.repositories[
			service_count
		].repository.findAndCount(conditions);
		if (count > 0) {
			return new Promise((resolve) => {
				const createCsvWriter = csv.createObjectCsvWriter;
				const dataIn = [];
				const dataKeys = Object.keys(incomingData[0]);

				for (const count of dataKeys) {
					dataIn.push({ id: count, title: count });
				}

				let id$ = '';
				this.idCsv.subscribe((id) => {
					id$ = id;
				});

				const csvWriter = createCsvWriter({
					path: `./export/${id$}/csv/${this.repositories[service_count].nameFile}.csv`,
					header: dataIn
				});

				const data = incomingData;

				csvWriter.writeRecords(data).then(() => {
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

	async downloadTemplate(res) {
		return new Promise((resolve, reject) => {
			const path = './export/template.zip';
			try {
				if (fs.existsSync(path)) {
					res.download(path);
				}
				resolve('');
			} catch (err) {
				reject(err);
			}
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

	async exportTables(findInput: {
		organizationId: string;
		tenantId: string;
	}) {
		return new Promise(async (resolve) => {
			for (const [i] of this.repositories.entries()) {
				await this.getAsCsv(i, findInput);
			}
			resolve('');
		});
	}

	async exportSpecificTables(
		names: string[],
		findInput: {
			organizationId: string;
			tenantId: string;
		}
	) {
		return new Promise(async (resolve) => {
			for (let i = 0; i < this.repositories.length; i++) {
				const name = names.find(
					(n) => this.repositories[i].nameFile === n
				);
				if (name) {
					await this.getAsCsv(i, findInput);
				}
			}
			resolve('');
		});
	}

	/*
	 * Load all plugins entities for export data
	 */
	private createDynamicInstanceForPluginEntities() {
		for (const entity of getEntitiesFromPlugins(
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
	private registerCoreRepositories() {
		this.repositories = [
			{ repository: this.activityRepository, nameFile: 'activity' },
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
				repository: this.candidateCriterionsRatingRepository,
				nameFile: 'candidate_creation_rating'
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
			{ repository: this.candidateRepository, nameFile: 'candidate' },
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
			{ repository: this.contactRepository, nameFile: 'contact' },
			{
				repository: this.countryRepository,
				nameFile: 'country',
				tenantOrganizationBase: false
			},
			{
				repository: this.currencyRepository,
				nameFile: 'currency',
				tenantOrganizationBase: false
			},
			{ repository: this.dealRepository, nameFile: 'deal' },
			{ repository: this.emailRepository, nameFile: 'email' },
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
				nameFile: 'organization_employee_level'
			},
			{
				repository: this.employeeProposalTemplateRepository,
				nameFile: 'employee_proposal_template'
			},
			{
				repository: this.employeeRecurringExpenseRepository,
				nameFile: 'employee_recurring_expense'
			},
			{ repository: this.employeeRepository, nameFile: 'employee' },
			{
				repository: this.employeeSettingRepository,
				nameFile: 'employee_setting'
			},
			{ repository: this.equipmentRepository, nameFile: 'equipment' },
			{
				repository: this.equipmentSharingRepository,
				nameFile: 'equipment_sharing'
			},
			{
				repository: this.estimateEmailRepository,
				nameFile: 'estimate_email'
			},
			{ repository: this.eventTypeRepository, nameFile: 'event_types' },
			{
				repository: this.expenseCategoryRepository,
				nameFile: 'expense_category'
			},
			{ repository: this.expenseRepository, nameFile: 'expense' },
			{ repository: this.goalKpiRepository, nameFile: 'goal_kpi' },
			{
				repository: this.goalKpiTemplateRepository,
				nameFile: 'goal_kpi_template'
			},
			{ repository: this.goalRepository, nameFile: 'goal' },
			{
				repository: this.goalTemplateRepository,
				nameFile: 'goal_template'
			},
			{
				repository: this.goalTimeFrameRepository,
				nameFile: 'goal_time_frame'
			},
			{ repository: this.incomeRepository, nameFile: 'income' },
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
				tenantOrganizationBase: false
			},
			{
				repository: this.integrationSettingRepository,
				nameFile: 'integration_setting'
			},
			{
				repository: this.integrationTenantRepository,
				nameFile: 'integration_tenant'
			},
			{ repository: this.inviteRepository, nameFile: 'invite' },
			{
				repository: this.invoiceEstimateHistoryRepository,
				nameFile: 'invoice_estimate_history'
			},
			{
				repository: this.invoiceItemRepository,
				nameFile: 'invoice_item'
			},
			{ repository: this.invoiceRepository, nameFile: 'invoice' },
			{ repository: this.jobPresetRepository, nameFile: 'job_preset' },
			{
				repository: this.jobSearchCategoryRepository,
				nameFile: 'job_search_category'
			},
			{
				repository: this.jobSearchOccupationRepository,
				nameFile: 'job_search_occupation'
			},
			{ repository: this.keyResultRepository, nameFile: 'key_result' },
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
				tenantOrganizationBase: false
			},
			{
				repository: this.organizationAwardsRepository,
				nameFile: 'organization_award'
			},
			{
				repository: this.organizationContactRepository,
				nameFile: 'organization_contact'
			},
			{
				repository: this.organizationDepartmentRepository,
				nameFile: 'organization_department'
			},
			{
				repository: this.organizationDocumentRepository,
				nameFile: 'organization_document'
			},
			{
				repository: this.organizationEmploymentTypeRepository,
				nameFile: 'organization_employment_type'
			},
			{
				repository: this.organizationLanguagesRepository,
				nameFile: 'organization_languages'
			},
			{
				repository: this.organizationPositionsRepository,
				nameFile: 'organization_position'
			},
			{
				repository: this.organizationProjectsRepository,
				nameFile: 'organization_project'
			},
			{
				repository: this.organizationRecurringExpenseRepository,
				nameFile: 'organization_recurring_expense'
			},
			{
				repository: this.organizationRepository,
				nameFile: 'organization',
				tenantOrganizationBase: false,
				tenantBase: true
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
				nameFile: 'organization_team'
			},
			{
				repository: this.organizationVendorsRepository,
				nameFile: 'organization_vendor'
			},
			{ repository: this.paymentRepository, nameFile: 'payment' },
			{ repository: this.pipelineRepository, nameFile: 'pipeline' },
			{
				repository: this.productCategoryRepository,
				nameFile: 'product_category'
			},
			{
				repository: this.productOptionRepository,
				nameFile: 'product_option'
			},
			{ repository: this.productRepository, nameFile: 'product' },
			{
				repository: this.productTypeRepository,
				nameFile: 'product_type'
			},
			{
				repository: this.productVariantPriceRepository,
				nameFile: 'product_variant_price'
			},
			{
				repository: this.productVariantRepository,
				nameFile: 'product_variant'
			},
			{
				repository: this.productVariantSettingsRepository,
				nameFile: 'product_variant_setting'
			},
			{ repository: this.proposalRepository, nameFile: 'proposal' },
			{
				repository: this.reportCategoryRepository,
				nameFile: 'report_category',
				tenantOrganizationBase: false
			},
			{
				repository: this.reportRepository,
				nameFile: 'report',
				tenantOrganizationBase: false
			},
			{
				repository: this.requestApprovalRepository,
				nameFile: 'request_approval'
			},
			{
				repository: this.rolePermissionsRepository,
				nameFile: 'role_permission',
				tenantOrganizationBase: false
			},
			{
				repository: this.roleRepository,
				nameFile: 'role',
				tenantOrganizationBase: false
			},
			{ repository: this.screenShotRepository, nameFile: 'screenshot' },
			{
				repository: this.skillRepository,
				nameFile: 'skill',
				tenantOrganizationBase: false
			},
			{ repository: this.stageRepository, nameFile: 'pipeline_stage' },
			{ repository: this.tagRepository, nameFile: 'tag' },
			{ repository: this.taskRepository, nameFile: 'task' },
			{
				repository: this.tenantRepository,
				nameFile: 'tenant',
				tenantOrganizationBase: false
			},
			{ repository: this.timeLogRepository, nameFile: 'time_log' },
			{
				repository: this.timeOffPolicyRepository,
				nameFile: 'time_off_policy'
			},
			{
				repository: this.timeOffRequestRepository,
				nameFile: 'time_off_request'
			},
			{ repository: this.timeSheetRepository, nameFile: 'timesheet' },
			{ repository: this.timeSlotRepository, nameFile: 'time_slot' },
			{
				repository: this.userOrganizationRepository,
				nameFile: 'user_organization'
			},
			{
				repository: this.userRepository,
				nameFile: 'user',
				tenantOrganizationBase: false,
				tenantBase: true
			},
			...this.dynamicEntitiesClassMap
		] as IRepositoryModel[];
	}
}
