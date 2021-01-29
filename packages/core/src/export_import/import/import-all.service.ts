import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as unzipper from 'unzipper';
import * as csv from 'csv-parser';
import * as rimraf from 'rimraf';
import { Connection, Repository } from 'typeorm';
import { Country } from '../../country/country.entity';
import { User } from '../../user/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Tag } from '../../tags/tag.entity';
import { Activity } from '../../timesheet/activity.entity';
import { AvailabilitySlot } from '../../availability-slots/availability-slots.entity';
import { ApprovalPolicy } from '../../approval-policy/approval-policy.entity';
import { AppointmentEmployee } from '../../appointment-employees/appointment-employees.entity';
import { CandidateTechnologies } from '../../candidate-technologies/candidate-technologies.entity';
import { CandidateSource } from '../../candidate-source/candidate-source.entity';
import { CandidateSkill } from '../../candidate-skill/candidate-skill.entity';
import { CandidatePersonalQualities } from '../../candidate-personal-qualities/candidate-personal-qualities.entity';
import { CandidateInterviewers } from '../../candidate-interviewers/candidate-interviewers.entity';
import { CandidateInterview } from '../../candidate-interview/candidate-interview.entity';
import { CandidateFeedback } from '../../candidate-feedbacks/candidate-feedbacks.entity';
import { CandidateExperience } from '../../candidate-experience/candidate-experience.entity';
import { CandidateEducation } from '../../candidate-education/candidate-education.entity';
import { CandidateDocument } from '../../candidate-documents/candidate-documents.entity';
import { CandidateCriterionsRating } from '../../candidate-criterions-rating/candidate-criterion-rating.entity';
import { Candidate } from '../../candidate/candidate.entity';
import { Contact } from '../../contact/contact.entity';
import { Deal } from '../../deal/deal.entity';
import { EmailTemplate } from '../../email-template/email-template.entity';
import { Email } from '../../email/email.entity';
import { Employee } from '../../employee/employee.entity';
import { EmployeeAppointment } from '../../employee-appointment/employee-appointment.entity';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense/employee-recurring-expense.entity';
import { EmployeeSetting } from '../../employee-setting/employee-setting.entity';
import { Equipment } from '../../equipment/equipment.entity';
import { EquipmentSharing } from '../../equipment-sharing/equipment-sharing.entity';
import { EquipmentSharingPolicy } from '../../equipment-sharing-policy/equipment-sharing-policy.entity';
import { EstimateEmail } from '../../estimate-email/estimate-email.entity';
import { EventType } from '../../event-types/event-type.entity';
import { Expense } from '../../expense/expense.entity';
import { ExpenseCategory } from '../../expense-categories/expense-category.entity';
import { UserOrganization } from '../../user-organization/user-organization.entity';
import { TimeOffPolicy } from '../../time-off-policy/time-off-policy.entity';
import { TimeOffRequest } from '../../time-off-request/time-off-request.entity';
import { TimeSlot } from '../../timesheet/time-slot.entity';
import { TimeLog } from '../../timesheet/time-log.entity';
import { Timesheet } from '../../timesheet/timesheet.entity';
import { Tenant } from '../../tenant/tenant.entity';
import { Task } from '../../tasks/task.entity';
import { Screenshot } from '../../timesheet/screenshot.entity';
import { HelpCenterAuthor } from '../../help-center-author/help-center-author.entity';
import { HelpCenterArticle } from '../../help-center-article/help-center-article.entity';
import { HelpCenter } from '../../help-center/help-center.entity';
import { GoalTimeFrame } from '../../goal-time-frame/goal-time-frame.entity';
import { GoalKPI } from '../../goal-kpi/goal-kpi.entity';
import { GoalGeneralSetting } from '../../goal-general-setting/goal-general-setting.entity';
import { Goal } from '../../goal/goal.entity';
import { Skill } from '../../skills/skill.entity';
import { Language } from '../../language/language.entity';
import { KeyResultUpdate } from '../../keyresult-update/keyresult-update.entity';
import { KeyResult } from '../../keyresult/keyresult.entity';
import { InvoiceItem } from '../../invoice-item/invoice-item.entity';
import { Invoice } from '../../invoice/invoice.entity';
import { Invite } from '../../invite/invite.entity';
import { IntegrationTenant } from '../../integration-tenant/integration-tenant.entity';
import { IntegrationSetting } from '../../integration-setting/integration-setting.entity';
import { IntegrationMap } from '../../integration-map/integration-map.entity';
import { Income } from '../../income/income.entity';
import { Integration } from '../../integration/integration.entity';
import { IntegrationEntitySetting } from '../../integration-entity-setting/integration-entity-setting.entity';
import { IntegrationEntitySettingTiedEntity } from '../../integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.entity';
import { Organization } from '../../organization/organization.entity';
import { EmployeeLevel } from '../../organization_employee-level/organization-employee-level.entity';
import { OrganizationAwards } from '../../organization-awards/organization-awards.entity';
import { OrganizationContact } from '../../organization-contact/organization-contact.entity';
import { OrganizationDepartment } from '../../organization-department/organization-department.entity';
import { OrganizationDocuments } from '../../organization-documents/organization-documents.entity';
import { OrganizationEmploymentType } from '../../organization-employment-type/organization-employment-type.entity';
import { OrganizationLanguages } from '../../organization-languages/organization-languages.entity';
import { OrganizationPositions } from '../../organization-positions/organization-positions.entity';
import { OrganizationProject } from '../../organization-projects/organization-projects.entity';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense/organization-recurring-expense.entity';
import { OrganizationSprint } from '../../organization-sprint/organization-sprint.entity';
import { OrganizationTeam } from '../../organization-team/organization-team.entity';
import { OrganizationTeamEmployee } from '../../organization-team-employee/organization-team-employee.entity';
import { OrganizationVendor } from '../../organization-vendors/organization-vendors.entity';
import { RolePermissions } from '../../role-permissions/role-permissions.entity';
import { Role } from '../../role/role.entity';
import { RequestApproval } from '../../request-approval/request-approval.entity';
import { Payment } from '../../payment/payment.entity';
import { Pipeline } from '../../pipeline/pipeline.entity';
import { PipelineStage } from '../../pipeline-stage/pipeline-stage.entity';
import { Proposal } from '../../proposal/proposal.entity';
import { ProductVariantPrice } from '../../product-variant-price/product-variant-price.entity';
import { ProductVariant } from '../../product-variant/product-variant.entity';
import { ProductType } from '../../product-type/product-type.entity';
import { ProductVariantSettings } from '../../product-settings/product-settings.entity';
import { ProductOption } from '../../product-option/product-option.entity';
import { ProductCategory } from '../../product-category/product-category.entity';
import { Product } from '../../product/product.entity';
import { convertToDatetime } from '../../core/utils';
import { FileStorage } from '../../core/file-storage';
import { Currency } from '../../currency/currency.entity';
import { EmployeeAward } from '../../employee-award/employee-award.entity';
import { EmployeeProposalTemplate } from '../../employee-proposal-template/employee-proposal-template.entity';
import { EmployeeUpworkJobsSearchCriterion } from '../../employee-job-preset/employee-upwork-jobs-search-criterion.entity';
import { GoalTemplate } from '../../goal-template/goal-template.entity';
import { GoalKPITemplate } from '../../goal-kpi-template/goal-kpi-template.entity';
import { InvoiceEstimateHistory } from '../../invoice-estimate-history/invoice-estimate-history.entity';
import { JobSearchOccupation } from '../../employee-job-preset/job-search-occupation/job-search-occupation.entity';
import { JobPresetUpworkJobSearchCriterion } from '../../employee-job-preset/job-preset-upwork-job-search-criterion.entity';
import { JobSearchCategory } from '../../employee-job-preset/job-search-category/job-search-category.entity';
import { JobPreset } from '../../employee-job-preset/job-preset.entity';
import { KeyResultTemplate } from '../../keyresult-template/keyresult-template.entity';
import { Report } from '../../reports/report.entity';
import { ReportCategory } from '../../reports/report-category.entity';
import { ReportOrganization } from '../../reports/report-organization.entity';

@Injectable()
export class ImportAllService {
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

		@InjectRepository(EmployeeUpworkJobsSearchCriterion)
		private readonly employeeUpworkJobsSearchCriterionRepository: Repository<EmployeeUpworkJobsSearchCriterion>,

		@InjectRepository(EmployeeRecurringExpense)
		private readonly employeeRecurringExpenseRepository: Repository<EmployeeRecurringExpense>,

		@InjectRepository(EmployeeSetting)
		private readonly employeeSettingRepository: Repository<EmployeeSetting>,

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

		@InjectRepository(Goal)
		private readonly goalRepository: Repository<Goal>,

		@InjectRepository(GoalTemplate)
		private readonly goalTemplateRepository: Repository<GoalTemplate>,

		@InjectRepository(GoalGeneralSetting)
		private readonly goalGeneralSettingRepository: Repository<GoalGeneralSetting>,

		@InjectRepository(GoalKPI)
		private readonly goalKpiRepository: Repository<GoalKPI>,

		@InjectRepository(GoalKPITemplate)
		private readonly goalKpiTemplateRepository: Repository<GoalKPITemplate>,

		@InjectRepository(GoalTimeFrame)
		private readonly goalTimeFrameRepository: Repository<GoalTimeFrame>,

		@InjectRepository(HelpCenter)
		private readonly HelpCenterRepository: Repository<HelpCenter>,

		@InjectRepository(HelpCenterArticle)
		private readonly HelpCenterArticleRepository: Repository<HelpCenterArticle>,

		@InjectRepository(HelpCenterAuthor)
		private readonly HelpCenterAuthorRepository: Repository<HelpCenterAuthor>,

		@InjectRepository(Income)
		private readonly incomeRepository: Repository<Income>,

		@InjectRepository(Integration)
		private readonly integrationRepository: Repository<Integration>,

		@InjectRepository(IntegrationEntitySetting)
		private readonly integrationEntitySettingRepository: Repository<IntegrationEntitySetting>,

		@InjectRepository(IntegrationEntitySettingTiedEntity)
		private readonly integrationEntitySettingTiedEntityRepository: Repository<IntegrationEntitySettingTiedEntity>,

		@InjectRepository(IntegrationMap)
		private readonly IntegrationMapRepository: Repository<IntegrationMap>,

		@InjectRepository(IntegrationSetting)
		private readonly IntegrationSettingRepository: Repository<IntegrationSetting>,

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

		@InjectRepository(JobPresetUpworkJobSearchCriterion)
		private readonly jobPresetUpworkJobSearchCriterionRepository: Repository<JobPresetUpworkJobSearchCriterion>,

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
		private readonly sprintRepository: Repository<OrganizationSprint>,

		@InjectRepository(OrganizationTeam)
		private readonly organizationTeamRepository: Repository<OrganizationTeam>,

		@InjectRepository(OrganizationTeamEmployee)
		private readonly OrganizationTeamEmployeeRepository: Repository<OrganizationTeamEmployee>,

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
		private readonly RolePermissionsRepository: Repository<RolePermissions>,

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
		private readonly userOrganizationRepository: Repository<UserOrganization>
	) {}

	__dirname = './import/csv/';

	connection: Connection;

	/**
	 * Warning: Changing position here can be FATAL
	 */
	orderedRepositories = {
		/**
		 * These entities do not have any other dependency so need to be imported first
		 */
		countries: this.countryRepository,
		currencies: this.currencyRepository,
		skill: this.skillRepository, //TODO: This should be organization level but currently does not have any org detail
		language: this.languageRepository,
		tenant: this.tenantRepository,
		report_category: this.reportCategoryRepository,
		report: this.reportRepository,

		/**
		 * These entities need TENANT
		 */
		role: this.roleRepository,
		role_permission: this.RolePermissionsRepository,
		organization: this.organizationRepository,

		/**
		 * These entities need TENANT and ORGANIZATION
		 */
		users: this.userRepository,
		candidate: this.candidateRepository,
		user_organization: this.userOrganizationRepository,
		contact: this.contactRepository,
		report_organization: this.reportOrganizationRepository,
		job_preset: this.jobPresetRepository,
		job_search_category: this.jobSearchCategoryRepository,
		job_search_occupation: this.jobSearchOccupationRepository,
		job_preset_upwork_job_search_criterion: this
			.jobPresetUpworkJobSearchCriterionRepository,

		/**
		 * These entities need TENANT, ORGANIZATION & USER
		 */
		employee: this.employeeRepository,

		/**
		 * These entities need TENANT, ORGANIZATION & CANDIDATE
		 */
		candidate_documents: this.candidateDocumentRepository,
		candidate_education: this.candidateEducationRepository,
		candidate_experience: this.candidateExperienceRepository,
		candidate_feedbacks: this.candidateFeedbackRepository,
		candidate_interview: this.candidateInterviewRepository,
		candidate_interviews: this.candidateInterviewersRepository,
		candidate_personal_qualities: this.candidatePersonalQualitiesRepository,
		candidate_creation_rating: this.candidateCriterionsRatingRepository,
		candidate_skill: this.candidateSkillRepository,
		candidate_source: this.candidateSourceRepository,
		candidate_technologies: this.candidateTechnologiesRepository,

		activity: this.activityRepository,
		approval_policy: this.approvalPolicyRepository,
		availability_slot: this.availabilitySlotsRepository,
		appointment_employee: this.appointmentEmployeesRepository,

		deal: this.dealRepository,
		email_template: this.emailTemplateRepository,
		estimate_email: this.estimateEmailRepository,
		email: this.emailRepository,

		employee_appointment: this.employeeAppointmentRepository,
		employee_award: this.employeeAwardRepository,
		employee_proposal_template: this.employeeProposalTemplateRepository,
		employee_recurring_expense: this.employeeRecurringExpenseRepository,
		employee_setting: this.employeeSettingRepository,
		employee_upwork_job_search_criterion: this
			.employeeUpworkJobsSearchCriterionRepository,
		equipment: this.equipmentRepository,
		equipment_sharing: this.equipmentSharingRepository,
		equipment_sharing_policy: this.equipmentSharingPolicyRepository,
		event_types: this.eventTypeRepository,
		expense_category: this.expenseCategoryRepository,
		expense: this.expenseRepository,
		goal_kpi: this.goalKpiRepository,
		gosl_kpi_template: this.goalKpiTemplateRepository,
		goal_time_frame: this.goalTimeFrameRepository,
		goal: this.goalRepository,
		goal_template: this.goalTemplateRepository,
		goal_general_setting: this.goalGeneralSettingRepository,
		income: this.incomeRepository,
		integration_tenant: this.integrationTenantRepository,
		integration_entity_setting: this.integrationEntitySettingRepository,
		integration_entity_setting_tied_entity: this
			.integrationEntitySettingTiedEntityRepository,
		integration_map: this.IntegrationMapRepository,
		integration_setting: this.IntegrationSettingRepository,
		integration: this.integrationRepository,
		invite: this.inviteRepository,
		invoice_item: this.invoiceItemRepository,
		invoice: this.invoiceRepository,
		invoise_estimate_history: this.invoiceEstimateHistoryRepository,
		key_result: this.keyResultRepository,
		key_result_template: this.keyResultTemplateRepository,
		key_result_update: this.keyResultUpdateRepository,
		knowledge_base: this.HelpCenterRepository,
		knowledge_base_article: this.HelpCenterArticleRepository,
		knowledge_base_author: this.HelpCenterAuthorRepository,

		organization_award: this.organizationAwardsRepository,
		organization_contact: this.organizationContactRepository,
		organization_department: this.organizationDepartmentRepository,
		organization_document: this.organizationDocumentRepository,
		organization_employee_level: this.employeeLevelRepository,
		organization_employment_type: this.organizationEmploymentTypeRepository,
		organization_language: this.organizationLanguagesRepository,
		organization_position: this.organizationPositionsRepository,
		organization_project: this.organizationProjectsRepository,
		organization_recurring_expense: this
			.organizationRecurringExpenseRepository,
		organization_sprint: this.sprintRepository,
		organization_team_employee: this.OrganizationTeamEmployeeRepository,
		organization_team: this.organizationTeamRepository,
		organization_vendor: this.organizationVendorsRepository,

		pipeline: this.pipelineRepository,
		product_category: this.productCategoryRepository,
		product_option: this.productOptionRepository,
		product_settings: this.productVariantSettingsRepository,
		product_type: this.productTypeRepository,
		product_variant_price: this.productVariantPriceRepository,
		product_variant: this.productVariantRepository,
		product: this.productRepository,
		proposal: this.proposalRepository,
		payment: this.paymentRepository,
		request_approval: this.requestApprovalRepository,

		screenshot: this.screenShotRepository,

		stage: this.stageRepository,
		tag: this.tagRepository,
		task: this.taskRepository,

		time_log: this.timeLogRepository,
		time_slot: this.timeSlotRepository,
		time_off_policy: this.timeOffPolicyRepository,
		time_off_request: this.timeOffRequestRepository,
		timesheet: this.timeSheetRepository
	};

	async createFolder(): Promise<any> {
		return new Promise((resolve, reject) => {
			fs.access(`./import`, (error) => {
				if (!error) {
					return null;
				} else {
					fs.mkdir(`./import`, { recursive: true }, (err) => {
						if (err) reject(err);
						resolve('');
					});
				}
			});
		});
	}

	public removeExtractedFiles() {
		try {
			rimraf.sync(this.__dirname);
		} catch (error) {
			console.log(error);
		}
	}

	public async unzipAndParse(filePath, cleanup: boolean = false) {
		const file = await new FileStorage().getProvider().getFile(filePath);

		await unzipper.Open.buffer(file).then((d) =>
			d.extract({ path: this.__dirname })
		);

		this.parse(cleanup);

		// fs.createReadStream(file)
		// 	.pipe(unzipper.Extract({ path: this.__dirname }))
		// 	.on('close', () => {
		// 		console.log('Starting Import');
		// 		this.parse(cleanup);
		// 	});
	}

	parse(cleanup: boolean = false) {
		/**
		 * Can only run in a particular order
		 */
		for (const i of Object.keys(this.orderedRepositories)) {
			if (!fs.existsSync(this.__dirname + i + '.csv')) {
				// console.log('File Does Not Exist, Skipping: ', i);
				continue;
			}

			console.log('File Exists:', this.__dirname + i + '.csv');

			const results = [];

			/**
			 * This will first collect all the data and then insert
			 * If cleanup flag is set then it will also truncate the database table with CASCADE
			 */
			fs.createReadStream(this.__dirname + i + '.csv')
				.pipe(csv())
				.on('data', (data) => {
					data = this.mappedTimestampsFields(data);
					results.push(data);
				})
				.on('end', async () => {
					if (cleanup) {
						await this.orderedRepositories[i].query(
							`TRUNCATE  "${this.orderedRepositories[i].metadata.tableName}" RESTART IDENTITY CASCADE;`
						);
					}
					this.orderedRepositories[i].insert(results);
				});
		}
	}

	/*
	 * Add missing timestamps fields here
	 */
	mappedTimestampsFields(data) {
		if (data.hasOwnProperty('createdAt')) {
			data['createdAt'] = convertToDatetime(data['createdAt']);
		}
		if (data.hasOwnProperty('updatedAt')) {
			data['updatedAt'] = convertToDatetime(data['updatedAt']);
		}
		if (data.hasOwnProperty('recordedAt')) {
			data['recordedAt'] = convertToDatetime(data['recordedAt']);
		}
		if (data.hasOwnProperty('deletedAt')) {
			data['deletedAt'] = convertToDatetime(data['deletedAt']);
		}
		return data;
	}
}
