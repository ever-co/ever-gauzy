import { Injectable } from '@nestjs/common';
import { Not } from 'typeorm';
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

/**
 * Service dealing with help center based operations.
 *
 * @class
 */
@Injectable()
export class HelpCenterSeederService {
	tenant: ITenant;

	/**
	 * Create an instance of class.
	 *
	 * @constructs
	 *
	 */
	constructor(
		private readonly seeder: SeedDataService
	) {}

	/**
	 * Seed all default help center and related methods.
	 *
	 * @function
	 */
	async createDefault() {
		this.tenant = this.seeder.tenant;

		const organizations = await getDefaultOrganizations(
			this.seeder.dataSource,
			this.tenant
		);
		const tenantOrganizationsMap: Map<ITenant, IOrganization[]> = new Map();
		tenantOrganizationsMap.set(this.tenant, organizations);

		await this.seeder.tryExecute(
			'Default Help Centers',
			createHelpCenter(
				this.seeder.dataSource,
				[this.tenant],
				tenantOrganizationsMap
			)
		);

		const noOfHelpCenterArticle = 40;
		await this.seeder.tryExecute(
			'Default Help Center Articles',
			createHelpCenterArticle(
				this.seeder.dataSource,
				[this.tenant],
				tenantOrganizationsMap,
				noOfHelpCenterArticle
			)
		);

		const defaultEmployees = await getDefaultEmployees(
			this.seeder.dataSource,
			this.tenant
		);
		await this.seeder.tryExecute(
			'Default Help Center Author',
			createDefaultHelpCenterAuthor(
				this.seeder.dataSource,
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
		const rendomTenants: ITenant[] = await this.seeder.dataSource.getRepository(Tenant).find({
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
			const employees: Employee[] = await this.seeder.dataSource.manager.findBy(Employee, {
				tenantId: tenant.id
			});
			employeeMap.set(tenant, employees);
		}

		await this.seeder.tryExecute(
			'Random Help Centers',
			createHelpCenter(
				this.seeder.dataSource,
				rendomTenants,
				tenantOrganizationsMap
			)
		);

		const noOfHelpCenterArticle = 40;
		await this.seeder.tryExecute(
			'Random Help Center Articles',
			createHelpCenterArticle(
				this.seeder.dataSource,
				rendomTenants,
				tenantOrganizationsMap,
				noOfHelpCenterArticle
			)
		);

		await this.seeder.tryExecute(
			'Random Help Center Authors',
			createRandomHelpCenterAuthor(
				this.seeder.dataSource,
				rendomTenants,
				employeeMap
			)
		);
	}
}
