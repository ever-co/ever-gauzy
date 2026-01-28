import { Injectable } from '@nestjs/common';
import * as chalk from 'chalk';
import { ConfigService } from '@gauzy/config';
import { SeedDataService } from '../core/seeds/seed-data.service';
import { UserService } from '../user/user.service';

@Injectable()
export class AppService {
	constructor(
		private readonly configService: ConfigService,
		private readonly seedDataService: SeedDataService,
		private readonly userService: UserService
	) {}

	/**
	 * Seed DB if no users exists (for simplicity and safety we only re-seed DB if no users found)
	 * TODO: this should actually include more checks, e.g. if schema migrated and many other things
	 */
	async seedDBIfEmpty() {
		const userCount = await this.userService.countAll();
		console.log(chalk.magenta(`Found ${userCount} users in DB`));

		if (userCount > 0) {
			// If users already exist, skip default seeding
			return;
		}

		await this.seedDataService.runDefaultSeed(true);
	}

	/*
	 * Seed DB for Demo server if empty
	 */
	async seedDemoIfEmpty() {
		const userCount = await this.userService.countAll();
		const isDemo = this.configService.get('demo') === true;

		// Only run demo seed if no users exist and demo mode is enabled
		if (userCount === 0 && isDemo) {
			await this.seedDataService.runDemoSeed();
		}
	}
}
