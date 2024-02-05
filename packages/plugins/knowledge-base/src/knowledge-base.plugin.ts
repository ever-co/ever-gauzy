
import * as chalk from 'chalk';
import { SeederModule } from '@gauzy/core';
import {
	CorePlugin,
	IOnPluginBootstrap,
	IOnPluginDestroy,
	IOnPluginWithDefaultSeed,
	IOnPluginWithRandomSeed
} from '@gauzy/plugin';
import { HelpCenterAuthor, HelpCenterAuthorModule } from './help-center-author';
import { HelpCenter, HelpCenterModule } from './help-center';
import {
	HelpCenterArticle,
	HelpCenterArticleModule
} from './help-center-article';
import { HelpCenterSeederService } from './help-center-seeder.service';

@CorePlugin({
	imports: [
		HelpCenterModule,
		HelpCenterArticleModule,
		HelpCenterAuthorModule,
		SeederModule
	],
	entities: [
		HelpCenter,
		HelpCenterArticle,
		HelpCenterAuthor
	],
	providers: [
		HelpCenterSeederService
	]
})
export class KnowledgeBasePlugin implements IOnPluginBootstrap, IOnPluginDestroy, IOnPluginWithDefaultSeed, IOnPluginWithRandomSeed {

	private logging: boolean = true;

	constructor(
		private readonly helpCenterSeederService: HelpCenterSeederService
	) { }

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logging) {
			console.log('KnowledgeBasePlugin is being bootstrapped...');
			// Your existing logic here...
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logging) {
			console.log('KnowledgeBasePlugin is being destroyed...');
			// Your existing logic here...
		}
	}

	/**
	 * Seed default data using the Help Center seeder service.
	 * This method is intended to be invoked during the default seed phase of the plugin lifecycle.
	 */
	async onPluginDefaultSeed() {
		try {
			await this.helpCenterSeederService.createDefault();

			if (this.logging) {
				console.log(chalk.green(`Default data seeded successfully for ${KnowledgeBasePlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red('Error seeding default data:', error));
		}
	}

	/**
	 * Seed random data using the Help Center seeder service.
	 * This method is intended to be invoked during the random seed phase of the plugin lifecycle.
	 */
	async onPluginRandomSeed() {
		try {
			await this.helpCenterSeederService.createRandom();

			if (this.logging) {
				console.log(chalk.green(`Random data seeded successfully for ${KnowledgeBasePlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red('Error seeding random data:', error));
		}
	}
}
