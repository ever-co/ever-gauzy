import { CandidateExperience } from './../../candidate-experience/candidate-experience.entity';
// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

import { Injectable } from '@nestjs/common';
import {
	Connection,
	createConnection,
	getRepository,
	ConnectionOptions,
	getConnection,
} from 'typeorm';
import chalk from 'chalk';
import { environment as env } from '@env-api/environment';
import { Role } from '../../role/role.entity';
import { createRoles } from '../../role/role.seed';
import { createSkills } from '../../skills/skill.seed';
import { User } from '../../user/user.entity';
import {
	createDefaultSuperAdminUsers,
	createDefaultUsers,
	createRandomSuperAdminUsers,
	createRandomUsers,
} from '../../user/user.seed';
import { Employee } from '../../employee/employee.entity';
import {
	createDefaultEmployees,
	createRandomEmployees,
} from '../../employee/employee.seed';
import { Organization } from '../../organization/organization.entity';
import {
	createDefaultOrganizations,
	createRandomOrganizations,
} from '../../organization/organization.seed';
import { Income } from '../../income/income.entity';
import {
	createDefaultIncomes,
	createRandomIncomes,
} from '../../income/income.seed';
import { Expense } from '../../expense/expense.entity';
import {
	createDefaultExpenses,
	createRandomExpenses,
} from '../../expense/expense.seed';
import { EmployeeSetting } from '../../employee-setting/employee-setting.entity';
import {
	createDefaultUsersOrganizations,
	createRandomUsersOrganizations,
} from '../../user-organization/user-organization.seed';
import { UserOrganization } from '../../user-organization/user-organization.entity';
import { createCountries } from '../../country/country.seed';
import { OrganizationTeam } from '../../organization-team/organization-team.entity';
import { OrganizationTeamEmployee } from '../../organization-team-employee/organization-team-employee.entity';
import { Country } from '../../country';
import { createDefaultTeams } from '../../organization-team/organization-team.seed';
import { RolePermissions } from '../../role-permissions/role-permissions.entity';
import { createRolePermissions } from '../../role-permissions/role-permissions.seed';
import {
	createDefaultTenants,
	createRandomTenants,
} from '../../tenant/tenant.seed';
import { EmailTemplate } from '../../email-template';
import { createEmailTemplates } from '../../email-template/email-template.seed';
import {
	seedDefaultEmploymentTypes,
	seedRandomEmploymentTypes,
} from '../../organization/employment-types.seed';
import { OrganizationEmploymentType } from '../../organization-employment-type/organization-employment-type.entity';
import { Equipment } from '../../equipment';
import { createEmployeeLevels } from '../../organization_employeeLevel/organization-employee-level.seed';
import { EmployeeLevel } from '../../organization_employeeLevel/organization-employee-level.entity';
import { createDefaultTimeOffPolicy } from '../../time-off-policy/time-off-policy.seed';
import { createDefaultApprovalPolicyForOrg } from '../../approval-policy/approval-policy.seed';
import { createExpenseCategories } from '../../expense-categories/expense-categories.seed';
import {
	createOrganizationVendors,
	createRandomOrganizationVendors,
} from '../../organization-vendors/organization-vendors.seed';
import { Invoice } from '../../invoice/invoice.entity';
import { InvoiceItem } from '../../invoice-item/invoice-item.entity';
import { TimeOffPolicy } from '../../time-off-policy/time-off-policy.entity';
import { Proposal } from '../../proposal/proposal.entity';
import { Invite } from '../../invite/invite.entity';
import { EmployeeRecurringExpense } from '../../employee-recurring-expense/employee-recurring-expense.entity';
import { ExpenseCategory } from '../../expense-categories/expense-category.entity';
import { EquipmentSharing } from '../../equipment-sharing/equipment-sharing.entity';
import { OrganizationClients } from '../../organization-clients/organization-clients.entity';
import { OrganizationVendor } from '../../organization-vendors/organization-vendors.entity';
import { OrganizationDepartment } from '../../organization-department/organization-department.entity';
import { OrganizationProjects } from '../../organization-projects/organization-projects.entity';
import { Task } from '../../tasks/task.entity';
import { Screenshot } from '../../timesheet/screenshot.entity';
import { Activity } from '../../timesheet/activity.entity';
import { TimeSlot } from '../../timesheet/time-slot.entity';
import { Timesheet } from '../../timesheet/timesheet.entity';
import { OrganizationRecurringExpense } from '../../organization-recurring-expense/organization-recurring-expense.entity';
import { OrganizationPositions } from '../../organization-positions/organization-positions.entity';
import { Email } from '../../email/email.entity';
import { Candidate } from '../../candidate/candidate.entity';
import {
	createDefaultCandidates,
	createRandomCandidates,
} from '../../candidate/candidate.seed';
import { CandidateSource } from '../../candidate-source/candidate-source.entity';
import { Tag } from './../../tags/tag.entity';
import { Skill } from './../../skills/skill.entity';
import { Tenant } from './../../tenant/tenant.entity';
import { ProductCategory } from '../../product-category/product-category.entity';
import { createDefaultProductCategories } from '../../product-category/product-category.seed';
import { ProductType } from '../../product-type/product-type.entity';
import { CandidateEducation } from '../../candidate-education/candidate-education.entity';
import { createDefaultProductTypes } from '../../product-type/product-type.seed';
import { Product } from '../../product/product.entity';
import { ProductVariant } from '../../product-variant/product-variant.entity';
import { ProductVariantSettings } from '../../product-settings/product-settings.entity';
import { ProductVariantPrice } from '../../product-variant-price/product-variant-price.entity';
import { CandidateDocument } from '../../candidate-documents/candidate-documents.entity';
import { CandidateSkill } from '../../candidate-skill/candidate-skill.entity';
import {
	createCandidateSources,
	createRandomCandidateSources,
} from '../../candidate-source/candidate-source.seed';
import {
	createCandidateDocuments,
	createRandomCandidateDocuments,
} from '../../candidate-documents/candidate-documents.seed';
import { CandidateFeedback } from '../../candidate-feedbacks/candidate-feedbacks.entity';
import {
	createCandidateFeedbacks,
	createRandomCandidateFeedbacks,
} from '../../candidate-feedbacks/candidate-feedbacks.seed';
import { createDefaultIntegrationTypes } from '../../integration/integration-type.seed';
import { createDefaultIntegrations } from '../../integration/integration.seed';
import { EmployeeAppointment } from '../../employee-appointment/employee-appointment.entity';
import { AppointmentEmployees } from '../../appointment-employees/appointment-employees.entity';
import { ProductOption } from '../../product-option/product-option.entity';
import { HelpCenter } from '../../help-center/help-center.entity';

const allEntities = [
	TimeOffPolicy,
	Proposal,
	Invite,
	EmployeeRecurringExpense,
	OrganizationRecurringExpense,
	ExpenseCategory,
	EquipmentSharing,
	User,
	Employee,
	Candidate,
	Role,
	Organization,
	Income,
	Invoice,
	InvoiceItem,
	Expense,
	EmployeeSetting,
	OrganizationTeam,
	OrganizationTeamEmployee,
	OrganizationClients,
	OrganizationVendor,
	OrganizationDepartment,
	OrganizationPositions,
	OrganizationProjects,
	Task,
	Screenshot,
	Activity,
	TimeSlot,
	Timesheet,
	UserOrganization,
	Country,
	RolePermissions,
	Tenant,
	Email,
	EmailTemplate,
	Tag,
	Skill,
	OrganizationEmploymentType,
	Equipment,
	EmployeeLevel,
	ProductCategory,
	AppointmentEmployees,
	EmployeeAppointment,
	ProductType,
	CandidateSource,
	CandidateEducation,
	CandidateSkill,
	CandidateExperience,
	HelpCenter,
	Product,
	ProductVariant,
	ProductVariantSettings,
	ProductVariantPrice,
	ProductOption,
	CandidateDocument,
	CandidateFeedback,
];

@Injectable()
export class SeedDataService {
	connection: Connection;
	log = console.log;

	constructor() {}

	async createConnection() {
		try {
			this.connection = getConnection();
		} catch (error) {
			this.log('DATABASE CONNECTION DOES NOT EXIST');
		}

		if (!this.connection || !this.connection.isConnected) {
			try {
				this.log(chalk.green('🏃‍CONNECTING TO DATABASE...'));

				this.connection = await createConnection({
					...env.database,
					entities: allEntities,
				} as ConnectionOptions);
			} catch (error) {
				this.handleError(error, 'Unable to connect to database');
			}
		}
	}

	/**
	 * Seed data
	 */
	async run() {
		try {
			// Connect to database
			await this.createConnection();

			// Reset database to start with new, fresh data
			await this.resetDatabase();

			// Seed data with mock / fake data
			await this.seedData();

			console.log('Database Seed completed');
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Populate database with mock data
	 */
	async seedData() {
		try {
			this.log(
				chalk.green(
					`🌱 SEEDING ${
						env.production ? 'PRODUCTION' : ''
					} DATABASE...`
				)
			);

			//Seed data which only needs connection
			const categories = await createExpenseCategories(this.connection);

			await createCountries(this.connection);

			await createEmailTemplates(this.connection);

			await this.seedDefaultData(categories);

			await this.seedRandomData(categories);

			this.log(
				chalk.green(
					`✅ SEEDED ${env.production ? 'PRODUCTION' : ''} DATABASE`
				)
			);
		} catch (error) {
			this.handleError(error);
		}
	}

	/**
	 * Populate default data from env files
	 */
	async seedDefaultData(categories: ExpenseCategory[]) {
		//Platform level data
		const tenant = await createDefaultTenants(this.connection);

		const roles: Role[] = await createRoles(this.connection, [tenant]);

		await createRolePermissions(this.connection, roles, [tenant]);

		//Tenant level inserts which only need connection, tenant, roles
		const defaultOrganizations = await createDefaultOrganizations(
			this.connection,
			tenant
		);

		const superAdminUsers = await createDefaultSuperAdminUsers(
			this.connection,
			roles,
			tenant
		);

		//Organization level inserts which need connection, tenant, role, organizations

		await createEmployeeLevels(this.connection, defaultOrganizations);

		await createDefaultProductCategories(
			this.connection,
			defaultOrganizations
		);

		await createDefaultProductTypes(this.connection, defaultOrganizations);

		const organizationVendors = await createOrganizationVendors(
			this.connection,
			defaultOrganizations
		);

		const {
			adminUsers,
			defaultEmployeeUsers,
			defaultCandidateUsers,
		} = await createDefaultUsers(this.connection, roles, tenant);

		await createDefaultUsersOrganizations(this.connection, {
			organizations: defaultOrganizations,
			users: [...defaultEmployeeUsers, ...adminUsers, ...superAdminUsers],
		});

		//User level data that needs connection, tenant, organization, role, users
		const defaultEmployees = await createDefaultEmployees(this.connection, {
			tenant,
			org: defaultOrganizations[0],
			users: defaultEmployeeUsers,
		});

		const defaultCandidates = await createDefaultCandidates(
			this.connection,
			{
				tenant,
				org: defaultOrganizations[0],
				users: [...defaultCandidateUsers],
			}
		);

		await createCandidateSources(this.connection, defaultCandidates);
		await createCandidateDocuments(this.connection, defaultCandidates);
		await createCandidateFeedbacks(this.connection, defaultCandidates);

		//Employee level data that need connection, tenant, organization, role, users, employee
		await createDefaultTeams(
			this.connection,
			defaultOrganizations[0],
			defaultEmployees
		);

		await createDefaultIncomes(this.connection, {
			org: defaultOrganizations[0],
			employees: defaultEmployees,
		});

		await createDefaultExpenses(this.connection, {
			org: defaultOrganizations[0],
			employees: defaultEmployees,
			categories,
			organizationVendors,
		});

		await seedDefaultEmploymentTypes(
			this.connection,
			defaultEmployees,
			defaultOrganizations[0]
		);

		await createDefaultTimeOffPolicy(this.connection, {
			org: defaultOrganizations[0],
			employees: defaultEmployees,
		});

		await createDefaultApprovalPolicyForOrg(this.connection, {
			orgs: defaultOrganizations,
		});

		const integrationTypes = await createDefaultIntegrationTypes(
			this.connection
		);
		await createDefaultIntegrations(this.connection, integrationTypes);
	}

	/**
	 * Populate database with random generated data
	 */
	async seedRandomData(categories: ExpenseCategory[]) {
		if (!env.randomSeedConfig) {
			this.log(
				chalk.red(
					`randomSeedConfig NOT FOUND IN ENV. Random data would not be seeded`
				)
			);
			return;
		}

		//Platform level data which only need database connection
		const tenants = await createRandomTenants(
			this.connection,
			env.randomSeedConfig.tenants || 1
		);

		// Independent roles and role permissions for each tenant
		const roles: Role[] = await createRoles(this.connection, tenants);

		await createRolePermissions(this.connection, roles, tenants);

		//Tenant level inserts which only need connection, tenant, role
		const tenantOrganizationsMap = await createRandomOrganizations(
			this.connection,
			tenants,
			env.randomSeedConfig.organizationsPerTenant || 1
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
			env.randomSeedConfig.organizationsPerTenant || 1,
			env.randomSeedConfig.employeesPerOrganization || 1,
			env.randomSeedConfig.candidatesPerOrganization || 1
		);

		//Organization level inserts which need connection, tenant, organizations, users
		await createRandomUsersOrganizations(
			this.connection,
			tenants,
			tenantOrganizationsMap,
			tenantSuperAdminsMap,
			tenantUsersMap,
			env.randomSeedConfig.employeesPerOrganization || 1
		);

		const tenantEmployeeMap = await createRandomEmployees(
			this.connection,
			tenants,
			tenantOrganizationsMap,
			tenantUsersMap,
			env.randomSeedConfig.employeesPerOrganization || 1
		);

		const tenantCandidatesMap = await createRandomCandidates(
			this.connection,
			tenants,
			tenantOrganizationsMap,
			tenantUsersMap,
			env.randomSeedConfig.candidatesPerOrganization || 1
		);
		await createRandomCandidateDocuments(
			this.connection,
			tenants,
			tenantCandidatesMap
		);
		await createRandomCandidateFeedbacks(
			this.connection,
			tenants,
			tenantCandidatesMap
		);
		await createRandomCandidateSources(
			this.connection,
			tenants,
			tenantCandidatesMap
		);
		await createRandomIncomes(this.connection, tenants, tenantEmployeeMap);

		const organizationVendorsMap = await createRandomOrganizationVendors(
			this.connection,
			tenants,
			tenantOrganizationsMap
		);

		await createRandomExpenses(
			this.connection,
			tenants,
			tenantEmployeeMap,
			organizationVendorsMap,
			categories
		);

		await seedRandomEmploymentTypes(
			this.connection,
			tenants,
			tenantOrganizationsMap
		);

		await createSkills(this.connection);
	}

	/**
	 * Retrieve entities metadata
	 */
	async getEntities() {
		const entities = [];
		try {
			(await (await this.connection).entityMetadatas).forEach((entity) =>
				entities.push({
					name: entity.name,
					tableName: entity.tableName,
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
	async cleanAll(entities) {
		try {
			for (const entity of entities) {
				const repository = await getRepository(entity.name);
				await repository.query(
					`TRUNCATE TABLE "public"."${entity.tableName}" CASCADE;`
				);
			}
		} catch (error) {
			this.handleError(error, 'Unable to clean database');
		}
	}

	/**
	 * Reset the database, truncate all tables (remove all data)
	 */
	async resetDatabase() {
		const entities = await this.getEntities();
		await this.cleanAll(entities);
		//await loadAll(entities);
		this.log(chalk.green(`✅ RESET DATABASE SUCCESSFUL`));
	}

	private handleError(error: Error, message?: string): void {
		this.log(
			chalk.bgRed(
				`🛑 ERROR: ${!!message ? message : 'Unable to seed database'}`
			)
		);
		throw error;
	}
}
