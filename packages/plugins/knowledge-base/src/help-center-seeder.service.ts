import { Injectable } from '@nestjs/common';
import { Connection, getConnection, Not } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import {
	getDefaultOrganizations,
	getDefaultTenant,
	getDefaultEmployees,
	SeedDataService,
	Tenant,
	Employee,
	DEFAULT_EVER_TENANT
} from '@gauzy/core';
import { createHelpCenter } from './help-center';
import { createHelpCenterArticle } from './help-center-article/help-center-article.seed';
import {
	createDefaultHelpCenterAuthor,
	createRandomHelpCenterAuthor
} from './help-center-author';

/**
 * Service dealing with help center based operations.
 *
 * @class
 */
@Injectable()
export class HelpCenterSeederService {
	connection: Connection;

	/**
	 * Create an instance of class.
	 *
	 * @constructs
	 *
	 */
	constructor(private readonly seeder: SeedDataService) {}

	/**
	 * Seed all default help center and related methods.
	 *
	 * @function
	 */
	async createDefault() {
		this.connection = getConnection();
		const tenant = await getDefaultTenant(this.connection);
		const organizations = await getDefaultOrganizations(this.connection, tenant);
		
		const tenantOrganizationsMap: Map<ITenant, IOrganization[]> = new Map();
		tenantOrganizationsMap.set(tenant, organizations);

		await this.seeder.tryExecute(
			'Default Help Centers',
			createHelpCenter(
				this.connection,
				[tenant],
				tenantOrganizationsMap
			)
		);

		const noOfHelpCenterArticle = 20;
		await this.seeder.tryExecute(
			'Default Help Center Articles',
			createHelpCenterArticle(
				this.connection,
				[tenant],
				tenantOrganizationsMap,
				noOfHelpCenterArticle
			)
		);

		const defaultEmployees = await getDefaultEmployees(this.connection);
		await this.seeder.tryExecute(
			'Default Help Center Author',
			createDefaultHelpCenterAuthor(
				this.connection,
				defaultEmployees
			)
		);
	}

	/**
	 * Seed all random help center and related methods.
	 *
	 * @function
	 */
	async createRandom() {
		const rendomTenants: ITenant[] = await this.connection.getRepository(Tenant).find({
			where: {
				name: Not(DEFAULT_EVER_TENANT)
			},
			relations: ['organizations']
		});

		const tenantOrganizationsMap: Map<ITenant, IOrganization[]> = new Map();
		const employeeMap: Map<ITenant, IEmployee[]> = new Map();

		for await (const tenant of rendomTenants) {
			const { organizations } = tenant;
			tenantOrganizationsMap.set(tenant, organizations);

			const employees: Employee[] = await this.connection.getRepository(Employee).find({ 
				where: { 
					tenantId: tenant.id 
				}
			});
			employeeMap.set(tenant, employees);
		}

		await this.seeder.tryExecute(
			'Random Help Centers',
			createHelpCenter(
				this.connection,
				rendomTenants,
				tenantOrganizationsMap
			)
		);

		const noOfHelpCenterArticle = 40;
		await this.seeder.tryExecute(
			'Random Help Center Articles',
			createHelpCenterArticle(
				this.connection,
				rendomTenants,
				tenantOrganizationsMap,
				noOfHelpCenterArticle
			)
		);

		await this.seeder.tryExecute(
			'Random Help Center Authors',
			createRandomHelpCenterAuthor(
				this.connection,
				rendomTenants,
				employeeMap
			)
		);
	}
}
