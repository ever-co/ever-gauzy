import * as chalk from 'chalk';
import { SeederModule } from '@gauzy/core';
import { GauzyCorePlugin, IOnPluginBootstrap, IOnPluginDestroy, IOnPluginWithBasicSeed } from '@gauzy/plugin';
import { ChangelogModule } from './changelog.module';
import { Changelog } from './changelog.entity';
import { ChangelogSeederService } from './changelog-seeder.service';

@GauzyCorePlugin({
	imports: [ChangelogModule, SeederModule],
	entities: [Changelog],
	providers: [ChangelogSeederService]
})
export class ChangelogPlugin implements IOnPluginBootstrap, IOnPluginDestroy, IOnPluginWithBasicSeed {

	private logging: boolean = true;

	constructor(
		private readonly changelogSeederService: ChangelogSeederService
	) { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logging) {
			console.log('ChangelogPlugin is being bootstrapped...');
			// Your existing logic here...
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logging) {
			console.log('ChangelogPlugin is being destroyed...');
			// Your existing logic here...
		}
	}

	/**
	 * Seed basic default data using the Changelog seeder service.
	 * This method is intended to be invoked during the basic seed phase of the plugin lifecycle.
	 */
	async onPluginBasicSeed() {
		try {
			await this.changelogSeederService.createBasicDefault();

			if (this.logging) {
				console.log(chalk.green(`Basic default data seeded successfully for ${ChangelogPlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red('Error seeding basic default data:', error));
		}
	}
}
