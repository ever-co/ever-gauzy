import { Injectable } from '@nestjs/common';
import { DataSource, getConnection, Not } from 'typeorm';
import { IEmployee, IOrganization, ITenant } from '@gauzy/contracts';
import {
	getDefaultOrganizations,
	getDefaultEmployees,
	SeedDataService,
	Tenant,
	Employee
} from '@gauzy/core';
import { SEEDER_DB_CONNECTION } from '@gauzy/common';
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
	dataSource: DataSource;
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
		this.dataSource = getConnection(SEEDER_DB_CONNECTION);
		this.tenant = this.seeder.tenant;

		const organizations = await getDefaultOrganizations(
			this.dataSource,
			this.tenant
		);
		const tenantOrganizationsMap: Map<ITenant, IOrganization[]> = new Map();
		tenantOrganizationsMap.set(this.tenant, organizations);

		await this.seeder.tryExecute(
			'Default Help Centers',
			createHelpCenter(
				this.dataSource,
				[this.tenant],
				tenantOrganizationsMap
			)
		);

		const noOfHelpCenterArticle = 40;
		await this.seeder.tryExecute(
			'Default Help Center Articles',
			createHelpCenterArticle(
				this.dataSource,
				[this.tenant],
				tenantOrganizationsMap,
				noOfHelpCenterArticle
			)
		);

		const defaultEmployees = await getDefaultEmployees(
			this.dataSource,
			this.tenant
		);
		await this.seeder.tryExecute(
			'Default Help Center Author',
			createDefaultHelpCenterAuthor(
				this.dataSource,
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
		const rendomTenants: ITenant[] = await this.dataSource.getRepository(Tenant).find({
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

			const employees: Employee[] = await this.dataSource.getRepository(Employee).find({
				where: {
					tenantId: tenant.id
				}
			});
			employeeMap.set(tenant, employees);
		}

		await this.seeder.tryExecute(
			'Random Help Centers',
			createHelpCenter(
				this.dataSource,
				rendomTenants,
				tenantOrganizationsMap
			)
		);

		const noOfHelpCenterArticle = 40;
		await this.seeder.tryExecute(
			'Random Help Center Articles',
			createHelpCenterArticle(
				this.dataSource,
				rendomTenants,
				tenantOrganizationsMap,
				noOfHelpCenterArticle
			)
		);

		await this.seeder.tryExecute(
			'Random Help Center Authors',
			createRandomHelpCenterAuthor(
				this.dataSource,
				rendomTenants,
				employeeMap
			)
		);
	}
}
