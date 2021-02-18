import { Injectable } from '@nestjs/common';
import { SeedDataService } from '@gauzy/core';
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
		await this.seeder.tryExecute(
			'Default Help Centers',
			createHelpCenter(
				this.seeder.connection,
				this.seeder.tenant,
				this.seeder.organizations[0]
			)
		);

		const noOfHelpCenterArticle = 5;
		await this.seeder.tryExecute(
			'Default Help Center Articles',
			createHelpCenterArticle(
				this.seeder.connection,
				this.seeder.organizations,
				noOfHelpCenterArticle
			)
		);

		await this.seeder.tryExecute(
			'Default Help Center Author',
			createDefaultHelpCenterAuthor(
				this.seeder.connection,
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
				this.seeder.connection,
				this.seeder.organizations,
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
