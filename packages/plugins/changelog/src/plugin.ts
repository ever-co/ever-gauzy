import * as chalk from 'chalk';
import { SeederModule } from '@gauzy/core';
import { CorePlugin, IOnPluginWithBasicSeed } from '@gauzy/plugin';
import { ChangelogModule } from './changelog.module';
import { Changelog } from './changelog.entity';
import { ChangelogSeederService } from './changelog-seeder.service';

@CorePlugin({
	imports: [ChangelogModule, SeederModule],
	entities: [Changelog],
	providers: [ChangelogSeederService]
})
export class ChangelogPlugin implements IOnPluginWithBasicSeed {

	constructor(
		private readonly changelogSeederService: ChangelogSeederService
	) { }

	/**
	 * Seed basic default data using the Changelog seeder service.
	 * This method is intended to be invoked during the basic seed phase of the plugin lifecycle.
	 */
	async onPluginBasicSeed() {
		try {
			await this.changelogSeederService.createBasicDefault();
			console.log(chalk.green(`Basic default data seeded successfully for ${ChangelogPlugin.name}.`));
		} catch (error) {
			console.error(chalk.red('Error seeding basic default data:', error));
		}
	}
}
