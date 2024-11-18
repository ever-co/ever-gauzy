// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import * as rimraf from 'rimraf';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as chalk from 'chalk';
import moment from 'moment';
import { environment as env, ConfigService, DatabaseTypeEnum } from '@gauzy/config';
import { IEmployee, IOrganization, IOrganizationProject, IRole, ITenant, IUser } from '@gauzy/contracts';
import { getPluginModules, hasLifecycleMethod, PluginLifecycleMethods } from '@gauzy/plugin';
import { createRoles } from '../../role/role.seed';
import { createDefaultSkills } from '../../skills/skill.seed';
import { createLanguages } from '../../language/language.seed';
import {
	createDefaultAdminUsers,
	createDefaultEmployeesUsers,
	createDefaultUsers,
	createRandomSuperAdminUsers,
	createRandomUsers
} from '../../user/user.seed';
import { createDefaultEmployees, createRandomEmployees } from '../../employee/employee.seed';
import {
	createDefaultOrganizations,
	createRandomOrganizations,
	DEFAULT_EVER_ORGANIZATIONS,
	DEFAULT_ORGANIZATIONS
} from '../../organization';
import { createDefaultIncomes, createRandomIncomes } from '../../income/income.seed';
import { createDefaultExpenses, createRandomExpenses } from '../../expense/expense.seed';
import {
	createDefaultUsersOrganizations,
	createRandomUsersOrganizations
} from '../../user-organization/user-organization.seed';
import { createCountries } from '../../country/country.seed';
import { createDefaultTeams, createRandomTeam } from '../../organization-team/organization-team.seed';
import { createRolePermissions } from '../../role-permission/role-permission.seed';
import { createDefaultTenant, createRandomTenants, DEFAULT_EVER_TENANT, DEFAULT_TENANT } from '../../tenant';
import { createDefaultTenantSetting } from './../../tenant/tenant-setting/tenant-setting.seed';
import { createDefaultEmailTemplates } from '../../email-template/email-template.seed';
import {
	seedDefaultEmploymentTypes,
	seedRandomEmploymentTypes
} from '../../organization-employment-type/organization-employment-type.seed';
import { createEmployeeLevels } from '../../employee-level/employee-level.seed';
import { createDefaultTimeOffPolicy, createRandomTimeOffPolicies } from '../../time-off-policy/time-off-policy.seed';
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
} from '../../organization-vendor/organization-vendor.seed';
import { createDefaultCandidates, createRandomCandidates } from '../../candidate/candidate.seed';
import { createCandidateSources, createRandomCandidateSources } from '../../candidate-source/candidate-source.seed';
import { createDefaultIntegrationTypes } from '../../integration/integration-type.seed';
import { createDefaultIntegrations } from '../../integration/integration.seed';
import { createDefaultProducts, createRandomProduct } from '../../product/product.seed';
import {
	createCandidateDocuments,
	createRandomCandidateDocuments
} from '../../candidate-documents/candidate-documents.seed';
import {
	createCandidateFeedbacks,
	createRandomCandidateFeedbacks
} from '../../candidate-feedbacks/candidate-feedbacks.seed';
import { createDefaultTimeSheet, createRandomTimesheet } from './../../time-tracking/timesheet/timesheet.seed';
import { createDefaultTask, createRandomTask } from '../../tasks/task.seed';
import {
	createDefaultOrganizationProjects,
	createRandomOrganizationProjects
} from '../../organization-project/organization-project.seed';
import { createDefaultTimeFrames } from '../../goal-time-frame/goal-time-frame.seed';
import { createDefaultGoals, createRandomGoal, updateDefaultGoalProgress } from '../../goal/goal.seed';
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
} from '../../organization-position/organization-position.seed';
import { createDefaultTags, createRandomOrganizationTags, createTags } from '../../tags/tag.seed';
import { createDefaultEmailSent, createRandomEmailSent } from '../../email-history/email-history.seed';
import { createDefaultEmployeeInviteSent, createRandomEmployeeInviteSent } from '../../invite/invite.seed';
import {
	createDefaultRequestApprovalEmployee,
	createRandomRequestApproval
} from '../../request-approval/request-approval.seed';
import {
	createDefaultEmployeeTimeOff,
	createRandomEmployeeTimeOff
} from '../../time-off-request/time-off-request.seed';
import {
	createOrganizationDocuments,
	createRandomOrganizationDocuments
} from '../../organization-document/organization-document.seed';
import { createDefaultEquipments, createRandomEquipments } from '../../equipment/equipment.seed';
import {
	createDefaultEquipmentSharing,
	createRandomEquipmentSharing
} from '../../equipment-sharing/equipment-sharing.seed';
import { createDefaultInvoiceItem, createRandomInvoiceItem } from '../../invoice-item/invoice-item.seed';
import { createDefaultInvoice, createRandomInvoice } from '../../invoice/invoice.seed';
import { createCandidateSkills, createRandomCandidateSkills } from '../../candidate-skill/candidate-skill.seed';
import { createRandomCandidateExperience } from '../../candidate-experience/candidate-experience.seed';
import {
	createCandidateEducations,
	createRandomCandidateEducations
} from '../../candidate-education/candidate-education.seed';
import { createRandomContacts } from '../../contact/contact.seed';
import {
	createDefaultOrganizationContact,
	createRandomOrganizationContact
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
import { createDefaultAwards, createRandomAwards } from '../../organization-award/organization-award.seed';
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
import { createDefaultPipeline, createRandomPipeline } from '../../pipeline/pipeline.seed';
import {
	createDefaultOrganizationRecurringExpense,
	createRandomOrganizationRecurringExpense
} from '../../organization-recurring-expense/organization-recurring-expense.seed';
import {
	createDefaultOrganizationLanguage,
	createRandomOrganizationLanguage
} from '../../organization-language/organization-language.seed';
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
import { createRandomIntegrationEntitySettingTied } from '../../integration-entity-setting-tied/integration-entity-setting-tied.seed';
import { createRandomRequestApprovalTeam } from '../../request-approval-team/request-approval-team.seed';
import { createRandomRequestApprovalEmployee } from '../../request-approval-employee/request-approval-employee.seed';
import { createDefaultPayment, createRandomPayment } from '../../payment/payment.seed';
import { createDefaultEventTypes, createRandomEventType } from '../../event-types/event-type.seed';
import {
	createDefaultEquipmentSharingPolicy,
	createRandomEquipmentSharingPolicy
} from '../../equipment-sharing-policy/equipment-sharing-policy.seed';
import { createRandomProductOption, createRandomProductOptionGroups } from '../../product-option/product-option.seed';
import { createRandomProductVariantSettings } from '../../product-setting/product-setting.seed';
import { createRandomProductVariant } from '../../product-variant/product-variant.seed';
import { createRandomProductVariantPrice } from '../../product-variant-price/product-variant-price.seed';
import { createCategories, createRandomProductCategories } from '../../product-category/category.seed';
import { createDefaultProductType, createRandomProductType } from '../../product-type/type.seed';
import { createDefaultGoalTemplates } from '../../goal-template/goal-template.seed';
import { createDefaultKeyResultTemplates } from '../../keyresult-template/keyresult-template.seed';
import { createDefaultEmployeeAwards } from '../../employee-award/employee-award.seed';
import { createDefaultGoalKpiTemplate } from '../../goal-kpi-template/goal-kpi-template.seed';
import { randomSeedConfig } from './random-seed-config';
import { createDefaultReport, createRandomTenantOrganizationsReport } from '../../reports/report.seed';
import { createCurrencies } from '../../currency/currency.seed';
import { createDefaultFeatureToggle, createRandomFeatureToggle } from '../../feature/feature.seed';
import { createDefaultAccountingTemplates } from './../../accounting-template/accounting-template.seed';
import { DEFAULT_EMPLOYEES, DEFAULT_EVER_EMPLOYEES } from './../../employee';
import { createRandomMerchants, createDefaultMerchants } from './../../merchant/merchant.seed';
import { createRandomWarehouses } from './../../warehouse/warehouse.seed';
import { createDefaultStatuses } from './../../tasks/statuses/status.seed';
import { createDefaultPriorities } from './../../tasks/priorities/priority.seed';
import { createDefaultSizes } from './../../tasks/sizes/size.seed';
import { createDefaultIssueTypes } from './../../tasks/issue-type/issue-type.seed';
import { getDBType } from './../../core/utils';

export enum SeederTypeEnum {
	ALL = 'all',
	EVER = 'ever',
	DEFAULT = 'default'
}

@Injectable()
export class SeedDataService {
	dataSource: DataSource;

	log = console.log;
	defaultOrganization: IOrganization;
	tenant: ITenant;
	seedType: SeederTypeEnum;

	organizations: IOrganization[] = [];
	defaultProjects: IOrganizationProject[] | void = [];
	roles: IRole[] = [];
	superAdminUsers: IUser[] = [];
	defaultCandidateUsers: IUser[] = [];
	defaultEmployees: IEmployee[] = [];

	/** */
	randomTenants: ITenant[];
	randomTenantOrganizationsMap: Map<ITenant, IOrganization[]>;
	randomOrganizationEmployeesMap: Map<IOrganization, IEmployee[]>;

	constructor(private readonly moduleRef: ModuleRef, private readonly configService: ConfigService) {}

	/**
	 * This config is applied only for `yarn seed:*` type calls because
	 * that is when connection is created by this service itself.
	 */
	overrideDbConfig = {
		logging: 'all',
		logger: 'file' //Removes console logging, instead logs all queries in a file ormlogs.log
		// dropSchema: !env.production //Drops the schema each time connection is being established in development mode.
	};

	/**
	 * Seed All Data
	 */
	public async runAllSeed() {
		try {
			this.seedType = SeederTypeEnum.ALL;

			await this.cleanUpPreviousRuns();

			// Connect to database
			await this.createConnection();

			// Reset database to start with new, fresh data
			await this.resetDatabase();

			// Seed basic default data for default tenant
			await this.seedBasicDefaultData();

			// Seed reports related data
			await this.seedReportsData();

			// Seed data with mock / fake data for default tenant
			await this.seedDefaultData();

			// Seed data with mock / fake data for random tenants
			await this.seedRandomData();

			// Disconnect to database
			await this.closeConnection();

			console.log('Database All Seed Completed');
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Seed Default Data
	 */
	public async runDefaultSeed(fromAPI: boolean) {
		try {
			if (this.configService.get('demo') === true && fromAPI === true) {
				this.seedType = SeederTypeEnum.ALL;
			} else {
				this.seedType = SeederTypeEnum.DEFAULT;
			}

			await this.cleanUpPreviousRuns();

			// Connect to database
			await this.createConnection();

			// Reset database to start with new, fresh data
			await this.resetDatabase();

			// Seed basic default data for default tenant
			await this.seedBasicDefaultData();

			// Seed reports related data
			await this.seedReportsData();

			// Disconnect to database
			await this.closeConnection();

			console.log('Database Default Seed Completed');
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Seed Default Ever Data
	 */
	public async runEverSeed() {
		try {
			this.seedType = SeederTypeEnum.EVER;

			await this.cleanUpPreviousRuns();

			// Connect to database
			await this.createConnection();

			// Reset database to start with new, fresh data
			await this.resetDatabase();

			// Seed basic default data for default tenant
			await this.seedBasicDefaultData();

			// Seed reports related data
			await this.seedReportsData();

			// Disconnect to database
			await this.closeConnection();

			console.log('Database Ever Seed Completed');
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Seed Default Report Data
	 */
	public async runReportsSeed() {
		try {
			// Connect to database
			await this.createConnection();

			// Seed reports related data
			await this.seedReportsData();

			// Disconnect to database
			await this.closeConnection();

			console.log('Database Reports Seed Completed');
		} catch (error) {
			this.handleError(error);
		}
		return;
	}

	/**
	 * Seed Default & Random Data
	 */
	public async executeDemoSeed() {
		try {
			console.log('Database Demo Seed Started');

			// Connect to database
			await this.createConnection();

			// Seed reports related data
			await this.seedReportsData();

			// Seed default data
			await this.seedDefaultData();

			// Seed random data
			await this.seedRandomData();

			// Disconnect to database
			await this.closeConnection();

			console.log('Database Demo Seed Completed');
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Populate database with report related data
	 */
	private async seedReportsData() {
		try {
			this.log(chalk.green(`🌱 SEEDING ${env.production ? 'PRODUCTION' : ''} REPORTS DATABASE...`));

			await this.tryExecute(
				'Default Report Category & Report',
				createDefaultReport(this.dataSource, this.configService.config, this.tenant)
			);

			this.log(chalk.green(`✅ SEEDED ${env.production ? 'PRODUCTION' : ''} REPORTS DATABASE`));
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Seed Default Job Data
	 */
	public async runJobsSeed() {
		try {
			this.seedType = SeederTypeEnum.ALL;
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Populate Database with Basic Default Data
	 */
	private async seedBasicDefaultData() {
		this.log(chalk.magenta(`🌱 SEEDING BASIC ${env.production ? 'PRODUCTION' : ''} DATABASE...`));

		// Seed data which only needs connection
		await this.tryExecute('Countries', createCountries(this.dataSource));

		await this.tryExecute('Currencies', createCurrencies(this.dataSource));

		await this.tryExecute('Languages', createLanguages(this.dataSource));

		await this.tryExecute('Statuses', createDefaultStatuses(this.dataSource));

		await this.tryExecute('Priorities', createDefaultPriorities(this.dataSource));

		await this.tryExecute('Sizes', createDefaultSizes(this.dataSource));

		await this.tryExecute('Issue Types', createDefaultIssueTypes(this.dataSource));

		// default and internal tenant
		const tenantName = this.seedType !== SeederTypeEnum.DEFAULT ? DEFAULT_EVER_TENANT : DEFAULT_TENANT;
		this.tenant = (await this.tryExecute('Tenant', createDefaultTenant(this.dataSource, tenantName))) as ITenant;

		this.roles = await createRoles(this.dataSource, [this.tenant]);

		await createDefaultTenantSetting(this.dataSource, [this.tenant]);

		await createRolePermissions(this.dataSource, this.roles, [this.tenant]);

		// Tenant level inserts which only need connection, tenant, roles
		const organizations =
			this.seedType !== SeederTypeEnum.DEFAULT ? DEFAULT_EVER_ORGANIZATIONS : DEFAULT_ORGANIZATIONS;
		this.organizations = (await this.tryExecute(
			'Organizations',
			createDefaultOrganizations(this.dataSource, this.tenant, organizations)
		)) as IOrganization[];

		// default organization set as main organization
		this.defaultOrganization = this.organizations.find((organization: IOrganization) => organization.isDefault);

		await this.tryExecute(
			'Default Feature Toggle',
			createDefaultFeatureToggle(this.dataSource, this.configService.config, this.tenant)
		);

		await this.tryExecute('Default Email Templates', createDefaultEmailTemplates(this.dataSource));

		await this.tryExecute('Default Accounting Templates', createDefaultAccountingTemplates(this.dataSource));

		await this.tryExecute('Skills', createDefaultSkills(this.dataSource, this.tenant, this.defaultOrganization));

		const { defaultSuperAdminUsers, defaultAdminUsers } = await createDefaultAdminUsers(
			this.dataSource,
			this.tenant
		);
		this.superAdminUsers.push(...(defaultSuperAdminUsers as IUser[]));

		const { defaultEmployeeUsers } = await createDefaultEmployeesUsers(this.dataSource, this.tenant);

		if (this.seedType !== SeederTypeEnum.DEFAULT) {
			const { defaultEverEmployeeUsers, defaultCandidateUsers } = await createDefaultUsers(
				this.dataSource,
				this.tenant
			);
			this.defaultCandidateUsers.push(...defaultCandidateUsers);
			defaultEmployeeUsers.push(...defaultEverEmployeeUsers);
		}

		const defaultUsers = [...this.superAdminUsers, ...defaultAdminUsers, ...defaultEmployeeUsers];
		await this.tryExecute(
			'Users',
			createDefaultUsersOrganizations(this.dataSource, this.tenant, this.organizations, defaultUsers)
		);

		const allDefaultEmployees = DEFAULT_EMPLOYEES.concat(DEFAULT_EVER_EMPLOYEES);
		//User level data that needs dataSource, tenant, organization, role, users
		this.defaultEmployees = await createDefaultEmployees(
			this.dataSource,
			this.tenant,
			this.defaultOrganization,
			defaultEmployeeUsers,
			allDefaultEmployees
		);

		await this.tryExecute(
			'Default General Goal Setting',
			createDefaultGeneralGoalSetting(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Goal Template',
			createDefaultGoalTemplates(this.dataSource, this.tenant, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Goal KPI Template',
			createDefaultGoalKpiTemplate(this.dataSource, this.tenant, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Key Result Template',
			createDefaultKeyResultTemplates(this.dataSource, this.tenant)
		);

		await this.tryExecute(
			'Default Time Off Policy',
			createDefaultTimeOffPolicy(this.dataSource, this.tenant, this.defaultOrganization, this.defaultEmployees)
		);

		// seed default integrations with types
		const integrationTypes = await this.tryExecute(
			'Default Integration Types',
			createDefaultIntegrationTypes(this.dataSource)
		);

		await this.tryExecute('Default Integrations', createDefaultIntegrations(this.dataSource, integrationTypes));

		await this.tryExecute(
			'Default Event Types',
			createDefaultEventTypes(this.dataSource, this.tenant, this.organizations)
		);

		// run all plugins random seed method
		await this.bootstrapPluginSeedMethods('onPluginBasicSeed', (instance: any) => {
			const pluginName = instance.constructor.name || '(anonymous plugin)';
			console.log(chalk.green(`SEEDED Basic Plugin [${pluginName}]`));
		});

		this.log(chalk.magenta(`✅ SEEDED BASIC ${env.production ? 'PRODUCTION' : ''} DATABASE`));
	}

	/**
	 * Populate default data for default tenant
	 */
	private async seedDefaultData() {
		this.log(chalk.magenta(`🌱 SEEDING DEFAULT ${env.production ? 'PRODUCTION' : ''} DATABASE...`));

		await this.tryExecute(
			'Default Employee Invite',
			createDefaultEmployeeInviteSent(this.dataSource, this.tenant, this.organizations, this.superAdminUsers)
		);

		await this.tryExecute('Default Tags', createDefaultTags(this.dataSource, this.tenant, this.organizations));

		// Organization level inserts which need connection, tenant, role, organizations
		const categories = await this.tryExecute(
			'Default Expense Categories',
			createExpenseCategories(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Employee Levels',
			createEmployeeLevels(this.dataSource, this.tenant, this.organizations)
		);

		// TODO: needs to fix error of seeding Product Category
		await this.tryExecute(
			'Default Product Categories',
			createCategories(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Product Types',
			createDefaultProductType(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Contacts',
			createRandomContacts(
				this.dataSource,
				this.tenant,
				this.organizations,
				randomSeedConfig.noOfRandomContacts || 5
			)
		);

		await this.tryExecute(
			'Default Organization Contacts',
			createDefaultOrganizationContact(this.dataSource, this.tenant, randomSeedConfig.noOfContactsPerOrganization)
		);

		// Employee level data that need connection, tenant, organization, role, users, employee
		await this.tryExecute(
			'Default Teams',
			createDefaultTeams(this.dataSource, this.defaultOrganization, this.defaultEmployees, this.roles)
		);

		this.defaultProjects = await this.tryExecute(
			'Default Organization Projects',
			createDefaultOrganizationProjects(this.dataSource, this.tenant, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Projects Task',
			createDefaultTask(this.dataSource, this.tenant, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Organization Departments',
			createDefaultOrganizationDepartments(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Products',
			createDefaultProducts(this.dataSource, this.tenant, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Merchants',
			createDefaultMerchants(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Time Frames',
			createDefaultTimeFrames(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Equipments',
			createDefaultEquipments(this.dataSource, this.tenant, this.defaultOrganization)
		);

		const organizationVendors = await this.tryExecute(
			'Default Organization Vendors',
			createOrganizationVendors(this.dataSource, this.tenant, this.organizations)
		);

		const defaultCandidates = await this.tryExecute(
			'Default Candidates',
			createDefaultCandidates(this.dataSource, this.tenant, this.defaultOrganization, this.defaultCandidateUsers)
		);

		await this.tryExecute(
			'Default Candidate Sources',
			createCandidateSources(this.dataSource, this.tenant, defaultCandidates, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Candidate Documents',
			createCandidateDocuments(this.dataSource, this.tenant, defaultCandidates, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Candidate Interview',
			createDefaultCandidateInterview(this.dataSource, this.tenant, this.defaultOrganization, defaultCandidates)
		);

		await this.tryExecute(
			'Default Candidate Interviewers',
			createDefaultCandidateInterviewers(
				this.dataSource,
				this.tenant,
				this.defaultOrganization,
				this.defaultEmployees,
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Candidate Feedbacks',
			createCandidateFeedbacks(this.dataSource, this.tenant, this.defaultOrganization, defaultCandidates)
		);

		await this.tryExecute(
			'Default Candidate Educations',
			createCandidateEducations(this.dataSource, this.tenant, defaultCandidates)
		);

		await this.tryExecute(
			'Default Candidate Skills',
			createCandidateSkills(this.dataSource, this.tenant, defaultCandidates, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Incomes',
			createDefaultIncomes(this.dataSource, this.tenant, [this.defaultOrganization], this.defaultEmployees)
		);

		await this.tryExecute(
			'Default Expenses',
			createDefaultExpenses(
				this.dataSource,
				this.organizations,
				this.tenant,
				this.defaultEmployees,
				categories,
				organizationVendors
			)
		);

		await this.tryExecute(
			'Default Employment Types',
			seedDefaultEmploymentTypes(this.dataSource, this.tenant, this.defaultEmployees, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Goal KPIs',
			createDefaultGoalKpi(this.dataSource, this.tenant, this.organizations, this.defaultEmployees)
		);

		const goals = await this.tryExecute(
			'Default Goals',
			createDefaultGoals(this.dataSource, this.tenant, this.organizations, this.defaultEmployees)
		);

		const keyResults = await this.tryExecute(
			'Default Key Results',
			createDefaultKeyResults(this.dataSource, this.tenant, this.defaultEmployees, goals)
		);

		await this.tryExecute(
			'Default Key Result Updates',
			createDefaultKeyResultUpdates(this.dataSource, this.tenant, this.defaultOrganization, keyResults)
		);

		await this.tryExecute('Default Key Result Progress', updateDefaultKeyResultProgress(this.dataSource));

		await this.tryExecute('Default Goal Progress', updateDefaultGoalProgress(this.dataSource));

		const approvalPolicies = await this.tryExecute(
			'Default Approval Policies',
			createDefaultApprovalPolicyForOrg(this.dataSource, {
				orgs: this.organizations
			})
		);

		await this.tryExecute(
			'Default Request Approval Employee',
			createDefaultRequestApprovalEmployee(this.dataSource, {
				employees: this.defaultEmployees,
				orgs: this.organizations,
				approvalPolicies
			})
		);

		await this.tryExecute(
			'Default Equipment Sharing Policies',
			createDefaultEquipmentSharingPolicy(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Organization Languages',
			createDefaultOrganizationLanguage(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute('Default Awards', createDefaultAwards(this.dataSource, this.tenant, this.organizations));

		await this.tryExecute(
			'Default Employee Awards',
			createDefaultEmployeeAwards(this.dataSource, this.tenant, this.defaultEmployees[0])
		);

		await this.tryExecute(
			'Default Invoices',
			createDefaultInvoice(
				this.dataSource,
				this.tenant,
				this.organizations,
				randomSeedConfig.numberOfInvoicePerOrganization || 50
			)
		);

		await this.tryExecute(
			'Default Invoice Items',
			createDefaultInvoiceItem(
				this.dataSource,
				this.tenant,
				this.organizations,
				randomSeedConfig.numberOfInvoiceItemPerInvoice || 5
			)
		);

		await this.tryExecute(
			'Default Payment',
			createDefaultPayment(this.dataSource, this.tenant, this.defaultEmployees, this.organizations)
		);

		await this.tryExecute(
			'Default Pipelines',
			createDefaultPipeline(this.dataSource, this.tenant, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Employee Appointment',
			createDefaultEmployeeAppointment(
				this.dataSource,
				this.tenant,
				this.defaultEmployees,
				this.defaultOrganization
			)
		);

		await this.tryExecute(
			'Default Organization Position',
			seedDefaultOrganizationPosition(this.dataSource, this.tenant, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Organization Documents',
			createOrganizationDocuments(this.dataSource, this.tenant, this.organizations)
		);

		await this.tryExecute(
			'Default Employee TimeOff',
			createDefaultEmployeeTimeOff(
				this.dataSource,
				this.tenant,
				this.defaultOrganization,
				this.defaultEmployees,
				randomSeedConfig.employeeTimeOffPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Default Candidate Personal Qualities',
			createDefaultCandidatePersonalQualities(
				this.dataSource,
				this.tenant,
				this.defaultOrganization,
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Candidate Technologies',
			createDefaultCandidateTechnologies(
				this.dataSource,
				this.tenant,
				this.defaultOrganization,
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Candidate Criterion Rating',
			createDefaultCandidateCriterionRating(
				this.dataSource,
				this.tenant,
				this.defaultOrganization,
				defaultCandidates
			)
		);

		await this.tryExecute(
			'Default Equipment Sharing',
			createDefaultEquipmentSharing(
				this.dataSource,
				this.tenant,
				this.defaultOrganization,
				this.defaultEmployees,
				randomSeedConfig.equipmentSharingPerTenant || 20
			)
		);

		await this.tryExecute(
			'Default Organization Recurring Expense',
			createDefaultOrganizationRecurringExpense(this.dataSource, this.tenant, this.defaultOrganization)
		);

		await this.tryExecute(
			'Default Availability Slots',
			createDefaultAvailabilitySlots(
				this.dataSource,
				[this.tenant],
				this.defaultOrganization,
				this.defaultEmployees,
				randomSeedConfig.availabilitySlotsPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Default Email Sent',
			createDefaultEmailSent(
				this.dataSource,
				this.tenant,
				this.defaultOrganization,
				randomSeedConfig.emailsPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Default TimeSheets',
			createDefaultTimeSheet(
				this.dataSource,
				this.configService.config,
				this.tenant,
				this.defaultOrganization,
				this.defaultEmployees
			)
		);

		// run all plugins default seed method
		await this.bootstrapPluginSeedMethods('onPluginDefaultSeed', (instance: any) => {
			const pluginName = instance.constructor.name || '(anonymous plugin)';
			console.log(chalk.green(`SEEDED Default Plugin [${pluginName}]`));
		});

		this.log(chalk.magenta(`✅ SEEDED DEFAULT ${env.production ? 'PRODUCTION' : ''} DATABASE`));
	}

	/**
	 * Populate database with random generated data
	 */
	private async seedRandomData() {
		this.log(chalk.magenta(`🌱 SEEDING RANDOM ${env.production ? 'PRODUCTION' : ''} DATABASE...`));

		await this.tryExecute('Random Tags', createTags(this.dataSource));

		// Platform level data which only need database connection
		this.randomTenants = await createRandomTenants(this.dataSource, randomSeedConfig.tenants || 1);

		await this.tryExecute(
			'Random Tenant Settings',
			createDefaultTenantSetting(this.dataSource, this.randomTenants)
		);

		await this.tryExecute(
			'Random Feature Reports',
			createRandomTenantOrganizationsReport(this.dataSource, this.randomTenants)
		);

		await this.tryExecute('Random Feature Toggle', createRandomFeatureToggle(this.dataSource, this.randomTenants));

		// Independent roles and role permissions for each tenant
		const roles: IRole[] = await createRoles(this.dataSource, this.randomTenants);

		await this.tryExecute(
			'Random Tenant Role Permissions',
			createRolePermissions(this.dataSource, roles, this.randomTenants)
		);

		// Tenant level inserts which only need connection, tenant, role
		this.randomTenantOrganizationsMap = await createRandomOrganizations(
			this.dataSource,
			this.randomTenants,
			randomSeedConfig.organizationsPerTenant || 1
		);

		const tenantSuperAdminsMap = await createRandomSuperAdminUsers(this.dataSource, this.randomTenants, 1);

		const tenantUsersMap = await createRandomUsers(
			this.dataSource,
			this.randomTenants,
			randomSeedConfig.adminPerOrganization || 1,
			randomSeedConfig.organizationsPerTenant || 1,
			randomSeedConfig.employeesPerOrganization || 1,
			randomSeedConfig.candidatesPerOrganization || 1,
			randomSeedConfig.managersPerOrganization || 1,
			randomSeedConfig.dataEntriesPerOrganization || 1,
			randomSeedConfig.viewersPerOrganization || 1
		);

		// Organization level inserts which need connection, tenant, organizations, users
		const organizationUsersMap = await createRandomUsersOrganizations(
			this.dataSource,
			this.randomTenants,
			this.randomTenantOrganizationsMap,
			tenantSuperAdminsMap,
			tenantUsersMap,
			randomSeedConfig.employeesPerOrganization || 1,
			randomSeedConfig.adminPerOrganization || 1
		);

		this.randomOrganizationEmployeesMap = await createRandomEmployees(
			this.dataSource,
			this.randomTenants,
			this.randomTenantOrganizationsMap,
			organizationUsersMap
		);

		const tags = await this.tryExecute(
			'Random Organization Tags',
			createRandomOrganizationTags(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Organization Documents',
			createRandomOrganizationDocuments(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Product Categories',
			createRandomProductCategories(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Product Types',
			createRandomProductType(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Products',
			createRandomProduct(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Product Option Groups',
			createRandomProductOptionGroups(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				randomSeedConfig.numberOfOptionGroupPerProduct || 5
			)
		);

		await this.tryExecute(
			'Random Product Options',
			createRandomProductOption(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				randomSeedConfig.numberOfOptionPerProduct || 5
			)
		);

		await this.tryExecute(
			'Random Product Variants',
			createRandomProductVariant(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				randomSeedConfig.numberOfVariantPerProduct || 5
			)
		);

		await this.tryExecute(
			'Random Product Variant Prices',
			createRandomProductVariantPrice(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Warehouses',
			createRandomWarehouses(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Merchants',
			createRandomMerchants(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Product Variant Settings',
			createRandomProductVariantSettings(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Incomes',
			createRandomIncomes(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Organization Teams',
			createRandomTeam(
				this.dataSource,
				this.randomTenants,
				roles,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		const randomGoals = await this.tryExecute(
			'Random Goals',
			createRandomGoal(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Key Results',
			createRandomKeyResult(
				this.dataSource,
				this.randomTenants,
				randomGoals,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		const tenantCandidatesMap = await this.tryExecute(
			'Random Candidates',
			createRandomCandidates(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				tenantUsersMap,
				randomSeedConfig.candidatesPerOrganization || 1
			)
		);

		await this.tryExecute(
			'Random Candidate Sources',
			createRandomCandidateSources(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		await this.tryExecute(
			'Random Candidate Documents',
			createRandomCandidateDocuments(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		await this.tryExecute(
			'Random Candidate Experiences',
			createRandomCandidateExperience(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		await this.tryExecute(
			'Random Candidate Skills',
			createRandomCandidateSkills(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		const organizationVendorsMap = await this.tryExecute(
			'Random Organization Vendors',
			createRandomOrganizationVendors(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Time Off Policies',
			createRandomTimeOffPolicies(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		const categoriesMap = await this.tryExecute(
			'Random Expense Categories',
			createRandomExpenseCategories(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Expenses',
			createRandomExpenses(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap,
				organizationVendorsMap,
				categoriesMap
			)
		);

		await this.tryExecute(
			'Random Equipments',
			createRandomEquipments(this.dataSource, this.randomTenants, randomSeedConfig.equipmentPerTenant || 20)
		);

		await this.tryExecute(
			'Random Equipment Sharing',
			createRandomEquipmentSharing(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap,
				randomSeedConfig.equipmentSharingPerTenant || 20
			)
		);

		await this.tryExecute(
			'Random Employment Types',
			seedRandomEmploymentTypes(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Organization Departments',
			seedRandomOrganizationDepartments(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Employee Invites',
			createRandomEmployeeInviteSent(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				tenantSuperAdminsMap,
				randomSeedConfig.invitePerOrganization || 20
			)
		);

		await this.tryExecute(
			'Random Organization Positions',
			seedRandomOrganizationPosition(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Approval Policies',
			createRandomApprovalPolicyForOrg(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Equipment Sharing Policies',
			createRandomEquipmentSharingPolicy(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Request Approvals',
			createRandomRequestApproval(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap,
				randomSeedConfig.requestApprovalPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Random Organization Projects',
			createRandomOrganizationProjects(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				tags || [],
				randomSeedConfig.projectsPerOrganization || 10
			)
		);

		await this.tryExecute(
			'Random Employee Time Off',
			createRandomEmployeeTimeOff(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap,
				randomSeedConfig.employeeTimeOffPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Random Email Sent',
			createRandomEmailSent(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				randomSeedConfig.emailsPerOrganization || 20
			)
		);

		await this.tryExecute('Random Tasks', createRandomTask(this.dataSource, this.randomTenants));

		await this.tryExecute(
			'Random Organization Contacts',
			createRandomOrganizationContact(
				this.dataSource,
				this.randomTenants,
				randomSeedConfig.noOfContactsPerOrganization
			)
		);

		await this.tryExecute(
			'Random Invoices',
			createRandomInvoice(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				randomSeedConfig.numberOfInvoicePerOrganization || 50
			)
		);

		await this.tryExecute(
			'Random Invoice Items',
			createRandomInvoiceItem(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				randomSeedConfig.numberOfInvoiceItemPerInvoice || 5
			)
		);

		await this.tryExecute(
			'Random Availability Slots',
			createRandomAvailabilitySlots(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap,
				randomSeedConfig.availabilitySlotsPerOrganization || 20
			)
		);

		await this.tryExecute(
			'Random Payments',
			createRandomPayment(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Candidate Educations',
			createRandomCandidateEducations(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		await this.tryExecute(
			'Random Candidate Interviews',
			createRandomCandidateInterview(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		await this.tryExecute(
			'Random Candidate Technologies',
			createRandomCandidateTechnologies(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		await this.tryExecute(
			'Random Candidate Personal Qualities',
			createRandomCandidatePersonalQualities(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		await this.tryExecute(
			'Random Awards',
			createRandomAwards(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Candidate Interviewers',
			createRandomCandidateInterviewers(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap,
				tenantCandidatesMap
			)
		);

		await this.tryExecute(
			'Random Candidate Feedbacks',
			createRandomCandidateFeedbacks(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		await this.tryExecute(
			'Random Employee Recurring Expenses',
			createRandomEmployeeRecurringExpense(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Employee Settings',
			createRandomEmployeeSetting(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Organization Languages',
			createRandomOrganizationLanguage(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Organization Recurring Expenses',
			createRandomOrganizationRecurringExpense(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap
			)
		);

		await this.tryExecute(
			'Random Organization Sprints',
			createRandomOrganizationSprint(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Organization Team Employees',
			createRandomOrganizationTeamEmployee(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Appointment Employees',
			createRandomAppointmentEmployees(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Employee Appointments',
			createRandomEmployeeAppointment(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Pipelines',
			createRandomPipeline(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Pipeline Stages',
			createRandomPipelineStage(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Deals',
			createRandomDeal(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Integrations',
			createRandomIntegrationTenant(this.dataSource, this.randomTenants)
		);

		await this.tryExecute(
			'Random Integration Settings',
			createRandomIntegrationSetting(this.dataSource, this.randomTenants)
		);

		await this.tryExecute(
			'Random Integration Map',
			createRandomIntegrationMap(this.dataSource, this.randomTenants)
		);

		await this.tryExecute(
			'Random Integration Entity Settings',
			createRandomIntegrationEntitySetting(this.dataSource, this.randomTenants)
		);

		await this.tryExecute(
			'Random Integration Entity Settings Tied Entity',
			createRandomIntegrationEntitySettingTied(this.dataSource, this.randomTenants)
		);

		await this.tryExecute(
			'Random Request Approval Employee',
			createRandomRequestApprovalEmployee(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random Request Approval Team',
			createRandomRequestApprovalTeam(this.dataSource, this.randomTenants, this.randomTenantOrganizationsMap)
		);

		await this.tryExecute(
			'Random Candidate Criterion Ratings',
			createRandomCandidateCriterionRating(this.dataSource, this.randomTenants, tenantCandidatesMap)
		);

		await this.tryExecute(
			'Random Event Types',
			createRandomEventType(
				this.dataSource,
				this.randomTenants,
				this.randomTenantOrganizationsMap,
				this.randomOrganizationEmployeesMap
			)
		);

		await this.tryExecute(
			'Random TimeSheets',
			createRandomTimesheet(this.dataSource, this.configService.config, this.randomTenants)
		);

		// run all plugins random seed method
		await this.bootstrapPluginSeedMethods('onPluginRandomSeed', (instance: any) => {
			const pluginName = instance.constructor.name || '(anonymous plugin)';
			console.log(chalk.green(`SEEDED Random Plugin [${pluginName}]`));
		});

		this.log(chalk.magenta(`✅ SEEDED RANDOM ${env.production ? 'PRODUCTION' : ''} DATABASE`));
	}

	/**
	 * Cleans all the previous generate screenshots, reports etc
	 */
	private async cleanUpPreviousRuns() {
		this.log(chalk.green(`CLEANING UP FROM PREVIOUS RUNS...`));

		await new Promise((resolve) => {
			const assetOptions = this.configService.assetOptions;
			const dir = env.isElectron
				? path.join(path.resolve(env.gauzyUserPath, ...['public']), 'screenshots')
				: path.join(assetOptions.assetPublicPath, 'screenshots');

			// delete old generated screenshots
			rimraf(`${dir}/!(rimraf|.gitkeep)`, () => {
				this.log(chalk.green(`✅ CLEANED UP`));
				resolve(true);
			});
		});
	}

	/**
	 * Create connection from database
	 */
	private async createConnection() {
		if (!this.dataSource) {
			this.log('NOTE: DATABASE CONNECTION DOES NOT EXIST YET. NEW ONE WILL BE CREATED!');
		}
		const { dbConnectionOptions } = this.configService;
		if (!this.dataSource || !this.dataSource.isInitialized) {
			try {
				this.log(chalk.green(`CONNECTING TO DATABASE...`));
				const options = {
					...dbConnectionOptions,
					...this.overrideDbConfig
				};
				const dataSource = new DataSource({
					...options
				} as DataSourceOptions);

				if (!dataSource.isInitialized) {
					this.dataSource = await dataSource.initialize();
					this.log(chalk.green(`✅ CONNECTED TO DATABASE!`));
				}
			} catch (error) {
				this.handleError(error, 'Unable to connect to database');
			}
		}
	}

	/**
	 * Close connection from database
	 */
	private async closeConnection() {
		try {
			if (this.dataSource && this.dataSource.isInitialized) {
				await this.dataSource.destroy();
				this.log(chalk.green(`✅ DISCONNECTED TO DATABASE!`));
			}
		} catch (error) {
			this.log('NOTE: DATABASE CONNECTION DOES NOT EXIST YET. CANT CLOSE CONNECTION!');
		}
	}

	/**
	 * Reset the database, truncate all tables (remove all data)
	 */
	private async resetDatabase() {
		this.log(chalk.green(`RESETTING DATABASE...`));

		const entities = await this.getEntities();
		await this.cleanAll(entities);

		this.log(chalk.green(`✅ RESET DATABASE SUCCESSFUL`));
	}

	/**
	 * Retrieve entities metadata
	 */
	private async getEntities() {
		const entities = [];
		try {
			this.dataSource.entityMetadatas.forEach((entity) =>
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
	private async cleanAll(entities: Array<any>) {
		try {
			const manager = this.dataSource.manager;
			const databaseType = getDBType(this.configService.dbConnectionOptions);

			switch (databaseType) {
				case DatabaseTypeEnum.postgres:
					const tables = entities.map((entity) => '"' + entity.tableName + '"');
					const truncateSql = `TRUNCATE TABLE ${tables.join(',')} RESTART IDENTITY CASCADE;`;
					await manager.query(truncateSql);
					break;
				case DatabaseTypeEnum.mysql:
					// -- disable foreign_key_checks to avoid query failing when there is a foreign key in the table
					await manager.query(`SET foreign_key_checks = 0;`);
					for (const entity of entities) {
						await manager.query(`DELETE FROM \`${entity.tableName}\`;`);
					}
					await manager.query(`SET foreign_key_checks = 1;`);
					break;
				case DatabaseTypeEnum.sqlite:
				case DatabaseTypeEnum.betterSqlite3:
					await manager.query(`PRAGMA foreign_keys = OFF;`);
					for (const entity of entities) {
						await manager.query(`DELETE FROM "${entity.tableName}";`);
					}
					break;
				default:
					throw Error(`Unsupported database type: ${databaseType}`);
			}
		} catch (error) {
			this.handleError(error, 'Unable to clean database');
		}
	}

	/**
	 * Bootstrap Plugins Seed Methods
	 *
	 * @param lifecycleMethod
	 * @param closure
	 */
	private async bootstrapPluginSeedMethods(
		lifecycleMethod: keyof PluginLifecycleMethods,
		closure?: (instance: any) => void
	): Promise<void> {
		const plugins = getPluginModules(this.configService.plugins);
		for (const plugin of plugins) {
			let classInstance: ClassDecorator;
			try {
				classInstance = this.moduleRef.get(plugin, { strict: false });
			} catch (e) {
				console.log(`Could not find ${plugin.name}`, undefined, e.stack);
			}
			if (classInstance && hasLifecycleMethod(classInstance, lifecycleMethod)) {
				await classInstance[lifecycleMethod]();

				if (typeof closure === 'function') {
					closure(classInstance);
				}
			}
		}
	}

	/**
	 * Use this wrapper function for all seed functions which are not essential.
	 * Essentials seeds are ONLY those which are required to start the UI/login
	 */
	public tryExecute<T>(name: string, p: Promise<T>): Promise<T> | Promise<void> {
		this.log(chalk.green(`${moment().format('DD.MM.YYYY HH:mm:ss')} SEEDING ${name}`));

		return (p as any).then(
			(x: T) => x,
			(error: Error) => {
				this.log(chalk.bgRed(`🛑 ERROR: ${error ? error.message : 'unknown'}`));
			}
		);
	}

	private handleError(error: Error, message?: string): void {
		this.log(chalk.bgRed(`🛑 ERROR: ${message ? message + '-> ' : ''} ${error ? error.message : ''}`));
		throw error;
	}
}
