import { Injectable } from '@nestjs/common';
import { Connection, getConnection, Not } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import {
	getDefaultOrganizations,
	getDefaultEmployees,
	SeedDataService,
	Tenant,
	Employee
} from '@gauzy/core';
import { createHelpCenter } from './help-center';
import { createHelpCenterArticle } from './help-center-article/help-center-article.seed';
import {
	createDefaultHelpCenterAuthor,
	createRandomHelpCenterAuthor
} from './help-center-author';
import { SEEDER_DB_CONNECTION } from '@gauzy/common';

/**
 * Service dealing with help center based operations.
 *
 * @class
 */
@Injectable()
export class HelpCenterSeederService {
	connection: Connection;
	tenant: ITenant;

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
		this.connection = getConnection(SEEDER_DB_CONNECTION);
		this.tenant = this.seeder.tenant;

		const organizations = await getDefaultOrganizations(
			this.connection, 
			this.tenant
		);
		const tenantOrganizationsMap: Map<ITenant, IOrganization[]> = new Map();
		tenantOrganizationsMap.set(this.tenant, organizations);

		await this.seeder.tryExecute(
			'Default Help Centers',
			createHelpCenter(
				this.connection,
				[this.tenant],
				tenantOrganizationsMap
			)
		);

		const noOfHelpCenterArticle = 40;
		await this.seeder.tryExecute(
			'Default Help Center Articles',
			createHelpCenterArticle(
				this.connection,
				[this.tenant],
				tenantOrganizationsMap,
				noOfHelpCenterArticle
			)
		);

		const defaultEmployees = await getDefaultEmployees(
			this.connection, 
			this.tenant
		);
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
		const { name } = this.tenant;
		const rendomTenants: ITenant[] = await this.connection.getRepository(Tenant).find({
			where: {
				name: Not(name)
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
