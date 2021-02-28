import { Injectable } from '@nestjs/common';
import { Connection, getConnection, Not } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import {
	getDefaultBulgarianOrganization,
	getDefaultOrganizations,
	getDefaultTenant,
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

/**
 * Service dealing with help center based operations.
 *
 * @class
 */
@Injectable()
export class HelpCenterSeederService {
	connection: Connection;
	tenant: ITenant;
	organization: IOrganization;
	organizations: IOrganization[];
	defaultEmployees: IEmployee[];

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
		this.tenant = await getDefaultTenant(this.connection);
		this.organization = await getDefaultBulgarianOrganization(
			this.connection,
			this.tenant
		);
		this.organizations = await getDefaultOrganizations(
			this.connection,
			this.tenant
		);

		await this.seeder.tryExecute(
			'Default Help Centers',
			createHelpCenter(this.connection, this.tenant, this.organization)
		);

		const noOfHelpCenterArticle = 5;
		await this.seeder.tryExecute(
			'Default Help Center Articles',
			createHelpCenterArticle(
				this.connection,
				this.organizations,
				noOfHelpCenterArticle
			)
		);

		this.defaultEmployees = await getDefaultEmployees(this.connection);

		await this.seeder.tryExecute(
			'Default Help Center Author',
			createDefaultHelpCenterAuthor(
				this.connection,
				this.defaultEmployees
			)
		);
	}

	/**
	 * Seed all random help center and related methods.
	 *
	 * @function
	 */
	async createRandom() {
		const noOfHelpCenterArticle = 10;
		await this.seeder.tryExecute(
			'Random Help Center Articles',
			createHelpCenterArticle(
				this.connection,
				this.organizations,
				noOfHelpCenterArticle
			)
		);

		const rendomTenants: Tenant[] = await this.connection
			.getRepository(Tenant)
			.find({
				where: {
					name: Not('Ever')
				}
			});

		const employeeMap: Map<ITenant, IEmployee[]> = new Map();
		for await (const tenant of rendomTenants) {
			const employees: Employee[] = await this.connection
				.getRepository(Employee)
				.find({
					where: {
						tenantId: tenant.id
					}
				});
			employeeMap.set(tenant, employees);
		}

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
