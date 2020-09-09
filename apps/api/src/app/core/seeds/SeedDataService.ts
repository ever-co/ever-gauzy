// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import * as rimraf from 'rimraf';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import {
	Connection,
	createConnection,
	getRepository,
	ConnectionOptions,
	getConnection
} from 'typeorm';
import chalk from 'chalk';
import { environment as env } from '@env-api/environment';
import { Role } from '../../role/role.entity';
import { createRoles } from '../../role/role.seed';
import { createSkills } from '../../skills/skill.seed';
import { createLanguages } from '../../language/language.seed';
import { User } from '../../user/user.entity';
import {
	createDefaultSuperAdminUsers,
	createDefaultUsers,
	createRandomSuperAdminUsers,
	createRandomUsers
} from '../../user/user.seed';
import { Employee } from '../../employee/employee.entity';
import {
	createDefaultEmployees,
	createRandomEmployees
} from '../../employee/employee.seed';
import { Organization } from '../../organization/organization.entity';
import {
	createDefaultOrganizations,
	createRandomOrganizations
} from '../../organization/organization.seed';
import {
	createDefaultIncomes,
	createRandomIncomes
} from '../../income/income.seed';
import {
	createDefaultExpenses,
	createRandomExpenses
} from '../../expense/expense.seed';
import {
	createDefaultUsersOrganizations,
	createRandomUsersOrganizations
} from '../../user-organization/user-organization.seed';
import { createCountries } from '../../country/country.seed';
import {
	createDefaultTeams,
	createRandomTeam
} from '../../organization-team/organization-team.seed';
import { createRolePermissions } from '../../role-permissions/role-permissions.seed';
import {
	createDefaultTenants,
	createRandomTenants
} from '../../tenant/tenant.seed';
import { createDefaultEmailTemplates } from '../../email-template/email-template.seed';
import {
	seedDefaultEmploymentTypes,
	seedRandomEmploymentTypes
} from '../../organization-employment-type/organization-employment-type.seed';
import { createEmployeeLevels } from '../../organization_employeeLevel/organization-employee-level.seed';
import {
	createDefaultTimeOffPolicy,
	createRandomTimeOffPolicies
} from '../../time-off-policy/time-off-policy.seed';
import {
	createDefaultApprovalPolicyForOrg,
	createRandomApprovalPolicyForOrg
} from '../../approval-policy/approval-policy.seed';
import {
	createExpenseCategories,
	createRandomExpenseCategories
} from '../../expense-categories/expense-categories.seed';
import {
	createOrganizationVendors,
	createRandomOrganizationVendors
} from '../../organization-vendors/organization-vendors.seed';
import { OrganizationProjects } from '../../organization-projects/organization-projects.entity';
import {
	createDefaultCandidates,
	createRandomCandidates
} from '../../candidate/candidate.seed';
import { Tenant } from './../../tenant/tenant.entity';
import {
	createCandidateSources,
	createRandomCandidateSources
} from '../../candidate-source/candidate-source.seed';
import { createDefaultIntegrationTypes } from '../../integration/integration-type.seed';
import { createDefaultIntegrations } from '../../integration/integration.seed';
import { createHelpCenter } from '../../help-center/help-center.seed';
import {
	createDefaultProducts,
	createRandomProduct
} from '../../product/product.seed';
import {
	createCandidateDocuments,
	createRandomCandidateDocuments
} from '../../candidate-documents/candidate-documents.seed';
import {
	createCandidateFeedbacks,
	createRandomCandidateFeedbacks
} from '../../candidate-feedbacks/candidate-feedbacks.seed';

import {
	createDefaultTimeSheet,
	createRandomTimesheet
} from '../../timesheet/timesheet/timesheet.seed';
import { createDefaultTask, createRandomTask } from '../../tasks/task.seed';
import {
	createDefaultOrganizationProjects,
	createRandomOrganizationProjects
} from '../../organization-projects/organization-projects.seed';
import { createDefaultTimeFrames } from '../../goal-time-frame/goal-time-frame.seed';
import {
	createDefaultGoals,
	createRandomGoal,
	updateDefaultGoalProgress
} from '../../goal/goal.seed';
import {
	createDefaultKeyResults,
	createRandomKeyResult,
	updateDefaultKeyResultProgress
} from '../../keyresult/keyresult.seed';
import { createDefaultKeyResultUpdates } from '../../keyresult-update/keyresult-update.seed';
import {
	seedRandomOrganizationDepartments,
	createDefaultOrganizationDepartments
} from '../../organization-department/organization-department.seed';
import {
	seedDefaultOrganizationPosition,
	seedRandomOrganizationPosition
} from '../../organization-positions/organization-position.seed';
import {
	createDefaultTags,
	createRandomOrganizationTags,
	createTags
} from '../../tags/tag.seed';
import {
	createDefaultEmailSent,
	createRandomEmailSent
} from '../../email/email.seed';
import {
	createDefaultEmployeeInviteSent,
	createRandomEmployeeInviteSent
} from '../../invite/invite.seed';
import { createRandomRequestApproval } from '../../request-approval/request-approval.seed';
import {
	createDefaultEmployeeTimeOff,
	createRandomEmployeeTimeOff
} from '../../time-off-request/time-off-request.seed';
import {
	createOrganizationDocuments,
	createRandomOrganizationDocuments
} from '../../organization-documents/organization-documents.seed';
import {
	createDefaultEquipments,
	createRandomEquipments
} from '../../equipment/equipment.seed';
import {
	createDefaultEquipmentSharing,
	createRandomEquipmentSharing
} from '../../equipment-sharing/equipment-sharing.seed';
import {
	createDefaultProposals,
	createRandomProposals
} from '../../proposal/proposal.seed';
import { createRandomInvoiceItem } from '../../invoice-item/invoice-item.seed';
import {
	createDefaultInvoice,
	createRandomInvoice
} from '../../invoice/invoice.seed';
import {
	createCandidateSkills,
	createRandomCandidateSkills
} from '../../candidate-skill/candidate-skill.seed';
import { createRandomCandidateExperience } from '../../candidate-experience/candidate-experience.seed';
import {
	createCandidateEducations,
	createRandomCandidateEducations
} from '../../candidate-education/candidate-education.seed';
import { createRandomContacts } from '../../contact/contact.seed';
import {
	createRandomOrganizationContact,
	createDefaultOrganizationContact
} from '../../organization-contact/organization-contact.seed';
import {
	createDefaultAvailabilitySlots,
	createRandomAvailabilitySlots
} from '../../availability-slots/availability-slots.seed';
import {
	createDefaultCandidatePersonalQualities,
	createRandomCandidatePersonalQualities
} from '../../candidate-personal-qualities/candidate-personal-qualities.seed';
import {
	createDefaultCandidateTechnologies,
	createRandomCandidateTechnologies
} from '../../candidate-technologies/candidate-technologies.seed';
import {
	createDefaultCandidateInterview,
	createRandomCandidateInterview
} from '../../candidate-interview/candidate-interview.seed';
import {
	createDefaultAwards,
	createRandomAwards
} from '../../organization-awards/organization-awards.seed';
import { createDefaultGeneralGoalSetting } from '../../goal-general-setting/goal-general-setting.seed';
import {
	createDefaultCandidateCriterionRating,
	createRandomCandidateCriterionRating
} from '../../candidate-criterions-rating/candidate-criterion-rating.seed';
import { createDefaultGoalKpi } from '../../goal-kpi/goal-kpi.seed';
import { createRandomEmployeeSetting } from '../../employee-setting/employee-setting.seed';
import { createRandomEmployeeRecurringExpense } from '../../employee-recurring-expense/employee-recurring-expense.seed';
import {
	createDefaultCandidateInterviewers,
	createRandomCandidateInterviewers
} from '../../candidate-interviewers/candidate-interviewers.seed';
import { createRandomPipelineStage } from '../../pipeline-stage/pipeline-stage.seed';
import {
	createDefaultPipeline,
	createRandomPipeline
} from '../../pipeline/pipeline.seed';
import {
	createDefaultOrganizationRecurringExpense,
	createRandomOrganizationRecurringExpense
} from '../../organization-recurring-expense/organization-recurring-expense.seed';
import {
	createDefaultHelpCenterAuthor,
	createRandomHelpCenterAuthor
} from '../../help-center-author/help-center-author.seed';
import { createHelpCenterArticle } from '../../help-center-article/help-center-article.seed';
import {
	createDefaultOrganizationLanguage,
	createRandomOrganizationLanguage
} from '../../organization-languages/organization-languages.seed';
import { createRandomOrganizationSprint } from '../../organization-sprint/organization-sprint.seed';
import { createRandomOrganizationTeamEmployee } from '../../organization-team-employee/organization-team-employee.seed';
import { createRandomAppointmentEmployees } from '../../appointment-employees/appointment-employees.seed';
import {
	createDefaultEmployeeAppointment,
	createRandomEmployeeAppointment
} from '../../employee-appointment/employee-appointment.seed';
import { createRandomDeal } from '../../deal/deal.seed';
import { createRandomIntegrationSetting } from '../../integration-setting/integration-setting.seed';
import { createRandomIntegrationMap } from '../../integration-map/integration-map.seed';
import { createRandomIntegrationTenant } from '../../integration-tenant/integration-tenant.seed';
import { createRandomIntegrationEntitySettingTiedEntity } from '../../integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.seed';
import { createRandomIntegrationEntitySetting } from '../../integration-entity-setting/integration-entity-setting.seed';
import { createRandomRequestApprovalTeam } from '../../request-approval-team/request-approval-team.seed';
import { createRandomRequestApprovalEmployee } from '../../request-approval-employee/request-approval-employee.seed';
import {
	createDefaultPayment,
	createRandomPayment
} from '../../payment/payment.seed';
import {
	createDefaultEventTypes,
	createRandomEventType
} from '../../event-types/event-type.seed';
import {
	createDefaultEquipmentSharingPolicyForOrg,
	createRandomEquipmentSharingPolicyForOrg
} from '../../equipment-sharing-policy/equipment-sharing-policy.seed';
import { createRandomProductOption } from '../../product-option/product-option.seed';
import { createRandomProductVariantSettings } from '../../product-settings/product-settings.seed';
import { createRandomProductVariant } from '../../product-variant/product-variant.seed';
import { createRandomProductVariantPrice } from '../../product-variant-price/product-variant-price.seed';
import {
	createCategories,
	createRandomCategories
} from '../../product-category/category.seed';
import {
	createDefaultProductType,
	createRandomProductType
} from '../../product-type/type.seed';
import { createDefaultGoalTemplates } from '../../goal-template/goal-template.seed';
import { createDefaultKeyResultTemplates } from '../../keyresult-template/keyresult-template.seed';
import { createDefaultEmployeeAwards } from '../../employee-award/employee-award.seed';
import { allEntities } from './allEntity';
import { createDefaultGoalKpiTemplate } from '../../goal-kpi-template/goal-kpi-template.seed';

const randomSeedConfig = {
	tenants: 5, //The number of random tenants to be seeded.
	organizationsPerTenant: 2, //No of random organizations seeded will be (organizationsPerTenant * tenants)
	employeesPerOrganization: 5, //No of random employees seeded will be (employeesPerOrganization * organizationsPerTenant * tenants)
	candidatesPerOrganization: 2, //No of random employees seeded will be (candidatesPerOrganization * organizationsPerTenant * tenants)
	managersPerOrganization: 2, //No of random manager seeded will be (managersPerOrganization * organizationsPerTenant * tenants)
	dataEntriesPerOrganization: 4, //No of random data entry users seeded will be (dataEntriesPerOrganization * organizationsPerTenant * tenants)
	viewersPerOrganization: 4, //No of random viewers seeded will be (viewersPerOrganization * organizationsPerTenant * tenants)
	projectsPerOrganization: 30, // No of random projects seeded will be  (projectsPerOrganization * organizationsPerTenant * tenants)
	emailsPerOrganization: 30, // No of random emails seeded will be  (emailsPerOrganization * organizationsPerTenant * tenants)
	invitePerOrganization: 30, // No of random emails seeded will be  (emailsPerOrganization * organizationsPerTenant * tenants)
	requestApprovalPerOrganization: 20, // No of random request to approve seeded will be  (requestApprovalPerOrganization * organizationsPerTenant * tenants)
	employeeTimeOffPerOrganization: 10, // No of time off request to approve seeded will be  (employeeTimeOffPerOrganization * organizationsPerTenant * tenants)
	equipmentPerTenant: 20, // No of equipmentPerTenant request to approve seeded will be  (equipmentPerTenant * tenants)
	equipmentSharingPerTenant: 20, // No of equipmentSharingPerTenant request to approve seeded will be  (equipmentSharingPerTenant * tenants)
	proposalsSharingPerOrganizations: 30, // No of proposalsSharingPerOrganizations request to approve seeded will be  (proposalsSharingPerOrganizations * tenants * organizations)
	contacts: 50, // The number of random contacts to be seeded.
	noOfHelpCenterArticle: 10, // The number of random Help Center Articles.
	availabilitySlotsPerOrganization: 50, // No of availability slots request to approve seeded will be  (availabilitySlotsPerOrganization * organizationsPerTenant * tenants)
	noOfTimeLogsPerTimeSheet: 5, // No of time logs entry per time sheets
	numberOfOptionPerProduct: 5, // number of product options per product
	numberOfVariantPerProduct: 5 // number of product variant per product
};

@Injectable()
export class SeedDataService {
	connection: Connection;
	log = console.log;
	organizations: Organization[];
	defaultProjects: OrganizationProjects[] | void;
	tenant: Tenant;
	roles: Role[];
	superAdminUsers: User[];
	defaultCandidateUsers: User[];
	defaultEmployees: Employee[];

	constructor() {}

	/**
	 * This config is applied only for `yarn seed:*` type calls because
	 * that is when connection is created by this service itself.
	 */
	overrideDbConfig = {
		logging: true,
		logger: 'file' //Removes console logging, instead logs all queries in a file ormlogs.log
	};

	private async cleanUpPreviousRuns() {
		this.log(chalk.green(`CLEANING UP FROM PREVIOUS RUNS...`));

		await new Promise((resolve, reject) => {
			const dir = path.join(
				process.cwd(),
				'apps',
				'api',
				'public',
				'screenshots'
			);

			// delete old generated screenshots
			rimraf(dir, () => {
				this.log(chalk.green(`CLEANED UP`));
				resolve();
			});
		});
	}

	private async createConnection() {
		try {
			this.connection = getConnection();
		} catch (error) {
			this.log(
				'NOTE: DATABASE CONNECTION DOES NOT EXIST YET. NEW ONE WILL BE CREATED!'
			);
		}

		if (!this.connection || !this.connection.isConnected) {
			try {
				this.log(chalk.green(`CONNECTING TO DATABASE ...`));

				this.connection = await createConnection({
					...env.database,
					...this.overrideDbConfig,
					entities: allEntities
				} as ConnectionOptions);
			} catch (error) {
				this.handleError(error, 'Unable to connect to database');
			}
		}
	}

	/**
	 * Use this wrapper function for all seed functions which are not essential.
	 * Essentials seeds are ONLY those which are required to start the UI/login
	 */
	tryExecute<T>(name: string, p: Promise<T>): Promise<T> | Promise<void> {
		this.log(chalk.green(`SEEDING ${name}`));

		return (p as any).then(
			(x: T) => x,
			(error: Error) => {
				this.log(
					chalk.bgRed(
						`🛑 ERROR: ${error ? error.message : 'unknown'}`
					)
				);
			}
		);
	}

	/**
	 * Seed data
	 */
	public async run(isDefault: boolean) {
		try {
			await this.cleanUpPreviousRuns();

			// Connect to database
			await this.createConnection();

			// Reset database to start with new, fresh data
			await this.resetDatabase();

			// Seed data with mock / fake data
			await this.seedData(isDefault);

			console.log('Database Seed completed');
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Populate database with mock data
	 */
	private async seedData(isDefault: boolean) {
		try {
			this.log(
				chalk.green(
					`🌱 SEEDING ${
						env.production ? 'PRODUCTION' : ''
					} DATABASE...`
				)
			);

			//Seed data which only needs connection

			await this.tryExecute(
				'Default Email Templates',
				createDefaultEmailTemplates(this.connection)
			);

			await this.tryExecute(
				'Countries',
				createCountries(this.connection)
			);

			await this.seedBasicDefaultData();

			if (!isDefault) {
				await this.seedDefaultData();
				await this.seedRandomData();
			}

			this.log(
				chalk.green(
					`✅ SEEDED ${env.production ? 'PRODUCTION' : ''} DATABASE`
				)
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/** Populate Database with Basic Default Data **/
	private async seedBasicDefaultData() {
		//Platform level data

		await this.tryExecute('Skills', createSkills(this.connection));
		await this.tryExecute('Languages', createLanguages(this.connection));

		this.tenant = await createDefaultTenants(this.connection);

		this.roles = await createRoles(this.connection, [this.tenant]);

		await createRolePermissions(this.connection, this.roles, [this.tenant]);

		await this.tryExecute(
			'Contacts',
			createRandomContacts(this.connection, 5)
		);

		//Tenant level inserts which only need connection, tenant, roles
		const defaultOrganizations = await createDefaultOrganizations(
			this.connection,
			this.tenant
		);

		this.organizations = defaultOrganizations;

		this.superAdminUsers = await createDefaultSuperAdminUsers(
			this.connection,
			this.roles,
			this.tenant
		);
		const {
			adminUsers,
			defaultEmployeeUsers,
			defaultCandidateUsers
		} = await createDefaultUsers(this.connection, this.roles, this.tenant);

		this.defaultCandidateUsers = defaultCandidateUsers;

		await createDefaultUsersOrganizations(this.connection, {
			organizations: this.organizations,
			users: [
				...defaultEmployeeUsers,
				...adminUsers,
				...this.superAdminUsers
			]
		});

		//User level data that needs connection, tenant, organization, role, users
		this.defaultEmployees = await createDefaultEmployees(this.connection, {
			tenant: this.tenant,
			org: this.organizations[0],
			users: defaultEmployeeUsers
		});

		await this.tryExecute(
			'Default Employee Invite',
			createDefaultEmployeeInviteSent(
				this.connection,
				this.tenant,
				this.organizations,
				this.superAdminUsers
			)
		);

		await this.tryExecute(
			'Default General Goal Setting',
			createDefaultGeneralGoalSetting(
				this.connection,
				this.tenant,
				this.organizations
			)
		);

		await this.tryExecute(
			'Default Goal Template',
			createDefaultGoalTemplates(this.connection, this.tenant)
		);

		await this.tryExecute(
			'Default Goal KPI Template',
			createDefaultGoalKpiTemplate(this.connection, this.tenant)
		);

		await this.tryExecute(
			'Default Key Result Template',
			createDefaultKeyResultTemplates(this.connection, this.tenant)
		);

		await this.tryExecute(
			'Default Time Off Policy',
			createDefaultTimeOffPolicy(this.connection, {
				org: this.organizations[0],
				employees: this.defaultEmployees
			})
		);

		//seed default integrations with types
		const integrationTypes = await this.tryExecute(
			'Default Integration Types',
			createDefaultIntegrationTypes(this.connection)
		);

		await this.tryExecute(
			'Default Integrations',
			createDefaultIntegrations(this.connection, this.tenant, integrationTypes)
		);
	}

	/**
	 * Populate default data from env files
	 */
	private async seedDefaultData() {
		//Organization level inserts which need connection, tenant, role, organizations
		const categories = await this.tryExecute(
			'Expense Categories',
			createExpenseCategories(this.connection, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Employee Levels',
			createEmployeeLevels(this.connection, this.organizations)
		);

		//todo :  Need to fix error of seeding Product Category
		await this.tryExecute(
			'Categories',
			createCategories(this.connection, this.organizations)
		);

		await this.tryExecute(
			'Default Product Types',
			createDefaultProductType(this.connection, this.organizations)
		);

		await this.tryExecute(
			'Default Organization Contacts',
			createDefaultOrganizationContact(this.connection)
		);

		//Employee level data that need connection, tenant, organization, role, users, employee
		await this.tryExecute(
			'Default Teams',
			createDefaultTeams(
				this.connection,
				this.organizations[0],
				this.defaultEmployees,
				this.roles
			)
		);

		this.defaultProjects = await this.tryExecute(
			'Default Organization Projects',
			createDefaultOrganizationProjects(
				this.connection,
				this.organizations
			)
		);

		await this.tryExecute(
			'Default Projects Task',
			createDefaultTask(this.connection)
		);

		await this.tryExecute(
			'Default Organization Departments',
			createDefaultOrganizationDepartments(
				this.connection,
				this.organizations
			)
		);

		await this.tryExecute(
			'Default Products',
			createDefaultProducts(this.connection, this.tenant)
		);

		await this.tryExecute(
			'Default Time Frames',
			createDefaultTimeFrames(
				this.connection,
				this.tenant,
				this.organizations
			)
		);

		await this.tryExecute(
			'Default Tags',
			createDefaultTags(this.connection, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Equipments',
			createDefaultEquipments(this.connection, this.tenant)
		);

		const organizationVendors = await this.tryExecute(
			'Organization Vendors',
			createOrganizationVendors(this.connection, this.organizations)
		);

		await this.tryExecute(
			'Help Centers',
			createHelpCenter(this.connection, {
				tenant: this.tenant,
				org: this.organizations[0]
			})
		);

		const defaultCandidates = await this.tryExecute(
			'Candidates',
			createDefaultCandidates(this.connection, {
				tenant: this.tenant,
				org: this.organizations[0],
				users: [...this.defaultCandidateUsers]
			})
		);

		await this.tryExecute(
			'Candidate Sources',
			createCandidateSources(this.connection, defaultCandidates)
		);

		await this.tryExecute(
			'Candidate Documents',
			createCandidateDocuments(this.connection, this.tenant, defaultCandidates)
		);
		await this.tryExecute(
			'Default candidate interview',
			createDefaultCandidateInterview(this.connection, defaultCandidates)
		);

		await this.tryExecute(
			'Default candidate interviewers',
			createDefaultCandidateInterviewers(
				this.connection,
				this.defaultEmployees,
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Candidate Feedbacks',
			createCandidateFeedbacks(this.connection, defaultCandidates)
		);

		await this.tryExecute(
			'Candidate Educations',
			createCandidateEducations(this.connection, defaultCandidates)
		);

		await this.tryExecute(
			'Candidate Skills',
			createCandidateSkills(this.connection, defaultCandidates)
		);

		await this.tryExecute(
			'Default Incomes',
			createDefaultIncomes(this.connection, {
				organizations: this.organizations,
				employees: this.defaultEmployees
			})
		);

		await this.tryExecute(
			'Default Expenses',
			createDefaultExpenses(this.connection, {
				organizations: this.organizations,
        tenant: this.tenant,
				employees: this.defaultEmployees,
				categories,
				organizationVendors
			})
		);

		await this.tryExecute(
			'Default Employment Types',
			seedDefaultEmploymentTypes(
				this.connection,
				this.defaultEmployees,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			'Default Goal KPIs',
			createDefaultGoalKpi(
				this.connection,
				this.tenant,
				this.organizations,
				this.defaultEmployees
			)
		);

		const goals = await this.tryExecute(
			'Default Goals',
			createDefaultGoals(
				this.connection,
				this.tenant,
				this.organizations,
				this.defaultEmployees
			)
		);

		const keyResults = await this.tryExecute(
			'Default Key Results',
			createDefaultKeyResults(
				this.connection,
				this.tenant,
				this.defaultEmployees,
				goals
			)
		);

		await this.tryExecute(
			'Default Key Result Updates',
			createDefaultKeyResultUpdates(
				this.connection,
				this.tenant,
				keyResults
			)
		);

		await this.tryExecute(
			'Default Key Result Progress',
			updateDefaultKeyResultProgress(this.connection)
		);

		await this.tryExecute(
			'Default Goal Progress',
			updateDefaultGoalProgress(this.connection)
		);

		await this.tryExecute(
			'Default Approval Policies',
			createDefaultApprovalPolicyForOrg(this.connection, {
				orgs: this.organizations
			})
		);

		await this.tryExecute(
			'Default Equipment Sharing Policies',
			createDefaultEquipmentSharingPolicyForOrg(this.connection, {
				orgs: this.organizations,
        tenant: this.tenant
			})
		);

		await this.tryExecute(
			'Default TimeSheets',
			createDefaultTimeSheet(
				this.connection,
				this.defaultEmployees,
				this.defaultProjects,
				randomSeedConfig.noOfTimeLogsPerTimeSheet
			)
		);

		await this.tryExecute(
			'Default Proposals',
			createDefaultProposals(
				this.connection,
				this.tenant,
				this.defaultEmployees,
				this.organizations,
				randomSeedConfig.proposalsSharingPerOrganizations || 30
			)
		);

		await this.tryExecute(
			'Default Organization Languages',
			createDefaultOrganizationLanguage(
				this.connection,
				this.organizations
			)
		);

		await this.tryExecute(
			'Default Awards',
			createDefaultAwards(this.connection, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Employee Awards',
			createDefaultEmployeeAwards(
				this.connection,
        this.tenant,
				this.defaultEmployees[0]
			)
		);

		await this.tryExecute(
			'Default Invoices',
			createDefaultInvoice(this.connection, this.tenant, this.organizations, 50)
		);

		await this.tryExecute(
			'Default Payment',
			createDefaultPayment(
				this.connection,
				this.tenant,
				this.defaultEmployees,
				this.organizations
			)
		);

		await this.tryExecute(
			'Default Event Types',
			createDefaultEventTypes(this.connection, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Pipelines',
			createDefaultPipeline(this.connection, this.organizations[0])
		);

		await this.tryExecute(
			'Default Employee Appointment',
			createDefaultEmployeeAppointment(
				this.connection,
				this.tenant,
				this.defaultEmployees,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			'Default Organization Position',
			seedDefaultOrganizationPosition(
				this.connection,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			'Default Employee TimeOff',
			createDefaultEmployeeTimeOff(
				this.connection,
				this.organizations[0],
				this.defaultEmployees,
				randomSeedConfig.employeeTimeOffPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Default Candidate Personal Qualities',
			createDefaultCandidatePersonalQualities(
				this.connection,
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Candidate Technologies',
			createDefaultCandidateTechnologies(
				this.connection,
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Candidate Criterion Rating',
			createDefaultCandidateCriterionRating(
				this.connection,
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Equipment Sharing',
			createDefaultEquipmentSharing(
				this.connection,
				this.tenant,
				this.defaultEmployees,
				randomSeedConfig.equipmentSharingPerTenant || 20
			)
		);

		await this.tryExecute(
			'Default Organization Recurring Expense',
			createDefaultOrganizationRecurringExpense(
				this.connection,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			'Help Center Articles',
			createHelpCenterArticle(
				this.connection,
        [this.tenant],
				randomSeedConfig.noOfHelpCenterArticle || 5
			)
		);

		await this.tryExecute(
			'Default Help Center Author',
			createDefaultHelpCenterAuthor(
				this.connection,
				this.defaultEmployees
			)
		);

		await this.tryExecute(
			'Default Availability Slots',
			createDefaultAvailabilitySlots(
				this.connection,
        [this.tenant],
				this.organizations[0],
				this.defaultEmployees,
				randomSeedConfig.availabilitySlotsPerOrganization || 20
			)
		);

		await this.tryExecute(
			'default Email Sent',
			createDefaultEmailSent(
				this.connection,
				this.tenant,
				this.organizations[0],
				randomSeedConfig.emailsPerOrganization || 20
			)
		);
	}

	/**
	 * Populate database with random generated data
	 */
	private async seedRandomData() {
		//Platform level data which only need database connection
		const tenants = await createRandomTenants(
			this.connection,
			randomSeedConfig.tenants || 1
		);

		// Independent roles and role permissions for each tenant
		const roles: Role[] = await createRoles(this.connection, tenants);

		await createRolePermissions(this.connection, roles, tenants);

		//Tenant level inserts which only need connection, tenant, role
		const tenantOrganizationsMap = await createRandomOrganizations(
			this.connection,
			tenants,
			randomSeedConfig.organizationsPerTenant || 1
		);

		await this.tryExecute(
			'Random Categories',
			createRandomCategories(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Product Types',
			createRandomProductType(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Products',
			createRandomProduct(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Organization Documents',
			createRandomOrganizationDocuments(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		const tenantSuperAdminsMap = await createRandomSuperAdminUsers(
			this.connection,
			roles,
			tenants,
			1
		);

		const tenantUsersMap = await createRandomUsers(
			this.connection,
			roles,
			tenants,
			randomSeedConfig.organizationsPerTenant || 1,
			randomSeedConfig.employeesPerOrganization || 1,
			randomSeedConfig.candidatesPerOrganization || 1,
			randomSeedConfig.managersPerOrganization || 1,
			randomSeedConfig.dataEntriesPerOrganization || 1,
			randomSeedConfig.viewersPerOrganization || 1
		);

		//Organization level inserts which need connection, tenant, organizations, users
		await createRandomUsersOrganizations(
			this.connection,
			tenants,
			tenantOrganizationsMap,
			tenantSuperAdminsMap,
			tenantUsersMap,
			randomSeedConfig.employeesPerOrganization || 1
		);

		const tenantEmployeeMap = await createRandomEmployees(
			this.connection,
			tenants,
			tenantOrganizationsMap,
			tenantUsersMap,
			randomSeedConfig.employeesPerOrganization || 1
		);

		const tenantCandidatesMap = await this.tryExecute(
			'Random Candidates',
			createRandomCandidates(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantUsersMap,
				randomSeedConfig.candidatesPerOrganization || 1
			)
		);

		await this.tryExecute(
			'Random Product Options',
			createRandomProductOption(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				randomSeedConfig.numberOfOptionPerProduct || 5
			)
		);

		await this.tryExecute(
			'Random Product Variants',
			createRandomProductVariant(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				randomSeedConfig.numberOfVariantPerProduct || 5
			)
		);

		await this.tryExecute(
			'Random Product Variant Prices',
			createRandomProductVariantPrice(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Product Variant Settings',
			createRandomProductVariantSettings(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Candidate Sources',
			createRandomCandidateSources(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Incomes',
			createRandomIncomes(this.connection, tenants, tenantEmployeeMap)
		);

		await this.tryExecute(
			'Random Teams',
			createRandomTeam(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap,
				roles
			)
		);

		const randomGoals = await this.tryExecute(
			'Random Gaols',
			createRandomGoal(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			'Random Key Results',
			createRandomKeyResult(
				this.connection,
				tenants,
				tenantEmployeeMap,
				randomGoals
			)
		);

		await this.tryExecute(
			'Random Candidate Documents',
			createRandomCandidateDocuments(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Candidate Experiences',
			createRandomCandidateExperience(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Candidate Skills',
			createRandomCandidateSkills(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		const organizationVendorsMap = await this.tryExecute(
			'Random Organization Vendors',
			createRandomOrganizationVendors(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Time Off Policies',
			createRandomTimeOffPolicies(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		const categoriesMap = await this.tryExecute(
			'Random Expense Categories',
			createRandomExpenseCategories(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Expenses',
			createRandomExpenses(
				this.connection,
				tenants,
				tenantEmployeeMap,
				organizationVendorsMap,
				categoriesMap
			)
		);

		await this.tryExecute(
			'Random Equipments',
			createRandomEquipments(
				this.connection,
				tenants,
				randomSeedConfig.equipmentPerTenant || 20
			)
		);

		await this.tryExecute(
			'Random Equipment Sharing',
			createRandomEquipmentSharing(
				this.connection,
				tenants,
				tenantEmployeeMap,
				randomSeedConfig.equipmentSharingPerTenant || 20
			)
		);

		await this.tryExecute(
			'Random Employment Types',
			seedRandomEmploymentTypes(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Organization Departments',
			seedRandomOrganizationDepartments(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Employee Invites',
			createRandomEmployeeInviteSent(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantSuperAdminsMap,
				randomSeedConfig.invitePerOrganization || 20
			)
		);

		await this.tryExecute(
			'Random Organization Positions',
			seedRandomOrganizationPosition(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Approval Policies',
			createRandomApprovalPolicyForOrg(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Equipment Sharing Policies',
			createRandomEquipmentSharingPolicyForOrg(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Request Approvals',
			createRandomRequestApproval(
				this.connection,
				tenants,
				tenantEmployeeMap,
				randomSeedConfig.requestApprovalPerOrganization || 20
			)
		);

		await this.tryExecute('Tags', createTags(this.connection));

		const tags = await this.tryExecute(
			'Random Organization Tags',
			createRandomOrganizationTags(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Organization Projects',
			createRandomOrganizationProjects(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tags,
				randomSeedConfig.projectsPerOrganization || 10
			)
		);

		await this.tryExecute(
			'Random Employee Time Off',
			createRandomEmployeeTimeOff(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantEmployeeMap,
				randomSeedConfig.employeeTimeOffPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Random Organization Documents',
			createOrganizationDocuments(this.connection, this.organizations)
		);

		await this.tryExecute(
			'Random Proposals',
			createRandomProposals(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap,
				randomSeedConfig.proposalsSharingPerOrganizations || 30
			)
		);

		await this.tryExecute(
			'Random Email Sent',
			createRandomEmailSent(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				randomSeedConfig.emailsPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Random Tasks',
			createRandomTask(this.connection, this.defaultProjects)
		);

		await this.tryExecute(
			'Random TimeSheets',
			createRandomTimesheet(this.connection, this.defaultProjects, 20)
		);

		await this.tryExecute(
			'Random Organization Contacts',
			createRandomOrganizationContact(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap,
				10
			)
		);

		await this.tryExecute(
			'Random Invoices',
			createRandomInvoice(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				50
			)
		);

		await this.tryExecute(
			'Random Availability Slots',
			createRandomAvailabilitySlots(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantEmployeeMap,
				randomSeedConfig.availabilitySlotsPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Random Invoice Items',
			createRandomInvoiceItem(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			'Random Payments',
			createRandomPayment(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);
		await this.tryExecute(
			'Random Candidate Educations',
			createRandomCandidateEducations(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Candidate Interviews',
			createRandomCandidateInterview(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Candidate Technologies',
			createRandomCandidateTechnologies(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Candidate Personal Qualities',
			createRandomCandidatePersonalQualities(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Awards',
			createRandomAwards(this.connection, tenants, tenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Candidate Interviewers',
			createRandomCandidateInterviewers(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Candidate Feedbacks',
			createRandomCandidateFeedbacks(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Employee Recurring Expenses',
			createRandomEmployeeRecurringExpense(
				this.connection,
				tenants,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			'Random Employee Settings',
			createRandomEmployeeSetting(
				this.connection,
				tenants,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			'Random Organization Languages',
			createRandomOrganizationLanguage(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Organization Recurring Expenses',
			createRandomOrganizationRecurringExpense(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Help Center Articles',
			createHelpCenterArticle(
				this.connection,
        tenants,
				randomSeedConfig.noOfHelpCenterArticle || 5
			)
		);

		await this.tryExecute(
			'Random Organization Sprints',
			createRandomOrganizationSprint(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Organization Team Employees',
			createRandomOrganizationTeamEmployee(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Help Center Authors',
			createRandomHelpCenterAuthor(
				this.connection,
				tenants,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			'Random Appointment Employees',
			createRandomAppointmentEmployees(
				this.connection,
				tenants,
				tenantEmployeeMap
			)
		);

		await this.tryExecute(
			'Random Employee Appointments',
			createRandomEmployeeAppointment(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Pipelines',
			createRandomPipeline(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Pipeline Stages',
			createRandomPipelineStage(
				this.connection,
				tenants,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Deals',
			createRandomDeal(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Integrations',
			createRandomIntegrationTenant(this.connection, tenants)
		);

		await this.tryExecute(
			'Random Integration Settings',
			createRandomIntegrationSetting(this.connection, tenants)
		);

		await this.tryExecute(
			'Random Integration Map',
			createRandomIntegrationMap(this.connection, tenants)
		);

		await this.tryExecute(
			'Random Integration Entity Settings',
			createRandomIntegrationEntitySetting(this.connection, tenants)
		);

		await this.tryExecute(
			'Random Integration Entity Settings Tied Entity',
			createRandomIntegrationEntitySettingTiedEntity(
				this.connection,
				tenants
			)
		);

		await this.tryExecute(
			'Random Request Approval Employee',
			createRandomRequestApprovalEmployee(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Request Approval Team',
			createRandomRequestApprovalTeam(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Candidate Criterion Ratings',
			createRandomCandidateCriterionRating(
				this.connection,
				tenants,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Event Types',
			createRandomEventType(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap
			)
		);
	}

	/**
	 * Retrieve entities metadata
	 */
	private async getEntities() {
		const entities = [];
		try {
			this.connection.entityMetadatas.forEach((entity) =>
				entities.push({
					name: entity.name,
					tableName: entity.tableName
				})
			);
			return entities;
		} catch (error) {
			this.handleError(error, 'Unable to retrieve database metadata');
		}
	}

	/**
	 * Cleans all the entities
	 * Removes all data from database
	 */
	private async cleanAll(entities) {
		try {
			for (const entity of entities) {
				const repository = getRepository(entity.name);
				const truncateSql =
					env.database.type === 'sqlite'
						? `DELETE FROM  "${entity.tableName}";`
						: `TRUNCATE  "${entity.tableName}" RESTART IDENTITY CASCADE;`;
				await repository.query(truncateSql);
			}
		} catch (error) {
			this.handleError(error, 'Unable to clean database');
		}
	}

	/**
	 * Reset the database, truncate all tables (remove all data)
	 */
	private async resetDatabase() {
		const entities = await this.getEntities();
		await this.cleanAll(entities);
		//await loadAll(entities);
		this.log(chalk.green(`✅ RESET DATABASE SUCCESSFUL`));
	}

	private handleError(error: Error, message?: string): void {
		this.log(
			chalk.bgRed(
				`🛑 ERROR: ${message ? message + '-> ' : ''} ${
					error ? error.message : ''
				}`
			)
		);
		throw error;
	}
}
