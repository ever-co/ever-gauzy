import * as chalk from 'chalk';
import { SeederModule } from '@gauzy/core';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable } from '@gauzy/plugin';
import { ChangelogModule } from './changelog.module';
import { Changelog } from './changelog.entity';
import { ChangelogSeederService } from './changelog-seeder.service';

@Plugin({
	imports: [ChangelogModule, SeederModule],
	entities: [Changelog],
	providers: [ChangelogSeederService]
})
export class ChangelogPlugin implements IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor(private readonly changelogSeederService: ChangelogSeederService) {}

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${ChangelogPlugin.name} is being bootstrapped...`));
			console.log('ChangelogPlugin is being bootstrapped...');
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${ChangelogPlugin.name} is being destroyed...`));
		}
	}

	/**
	 * Seed basic default data using the Changelog seeder service.
	 * This method is intended to be invoked during the basic seed phase of the plugin lifecycle.
	 */
	async onPluginBasicSeed() {
		try {
			await this.changelogSeederService.createBasicDefault();

			if (this.logEnabled) {
				console.log(chalk.green(`Basic default data seeded successfully for ${ChangelogPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red('Error seeding basic default data:', error));
		}
	}
}
