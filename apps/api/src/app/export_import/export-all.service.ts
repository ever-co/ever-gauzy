import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import * as archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import { BehaviorSubject, Subject } from 'rxjs';
import { CountryService } from '../country';
import * as csv from 'csv-writer';
import { UserService } from '../user/user.service';
import { UserOrganizationService } from '../user-organization/user-organization.services';
import { EmailService } from '../email';
import { EmailTemplateService } from '../email-template';
import { EmployeeService } from '../employee/employee.service';
import { OnDestroy } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { EmployeeRecurringExpenseService } from '../employee-recurring-expense';
import { EmployeeSettingService } from '../employee-setting';
import { EquipmentSharingService } from '../equipment-sharing';
import { ExpenseService } from '../expense/expense.service';
import { ExpenseCategoriesService } from '../expense-categories/expense-categories.service';
import { IncomeService } from '../income/income.service';
import { InviteService } from '../invite/invite.service';
import { InvoiceService } from '../invoice/invoice.service';
import { InvoiceItemService } from '../invoice-item/invoice-item.service';
import { OrganizationService } from '../organization/organization.service';
import { EmployeeLevelService } from '../organization_employeeLevel/organization-employee-level.service';
import { OrganizationContactService } from '../organization-contact/organization-contact.service';
import { OrganizationDepartmentService } from '../organization-department/organization-department.service';
import { OrganizationEmploymentTypeService } from '../organization-employment-type/organization-employment-type.service';
import { OrganizationPositionsService } from '../organization-positions/organization-positions.service';
import { OrganizationProjectsService } from '../organization-projects/organization-projects.service';
import { OrganizationRecurringExpenseService } from '../organization-recurring-expense/organization-recurring-expense.service';
import { OrganizationTeamService } from '../organization-team/organization-team.service';
import { OrganizationVendorsService } from '../organization-vendors/organization-vendors.service';
import { ProposalService } from '../proposal/proposal.service';
import { RoleService } from '../role/role.service';
import { RolePermissionsService } from '../role-permissions/role-permissions.service';
import { TagService } from '../tags/tag.service';
import { TaskService } from '../tasks/task.service';
import { TenantService } from '../tenant/tenant.service';
import { TimeOffPolicyService } from '../time-off-policy/time-off-policy.service';
import { TimeSheetService } from '../timesheet/timesheet/timesheet.service';
import { ActivityService } from '../timesheet/activity/activity.service';
import { ScreenshotService } from '../timesheet/screenshot/screenshot.service';
import { TimeSlotService } from '../timesheet/time-slot/time-slot.service';
import { TimeLogService } from '../timesheet/time-log/time-log.service';
import { AppointmentEmployeesService } from '../appointment-employees/appointment-employees.service';
import { ApprovalPolicyService } from '../approval-policy/approval-policy.service';
import { CandidateService } from '../candidate/candidate.service';
import { OrganizationTeamEmployeeService } from '../organization-team-employee/organization-team-employee.service';
import { EquipmentService } from '../equipment/equipment.service';
import { ContactService } from '../contact/contact.service';
import { TimeOffRequestService } from '../time-off-request/time-off-request.service';
import { StageService } from '../pipeline-stage/pipeline-stage.service';
import { SkillService } from '../skills/skill.service';
import { RequestApprovalService } from '../request-approval/request-approval.service';
import { ProductVariantService } from '../product-variant/product-variant.service';
import { ProductVariantPriceService } from '../product-variant-price/product-variant-price.service';
import { PaymentService } from '../payment/payment.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { ProductService } from '../product/product.service';
import { ProductCategoryService } from '../product-category/product-category.service';
import { ProductOptionService } from '../product-option/product-option.service';
import { ProductVariantSettingService } from '../product-settings/product-settings.service';
import { ProductTypeService } from '../product-type/product-type.service';
import { OrganizationSprintService } from '../organization-sprint/organization-sprint.service';
import { OrganizationLanguagesService } from '../organization-languages/organization-languages.service';
import { OrganizationAwardsService } from '../organization-awards/organization-awards.service';
import { KeyResultService } from '../keyresult/keyresult.service';
import { KeyResultUpdateService } from '../keyresult-update/keyresult-update.service';
import { IntegrationService } from '../integration/integration.service';
import { IntegrationEntitySettingService } from '../integration-entity-setting/integration-entity-setting.service';
import { IntegrationEntitySettingTiedEntityService } from '../integration-entity-setting-tied-entity/integration-entity-setting-tied-entitiy.service';
import { IntegrationMapService } from '../integration-map/integration-map.service';
import { IntegrationSettingService } from '../integration-setting/integration-setting.service';
import { IntegrationTenantService } from '../integration-tenant/integration-tenant.service';
import { HelpCenterService } from '../help-center/help-center.service';
import { HelpCenterArticleService } from '../help-center-article/help-center-article.service';
import { HelpCenterAuthorService } from '../help-center-author/help-center-author.service';
import { GoalService } from '../goal/goal.service';
import { GoalTimeFrameService } from '../goal-time-frame/goal-time-frame.service';
import { GoalKpiService } from '../goal-kpi/goal-kpi.service';
import { EventTypeService } from '../event-types/event-type.service';
import { EstimateEmailService } from '../estimate-email/estimate-email.service';
import { EmployeeAppointmentService } from '../employee-appointment';
import { DealService } from '../deal/deal.service';
import { AvailabilitySlotsService } from '../availability-slots/availability-slots.service';
import { CandidateCriterionsRatingService } from '../candidate-criterions-rating/candidate-criterion-rating.service';
import { CandidateDocumentsService } from '../candidate-documents/candidate-documents.service';
import { CandidateEducationService } from '../candidate-education/candidate-education.service';
import { CandidateExperienceService } from '../candidate-experience/candidate-experience.service';
import { CandidateFeedbacksService } from '../candidate-feedbacks/candidate-feedbacks.service';
import { CandidateInterviewService } from '../candidate-interview/candidate-interview.service';
import { CandidateInterviewersService } from '../candidate-interviewers/candidate-interviewers.service';
import { CandidatePersonalQualitiesService } from '../candidate-personal-qualities/candidate-personal-qualities.service';
import { CandidateSkillService } from '../candidate-skill/candidate-skill.service';
import { CandidateTechnologiesService } from '../candidate-technologies/candidate-technologies.service';
import { CandidateSourceService } from '../candidate-source/candidate-source.service';
import { LanguageService } from '../language/language.service';
import { OrganizationDocumentsService } from '../organization-documents/organization-documents.service';

@Injectable()
export class ExportAllService implements OnDestroy {
	public idZip = new BehaviorSubject<string>('');
	public idCsv = new BehaviorSubject<string>('');
	private _ngDestroy$ = new Subject<void>();
	private services = [
		{ service: this.activityService, nameFile: 'activity' },
		{
			service: this.appointmentEmployeeService,
			nameFile: 'appointment_employees'
		},
		{ service: this.approvalPolicyService, nameFile: 'approval_policy' },
		{
			service: this.availabilitySlotsService,
			nameFile: 'availability_slots'
		},

		{ service: this.candidateService, nameFile: 'candidate' },
		{
			service: this.candidateCrieationsRatingService,
			nameFile: 'candidate_creation_rating'
		},
		{
			service: this.candidateDocumnetsService,
			nameFile: 'candidate_documents'
		},
		{
			service: this.candidateEducationService,
			nameFile: 'candidate_education'
		},
		{
			service: this.candidateExperienceService,
			nameFile: 'candidate_experience'
		},
		{
			service: this.candidateFeedbacksService,
			nameFile: 'candidate_feedbacks'
		},
		{
			service: this.candidateInterviewService,
			nameFile: 'candidate_interview'
		},
		{
			service: this.candidateInterviewsService,
			nameFile: 'candidate_interviews'
		},
		{
			service: this.candidatePersonalQualitiesService,
			nameFile: 'candidate_personal_qualities'
		},
		{ service: this.candidateSkillService, nameFile: 'candidate_skill' },
		{ service: this.candidateSourceService, nameFile: 'candidate_source' },
		{
			service: this.candidateTechnologiesService,
			nameFile: 'candidate_technologies'
		},
		{ service: this.contactService, nameFile: 'contact' },
		{ service: this.countryService, nameFile: 'countries' },

		{ service: this.dealService, nameFile: 'deal' },

		{ service: this.emailService, nameFile: 'email' },
		{ service: this.emailTemplate, nameFile: 'email_template' },
		{ service: this.estimateEmailService, nameFile: 'estimate_email' },
		{ service: this.employeeService, nameFile: 'employee' },
		{
			service: this.employeeAppointmentService,
			nameFile: 'employee_appointment'
		},
		{
			service: this.employeeRecurringExpensesService,
			nameFile: 'employee_recurring_expense'
		},
		{ service: this.employeeSettingService, nameFile: 'employee_setting' },
		{ service: this.equpmentService, nameFile: 'equipment' },
		{
			service: this.equipmentSharingService,
			nameFile: 'equipment_sharing'
		},
		{ service: this.eventTypesService, nameFile: 'event_types' },
		{ service: this.expenseService, nameFile: 'expense' },
		{
			service: this.expenseCategoriesService,
			nameFile: 'expense_category'
		},

		{ service: this.goalService, nameFile: 'goal' },
		{ service: this.goalKpiService, nameFile: 'goal_kpi' },
		{ service: this.goalTimeFrameService, nameFile: 'goal_time_frame' },

		{ service: this.helpCenterService, nameFile: 'knowledge_base' },
		{
			service: this.helpCenterArticleService,
			nameFile: 'knowledge_base_article'
		},
		{
			service: this.helpCenterAuthorService,
			nameFile: 'knowledge_base_author'
		},

		{ service: this.incomeService, nameFile: 'income' },
		{ service: this.integrationService, nameFile: 'integration' },
		{
			service: this.integrationEntitySettingService,
			nameFile: 'integration_entity_setting'
		},
		{
			service: this.integrationEntitySettingTiedEntityService,
			nameFile: 'integration_entity_setting_tied_entity'
		},
		{ service: this.integrationMapService, nameFile: 'integration_map' },
		{
			service: this.integrationSettingService,
			nameFile: 'integration_setting'
		},
		{
			service: this.integrationTenantService,
			nameFile: 'integration_tenant'
		},
		{ service: this.inviteService, nameFile: 'invite' },
		{ service: this.invoiceService, nameFile: 'invoice' },
		{ service: this.invoiceItemService, nameFile: 'invoice_item' },

		{ service: this.keyResultService, nameFile: 'key_result' },
		{ service: this.keyResultUpdateService, nameFile: 'key_result_update' },

		{ service: this.languageService, nameFile: 'language' },

		{
			service: this.organizationAwardsService,
			nameFile: 'organization_awards'
		},
		{ service: this.organizationService, nameFile: 'organization' },
		{
			service: this.employeeLevelService,
			nameFile: 'organization_employee_level'
		},
		{
			service: this.organizationContactService,
			nameFile: 'organization_contact'
		},
		{
			service: this.organizationDepartmentService,
			nameFile: 'organization_department'
		},
		{
			service: this.organizationDocumnetService,
			nameFile: 'organization_document'
		},
		{
			service: this.organizationLanguagesService,
			nameFile: 'organization_language'
		},
		{
			service: this.organizationEmploymentTypeService,
			nameFile: 'organization_employment_type'
		},
		{
			service: this.organizationPositionsService,
			nameFile: 'organization_position'
		},
		{
			service: this.organizationProjectsService,
			nameFile: 'organization_project'
		},
		{
			service: this.organizationRecurringExpenseService,
			nameFile: 'organization_recurring_expense'
		},
		{
			service: this.organizationSprintService,
			nameFile: 'organization_sprint'
		},
		{
			service: this.organizationTeamEmployeeService,
			nameFile: 'organization_team_employee'
		},
		{
			service: this.organizationTeamService,
			nameFile: 'organization_team'
		},
		{
			service: this.organizationVendorsService,
			nameFile: 'organization_vendor'
		},

		{ service: this.paymentService, nameFile: 'payment' },
		{ service: this.pipelineService, nameFile: 'pipeline' },
		{ service: this.productService, nameFile: 'product' },
		{ service: this.productCategoryService, nameFile: 'product_category' },
		{ service: this.productOptionService, nameFile: 'product_option' },
		{ service: this.productSettingsService, nameFile: 'product_settings' },
		{ service: this.productTypeService, nameFile: 'product_type' },
		{ service: this.productVariantService, nameFile: 'product_variant' },
		{
			service: this.productVariantPriceService,
			nameFile: 'product_variant_price'
		},
		{ service: this.proposalService, nameFile: 'proposal' },

		{ service: this.requestApprovalService, nameFile: 'request_approval' },
		{ service: this.roleService, nameFile: 'role' },
		{ service: this.rolePermissionsService, nameFile: 'role_permission' },

		{ service: this.screenShotService, nameFile: 'screenshot' },
		{ service: this.skillSevice, nameFile: 'skill' },
		{ service: this.stageService, nameFile: 'stage' },

		{ service: this.tagService, nameFile: 'tag' },
		{ service: this.taskService, nameFile: 'task' },
		{ service: this.tenantService, nameFile: 'tenant' },
		{ service: this.timeOffPolicyService, nameFile: 'time-off-policy' },
		{ service: this.timeOffRequestService, nameFile: 'time-off-request' },
		{ service: this.timeSheetService, nameFile: 'timesheet' },
		{ service: this.timeLogService, nameFile: 'time_log' },
		{ service: this.timeSlotService, nameFile: 'time_slot' },

		{ service: this.userService, nameFile: 'users' },
		{
			service: this.userOrganizationService,
			nameFile: 'user_organization'
		}
	];

	constructor(
		private activityService: ActivityService,
		private appointmentEmployeeService: AppointmentEmployeesService,
		private approvalPolicyService: ApprovalPolicyService,
		private availabilitySlotsService: AvailabilitySlotsService,

		private candidateService: CandidateService,
		private candidateCrieationsRatingService: CandidateCriterionsRatingService,
		private candidateDocumnetsService: CandidateDocumentsService,
		private candidateEducationService: CandidateEducationService,
		private candidateExperienceService: CandidateExperienceService,
		private candidateFeedbacksService: CandidateFeedbacksService,
		private candidateInterviewService: CandidateInterviewService,
		private candidateInterviewsService: CandidateInterviewersService,
		private candidatePersonalQualitiesService: CandidatePersonalQualitiesService,
		private candidateSkillService: CandidateSkillService,
		private candidateSourceService: CandidateSourceService,
		private candidateTechnologiesService: CandidateTechnologiesService,
		private contactService: ContactService,
		private countryService: CountryService,

		private dealService: DealService,

		private emailService: EmailService,
		private emailTemplate: EmailTemplateService,
		private employeeService: EmployeeService,
		private employeeAppointmentService: EmployeeAppointmentService,
		private employeeRecurringExpensesService: EmployeeRecurringExpenseService,
		private employeeSettingService: EmployeeSettingService,
		private equpmentService: EquipmentService,
		private equipmentSharingService: EquipmentSharingService,
		private estimateEmailService: EstimateEmailService,
		private eventTypesService: EventTypeService,
		private expenseService: ExpenseService,
		private expenseCategoriesService: ExpenseCategoriesService,
		private employeeLevelService: EmployeeLevelService,

		private goalService: GoalService,
		private goalKpiService: GoalKpiService,
		private goalTimeFrameService: GoalTimeFrameService,

		private helpCenterService: HelpCenterService,
		private helpCenterArticleService: HelpCenterArticleService,
		private helpCenterAuthorService: HelpCenterAuthorService,

		private incomeService: IncomeService,
		private integrationService: IntegrationService,
		private integrationEntitySettingService: IntegrationEntitySettingService,
		private integrationEntitySettingTiedEntityService: IntegrationEntitySettingTiedEntityService,
		private integrationMapService: IntegrationMapService,
		private integrationSettingService: IntegrationSettingService,
		private integrationTenantService: IntegrationTenantService,
		private inviteService: InviteService,
		private invoiceService: InvoiceService,
		private invoiceItemService: InvoiceItemService,

		private keyResultService: KeyResultService,
		private keyResultUpdateService: KeyResultUpdateService,

		private languageService: LanguageService,

		private organizationService: OrganizationService,
		private organizationAwardsService: OrganizationAwardsService,
		private organizationContactService: OrganizationContactService,
		private organizationDepartmentService: OrganizationDepartmentService,
		private organizationDocumnetService: OrganizationDocumentsService,
		private organizationEmploymentTypeService: OrganizationEmploymentTypeService,
		private organizationLanguagesService: OrganizationLanguagesService,
		private organizationPositionsService: OrganizationPositionsService,
		private organizationProjectsService: OrganizationProjectsService,
		private organizationRecurringExpenseService: OrganizationRecurringExpenseService,
		private organizationSprintService: OrganizationSprintService,
		private organizationTeamService: OrganizationTeamService,
		private organizationTeamEmployeeService: OrganizationTeamEmployeeService,
		private organizationVendorsService: OrganizationVendorsService,

		private paymentService: PaymentService,
		private pipelineService: PipelineService,
		private productService: ProductService,
		private productCategoryService: ProductCategoryService,
		private productOptionService: ProductOptionService,
		private productSettingsService: ProductVariantSettingService,
		private productTypeService: ProductTypeService,
		private productVariantService: ProductVariantService,
		private productVariantPriceService: ProductVariantPriceService,
		private proposalService: ProposalService,

		private requestApprovalService: RequestApprovalService,
		private roleService: RoleService,
		private rolePermissionsService: RolePermissionsService,

		private screenShotService: ScreenshotService,
		private skillSevice: SkillService,
		private stageService: StageService,

		private tagService: TagService,
		private taskService: TaskService,
		private tenantService: TenantService,
		private timeOffPolicyService: TimeOffPolicyService,
		private timeOffRequestService: TimeOffRequestService,
		private timeSheetService: TimeSheetService,
		private timeLogService: TimeLogService,
		private timeSlotService: TimeSlotService,

		private userService: UserService,
		private userOrganizationService: UserOrganizationService
	) {}

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
							resolve();
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
					resolve();
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
				this.idCsv
					.pipe(takeUntil(this._ngDestroy$))
					.subscribe((idCsv) => {
						id$ = idCsv;
					});

				archive.pipe(output);
				archive.directory(`./export/${id$}/csv`, false);
				archive.finalize();
			}
		});
	}

	async getAsCsv(service_count: number): Promise<any> {
		const incommingData = (
			await this.services[service_count].service.findAll()
		).items;

		if (incommingData[0] !== undefined) {
			return new Promise((resolve, reject) => {
				const createCsvWriter = csv.createObjectCsvWriter;
				const dataIn = [];

				const dataKeys = Object.keys(incommingData[0]);

				for (const count of dataKeys) {
					dataIn.push({ id: count, title: count });
				}

				let id$ = '';
				this.idCsv.pipe(takeUntil(this._ngDestroy$)).subscribe((id) => {
					id$ = id;
				});

				const csvWriter = createCsvWriter({
					path: `./export/${id$}/csv/${this.services[service_count].nameFile}.csv`,
					header: dataIn
				});

				const data = incommingData;

				csvWriter.writeRecords(data).then(() => {
					resolve();
				});
			});
		}
	}

	async downloadToUser(res): Promise<any> {
		return new Promise((resolve, reject) => {
			let fileName = '';

			this.idZip
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((filename) => {
					fileName = filename;
				});
			res.download(`./export/${fileName}`);

			resolve();
		});
	}

	async downloadTemplate(res) {
		return new Promise((resolve, reject) => {
			res.download('./export/template.zip');
			resolve();
		});
	}

	async deleteCsvFiles(): Promise<any> {
		return new Promise((resolve, reject) => {
			let id$ = '';

			this.idCsv.pipe(takeUntil(this._ngDestroy$)).subscribe((id) => {
				id$ = id;
			});

			fs.access(`./export/${id$}`, (error) => {
				if (!error) {
					fse.removeSync(`./export/${id$}`);
					resolve();
				} else {
					return null;
				}
			});
		});
	}
	async deleteArchive(): Promise<any> {
		return new Promise((resolve, reject) => {
			let fileName = '';
			this.idZip
				.pipe(takeUntil(this._ngDestroy$))
				.subscribe((fileName$) => {
					fileName = fileName$;
				});

			fs.access(`./export/${fileName}`, (error) => {
				if (!error) {
					fse.removeSync(`./export/${fileName}`);
					resolve();
				} else {
					return null;
				}
			});
		});
	}

	async exportTables() {
		return new Promise(async (resolve, reject) => {
			for (const [i] of this.services.entries()) {
				await this.getAsCsv(i);
			}
			resolve();
		});
	}

	ngOnDestroy() {
		this._ngDestroy$.next();
		this._ngDestroy$.complete();
	}
}
