import { Injectable } from '@nestjs/common';
import { Connection, getConnection } from 'typeorm';
import {
	getDefaultBulgarianOrganization,
	getDefaultOrganizations,
	getDefaultTenant,
	SeedDataService
} from '@gauzy/core';
import { createHelpCenter } from './help-center';
import { createHelpCenterArticle } from './help-center-article/help-center-article.seed';
import {
	createDefaultHelpCenterAuthor,
	createRandomHelpCenterAuthor
} from './help-center-author';
import { IOrganization, ITenant } from '@gauzy/contracts';

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

		await this.seeder.tryExecute(
			'Default Help Center Author',
			createDefaultHelpCenterAuthor(
				this.connection,
				this.seeder.defaultEmployees
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

		await this.seeder.tryExecute(
			'Random Help Center Authors',
			createRandomHelpCenterAuthor(
				this.seeder.connection,
				this.seeder.randomTenants,
				this.seeder.randomTenantEmployeeMap
			)
		);
	}
}
