import { Injectable } from '@nestjs/common';
import * as chalk from 'chalk';
import { environment } from '@gauzy/config';
import { SeedDataService } from '../core/seeds/seed-data.service';
import { UserService } from '../user/user.service';
import { getPublishedSeedAccounts } from '../bootstrap/validate-secrets';

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
			await this.warnAboutPublishedSeedPasswords();
			return;
		}

		await this.seedDataService.runDefaultSeed(true);
	}

	/**
	 * Warns (never refuses) when a seeded default account of an existing database still signs in with
	 * its published password. The seed guard only protects NEW databases, so an install seeded before
	 * it existed keeps `admin@ever.co` / `admin` until someone rotates it (GHSA-4r2r-mv32-3468).
	 * Skipped on the demo, which publishes these credentials by design. Never throws.
	 */
	private async warnAboutPublishedSeedPasswords(): Promise<void> {
		if (environment.demo === true || process.env.DEMO === 'true') {
			return;
		}
		try {
			const { matches, inconclusive } = await this.userService.findAccountsUsingPasswords(
				getPublishedSeedAccounts()
			);
			if (inconclusive.length > 0) {
				// The check reads a bounded number of rows per address, so with the same seeded address
				// in many tenants a vulnerable one can sit outside the sample. Say so rather than let a
				// silent boot read as "clean".
				console.warn(
					chalk.yellow(
						`Seeded accounts were checked for published passwords, but not exhaustively for ` +
							`${inconclusive.join(', ')}: that address exists in more tenants than the check reads. ` +
							'Audit those tenants separately.'
					)
				);
			}
			if (matches.length === 0) {
				return;
			}
			console.error(chalk.bgRed.whiteBright.bold(` INSECURE ACCOUNTS: ${matches.join(', ')} `));
			console.error(
				chalk.red(
					`${matches.join(', ')} still ${matches.length === 1 ? 'uses its' : 'use their'} published default ` +
						'password from the Gauzy README. Anyone who can reach the login page can sign in as ' +
						`${matches.length === 1 ? 'it' : 'them'}. Change ${matches.length === 1 ? 'that password' : 'those passwords'} ` +
						'now (or deactivate the account).'
				)
			);
		} catch (error: any) {
			console.warn(chalk.yellow(`Could not check seeded accounts for published passwords: ${error?.message ?? error}`));
		}
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
