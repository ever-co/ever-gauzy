import { Injectable } from '@nestjs/common';
import { SeedDataService } from '@gauzy/core';
import { createChangelog } from './changelog.seed';
import { Connection, getConnection } from 'typeorm';
import { SEEDER_DB_CONNECTION } from '@gauzy/common';

/**
 * Service dealing with help center based operations.
 *
 * @class
 */
@Injectable()
export class ChangelogSeederService {
	connection: Connection;

	/**
	 * Create an instance of class.
	 *
	 * @constructs
	 *
	 */
	constructor(private readonly seeder: SeedDataService) {}

	/**
	 * Seed default change log.	 																																															*
	 * @function
	 */
	async createBasicDefault() {
		this.connection = getConnection(SEEDER_DB_CONNECTION);
		await this.seeder.tryExecute(
			'Default Changelog',
			createChangelog(this.connection)
		);
	}
}
