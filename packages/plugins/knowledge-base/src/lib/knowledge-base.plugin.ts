import * as chalk from 'chalk';
import { SeederModule } from '@gauzy/core';
import { GauzyCorePlugin as Plugin, IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable } from '@gauzy/plugin';
import { HelpCenterAuthor, HelpCenterAuthorModule } from './help-center-author';
import { HelpCenter, HelpCenterModule } from './help-center';
import { HelpCenterArticle, HelpCenterArticleModule } from './help-center-article';
import { HelpCenterSeederService } from './help-center-seeder.service';

@Plugin({
	imports: [HelpCenterModule, HelpCenterArticleModule, HelpCenterAuthorModule, SeederModule],
	entities: [HelpCenter, HelpCenterArticle, HelpCenterAuthor],
	providers: [HelpCenterSeederService]
})
export class KnowledgeBasePlugin implements IOnPluginBootstrap, IOnPluginDestroy, IOnPluginSeedable {
	// We disable by default additional logging for each event to avoid cluttering the logs
	private logEnabled = true;

	constructor(private readonly helpCenterSeederService: HelpCenterSeederService) {}

	/**
	 * Called when the plugin is being initialized.
	 */
	onPluginBootstrap(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.green(`${KnowledgeBasePlugin.name} is being bootstrapped...`));
		}
	}

	/**
	 * Called when the plugin is being destroyed.
	 */
	onPluginDestroy(): void | Promise<void> {
		if (this.logEnabled) {
			console.log(chalk.red(`${KnowledgeBasePlugin.name} is being destroyed...`));
		}
	}

	/**
	 * Seed default data using the Help Center seeder service.
	 * This method is intended to be invoked during the default seed phase of the plugin lifecycle.
	 */
	async onPluginDefaultSeed() {
		try {
			await this.helpCenterSeederService.createDefault();

			if (this.logEnabled) {
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

			if (this.logEnabled) {
				console.log(chalk.green(`Random data seeded successfully for ${KnowledgeBasePlugin.name}.`));
			}
		} catch (error) {
			console.error(chalk.red('Error seeding random data:', error));
		}
	}
}
