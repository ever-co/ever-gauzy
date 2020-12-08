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
import { createDefaultSkills } from '../../skills/skill.seed';
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
	createRandomOrganizations,
	getDefaultBulgarianOrganization
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
	createRandomTenants,
	getDefaultTenant
} from '../../tenant/tenant.seed';
import { createDefaultEmailTemplates } from '../../email-template/email-template.seed';
import {
	seedDefaultEmploymentTypes,
	seedRandomEmploymentTypes
} from '../../organization-employment-type/organization-employment-type.seed';
import { createEmployeeLevels } from '../../organization_employee-level/organization-employee-level.seed';
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
import { OrganizationProject } from '../../organization-projects/organization-projects.entity';
import {
	createDefaultCandidates,
	createRandomCandidates
} from '../../candidate/candidate.seed';
import { Tenant } from '../../tenant/tenant.entity';
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
import {
	createDefaultInvoiceItem,
	createRandomInvoiceItem
} from '../../invoice-item/invoice-item.seed';
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
import { createRandomIntegrationEntitySetting } from '../../integration-entity-setting/integration-entity-setting.seed';
import { createRandomIntegrationEntitySettingTiedEntity } from '../../integration-entity-setting-tied-entity/integration-entity-setting-tied-entity.seed';
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
import { createDefaultGoalKpiTemplate } from '../../goal-kpi-template/goal-kpi-template.seed';
import { randomSeedConfig } from './random-seed-config';
import { createDefaultJobSearchCategories } from '../../employee-job-preset/job-search-category/job-search-category.seed';
import { createDefaultJobSearchOccupations } from '../../employee-job-preset/job-search-occupation/job-search-occupation.seed';
import { createDefaultReport } from '../../reports/report.seed';
import { createCurrencies } from '../../currency/currency.seed';

@Injectable()
export class SeedDataService {
	connection: Connection;
	log = console.log;
	organizations: Organization[];
	defaultProjects: OrganizationProject[] | void;
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
		// dropSchema: !env.production //Drops the schema each time connection is being established in development mode.
	};

	/**
	 * Seed All Data
	 */
	public async runAllSeed() {
		const isDefault = false;

		try {
			await this.cleanUpPreviousRuns();

			// Connect to database
			await this.createConnection();

			// Reset database to start with new, fresh data
			await this.resetDatabase();

			// Seed data with mock / fake data
			await this.seedData(isDefault);

			// Seed jobs related data
			await this.seedJobsData(isDefault);

			// Seed jobs related data
			await this.seedReportsData(isDefault);

			console.log('Database All Seed Completed');
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Seed Default Data
	 */
	public async runDefaultSeed() {
		const isDefault = true;

		try {
			await this.cleanUpPreviousRuns();

			// Connect to database
			await this.createConnection();

			// Reset database to start with new, fresh data
			await this.resetDatabase();

			// Seed data with mock / fake data
			await this.seedData(isDefault);

			console.log('Database Default Seed Completed');
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Seed Default Data
	 */
	public async runReportsSeed(isDefault = true) {
		try {
			// Connect to database
			await this.createConnection();

			await this.seedReportsData(isDefault);

			console.log('Database Reports Seed completed');
		} catch (error) {
			this.handleError(error);
		}
		return;
	}

	/**
	 * Populate database with report related data
	 * @param isDefault
	 */
	private async seedReportsData(isDefault: boolean) {
		try {
			this.log(
				chalk.green(
					`🌱 SEEDING ${
						env.production ? 'PRODUCTION' : ''
					} REPORTS DATABASE...`
				)
			);

			if (isDefault) {
				await this.tryExecute(
					'Default Report Category & Report',
					createDefaultReport(this.connection)
				);
			}

			this.log(
				chalk.green(
					`✅ SEEDED ${
						env.production ? 'PRODUCTION' : ''
					} REPORTS DATABASE`
				)
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Seed Default Data
	 */
	public async runJobsSeed() {
		const isDefault = true;

		try {
			// Connect to database
			await this.createConnection();

			await this.seedJobsData(isDefault);

			console.log('Database Jobs Seed completed');
		} catch (error) {
			this.handleError(error);
		}
	}
	/**
	 * Populate database with jobs related data
	 * @param isDefault
	 */
	private async seedJobsData(isDefault: boolean) {
		// TODO: implement for isDefault = false (i.e for other tenants with random data too)

		try {
			this.log(
				chalk.green(
					`🌱 SEEDING ${
						env.production ? 'PRODUCTION' : ''
					} JOBS DATABASE...`
				)
			);

			const defaultTenant = await getDefaultTenant(this.connection);

			const defaultBulgarianOrganization = await getDefaultBulgarianOrganization(
				this.connection,
				defaultTenant
			);

			await this.tryExecute(
				'Default Job Search Categories',
				createDefaultJobSearchCategories(
					this.connection,
					defaultTenant,
					defaultBulgarianOrganization
				)
			);

			await this.tryExecute(
				'Default Job Search Occupations',
				createDefaultJobSearchOccupations(
					this.connection,
					defaultTenant,
					defaultBulgarianOrganization
				)
			);

			this.log(
				chalk.green(
					`✅ SEEDED ${
						env.production ? 'PRODUCTION' : ''
					} JOBS DATABASE`
				)
			);
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
				'Countries',
				createCountries(this.connection)
			);

			await this.tryExecute(
				'Currencies',
				createCurrencies(this.connection)
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
		// Platform level data

		await this.tryExecute('Languages', createLanguages(this.connection));

		this.tenant = await createDefaultTenants(this.connection);

		this.roles = await createRoles(this.connection, [this.tenant]);

		await this.runReportsSeed(true);

		await createRolePermissions(this.connection, this.roles, [this.tenant]);

		// Tenant level inserts which only need connection, tenant, roles
		const defaultOrganizations = await createDefaultOrganizations(
			this.connection,
			this.tenant
		);

		this.organizations = defaultOrganizations;

		await this.tryExecute(
			'Default Email Templates',
			createDefaultEmailTemplates(this.connection)
		);

		await this.tryExecute(
			'Skills',
			createDefaultSkills(
				this.connection,
				this.tenant,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			'Contacts',
			createRandomContacts(
				this.connection,
				this.tenant,
				this.organizations,
				randomSeedConfig.noOfRandomContacts || 5
			)
		);

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

		await createDefaultUsersOrganizations(this.connection, {
			organizations: this.organizations,
			users: [
				...defaultEmployeeUsers,
				...adminUsers,
				...this.superAdminUsers
			]
		});

		this.defaultCandidateUsers = defaultCandidateUsers;

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
			createDefaultGoalTemplates(
				this.connection,
				this.tenant,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			'Default Goal KPI Template',
			createDefaultGoalKpiTemplate(
				this.connection,
				this.tenant,
				this.organizations[0]
			)
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
			createDefaultIntegrations(this.connection, integrationTypes)
		);

		await this.tryExecute(
			'Default Event Types',
			createDefaultEventTypes(
				this.connection,
				this.tenant,
				this.organizations
			)
		);
	}

	/**
	 * Populate default data from env files
	 */
	private async seedDefaultData() {
		//Organization level inserts which need connection, tenant, role, organizations
		const categories = await this.tryExecute(
			'Expense Categories',
			createExpenseCategories(
				this.connection,
				this.tenant,
				this.organizations
			)
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
			createDefaultTask(
				this.connection,
				this.tenant,
				this.organizations[0]
			)
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
			createDefaultProducts(
				this.connection,
				this.tenant,
				this.organizations[0]
			)
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
			createDefaultEquipments(
				this.connection,
				this.tenant,
				this.organizations[0]
			)
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
			createCandidateSources(
				this.connection,
				this.tenant,
				defaultCandidates,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			'Candidate Documents',
			createCandidateDocuments(
				this.connection,
				this.tenant,
				defaultCandidates,
				this.organizations[0]
			)
		);
		await this.tryExecute(
			'Default Candidate Interview',
			createDefaultCandidateInterview(
				this.connection,
				this.tenant,
				this.organizations[0],
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Candidate Interviewers',
			createDefaultCandidateInterviewers(
				this.connection,
				this.tenant,
				this.organizations[0],
				this.defaultEmployees,
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Candidate Feedbacks',
			createCandidateFeedbacks(
				this.connection,
				this.tenant,
				this.organizations[0],
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Candidate Educations',
			createCandidateEducations(this.connection, defaultCandidates)
		);

		await this.tryExecute(
			'Candidate Skills',
			createCandidateSkills(
				this.connection,
				this.tenant,
				defaultCandidates,
				this.organizations[0]
			)
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
				this.tenant,
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
				this.organizations[0],
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
				this.tenant,
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
				this.tenant,
				this.organizations
			)
		);

		await this.tryExecute(
			'Default Awards',
			createDefaultAwards(
				this.connection,
				this.tenant,
				this.organizations
			)
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
			createDefaultInvoice(
				this.connection,
				this.tenant,
				this.organizations,
				randomSeedConfig.numberOfInvoicePerOrganization || 50
			)
		);

		await this.tryExecute(
			'Default Invoice Items',
			createDefaultInvoiceItem(
				this.connection,
				this.tenant,
				this.organizations,
				randomSeedConfig.numberOfInvoiceItemPerInvoice || 5
			)
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
			'Default Pipelines',
			createDefaultPipeline(
				this.connection,
				this.tenant,
				this.organizations[0]
			)
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
				this.tenant,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			'Default Employee TimeOff',
			createDefaultEmployeeTimeOff(
				this.connection,
				this.tenant,
				this.organizations[0],
				this.defaultEmployees,
				randomSeedConfig.employeeTimeOffPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Default Candidate Personal Qualities',
			createDefaultCandidatePersonalQualities(
				this.connection,
				this.tenant,
				this.organizations[0],
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Candidate Technologies',
			createDefaultCandidateTechnologies(
				this.connection,
				this.tenant,
				this.organizations[0],
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Candidate Criterion Rating',
			createDefaultCandidateCriterionRating(
				this.connection,
				this.tenant,
				this.organizations[0],
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Equipment Sharing',
			createDefaultEquipmentSharing(
				this.connection,
				this.tenant,
				this.organizations[0],
				this.defaultEmployees,
				randomSeedConfig.equipmentSharingPerTenant || 20
			)
		);

		await this.tryExecute(
			'Default Organization Recurring Expense',
			createDefaultOrganizationRecurringExpense(
				this.connection,
				this.tenant,
				this.organizations[0]
			)
		);

		await this.tryExecute(
			'Help Center Articles',
			createHelpCenterArticle(
				this.connection,
				this.organizations,
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
			'Default Email Sent',
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
			'Random Goals',
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
			createRandomTask(this.connection, tenants, this.defaultProjects)
		);

		await this.tryExecute(
			'Random TimeSheets',
			createRandomTimesheet(
				this.connection,
				this.tenant,
				this.defaultProjects,
				randomSeedConfig.noOfTimeLogsPerTimeSheet
			)
		);

		const noOfContactsPerOrganization = 10;
		await this.tryExecute(
			'Random Organization Contacts',
			createRandomOrganizationContact(
				this.connection,
				tenants,
				tenantEmployeeMap,
				tenantOrganizationsMap,
				noOfContactsPerOrganization
			)
		);

		await this.tryExecute(
			'Random Invoices',
			createRandomInvoice(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				randomSeedConfig.numberOfInvoicePerOrganization || 50
			)
		);

		await this.tryExecute(
			'Random Invoice Items',
			createRandomInvoiceItem(
				this.connection,
				tenants,
				tenantOrganizationsMap,
				randomSeedConfig.numberOfInvoiceItemPerInvoice || 5
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
				this.organizations,
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

	private async cleanUpPreviousRuns() {
		this.log(chalk.green(`CLEANING UP FROM PREVIOUS RUNS...`));

		await new Promise((resolve, reject) => {
			const dir = env.isElectron
				? path.join(
						path.resolve(env.gauzyUserPath, ...['public']),
						'screenshots'
				  )
				: path.join(
						path.resolve('.', ...['apps', 'api', 'public']),
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
				this.log(chalk.green(`CONNECTING TO DATABASE...`));

				this.connection = await createConnection({
					...env.database,
					...this.overrideDbConfig,
					entities: [
						path.resolve(
							__dirname,
							'../../**',
							'**.entity{.ts,.js}'
						)
					]
				} as ConnectionOptions);

				this.log(chalk.green(`CONNECTED TO DATABASE`));
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
				let truncateSql: string;
				switch (env.database.type) {
					case 'postgres':
						truncateSql = `TRUNCATE  "${entity.tableName}" RESTART IDENTITY CASCADE;`;
						break;
					default:
						truncateSql = `DELETE FROM  "${entity.tableName}";`;
						await repository.query('PRAGMA foreign_keys = OFF;');
				}
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
		this.log(chalk.green(`RESETTING DATABASE`));

		const entities = await this.getEntities();
		await this.cleanAll(entities);

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
