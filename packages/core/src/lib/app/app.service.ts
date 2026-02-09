import { Injectable } from '@nestjs/common';
import * as chalk from 'chalk';
import { environment } from '@gauzy/config';
import { SeedDataService } from '../core/seeds/seed-data.service';
import { UserService } from '../user/user.service';

@Injectable()
export class AppService {
	public userCount: number = 0;

	constructor(private readonly seedDataService: SeedDataService, private readonly userService: UserService) {}

	/**
	 * Seed DB if no users exists (for simplicity and safety we only re-seed DB if no users found)
	 * TODO: this should actually include more checks, e.g. if schema migrated and many other things
	 */
	async seedDBIfEmpty() {
		this.userCount = await this.userService.countAll();
		console.log(chalk.magenta(`Found ${this.userCount} users in DB`));

		if (this.userCount > 0) {
			// If users already exist, skip default seeding
			return;
		}

		await this.seedDataService.runDefaultSeed(true);
	}

	/*
	 * Seed DB for Demo server if empty
	 */
	async seedDemoIfEmpty() {
		const isDemo = environment.demo === true;
		console.log(
			chalk.magenta(`Demo mode is ${isDemo ? 'enabled' : 'disabled'}. Found ${this.userCount} users in DB.`)
		);

		// Only run demo seed if no users exist and demo mode is enabled
		if (this.userCount === 0 && isDemo) {
			await this.seedDataService.runDemoSeed();
		}
	}
}
