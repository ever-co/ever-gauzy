// Modified code from https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit.
// MIT License, see https://github.com/alexitaylor/angular-graphql-nestjs-postgres-starter-kit/blob/master/LICENSE
// Copyright (c) 2019 Alexi Taylor

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
import { User } from '../../user/user.entity';
import { createUsers } from '../../user/user.seed';
import { Employee } from '../../employee/employee.entity';
import { createEmployees } from '../../employee/employee.seed';
import { Organization } from '../../organization/organization.entity';
import { createOrganizations } from '../../organization/organization.seed';
import { Income } from '../../income/income.entity';
import { createIncomes } from '../../income/income.seed';
import { Expense } from '../../expense/expense.entity';
import { createExpenses } from '../../expense/expense.seed';
import { EmployeeSetting } from '../../employee-setting/employee-setting.entity';
import { createUsersOrganizations } from '../../user-organization/user-organization.seed';
import { UserOrganization } from '../../user-organization/user-organization.entity';
import { createCountries } from '../../country/country.seed';
import { OrganizationTeams } from '../../organization-teams/organization-teams.entity';
import { Country } from '../../country';
import { createTeams } from '../../organization-teams/organization-teams.seed';
import { RolePermissions } from '../../role-permissions/role-permissions.entity';
import { createRolePermissions } from '../../role-permissions/role-permissions.seed';
import { createTenant } from '../../tenant/tenant.seed';
import { EmailTemplate } from '../../email-template';
import { createEmailTemplates } from '../../email-template/email-template.seed';
import { seedEmploymentTypes } from '../../organization/employment-types.seed';
import { OrganizationEmploymentType } from '../../organization-employment-type/organization-employment-type.entity';
import { Equipment } from '../../equipment';
import { createEmployeeLevels } from '../../organization_employeeLevel/organization-employee-level.seed';
import { EmployeeLevel } from '../../organization_employeeLevel/organization-employee-level.entity';
import { createDefaultTimeOffPolicy } from '../../time-off-policy/time-off-policy.seed';
import { createExpenseCategories } from '../../expense-categories/expense-categories.seed';
import { createOrganizationVendors } from '../../organization-vendors/organization-vendors.seed';
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
import { createCandidates } from '../../candidate/candidate.seed';
import { CandidateSource } from '../../candidate_source/candidate_source.entity';
import { Tag } from './../../tags/tag.entity';
import { Tenant } from './../../tenant/tenant.entity';
import { createCandidateSources } from '../../candidate_source/candidate_source.seed';
import { CandidateCv } from '../../candidate-cv/candidate-cv.entity';
import { createCandidateCvs } from '../../candidate-cv/candidate-cv.seed';
import { ProductCategory } from '../../product-category/product-category.entity';
import { createProductCategories } from '../../product-category/product-category.seed';
import { ProductType } from '../../product-type/product-type.entity';
import { createProductTypes } from '../../product-type/product-type.seed';
import { CandidateEducation } from '../../candidate-education/candidate-education.entity';
import { Product } from '../../product/product.entity';
import { ProductVariant } from '../../product-variant/product-variant.entity';
import { ProductVariantSettings } from '../../product-settings/product-settings.entity';
import { ProductVariantPrice } from '../../product-variant-price/product-variant-price.entity';

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
	OrganizationTeams,
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
	OrganizationEmploymentType,
	Equipment,
	EmployeeLevel,
	ProductCategory,
	ProductType,
	CandidateSource,
	CandidateEducation,
	Product,
	ProductVariant,
	ProductVariantSettings,
	ProductVariantPrice
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
					entities: allEntities
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

			const cvs: CandidateCv[] = await createCandidateCvs(
				this.connection
			);

			const tenant = await createTenant(this.connection);

			const sources: CandidateSource[] = await createCandidateSources(
				this.connection
			);

			const roles: Role[] = await createRoles(this.connection);
			const {
				superAdminUsers,
				adminUsers,
				defaultUsers,
				randomUsers,
				defaultCandidateUser,
				randomCandidateUser
			} = await createUsers(this.connection, roles, tenant);
			const {
				defaultOrganization,
				randomOrganizations
			} = await createOrganizations(this.connection, tenant);

			const employees = await createEmployees(
				this.connection,
				{
					tenant,
					org: defaultOrganization,
					users: defaultUsers
				},
				{
					orgs: randomOrganizations,
					users: randomUsers,
					tenant
				}
			);

			await createCandidates(
				this.connection,
				{
					tenant,
					org: defaultOrganization,
					users: [...defaultCandidateUser]
				},
				{
					source: sources,
					cvs: cvs,
					org: defaultOrganization,
					orgs: randomOrganizations,
					users: [...randomCandidateUser]
				}
			);
			await createTeams(
				this.connection,
				defaultOrganization,
				employees.defaultEmployees
			);

			await createUsersOrganizations(
				this.connection,
				{
					org: defaultOrganization,
					users: [...defaultUsers, ...adminUsers, ...superAdminUsers]
				},
				{
					orgs: randomOrganizations,
					users: randomUsers,
					superAdminUsers
				}
			);

			await createIncomes(
				this.connection,
				{
					org: defaultOrganization,
					employees: [...employees.defaultEmployees]
				},
				{
					orgs: randomOrganizations,
					employees: [...employees.randomEmployees]
				}
			);

			const organizationVendors = await createOrganizationVendors(
				this.connection,
				defaultOrganization.id
			);
			const categories = await createExpenseCategories(this.connection);

			await createExpenses(
				this.connection,
				{
					org: defaultOrganization,
					employees: [...employees.defaultEmployees],
					categories,
					organizationVendors
				},
				{
					orgs: randomOrganizations,
					employees: [...employees.randomEmployees],
					categories,
					organizationVendors
				}
			);

			await createCountries(this.connection);

			await createRolePermissions(this.connection, roles);

			await createEmailTemplates(this.connection);

			await seedEmploymentTypes(
				this.connection,
				[...randomOrganizations, defaultOrganization],
				employees.defaultEmployees,
				defaultOrganization
			);

			await createEmployeeLevels(this.connection);

			await createDefaultTimeOffPolicy(this.connection, {
				org: defaultOrganization,
				employees: [...employees.defaultEmployees]
			});

			await createProductCategories(this.connection, defaultOrganization);

			await createProductTypes(this.connection, defaultOrganization);

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
	 * Retrieve entities metadata
	 */
	async getEntities() {
		const entities = [];
		try {
			(await (await this.connection).entityMetadatas).forEach((entity) =>
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
