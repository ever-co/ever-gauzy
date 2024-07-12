import { Injectable } from '@nestjs/common';
import { SeedDataService } from '@gauzy/core';
import { createChangelog } from './changelog.seed';

/**
 * Service dealing with help center based operations.
 *
 * @class
 */
@Injectable()
export class ChangelogSeederService {
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
	 * Seed default change log.	 																																															*
	 * @function
	 */
	async createBasicDefault() {
		await this.seeder.tryExecute(
			'Default Changelog',
			createChangelog(this.seeder.dataSource)
		);
	}
}
